import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2, Store, Factory, ChevronDown, ChevronRight, Search,
  Users, Award, BookOpen, ClipboardCheck, X, Mail, Filter, Pencil,
  HeartPulse, Sparkles, Upload, Download, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Filters = {
  branchId: number | null;
  sectorId: number | null;
  courseStatus: "all" | "0-25" | "25-75" | "75-99" | "100";
  surveyPending: "all" | "yes" | "no";
};

const DEFAULT_FILTERS: Filters = {
  branchId: null,
  sectorId: null,
  courseStatus: "all",
  surveyPending: "all",
};

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [expandedCompanies, setExpandedCompanies] = useState<Record<number, boolean>>({});
  const [expandedBranches, setExpandedBranches] = useState<Record<number, boolean>>({});
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});
  const [assigningUser, setAssigningUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Clicar / pesquisar um colaborador leva direto à Visão 360º (ficha central).
  const openCollaborator = (id: number) => setLocation(`/admin/colaboradores/${id}`);

  const treeQuery = trpc.lessons.hierarchyTree.useQuery();

  const tree = treeQuery.data ?? [];

  // Auto-expand first company on load
  useMemo(() => {
    if (tree.length === 1 && Object.keys(expandedCompanies).length === 0) {
      setExpandedCompanies({ [tree[0].company.id]: true });
      // also expand first branch if exactly one
      if (tree[0].branches.length === 1) {
        setExpandedBranches({ [tree[0].branches[0].branch.id]: true });
      }
    }
  }, [tree.length]);

  // Build filter dropdown sources from the tree itself
  const allBranches = useMemo(() => {
    const arr: { id: number; name: string }[] = [];
    for (const c of tree) for (const b of c.branches) if (b.branch.id > 0) arr.push({ id: b.branch.id, name: b.branch.name });
    return arr;
  }, [tree]);
  const allSectors = useMemo(() => {
    const arr: { id: number; name: string; branchId: number }[] = [];
    for (const c of tree)
      for (const b of c.branches)
        for (const s of b.sectors)
          if (s.sector.id > 0) arr.push({ id: s.sector.id, name: s.sector.name, branchId: b.branch.id });
    return arr;
  }, [tree]);
  const sectorsForBranch = useMemo(
    () => (filters.branchId ? allSectors.filter((s) => s.branchId === filters.branchId) : allSectors),
    [allSectors, filters.branchId]
  );

  function passesUserFilter(u: any): boolean {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!String(u.name ?? "").toLowerCase().includes(q) && !String(u.email ?? "").toLowerCase().includes(q))
        return false;
    }
    if (filters.courseStatus !== "all") {
      const p = u.completionPercent;
      if (filters.courseStatus === "100" && p < 100) return false;
      if (filters.courseStatus === "75-99" && (p < 75 || p >= 100)) return false;
      if (filters.courseStatus === "25-75" && (p < 25 || p >= 75)) return false;
      if (filters.courseStatus === "0-25" && p >= 25) return false;
    }
    if (filters.surveyPending !== "all") {
      const pending = u.surveysAnswered < u.surveysTotal;
      if (filters.surveyPending === "yes" && !pending) return false;
      if (filters.surveyPending === "no" && pending) return false;
    }
    return true;
  }

  function filteredTree() {
    return tree
      .map((co) => {
        const branches = co.branches
          .filter((b: any) => !filters.branchId || b.branch.id === filters.branchId)
          .map((b: any) => {
            const sectors = b.sectors
              .filter((s: any) => !filters.sectorId || s.sector.id === filters.sectorId)
              .map((s: any) => {
                const users = s.users.filter(passesUserFilter);
                return { ...s, users, userCount: users.length };
              })
              .filter((s: any) => s.userCount > 0);
            const userCount = sectors.reduce((acc: number, x: any) => acc + x.userCount, 0);
            return { ...b, sectors, userCount };
          })
          .filter((b: any) => b.userCount > 0);
        const userCount = branches.reduce((acc: number, x: any) => acc + x.userCount, 0);
        return { ...co, branches, userCount };
      })
      .filter((c: any) => c.userCount > 0);
  }

  const filtered = filteredTree();
  const totalUsers = filtered.reduce((acc: number, c: any) => acc + c.userCount, 0);

  function toggleCompany(id: number) {
    setExpandedCompanies((s) => ({ ...s, [id]: !s[id] }));
  }
  function toggleBranch(id: number) {
    setExpandedBranches((s) => ({ ...s, [id]: !s[id] }));
  }
  function toggleSector(key: string) {
    setExpandedSectors((s) => ({ ...s, [key]: !s[key] }));
  }
  function expandAll() {
    const cs: Record<number, boolean> = {};
    const bs: Record<number, boolean> = {};
    const ss: Record<string, boolean> = {};
    for (const c of filtered) {
      cs[c.company.id] = true;
      for (const b of c.branches) {
        bs[b.branch.id] = true;
        for (const s of b.sectors) ss[`${b.branch.id}:${s.sector.id}`] = true;
      }
    }
    setExpandedCompanies(cs);
    setExpandedBranches(bs);
    setExpandedSectors(ss);
  }
  function collapseAll() {
    setExpandedCompanies({});
    setExpandedBranches({});
    setExpandedSectors({});
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
                Colaboradores
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {treeQuery.isLoading ? "Carregando..." : `${totalUsers} colaborador(es) em ${filtered.length} empresa(s)`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowImport(true)}>
                <Upload size={14} className="mr-1" /> Importar CSV
              </Button>
              <Button size="sm" variant="outline" onClick={expandAll}>Expandir todos</Button>
              <Button size="sm" variant="outline" onClick={collapseAll}>Recolher todos</Button>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter size={14} /> Filtros
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="border border-border rounded-md px-3 py-2 text-sm bg-white"
              value={filters.branchId ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value ? Number(e.target.value) : null, sectorId: null }))}
            >
              <option value="">Filial: todas</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              className="border border-border rounded-md px-3 py-2 text-sm bg-white"
              value={filters.sectorId ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, sectorId: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">Setor: todos</option>
              {sectorsForBranch.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              className="border border-border rounded-md px-3 py-2 text-sm bg-white"
              value={filters.courseStatus}
              onChange={(e) => setFilters((f) => ({ ...f, courseStatus: e.target.value as any }))}
            >
              <option value="all">Status curso: todos</option>
              <option value="0-25">0% a 25%</option>
              <option value="25-75">25% a 75%</option>
              <option value="75-99">75% a 99%</option>
              <option value="100">100% concluído</option>
            </select>
            <select
              className="border border-border rounded-md px-3 py-2 text-sm bg-white"
              value={filters.surveyPending}
              onChange={(e) => setFilters((f) => ({ ...f, surveyPending: e.target.value as any }))}
            >
              <option value="all">Pesquisa: todos</option>
              <option value="yes">Pendente</option>
              <option value="no">Respondida</option>
            </select>
            {(filters.branchId || filters.sectorId || filters.courseStatus !== "all" || filters.surveyPending !== "all" || search) && (
              <Button size="sm" variant="ghost" onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }}>
                <X size={14} className="mr-1" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Tree */}
        <div className="space-y-3">
          {treeQuery.isLoading ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando hierarquia...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-10 text-center text-muted-foreground">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              Nenhum colaborador encontrado com os filtros atuais.
            </div>
          ) : (
            filtered.map((co: any) => (
              <CompanyNode
                key={co.company.id}
                co={co}
                expanded={!!expandedCompanies[co.company.id]}
                onToggle={() => toggleCompany(co.company.id)}
                expandedBranches={expandedBranches}
                toggleBranch={toggleBranch}
                expandedSectors={expandedSectors}
                toggleSector={toggleSector}
                onUserClick={openCollaborator}
                onEditAssignment={(u) => setAssigningUser({ ...u, companyId: co.company.id })}
                onDelete={(u) => setDeletingUser({ ...u, companyId: co.company.id })}
              />
            ))
          )}
        </div>
      </div>

      {assigningUser && (
        <AssignmentDialog
          user={assigningUser}
          onClose={() => setAssigningUser(null)}
          onSaved={() => { setAssigningUser(null); treeQuery.refetch(); }}
        />
      )}

      {deletingUser && (
        <DeleteCollaboratorDialog
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={() => { setDeletingUser(null); treeQuery.refetch(); }}
        />
      )}

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onImported={() => { treeQuery.refetch(); }}
        />
      )}
    </AppLayout>
  );
}

// ----- CSV import -----------------------------------------------------------
type ParsedRow = { email: string; nome: string; filial: string; setor: string; cargo: string; perfil: string };

function stripAccents(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const grid = lines.map((l) => splitCsvLine(l, delim));

  // detect header
  const header = grid[0].map(stripAccents);
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  let iEmail = find("mail");
  let iNome = find("nome");
  let iFilial = find("filial", "unidade");
  let iSetor = find("setor", "departamento", "depto");
  // Cargo é coluna SEPARADA do perfil (papel/role) — antes "cargo" caía em iPerfil
  // por engano. Agora cargo casa só com cargo/função/position; perfil só com perfil/acesso/papel.
  let iCargo = find("cargo", "funcao", "função", "position");
  let iPerfil = find("perfil", "acesso", "papel");

  const firstHasEmail = grid[0].some((c) => c.includes("@"));
  const hasHeader = iEmail !== -1 && !firstHasEmail;
  const dataRows = hasHeader ? grid.slice(1) : grid;
  // Ordem padrão sem cabeçalho: email; nome; filial; setor; cargo; perfil
  if (!hasHeader) { iEmail = 0; iNome = 1; iFilial = 2; iSetor = 3; iCargo = 4; iPerfil = 5; }

  const at = (row: string[], idx: number) => (idx >= 0 && idx < row.length ? row[idx] : "");
  return dataRows
    .map((r) => ({
      email: at(r, iEmail),
      nome: at(r, iNome),
      filial: at(r, iFilial),
      setor: at(r, iSetor),
      cargo: at(r, iCargo),
      perfil: at(r, iPerfil),
    }))
    .filter((r) => r.email || r.nome);
}

const CSV_TEMPLATE =
  "e-mail corporativo;nome;filial;setor;cargo;perfil\n" +
  "joao.silva@empresa.com;João Silva;Matriz;Produção;Operador de Máquinas;colaborador\n" +
  "ana.gestora@empresa.com;Ana Gestora;Matriz;Produção;Coordenadora de Produção;chefia\n" +
  "maria.souza@empresa.com;Maria Souza;Filial São Paulo;Recursos Humanos;Analista de RH;rh\n" +
  "carlos.lima@empresa.com;Carlos Lima;Matriz;Diretoria;Diretor Executivo;admin\n";

function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const companiesQ = trpc.pgr.listCompanies.useQuery();
  const companies = (companiesQ.data ?? []) as any[];
  const isMulti = companies.length > 1;

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [preview, setPreview] = useState<any | null>(null);
  const [done, setDone] = useState<any | null>(null);

  // auto-select if only one company
  useMemo(() => {
    if (!isMulti && companies.length === 1 && companyId == null) setCompanyId(companies[0].id);
  }, [companies.length]);

  const selectedCompany = companies.find((c) => c.id === companyId);

  const importMut = trpc.admin.importCollaborators.useMutation();

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRaw(text);
      const p = parseCSV(text);
      setParsed(p);
      setPreview(null);
      setDone(null);
    };
    reader.readAsText(file, "utf-8");
  }

  function onPasteParse() {
    const p = parseCSV(raw);
    setParsed(p);
    setPreview(null);
    setDone(null);
  }

  function downloadTemplate() {
    const blob = new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao-colaboradores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runPreview() {
    if (!companyId) { toast.error("Selecione a empresa."); return; }
    if (parsed.length === 0) { toast.error("Nenhuma linha para importar."); return; }
    try {
      const r = await importMut.mutateAsync({ companyId, dryRun: true, rows: parsed });
      setPreview(r);
    } catch (e: any) { toast.error(e.message ?? "Erro ao pré-visualizar."); }
  }

  async function runImport() {
    if (!companyId || !confirmed) return;
    try {
      const r = await importMut.mutateAsync({ companyId, dryRun: false, rows: parsed });
      setDone(r);
      onImported();
      toast.success(`Importação concluída: ${r.summary.inserted} novo(s), ${r.summary.updated} atualizado(s).`);
    } catch (e: any) { toast.error(e.message ?? "Erro ao importar."); }
  }

  const previewRows = (preview?.results ?? []) as any[];
  const okCount = previewRows.filter((r) => r.status === "ok").length;
  const badCount = previewRows.length - okCount;

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={18} /> Importar colaboradores (CSV)
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={20} /> <span className="font-semibold">Importação concluída</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <Stat label="Novos" value={done.summary.inserted} />
              <Stat label="Atualizados" value={done.summary.updated} />
              <Stat label="Ignorados" value={done.summary.skipped} />
              <Stat label="Filiais criadas" value={done.summary.branchesCreated} />
              <Stat label="Setores criados" value={done.summary.sectorsCreated} />
              <Stat label="Total" value={done.summary.total} />
            </div>
            <p className="text-xs text-muted-foreground">
              Os colaboradores definirão a senha no primeiro acesso (login corporativo). O perfil, filial e setor importados
              serão aplicados automaticamente à conta.
            </p>
            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Step 1: company confirmation */}
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <Label className="text-amber-900">1. Confirme a empresa desta planilha</Label>
              {isMulti ? (
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={companyId ?? ""}
                  onChange={(e) => { setCompanyId(e.target.value ? Number(e.target.value) : null); setConfirmed(false); }}
                >
                  <option value="">-- selecione a empresa --</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <div className="text-sm font-medium text-amber-900">{selectedCompany?.name ?? "Carregando..."}</div>
              )}
              <label className="flex items-start gap-2 text-sm text-amber-900 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={confirmed} disabled={!companyId}
                  onChange={(e) => setConfirmed(e.target.checked)} />
                <span>Confirmo que esta planilha se refere à empresa <b>{selectedCompany?.name ?? "selecionada"}</b>. Os colaboradores serão vinculados a ela.</span>
              </label>
            </div>

            {/* Step 2: data input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>2. Cole ou envie o CSV</Label>
                <button onClick={downloadTemplate} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                  <Download size={13} /> Baixar modelo
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                <b>Colunas (nesta ordem):</b> <code>e-mail corporativo; nome; filial; setor; cargo; perfil</code>.
                <br />
                <b>Cargo é obrigatório</b> — é usado pelo PGR/AEP/EPI/treinamentos. Aceita variações de cabeçalho: <code>cargo</code>, <code>função</code>, <code>position</code>.
                <br />
                <b>Perfil</b> aceito: <code>colaborador</code>, <code>chefia</code>, <code>rh</code> ou <code>admin</code>.
                <br />
                Filiais e setores inexistentes serão criados automaticamente.
              </p>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm font-mono h-28 bg-white"
                placeholder="email;nome;filial;setor;cargo;perfil"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3 py-2 border rounded-md text-sm cursor-pointer hover:bg-muted inline-flex items-center gap-1">
                  <Upload size={13} /> Escolher arquivo .csv
                  <input type="file" accept=".csv,text/csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
                </label>
                <Button size="sm" variant="outline" onClick={onPasteParse} disabled={!raw.trim()}>Ler colado</Button>
                {parsed.length > 0 && <span className="text-xs text-muted-foreground">{parsed.length} linha(s) detectada(s)</span>}
              </div>
            </div>

            {/* Step 3: preview */}
            {parsed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>3. Pré-visualização</Label>
                  <Button size="sm" variant="outline" onClick={runPreview} disabled={!companyId || importMut.isPending}>
                    {importMut.isPending && preview === null ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                    Pré-visualizar
                  </Button>
                </div>
                {preview && (
                  <>
                    <div className="text-xs text-muted-foreground">
                      {okCount} válida(s){badCount > 0 && <span className="text-rose-600"> · {badCount} com aviso</span>}
                    </div>
                    <div className="border rounded-md overflow-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1.5">E-mail</th>
                            <th className="text-left px-2 py-1.5">Nome</th>
                            <th className="text-left px-2 py-1.5">Filial</th>
                            <th className="text-left px-2 py-1.5">Setor</th>
                            <th className="text-left px-2 py-1.5">Cargo</th>
                            <th className="text-left px-2 py-1.5">Perfil</th>
                            <th className="text-left px-2 py-1.5">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((r, i) => (
                            <tr key={i} className={`border-t ${r.status !== "ok" ? "bg-rose-50" : ""}`}>
                              <td className="px-2 py-1">{r.email || "—"}</td>
                              <td className="px-2 py-1">{r.nome || "—"}</td>
                              <td className="px-2 py-1">{r.filial || "—"}{r.branchAction === "create" && <span className="text-sky-600"> (nova)</span>}</td>
                              <td className="px-2 py-1">{r.setor || "—"}{r.sectorAction === "create" && <span className="text-sky-600"> (novo)</span>}</td>
                              <td className={`px-2 py-1 ${!r.cargo ? "text-rose-600" : ""}`}>{r.cargo || "—"}</td>
                              <td className="px-2 py-1">{r.roleLabel}</td>
                              <td className="px-2 py-1">
                                {r.status === "ok"
                                  ? <span className={r.action === "update" ? "text-amber-600" : "text-emerald-600"}>{r.action === "update" ? "Atualizar" : "Novo"}</span>
                                  : <span className="text-rose-600 inline-flex items-center gap-1"><AlertTriangle size={11} /> {r.message}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={runImport}
                disabled={!companyId || !confirmed || !preview || okCount === 0 || importMut.isPending}
              >
                {importMut.isPending && preview !== null ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                Importar {okCount > 0 ? `${okCount} colaborador(es)` : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-lg font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function CompanyNode({
  co, expanded, onToggle, expandedBranches, toggleBranch, expandedSectors, toggleSector, onUserClick, onEditAssignment, onDelete,
}: any) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 transition text-left"
      >
        {expanded ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} className="text-primary" />}
        <Building2 size={22} className="text-primary" />
        <div className="flex-1">
          <div className="font-semibold text-primary text-lg">{co.company.name}</div>
          <div className="text-xs text-muted-foreground">
            {co.userCount} colaboradores · {co.branches.length} filial(is) · {co.totalModules} curso(s) ativos · {co.totalSurveys} pesquisa(s)
          </div>
        </div>
        <Badge n={co.userCount} />
      </button>
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-3 py-2 space-y-2">
          {co.branches.map((b: any) => (
            <BranchNode
              key={b.branch.id}
              b={b}
              expanded={!!expandedBranches[b.branch.id]}
              onToggle={() => toggleBranch(b.branch.id)}
              expandedSectors={expandedSectors}
              toggleSector={toggleSector}
              onUserClick={onUserClick}
              onEditAssignment={onEditAssignment}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BranchNode({ b, expanded, onToggle, expandedSectors, toggleSector, onUserClick, onEditAssignment, onDelete }: any) {
  return (
    <div className="bg-white rounded-lg border border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition text-left"
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Store size={18} className="text-secondary" />
        <div className="flex-1">
          <div className="font-medium text-foreground">{b.branch.name}</div>
          <div className="text-xs text-muted-foreground">
            {b.userCount} colaboradores · {b.sectors.length} setor(es)
            {b.branch.city && ` · ${b.branch.city}/${b.branch.state ?? ""}`}
          </div>
        </div>
        <Badge n={b.userCount} />
      </button>
      {expanded && (
        <div className="border-t border-border bg-muted/10 p-2 space-y-1">
          {b.sectors.map((s: any) => {
            const k = `${b.branch.id}:${s.sector.id}`;
            return (
              <SectorNode
                key={k}
                s={s}
                expanded={!!expandedSectors[k]}
                onToggle={() => toggleSector(k)}
                onUserClick={onUserClick}
                onEditAssignment={onEditAssignment}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectorNode({ s, expanded, onToggle, onUserClick, onEditAssignment, onDelete }: any) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2 rounded-md hover:bg-muted/60 transition text-left"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Factory size={16} className="text-amber-700" />
        <div className="flex-1">
          <div className="font-medium text-sm text-foreground">{s.sector.name}</div>
          <div className="text-xs text-muted-foreground">{s.userCount} colaborador(es)</div>
        </div>
        <Badge n={s.userCount} small />
      </button>
      {expanded && (
        <div className="ml-7 mt-1 space-y-1">
          {s.users.map((u: any) => (
            <UserRow
              key={u.id}
              u={u}
              onClick={() => onUserClick(u.id)}
              onEditAssignment={onEditAssignment ? () => onEditAssignment(u) : undefined}
              onDelete={onDelete ? () => onDelete(u) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ u, onClick, onEditAssignment, onDelete }: { u: any; onClick: () => void; onEditAssignment?: () => void; onDelete?: () => void }) {
  const lastAccess = u.lastSignedIn ? humanRelative(new Date(u.lastSignedIn)) : "—";
  const courseColor =
    u.completionPercent === 100 ? "text-emerald-600 bg-emerald-50" :
    u.completionPercent >= 75 ? "text-blue-600 bg-blue-50" :
    u.completionPercent >= 25 ? "text-amber-600 bg-amber-50" :
    "text-rose-600 bg-rose-50";
  const surveyDone = u.surveysAnswered >= u.surveysTotal && u.surveysTotal > 0;
  const wb = u.wellbeingScore;
  const wbColor =
    wb == null ? "text-slate-400 bg-slate-100" :
    wb >= 80 ? "text-emerald-700 bg-emerald-50" :
    wb >= 60 ? "text-amber-700 bg-amber-50" :
    wb >= 40 ? "text-orange-700 bg-orange-50" :
    "text-rose-700 bg-rose-50";
  return (
    <div className="w-full px-3 py-2 rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/5 transition flex items-center gap-3 group">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
          {initials(u.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{u.name}</div>
          <div className="text-xs text-muted-foreground truncate">{u.cargo ?? u.email}</div>
        </div>
      </button>
      <div className="flex items-center gap-3 text-xs">
        <span
          title={wb == null ? "Indice de bem-estar ainda nao calculado" : `Indice de bem-estar: ${wb}/100`}
          className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 ${wbColor}`}
        >
          <HeartPulse size={12} /> {wb == null ? "—" : wb}
        </span>
        <span
          title={`Cursos concluidos: ${u.coursesCompleted} de ${u.coursesTotal} (${u.completionPercent}%)`}
          className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 ${courseColor}`}
        >
          <BookOpen size={12} /> {u.coursesCompleted}/{u.coursesTotal}
        </span>
        <span
          title={`Pesquisas respondidas: ${u.surveysAnswered} de ${u.surveysTotal}`}
          className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 ${surveyDone ? "text-emerald-600 bg-emerald-50" : "text-slate-600 bg-slate-100"}`}
        >
          <ClipboardCheck size={12} /> {u.surveysAnswered}/{u.surveysTotal}
        </span>
        <span
          title={u.lastSignedIn ? `Ultimo acesso: ${new Date(u.lastSignedIn).toLocaleString("pt-BR")}` : "Sem registro de acesso"}
          className="text-muted-foreground hidden sm:inline"
        >
          {lastAccess}
        </span>
        {onEditAssignment && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditAssignment(); }}
            title="Editar colaborador (nome, e-mail, perfil, filial, setor)"
            className="p-1.5 rounded-md hover:bg-primary/15 text-muted-foreground hover:text-primary"
          >
            <Pencil size={13} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Remover colaborador"
            className="p-1.5 rounded-md hover:bg-rose-100 text-muted-foreground hover:text-rose-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function AssignmentDialog({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const branchesQ = trpc.branchesAdmin.list.useQuery(
    user?.companyId ? { companyId: user.companyId } : undefined
  );
  const [name, setName] = useState<string>(user?.name ?? "");
  const [email, setEmail] = useState<string>(user?.email ?? "");
  const [role, setRole] = useState<string>(user?.role ?? "user");
  const [branchId, setBranchId] = useState<number | null>(user?.branchId ?? null);
  const [sectorId, setSectorId] = useState<number | null>(user?.sectorId ?? null);
  const sectorsQ = trpc.departmentsAdmin.list.useQuery(
    branchId ? { branchId } : (user?.companyId ? { companyId: user.companyId } : undefined)
  );

  const mut = trpc.admin.updateCollaborator.useMutation({
    onSuccess: () => { toast.success("Colaborador atualizado"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const branches = (branchesQ.data ?? []) as any[];
  const sectors = (sectorsQ.data ?? []) as any[];

  function save() {
    if (!email.trim()) { toast.error("Informe o e-mail."); return; }
    mut.mutate({
      userId: user.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role as any,
      branchId: branchId,
      sectorId: sectorId,
    });
  }

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar colaborador</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Nome</Label>
            <Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" />
          </div>
          <div>
            <Label>E-mail corporativo</Label>
            <Input className="mt-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
          </div>
          <div>
            <Label>Perfil de acesso</Label>
            <select
              className="w-full mt-2 border rounded-md px-3 py-2 text-sm bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="user">Colaborador</option>
              <option value="chefia">Chefia / Gestor</option>
              <option value="rh">RH / Saúde</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div>
            <Label>Filial</Label>
            <select
              className="w-full mt-2 border rounded-md px-3 py-2 text-sm bg-white"
              value={branchId ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                setBranchId(v);
                setSectorId(null);
              }}
            >
              <option value="">-- nenhuma --</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Setor</Label>
            <select
              className="w-full mt-2 border rounded-md px-3 py-2 text-sm bg-white"
              value={sectorId ?? ""}
              onChange={(e) => setSectorId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- nenhum --</option>
              {sectors
                .filter((s: any) => !branchId || s.branch_id === branchId || s.branch_id == null)
                .map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded-md text-sm">Cancelar</button>
          <button
            type="button"
            onClick={save}
            disabled={mut.isPending}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            {mut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCollaboratorDialog({ user, onClose, onDeleted }: { user: any; onClose: () => void; onDeleted: () => void }) {
  const mut = trpc.admin.deleteCollaborator.useMutation({
    onSuccess: () => { toast.success("Colaborador removido"); onDeleted(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600">
            <AlertTriangle size={18} /> Remover colaborador
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2 text-sm">
          <p>
            Tem certeza que deseja remover <b>{user.name}</b> ({user.email})?
          </p>
          <p className="text-muted-foreground text-xs">
            O colaborador deixará de aparecer na lista e não poderá mais acessar a plataforma. O histórico (cursos,
            certificados, respostas) é preservado e a ação pode ser revertida pelo suporte, se necessário.
          </p>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded-md text-sm">Cancelar</button>
          <button
            type="button"
            onClick={() => mut.mutate({ userId: user.id })}
            disabled={mut.isPending}
            className="px-3 py-2 bg-rose-600 text-white rounded-md text-sm inline-flex items-center gap-1 disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            {mut.isPending ? "Removendo..." : "Remover"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Badge({ n, small = false }: { n: number; small?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold ${small ? "min-w-[24px] h-5 px-1.5 text-[10px]" : "min-w-[32px] h-6 px-2 text-xs"}`}>
      {n}
    </span>
  );
}

function UserDetailDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const q = trpc.lessons.userDetails.useQuery({ userId });
  const [, setLocation] = useLocation();
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto z-50">
        <div className="sticky top-0 bg-white border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-primary">Detalhes do colaborador</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {q.isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
          {q.data && (
            <>
              <div className="space-y-1">
                <div className="text-xl font-semibold text-foreground">{q.data.user.name}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail size={14} /> {q.data.user.email}
                </div>
                {q.data.user.cargo && (
                  <div className="text-sm text-muted-foreground">{q.data.user.cargo}</div>
                )}
              </div>

              <button
                onClick={() => setLocation(`/admin/colaboradores/${userId}`)}
                className="w-full rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition p-4 flex items-center justify-between group"
              >
                <span className="flex items-center gap-3 text-left">
                  <span className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                    <HeartPulse size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-primary">Abrir Ficha 360º de cuidado</span>
                    <span className="block text-xs text-muted-foreground">Bem-estar, jornada de cuidado, alertas e intervenções</span>
                  </span>
                </span>
                <Sparkles size={16} className="text-primary/60 group-hover:text-primary" />
              </button>

              <Section title="Cursos" icon={<BookOpen size={16} />} count={q.data.courses.length}>
                {q.data.courses.length === 0 ? (
                  <Empty text="Nenhum curso iniciado." />
                ) : (
                  q.data.courses.map((c: any) => (
                    <div key={c.moduleId} className="border border-border rounded-md p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.moduleTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.isCompleted ? `Concluído em ${fmtDate(c.completedAt)}` : `${Math.round(c.percentWatched)}% assistido`}
                        </div>
                      </div>
                      <div className={`text-xs font-semibold ${c.isCompleted ? "text-emerald-600" : "text-amber-600"}`}>
                        {c.isCompleted ? "100%" : `${Math.round(c.percentWatched)}%`}
                      </div>
                    </div>
                  ))
                )}
              </Section>

              <Section title="Pesquisas respondidas" icon={<ClipboardCheck size={16} />} count={q.data.surveys.length}>
                {q.data.surveys.length === 0 ? (
                  <Empty text="Nenhuma pesquisa respondida ainda." />
                ) : (
                  q.data.surveys.map((s: any) => (
                    <div key={s.surveyId} className="border border-border rounded-md p-3">
                      <div className="text-sm font-medium text-foreground">{s.surveyTitle}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(s.submittedAt)}</div>
                    </div>
                  ))
                )}
              </Section>

              <Section title="Certificados" icon={<Award size={16} />} count={q.data.certificates.length}>
                {q.data.certificates.length === 0 ? (
                  <Empty text="Nenhum certificado emitido." />
                ) : (
                  q.data.certificates.map((c: any) => (
                    <div key={c.id} className="border border-border rounded-md p-3">
                      <div className="text-sm font-medium text-foreground">{c.moduleTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        Emitido em {fmtDate(c.issuedAt)} · Código: <code>{c.certificateCode}</code>
                      </div>
                    </div>
                  ))
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, count, children }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        {icon} {title}
        {count > 0 && <span className="text-xs text-muted-foreground font-normal">({count})</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground italic px-1 py-2">{text}</div>;
}

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function humanRelative(d: Date) {
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)} mês(es)`;
  return `${Math.floor(days / 365)}a`;
}

function fmtDate(v: any) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("pt-BR"); } catch { return "—"; }
}


