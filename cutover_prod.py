#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cutover de PRODUCAO — promove develop -> main e implanta na VPS nova (76.13.161.14).

USO:
    python scripts/cutover_prod.py            # dry-run: so mostra o que faria
    python scripts/cutover_prod.py --confirm  # executa de verdade

Pre-requisitos (ver CUTOVER.md): OK do Bruno + aviso do Marcio + bump de versao em develop.
SSH de prod e publickey-only -> usa ~/.ssh/id_ed25519_sdtprod.
NAO mexe no SMTP nem cria usuarios (passos manuais pos-cutover).
"""
import os, sys, subprocess, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PROD_HOST = "76.13.161.14"
PROD_USER = "root"
APP_DIR   = "/var/www/saudedotrabalho"
KEY_PATH  = os.path.expanduser(r"~/.ssh/id_ed25519_sdtprod")
DB_NAME   = "saudedotrabalho"
PM2_NAME  = "saudedotrabalho"

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
    banner("2) Backup do DB de producao")
    ts = "PREDEPLOY"  # sem timestamp dinamico; sufixo do commit anterior identifica
    prev = rrun(c, f"cd {APP_DIR} && git rev-parse --short HEAD") if CONFIRM else "<commit-atual>"
    rrun(c, f"mysqldump -u root {DB_NAME} > /root/backup_{DB_NAME}_{ts}_{prev}.sql && "
            f"ls -lh /root/backup_{DB_NAME}_{ts}_{prev}.sql")
    print(f"   (rollback do app: git reset --hard {prev} em {APP_DIR})")

    # --- 3. deploy.sh ---
    banner("3) deploy.sh (fetch main, build, pm2 restart)")
    rrun(c, f"cd {APP_DIR} && bash deploy.sh")

    # --- 4. migracoes ---
    banner("4) Migracoes de schema (db:push)")
    rrun(c, f"cd {APP_DIR} && pnpm db:push", check=False)
    rrun(c, f"cd {APP_DIR} && pm2 restart {PM2_NAME} --update-env && pm2 save")

    # --- 5. pos-checks ---
    banner("5) Pos-checks")
    rrun(c, f"pm2 describe {PM2_NAME} | grep -E 'status|restarts' | head -3", check=False)
    rrun(c, f"cd {APP_DIR} && git rev-parse --short HEAD")
    rrun(c, "curl -s -o /dev/null -w 'HTTP %{http_code}\\n' https://saudedotrabalho.com/", check=False)
    rrun(c, f"pm2 logs {PM2_NAME} --lines 15 --nostream 2>/dev/null | tail -15", check=False)

    if c: c.close()
    banner("CONCLUIDO" if CONFIRM else "DRY-RUN concluido — rode com --confirm para executar")
    if CONFIRM:
        print("PENDENTE MANUAL: configurar SMTP em prod e criar usuarios reais (ver CUTOVER.md).")

if __name__ == "__main__":
    main()
