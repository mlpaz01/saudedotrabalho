# -*- coding: utf-8 -*-
"""TESTE EXAUSTIVO Sprint 1 + Sprint 1.5 — 22/06/2026"""
import json, urllib.request, urllib.parse, urllib.error, http.cookiejar, sys, re, os
sys.stdout.reconfigure(encoding='utf-8')
HOST = "dev.saudedotrabalho.com"

PERFIS = {
    "sesmt": ("sesmt.teste@mfconexoes.com.br", "Sesmt@2026"),
    "rh":    ("rh@mfconexoes.com.br", "RH_Test@2026"),
    "psico": ("psico.teste@mfconexoes.com.br", "Psico@2026"),
}

def login(email, pwd):
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.open(urllib.request.Request(
        f"https://{HOST}/api/trpc/auth.corporateLogin",
        data=json.dumps({"json": {"email": email, "password": pwd}}).encode(),
        headers={"Content-Type": "application/json"}, method="POST"), timeout=30).read()
    return op

def c(op, path, inp=None, m="POST"):
    url = f"https://{HOST}/api/trpc/{path}"; data = None
    if m == "GET":
        if inp is not None:
            url += "?input=" + urllib.parse.quote(json.dumps({"json": inp}))
    else:
        data = json.dumps({"json": inp}).encode()
    try:
        r = op.open(urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method=m), timeout=180)
        return r.status, json.loads(r.read())["result"]["data"]["json"]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try: msg = json.loads(body)["error"]["json"]["message"]
        except Exception: msg = body[:200]
        return e.code, msg

sesmt = login(*PERFIS["sesmt"])
rh    = login(*PERFIS["rh"])
psico = login(*PERFIS["psico"])

results = []
def t(area, label, ok, evidence=""):
    sym = "PASS" if ok is True else ("FAIL" if ok is False else "WARN")
    results.append((sym, area, label, evidence))
    print(f"  [{sym}] {area:14s} | {label:55s} | {evidence}"[:220])

import paramiko
ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('2.24.104.195', username='root', password='Atireiopaunogato@#01', timeout=30)
def run(cmd):
    _, o, e = ssh.exec_command(cmd)
    return (o.read().decode('utf-8', 'replace') + e.read().decode('utf-8', 'replace')).strip()
def q(sql):
    return run("MYSQL_PWD='SaudeApp2024@#' mysql -u saudeapp saudedotrabalho -N -e \"" + sql + "\"")

# ═════════════ AREA 1: SCHEMA ═════════════
print("\n" + "=" * 72); print("AREA 1 - SCHEMA Sprint 1"); print("=" * 72)
tabs = q("SHOW TABLES LIKE 'pgr_gse%'").splitlines()
t("schema", "9 tabelas pgr_gse* criadas", len(tabs) == 9, f"encontradas={len(tabs)}")
fks = q("SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='saudedotrabalho' AND TABLE_NAME LIKE 'pgr_gse%' AND REFERENCED_TABLE_NAME IS NOT NULL").strip()
t("schema", "12 FKs ativas", int(fks) == 12, f"fks={fks}")
pos = q("SHOW COLUMNS FROM users LIKE 'position'")
t("schema", "users.position VARCHAR(120) NULL", "varchar(120)" in pos.lower(), pos[:60])

# CASCADE real
s, r = c(sesmt, "pgr.createBlank", {"branchId": None})
test_pid = r["id"] if s == 200 else None
if test_pid:
    s2, r2 = c(sesmt, "pgr.gse.create", {"pgrId": test_pid, "nome": "CASCADE-TEST"})
    test_gid = r2["id"] if s2 == 200 else None
    if test_gid:
        c(sesmt, "pgr.gse.setCargos", {"gseId": test_gid, "cargos": ["A", "B"]})
        before = q(f"SELECT COUNT(*) FROM pgr_gse_cargos WHERE gse_id={test_gid}")
        c(sesmt, "pgr.remove", {"id": test_pid})
        after = q(f"SELECT COUNT(*) FROM pgr_gse_cargos WHERE gse_id={test_gid}")
        nge = q(f"SELECT COUNT(*) FROM pgr_gse WHERE id={test_gid}")
        t("schema", "ON DELETE CASCADE limpa derivados",
          before == "2" and after == "0" and nge == "0",
          f"cargos={before}->{after}, gse={nge}")

# ═════════════ AREA 2: 13 PROCEDURES pgr.gse.* ═════════════
print("\n" + "=" * 72); print("AREA 2 - 13 Procedures pgr.gse.*"); print("=" * 72)
s, r = c(sesmt, "pgr.createBlank", {"branchId": None}); PID = r["id"]
s, r = c(sesmt, "pgr.gse.create", {"pgrId": PID, "nome": "PROC-TEST"}); GID = r["id"]
checks = [
    ("list",            lambda: c(sesmt, "pgr.gse.list", {"pgrId": PID}, "GET"), lambda x: isinstance(x, list) and len(x) >= 1),
    ("get",             lambda: c(sesmt, "pgr.gse.get", {"id": GID}, "GET"),    lambda x: isinstance(x, dict) and "gse" in x),
    ("update",          lambda: c(sesmt, "pgr.gse.update", {"id": GID, "nome": "P-2"}), lambda x: x.get("ok")),
    ("setCargos",       lambda: c(sesmt, "pgr.gse.setCargos", {"gseId": GID, "cargos": ["X"]}), lambda x: x.get("count") == 1),
    ("setSetores",      lambda: c(sesmt, "pgr.gse.setSetores", {"gseId": GID, "sectorIds": [35]}), lambda x: x.get("count") == 1),
    ("setRiscos",       lambda: c(sesmt, "pgr.gse.setRiscos", {"gseId": GID, "riscos": [{"tipo": "fisico", "agente": "X"}]}), lambda x: x.get("count") == 1),
    ("setEpc",          lambda: c(sesmt, "pgr.gse.setEpc", {"gseId": GID, "items": [{"descricao": "X"}]}), lambda x: x.get("count") == 1),
    ("setEpi",          lambda: c(sesmt, "pgr.gse.setEpi", {"gseId": GID, "items": [{"descricao": "X"}]}), lambda x: x.get("count") == 1),
    ("setAcoes",        lambda: c(sesmt, "pgr.gse.setAcoes", {"gseId": GID, "items": [{"what": "X"}]}), lambda x: x.get("count") == 1),
    ("setEvidencias",   lambda: c(sesmt, "pgr.gse.setEvidencias", {"gseId": GID, "items": [{"tipo": "foto", "titulo": "X"}]}), lambda x: x.get("count") == 1),
    ("setTreinamentos", lambda: c(sesmt, "pgr.gse.setTreinamentos", {"gseId": GID, "items": [{"nrCode": "NR-06", "nome": "X"}]}), lambda x: x.get("count") == 1),
    ("legacyStatus",    lambda: c(sesmt, "pgr.gse.legacyStatus", {"pgrId": PID}, "GET"), lambda x: x.get("hasLegacy") is False),
    ("migrateFromLegacy", lambda: c(sesmt, "pgr.gse.migrateFromLegacy", {"pgrId": PID}), lambda x: x.get("empty") is True),
    ("remove",          lambda: c(sesmt, "pgr.gse.remove", {"id": GID}), lambda x: x.get("ok")),
]
for name, fn, check in checks:
    try:
        s, r = fn()
        if s == 200:
            t("procs", f"pgr.gse.{name}", check(r), str(r)[:80])
        else:
            t("procs", f"pgr.gse.{name}", False, f"HTTP {s}: {str(r)[:60]}")
    except Exception as e:
        t("procs", f"pgr.gse.{name}", False, f"exc: {e}")
c(sesmt, "pgr.remove", {"id": PID})

# Procedures extras Sprint 1
s, r = c(sesmt, "pgr.createBlank", {"branchId": 7})
t("procs", "pgr.createBlank (Sprint 1.5)", s == 200 and isinstance(r.get("id"), int), f"id={r.get('id')}")
ext_pid = r.get("id")
s, r = c(sesmt, "pgr.listBranches", {}, "GET")
t("procs", "pgr.listBranches", s == 200 and isinstance(r, list), f"n={len(r) if isinstance(r,list) else '?'}")
s, r = c(sesmt, "pgr.listPsicossocialCycles", {}, "GET")
t("procs", "pgr.listPsicossocialCycles", s == 200 and isinstance(r, list), f"n={len(r) if isinstance(r,list) else '?'}")
s, r = c(sesmt, "pgr.importFromRH", {"pgrId": ext_pid})
t("procs", "pgr.importFromRH", s == 200 and r.get("ok"), f"{r}")
s, r = c(sesmt, "pgr.importFromCycle", {"pgrId": ext_pid, "assessmentId": 16})
t("procs", "pgr.importFromCycle", s == 200 and r.get("ok"), f"{r}")
c(sesmt, "pgr.remove", {"id": ext_pid})

# ═════════════ AREA 3: LGPD ═════════════
print("\n" + "=" * 72); print("AREA 3 - LGPD (posse por empresa)"); print("=" * 72)
pgrs_outros = q("SELECT id FROM pgr_documents WHERE company_id != 1 LIMIT 1").strip()
if pgrs_outros:
    pid_alheio = int(pgrs_outros.split()[0])
    s, r = c(sesmt, "pgr.gse.list", {"pgrId": pid_alheio}, "GET")
    t("lgpd", "SESMT acessa pgr de outra empresa -> 403/404", s in (403, 404), f"HTTP {s}: {str(r)[:60]}")
else:
    t("lgpd", "PGR de outra empresa (sem dados pra teste)", None, "vazio em dev")

s, r = c(sesmt, "pgr.createBlank", {"branchId": None}); pid2 = r["id"]
s, r = c(sesmt, "pgr.gse.create", {"pgrId": pid2, "nome": "LGPD-X"}); gid2 = r["id"]
sec_alheio = q("SELECT id FROM sectors WHERE company_id != 1 LIMIT 1").strip().split()
sid_alheio = int(sec_alheio[0]) if sec_alheio else 99999
s, r = c(sesmt, "pgr.gse.setSetores", {"gseId": gid2, "sectorIds": [sid_alheio]})
t("lgpd", f"setSetores rejeita sector_id alheio ({sid_alheio})", s == 403, f"HTTP {s}: {str(r)[:60]}")
c(sesmt, "pgr.remove", {"id": pid2})

s, appts = c(rh, "scheduling.listAppointments", {}, "GET")
has_outcome = any(a.get("outcomeNotes") for a in (appts or [])) if s == 200 else None
t("lgpd", "RH ve outcomeNotes (deve ser NULL/vazio)", has_outcome is False, f"n_appts={len(appts) if s==200 else '?'} outcome_visto={has_outcome}")

if s == 200 and appts:
    ap_id = appts[0]["id"]
    s, r = c(rh, "scheduling.updateAppointmentStatus", {"id": ap_id, "status": "completed", "outcomeNotes": "hack"}, "POST")
    t("lgpd", "RH tenta gravar outcomeNotes -> 403", s == 403, f"HTTP {s}: {str(r)[:60]}")

# ═════════════ AREA 4: Sprint 1.5 createBlank ═════════════
print("\n" + "=" * 72); print("AREA 4 - Sprint 1.5 createBlank (Novo PGR)"); print("=" * 72)
s, r = c(sesmt, "pgr.createBlank", {"branchId": 7})
new_pid = r["id"] if s == 200 else None
t("sp1.5", "createBlank retorna id numerico", new_pid and isinstance(new_pid, int), f"id={new_pid}")
s, r2 = c(sesmt, "pgr.gse.list", {"pgrId": new_pid}, "GET")
t("sp1.5", "gse.list responde no PGR recem-criado", s == 200, f"HTTP {s}")
s, r3 = c(sesmt, "pgr.get", {"id": new_pid}, "GET")
doc = r3.get("doc", {}) if s == 200 else {}
t("sp1.5", "pre-preenche razao_social", doc.get("razao_social") not in (None, ""), f"rs={doc.get('razao_social')!r}")
t("sp1.5", "pre-preenche cnpj", doc.get("cnpj") not in (None, ""), f"cnpj={doc.get('cnpj')!r}")
t("sp1.5", "salva branch_id=7", doc.get("branch_id") == 7, f"branch_id={doc.get('branch_id')}")
c(sesmt, "pgr.remove", {"id": new_pid})

# ═════════════ AREA 5: Sprint 1.5 Cargo ═════════════
print("\n" + "=" * 72); print("AREA 5 - Sprint 1.5 Cargo importador"); print("=" * 72)
s, r = c(sesmt, "admin.importCollaborators", {"companyId": 1, "dryRun": True, "rows": [
    {"email": "smoke1@ex.com", "nome": "Smoke 1", "filial": "X", "setor": "Y", "cargo": "Cargo Real", "perfil": "colaborador"}
]})
ok_c = s == 200 and r.get("results", [{}])[0].get("cargo") == "Cargo Real"
t("sp1.5", "import aceita cargo valido", ok_c, f"cargo={r.get('results',[{}])[0].get('cargo')!r}")

s, r = c(sesmt, "admin.importCollaborators", {"companyId": 1, "dryRun": True, "rows": [
    {"email": "smoke2@ex.com", "nome": "Smoke 2", "filial": "X", "setor": "Y", "perfil": "colaborador"}
]})
rej = s == 200 and r.get("results", [{}])[0].get("status") == "invalid"
t("sp1.5", "import REJEITA sem cargo", rej, f"status={r.get('results',[{}])[0].get('status')} msg={r.get('results',[{}])[0].get('message')!r}")

src = open("client/src/pages/admin/AdminUsers.tsx", encoding="utf-8").read()
ok_sep = ('let iCargo = find("cargo"' in src) and ('let iPerfil = find("perfil", "acesso", "papel")' in src)
t("sp1.5", "parseCSV: iCargo separado de iPerfil", ok_sep, "checado em AdminUsers.tsx")
ok_tpl = 'cargo;perfil' in src and 'Operador de Máquinas' in src
t("sp1.5", "CSV_TEMPLATE inclui cargo", ok_tpl, "")
ok_ui = 'Cargo é obrigatório' in src or 'Cargo</' in src
t("sp1.5", "UI explica Cargo obrigatorio", 'Cargo' in src and 'obrigatório' in src, "checado")

# ═════════════ AREA 6: Marise hardcoded ═════════════
print("\n" + "=" * 72); print("AREA 6 - Marise hardcoded em codigo vivo"); print("=" * 72)
import subprocess
p = subprocess.run(["grep", "-rE", "Marise|CRP 55-33301",
                    "server/_core/risk_pdf.ts", "server/_core/pgr_pdf.ts",
                    "server/routers.ts", "client/src/"],
                   capture_output=True, text=True)
matches = [l for l in p.stdout.splitlines() if not l.startswith("Binary")]
t("sp1.5", "Zero 'Marise|CRP 55-33301' em codigo vivo",
  len(matches) == 0, f"matches={len(matches)}: " + " | ".join(matches[:3]))

# Banner vermelho no PDF quando RT NULL? Verifica gerando laudo de assessment fresco
s, r = c(sesmt, "riskAssessment.createAssessment", {
    "sectorId": None, "branchId": None,
    "cycleName": f"SMOKE-NULL-RT-{os.getpid()}", "aepTemplateId": 1, "aepOnly": True
})
new_aid = r.get("assessmentId") if s == 200 else None
if new_aid:
    rt_db = q(f"SELECT IFNULL(responsible_technician,'__NULL__') FROM risk_assessments WHERE id={new_aid}").strip()
    t("sp1.5", "novo assessment grava RT NULL (nao Marise)",
      rt_db == "__NULL__", f"DB rt={rt_db!r}")
    # gera laudo e procura "Marise"
    s, r = c(sesmt, "riskAssessment.generateLaudoPDF", {"assessmentId": new_aid})
    pdf_url = r.get("url") if s == 200 else None
    if pdf_url:
        path = "/var/www/saudedotrabalho" + pdf_url
        marise_in_pdf = run(f"pdftotext {path} - 2>/dev/null | grep -c 'Marise' || true").splitlines()[0].strip() or "0"
        sentinel_in_pdf = run(f"pdftotext {path} - 2>/dev/null | grep -c 'cadastrado' || true").splitlines()[0].strip() or "0"
        banner_in_pdf = run(f"pdftotext {path} - 2>/dev/null | grep -c 'DOCUMENTO SEM' || true").splitlines()[0].strip() or "0"
        t("sp1.5", "PDF do laudo NOVO sem 'Marise'", int(marise_in_pdf) == 0, f"matches_marise={marise_in_pdf}")
        t("sp1.5", "PDF do laudo NOVO mostra sentinel '[Responsável...nao cadastrado]'", int(sentinel_in_pdf) >= 1, f"matches={sentinel_in_pdf}")
        t("sp1.5", "PDF do laudo NOVO mostra banner 'DOCUMENTO SEM RT'", int(banner_in_pdf) >= 1, f"matches={banner_in_pdf}")
    # cleanup: apaga assessment, surveys clonadas
    q(f"DELETE FROM risk_assessments WHERE id={new_aid}")
else:
    t("sp1.5", "criar assessment de teste", False, f"{s}: {r}")

# ═════════════ AREA 7: Cliente bundle JS tem procedures novas ═════════════
print("\n" + "=" * 72); print("AREA 7 - Bundle JS do cliente (UI Sprint 1+1.5)"); print("=" * 72)
bundle_path = run("ls -t /var/www/saudedotrabalho/dist/public/assets/index-*.js | head -1").strip()
if bundle_path:
    grep_proc = run(f"grep -c 'gse.list\\|gse.create\\|createBlank\\|importFromRH\\|importFromCycle\\|migrateFromLegacy' {bundle_path}")
    t("ui", "bundle JS contem refs as procedures Sprint1+1.5", int(grep_proc) >= 5, f"matches no bundle: {grep_proc}")
    grep_strings = run(f"grep -oE 'Grupos Similares de Exposição|Importações Inteligentes|Modelo legado|Novo GSE|Importar do RH|Importar Ciclo' {bundle_path} | sort -u | wc -l")
    t("ui", "bundle JS contem labels visiveis novos", int(grep_strings) >= 4, f"labels distintos encontrados: {grep_strings}")
else:
    t("ui", "bundle JS encontrado", False, "sem bundle")

# ═════════════ AREA 8: generatePDF parallel-write ═════════════
print("\n" + "=" * 72); print("AREA 8 - generatePDF parallel-write"); print("=" * 72)
# Cria PGR novo, sem GSE → PDF deve sair com gseGroupsCount=0
s, r = c(sesmt, "pgr.createBlank", {"branchId": None})
pid_p = r["id"]
s, r = c(sesmt, "pgr.generatePDF", {"id": pid_p})
t("pdf", "generatePDF sem GSE => gseGroupsCount=0", s == 200 and r.get("gseGroupsCount") == 0, str(r)[:80])
# Cria GSE, regenera → gseGroupsCount=1
s, rg = c(sesmt, "pgr.gse.create", {"pgrId": pid_p, "nome": "PDF-TEST"})
gid_p = rg["id"]
c(sesmt, "pgr.gse.setCargos", {"gseId": gid_p, "cargos": ["Eng"]})
c(sesmt, "pgr.gse.setRiscos", {"gseId": gid_p, "riscos": [{"tipo": "fisico", "agente": "Ruido"}]})
s, r = c(sesmt, "pgr.generatePDF", {"id": pid_p})
t("pdf", "generatePDF com 1 GSE => gseGroupsCount=1", s == 200 and r.get("gseGroupsCount") == 1, str(r)[:80])
# confirma no PDF
pdf_path = f"/var/www/saudedotrabalho{r['url']}"
has_gse_section = run(f"pdftotext {pdf_path} - 2>/dev/null | grep -c 'PDF-TEST\\|Grupos Similares de Exposição'").strip()
t("pdf", "PDF contem secao GSE com nome do GSE criado", int(has_gse_section) >= 2, f"matches={has_gse_section}")
c(sesmt, "pgr.remove", {"id": pid_p})

# ═════════════ RESUMO ═════════════
print("\n" + "=" * 72); print("RESUMO"); print("=" * 72)
passed = sum(1 for r in results if r[0] == "PASS")
failed = sum(1 for r in results if r[0] == "FAIL")
warned = sum(1 for r in results if r[0] == "WARN")
print(f"\n  PASS={passed}  FAIL={failed}  WARN={warned}  TOTAL={len(results)}\n")
if failed:
    print("FALHAS DETALHADAS:")
    for sym, area, label, ev in results:
        if sym == "FAIL":
            print(f"  [{area}] {label}")
            print(f"     evidencia: {ev}")
if warned:
    print("\nAVISOS:")
    for sym, area, label, ev in results:
        if sym == "WARN":
            print(f"  [{area}] {label} -> {ev}")

ssh.close()
