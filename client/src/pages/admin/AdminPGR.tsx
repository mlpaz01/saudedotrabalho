import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import AdminPGRDashboard from "./AdminPGRDashboard";
import RiskMatrix from "./RiskMatrix";
import SignatureUpload from "./SignatureUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText, Plus, Loader2, Building2, Download, Trash2, ArrowLeft, Save, ShieldCheck,
  ListPlus, X, Info, CheckCircle2, Clock, Send, History, Paperclip, ExternalLink, FolderOpen, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AdminPGRGseManager from "./AdminPGRGseManager";

const SEV_OPTS = [
  { v: "insignificante", label: "Insignificante (1)" },
  { v: "menor", label: "Menor (2)" },
  { v: "moderada", label: "Moderada (4)" },
  { v: "maior", label: "Maior (8)" },
  { v: "catastrofica", label: "Catastrófica (16)" },
];
const PROB_OPTS = [
  { v: "raro", label: "Raro (1)" },
  { v: "improvavel", label: "Improvável (2)" },
  { v: "possivel", label: "Possível (3)" },
  { v: "provavel", label: "Provável (4)" },
  { v: "certo", label: "Certo (5)" },
];

type GheRow = { funcao: string; descricao?: string; num?: string };
type RevRow = { revisao: string; motivo: string; data?: string | null };
type InvRow = {
  fator: string; tipoRisco?: string;
  postoTrabalho?: string; setor?: string; funcoes?: string; dataReconhecimento?: string;
  agravos?: string; causas?: string;
  controles?: string; eficaciaControles?: string; populacao?: string; freqExposicao?: string;
  tipoAvaliacao?: string; probabilidade?: string; severidade?: string;
  acoes?: string; responsavel?: string; prazo?: string;
  areaImpacto?: string; freqMonitoramento?: string; legRef?: string;
  epc?: string; epi?: string; observacoes?: string;
};
type GseRow = { grupo: string; funcoes?: string; atividades?: string; num?: string; sexoM?: string; sexoF?: string; horario?: string; local?: string; };
type EpcRow = { descricao: string; aplicacao?: string };
type EpiRow = { descricao: string; ca?: string; aplicacao?: string; validade?: string; periodicidade?: string; fichaEntrega?: string; };
type PsyRow = { acao: string; categoria?: string; responsavel?: string; prazo?: string; cronograma?: string; status?: string; evidencia?: string; observacoes?: string; };
type CaracSetorRow = { setor: string; numColaboradores?: string; turno?: string; maquinas?: string; produtos?: string; fluxoAtividades?: string; epis?: string; observacoes?: string; };
type CronogramaRow = { atividade: string; tipo?: string; responsavel?: string; periodicidade?: string; dataExecucao?: string; status?: string; observacoes?: string; };
type HierarquiaRow = { risco: string; eliminacao?: string; substituicao?: string; engenharia?: string; administrativo?: string; epc?: string; epi?: string; responsavel?: string; prazo?: string; status?: string; };
type NcRow = { descricao: string; setor?: string; dataIdentificacao?: string; tipo?: string; gravidade?: string; acaoCorretiva?: string; responsavel?: string; prazo?: string; status?: string; };
type TreinNrRow = { nr: string; treinamento?: string; cargaHoraria?: string; periodicidade?: string; publicoAlvo?: string; dataRealizada?: string; dataVencimento?: string; responsavel?: string; status?: string; };

function emptyDoc(): any {
  return {
    title: "PGR - Programa de Gerenciamento de Riscos",
    razao_social: "", nome_fantasia: "", cnpj: "", endereco: "", atividade_principal: "",
    grau_risco: "", contato: "", email: "", num_funcionarios: "", objeto_contrato: "",
    horarios_trabalho: "", regime_trabalho: "", obra: "", vigencia_inicio: "", vigencia_fim: "",
    contratante_ativo: 0, contratante_razao: "", contratante_cnpj: "", contratante_endereco: "",
    contratante_atividade: "", contratante_grau_risco: "", contratante_contato: "", contratante_email: "",
    resp_tecnico_nome: "", resp_tecnico_registro: "", resp_tecnico_profissao: "",
    resp_tecnico_art: "", resp_tecnico_empresa: "", resp_tecnico_assinatura_url: "", resp_tecnico_validade_ate: "",
    logo_url: "",
    ghe_funcoes: [] as GheRow[], revisoes: [{ revisao: "00", motivo: "Emissão inicial", data: null }] as RevRow[],
    inventario: [] as InvRow[],
    gse_grupos: [] as GseRow[],
    epc_itens: [] as EpcRow[],
    epi_itens: [] as EpiRow[],
    plano_psicossocial: [] as PsyRow[],
    notas_tecnicas: "",
    caracterizacao_setores: [] as CaracSetorRow[],
    cronograma_preventivo: [] as CronogramaRow[],
    hierarquia_controle: [] as HierarquiaRow[],
    nao_conformidades: [] as NcRow[],
    treinamentos_nr: [] as TreinNrRow[],
  };
}

function dateInput(v: any): string {
  if (!v) return "";
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ""; }
}

export default function AdminPGR() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const [doc, setDoc] = useState<any>(emptyDoc());
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const companiesQ = trpc.pgr.listCompanies.useQuery();
  const companies = (companiesQ.data ?? []) as any[];
  const isMulti = companies.length > 1;

  useEffect(() => {
    if (companies.length === 1 && companyId == null) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  const listQ = trpc.pgr.list.useQuery(companyId ? { companyId } : undefined, { enabled: companyId != null });

  const pgrs = (listQ.data ?? []) as any[];
  const utils = trpc.useUtils();
  const [importingPsy, setImportingPsy] = useState(false);
  const psyDataQ = trpc.pgr.getPsychosocialForPGR.useQuery(
    companyId ? { companyId } : {},
    { enabled: false }
  );

  const upsert = trpc.pgr.upsert.useMutation({
    onSuccess: (r: any) => { toast.success("PGR salvo!"); setEditId(r.id); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });
  // Cria PGR vazio no banco assim que o usuário confirma o escopo no modal "Novo PGR".
  // Isso garante que os blocos GSE Manager + Importações Inteligentes apareçam
  // já no primeiro carregamento do editor (bloqueio reportado pelo Bruno).
  const createBlankMut = trpc.pgr.createBlank.useMutation({
    onSuccess: (r: any) => {
      toast.success("Rascunho de PGR criado — preencha os dados.");
      setScopeOpen(false);
      listQ.refetch();
      openEditor(r.id); // editId vira number → blocos aparecem
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar rascunho"),
  });
  const genMut = trpc.pgr.generatePDF.useMutation({
    onSuccess: (r: any) => { setPdfUrl(r.url); toast.success("PDF do PGR gerado!"); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF"),
  });
  const delMut = trpc.pgr.remove.useMutation({
    onSuccess: () => { toast.success("PGR removido"); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dashTab, setDashTab] = useState<"lista"|"painel">("lista");
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachForm, setAttachForm] = useState<any>({ tipo: "Outro", titulo: "", descricao: "", fileUrl: "", fileName: "", dataReferencia: "", numeroDoc: "" });
  const attachQ = trpc.pgr.listAttachments.useQuery(
    { pgrId: typeof editId === "number" ? editId : 0 },
    { enabled: typeof editId === "number" }
  );
  const genNarrM = trpc.pgr.generateNarrative.useMutation({
    onSuccess: (r: any, vars: any) => {
      if (r?.text) {
        set(vars.section, r.text);
        toast.success("Texto gerado!");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar"),
  });
  // Modal de escopo do novo PGR: filial específica ou consolidado (todas as filiais).
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeMode, setScopeMode] = useState<"branch" | "consolidated">("consolidated");
  const [scopeBranchId, setScopeBranchId] = useState<number | null>(null);
  const branchesQ = trpc.pgr.listBranches.useQuery(
    companyId ? { companyId } : undefined,
    { enabled: companyId != null && scopeOpen }
  );
  const branches = (branchesQ.data ?? []) as any[];

  // Importações inteligentes — RH e Ciclo Psicossocial.
  const cyclesQ = trpc.pgr.listPsicossocialCycles.useQuery(
    typeof editId === "number" && companyId ? { companyId, branchId: doc.branch_id ?? null } : undefined,
    { enabled: typeof editId === "number" && companyId != null }
  );
  const importRhM = trpc.pgr.importFromRH.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Importado do RH: ${r.setores} setor(es), ${r.cargos} cargo(s), ${r.totalColaboradores} colaborador(es).`);
      if (typeof editId === "number") openEditor(editId);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar do RH"),
  });
  const importCycleM = trpc.pgr.importFromCycle.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Ciclo importado: ${r.inventario} item(ns) de inventário e ${r.plano} ação(ões).`);
      if (typeof editId === "number") openEditor(editId);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar ciclo"),
  });
  const [cycleSelect, setCycleSelect] = useState<string>("");

  const importAepM = trpc.pgr.importFromAEP.useMutation({
    onSuccess: (r: any) => {
      toast.success(r?.message ?? "Importado!");
      if (typeof editId === "number") {
        trpc.useContext ? undefined : undefined;
        window.location.reload();
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar"),
  });
  const upsertAttachM = trpc.pgr.upsertAttachment.useMutation({
    onSuccess: () => { attachQ.refetch(); setAttachOpen(false); toast.success("Anexo salvo!"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const removeAttachM = trpc.pgr.removeAttachment.useMutation({
    onSuccess: () => { attachQ.refetch(); toast.success("Anexo removido"); },
  });
  // SP4 #9 + Bruno round 3 — tipos categorizados: complementares + 7 oficiais
  // (Anexos 1..7 no fim do PDF, item #14 atualizado).
  const ATTACH_TIPOS = [
    // Complementares (vão no quadro "Anexos do PGR")
    "LTCAT","PCA","PPR","APR","Laudo Técnico","Medição","Foto/Imagem","Declaração","Certificado","Outro",
    // Anexos oficiais — viram Anexo 1..7 do PDF
    "Relatório Psicossocial",
    "AEP",
    "Conformidade NR-01",
    "Conformidade Metodológica",
    "Legitimidade do Canal de Denúncias",
    "LGPD",
    "Lei 14.457/2022",
  ];
  const [statusNotes, setStatusNotes] = useState("");
  const historyQ = trpc.pgr.getHistory.useQuery(
    { id: typeof editId === "number" ? editId : 0 },
    { enabled: typeof editId === "number" && historyOpen }
  );
  const updateStatusM = trpc.pgr.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado!"); listQ.refetch(); historyQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const currentPGRStatus = (editId !== "new" && editId !== null)
    ? (pgrs.find((p: any) => p.id === editId) as any)?.status ?? "rascunho"
    : "rascunho";
  function pgrStatusBadge(s: string) {
    const map: Record<string, { label: string; cls: string }> = {
      rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-600 border-slate-200" },
      em_revisao: { label: "Em Revisão", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
      aprovado: { label: "Aprovado", cls: "bg-blue-100 text-blue-700 border-blue-200" },
      publicado: { label: "Publicado", cls: "bg-green-100 text-green-700 border-green-200" },
    };
    const d = map[s] ?? map["rascunho"];
    return <Badge className={`${d.cls} gap-1`}>{d.label}</Badge>;
  }

  async function openEditor(id: number | "new", branchId: number | null = null) {
    setPdfUrl(null);
    try {
      const res: any = await utils.pgr.get.fetch(
        id === "new" ? { companyId: companyId ?? undefined, branchId } : { id }
      );
      const d = res.doc;
      setDoc({
        ...emptyDoc(),
        ...d,
        vigencia_inicio: dateInput(d.vigencia_inicio),
        vigencia_fim: dateInput(d.vigencia_fim),
        ghe_funcoes: Array.isArray(d.ghe_funcoes) ? d.ghe_funcoes : (typeof d.ghe_funcoes === "string" ? JSON.parse(d.ghe_funcoes || "[]") : []),
        revisoes: Array.isArray(d.revisoes) ? d.revisoes : (typeof d.revisoes === "string" ? JSON.parse(d.revisoes || "[]") : []),
        inventario: Array.isArray(d.inventario) ? d.inventario : (typeof d.inventario === "string" ? JSON.parse(d.inventario || "[]") : []),
        gse_grupos: Array.isArray(d.gse_grupos) ? d.gse_grupos : (typeof d.gse_grupos === "string" ? JSON.parse(d.gse_grupos || "[]") : []),
        epc_itens: Array.isArray(d.epc_itens) ? d.epc_itens : (typeof d.epc_itens === "string" ? JSON.parse(d.epc_itens || "[]") : []),
        epi_itens: Array.isArray(d.epi_itens) ? d.epi_itens : (typeof d.epi_itens === "string" ? JSON.parse(d.epi_itens || "[]") : []),
        plano_psicossocial: Array.isArray(d.plano_psicossocial) ? d.plano_psicossocial : (typeof d.plano_psicossocial === "string" ? JSON.parse(d.plano_psicossocial || "[]") : (d.planoPsicossocial ?? [])),
        notas_tecnicas: String(d.notasTecnicas ?? d.notas_tecnicas ?? ""),
        caracterizacao_setores: Array.isArray(d.caracterizacao_setores) ? d.caracterizacao_setores : (typeof d.caracterizacao_setores === "string" ? JSON.parse(d.caracterizacao_setores || "[]") : (d.caracterizacaoSetores ?? [])),
        cronograma_preventivo: Array.isArray(d.cronograma_preventivo) ? d.cronograma_preventivo : (typeof d.cronograma_preventivo === "string" ? JSON.parse(d.cronograma_preventivo || "[]") : (d.cronogramaPreventivo ?? [])),
        hierarquia_controle: Array.isArray(d.hierarquia_controle) ? d.hierarquia_controle : (typeof d.hierarquia_controle === "string" ? JSON.parse(d.hierarquia_controle || "[]") : (d.hierarquiaControle ?? [])),
        nao_conformidades: Array.isArray(d.nao_conformidades) ? d.nao_conformidades : (typeof d.nao_conformidades === "string" ? JSON.parse(d.nao_conformidades || "[]") : (d.naoConformidades ?? [])),
        treinamentos_nr: Array.isArray(d.treinamentos_nr) ? d.treinamentos_nr : (typeof d.treinamentos_nr === "string" ? JSON.parse(d.treinamentos_nr || "[]") : (d.treinamentosNr ?? [])),
      });
      setEditId(id === "new" ? "new" : (d.id ?? id));
      if (id !== "new") setPdfUrl(d.pdf_url ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar PGR");
    }
  }

  function save() {
    if (!doc.razao_social?.trim()) { toast.error("Informe a Razão Social"); return; }
    upsert.mutate({
      id: editId === "new" ? undefined : (editId as number),
      companyId: companyId ?? undefined,
      branchId: doc.branch_id ?? null,
      title: doc.title,
      razaoSocial: doc.razao_social, nomeFantasia: doc.nome_fantasia, cnpj: doc.cnpj,
      endereco: doc.endereco, atividadePrincipal: doc.atividade_principal, grauRisco: doc.grau_risco,
      contato: doc.contato, email: doc.email, numFuncionarios: doc.num_funcionarios,
      objetoContrato: doc.objeto_contrato, horariosTrabalho: doc.horarios_trabalho,
      regimeTrabalho: doc.regime_trabalho, obra: doc.obra,
      vigenciaInicio: doc.vigencia_inicio || null, vigenciaFim: doc.vigencia_fim || null,
      contratanteAtivo: !!doc.contratante_ativo,
      contratanteRazao: doc.contratante_razao, contratanteCnpj: doc.contratante_cnpj,
      contratanteEndereco: doc.contratante_endereco, contratanteAtividade: doc.contratante_atividade,
      contratanteGrauRisco: doc.contratante_grau_risco, contratanteContato: doc.contratante_contato,
      contratanteEmail: doc.contratante_email,
      respTecnicoNome: doc.resp_tecnico_nome, respTecnicoRegistro: doc.resp_tecnico_registro,
      respTecnicoProfissao: doc.resp_tecnico_profissao || undefined,
      respTecnicoArt: doc.resp_tecnico_art || undefined,
      respTecnicoEmpresa: doc.resp_tecnico_empresa || undefined,
      respTecnicoAssinaturaUrl: doc.resp_tecnico_assinatura_url || undefined,
      respTecnicoValidadeAte: doc.resp_tecnico_validade_ate || null,
      logoUrl: doc.logo_url,
      gheFuncoes: doc.ghe_funcoes, revisoes: doc.revisoes, inventario: doc.inventario,
      gseGrupos: doc.gse_grupos, epcItens: doc.epc_itens, epiItens: doc.epi_itens,
          planoPsicossocial: doc.plano_psicossocial,
          notasTecnicas: doc.notas_tecnicas,
          caracterizacaoSetores: doc.caracterizacao_setores,
          cronogramaPreventivo: doc.cronograma_preventivo,
          hierarquiaControle: doc.hierarquia_controle,
          naoConformidades: doc.nao_conformidades,
          treinamentosNr: doc.treinamentos_nr,
    });
  }

  const set = (k: string, v: any) => setDoc((d: any) => ({ ...d, [k]: v }));
  const setRow = (key: string, i: number, patch: any) =>
    setDoc((d: any) => ({ ...d, [key]: d[key].map((r: any, idx: number) => idx === i ? { ...r, ...patch } : r) }));
  const addRow = (key: string, blank: any) => setDoc((d: any) => ({ ...d, [key]: [...d[key], blank] }));
  const delRow = (key: string, i: number) => setDoc((d: any) => ({ ...d, [key]: d[key].filter((_: any, idx: number) => idx !== i) }));

  // SP4 #12 — Auto-preenche setores a partir da estrutura RH (hierarchyTree).
  // Traz nome do setor + número de colaboradores ativos. Resto fica em branco
  // pro usuário completar (turno, máquinas, fluxo, EPIs). Idempotente: se o setor
  // já está na lista (por nome), pula.
  const treeQuery = trpc.lessons.hierarchyTree.useQuery();
  function autoFillSetoresFromRh() {
    const tree = (treeQuery.data ?? []) as any[];
    if (!tree.length) { toast.error("Estrutura de RH ainda não carregou. Tente em alguns segundos."); return; }
    const co = companyId ? tree.find((c: any) => c.company?.id === companyId) : tree[0];
    if (!co) { toast.error("Sem dados da empresa no RH."); return; }
    const setoresMap = new Map<string, number>(); // nome → headcount
    for (const b of (co.branches ?? [])) {
      for (const s of (b.sectors ?? [])) {
        const nome = String(s.sector?.name || "").trim();
        if (!nome) continue;
        const headcount = Number(s.userCount || (s.users?.length ?? 0));
        setoresMap.set(nome, (setoresMap.get(nome) ?? 0) + headcount);
      }
    }
    if (setoresMap.size === 0) { toast.info("Nenhum setor encontrado no RH dessa empresa."); return; }
    const existentes = new Set((doc.caracterizacao_setores ?? []).map((cs: any) => String(cs.setor ?? "").trim()).filter(Boolean));
    const novos: any[] = [];
    setoresMap.forEach((headcount, nome) => {
      if (!existentes.has(nome)) {
        novos.push({ setor: nome, numColaboradores: String(headcount), turno: "", maquinas: "", produtos: "", fluxoAtividades: "", epis: "", observacoes: "Pré-preenchido a partir da estrutura RH — complete os demais campos." });
      }
    });
    if (novos.length === 0) { toast.info("Todos os setores do RH já estão na lista."); return; }
    setDoc((d: any) => ({ ...d, caracterizacao_setores: [...(d.caracterizacao_setores ?? []), ...novos] }));
    toast.success(`Adicionados ${novos.length} setor(es) do RH. Complete turno, máquinas, EPIs etc.`);
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (editId == null) {
    return (
      <AppLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-transparent rounded-full" />
            <h1 className="text-3xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <ShieldCheck className="text-primary" /> Gerador de PGR
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Programa de Gerenciamento de Riscos (NR-01). O texto técnico é o padrão da consultoria;
              você preenche os dados, a logomarca e o responsável técnico do cliente.
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex gap-3 text-sm text-blue-900/90">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p>Cada PGR fica vinculado a uma empresa. Inclua o inventário de riscos com Probabilidade e
            Severidade — o Nível de Risco (NR = P × S) e a zona de decisão são calculados automaticamente
            conforme a Matriz de Risco da NR-01.</p>
          </div>

          {isMulti && (
            <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
              <Building2 size={18} className="text-primary" />
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={companyId ? String(companyId) : ""} onValueChange={(v) => setCompanyId(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Tab toggle */}
          <div className="flex items-center gap-1 border-b">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${dashTab === "lista" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setDashTab("lista")}>
              Lista
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${dashTab === "painel" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setDashTab("painel")}>
              Painel
            </button>
            <div className="flex-1"/>
            {dashTab === "lista" && (
              <Button onClick={() => { setScopeMode("consolidated"); setScopeBranchId(null); setScopeOpen(true); }} disabled={companyId == null} className="gap-2 mb-1" size="sm">
                <Plus size={14} /> Novo PGR
              </Button>
            )}
          </div>

          {dashTab === "painel" ? (
            <AdminPGRDashboard />
          ) : companyId == null ? (
            <div className="bg-white border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Selecione uma empresa para visualizar e criar PGRs.
            </div>
          ) : listQ.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : (listQ.data ?? []).length === 0 ? (
            <div className="bg-white border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhum PGR ainda. Clique em "Novo PGR" para comecar.
            </div>
          ) : (
            <div className="space-y-2">
              {(listQ.data as any[]).map((p) => (
                <div key={p.id} className="bg-white border rounded-xl p-4 flex items-center gap-3">
                  <FileText className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{p.razaoSocial || p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.status === "gerado" ? "PDF gerado" : "Rascunho"}
                      {p.vigenciaInicio ? ` · Vigencia ${new Date(p.vigenciaInicio).toLocaleDateString("pt-BR")}` : ""}
                      {p.updatedAt ? ` · Atualizado ${new Date(p.updatedAt).toLocaleDateString("pt-BR")}` : ""}
                    </div>
                  </div>
                  {p.pdfUrl && (
                    <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1"><Download size={14} /> PDF</Button>
                    </a>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEditor(p.id)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este PGR?")) delMut.mutate({ id: p.id }); }}>
                    <Trash2 size={14} className="text-rose-600" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Modal: escopo do novo PGR — Filial específica vs Consolidado */}
          <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Como deseja gerar o PGR?</DialogTitle>
                <DialogDescription>
                  O escopo do PGR define quais colaboradores, setores e ciclos serão importados.
                  Você pode mudar isso depois editando o PGR.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input type="radio" name="pgr-scope" checked={scopeMode === "consolidated"}
                    onChange={() => setScopeMode("consolidated")} className="mt-1" />
                  <div>
                    <div className="font-semibold text-slate-900">Consolidado (todas as filiais)</div>
                    <div className="text-xs text-slate-500">PGR abrangente da empresa, consolidando todas as filiais e setores.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input type="radio" name="pgr-scope" checked={scopeMode === "branch"}
                    onChange={() => setScopeMode("branch")} className="mt-1" />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Apenas uma filial</div>
                    <div className="text-xs text-slate-500 mb-2">PGR restrito aos colaboradores, setores e ciclos da filial escolhida.</div>
                    {scopeMode === "branch" && (
                      <Select value={scopeBranchId ? String(scopeBranchId) : ""} onValueChange={(v) => setScopeBranchId(Number(v))}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione a filial" /></SelectTrigger>
                        <SelectContent>
                          {branches.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500">Nenhuma filial cadastrada para esta empresa.</div>
                          )}
                          {branches.map((b: any) => (
                            <SelectItem key={b.id} value={String(b.id)}>
                              {b.name}{b.location ? ` — ${b.location}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setScopeOpen(false)}>Cancelar</Button>
                <Button disabled={createBlankMut.isPending} onClick={() => {
                  if (scopeMode === "branch" && !scopeBranchId) { toast.error("Selecione a filial."); return; }
                  createBlankMut.mutate({
                    companyId: companyId ?? undefined,
                    branchId: scopeMode === "branch" ? scopeBranchId : null,
                  });
                }}>
                  {createBlankMut.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
                  Continuar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    );
  }

  // ── EDITOR VIEW ──────────────────────────────────────────────────────────────
  const field = (label: string, key: string, opts: { type?: string; full?: boolean; area?: boolean; rows?: number } = {}) => (
    <div className={opts.full ? "md:col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      {opts.area
        ? <Textarea className="mt-1" rows={opts.rows ?? 2} value={doc[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
        : <Input className="mt-1" type={opts.type ?? "text"} value={doc[key] ?? ""} onChange={(e) => set(key, e.target.value)} />}
    </div>
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <button onClick={() => { setEditId(null); }} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Voltar à lista
        </button>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-transparent rounded-full" />
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <ShieldCheck className="text-primary" /> {editId === "new" ? "Novo PGR" : "Editar PGR"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Preencha os dados do cliente. O texto normativo é inserido automaticamente.</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge className={doc.branch_id ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}>
                Escopo: {doc.branch_id ? `Filial — ${doc.branch_name ?? doc.branch_id}` : "Consolidado (todas as filiais)"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={save} disabled={upsert.isPending} className="gap-2">
              {upsert.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
            </Button>
            <Button onClick={() => { if (editId === "new") { toast.error("Salve o PGR antes de gerar o PDF."); return; } genMut.mutate({ id: editId as number }); }}
              disabled={genMut.isPending || editId === "new"} className="gap-2">
              {genMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Gerar PDF
            </Button>
            {editId !== "new" && <Button variant="outline" size="sm" className="gap-1" onClick={() => setHistoryOpen(true)}><History size={14}/>Histórico</Button>}
            {editId !== "new" && currentPGRStatus === "rascunho" && (
              <Button variant="outline" size="sm" className="gap-1 border-yellow-300 text-yellow-700"
                onClick={() => updateStatusM.mutate({ id: editId as number, status: "em_revisao" })}>
                <Send size={14}/>Enviar p/ revisão
              </Button>
            )}
            {editId !== "new" && currentPGRStatus === "em_revisao" && (
              <Button variant="outline" size="sm" className="gap-1 border-blue-300 text-blue-700"
                onClick={() => updateStatusM.mutate({ id: editId as number, status: "aprovado" })}>
                <CheckCircle2 size={14}/>Aprovar
              </Button>
            )}
            {editId !== "new" && currentPGRStatus === "aprovado" && (
              <Button variant="outline" size="sm" className="gap-1 border-green-300 text-green-700"
                onClick={() => updateStatusM.mutate({ id: editId as number, status: "publicado" })}>
                <CheckCircle2 size={14}/>Publicar
              </Button>
            )}
            {editId !== "new" && pgrStatusBadge(currentPGRStatus)}
          </div>
        </div>

        {pdfUrl && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-emerald-900">PDF do PGR pronto</div>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-2"><Download size={14} /> Abrir PDF</Button>
            </a>
          </div>
        )}

        {/* Importações inteligentes — reaproveita dados já existentes na plataforma. */}
        {editId !== "new" && (
          <section className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-indigo-900 flex items-center gap-2"><Sparkles size={16} /> Importações Inteligentes</h2>
              <p className="text-xs text-indigo-700 mt-0.5">Reaproveite informações já existentes (RH, ciclos psicossociais) — sem redigitar.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-white border rounded-lg p-3 flex flex-col gap-2">
                <div className="font-medium text-sm text-slate-900">Importar do RH</div>
                <div className="text-xs text-slate-600">Puxa filiais, setores, cargos e contagem de colaboradores cadastrados na plataforma.</div>
                <Button size="sm" onClick={() => importRhM.mutate({ pgrId: editId as number })} disabled={importRhM.isPending} className="gap-1 w-fit">
                  {importRhM.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Importar
                </Button>
              </div>
              <div className="bg-white border rounded-lg p-3 flex flex-col gap-2">
                <div className="font-medium text-sm text-slate-900">Importar Ciclo Psicossocial</div>
                <div className="text-xs text-slate-600">Traz inventário e plano de ação do ciclo selecionado para dentro do PGR.</div>
                <div className="flex gap-2">
                  <Select value={cycleSelect} onValueChange={setCycleSelect}>
                    <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Selecione o ciclo" /></SelectTrigger>
                    <SelectContent>
                      {(cyclesQ.data ?? []).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-500">Nenhum ciclo cadastrado.</div>
                      )}
                      {((cyclesQ.data ?? []) as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.cycleName} {c.branchName ? `· ${c.branchName}` : "· Consolidado"} ({c.invCount} riscos · {c.planCount} ações)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!cycleSelect || importCycleM.isPending}
                    onClick={() => importCycleM.mutate({ pgrId: editId as number, assessmentId: Number(cycleSelect) })}
                    className="gap-1">
                    {importCycleM.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Importar
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Gestão de GSE (Sprint 1 PGR Inteligente) — só faz sentido após salvar o PGR. */}
        {typeof editId === "number" && (
          <AdminPGRGseManager pgrId={editId as number} companyId={companyId} />
        )}

        {/* Identificação Contratada */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Identificação da Empresa (Contratada)</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {field("Razão Social", "razao_social")}
            {field("Nome Fantasia", "nome_fantasia")}
            {field("CNPJ", "cnpj")}
            {field("Atividade Principal (CNAE)", "atividade_principal")}
            {field("Grau de Risco", "grau_risco")}
            {field("Nº de Funcionários", "num_funcionarios")}
            {field("Contato", "contato")}
            {field("E-mail", "email")}
            {field("Endereço", "endereco", { full: true, area: true })}
            {field("Objeto do Contrato", "objeto_contrato", { full: true, area: true })}
            {field("Horários de Trabalho", "horarios_trabalho", { full: true, area: true })}
            {field("Regime de Trabalho", "regime_trabalho", { full: true, area: true })}
            {field("Obra / Local (opcional)", "obra", { full: true, area: true })}
            {field("Vigência — Início", "vigencia_inicio", { type: "date" })}
            {field("Vigência — Fim", "vigencia_fim", { type: "date" })}
          </div>
        </section>

        {/* Identificação Contratante */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Empresa Contratante (opcional)</h2>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!doc.contratante_ativo}
                onChange={(e) => set("contratante_ativo", e.target.checked ? 1 : 0)} />
              Incluir contratante
            </label>
          </div>
          {!!doc.contratante_ativo && (
            <div className="grid md:grid-cols-2 gap-3">
              {field("Razão Social", "contratante_razao")}
              {field("CNPJ", "contratante_cnpj")}
              {field("Atividade Principal (CNAE)", "contratante_atividade")}
              {field("Grau de Risco", "contratante_grau_risco")}
              {field("Contato", "contratante_contato")}
              {field("E-mail", "contratante_email")}
              {field("Endereço", "contratante_endereco", { full: true, area: true })}
            </div>
          )}
        </section>

        {/* Responsável técnico + logo */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Responsável Técnico & Empresa Elaboradora</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {field("Nome do Responsável Técnico", "resp_tecnico_nome")}
            {field("Registro profissional (CRP/CREA/CRQ/etc.)", "resp_tecnico_registro")}
            {field("Profissão/especialidade", "resp_tecnico_profissao")}
            {field("ART / RRT (número)", "resp_tecnico_art")}
            {field("Empresa elaboradora", "resp_tecnico_empresa", { full: true })}
            <div className="md:col-span-2">
              <SignatureUpload
                value={doc.resp_tecnico_assinatura_url ?? ""}
                onChange={v => set("resp_tecnico_assinatura_url", v)}
                label="Assinatura digital do responsável técnico (PNG, fundo transparente)"
              />
            </div>
            {field("Validade da responsabilidade técnica", "resp_tecnico_validade_ate", { type: "date" })}
            <div>
              <SignatureUpload
                value={doc.logo_url ?? ""}
                onChange={v => set("logo_url", v)}
                type="logo"
                label="Logomarca da empresa (PNG/JPG)"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">A logomarca e a assinatura aparecem na capa e na seção de responsabilidade técnica do PDF. Cole URLs de imagens (PNG/JPG).</p>
        </section>

        {/* GSE / Grupos Similares de Exposição — MODELO LEGADO (será removido na Sprint 2) */}
        


        {/* Inventário de Riscos — MODELO LEGADO (será removido na Sprint 2) */}
        
        {/* EPC — MODELO LEGADO (será removido na Sprint 2) */}
        

        {/* EPI — MODELO LEGADO (será removido na Sprint 2) */}
        
        {/* 8.3 Caracterizacao Operacional dos Setores */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-foreground">Caracterizacao Operacional dos Setores</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={autoFillSetoresFromRh} className="gap-1 border-blue-300 text-blue-700 hover:bg-blue-50" title="Pré-preenche os setores com base na estrutura cadastrada em RH (filiais > setores > usuários por setor)">
                <Sparkles size={14} /> Auto-preencher do RH
              </Button>
              <Button size="sm" variant="outline" onClick={() => addRow("caracterizacao_setores", { setor: "", numColaboradores: "", turno: "", maquinas: "", produtos: "", fluxoAtividades: "", epis: "", observacoes: "" })} className="gap-1">
                <ListPlus size={14} /> Adicionar setor
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Descreva as atividades, maquinas, produtos e EPIs de cada setor. <b>Auto-preencher do RH</b> traz nome do setor + quantidade de colaboradores diretamente da estrutura cadastrada — você completa o resto.</p>
          {doc.caracterizacao_setores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
          ) : doc.caracterizacao_setores.map((cs: CaracSetorRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Setor #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("caracterizacao_setores", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div><Label className="text-xs">Nome do setor</Label><Input className="mt-1" value={cs.setor ?? ""} onChange={ev => setRow("caracterizacao_setores", i, { setor: ev.target.value })} placeholder="ex.: Producao, Administrativo" /></div>
                <div><Label className="text-xs">Num. de colaboradores</Label><Input className="mt-1" value={cs.numColaboradores ?? ""} onChange={ev => setRow("caracterizacao_setores", i, { numColaboradores: ev.target.value })} placeholder="ex.: 15" /></div>
                <div><Label className="text-xs">Turno de trabalho</Label><Input className="mt-1" value={cs.turno ?? ""} onChange={ev => setRow("caracterizacao_setores", i, { turno: ev.target.value })} placeholder="ex.: Diurno 07:00-17:00" /></div>
                <div><Label className="text-xs">Maquinas / equipamentos</Label><Input className="mt-1" value={cs.maquinas ?? ""} onChange={ev => setRow("caracterizacao_setores", i, { maquinas: ev.target.value })} placeholder="ex.: Prensa, Tornos CNC" /></div>
                <div><Label className="text-xs">Produtos / materiais</Label><Input className="mt-1" value={cs.produtos ?? ""} onChange={ev => setRow("caracterizacao_setores", i, { produtos: ev.target.value })} placeholder="ex.: Solventes, Tintas" /></div>
                <div><Label className="text-xs">EPIs utilizados</Label><Input className="mt-1" value={cs.epis ?? ""} onChange={ev => setRow("caracterizacao_setores", i, { epis: ev.target.value })} placeholder="ex.: Capacete, Luva de nitrila" /></div>
                <div className="md:col-span-2"><Label className="text-xs">Fluxo de atividades / processo produtivo</Label><Textarea rows={2} className="mt-1" value={cs.fluxoAtividades ?? ""} onChange={ev => setRow("caracterizacao_setores", i, { fluxoAtividades: ev.target.value })} placeholder="Descreva o fluxo de trabalho do setor..." /></div>
                <div className="md:col-span-2"><Label className="text-xs">Observacoes</Label><Textarea rows={1} className="mt-1" value={cs.observacoes ?? ""} onChange={ev => setRow("caracterizacao_setores", i, { observacoes: ev.target.value })} /></div>
              </div>
            </div>
          ))}
        </section>





        {/* Anexos e Evidencias */}
        {editId !== "new" && (
          <section className="bg-white border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><Paperclip size={16}/>Anexos e Evidencias</h2>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => { setAttachForm({ tipo: "Outro", titulo: "", descricao: "", fileUrl: "", fileName: "", dataReferencia: "", numeroDoc: "" }); setAttachOpen(true); }}>
                <Plus size={14}/>Adicionar anexo
              </Button>
            </div>
            <div className="bg-blue-50/60 border border-blue-200 rounded-md p-3 text-xs text-blue-900">
              <b>Orientação:</b> Utilize este campo para anexação de <b>LTCAT, PCA, PPR, APR, medições ambientais, laudos técnicos</b> e demais documentos complementares.
              <br />Todos os arquivos anexados aqui serão incluídos integralmente ao final do PDF do PGR.
            </div>
            {(attachQ.data ?? []).length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FolderOpen size={32} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Nenhum anexo cadastrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {((attachQ.data ?? []) as any[]).map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 border rounded-lg p-3 bg-slate-50/50">
                    <Paperclip size={16} className="text-slate-400 mt-0.5 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{a.titulo}</div>
                      <div className="text-xs text-muted-foreground">{a.tipo}{a.numeroDoc ? ` · Nº ${a.numeroDoc}` : ""}{a.dataReferencia ? ` · ${new Date(a.dataReferencia).toLocaleDateString("pt-BR")}` : ""}</div>
                      {a.descricao && <div className="text-xs text-slate-600 mt-0.5">{a.descricao}</div>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {a.fileUrl && <a href={a.fileUrl} target="_blank" rel="noopener noreferrer"><Button size="icon" variant="ghost"><ExternalLink size={14}/></Button></a>}
                      <Button size="icon" variant="ghost" onClick={() => { setAttachForm({...a, dataReferencia: a.dataReferencia ?? ""}); setAttachOpen(true); }}><Save size={14}/></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeAttachM.mutate({ id: a.id })}><Trash2 size={14} className="text-rose-500"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      {/* Attachments Dialog */}
      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{attachForm.id ? "Editar anexo" : "Novo anexo"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Tipo de documento</Label>
              <Select value={attachForm.tipo ?? "Outro"} onValueChange={v => setAttachForm((f: any) => ({...f, tipo: v}))}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{ATTACH_TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título / Identificação</Label>
              <Input placeholder="ex.: LTCAT 2024, Laudo de Ruído, Foto Posto 01" value={attachForm.titulo ?? ""} onChange={e => setAttachForm((f: any) => ({...f, titulo: e.target.value}))}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nº do documento</Label>
                <Input placeholder="ex.: 001/2024" value={attachForm.numeroDoc ?? ""} onChange={e => setAttachForm((f: any) => ({...f, numeroDoc: e.target.value}))}/>
              </div>
              <div>
                <Label className="text-xs">Data de referência</Label>
                <Input type="date" value={attachForm.dataReferencia ?? ""} onChange={e => setAttachForm((f: any) => ({...f, dataReferencia: e.target.value}))}/>
              </div>
            </div>
            <div>
              <Label className="text-xs">URL do arquivo (PDF, imagem, etc.)</Label>
              <Input placeholder="https://..." value={attachForm.fileUrl ?? ""} onChange={e => setAttachForm((f: any) => ({...f, fileUrl: e.target.value}))}/>
            </div>
            <div>
              <Label className="text-xs">Descrição / observações</Label>
              <Textarea rows={2} value={attachForm.descricao ?? ""} onChange={e => setAttachForm((f: any) => ({...f, descricao: e.target.value}))}/>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAttachOpen(false)}>Cancelar</Button>
              <Button disabled={upsertAttachM.isPending || !attachForm.titulo}
                onClick={() => upsertAttachM.mutate({
                  id: attachForm.id,
                  pgrId: typeof editId === "number" ? editId : 0,
                  tipo: attachForm.tipo || "Outro",
                  titulo: attachForm.titulo,
                  descricao: attachForm.descricao || undefined,
                  fileUrl: attachForm.fileUrl || undefined,
                  dataReferencia: attachForm.dataReferencia || undefined,
                  numeroDoc: attachForm.numeroDoc || undefined,
                })}>
                {upsertAttachM.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de Revisões</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {historyQ.data && (historyQ.data as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum registro de revisão encontrado.</p>
            )}
            {(historyQ.data as any[] ?? []).map((h: any) => {
              const statusLabel: Record<string, string> = {
                rascunho: "Retornado ao rascunho", em_revisao: "Enviado para revisão",
                aprovado: "Aprovado", publicado: "Publicado",
              };
              return (
                <div key={h.id} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"></div>
                    <div className="w-px bg-border flex-1 mt-1"></div>
                  </div>
                  <div className="pb-3">
                    <div className="font-medium">{statusLabel[h.action] ?? h.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.performedBy} · {h.createdAt ? new Date(h.createdAt).toLocaleString("pt-BR") : "—"}
                      {h.revisionNumber && ` · Rev. ${h.revisionNumber}`}
                    </div>
                    {h.notes && <div className="text-xs text-slate-600 mt-0.5">{h.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
