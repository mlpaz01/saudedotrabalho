# -*- coding: utf-8 -*-
"""Teste real Biblioteca Preventiva Template Global (3 perfis)."""
import json, urllib.request, urllib.parse, urllib.error, http.cookiejar, sys
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
        return None

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
        body = e.read().decode()
        try: msg = json.loads(body)["error"]["json"]["message"]
        except Exception: msg = body[:200]
        return e.code, msg

sa = login("contato@saudedotrabalho.com", "SA_Test@2026")
rh = login("rh@mfconexoes.com.br", "RH_Test@2026")
sesmt = login("sesmt.teste@mfconexoes.com.br", "Sesmt@2026")

print("=" * 70); print("BIBLIOTECA PREVENTIVA — Template Global (3 perfis)"); print("=" * 70)

print("\n[1] ANTES da Fase 1 — RH lista (so vê suas):")
s, r = c(rh, "preventiveLibrary.listCampaigns", None, "GET")
print(f"  RH ve {len(r) if isinstance(r,list) else '?'} campanhas")

print("\n[2] Super Admin lista (antes da Fase 1 daria vazio — agora retorna templates):")
s, r = c(sa, "preventiveLibrary.listCampaigns", None, "GET")
print(f"  SA ve {len(r) if isinstance(r,list) else '?'} campanhas (so templates)")

print("\n[3] Super Admin cria UM TEMPLATE (Janeiro Branco):")
s, r = c(sa, "preventiveLibrary.upsertCampaign", {
    "monthNumber": 1, "code": "JAN-BRANCO",
    "name": "Janeiro Branco — Template Global",
    "theme": "Saude Mental",
    "description": "Acervo padrao da plataforma para Janeiro Branco. Personalizavel por cada cliente.",
}, "POST")
print(f"  status={s} resp={r}")
tpl_id = r.get("id") if s == 200 else None
print(f"  is_template foi setado pelo backend? {r.get('isTemplate')}")

print("\n[4] RH NÃO consegue editar o template (FORBIDDEN):")
if tpl_id:
    s, r = c(rh, "preventiveLibrary.upsertCampaign", {"id": tpl_id, "name": "HACK-RH"}, "POST")
    print(f"  status={s} (deve ser 403) msg={r}")

print("\n[5] RH cadastra campanha DA EMPRESA dele:")
s, r = c(rh, "preventiveLibrary.upsertCampaign", {
    "monthNumber": 2, "code": "FEV-MF",
    "name": "Fevereiro Personalizado MF Conexoes",
    "description": "Campanha customizada da MF",
}, "POST")
rh_id = r.get("id") if s == 200 else None
print(f"  status={s} id={rh_id} isTemplate={r.get('isTemplate')}")

print("\n[6] RH lista AGORA (deve ver template global + a propria):")
s, r = c(rh, "preventiveLibrary.listCampaigns", None, "GET")
if s == 200:
    print(f"  total={len(r)}")
    for x in r:
        marker = "[TEMPLATE]" if x.get("is_template") else f"[empresa cid={x.get('company_id')}]"
        print(f"    {marker} id={x.get('id')} mês={x.get('month_number')} '{x.get('name')[:50]}'")

print("\n[7] Super Admin lista (apenas templates):")
s, r = c(sa, "preventiveLibrary.listCampaigns", None, "GET")
if s == 200:
    print(f"  total={len(r)}")
    for x in r:
        print(f"    [TEMPLATE] id={x.get('id')} '{x.get('name')[:50]}'")

print("\n[8] SESMT lista (deve ver template + nada da empresa pois RH cadastrou pela empresa):")
s, r = c(sesmt, "preventiveLibrary.listCampaigns", None, "GET")
if s == 200:
    print(f"  total={len(r)}")
    for x in r:
        marker = "[TEMPLATE]" if x.get("is_template") else f"[empresa cid={x.get('company_id')}]"
        print(f"    {marker} id={x.get('id')} '{x.get('name')[:50]}'")

print("\n[9] auditOwnership (Super Admin only):")
s, r = c(sa, "preventiveLibrary.auditOwnership", None, "GET")
print(f"  status={s}")
if s == 200:
    for x in r: print(f"    {x}")

print("\n[10] RH tenta auditOwnership (deve FORBIDDEN):")
s, r = c(rh, "preventiveLibrary.auditOwnership", None, "GET")
print(f"  status={s} (deve 403) msg={str(r)[:80]}")

print("\n[CLEANUP]")
if tpl_id: print("  rm template:", *c(sa, "preventiveLibrary.deleteCampaign", {"id": tpl_id}, "POST"))
if rh_id:  print("  rm campanha RH:", *c(rh, "preventiveLibrary.deleteCampaign", {"id": rh_id}, "POST"))
