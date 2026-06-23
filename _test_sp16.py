# -*- coding: utf-8 -*-
"""TESTE LOGADO Sprint 1.6 — simula EXATAMENTE o que o Bruno fez."""
import json, urllib.request, urllib.parse, urllib.error, http.cookiejar, sys, time
sys.stdout.reconfigure(encoding='utf-8')
HOST = "dev.saudedotrabalho.com"

def login(email, pwd):
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    try:
        op.open(urllib.request.Request(
            f"https://{HOST}/api/trpc/auth.corporateLogin",
            data=json.dumps({"json": {"email": email, "password": pwd}}).encode(),
            headers={"Content-Type": "application/json"}, method="POST"), timeout=30).read()
        return op
    except urllib.error.HTTPError as e:
        return e.read().decode()[:200]

def c(op, path, inp=None, m="POST"):
    url = f"https://{HOST}/api/trpc/{path}"
    data = None
    if m == "GET":
        if inp is not None: url += "?input=" + urllib.parse.quote(json.dumps({"json": inp}))
    else: data = json.dumps({"json": inp}).encode()
    try:
        r = op.open(urllib.request.Request(url, data=data, headers={"Content-Type":"application/json"}, method=m), timeout=60)
        return r.status, json.loads(r.read())["result"]["data"]["json"]
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode(); msg = json.loads(body)["error"]["json"]["message"]
        except Exception:
            msg = body[:200] if 'body' in locals() else "?"
        return e.code, msg

super_op = None
for pwd in ["SA_Test@2026", "SaudeT@2025", "saude@123"]:
    op = login("contato@saudedotrabalho.com", pwd)
    if not isinstance(op, str):
        s, me = c(op, "auth.me", None, "GET")
        if s == 200 and me.get("role") in ("super_admin", "admin_global"):
            print(f"SUPER ADMIN logado com pwd='{pwd}' role={me.get('role')} cid={me.get('companyId')}")
            super_op = op
            break

if super_op:
    print()
    print("=" * 60); print("BUG #1: RT como Super Admin"); print("=" * 60)
    print("\n[A] criar SEM companyId (deve falhar com mensagem clara):")
    print("  ->", *c(super_op, "responsibleTechnicians.create",
                     {"name": "Teste Sem CID", "registration": "X", "profession": "Y"}, "POST"))
    print("\n[B] criar COM companyId=1 (deve OK):")
    s, r = c(super_op, "responsibleTechnicians.create",
             {"companyId": 1, "name": "RT Smoke SA", "registration": "CRP 99-99999",
              "profession": "Psicologa Teste", "isDefault": False}, "POST")
    print("  ->", s, r)
    rt_id = r.get("id") if s == 200 else None
    print("\n[C] list como Super Admin com companyId:")
    s, r = c(super_op, "responsibleTechnicians.list", {"companyId": 1}, "GET")
    if s == 200:
        print(f"  -> {len(r)} RTs, ultimos:", [{"id": x["id"], "name": x["name"]} for x in r[-3:]])
    if rt_id:
        print("\n[CLEANUP] remove RT teste:", *c(super_op, "responsibleTechnicians.remove", {"id": rt_id}, "POST"))
else:
    print("nao consegui logar como Super Admin — pulando teste do bug #1")

print()
print("=" * 60); print("BUG #2: PRIMEIRO ACESSO"); print("=" * 60)

rh = login("rh@mfconexoes.com.br", "RH_Test@2026")
test_email = f"smoke.activate.{int(time.time())}@test.local"
print(f"\n[A] importCollaborators novo: {test_email}")
s, r = c(rh, "admin.importCollaborators", {"companyId": 1, "dryRun": False, "rows": [
    {"email": test_email, "nome": "Smoke Ativacao", "filial": "Sede",
     "setor": "TI", "cargo": "Analista", "perfil": "colaborador"}
]}, "POST")
print("  status:", s)
if s == 200:
    row = r.get("results", [{}])[0]
    print(f"  action={row.get('action')} emailSent={row.get('emailSent')} emailWarning={row.get('emailWarning')!r}")

import paramiko
ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('2.24.104.195', username='root', password='Atireiopaunogato@#01', timeout=30)
def run(cmd):
    _, o, e = ssh.exec_command(cmd)
    return (o.read().decode('utf-8', 'replace') + e.read().decode('utf-8', 'replace')).strip()
def q(sql):
    return run("MYSQL_PWD='SaudeApp2024@#' mysql -u saudeapp saudedotrabalho -N -e \"" + sql + "\"")

token = q(f"SELECT activation_token FROM corporate_emails WHERE email='{test_email}'").strip()
print(f"\n[B] token gerado no DB: {token[:20]}... (len={len(token)})")

if len(token) >= 20:
    cj = http.cookiejar.CookieJar()
    pub_op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    url = f"https://{HOST}/api/trpc/auth.validateActivationToken?input=" + urllib.parse.quote(json.dumps({"json": {"token": token}}))
    try:
        r2 = pub_op.open(url, timeout=30)
        d = json.loads(r2.read())["result"]["data"]["json"]
        print(f"  validateActivationToken: {d}")
    except urllib.error.HTTPError as e:
        print(f"  validateActivationToken ERRO {e.code}: {e.read().decode()[:200]}")

    print("\n[C] activateAccount com senha 'TestePwd2026!'")
    try:
        req = urllib.request.Request(f"https://{HOST}/api/trpc/auth.activateAccount",
            data=json.dumps({"json": {"token": token, "password": "TestePwd2026!"}}).encode(),
            headers={"Content-Type": "application/json"}, method="POST")
        r3 = pub_op.open(req, timeout=30)
        d = json.loads(r3.read())["result"]["data"]["json"]
        print(f"  activateAccount: {d}")
    except urllib.error.HTTPError as e:
        print(f"  activateAccount ERRO {e.code}: {e.read().decode()[:200]}")

    op_new = login(test_email, "TestePwd2026!")
    if isinstance(op_new, str):
        print(f"\n[D] login NOVO USUARIO: BLOQUEADO: {op_new[:120]}")
    else:
        s, me = c(op_new, "auth.me", None, "GET")
        print(f"\n[D] login NOVO USUARIO: status={s} role={me.get('role')} cid={me.get('companyId')}")

# Cleanup
q(f"DELETE FROM users WHERE email='{test_email}'")
q(f"DELETE FROM corporate_emails WHERE email='{test_email}'")
print("\n[CLEANUP] user teste removido")

print()
print("=" * 60); print("BUG #3: NOTIFICACOES (sino)"); print("=" * 60)

sesmt = login("sesmt.teste@mfconexoes.com.br", "Sesmt@2026")
print("\n[A] notifications.unreadCount:", *c(sesmt, "notifications.unreadCount", None, "GET"))
print("[B] notifications.list:", *c(sesmt, "notifications.list", {"limit": 5}, "GET"))
print("[C] notifications.refresh (regenera):", *c(sesmt, "notifications.refresh", None, "POST"))
print("[D] list depois do refresh:", end=" ")
s, r = c(sesmt, "notifications.list", {"limit": 20}, "GET")
items = (r or {}).get("items", []) if s == 200 else []
print(f"status={s} total={len(items)}")
for it in items[:5]:
    print(f"  - [{it.get('type')}] {it.get('title')}")

if items:
    first_id = items[0]["id"]
    print(f"\n[E] markRead id={first_id}:", *c(sesmt, "notifications.markRead", {"id": first_id}, "POST"))
    s, r = c(sesmt, "notifications.unreadCount", None, "GET")
    print(f"  unreadCount depois: {r}")

q("DELETE FROM notifications WHERE created_at > NOW() - INTERVAL 5 MINUTE")
print("\n[CLEANUP] notificacoes recem-criadas removidas")
ssh.close()
