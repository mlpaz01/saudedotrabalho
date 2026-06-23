import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Layers, Plus, Pencil, Trash2, Loader2, Save, Users, Building2,
  ShieldAlert, HardHat, ListChecks, Camera, GraduationCap, Sparkles,
} from "lucide-react";

// Sub-componente: gerenciador de Grupos Similares de Exposição (GSE) — Sprint 1
// PGR-Inteligente. Espinha dorsal do PGR conforme NR-01: tudo (riscos, EPC, EPI,
// ações, evidências, treinamentos) é vinculado ao GSE, não a setor isolado.

type TabId = "cargos" | "setores" | "riscos" | "epc" | "epi" | "acoes" | "evidencias" | "treinamentos";

const RISCO_TIPOS = [
  { v: "fisico",       label: "Físico" },
  { v: "quimico",      label: "Químico" },
  { v: "biologico",    label: "Biológico" },
  { v: "ergonomico",   label: "Ergonômico" },
  { v: "acidente",     label: "Acidente" },
  { v: "psicossocial", label: "Psicossocial" },
];

const NIVEIS = [
  { v: "baixa",   label: "Baixa" },
  { v: "media",   label: "Média" },
  { v: "alta",    label: "Alta" },
  { v: "critica", label: "Crítica" },
];

const RISCO_FINAIS = [
  { v: "baixo",   label: "Baixo" },
  { v: "medio",   label: "Médio" },
  { v: "alto",    label: "Alto" },
  { v: "critico", label: "Crítico" },
];

export default function AdminPGRGseManager({ pgrId, companyId }: { pgrId: number; companyId: number | null }) {
  const utils = trpc.useUtils();
  const listQ = trpc.pgr.gse.list.useQuery({ pgrId }, { enabled: pgrId > 0 });
  const gseList = (listQ.data ?? []) as any[];

  // Status do legado: usado pra decidir se mostra o botão "Migrar PGR legado".
  const legacyQ = trpc.pgr.gse.legacyStatus.useQuery({ pgrId }, { enabled: pgrId > 0 });
  const legacy = legacyQ.data as any;

  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const createMut = trpc.pgr.gse.create.useMutation({
    onSuccess: (r: any) => { toast.success("GSE criado."); setShowNew(false); setEditingId(r.id); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar GSE"),
  });
  const removeMut = trpc.pgr.gse.remove.useMutation({
    onSuccess: () => { toast.success("GSE removido."); setConfirmDelete(null); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });
  const migrateMut = trpc.pgr.gse.migrateFromLegacy.useMutation({
    onSuccess: (r: any) => {
      if (r.alreadyMigrated) toast.info("Este PGR já foi migrado anteriormente.");
      else if (r.empty) toast.warning("Nada para migrar — PGR sem dados legados.");
      else {
        const c = r.counts ?? {};
        toast.success(`Migrado: ${c.cargos ?? 0} cargos · ${c.setores ?? 0} setores · ${c.riscos ?? 0} riscos · ${c.acoes ?? 0} ações · ${c.epc ?? 0} EPC · ${c.epi ?? 0} EPI.`);
        if (c.setoresNaoResolvidos && c.setoresNaoResolvidos.length > 0) {
          toast.warning(`Setores não resolvidos automaticamente: ${[...new Set(c.setoresNaoResolvidos)].slice(0,5).join(", ")} — vincule manualmente.`, { duration: 8000 });
        }
        if (r.gseId) setEditingId(r.gseId);
      }
      listQ.refetch(); legacyQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na migração"),
  });

  // Form do "Novo GSE"
  const [newForm, setNewForm] = useState({ nome: "", descricao: "", numTrabalhadores: 0, numHomens: 0, numMulheres: 0 });
  function openNew() {
    setNewForm({ nome: "", descricao: "", numTrabalhadores: 0, numHomens: 0, numMulheres: 0 });
    setShowNew(true);
  }
  function saveNew() {
    if (!newForm.nome.trim()) { toast.error("Informe o nome do GSE."); return; }
    createMut.mutate({ pgrId, ...newForm });
  }

  return (
    <section className="bg-white border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            Grupos Similares de Exposição (GSE)
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">Novo modelo</Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Espinha dorsal do PGR (NR-01). Cada GSE agrupa cargos/setores com exposição semelhante e
            concentra riscos, EPC, EPI, ações, evidências e treinamentos.
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1"><Plus size={14} /> Novo GSE</Button>
      </div>

      {/* Banner de migração: aparece só quando há JSON legado E ainda não foi migrado. */}
      {legacy?.hasLegacy && legacy?.migratedGseId == null && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start justify-between gap-3">
          <div className="text-xs text-amber-900 flex-1">
            <div className="font-semibold mb-0.5">Este PGR tem dados no modelo antigo (JSON)</div>
            <div>
              {legacy.legacyCount?.ghes ?? 0} cargos · {legacy.legacyCount?.inv ?? 0} riscos ·{" "}
              {legacy.legacyCount?.plano ?? 0} ações psicossociais · {legacy.legacyCount?.epc ?? 0} EPC ·{" "}
              {legacy.legacyCount?.epi ?? 0} EPI. Migre para o modelo GSE para usar inventário, matriz e plano por grupo.
            </div>
          </div>
          <Button size="sm" onClick={() => migrateMut.mutate({ pgrId })} disabled={migrateMut.isPending} className="gap-1 shrink-0">
            {migrateMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Migrar PGR legado
          </Button>
        </div>
      )}

      {listQ.isLoading && <p className="text-xs text-slate-400">Carregando GSEs...</p>}
      {!listQ.isLoading && gseList.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Nenhum GSE cadastrado. Clique em "Novo GSE" para iniciar.
        </div>
      )}

      <div className="grid gap-2">
        {gseList.map((g: any) => (
          <div key={g.id} className="border rounded-lg p-3 bg-slate-50/60 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 flex items-center gap-2">
                {g.nome}
                {g.aiSuggested ? <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 gap-0.5"><Sparkles size={9} /> IA</Badge> : null}
                {g.migratedFromLegacy ? <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">migrado</Badge> : null}
              </div>
              {g.descricao && <div className="text-xs text-slate-500 mt-0.5 truncate">{g.descricao}</div>}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                <span><Users size={10} className="inline mr-0.5" />{g.numTrabalhadores ?? 0} trab.</span>
                <span>{g.cargosCount} cargos</span>
                <span>{g.setoresCount} setores</span>
                <span className="text-rose-600">{g.riscosCount} riscos</span>
                <span>{g.epcCount} EPC · {g.epiCount} EPI</span>
                <span>{g.acoesCount} ações</span>
                <span>{g.evidenciasCount} evidências</span>
                <span>{g.treinamentosCount} treinamentos</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setEditingId(g.id)}><Pencil size={13} /></Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(g.id)}>
                <Trash2 size={13} className="text-rose-600" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog: Novo GSE */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Grupo Similar de Exposição</DialogTitle>
            <DialogDescription>Identifique o grupo. Você adicionará cargos/setores/riscos depois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label>Nome *</Label>
              <Input value={newForm.nome} onChange={e => setNewForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="GSE 01 — Administrativo" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={newForm.descricao}
                onChange={e => setNewForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Setores administrativos com exposição semelhante (postos sentados, baixa exposição química)." />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Trabalhadores</Label>
                <Input type="number" min={0} value={newForm.numTrabalhadores}
                  onChange={e => setNewForm(f => ({ ...f, numTrabalhadores: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <Label className="text-xs">Homens</Label>
                <Input type="number" min={0} value={newForm.numHomens}
                  onChange={e => setNewForm(f => ({ ...f, numHomens: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <Label className="text-xs">Mulheres</Label>
                <Input type="number" min={0} value={newForm.numMulheres}
                  onChange={e => setNewForm(f => ({ ...f, numMulheres: Number(e.target.value || 0) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={saveNew} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 size={14} className="animate-spin mr-1" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar remoção */}
      <Dialog open={confirmDelete != null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover GSE?</DialogTitle>
            <DialogDescription>
              Cargos, setores, riscos, EPC, EPI, ações, evidências e treinamentos vinculados serão apagados em cascata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDelete && removeMut.mutate({ id: confirmDelete })}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar GSE (componente separado abaixo) */}
      {editingId != null && (
        <GseEditorDialog
          gseId={editingId}
          companyId={companyId}
          onClose={() => setEditingId(null)}
          onSaved={() => { listQ.refetch(); }}
        />
      )}
    </section>
  );
}

// ─── Dialog de edição completa do GSE (8 abas internas) ────────────────────
function GseEditorDialog({
  gseId, companyId, onClose, onSaved,
}: { gseId: number; companyId: number | null; onClose: () => void; onSaved: () => void }) {
  const detailQ = trpc.pgr.gse.get.useQuery({ id: gseId }, { enabled: gseId > 0 });
  const data: any = detailQ.data ?? {};

  // Estados locais (espelham o que está no servidor — salvamos via set*)
  const [tab, setTab] = useState<TabId>("cargos");
  const [meta, setMeta] = useState({ nome: "", descricao: "", numTrabalhadores: 0, numHomens: 0, numMulheres: 0 });
  const [cargos, setCargos] = useState<string[]>([]);
  const [setores, setSetores] = useState<number[]>([]);
  const [riscos, setRiscos] = useState<any[]>([]);
  const [epc, setEpc] = useState<any[]>([]);
  const [epi, setEpi] = useState<any[]>([]);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [treinamentos, setTreinamentos] = useState<any[]>([]);

  // Setores da empresa (para o multi-select). hierarchyTree retorna uma lista de
  // empresas (admin global pode ter várias); pegamos a do usuário ou a primeira.
  const branchesAndSectorsQ = trpc.lessons.hierarchyTree.useQuery(undefined, { enabled: companyId != null });
  const allSectors: { id: number; name: string; branchName?: string }[] = (() => {
    const tree = branchesAndSectorsQ.data as any;
    if (!Array.isArray(tree)) return [];
    const myCompany = tree.find((c: any) => c.company?.id === companyId) ?? tree[0];
    if (!myCompany) return [];
    const out: any[] = [];
    for (const b of (myCompany.branches ?? [])) {
      const branchName = b.branch?.name;
      for (const s of (b.sectors ?? [])) {
        out.push({ id: s.sector?.id, name: s.sector?.name, branchName });
      }
    }
    return out.filter((x) => x.id);
  })();

  useEffect(() => {
    if (!detailQ.data) return;
    const d = detailQ.data as any;
    setMeta({
      nome: d.gse.nome ?? "",
      descricao: d.gse.descricao ?? "",
      numTrabalhadores: d.gse.numTrabalhadores ?? 0,
      numHomens: d.gse.numHomens ?? 0,
      numMulheres: d.gse.numMulheres ?? 0,
    });
    setCargos((d.cargos ?? []).map((c: any) => c.cargo));
    setSetores((d.setores ?? []).map((s: any) => s.sectorId));
    setRiscos((d.riscos ?? []).map((r: any) => ({
      tipo: r.tipo, agente: r.agente, fonteGeradora: r.fonte_geradora, possivelDano: r.possivel_dano,
      tipoExposicao: r.tipo_exposicao, severidade: r.severidade, probabilidade: r.probabilidade,
      riscoFinal: r.risco_final, notes: r.notes,
    })));
    setEpc((d.epc ?? []).map((x: any) => ({ descricao: x.descricao, aplicacao: x.aplicacao })));
    setEpi((d.epi ?? []).map((x: any) => ({ descricao: x.descricao, ca: x.ca, aplicacao: x.aplicacao, validade: x.validade })));
    setAcoes((d.acoes ?? []).map((x: any) => ({
      what: x.what, why: x.why, where: x.where_loc, whenStart: x.when_start, whenEnd: x.when_end,
      who: x.who, how: x.how, howMuch: x.how_much, priority: x.priority, status: x.status,
    })));
    setEvidencias((d.evidencias ?? []).map((x: any) => ({
      tipo: x.tipo, titulo: x.titulo, descricao: x.descricao, fileUrl: x.file_url,
    })));
    setTreinamentos((d.treinamentos ?? []).map((x: any) => ({
      nrCode: x.nr_code, nome: x.nome, cargaHoraria: x.carga_horaria, obrigatorio: !!x.obrigatorio,
    })));
  }, [detailQ.data]);

  const updateMut = trpc.pgr.gse.update.useMutation();
  const setCargosMut = trpc.pgr.gse.setCargos.useMutation();
  const setSetoresMut = trpc.pgr.gse.setSetores.useMutation();
  const setRiscosMut = trpc.pgr.gse.setRiscos.useMutation();
  const setEpcMut = trpc.pgr.gse.setEpc.useMutation();
  const setEpiMut = trpc.pgr.gse.setEpi.useMutation();
  const setAcoesMut = trpc.pgr.gse.setAcoes.useMutation();
  const setEvidMut = trpc.pgr.gse.setEvidencias.useMutation();
  const setTreinMut = trpc.pgr.gse.setTreinamentos.useMutation();

  const allPending =
    updateMut.isPending || setCargosMut.isPending || setSetoresMut.isPending ||
    setRiscosMut.isPending || setEpcMut.isPending || setEpiMut.isPending ||
    setAcoesMut.isPending || setEvidMut.isPending || setTreinMut.isPending;

  // Sprint 1.7-B item 3 — Sugestão por IA: chama pgr.gse.aiSuggest e pré-popula
  // (apenas APPEND nos arrays existentes — nada é apagado). Usuário revisa e Salva tudo.
  const aiMut = trpc.pgr.gse.aiSuggest.useMutation({
    onSuccess: (data: any) => {
      setRiscos(prev => [...prev, ...(data.riscos ?? [])]);
      setEpc(prev => [...prev, ...(data.epc ?? [])]);
      setEpi(prev => [...prev, ...(data.epi ?? [])]);
      setAcoes(prev => [...prev, ...(data.acoes ?? [])]);
      setTreinamentos(prev => [...prev, ...(data.treinamentos ?? [])]);
      const total = (data.riscos?.length ?? 0) + (data.epc?.length ?? 0) + (data.epi?.length ?? 0) + (data.acoes?.length ?? 0) + (data.treinamentos?.length ?? 0);
      toast.success(`IA sugeriu ${total} itens. Revise e clique em "Salvar tudo".`);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha na IA"),
  });

  // Sprint 2 item 37 — Validações soft do GSE.
  // Critérios duros (bloqueiam): nome obrigatório, soma H+M não pode ultrapassar
  // total, ações 5W2H devem ter data de início.
  // Critérios soft (warning, mas salva): sem cargo, sem risco, sem EPI,
  // soma H+M ≠ total (diferença não fatal).
  function validateGse(): { hardErrors: string[]; softWarnings: string[] } {
    const hardErrors: string[] = [];
    const softWarnings: string[] = [];
    if (!meta.nome.trim()) hardErrors.push("Nome do GSE é obrigatório.");
    if (meta.numHomens + meta.numMulheres > meta.numTrabalhadores) {
      hardErrors.push(`Soma de homens (${meta.numHomens}) + mulheres (${meta.numMulheres}) supera o total de trabalhadores (${meta.numTrabalhadores}).`);
    }
    const acoesInvalidas = acoes.filter((a: any) => !a.whenStart);
    if (acoesInvalidas.length) hardErrors.push(`${acoesInvalidas.length} ação(ões) 5W2H sem data de início.`);
    const acoesDatasInv = acoes.filter((a: any) => a.whenStart && a.whenEnd && a.whenEnd < a.whenStart);
    if (acoesDatasInv.length) hardErrors.push(`${acoesDatasInv.length} ação(ões) com data final anterior à inicial.`);

    if (cargos.length === 0) softWarnings.push("Nenhum cargo informado.");
    if (riscos.length === 0) softWarnings.push("Nenhum risco cadastrado.");
    if (epi.length === 0 && riscos.length > 0) softWarnings.push("Riscos cadastrados sem EPIs correspondentes.");
    if (acoes.length === 0 && riscos.length > 0) softWarnings.push("Nenhum plano de ação (5W2H) para os riscos identificados.");
    if (meta.numTrabalhadores > 0 && meta.numHomens + meta.numMulheres !== meta.numTrabalhadores) {
      softWarnings.push(`Soma H+M (${meta.numHomens + meta.numMulheres}) ≠ total (${meta.numTrabalhadores}).`);
    }
    return { hardErrors, softWarnings };
  }

  async function saveAll() {
    const { hardErrors, softWarnings } = validateGse();
    if (hardErrors.length) {
      toast.error(`Não foi possível salvar:\n• ${hardErrors.join("\n• ")}`, { duration: 7000 });
      return;
    }
    if (softWarnings.length) {
      const ok = confirm(
        `Avisos antes de salvar:\n\n• ${softWarnings.join("\n• ")}\n\nDeseja salvar mesmo assim?`
      );
      if (!ok) return;
    }
    try {
      await updateMut.mutateAsync({ id: gseId, ...meta });
      await setCargosMut.mutateAsync({ gseId, cargos });
      await setSetoresMut.mutateAsync({ gseId, sectorIds: setores });
      await setRiscosMut.mutateAsync({ gseId, riscos });
      await setEpcMut.mutateAsync({ gseId, items: epc });
      await setEpiMut.mutateAsync({ gseId, items: epi });
      await setAcoesMut.mutateAsync({ gseId, items: acoes });
      await setEvidMut.mutateAsync({ gseId, items: evidencias });
      await setTreinMut.mutateAsync({ gseId, items: treinamentos });
      toast.success("GSE salvo.");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? "erro"}`);
    }
  }

  const TABS: { id: TabId; label: string; icon: any; count: number }[] = [
    { id: "cargos",       label: "Cargos",       icon: Users,         count: cargos.length },
    { id: "setores",      label: "Setores",      icon: Building2,     count: setores.length },
    { id: "riscos",       label: "Riscos",       icon: ShieldAlert,   count: riscos.length },
    { id: "epc",          label: "EPC",          icon: HardHat,       count: epc.length },
    { id: "epi",          label: "EPI",          icon: HardHat,       count: epi.length },
    { id: "acoes",        label: "Ações 5W2H",   icon: ListChecks,    count: acoes.length },
    { id: "evidencias",   label: "Evidências",   icon: Camera,        count: evidencias.length },
    { id: "treinamentos", label: "Treinamentos", icon: GraduationCap, count: treinamentos.length },
  ];

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="!w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 !p-0 flex flex-col gap-0 inset-0 translate-x-0 translate-y-0 top-0 left-0 right-0 bottom-0 overflow-hidden"
        style={{ width: "100vw", height: "100vh", maxWidth: "100vw", maxHeight: "100vh" }}
      >
        <DialogHeader className="border-b bg-slate-50/80 px-6 py-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Layers size={18} className="text-blue-600" />
                Editar Grupo Similar de Exposição (GSE)
                {meta.nome ? <span className="text-slate-500 font-normal truncate"> — {meta.nome}</span> : null}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tela cheia para edição completa do GSE. Use as abas abaixo. Tudo é salvo de uma vez ao clicar em "Salvar tudo".
              </DialogDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!meta.nome.trim() && cargos.length === 0) {
                  toast.error("Informe ao menos o nome ou os cargos do GSE antes de pedir sugestão à IA.");
                  return;
                }
                aiMut.mutate({ gseId });
              }}
              disabled={aiMut.isPending}
              className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-50 shrink-0"
              title="Usa GROQ/Llama 3.3 para sugerir riscos, EPC, EPI, ações 5W2H e treinamentos NR com base no nome/cargos/setores do GSE. Os itens são adicionados (não apagam o que já existe). Revise antes de salvar."
            >
              {aiMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiMut.isPending ? "Pensando…" : "Sugerir com IA"}
            </Button>
          </div>
        </DialogHeader>

        {detailQ.isLoading ? (
          <div className="p-8 text-center flex-1 flex items-center justify-center"><Loader2 className="animate-spin inline" /></div>
        ) : (
          <>
            {/* Cabeçalho (meta do GSE) */}
            <div className="border-b bg-white px-6 py-3 space-y-2 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input value={meta.nome} onChange={e => setMeta(m => ({ ...m, nome: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input value={meta.descricao} onChange={e => setMeta(m => ({ ...m, descricao: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-2xl">
                <div>
                  <Label className="text-xs">Trabalhadores</Label>
                  <Input type="number" min={0} value={meta.numTrabalhadores}
                    onChange={e => setMeta(m => ({ ...m, numTrabalhadores: Number(e.target.value || 0) }))} />
                </div>
                <div>
                  <Label className="text-xs">Homens</Label>
                  <Input type="number" min={0} value={meta.numHomens}
                    onChange={e => setMeta(m => ({ ...m, numHomens: Number(e.target.value || 0) }))} />
                </div>
                <div>
                  <Label className="text-xs">Mulheres</Label>
                  <Input type="number" min={0} value={meta.numMulheres}
                    onChange={e => setMeta(m => ({ ...m, numMulheres: Number(e.target.value || 0) }))} />
                </div>
              </div>
            </div>

            {/* Abas */}
            <div className="flex gap-1 border-b bg-white px-6 overflow-x-auto shrink-0">
              {TABS.map(t => {
                const Ic = t.icon;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1 whitespace-nowrap ${tab === t.id ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                    <Ic size={12} /> {t.label}
                    {t.count > 0 && <span className="text-[10px] bg-slate-100 rounded-full px-1.5 py-0.5">{t.count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50/30">
              <div className="max-w-6xl mx-auto">
                {tab === "cargos" && <CargosTab cargos={cargos} setCargos={setCargos} />}
                {tab === "setores" && <SetoresTab setores={setores} setSetores={setSetores} allSectors={allSectors} />}
                {tab === "riscos" && <RiscosTab riscos={riscos} setRiscos={setRiscos} />}
                {tab === "epc" && <EpcEpiTab items={epc} setItems={setEpc} isEpi={false} />}
                {tab === "epi" && <EpcEpiTab items={epi} setItems={setEpi} isEpi={true} />}
                {tab === "acoes" && <AcoesTab acoes={acoes} setAcoes={setAcoes} />}
                {tab === "evidencias" && <EvidenciasTab items={evidencias} setItems={setEvidencias} />}
                {tab === "treinamentos" && <TreinamentosTab items={treinamentos} setItems={setTreinamentos} />}
              </div>
            </div>

            <DialogFooter className="border-t bg-white px-6 py-3 shrink-0">
              <Button variant="outline" onClick={onClose}>Fechar sem salvar</Button>
              <Button onClick={saveAll} disabled={allPending} className="gap-1">
                {allPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar tudo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Abas internas (cada uma trata um relacionamento) ─────────────────────

function CargosTab({ cargos, setCargos }: { cargos: string[]; setCargos: (v: string[]) => void }) {
  const [novo, setNovo] = useState("");
  function add() {
    const v = novo.trim();
    if (!v) return;
    if (cargos.includes(v)) { toast.error("Cargo já adicionado."); return; }
    setCargos([...cargos, v]); setNovo("");
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Lista de cargos que compõem este GSE.</p>
      <div className="flex gap-2">
        <Input value={novo} onChange={e => setNovo(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Ex.: Analista Administrativo" />
        <Button size="sm" onClick={add}>Adicionar</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cargos.map((c, i) => (
          <Badge key={i} className="bg-slate-100 text-slate-700 gap-1">
            {c}
            <button onClick={() => setCargos(cargos.filter((_, j) => j !== i))} className="text-slate-500 hover:text-rose-600">×</button>
          </Badge>
        ))}
        {cargos.length === 0 && <span className="text-xs text-slate-400">Nenhum cargo. Adicione acima.</span>}
      </div>
    </div>
  );
}

function SetoresTab({
  setores, setSetores, allSectors,
}: { setores: number[]; setSetores: (v: number[]) => void; allSectors: any[] }) {
  function toggle(id: number) {
    setSetores(setores.includes(id) ? setores.filter(x => x !== id) : [...setores, id]);
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Selecione os setores que pertencem a este GSE.</p>
      <div className="border rounded-lg p-2 max-h-72 overflow-y-auto space-y-0.5">
        {allSectors.map((s: any) => (
          <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
            <input type="checkbox" checked={setores.includes(s.id)} onChange={() => toggle(s.id)} />
            <span className="flex-1">{s.name}</span>
            {s.branchName && <span className="text-xs text-slate-400">{s.branchName}</span>}
          </label>
        ))}
        {allSectors.length === 0 && <p className="text-xs text-slate-400 px-2 py-1">Sem setores cadastrados.</p>}
      </div>
      <div className="text-xs text-slate-500">{setores.length} selecionado(s).</div>
    </div>
  );
}

function RiscosTab({ riscos, setRiscos }: { riscos: any[]; setRiscos: (v: any[]) => void }) {
  function add() {
    setRiscos([...riscos, { tipo: "fisico", agente: "", severidade: "baixa", probabilidade: "baixa", riscoFinal: "baixo" }]);
  }
  function patch(i: number, p: any) { setRiscos(riscos.map((r, j) => j === i ? { ...r, ...p } : r)); }
  function del(i: number) { setRiscos(riscos.filter((_, j) => j !== i)); }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">Riscos do GSE — base do inventário e da matriz.</p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1"><Plus size={12} /> Adicionar risco</Button>
      </div>
      {riscos.map((r, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={r.tipo} onValueChange={v => patch(i, { tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RISCO_TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Agente *</Label>
              <Input value={r.agente} onChange={e => patch(i, { agente: e.target.value })} placeholder="Ruído / Postura / Sobrecarga..." />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fonte geradora</Label>
              <Textarea rows={2} value={r.fonteGeradora ?? ""} onChange={e => patch(i, { fonteGeradora: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Possível dano</Label>
              <Textarea rows={2} value={r.possivelDano ?? ""} onChange={e => patch(i, { possivelDano: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Tipo de exposição</Label>
              <Input value={r.tipoExposicao ?? ""} onChange={e => patch(i, { tipoExposicao: e.target.value })}
                placeholder="Qual./Quant. · Cont./Interm." />
            </div>
            <div>
              <Label className="text-xs">Severidade</Label>
              <Select value={r.severidade} onValueChange={v => patch(i, { severidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NIVEIS.map(n => <SelectItem key={n.v} value={n.v}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Probabilidade</Label>
              <Select value={r.probabilidade} onValueChange={v => patch(i, { probabilidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NIVEIS.map(n => <SelectItem key={n.v} value={n.v}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Risco final</Label>
              <Select value={r.riscoFinal} onValueChange={v => patch(i, { riscoFinal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RISCO_FINAIS.map(n => <SelectItem key={n.v} value={n.v}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 size={13} className="text-rose-600" /></Button>
          </div>
        </div>
      ))}
      {riscos.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Nenhum risco. Clique "Adicionar risco".</div>}
    </div>
  );
}

function EpcEpiTab({ items, setItems, isEpi }: { items: any[]; setItems: (v: any[]) => void; isEpi: boolean }) {
  function add() { setItems([...items, isEpi ? { descricao: "", ca: "", aplicacao: "", validade: "" } : { descricao: "", aplicacao: "" }]); }
  function patch(i: number, p: any) { setItems(items.map((x, j) => j === i ? { ...x, ...p } : x)); }
  function del(i: number) { setItems(items.filter((_, j) => j !== i)); }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">{isEpi ? "Equipamentos de Proteção Individual" : "Equipamentos de Proteção Coletiva"}.</p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1"><Plus size={12} /> Adicionar</Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="md:col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input value={it.descricao} onChange={e => patch(i, { descricao: e.target.value })} />
            </div>
            {isEpi && (
              <>
                <div>
                  <Label className="text-xs">CA</Label>
                  <Input value={it.ca ?? ""} onChange={e => patch(i, { ca: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Validade</Label>
                  <Input value={it.validade ?? ""} onChange={e => patch(i, { validade: e.target.value })} placeholder="12 meses / 06/2026" />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <Label className="text-xs">Aplicação</Label>
              <Input value={it.aplicacao ?? ""} onChange={e => patch(i, { aplicacao: e.target.value })} placeholder="Postos de trabalho / atividades de campo..." />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 size={13} className="text-rose-600" /></Button>
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Nenhum item.</div>}
    </div>
  );
}

function AcoesTab({ acoes, setAcoes }: { acoes: any[]; setAcoes: (v: any[]) => void }) {
  function add() { setAcoes([...acoes, { what: "", priority: "media", status: "programado" }]); }
  function patch(i: number, p: any) { setAcoes(acoes.map((x, j) => j === i ? { ...x, ...p } : x)); }
  function del(i: number) { setAcoes(acoes.filter((_, j) => j !== i)); }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">Plano de Ação (5W2H) deste GSE.</p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1"><Plus size={12} /> Adicionar ação</Button>
      </div>
      {acoes.map((a, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div>
            <Label className="text-xs">O quê (What) *</Label>
            <Textarea rows={2} value={a.what} onChange={e => patch(i, { what: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Por quê (Why)</Label>
              <Textarea rows={2} value={a.why ?? ""} onChange={e => patch(i, { why: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Como (How)</Label>
              <Textarea rows={2} value={a.how ?? ""} onChange={e => patch(i, { how: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Onde (Where)</Label>
              <Input value={a.where ?? ""} onChange={e => patch(i, { where: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Quem (Who)</Label>
              <Input value={a.who ?? ""} onChange={e => patch(i, { who: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Início (When)</Label>
              <Input value={a.whenStart ?? ""} onChange={e => patch(i, { whenStart: e.target.value })} placeholder="2026-07" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input value={a.whenEnd ?? ""} onChange={e => patch(i, { whenEnd: e.target.value })} placeholder="2026-08" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Quanto (How Much)</Label>
              <Input value={a.howMuch ?? ""} onChange={e => patch(i, { howMuch: e.target.value })} placeholder="R$ 0,00" />
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={a.priority} onValueChange={v => patch(i, { priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={a.status} onValueChange={v => patch(i, { status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="programado">Programado</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 size={13} className="text-rose-600" /></Button>
          </div>
        </div>
      ))}
      {acoes.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Nenhuma ação.</div>}
    </div>
  );
}

function EvidenciasTab({ items, setItems }: { items: any[]; setItems: (v: any[]) => void }) {
  function add() { setItems([...items, { tipo: "foto", titulo: "", descricao: "", fileUrl: "" }]); }
  function patch(i: number, p: any) { setItems(items.map((x, j) => j === i ? { ...x, ...p } : x)); }
  function del(i: number) { setItems(items.filter((_, j) => j !== i)); }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">Evidências fotográficas/documentais. Upload completo virá em sprint dedicada — por enquanto registre a URL.</p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1"><Plus size={12} /> Adicionar</Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={it.tipo} onValueChange={v => patch(i, { tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="foto">Foto</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="documento">Documento</SelectItem>
                  <SelectItem value="medicao">Medição</SelectItem>
                  <SelectItem value="laudo">Laudo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Título</Label>
              <Input value={it.titulo ?? ""} onChange={e => patch(i, { titulo: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Descrição</Label>
              <Input value={it.descricao ?? ""} onChange={e => patch(i, { descricao: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">URL</Label>
              <Input value={it.fileUrl ?? ""} onChange={e => patch(i, { fileUrl: e.target.value })} placeholder="/uploads/evidencias/..." />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 size={13} className="text-rose-600" /></Button>
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Nenhuma evidência.</div>}
    </div>
  );
}

function TreinamentosTab({ items, setItems }: { items: any[]; setItems: (v: any[]) => void }) {
  function add() { setItems([...items, { nrCode: "NR-06", nome: "", cargaHoraria: 4, obrigatorio: true }]); }
  function patch(i: number, p: any) { setItems(items.map((x, j) => j === i ? { ...x, ...p } : x)); }
  function del(i: number) { setItems(items.filter((_, j) => j !== i)); }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">Treinamentos obrigatórios deste GSE (NRs aplicáveis).</p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1"><Plus size={12} /> Adicionar</Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">NR</Label>
              <Input value={it.nrCode} onChange={e => patch(i, { nrCode: e.target.value })} placeholder="NR-35" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Nome do treinamento *</Label>
              <Input value={it.nome} onChange={e => patch(i, { nome: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Carga horária (h)</Label>
              <Input type="number" min={0} value={it.cargaHoraria ?? 0}
                onChange={e => patch(i, { cargaHoraria: Number(e.target.value || 0) })} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!it.obrigatorio} onChange={e => patch(i, { obrigatorio: e.target.checked })} />
              Obrigatório
            </label>
            <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 size={13} className="text-rose-600" /></Button>
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Nenhum treinamento.</div>}
    </div>
  );
}
