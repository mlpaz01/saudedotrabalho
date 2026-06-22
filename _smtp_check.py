# -*- coding: utf-8 -*-
"""Diagnóstico SMTP em dev — só comprimentos, nunca valores."""
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')
s = paramiko.SSHClient(); s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('2.24.104.195', username='root', password='Atireiopaunogato@#01', timeout=30)
def run(c):
    _, o, e = s.exec_command(c)
    return (o.read().decode('utf-8', 'replace') + e.read().decode('utf-8', 'replace')).strip()

print("comprimentos das chaves no .env:")
print(run(r"""awk -F= '/^SMTP_|^PUBLIC_BASE_URL/ {k=$1; v=$0; sub(/^[^=]+=/, "", v); printf "  %-22s len=%d\n", k, length(v)}' /var/www/saudedotrabalho/.env"""))

print("\nverificacao via dotenv (mesmo loader que o app usa):")
print(run(r"""cd /var/www/saudedotrabalho && node -e "require('dotenv').config(); ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM','PUBLIC_BASE_URL'].forEach(k=>console.log('  '+k+' len='+(process.env[k]||'').length))" """))

print("\nteste real do transporter (sem enviar):")
print(run(r"""cd /var/www/saudedotrabalho && node -e "
require('dotenv').config();
const nm = require('nodemailer');
const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT||'587',10);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
if (!host || !user || !pass) { console.log('FALTA chave: host='+!!host+' user='+!!user+' pass='+!!pass); process.exit(0); }
const t = nm.createTransport({ host, port, secure: port===465, auth:{user,pass} });
t.verify().then(()=>console.log('verify OK: SMTP funciona ('+host+':'+port+')')).catch(e=>console.log('verify FAIL: '+e.message));
" """))
s.close()
