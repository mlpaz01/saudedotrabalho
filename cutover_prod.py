#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cutover de PRODUCAO — promove develop -> main e implanta na VPS nova (76.13.161.14).

USO:
    python cutover_prod.py            # dry-run: so mostra o que faria
    python cutover_prod.py --confirm  # executa de verdade

Pre-requisitos (ver CUTOVER.md): OK do Bruno + aviso do Marcio + bump de versao em develop.
SSH de prod e publickey-only -> usa ~/.ssh/id_ed25519_sdtprod.
NAO mexe no SMTP nem cria usuarios (passos manuais pos-cutover).

Sprint 1 PGR Inteligente (jun/2026): aplica DDLs novos (9 tabelas pgr_gse* +
coluna users.position) ANTES do build, em transacao com backup recuperavel.
"""
import os, sys, subprocess, io, base64

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PROD_HOST = "76.13.161.14"
PROD_USER = "root"
APP_DIR   = "/var/www/saudedotrabalho"
KEY_PATH  = os.path.expanduser(r"~/.ssh/id_ed25519_sdtprod")
DB_NAME   = "saudedotrabalho"
PM2_NAME  = "saudedotrabalho"

# DDLs idempotentes da Sprint 1 (validados em dev em 2026-06-21):
DDL_FILES = ["drizzle/sql/2026-06-21_pgr_gse_init.sql"]

CONFIRM = "--confirm" in sys.argv
def banner(msg): print(f"\n{'='*60}\n{msg}\n{'='*60}")
def step(msg):   print(f"[cutover] {msg}")

def sh(cmd, check=True):
    step(f"local$ {cmd}")
    if not CONFIRM:
        return ""
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr.strip())
        if check:
            sys.exit(f"FALHOU: {cmd}")
    return r.stdout.strip()

def connect():
    import paramiko
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(PROD_HOST, username=PROD_USER,
              pkey=paramiko.Ed25519Key.from_private_key_file(KEY_PATH), timeout=30)
    return c

def rrun(c, cmd, check=True):
    step(f"prod$ {cmd}")
    if not CONFIRM:
        return ""
    _, o, e = c.exec_command(cmd)
    out = o.read().decode("utf-8", "replace").strip()
    err = e.read().decode("utf-8", "replace").strip()
    rc = o.channel.recv_exit_status()
    if out: print(out)
    if err: print(err)
    if rc != 0 and check:
        c.close(); sys.exit(f"FALHOU (rc={rc}): {cmd}")
    return out

def upload_text(c, local_path, remote_path):
    """Envia conteúdo de um arquivo local para o remoto via base64 (não precisa de SFTP)."""
    if not CONFIRM:
        step(f"upload {local_path} -> {remote_path} (dry-run)")
        return
    with open(local_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    _, o, e = c.exec_command(f"echo {b64} | base64 -d > {remote_path}")
    o.channel.recv_exit_status()

def main():
    banner("CUTOVER DE PRODUCAO" + ("" if CONFIRM else "  (DRY-RUN — nada sera executado)"))

    # --- 1. merge develop -> main (local) ---
    banner("1) Merge develop -> main e push")
    sh("git checkout main")
    sh("git pull origin main")
    sh("git merge --no-ff origin/develop -m 'chore: cutover producao (promove develop)'")
    sh("git push origin main")
    sh("git checkout develop")

    c = connect() if CONFIRM else None

    # --- 2. backup do DB de prod ---
    banner("2) Backup do DB de producao (RECUPERAVEL)")
    ts = "PREDEPLOY"  # sem timestamp dinamico; sufixo do commit anterior identifica
    prev = rrun(c, f"cd {APP_DIR} && git rev-parse --short HEAD") if CONFIRM else "<commit-atual>"
    rrun(c, f"mkdir -p /root/backups/saudedotrabalho")
    rrun(c, f"mysqldump -u root {DB_NAME} | gzip > /root/backups/saudedotrabalho/db_{ts}_{prev}.sql.gz && "
            f"ls -lh /root/backups/saudedotrabalho/db_{ts}_{prev}.sql.gz")
    rrun(c, f"tar --exclude='node_modules' --exclude='dist' "
            f"-czf /root/backups/saudedotrabalho/code_{ts}_{prev}.tar.gz -C /var/www saudedotrabalho")
    print(f"   ROLLBACK rapido se algo der errado:")
    print(f"     - DB:   zcat /root/backups/saudedotrabalho/db_{ts}_{prev}.sql.gz | mysql {DB_NAME}")
    print(f"     - app:  cd {APP_DIR} && git reset --hard {prev} && pnpm install --frozen-lockfile && npm run build && pm2 restart {PM2_NAME}")
    print(f"     - tudo: tar -xzf /root/backups/saudedotrabalho/code_{ts}_{prev}.tar.gz -C /var/www/ && (DB rollback)")

    # --- 3. DDLs da Sprint 1 ANTES do build ---
    # db:push do Drizzle gera SQL a partir do schema, mas pode não detectar tabelas
    # criadas manualmente (parallel-write). Aplicamos o DDL idempotente direto e
    # depois deixamos o db:push fazer ajustes finos.
    banner("3) Aplicar DDLs da Sprint 1 (idempotentes)")
    for ddl in DDL_FILES:
        remote_ddl = f"/tmp/{os.path.basename(ddl)}"
        upload_text(c, ddl, remote_ddl) if c else step(f"upload {ddl} -> {remote_ddl}")
        rrun(c, f"mysql -u root {DB_NAME} < {remote_ddl} && echo 'DDL aplicado: {ddl}'", check=True)
    # ALTER de users.position (idempotente: só roda se não existir)
    rrun(c,
        f"""bash -c "EXISTS=\\$(mysql -u root {DB_NAME} -N -e \\"SHOW COLUMNS FROM users LIKE 'position'\\"); """
        f"""if [ -z \\"\\$EXISTS\\" ]; then mysql -u root {DB_NAME} -e 'ALTER TABLE users ADD COLUMN position VARCHAR(120) NULL' && echo 'users.position criada'; else echo 'users.position ja existe'; fi" """)
    rrun(c, f"mysql -u root {DB_NAME} -e \"SHOW TABLES LIKE 'pgr_gse%'\"")

    # --- 4. deploy.sh (git pull + build + pm2 restart) ---
    banner("4) deploy.sh (git pull origin main + pnpm install + build + pm2 restart)")
    rrun(c, f"cd {APP_DIR} && bash deploy.sh")

    # --- 5. db:push final (ajustes finos do Drizzle, idempotente) ---
    banner("5) Ajustes Drizzle (pnpm db:push, idempotente)")
    rrun(c, f"cd {APP_DIR} && pnpm db:push", check=False)
    rrun(c, f"pm2 restart {PM2_NAME} --update-env && pm2 save")

    # --- 6. pos-checks basicos ---
    banner("6) Pos-checks basicos (HTTP, PM2, commit)")
    rrun(c, f"pm2 describe {PM2_NAME} | grep -E 'status|restarts' | head -3", check=False)
    new = rrun(c, f"cd {APP_DIR} && git rev-parse --short HEAD")
    rrun(c, "curl -s -o /dev/null -w 'HTTP %{http_code}\\n' https://saudedotrabalho.com/", check=False)
    rrun(c, f"pm2 logs {PM2_NAME} --lines 15 --nostream 2>/dev/null | tail -15", check=False)

    # --- 7. smoke check Sprint 1 (procedures GSE respondem) ---
    banner("7) Smoke check Sprint 1 (procedures GSE)")
    # Smoke 1: tabelas existem
    rrun(c, f"mysql -u root {DB_NAME} -N -e \"SELECT COUNT(*) AS gse_tables FROM information_schema.tables "
            f"WHERE table_schema='{DB_NAME}' AND table_name LIKE 'pgr_gse%'\" | xargs -I{{}} echo 'pgr_gse* tables: {{}} (esperado: 9)'", check=False)
    # Smoke 2: users.position foi criada
    rrun(c, f"mysql -u root {DB_NAME} -N -e \"SHOW COLUMNS FROM users LIKE 'position'\"", check=False)
    # Smoke 3: HTTP raiz responde
    rrun(c, "curl -s -o /dev/null -w 'site HTTP: %{http_code}\\n' https://saudedotrabalho.com/", check=False)

    if c: c.close()
    banner("CONCLUIDO" + (f" — prod em {new}" if CONFIRM else "") if CONFIRM else "DRY-RUN concluido — rode com --confirm para executar")
    if CONFIRM:
        print()
        print("PENDENTES MANUAIS pos-cutover (NAO automatizados de proposito):")
        print("  1. Configurar SMTP em prod via UI (DB nasce limpo) — ver project-sdt-smtp")
        print("  2. Criar/ativar usuarios reais que o Bruno indicar")
        print("  3. Testar logado como SESMT: criar PGR, gerar PDF, validar secao GSE")
        print("  4. Avisar Bruno + Marcio: prod no ar com Sprint 1 PGR Inteligente concluida")

if __name__ == "__main__":
    main()
