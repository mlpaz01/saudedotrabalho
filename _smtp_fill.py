# -*- coding: utf-8 -*-
"""Preenche SMTP_HOST/USER/PASS + PUBLIC_BASE_URL no .env de dev sem expor valor.
Faz backup antes. Credenciais vêm da memória project-sdt-smtp."""
import paramiko, sys, base64, os
sys.stdout.reconfigure(encoding='utf-8')

# Credenciais (memória project-sdt-smtp)
VALUES = {
    "SMTP_HOST":       "smtpout.secureserver.net",
    "SMTP_PORT":       "465",
    "SMTP_USER":       "contato@saudedotrabalho.com",
    "SMTP_PASS":       "saude@123",
    "SMTP_FROM":       "contato@saudedotrabalho.com",
    "PUBLIC_BASE_URL": "https://dev.saudedotrabalho.com",
}

s = paramiko.SSHClient(); s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('2.24.104.195', username='root', password='Atireiopaunogato@#01', timeout=30)
def run(c):
    _, o, e = s.exec_command(c)
    return (o.read().decode('utf-8', 'replace') + e.read().decode('utf-8', 'replace')).strip()

# 1) Backup
ts = run("date +%Y%m%d_%H%M%S")
print("backup:", run(f"cp /var/www/saudedotrabalho/.env /root/backups/saudedotrabalho/env_pre_smtp_{ts}.env && chmod 600 /root/backups/saudedotrabalho/env_pre_smtp_{ts}.env && ls -lh /root/backups/saudedotrabalho/env_pre_smtp_{ts}.env"))

# 2) Lê o .env atual via base64 pra não expor no log
b64 = run("base64 -w0 /var/www/saudedotrabalho/.env")
env_raw = base64.b64decode(b64).decode("utf-8", "replace")

# 3) Atualiza as chaves: se já existe (mesmo vazia) → substitui linha; se não existe → append
lines = env_raw.splitlines()
seen = set()
out = []
for ln in lines:
    if "=" in ln and not ln.lstrip().startswith("#"):
        k = ln.split("=", 1)[0].strip()
        if k in VALUES:
            out.append(f"{k}={VALUES[k]}")
            seen.add(k)
            continue
    out.append(ln)
for k, v in VALUES.items():
    if k not in seen:
        out.append(f"{k}={v}")
new_env = "\n".join(out) + "\n"

# 4) Upload via base64
b64new = base64.b64encode(new_env.encode("utf-8")).decode()
run(f"echo {b64new} | base64 -d > /var/www/saudedotrabalho/.env && chmod 600 /var/www/saudedotrabalho/.env")

# 5) Confirma comprimentos novamente (sem valor)
print("\napos atualizacao:")
print(run(r"""awk -F= '/^SMTP_|^PUBLIC_BASE_URL/ {k=$1; v=$0; sub(/^[^=]+=/, "", v); printf "  %-22s len=%d\n", k, length(v)}' /var/www/saudedotrabalho/.env"""))

# 6) Restart PM2 com --update-env
print("\nrestart PM2:")
print(run("pm2 restart saudedotrabalho --update-env > /dev/null 2>&1 && pm2 save > /dev/null && echo OK"))

# 7) Verify SMTP real (transporter.verify) sem enviar
print("\nverify SMTP real (transporter.verify):")
print(run(r"""cd /var/www/saudedotrabalho && node -e "
require('dotenv').config();
const nm = require('nodemailer');
const host=process.env.SMTP_HOST, port=parseInt(process.env.SMTP_PORT||'587',10), user=process.env.SMTP_USER, pass=process.env.SMTP_PASS;
if(!host||!user||!pass){console.log('FALTA chave');process.exit(0);}
const t = nm.createTransport({host, port, secure: port===465, auth:{user,pass}});
t.verify().then(()=>console.log('OK: SMTP responde — '+host+':'+port)).catch(e=>console.log('FAIL: '+e.message)).finally(()=>process.exit(0));
" """))
s.close()
