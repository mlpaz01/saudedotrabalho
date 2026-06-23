# -*- coding: utf-8 -*-
"""E2E Sprint 1.7-A — Texto Padrão do PGR (SESMT)."""
import json, urllib.request, urllib.parse, urllib.error, http.cookiejar, sys
sys.stdout.reconfigure(encoding='utf-8')
HOST = "dev.saudedotrabalho.com"

def login(email, pwd):
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.open(urllib.request.Request(f"https://{HOST}/api/trpc/auth.corporateLogin",
        data=json.dumps({"json":{"email":email,"password":pwd}}).encode(),
        headers={"Content-Type":"application/json"}, method="POST"), timeout=30).read()
    return op

def c(op, path, inp=None, m="POST"):
    url = f"https://{HOST}/api/trpc/{path}"
    data = None
    if m == "GET":
        if inp is not None: url += "?input=" + urllib.parse.quote(json.dumps({"json":inp}))
    else: data = json.dumps({"json":inp}).encode()
    try:
        r = op.open(urllib.request.Request(url, data=data, headers={"Content-Type":"application/json"}, method=m), timeout=180)
        return r.status, json.loads(r.read())["result"]["data"]["json"]
    except urllib.error.HTTPError as e:
        try: msg = json.loads(e.read())["error"]["json"]["message"]
        except: msg = "?"
        return e.code, msg

sesmt = login("sesmt.teste@mfconexoes.com.br", "Sesmt@2026")

print("=" * 70); print("E2E Sprint 1.7-A — Texto Padrão do PGR"); print("=" * 70)

print("\n[1] Estado inicial: getDefaultTexts (deve trazer sugestivos com isDefault=True)")
s, r = c(sesmt, "sesmt.getDefaultTexts", {}, "GET")
print(f"  status={s} isDefault={r.get('isDefault')} introLen={len(r.get('texto_introducao',''))} conclLen={len(r.get('texto_conclusao',''))}")
print(f"  intro começa com: {(r.get('texto_introducao','')[:80])!r}")

print("\n[2] Salva textos PERSONALIZADOS da consultoria:")
intro_custom = """1. INTRODUÇÃO PERSONALIZADA DA MF CONEXÕES

Este PGR foi elaborado pela equipe SESMT da MF Conexões em conformidade com a NR-01.

OBJETIVOS

- Identificar riscos psicossociais e ocupacionais
- Implementar plano de ação 5W2H
- Garantir conformidade legal"""
concl_custom = """CONCLUSÃO TÉCNICA — MF CONEXÕES

Recomenda-se acompanhamento trimestral dos GSEs cadastrados.

A consultoria fica à disposição para auditoria semestral conforme contrato."""
s, r = c(sesmt, "sesmt.saveDefaultTexts", {"textoIntroducao": intro_custom, "textoConclusao": concl_custom}, "POST")
print(f"  status={s} resp={r}")

print("\n[3] Recarrega: deve trazer os textos personalizados (isDefault=False)")
s, r = c(sesmt, "sesmt.getDefaultTexts", {}, "GET")
print(f"  status={s} isDefault={r.get('isDefault')}")
print(f"  intro batem? {r.get('texto_introducao') == intro_custom}")
print(f"  concl batem? {r.get('texto_conclusao') == concl_custom}")

print("\n[4] Cria PGR novo (createBlank) — deve copiar os textos do SESMT")
s, r = c(sesmt, "pgr.createBlank", {"branchId": None}, "POST")
print(f"  status={s} id={r.get('id')}")
pid = r["id"]

print("\n[5] pgr.get(id) — confere se textos foram copiados:")
s, r = c(sesmt, "pgr.get", {"id": pid}, "GET")
doc = (r or {}).get("doc", {})
got_intro = doc.get("texto_introducao", "")
got_concl = doc.get("texto_conclusao", "")
print(f"  intro copiado? {got_intro == intro_custom}  (len={len(got_intro)})")
print(f"  concl copiado? {got_concl == concl_custom}  (len={len(got_concl)})")
print(f"  intro primeiros 80 chars: {got_intro[:80]!r}")

print("\n[6] Gera PDF do PGR e confere conteúdo")
s, r = c(sesmt, "pgr.generatePDF", {"id": pid}, "POST")
print(f"  status={s} url={r.get('url')}")

import paramiko
ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('2.24.104.195', username='root', password='Atireiopaunogato@#01', timeout=30)
def run(cmd):
    _, o, e = ssh.exec_command(cmd)
    return (o.read().decode('utf-8','replace')+e.read().decode('utf-8','replace')).strip()
pdf_path = f"/var/www/saudedotrabalho{r['url']}"

# Procura por marcadores únicos do texto personalizado e por marcadores do texto antigo
custom_intro_mark = run(f"pdftotext {pdf_path} - 2>/dev/null | grep -c 'INTRODUÇÃO PERSONALIZADA DA MF' || true").splitlines()[0].strip() or "0"
custom_concl_mark = run(f"pdftotext {pdf_path} - 2>/dev/null | grep -c 'CONCLUSÃO TÉCNICA — MF CONEXÕES' || true").splitlines()[0].strip() or "0"
old_text_mark = run(f"pdftotext {pdf_path} - 2>/dev/null | grep -c 'PARTE I — DISPOSIÇÃO GERAL' || true").splitlines()[0].strip() or "0"
print(f"\n  Marcador 'INTRODUÇÃO PERSONALIZADA DA MF' no PDF: {custom_intro_mark} (esperado: >0)")
print(f"  Marcador 'CONCLUSÃO TÉCNICA — MF CONEXÕES' no PDF: {custom_concl_mark} (esperado: >0)")
print(f"  Marcador antigo 'PARTE I — DISPOSIÇÃO GERAL' no PDF: {old_text_mark} (esperado: 0 — substituído)")

# Trecho da Conclusão pra olho humano
print("\n  Trecho da Conclusão no PDF:")
print(run(f"pdftotext {pdf_path} - 2>/dev/null | sed -n '/Conclusão Técnica/,/Responsabilidade Técnica/p' | head -20"))

print("\n[CLEANUP] remove PGR de teste e reseta texto SESMT")
c(sesmt, "pgr.remove", {"id": pid}, "POST")
# Volta os textos para os defaults sugestivos (apaga o registro)
def q(sql): return run(f"MYSQL_PWD='SaudeApp2024@#' mysql -u saudeapp saudedotrabalho -e \"{sql}\"")
print("  ", q("DELETE FROM sesmt_default_texts WHERE company_id=1"))
ssh.close()
print("\n" + "=" * 70); print("E2E COMPLETO"); print("=" * 70)
