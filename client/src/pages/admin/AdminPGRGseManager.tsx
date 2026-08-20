import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Users,
  Building2,
  ShieldAlert,
  HardHat,
  ListChecks,
  Camera,
  GraduationCap,
  Sparkles,
  Cog,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

// Sub-componente: gerenciador de Grupos Similares de Exposição (GSE) — Sprint 1
// PGR-Inteligente. Espinha dorsal do PGR conforme NR-01: tudo (riscos, EPC, EPI,
// ações, evidências, treinamentos) é vinculado ao GSE, não a setor isolado.

type TabId =
  | "cargos"
  | "setores"
  | "riscos"
  | "epc"
  | "epi"
  | "acoes"
  | "evidencias"
  | "treinamentos";

const RISCO_TIPOS = [
  { v: "fisico", label: "Físico" },
  { v: "quimico", label: "Químico" },
  { v: "biologico", label: "Biológico" },
  { v: "ergonomico", label: "Ergonômico" },
  { v: "acidente", label: "Acidente" },
  { v: "psicossocial", label: "Psicossocial" },
];

const NIVEIS = [
  { v: "baixa", label: "Baixa" },
  { v: "media", label: "Média" },
  { v: "alta", label: "Alta" },
  { v: "critica", label: "Crítica" },
];

const RISCO_FINAIS = [
  { v: "baixo", label: "Baixo" },
  { v: "medio", label: "Médio" },
  { v: "alto", label: "Alto" },
  { v: "critico", label: "Crítico" },
];

function inferRiskType(text: string, fallback = "fisico") {
  const s = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    /(poeira|fumaca|fumo|vapor|gas|solvente|tinta|cimento|silica|produto quim|quimic|substancia|nevoa|aerodispers)/.test(
      s
    )
  )
    return "quimico";
  if (
    /(virus|bacteria|fungo|parasita|sangue|secrecao|material biolog|residuo biolog|microrganismo)/.test(
      s
    )
  )
    return "biologico";
  if (
    /(postura|ergonom|repetitiv|levantamento de peso|sobrecarga muscular|movimento repetitivo|mobiliario|computador|digitacao)/.test(
      s
    )
  )
    return "ergonomico";
  if (
    /(maquina sem protecao|queda|corte|choque eletrico|atropel|incendio|explosao|prensagem|esmagamento|escorreg|altura|acidente)/.test(
      s
    )
  )
    return "acidente";
  if (
    /(assedio|estresse|stress|sobrecarga mental|psicossocial|violencia|relacionamento|isolamento|burnout)/.test(
      s
    )
  )
    return "psicossocial";
  if (
    /(ruido|calor|frio|vibracao|radiacao|umidade|pressao|iluminacao|lux)/.test(
      s
    )
  )
    return "fisico";
  return fallback || "fisico";
}

export default function AdminPGRGseManager({
  pgrId,
  companyId,
  readOnly = false,
}: {
  pgrId: number;
  companyId: number | null;
  readOnly?: boolean;
}) {
  const [, setLocation] = useLocation();
  const listQ = trpc.pgr.gse.list.useQuery({ pgrId }, { enabled: pgrId > 0 });
  const gseList = (listQ.data ?? []) as any[];

  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const removeMut = trpc.pgr.gse.remove.useMutation({
    onSuccess: () => {
      toast.success("GSE removido.");
      setConfirmDelete(null);
      listQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  return (
    <section className="bg-white border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            Grupos Similares de Exposição (GSE)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Espinha dorsal do PGR (NR-01). Cada GSE agrupa cargos/setores com
            exposição semelhante e concentra riscos, EPC, EPI, ações, evidências
            e treinamentos.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setLocation("/admin/ghe-gse")}
          className="gap-1"
        >
          <Layers size={14} /> Gerenciar catálogo mestre
        </Button>
      </div>

      {listQ.isLoading && (
        <p className="text-xs text-slate-400">Carregando GSEs...</p>
      )}
      {!listQ.isLoading && gseList.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Nenhum GSE mestre foi vinculado a este PGR. Faça o vínculo pelo
          catálogo mestre de GSE.
        </div>
      )}

      <div className="grid gap-2">
        {gseList.map((g: any) => (
          <div
            key={g.id}
            className="border rounded-lg p-3 bg-slate-50/60 flex items-start justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 flex items-center gap-2">
                {g.nome}
                {g.aiSuggested ? (
                  <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 gap-0.5">
                    <Sparkles size={9} /> IA
                  </Badge>
                ) : null}
                {g.migratedFromLegacy ? (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                    migrado
                  </Badge>
                ) : null}
              </div>
              {g.descricao && (
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {g.descricao}
                </div>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                <span>
                  <Users size={10} className="inline mr-0.5" />
                  {g.numTrabalhadores ?? 0} trab.
                </span>
                <span>{g.cargosCount} cargos</span>
                <span>{g.setoresCount} setores</span>
                <span className="text-rose-600">{g.riscosCount} riscos</span>
                <span>
                  {g.epcCount} EPC · {g.epiCount} EPI
                </span>
                <span>{g.acoesCount} ações</span>
                <span>{g.evidenciasCount} evidências</span>
                <span>{g.treinamentosCount} treinamentos</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingId(g.id)}
                disabled={readOnly}
                title={readOnly ? "Versões históricas e publicadas são somente leitura" : "Editar riscos e controles deste PGR"}
              >
                <Pencil size={13} />
              </Button>
              {!readOnly && !g.masterGseId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(g.id)}
                  title="Remover contexto legado não vinculado"
                >
                  <Trash2 size={13} className="text-rose-600" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog: Confirmar remoção */}
      <Dialog
        open={confirmDelete != null}
        onOpenChange={o => !o && setConfirmDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover GSE?</DialogTitle>
            <DialogDescription>
              Cargos, setores, riscos, EPC, EPI, ações, evidências e
              treinamentos vinculados serão apagados em cascata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmDelete && removeMut.mutate({ id: confirmDelete })
              }
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar GSE (componente separado abaixo) */}
      {editingId != null && (
        <GseEditorDialog
          gseId={editingId}
          pgrId={pgrId}
          companyId={companyId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            listQ.refetch();
          }}
        />
      )}
    </section>
  );
}

// ─── Dialog de edição completa do GSE (8 abas internas) ────────────────────
function GseEditorDialog({
  gseId,
  pgrId,
  companyId,
  onClose,
  onSaved,
}: {
  gseId: number;
  pgrId: number;
  companyId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const detailQ = trpc.pgr.gse.get.useQuery(
    { id: gseId },
    { enabled: gseId > 0 }
  );
  const data: any = detailQ.data ?? {};
  const isMasterLinked = Boolean(data?.gse?.masterGseId);
  const reusableQ = trpc.pgr.gse.findReusableConfiguration.useQuery(
    { pgrId, gseId },
    { enabled: gseId > 0 && isMasterLinked }
  );
  const recoverMut = trpc.pgr.gse.recoverConfiguration.useMutation({
    onSuccess: async () => {
      toast.success(
        "Configuração anterior recuperada como nova versão. Revise antes de salvar."
      );
      await detailQ.refetch();
      await reusableQ.refetch();
      onSaved();
      setTab("riscos");
    },
    onError: (error: any) =>
      toast.error(error?.message ?? "Não foi possível recuperar a configuração."),
  });

  // Estados locais (espelham o que está no servidor — salvamos via set*)
  const [tab, setTab] = useState<TabId>("cargos");
  const [meta, setMeta] = useState({
    nome: "",
    descricao: "",
    numTrabalhadores: 0,
    numHomens: 0,
    numMulheres: 0,
  });
  const [cargos, setCargos] = useState<string[]>([]);
  const [setores, setSetores] = useState<number[]>([]);
  const [riscos, setRiscos] = useState<any[]>([]);
  const [epc, setEpc] = useState<any[]>([]);
  const [epi, setEpi] = useState<any[]>([]);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [treinamentos, setTreinamentos] = useState<any[]>([]);
  const [detalhandoRiscoId, setDetalhandoRiscoId] = useState<number | null>(
    null
  );

  // Setores da empresa (para o multi-select). hierarchyTree retorna uma lista de
  // empresas (admin global pode ter várias); pegamos a do usuário ou a primeira.
  const branchesAndSectorsQ = trpc.lessons.hierarchyTree.useQuery(undefined, {
    enabled: companyId != null,
  });
  const allSectors: { id: number; name: string; branchName?: string }[] =
    (() => {
      const tree = branchesAndSectorsQ.data as any;
      if (!Array.isArray(tree)) return [];
      const myCompany =
        tree.find((c: any) => c.company?.id === companyId) ?? tree[0];
      if (!myCompany) return [];
      const out: any[] = [];
      for (const b of myCompany.branches ?? []) {
        const branchName = b.branch?.name;
        for (const s of b.sectors ?? []) {
          out.push({ id: s.sector?.id, name: s.sector?.name, branchName });
        }
      }
      return out.filter(x => x.id);
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
    setRiscos(
      (d.riscos ?? []).map((r: any) => ({
        id: r.id,
        tipo: r.tipo,
        agente: r.agente,
        fonteGeradora: r.fonte_geradora,
        possivelDano: r.possivel_dano,
        tipoExposicao: r.tipo_exposicao,
        severidade: r.severidade,
        probabilidade: r.probabilidade,
        riscoFinal: r.risco_final,
        notes: r.notes,
        detalheConcluido: !!r.detalhe_concluido,
      }))
    );
    setEpc(
      (d.epc ?? []).map((x: any) => ({
        descricao: x.descricao,
        aplicacao: x.aplicacao,
      }))
    );
    setEpi(
      (d.epi ?? []).map((x: any) => ({
        descricao: x.descricao,
        ca: x.ca,
        aplicacao: x.aplicacao,
        validade: x.validade,
      }))
    );
    setAcoes(
      (d.acoes ?? []).map((x: any) => ({
        what: x.what,
        why: x.why,
        where: x.where_loc,
        whenStart: x.when_start,
        whenEnd: x.when_end,
        who: x.who,
        how: x.how,
        howMuch: x.how_much,
        priority: x.priority,
        status: x.status,
      }))
    );
    setEvidencias(
      (d.evidencias ?? []).map((x: any) => ({
        tipo: x.tipo,
        titulo: x.titulo,
        descricao: x.descricao,
        fileUrl: x.file_url,
      }))
    );
    setTreinamentos(
      (d.treinamentos ?? []).map((x: any) => ({
        nrCode: x.nr_code,
        nome: x.nome,
        cargaHoraria: x.carga_horaria,
        obrigatorio: !!x.obrigatorio,
      }))
    );
    if (d.gse.masterGseId) setTab("riscos");
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
    updateMut.isPending ||
    setCargosMut.isPending ||
    setSetoresMut.isPending ||
    setRiscosMut.isPending ||
    setEpcMut.isPending ||
    setEpiMut.isPending ||
    setAcoesMut.isPending ||
    setEvidMut.isPending ||
    setTreinMut.isPending;

  // Sprint 1.7-B item 3 — Sugestão por IA: chama pgr.gse.aiSuggest e pré-popula
  // (apenas APPEND nos arrays existentes — nada é apagado). Usuário revisa e Salva tudo.
  const aiMut = trpc.pgr.gse.aiSuggest.useMutation({
    onSuccess: (data: any) => {
      setRiscos(prev => [
        ...prev,
        ...(data.riscos ?? []).map((r: any) => ({
          ...r,
          tipo: inferRiskType(
            `${r.agente ?? ""} ${r.fonteGeradora ?? ""}`,
            r.tipo
          ),
        })),
      ]);
      setEpc(prev => [...prev, ...(data.epc ?? [])]);
      setEpi(prev => [...prev, ...(data.epi ?? [])]);
      setAcoes(prev => [...prev, ...(data.acoes ?? [])]);
      setTreinamentos(prev => [...prev, ...(data.treinamentos ?? [])]);
      const total =
        (data.riscos?.length ?? 0) +
        (data.epc?.length ?? 0) +
        (data.epi?.length ?? 0) +
        (data.acoes?.length ?? 0) +
        (data.treinamentos?.length ?? 0);
      toast.success(
        `IA sugeriu ${total} itens. Revise e clique em "Salvar tudo".`
      );
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
    if (
      !isMasterLinked &&
      meta.numHomens + meta.numMulheres > meta.numTrabalhadores
    ) {
      hardErrors.push(
        `Soma de homens (${meta.numHomens}) + mulheres (${meta.numMulheres}) supera o total de trabalhadores (${meta.numTrabalhadores}).`
      );
    }
    const acoesInvalidas = acoes.filter((a: any) => !a.whenStart);
    if (acoesInvalidas.length)
      hardErrors.push(
        `${acoesInvalidas.length} ação(ões) 5W2H sem data de início.`
      );
    const acoesDatasInv = acoes.filter(
      (a: any) => a.whenStart && a.whenEnd && a.whenEnd < a.whenStart
    );
    if (acoesDatasInv.length)
      hardErrors.push(
        `${acoesDatasInv.length} ação(ões) com data final anterior à inicial.`
      );

    if (!isMasterLinked && cargos.length === 0)
      softWarnings.push("Nenhum cargo informado.");
    if (riscos.length === 0) softWarnings.push("Nenhum risco cadastrado.");
    if (epi.length === 0 && riscos.length > 0)
      softWarnings.push("Riscos cadastrados sem EPIs correspondentes.");
    if (acoes.length === 0 && riscos.length > 0)
      softWarnings.push(
        "Nenhum plano de ação (5W2H) para os riscos identificados."
      );
    if (
      !isMasterLinked &&
      meta.numTrabalhadores > 0 &&
      meta.numHomens + meta.numMulheres !== meta.numTrabalhadores
    ) {
      softWarnings.push(
        `Soma H+M (${meta.numHomens + meta.numMulheres}) ≠ total (${meta.numTrabalhadores}).`
      );
    }
    return { hardErrors, softWarnings };
  }

  async function saveAll(options?: {
    close?: boolean;
    detailRiskIndex?: number;
  }) {
    const shouldClose = options?.close !== false;
    const { hardErrors, softWarnings } = validateGse();
    if (hardErrors.length) {
      toast.error(`Não foi possível salvar:\n• ${hardErrors.join("\n• ")}`, {
        duration: 7000,
      });
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
      if (!isMasterLinked) {
        await setCargosMut.mutateAsync({ gseId, cargos });
        await setSetoresMut.mutateAsync({ gseId, sectorIds: setores });
      }
      await setRiscosMut.mutateAsync({ gseId, riscos });
      await setEpcMut.mutateAsync({ gseId, items: epc });
      await setEpiMut.mutateAsync({ gseId, items: epi });
      await setAcoesMut.mutateAsync({ gseId, items: acoes });
      await setEvidMut.mutateAsync({ gseId, items: evidencias });
      await setTreinMut.mutateAsync({ gseId, items: treinamentos });
      const refreshed = await detailQ.refetch();
      toast.success("GSE salvo.");
      onSaved();
      if (typeof options?.detailRiskIndex === "number") {
        const savedRisk = (refreshed.data as any)?.riscos?.[
          options.detailRiskIndex
        ];
        if (savedRisk?.id) {
          setTab("riscos");
          setDetalhandoRiscoId(Number(savedRisk.id));
          toast.message(
            "Risco salvo. Complete o Detalhamento Técnico antes de finalizar o GSE."
          );
          return;
        }
        toast.warning(
          "Risco salvo, mas não foi possível abrir o Detalhamento Técnico automaticamente. Abra pelo botão na lista de riscos."
        );
        return;
      }
      if (riscos.some((r: any) => r.id && !r.detalheConcluido)) {
        toast.warning(
          "GSE salvo, mas há riscos com Detalhamento Técnico pendente.",
          { duration: 6000 }
        );
      }
      if (shouldClose) onClose();
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? "erro"}`);
    }
  }

  const ALL_TABS: { id: TabId; label: string; icon: any; count: number }[] = [
    { id: "cargos", label: "Cargos", icon: Users, count: cargos.length },
    { id: "setores", label: "Setores", icon: Building2, count: setores.length },
    { id: "riscos", label: "Riscos", icon: ShieldAlert, count: riscos.length },
    { id: "epc", label: "EPC", icon: HardHat, count: epc.length },
    { id: "epi", label: "EPI", icon: HardHat, count: epi.length },
    { id: "acoes", label: "Ações 5W2H", icon: ListChecks, count: acoes.length },
    {
      id: "evidencias",
      label: "Evidências",
      icon: Camera,
      count: evidencias.length,
    },
    {
      id: "treinamentos",
      label: "Treinamentos",
      icon: GraduationCap,
      count: treinamentos.length,
    },
  ];
  const TABS = ALL_TABS.filter(
    item => !isMasterLinked || !["cargos", "setores"].includes(item.id)
  );

  return (
    <Dialog open={true} onOpenChange={o => !o && onClose()}>
      <DialogContent
        className="!w-screen !h-[100dvh] !max-w-none !max-h-none !rounded-none !border-0 !p-0 flex flex-col gap-0 inset-0 translate-x-0 translate-y-0 top-0 left-0 right-0 bottom-0 overflow-hidden"
        style={{
          width: "100vw",
          height: "100dvh",
          maxWidth: "100vw",
          maxHeight: "100dvh",
        }}
      >
        <DialogHeader className="border-b bg-slate-50/80 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Layers size={18} className="text-blue-600" />
                Editar Grupo Similar de Exposição (GSE)
                {meta.nome ? (
                  <span className="text-slate-500 font-normal truncate">
                    {" "}
                    — {meta.nome}
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isMasterLinked
                  ? `Identidade, cargos, setores e ${meta.numTrabalhadores} trabalhador(es) vêm do Catálogo Mestre. O PGR começa diretamente nos riscos e controles técnicos.`
                  : "Contexto legado ainda não vinculado ao catálogo mestre. Migre-o antes de continuar a evolução ocupacional."}
              </DialogDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!meta.nome.trim() && cargos.length === 0) {
                  toast.error(
                    "Informe ao menos o nome ou os cargos do GSE antes de pedir sugestão à IA."
                  );
                  return;
                }
                aiMut.mutate({ gseId });
              }}
              disabled={aiMut.isPending}
              className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-50 shrink-0 w-full sm:w-auto"
              title="Usa IA para sugerir riscos, EPC, EPI, ações 5W2H e treinamentos NR com base no nome, cargos e setores do GSE. Os itens são adicionados sem apagar o que já existe. Revise antes de salvar."
            >
              {aiMut.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {aiMut.isPending ? "Pensando…" : "Sugerir com IA"}
            </Button>
          </div>
        </DialogHeader>

        {detailQ.isLoading ? (
          <div className="p-8 text-center flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin inline" />
          </div>
        ) : (
          <>
            {/* Cabeçalho (meta do GSE) */}
            <div className="border-b bg-white px-4 sm:px-6 py-3 space-y-2 shrink-0">
              {reusableQ.data && riscos.length === 0 && (
                <div className="flex flex-col gap-3 border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <b>Configuração técnica disponível no histórico</b>
                    <p className="mt-1 text-xs text-blue-800">
                      {(reusableQ.data as any).pgrTitle} · {(reusableQ.data as any).riskCount} risco(s). A recuperação cria uma cópia editável neste PGR e mantém o anterior intacto.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={recoverMut.isPending}
                    onClick={() => {
                      if (!confirm("Recuperar riscos, EPI/EPC, medidas, ações, evidências e treinamentos do PGR anterior?")) return;
                      recoverMut.mutate({
                        pgrId,
                        gseId,
                        sourcePgrGseId: Number((reusableQ.data as any).sourcePgrGseId),
                      });
                    }}
                  >
                    {recoverMut.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RotateCcw size={14} className="mr-2" />}
                    Recuperar configuração anterior
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    value={meta.nome}
                    disabled={isMasterLinked}
                    onChange={e =>
                      setMeta(m => ({ ...m, nome: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={meta.descricao}
                    disabled={isMasterLinked}
                    onChange={e =>
                      setMeta(m => ({ ...m, descricao: e.target.value }))
                    }
                  />
                </div>
              </div>
              {isMasterLinked ? (
                <div className="border-l-4 border-teal-500 bg-teal-50 p-3 text-sm text-teal-950">
                  <b>População sincronizada:</b> {meta.numTrabalhadores}{" "}
                  trabalhador(es), {cargos.length} cargo(s) e {setores.length}{" "}
                  setor(es). Para alterar esses vínculos, use o Catálogo Mestre.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-w-2xl">
                  <div>
                    <Label className="text-xs">Trabalhadores</Label>
                    <Input
                      type="number"
                      min={0}
                      value={meta.numTrabalhadores}
                      onChange={e =>
                        setMeta(m => ({
                          ...m,
                          numTrabalhadores: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Homens</Label>
                    <Input
                      type="number"
                      min={0}
                      value={meta.numHomens}
                      onChange={e =>
                        setMeta(m => ({
                          ...m,
                          numHomens: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mulheres</Label>
                    <Input
                      type="number"
                      min={0}
                      value={meta.numMulheres}
                      onChange={e =>
                        setMeta(m => ({
                          ...m,
                          numMulheres: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Abas */}
            <div className="flex gap-1 border-b bg-white px-4 sm:px-6 overflow-x-auto shrink-0">
              {TABS.map(t => {
                const Ic = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1 whitespace-nowrap ${tab === t.id ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                  >
                    <Ic size={12} /> {t.label}
                    {t.count > 0 && (
                      <span className="text-[10px] bg-slate-100 rounded-full px-1.5 py-0.5">
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 pb-28 sm:pb-4 bg-slate-50/30">
              <div className="max-w-6xl mx-auto">
                {tab === "cargos" && (
                  <CargosTab cargos={cargos} setCargos={setCargos} />
                )}
                {tab === "setores" && (
                  <SetoresTab
                    setores={setores}
                    setSetores={setSetores}
                    allSectors={allSectors}
                  />
                )}
                {tab === "riscos" && (
                  <RiscosTab
                    riscos={riscos}
                    setRiscos={setRiscos}
                    gseId={gseId}
                    gseName={meta.nome}
                    detalhandoRiscoId={detalhandoRiscoId}
                    setDetalhandoRiscoId={setDetalhandoRiscoId}
                    onSaveAndDetail={index =>
                      saveAll({ close: false, detailRiskIndex: index })
                    }
                    onDetailSaved={() => detailQ.refetch()}
                  />
                )}
                {tab === "epc" && (
                  <EpcEpiTab items={epc} setItems={setEpc} isEpi={false} />
                )}
                {tab === "epi" && (
                  <EpcEpiTab items={epi} setItems={setEpi} isEpi={true} />
                )}
                {tab === "acoes" && (
                  <AcoesTab acoes={acoes} setAcoes={setAcoes} />
                )}
                {tab === "evidencias" && (
                  <EvidenciasTab items={evidencias} setItems={setEvidencias} />
                )}
                {tab === "treinamentos" && (
                  <TreinamentosTab
                    items={treinamentos}
                    setItems={setTreinamentos}
                  />
                )}
              </div>
            </div>

            <DialogFooter className="border-t bg-white px-4 sm:px-6 py-3 shrink-0 sticky bottom-0 z-20 flex-col sm:flex-row gap-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Fechar sem salvar
              </Button>
              <Button
                onClick={() => saveAll()}
                disabled={allPending}
                className="gap-1 w-full sm:w-auto min-h-11"
              >
                {allPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
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

function CargosTab({
  cargos,
  setCargos,
}: {
  cargos: string[];
  setCargos: (v: string[]) => void;
}) {
  const [novo, setNovo] = useState("");
  function add() {
    const v = novo.trim();
    if (!v) return;
    if (cargos.includes(v)) {
      toast.error("Cargo já adicionado.");
      return;
    }
    setCargos([...cargos, v]);
    setNovo("");
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Lista de cargos que compõem este GSE.
      </p>
      <div className="flex gap-2">
        <Input
          value={novo}
          onChange={e => setNovo(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ex.: Analista Administrativo"
        />
        <Button size="sm" onClick={add}>
          Adicionar
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cargos.map((c, i) => (
          <Badge key={i} className="bg-slate-100 text-slate-700 gap-1">
            {c}
            <button
              onClick={() => setCargos(cargos.filter((_, j) => j !== i))}
              className="text-slate-500 hover:text-rose-600"
            >
              ×
            </button>
          </Badge>
        ))}
        {cargos.length === 0 && (
          <span className="text-xs text-slate-400">
            Nenhum cargo. Adicione acima.
          </span>
        )}
      </div>
    </div>
  );
}

function SetoresTab({
  setores,
  setSetores,
  allSectors,
}: {
  setores: number[];
  setSetores: (v: number[]) => void;
  allSectors: any[];
}) {
  function toggle(id: number) {
    setSetores(
      setores.includes(id) ? setores.filter(x => x !== id) : [...setores, id]
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Selecione os setores que pertencem a este GSE.
      </p>
      <div className="border rounded-lg p-2 max-h-72 overflow-y-auto space-y-0.5">
        {allSectors.map((s: any) => (
          <label
            key={s.id}
            className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm"
          >
            <input
              type="checkbox"
              checked={setores.includes(s.id)}
              onChange={() => toggle(s.id)}
            />
            <span className="flex-1">{s.name}</span>
            {s.branchName && (
              <span className="text-xs text-slate-400">{s.branchName}</span>
            )}
          </label>
        ))}
        {allSectors.length === 0 && (
          <p className="text-xs text-slate-400 px-2 py-1">
            Sem setores cadastrados.
          </p>
        )}
      </div>
      <div className="text-xs text-slate-500">
        {setores.length} selecionado(s).
      </div>
    </div>
  );
}

function RiscosTab({
  riscos,
  setRiscos,
  gseId,
  gseName,
  detalhandoRiscoId,
  setDetalhandoRiscoId,
  onSaveAndDetail,
  onDetailSaved,
}: {
  riscos: any[];
  setRiscos: (v: any[]) => void;
  gseId: number;
  gseName: string;
  detalhandoRiscoId: number | null;
  setDetalhandoRiscoId: (id: number | null) => void;
  onSaveAndDetail: (index: number) => void;
  onDetailSaved: () => void;
}) {
  function add() {
    setRiscos([
      ...riscos,
      {
        tipo: "fisico",
        agente: "",
        severidade: "baixa",
        probabilidade: "baixa",
        riscoFinal: "baixo",
      },
    ]);
  }
  function patch(i: number, p: any) {
    setRiscos(riscos.map((r, j) => (j === i ? { ...r, ...p } : r)));
  }
  function del(i: number) {
    setRiscos(riscos.filter((_, j) => j !== i));
  }
  // P16 — Detalhamento Técnico do Risco (painel abre por risco JÁ salvo, com autopreenchimento IA).
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">
          Riscos do GSE — base do inventário e da matriz.
        </p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus size={12} /> Adicionar risco
        </Button>
      </div>
      {riscos.map((r, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={r.tipo} onValueChange={v => patch(i, { tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISCO_TIPOS.map(t => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Agente *</Label>
              <Input
                value={r.agente}
                onChange={e => {
                  const agente = e.target.value;
                  patch(i, {
                    agente,
                    tipo: inferRiskType(
                      `${agente} ${r.fonteGeradora ?? ""}`,
                      r.tipo
                    ),
                  });
                }}
                placeholder="Ruído / Postura / Sobrecarga..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fonte geradora</Label>
              <Textarea
                rows={2}
                value={r.fonteGeradora ?? ""}
                onChange={e => {
                  const fonteGeradora = e.target.value;
                  patch(i, {
                    fonteGeradora,
                    tipo: inferRiskType(
                      `${r.agente ?? ""} ${fonteGeradora}`,
                      r.tipo
                    ),
                  });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Possível dano</Label>
              <Textarea
                rows={2}
                value={r.possivelDano ?? ""}
                onChange={e => patch(i, { possivelDano: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Tipo de exposição</Label>
              <Input
                value={r.tipoExposicao ?? ""}
                onChange={e => patch(i, { tipoExposicao: e.target.value })}
                placeholder="Qual./Quant. · Cont./Interm."
              />
            </div>
            <div>
              <Label className="text-xs">Severidade</Label>
              <Select
                value={r.severidade}
                onValueChange={v => patch(i, { severidade: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVEIS.map(n => (
                    <SelectItem key={n.v} value={n.v}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Probabilidade</Label>
              <Select
                value={r.probabilidade}
                onValueChange={v => patch(i, { probabilidade: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVEIS.map(n => (
                    <SelectItem key={n.v} value={n.v}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Risco final</Label>
              <Select
                value={r.riscoFinal}
                onValueChange={v => patch(i, { riscoFinal: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISCO_FINAIS.map(n => (
                    <SelectItem key={n.v} value={n.v}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div className="text-[11px]">
              {r.id ? (
                r.detalheConcluido ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 size={13} /> Detalhamento concluído
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                    <AlertCircle size={13} /> Detalhamento pendente
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <AlertCircle size={13} /> Salve para gerar o detalhamento
                </span>
              )}
            </div>
            <div className="flex flex-wrap justify-end items-center gap-2 w-full sm:w-auto">
              {!r.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSaveAndDetail(i)}
                  className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50 w-full sm:w-auto"
                >
                  <Save size={12} /> Salvar GSE e detalhar
                </Button>
              )}
              {r.id ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDetalhandoRiscoId(r.id)}
                  className="gap-1 text-blue-600 border-blue-200 w-full sm:w-auto"
                >
                  <Cog size={12} /> Detalhamento Técnico
                </Button>
              ) : (
                <span className="text-[10px] text-slate-400 italic">
                  Salve o GSE para abrir o Detalhamento Técnico
                </span>
              )}
              <Button size="sm" variant="ghost" onClick={() => del(i)}>
                <Trash2 size={13} className="text-rose-600" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      {riscos.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-4">
          Nenhum risco. Clique "Adicionar risco".
        </div>
      )}
      {detalhandoRiscoId && (
        <DetalhamentoTecnicoDialog
          riscoId={detalhandoRiscoId}
          gseId={gseId}
          gseName={gseName}
          risk={riscos.find(r => Number(r.id) === Number(detalhandoRiscoId))}
          riskIds={riscos.map(r => Number(r.id)).filter(Boolean)}
          onMoveToRisk={id => setDetalhandoRiscoId(id)}
          onSaved={onDetailSaved}
          onClose={() => setDetalhandoRiscoId(null)}
        />
      )}
    </div>
  );
}

function EpcEpiTab({
  items,
  setItems,
  isEpi,
}: {
  items: any[];
  setItems: (v: any[]) => void;
  isEpi: boolean;
}) {
  function add() {
    setItems([
      ...items,
      isEpi
        ? { descricao: "", ca: "", aplicacao: "", validade: "" }
        : { descricao: "", aplicacao: "" },
    ]);
  }
  function patch(i: number, p: any) {
    setItems(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  }
  function del(i: number) {
    setItems(items.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">
          {isEpi
            ? "Equipamentos de Proteção Individual"
            : "Equipamentos de Proteção Coletiva"}
          .
        </p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus size={12} /> Adicionar
        </Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="md:col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input
                value={it.descricao}
                onChange={e => patch(i, { descricao: e.target.value })}
              />
            </div>
            {isEpi && (
              <>
                <div>
                  <Label className="text-xs">CA</Label>
                  <Input
                    value={it.ca ?? ""}
                    onChange={e => patch(i, { ca: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Validade</Label>
                  <Input
                    value={it.validade ?? ""}
                    onChange={e => patch(i, { validade: e.target.value })}
                    placeholder="12 meses / 06/2026"
                  />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <Label className="text-xs">Aplicação</Label>
              <Input
                value={it.aplicacao ?? ""}
                onChange={e => patch(i, { aplicacao: e.target.value })}
                placeholder="Postos de trabalho / atividades de campo..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => del(i)}>
              <Trash2 size={13} className="text-rose-600" />
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-4">
          Nenhum item.
        </div>
      )}
    </div>
  );
}

function AcoesTab({
  acoes,
  setAcoes,
}: {
  acoes: any[];
  setAcoes: (v: any[]) => void;
}) {
  function add() {
    setAcoes([...acoes, { what: "", priority: "media", status: "programado" }]);
  }
  function patch(i: number, p: any) {
    setAcoes(acoes.map((x, j) => (j === i ? { ...x, ...p } : x)));
  }
  function del(i: number) {
    setAcoes(acoes.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">
          Plano de Ação (5W2H) deste GSE.
        </p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus size={12} /> Adicionar ação
        </Button>
      </div>
      {acoes.map((a, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div>
            <Label className="text-xs">O quê (What) *</Label>
            <Textarea
              rows={2}
              value={a.what}
              onChange={e => patch(i, { what: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Por quê (Why)</Label>
              <Textarea
                rows={2}
                value={a.why ?? ""}
                onChange={e => patch(i, { why: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Como (How)</Label>
              <Textarea
                rows={2}
                value={a.how ?? ""}
                onChange={e => patch(i, { how: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Onde (Where)</Label>
              <Input
                value={a.where ?? ""}
                onChange={e => patch(i, { where: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Quem (Who)</Label>
              <Input
                value={a.who ?? ""}
                onChange={e => patch(i, { who: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Início (When)</Label>
              <Input
                value={a.whenStart ?? ""}
                onChange={e => patch(i, { whenStart: e.target.value })}
                placeholder="2026-07"
              />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input
                value={a.whenEnd ?? ""}
                onChange={e => patch(i, { whenEnd: e.target.value })}
                placeholder="2026-08"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Quanto (How Much)</Label>
              <Input
                value={a.howMuch ?? ""}
                onChange={e => patch(i, { howMuch: e.target.value })}
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select
                value={a.priority}
                onValueChange={v => patch(i, { priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Select
                value={a.status}
                onValueChange={v => patch(i, { status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Button size="sm" variant="ghost" onClick={() => del(i)}>
              <Trash2 size={13} className="text-rose-600" />
            </Button>
          </div>
        </div>
      ))}
      {acoes.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-4">
          Nenhuma ação.
        </div>
      )}
    </div>
  );
}

function EvidenciasTab({
  items,
  setItems,
}: {
  items: any[];
  setItems: (v: any[]) => void;
}) {
  function add() {
    setItems([
      ...items,
      { tipo: "foto", titulo: "", descricao: "", fileUrl: "" },
    ]);
  }
  function patch(i: number, p: any) {
    setItems(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  }
  function del(i: number) {
    setItems(items.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">
          Evidências fotográficas/documentais. Upload completo virá em sprint
          dedicada — por enquanto registre a URL.
        </p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus size={12} /> Adicionar
        </Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={it.tipo}
                onValueChange={v => patch(i, { tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Input
                value={it.titulo ?? ""}
                onChange={e => patch(i, { titulo: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={it.descricao ?? ""}
                onChange={e => patch(i, { descricao: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">URL</Label>
              <Input
                value={it.fileUrl ?? ""}
                onChange={e => patch(i, { fileUrl: e.target.value })}
                placeholder="/uploads/evidencias/..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => del(i)}>
              <Trash2 size={13} className="text-rose-600" />
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-4">
          Nenhuma evidência.
        </div>
      )}
    </div>
  );
}

function TreinamentosTab({
  items,
  setItems,
}: {
  items: any[];
  setItems: (v: any[]) => void;
}) {
  function add() {
    setItems([
      ...items,
      { nrCode: "NR-06", nome: "", cargaHoraria: 4, obrigatorio: true },
    ]);
  }
  function patch(i: number, p: any) {
    setItems(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  }
  function del(i: number) {
    setItems(items.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">
          Treinamentos obrigatórios deste GSE (NRs aplicáveis).
        </p>
        <Button size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus size={12} /> Adicionar
        </Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">NR</Label>
              <Input
                value={it.nrCode}
                onChange={e => patch(i, { nrCode: e.target.value })}
                placeholder="NR-35"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Nome do treinamento *</Label>
              <Input
                value={it.nome}
                onChange={e => patch(i, { nome: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Carga horária (h)</Label>
              <Input
                type="number"
                min={0}
                value={it.cargaHoraria ?? 0}
                onChange={e =>
                  patch(i, { cargaHoraria: Number(e.target.value || 0) })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!!it.obrigatorio}
                onChange={e => patch(i, { obrigatorio: e.target.checked })}
              />
              Obrigatório
            </label>
            <Button size="sm" variant="ghost" onClick={() => del(i)}>
              <Trash2 size={13} className="text-rose-600" />
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-4">
          Nenhum treinamento.
        </div>
      )}
    </div>
  );
}

// P16 — Dialog de Detalhamento Técnico do Risco. Carrega o risco, opcionalmente
// chama IA (Groq NHO/NR-15/ACGIH) para autopreencher, permite anexar laudos,
// salva no BD via pgr.gse.setDetalhamento e será incorporado ao PDF do PGR.
function DetalhamentoTecnicoDialog({
  riscoId,
  gseId,
  gseName,
  risk,
  riskIds,
  onMoveToRisk,
  onSaved,
  onClose,
}: {
  riscoId: number;
  gseId: number;
  gseName?: string;
  risk?: any;
  riskIds: number[];
  onMoveToRisk: (id: number) => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const detQ = (trpc.pgr.gse as any).getDetalhamento.useQuery({ riscoId });
  const laudosQ = (trpc.pgr.gse as any).listLaudosDoRisco.useQuery({ riscoId });
  const utils = trpc.useUtils();
  const suggestMut = (trpc.pgr.gse as any).aiSuggestDetalhamento.useMutation();
  // P18 #10/#22 — Bruno: sugerir reaproveitar detalhamento já preenchido pro mesmo
  // agente em outro GSE da empresa. Só faz sentido buscar quando ESTE risco ainda
  // não tem detalhamento salvo (senão reaproveitar sobrescreveria trabalho já feito).
  const similarQ = (trpc.pgr.gse as any).findSimilarDetalhamento.useQuery(
    { riscoId },
    { enabled: !detQ.isLoading && !detQ.data }
  );
  const [dismissedSimilar, setDismissedSimilar] = useState(false);
  const saveMut = (trpc.pgr.gse as any).setDetalhamento.useMutation({
    onSuccess: () => {
      toast.success("Detalhamento salvo.");
      (utils.pgr.gse as any).getDetalhamento.invalidate({ riscoId });
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const uploadMut = (trpc.pgr.gse as any).addLaudoRisco.useMutation({
    onSuccess: () => {
      toast.success("Laudo anexado.");
      (utils.pgr.gse as any).listLaudosDoRisco.invalidate({ riscoId });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const [f, setF] = useState<any>({});
  const nextRiskId = (() => {
    const idx = riskIds.findIndex(id => Number(id) === Number(riscoId));
    return idx >= 0 && idx < riskIds.length - 1 ? riskIds[idx + 1] : null;
  })();

  useEffect(() => {
    if (!detQ.data) {
      setF({});
      return;
    }
    const d: any = detQ.data;
    setF({
      intensidade: d.intensidade ?? "",
      concentracao: d.concentracao ?? "",
      unidade: d.unidade ?? "",
      tempoExposicao: d.tempo_exposicao ?? "",
      frequenciaExposicao: d.frequencia_exposicao ?? "",
      viaExposicao: d.via_exposicao ?? "",
      limiteTolerancia: d.limite_tolerancia ?? "",
      normaReferencia: d.norma_referencia ?? "",
      situacaoLimite: d.situacao_limite ?? "",
      avaliacaoQuantitativa: !!Number(d.avaliacao_quantitativa),
      dataMedicao: d.data_medicao ? String(d.data_medicao).slice(0, 10) : "",
      proximaMedicao: d.proxima_medicao
        ? String(d.proxima_medicao).slice(0, 10)
        : "",
      resultadoMedicao: d.resultado_medicao ?? "",
      laboratorio: d.laboratorio ?? "",
      instrumento: d.instrumento ?? "",
      metodologia: d.metodologia ?? "",
      criterioIa: d.criterio_ia ?? "",
      justificativaIa: d.justificativa_ia ?? "",
      hierarquiaControles: d.hierarquia_controles ?? "",
      periodicidadeReavaliacao: d.periodicidade_reavaliacao ?? "",
      avaliacaoEficaciaControles: d.avaliacao_eficacia_controles ?? "",
      riscoResidualSeveridade: d.risco_residual_severidade ?? "",
      riscoResidualProbabilidade: d.risco_residual_probabilidade ?? "",
      riscoResidualFinal: d.risco_residual_final ?? "",
      aiGenerated: !!Number(d.ai_generated),
    });
  }, [detQ.data]);

  async function autopreencher() {
    try {
      const sug = await suggestMut.mutateAsync({ riscoId });
      setF((prev: any) => ({ ...prev, ...sug, aiGenerated: true }));
      toast.success(
        "Detalhamento preenchido pela IA — revise e clique em Salvar."
      );
    } catch (e: any) {
      toast.error(e?.message ?? "IA falhou");
    }
  }

  function reutilizarSimilar() {
    const d: any = similarQ.data;
    if (!d) return;
    setF({
      intensidade: d.intensidade ?? "",
      concentracao: d.concentracao ?? "",
      unidade: d.unidade ?? "",
      tempoExposicao: d.tempo_exposicao ?? "",
      frequenciaExposicao: d.frequencia_exposicao ?? "",
      viaExposicao: d.via_exposicao ?? "",
      limiteTolerancia: d.limite_tolerancia ?? "",
      normaReferencia: d.norma_referencia ?? "",
      situacaoLimite: d.situacao_limite ?? "",
      avaliacaoQuantitativa: !!Number(d.avaliacao_quantitativa),
      dataMedicao: "",
      proximaMedicao: "", // datas de medição não fazem sentido reaproveitar — cada GSE tem sua própria
      resultadoMedicao: d.resultado_medicao ?? "",
      laboratorio: d.laboratorio ?? "",
      instrumento: d.instrumento ?? "",
      metodologia: d.metodologia ?? "",
      criterioIa: d.criterio_ia ?? "",
      justificativaIa: d.justificativa_ia ?? "",
      hierarquiaControles: d.hierarquia_controles ?? "",
      periodicidadeReavaliacao: d.periodicidade_reavaliacao ?? "",
      avaliacaoEficaciaControles: d.avaliacao_eficacia_controles ?? "",
      riscoResidualSeveridade: d.risco_residual_severidade ?? "",
      riscoResidualProbabilidade: d.risco_residual_probabilidade ?? "",
      riscoResidualFinal: d.risco_residual_final ?? "",
      aiGenerated: !!Number(d.ai_generated),
    });
    setDismissedSimilar(true);
    toast.success(
      `Detalhamento reaproveitado de "${d.gseName}" — revise e clique em Salvar.`
    );
  }

  async function salvar(closeAfter = false) {
    await saveMut.mutateAsync({ riscoId, ...f });
    if (closeAfter) onClose();
  }

  async function salvarESeguir() {
    await saveMut.mutateAsync({ riscoId, ...f });
    if (nextRiskId) onMoveToRisk(nextRiskId);
    else onClose();
  }

  async function anexarLaudo(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result || "");
      uploadMut.mutate({
        riscoId,
        gseId,
        titulo: file.name,
        fileBase64: b64,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  }

  const laudos = (laudosQ.data ?? []) as any[];

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-screen sm:w-[calc(100vw-1rem)] sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] overflow-hidden flex flex-col rounded-none sm:rounded-lg">
        <DialogHeader className="px-1 sm:px-0">
          <DialogTitle className="flex items-center gap-2">
            <Cog size={16} className="text-blue-600" /> Detalhamento Técnico do
            Risco
          </DialogTitle>
          <DialogDescription>
            Informações técnicas complementares para o Inventário de Riscos.
            Podem ser autopreenchidas pela IA e serão incorporadas ao PDF do
            PGR.
          </DialogDescription>
          <div className="mt-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div>
              <b>GSE:</b> {gseName || "GSE não identificado"}
            </div>
            <div>
              <b>Risco:</b> {risk?.agente || `#${riscoId}`}{" "}
              {risk?.tipo ? (
                <span className="text-slate-500">({risk.tipo})</span>
              ) : null}
            </div>
            {risk?.fonteGeradora ? (
              <div className="text-slate-500">
                <b>Fonte:</b> {risk.fonteGeradora}
              </div>
            ) : null}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-28 sm:pb-2">
          {similarQ.data && !dismissedSimilar && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-amber-800">
                Já existe detalhamento técnico para{" "}
                <b>"{(similarQ.data as any).agente}"</b> em{" "}
                <b>{(similarQ.data as any).gseName}</b>. Deseja reutilizar?
              </span>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={reutilizarSimilar}
                >
                  Sim, reutilizar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setDismissedSimilar(true)}
                >
                  Não
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center border-b pb-2">
            <Button
              size="sm"
              onClick={autopreencher}
              disabled={suggestMut.isPending}
              className="gap-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {suggestMut.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}{" "}
              Autopreencher com IA
            </Button>
            {f.aiGenerated && (
              <Badge
                variant="outline"
                className="text-indigo-700 border-indigo-300"
              >
                Preenchido por IA — revise antes de salvar
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <FieldT
              l="Intensidade / faixa"
              v={f.intensidade}
              on={(x: string) => setF({ ...f, intensidade: x })}
            />
            <FieldT
              l="Concentração"
              v={f.concentracao}
              on={(x: string) => setF({ ...f, concentracao: x })}
            />
            <FieldT
              l="Unidade de medida"
              v={f.unidade}
              on={(x: string) => setF({ ...f, unidade: x })}
            />
            <FieldT
              l="Tempo de exposição"
              v={f.tempoExposicao}
              on={(x: string) => setF({ ...f, tempoExposicao: x })}
            />
            <FieldT
              l="Frequência"
              v={f.frequenciaExposicao}
              on={(x: string) => setF({ ...f, frequenciaExposicao: x })}
            />
            <FieldT
              l="Via de exposição"
              v={f.viaExposicao}
              on={(x: string) => setF({ ...f, viaExposicao: x })}
            />
            <FieldT
              l="Limite de tolerância"
              v={f.limiteTolerancia}
              on={(x: string) => setF({ ...f, limiteTolerancia: x })}
            />
            <FieldT
              l="Norma / referência"
              v={f.normaReferencia}
              on={(x: string) => setF({ ...f, normaReferencia: x })}
            />
            <FieldT
              l="Situação frente ao limite"
              v={f.situacaoLimite}
              on={(x: string) => setF({ ...f, situacaoLimite: x })}
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!f.avaliacaoQuantitativa}
              onChange={e =>
                setF({ ...f, avaliacaoQuantitativa: e.target.checked })
              }
            />
            <span>Necessita avaliação quantitativa (medição instrumental)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <FieldT
              l="Data da medição"
              v={f.dataMedicao}
              on={(x: string) => setF({ ...f, dataMedicao: x })}
              type="date"
            />
            <FieldT
              l="Próxima medição"
              v={f.proximaMedicao}
              on={(x: string) => setF({ ...f, proximaMedicao: x })}
              type="date"
            />
            <FieldT
              l="Resultado da medição"
              v={f.resultadoMedicao}
              on={(x: string) => setF({ ...f, resultadoMedicao: x })}
            />
            <FieldT
              l="Laboratório"
              v={f.laboratorio}
              on={(x: string) => setF({ ...f, laboratorio: x })}
            />
            <FieldT
              l="Instrumento"
              v={f.instrumento}
              on={(x: string) => setF({ ...f, instrumento: x })}
            />
            <FieldT
              l="Periodicidade reavaliação"
              v={f.periodicidadeReavaliacao}
              on={(x: string) => setF({ ...f, periodicidadeReavaliacao: x })}
            />
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">Metodologia de medição</Label>
              <Textarea
                rows={2}
                value={f.metodologia ?? ""}
                onChange={e => setF({ ...f, metodologia: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Critério técnico usado pela IA</Label>
              <Textarea
                rows={2}
                value={f.criterioIa ?? ""}
                onChange={e => setF({ ...f, criterioIa: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">
                Justificativa técnica da classificação
              </Label>
              <Textarea
                rows={2}
                value={f.justificativaIa ?? ""}
                onChange={e => setF({ ...f, justificativaIa: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">
                Hierarquia de medidas de controle (eliminação → substituição →
                engenharia → administrativas → EPC → EPI)
              </Label>
              <Textarea
                rows={3}
                value={f.hierarquiaControles ?? ""}
                onChange={e =>
                  setF({ ...f, hierarquiaControles: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">
                Avaliação da eficácia das medidas de controle
              </Label>
              <Textarea
                rows={2}
                value={f.avaliacaoEficaciaControles ?? ""}
                onChange={e =>
                  setF({ ...f, avaliacaoEficaciaControles: e.target.value })
                }
              />
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-emerald-50/40 space-y-2">
            <p className="text-xs font-semibold text-emerald-800">
              Risco residual (após implantação das medidas)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <FieldT
                l="Severidade"
                v={f.riscoResidualSeveridade}
                on={(x: string) => setF({ ...f, riscoResidualSeveridade: x })}
              />
              <FieldT
                l="Probabilidade"
                v={f.riscoResidualProbabilidade}
                on={(x: string) =>
                  setF({ ...f, riscoResidualProbabilidade: x })
                }
              />
              <FieldT
                l="Risco final"
                v={f.riscoResidualFinal}
                on={(x: string) => setF({ ...f, riscoResidualFinal: x })}
              />
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1">
              <FileText size={12} /> Laudos de avaliação quantitativa
            </p>
            {laudos.length === 0 && (
              <p className="text-xs text-slate-400">Nenhum laudo anexo.</p>
            )}
            {laudos.map((l: any) => (
              <div
                key={l.id}
                className="flex justify-between text-xs border-b py-1"
              >
                <span>{l.titulo}</span>
                {l.file_url && (
                  <a
                    href={l.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    baixar
                  </a>
                )}
              </div>
            ))}
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-blue-600 hover:underline">
              <Upload size={12} /> Anexar laudo (PDF/imagem)
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={e => {
                  const fi = e.target.files?.[0];
                  if (fi) anexarLaudo(fi);
                }}
              />
            </label>
          </div>
        </div>
        <DialogFooter className="border-t pt-3 sticky bottom-0 bg-white z-10 flex-col sm:flex-row gap-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          {nextRiskId && (
            <Button
              variant="outline"
              onClick={salvarESeguir}
              disabled={saveMut.isPending}
              className="gap-1 w-full sm:w-auto"
            >
              {saveMut.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}{" "}
              Salvar e seguir
            </Button>
          )}
          <Button
            onClick={() => salvar(false)}
            disabled={saveMut.isPending}
            className="gap-1 w-full sm:w-auto"
          >
            {saveMut.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}{" "}
            Salvar detalhamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldT({
  l,
  v,
  on,
  type = "text",
}: {
  l: string;
  v: any;
  on: (x: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{l}</Label>
      <Input type={type} value={v ?? ""} onChange={e => on(e.target.value)} />
    </div>
  );
}
