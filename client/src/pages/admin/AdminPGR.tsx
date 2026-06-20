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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const ATTACH_TIPOS = ["LTCAT","PCA","PPR","APR","Laudo Técnico","Medição","Foto/Imagem","Declaração","Certificado","Outro"];
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

  async function openEditor(id: number | "new") {
    setPdfUrl(null);
    try {
      const res: any = await utils.pgr.get.fetch(
        id === "new" ? { companyId: companyId ?? undefined } : { id }
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
              <Button onClick={() => openEditor("new")} disabled={companyId == null} className="gap-2 mb-1" size="sm">
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

        {/* GSE / Grupos Similares de Exposição */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Grupos Similares de Exposição (GSE)</h2>
            <Button size="sm" variant="outline" onClick={() => addRow("gse_grupos", { grupo: "", funcoes: "", atividades: "", num: "", sexoM: "", sexoF: "", horario: "", local: "" })} className="gap-1">
              <ListPlus size={14} /> Adicionar grupo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">GSE agrupa trabalhadores com perfil de exposição similar para avaliação quantitativa.</p>
          {doc.gse_grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum GSE cadastrado.</p>
          ) : doc.gse_grupos.map((g: GseRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">GSE #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("gse_grupos", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <Input placeholder="Nome do Grupo (ex.: GSE-01)" value={g.grupo} onChange={(e) => setRow("gse_grupos", i, { grupo: e.target.value })} />
                <Input placeholder="Nº trabalhadores expostos" value={g.num ?? ""} onChange={(e) => setRow("gse_grupos", i, { num: e.target.value })} />
                <Input placeholder="Funções incluídas" value={g.funcoes ?? ""} onChange={(e) => setRow("gse_grupos", i, { funcoes: e.target.value })} />
                <Input placeholder="Atividades / exposições" value={g.atividades ?? ""} onChange={(e) => setRow("gse_grupos", i, { atividades: e.target.value })} />
                <Input placeholder="Nº Masc." value={g.sexoM ?? ""} onChange={(e) => setRow("gse_grupos", i, { sexoM: e.target.value })} />
                <Input placeholder="Nº Fem." value={g.sexoF ?? ""} onChange={(e) => setRow("gse_grupos", i, { sexoF: e.target.value })} />
                <Input placeholder="Horário de trabalho (ex.: 08h–17h)" value={g.horario ?? ""} onChange={(e) => setRow("gse_grupos", i, { horario: e.target.value })} />
                <Input placeholder="Local / posto de trabalho" value={g.local ?? ""} onChange={(e) => setRow("gse_grupos", i, { local: e.target.value })} />
              </div>
            </div>
          ))}
        </section>

        {/* Notas Tecnicas */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Notas Tecnicas / Conclusao</h2>
            <button type="button" className="text-sm text-primary flex items-center gap-1.5 hover:underline"
              disabled={genNarrM.isPending || editId === "new"}
              onClick={() => { if (typeof editId === "number") genNarrM.mutate({ pgrId: editId, section: "conclusao" }); }}>
              {genNarrM.isPending && genNarrM.variables?.section === "conclusao" ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>}
              Gerar conclusao com IA
            </button>
          </div>
          <Textarea rows={4} value={doc.notas_tecnicas ?? ""} onChange={e => set("notas_tecnicas", e.target.value)} placeholder="Observacoes tecnicas, conclusao e recomendacoes gerais..." />
        </section>

        {/* Matriz de Riscos Integrada */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Matriz de Riscos</h2>
            <button className="text-xs text-primary underline underline-offset-2" onClick={() => setMatrixOpen(o => !o)}>
              {matrixOpen ? "Ocultar" : "Visualizar"}
            </button>
          </div>
          {matrixOpen && <RiskMatrix inventory={doc.inventario as any[]} />}
          {!matrixOpen && (
            <p className="text-xs text-muted-foreground">
              Clique em "Visualizar" para exibir a matriz Probabilidade x Severidade com os {doc.inventario.length} fatores cadastrados.
            </p>
          )}
        </section>

        {/* Inventário de Riscos */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Inventário de Riscos</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                setImportingPsy(true);
                try {
                  const data = await utils.pgr.getPsychosocialForPGR.fetch(companyId ? { companyId } : {});
                  if (data && data.length > 0) {
                    const existing = new Set(doc.inventario.map((it: InvRow) => it.fator));
                    const newItems = (data as any[]).filter(d => !existing.has(d.fator)).map(d => ({
                      fator: d.fator, causas: d.causas || "", controles: d.controles || "",
                      agravos: "", populacao: "", tipoAvaliacao: "Qualitativa",
                      probabilidade: d.riscoFinal === "critico" ? "certo" : "provavel",
                      severidade: d.riscoFinal === "critico" ? "maior" : "moderada", acoes: "",
                    }));
                    if (newItems.length > 0) {
                      setDoc((d: any) => ({ ...d, inventario: [...d.inventario, ...newItems] }));
                      toast.success(`${newItems.length} fator(es) importado(s) do diagnóstico psicossocial`);
                    } else toast.info("Todos os fatores críticos/altos já estão no inventário");
                  } else toast.info("Nenhum fator crítico ou alto encontrado no diagnóstico");
                } catch (e: any) { toast.error(e?.message ?? "Erro ao importar"); }
                finally { setImportingPsy(false); }
              }} disabled={importingPsy} className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50">
                {importingPsy ? <Loader2 size={14} className="animate-spin" /> : <Info size={14} />}
                Importar do Diagnóstico
              </Button>
              <Button size="sm" variant="outline"
                disabled={importAepM.isPending || editId === "new"}
                onClick={() => { if (typeof editId === "number") importAepM.mutate({ pgrId: editId }); }}
                className="gap-1 text-purple-700 border-purple-300 hover:bg-purple-50">
                {importAepM.isPending ? <Loader2 size={14} className="animate-spin"/> : null}
                Importar AEP
              </Button>
              <Button size="sm" variant="outline" onClick={() => addRow("inventario", { fator: "", tipoRisco: "Psicossocial", postoTrabalho: "", funcoes: "", dataReconhecimento: "", agravos: "", causas: "", controles: "", eficaciaControles: "", populacao: "", freqExposicao: "", tipoAvaliacao: "Qualitativa", probabilidade: "possivel", severidade: "moderada", acoes: "", responsavel: "", prazo: "", areaImpacto: "", freqMonitoramento: "Anual", legRef: "", observacoes: "" })} className="gap-1">
                <ListPlus size={14} /> Adicionar risco
              </Button>
            </div>
          </div>
          {doc.inventario.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum fator de risco cadastrado.</p>
          ) : doc.inventario.map((it: InvRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Risco #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("inventario", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <Input placeholder="Fator de risco (ex.: Ruído, Psicossocial, Ergonômico)" value={it.fator} onChange={(e) => setRow("inventario", i, { fator: e.target.value })} />
                <div>
                  <Label className="text-[11px] text-muted-foreground">Tipo de Risco</Label>
                  <Select value={it.tipoRisco ?? "Psicossocial"} onValueChange={(v) => setRow("inventario", i, { tipoRisco: v })}>
                    <SelectTrigger className="mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Psicossocial">Psicossocial</SelectItem>
                      <SelectItem value="Físico">Físico</SelectItem>
                      <SelectItem value="Químico">Químico</SelectItem>
                      <SelectItem value="Biológico">Biológico</SelectItem>
                      <SelectItem value="Ergonômico">Ergonômico</SelectItem>
                      <SelectItem value="Acidente">Acidente / Mecânico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="Posto de trabalho (ex.: Operador de máquina)" value={it.postoTrabalho ?? ""} onChange={(e) => setRow("inventario", i, { postoTrabalho: e.target.value })} />
                <Input placeholder="Funções/cargos expostos" value={it.funcoes ?? ""} onChange={(e) => setRow("inventario", i, { funcoes: e.target.value })} />
                <div>
                  <Label className="text-[11px] text-muted-foreground">Data do reconhecimento</Label>
                  <Input type="date" value={it.dataReconhecimento ?? ""} onChange={(e) => setRow("inventario", i, { dataReconhecimento: e.target.value })} />
                </div>
                <Input placeholder="Agravos à saúde (ex.: Estresse, Perda auditiva)" value={it.agravos ?? ""} onChange={(e) => setRow("inventario", i, { agravos: e.target.value })} />
                <Input placeholder="Causas / Fontes geradoras" value={it.causas ?? ""} onChange={(e) => setRow("inventario", i, { causas: e.target.value })} />
                <Input placeholder="Medidas de controle existentes" value={it.controles ?? ""} onChange={(e) => setRow("inventario", i, { controles: e.target.value })} />
                <div>
                  <Label className="text-[11px] text-muted-foreground">Eficácia dos controles</Label>
                  <Select value={it.eficaciaControles ?? ""} onValueChange={(v) => setRow("inventario", i, { eficaciaControles: v })}>
                    <SelectTrigger className="mt-0.5"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Adequada">Adequada</SelectItem>
                      <SelectItem value="Parcial">Parcial</SelectItem>
                      <SelectItem value="Inadequada">Inadequada</SelectItem>
                      <SelectItem value="Inexistente">Inexistente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="População exposta (nº ou função)" value={it.populacao ?? ""} onChange={(e) => setRow("inventario", i, { populacao: e.target.value })} />
                <Input placeholder="Frequência/duração de exposição" value={it.freqExposicao ?? ""} onChange={(e) => setRow("inventario", i, { freqExposicao: e.target.value })} />
                <Input placeholder="Área / local de exposição" value={it.areaImpacto ?? ""} onChange={(e) => setRow("inventario", i, { areaImpacto: e.target.value })} />
                <Input placeholder="Referência legislativa (ex.: NR-09)" value={it.legRef ?? ""} onChange={(e) => setRow("inventario", i, { legRef: e.target.value })} />
                <div>
                  <Label className="text-[11px] text-muted-foreground">Tipo de Avaliação</Label>
                  <Select value={it.tipoAvaliacao ?? "Qualitativa"} onValueChange={(v) => setRow("inventario", i, { tipoAvaliacao: v })}>
                    <SelectTrigger className="mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Qualitativa">Qualitativa</SelectItem>
                      <SelectItem value="Quantitativa">Quantitativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Frequência de monitoramento</Label>
                  <Select value={it.freqMonitoramento ?? "Anual"} onValueChange={(v) => setRow("inventario", i, { freqMonitoramento: v })}>
                    <SelectTrigger className="mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Probabilidade</Label>
                  <Select value={it.probabilidade ?? "possivel"} onValueChange={(v) => setRow("inventario", i, { probabilidade: v })}>
                    <SelectTrigger className="mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{PROB_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Severidade</Label>
                  <Select value={it.severidade ?? "moderada"} onValueChange={(v) => setRow("inventario", i, { severidade: v })}>
                    <SelectTrigger className="mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{SEV_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input placeholder="Responsável pela ação" value={it.responsavel ?? ""} onChange={(e) => setRow("inventario", i, { responsavel: e.target.value })} />
                <Input type="date" placeholder="Prazo" value={it.prazo ?? ""} onChange={(e) => setRow("inventario", i, { prazo: e.target.value })} />
                <Textarea className="md:col-span-2" placeholder="Ações necessárias / medidas preventivas e corretivas" rows={2} value={it.acoes ?? ""} onChange={(e) => setRow("inventario", i, { acoes: e.target.value })} />
                <Textarea className="md:col-span-2" placeholder="Observações adicionais" rows={1} value={it.observacoes ?? ""} onChange={(e) => setRow("inventario", i, { observacoes: e.target.value })} />
              </div>
            </div>
          ))}
        </section>

        {/* EPC - Equipamentos de Proteção Coletiva */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">EPC — Equipamentos de Proteção Coletiva</h2>
            <Button size="sm" variant="outline" onClick={() => addRow("epc_itens", { descricao: "", aplicacao: "" })} className="gap-1">
              <ListPlus size={14} /> Adicionar EPC
            </Button>
          </div>
          {doc.epc_itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum EPC cadastrado.</p>
          ) : doc.epc_itens.map((e: EpcRow, i: number) => (
            <div key={i} className="grid md:grid-cols-[2fr_2fr_36px] gap-2 items-start border-t pt-2">
              <Input placeholder="Equipamento (ex.: Ventilação mecânica)" value={e.descricao} onChange={(ev) => setRow("epc_itens", i, { descricao: ev.target.value })} />
              <Input placeholder="Aplicação / local" value={e.aplicacao ?? ""} onChange={(ev) => setRow("epc_itens", i, { aplicacao: ev.target.value })} />
              <Button size="icon" variant="ghost" onClick={() => delRow("epc_itens", i)}><X size={14} className="text-rose-600" /></Button>
            </div>
          ))}
        </section>

        {/* Plano de Acao Psicossocial */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Plano de Acao Psicossocial</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Acoes preventivas, promocionais e de reabilitacao para riscos psicossociais identificados no inventario.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => addRow("plano_psicossocial", { acao: "", categoria: "Prevencao", responsavel: "", prazo: "", cronograma: "", status: "Pendente", evidencia: "", observacoes: "" })} className="gap-1">
              <ListPlus size={14} /> Adicionar acao
            </Button>
          </div>
          {doc.plano_psicossocial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma acao cadastrada.</p>
          ) : doc.plano_psicossocial.map((ps: PsyRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Acao #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("plano_psicossocial", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="md:col-span-2">
                  <Label className="text-xs">Descricao da acao</Label>
                  <Textarea rows={2} className="mt-1" value={ps.acao ?? ""} onChange={ev => setRow("plano_psicossocial", i, { acao: ev.target.value })} placeholder="Descreva a acao preventiva ou corretiva..." />
                </div>
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Select value={ps.categoria ?? "Prevencao"} onValueChange={v => setRow("plano_psicossocial", i, { categoria: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prevencao">Prevencao</SelectItem>
                      <SelectItem value="Promocao">Promocao da Saude</SelectItem>
                      <SelectItem value="Reabilitacao">Reabilitacao</SelectItem>
                      <SelectItem value="Controle">Controle de Exposicao</SelectItem>
                      <SelectItem value="Treinamento">Treinamento / Capacitacao</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={ps.status ?? "Pendente"} onValueChange={v => setRow("plano_psicossocial", i, { status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluida">Concluida</SelectItem>
                      <SelectItem value="Cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Responsavel</Label>
                  <Input className="mt-1" value={ps.responsavel ?? ""} onChange={ev => setRow("plano_psicossocial", i, { responsavel: ev.target.value })} placeholder="Nome / equipe" />
                </div>
                <div>
                  <Label className="text-xs">Prazo</Label>
                  <Input type="date" className="mt-1" value={ps.prazo ?? ""} onChange={ev => setRow("plano_psicossocial", i, { prazo: ev.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Cronograma / periodicidade</Label>
                  <Input className="mt-1" value={ps.cronograma ?? ""} onChange={ev => setRow("plano_psicossocial", i, { cronograma: ev.target.value })} placeholder="ex.: Mensal, Trimestral, Unica vez" />
                </div>
                <div>
                  <Label className="text-xs">Evidencia / URL</Label>
                  <Input className="mt-1" value={ps.evidencia ?? ""} onChange={ev => setRow("plano_psicossocial", i, { evidencia: ev.target.value })} placeholder="Link para documento ou descricao da evidencia" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Observacoes</Label>
                  <Textarea rows={1} className="mt-1" value={ps.observacoes ?? ""} onChange={ev => setRow("plano_psicossocial", i, { observacoes: ev.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* EPI - Equipamentos de Proteção Individual */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">EPI — Equipamentos de Proteção Individual</h2>
            <Button size="sm" variant="outline" onClick={() => addRow("epi_itens", { descricao: "", ca: "", aplicacao: "", validade: "", periodicidade: "", fichaEntrega: "" })} className="gap-1">
              <ListPlus size={14} /> Adicionar EPI
            </Button>
          </div>
          {doc.epi_itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum EPI cadastrado.</p>
          ) : doc.epi_itens.map((e: EpiRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">EPI #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("epi_itens", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-3 gap-2">
                <Input placeholder="EPI (ex.: Protetor auricular)" value={e.descricao} onChange={(ev) => setRow("epi_itens", i, { descricao: ev.target.value })} />
                <Input placeholder="Nº CA (SINMETRO)" value={e.ca ?? ""} onChange={(ev) => setRow("epi_itens", i, { ca: ev.target.value })} />
                <Input placeholder="Validade do CA" value={e.validade ?? ""} onChange={(ev) => setRow("epi_itens", i, { validade: ev.target.value })} />
                <Input placeholder="Aplicação / função" value={e.aplicacao ?? ""} onChange={(ev) => setRow("epi_itens", i, { aplicacao: ev.target.value })} />
                <Input placeholder="Periodicidade de troca (ex.: 12 meses)" value={e.periodicidade ?? ""} onChange={(ev) => setRow("epi_itens", i, { periodicidade: ev.target.value })} />
                <Input placeholder="Ficha de entrega / registro" value={e.fichaEntrega ?? ""} onChange={(ev) => setRow("epi_itens", i, { fichaEntrega: ev.target.value })} />
              </div>
            </div>
          ))}
        </section>

        {/* 8.3 Caracterizacao Operacional dos Setores */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Caracterizacao Operacional dos Setores</h2>
            <Button size="sm" variant="outline" onClick={() => addRow("caracterizacao_setores", { setor: "", numColaboradores: "", turno: "", maquinas: "", produtos: "", fluxoAtividades: "", epis: "", observacoes: "" })} className="gap-1">
              <ListPlus size={14} /> Adicionar setor
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Descreva as atividades, maquinas, produtos e EPIs de cada setor para caracterizacao operacional detalhada.</p>
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

        {/* 8.10 Cronograma Preventivo */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Cronograma Preventivo</h2>
            <Button size="sm" variant="outline" onClick={() => addRow("cronograma_preventivo", { atividade: "", tipo: "Inspecao", responsavel: "", periodicidade: "", dataExecucao: "", status: "Pendente", observacoes: "" })} className="gap-1">
              <ListPlus size={14} /> Adicionar atividade
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Inspecoes, treinamentos, campanhas de saude e auditorias com datas e responsaveis.</p>
          {doc.cronograma_preventivo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada.</p>
          ) : doc.cronograma_preventivo.map((cr: CronogramaRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Atividade #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("cronograma_preventivo", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="md:col-span-2"><Label className="text-xs">Descricao da atividade</Label><Input className="mt-1" value={cr.atividade ?? ""} onChange={ev => setRow("cronograma_preventivo", i, { atividade: ev.target.value })} placeholder="ex.: Inspecao de extintores" /></div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={cr.tipo ?? "Inspecao"} onValueChange={v => setRow("cronograma_preventivo", i, { tipo: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inspecao">Inspecao</SelectItem>
                      <SelectItem value="Treinamento">Treinamento</SelectItem>
                      <SelectItem value="Campanha">Campanha de Saude</SelectItem>
                      <SelectItem value="Auditoria">Auditoria</SelectItem>
                      <SelectItem value="Manutencao">Manutencao Preventiva</SelectItem>
                      <SelectItem value="Monitoramento">Monitoramento Ambiental</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={cr.status ?? "Pendente"} onValueChange={v => setRow("cronograma_preventivo", i, { status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Programado">Programado</SelectItem>
                      <SelectItem value="Concluido">Concluido</SelectItem>
                      <SelectItem value="Atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Responsavel</Label><Input className="mt-1" value={cr.responsavel ?? ""} onChange={ev => setRow("cronograma_preventivo", i, { responsavel: ev.target.value })} placeholder="Nome ou cargo" /></div>
                <div><Label className="text-xs">Periodicidade</Label><Input className="mt-1" value={cr.periodicidade ?? ""} onChange={ev => setRow("cronograma_preventivo", i, { periodicidade: ev.target.value })} placeholder="ex.: Anual, Semestral, Mensal" /></div>
                <div><Label className="text-xs">Data de execucao</Label><Input type="date" className="mt-1" value={cr.dataExecucao ?? ""} onChange={ev => setRow("cronograma_preventivo", i, { dataExecucao: ev.target.value })} /></div>
                <div className="md:col-span-2"><Label className="text-xs">Observacoes</Label><Textarea rows={1} className="mt-1" value={cr.observacoes ?? ""} onChange={ev => setRow("cronograma_preventivo", i, { observacoes: ev.target.value })} /></div>
              </div>
            </div>
          ))}
        </section>

        {/* 8.12 Hierarquia de Controle */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Hierarquia de Controle</h2>
            <Button size="sm" variant="outline" onClick={() => addRow("hierarquia_controle", { risco: "", eliminacao: "", substituicao: "", engenharia: "", administrativo: "", epc: "", epi: "", responsavel: "", prazo: "", status: "Pendente" })} className="gap-1">
              <ListPlus size={14} /> Adicionar risco
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Para cada risco, defina as medidas na ordem: eliminacao - substituicao - controle de engenharia - controle administrativo - EPC - EPI.</p>
          {doc.hierarquia_controle.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum risco cadastrado.</p>
          ) : doc.hierarquia_controle.map((hr: HierarquiaRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Risco #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("hierarquia_controle", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="md:col-span-2"><Label className="text-xs">Risco / fator de risco</Label><Input className="mt-1" value={hr.risco ?? ""} onChange={ev => setRow("hierarquia_controle", i, { risco: ev.target.value })} placeholder="ex.: Ruido elevado, Agente quimico X" /></div>
                <div><Label className="text-xs">1. Eliminacao</Label><Input className="mt-1" value={hr.eliminacao ?? ""} onChange={ev => setRow("hierarquia_controle", i, { eliminacao: ev.target.value })} placeholder="ex.: Remocao da fonte" /></div>
                <div><Label className="text-xs">2. Substituicao</Label><Input className="mt-1" value={hr.substituicao ?? ""} onChange={ev => setRow("hierarquia_controle", i, { substituicao: ev.target.value })} placeholder="ex.: Substitucao por produto menos toxico" /></div>
                <div><Label className="text-xs">3. Controle de Engenharia</Label><Input className="mt-1" value={hr.engenharia ?? ""} onChange={ev => setRow("hierarquia_controle", i, { engenharia: ev.target.value })} placeholder="ex.: Enclausuramento, ventilacao" /></div>
                <div><Label className="text-xs">4. Controle Administrativo</Label><Input className="mt-1" value={hr.administrativo ?? ""} onChange={ev => setRow("hierarquia_controle", i, { administrativo: ev.target.value })} placeholder="ex.: Rodizio de funcoes, treinamento" /></div>
                <div><Label className="text-xs">5. EPC</Label><Input className="mt-1" value={hr.epc ?? ""} onChange={ev => setRow("hierarquia_controle", i, { epc: ev.target.value })} placeholder="ex.: Barreira acustica" /></div>
                <div><Label className="text-xs">6. EPI</Label><Input className="mt-1" value={hr.epi ?? ""} onChange={ev => setRow("hierarquia_controle", i, { epi: ev.target.value })} placeholder="ex.: Protetor auricular CA 12345" /></div>
                <div><Label className="text-xs">Responsavel</Label><Input className="mt-1" value={hr.responsavel ?? ""} onChange={ev => setRow("hierarquia_controle", i, { responsavel: ev.target.value })} placeholder="Nome / setor" /></div>
                <div><Label className="text-xs">Prazo de implantacao</Label><Input type="date" className="mt-1" value={hr.prazo ?? ""} onChange={ev => setRow("hierarquia_controle", i, { prazo: ev.target.value })} /></div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={hr.status ?? "Pendente"} onValueChange={v => setRow("hierarquia_controle", i, { status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em implantacao">Em implantacao</SelectItem>
                      <SelectItem value="Implantado">Implantado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* 8.15 Nao Conformidades */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Nao Conformidades</h2>
            <Button size="sm" variant="outline" onClick={() => addRow("nao_conformidades", { descricao: "", setor: "", dataIdentificacao: "", tipo: "Operacional", gravidade: "media", acaoCorretiva: "", responsavel: "", prazo: "", status: "Aberta" })} className="gap-1">
              <ListPlus size={14} /> Adicionar NC
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Desvios identificados, acoes corretivas, responsaveis e prazos de encerramento.</p>
          {doc.nao_conformidades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma nao conformidade cadastrada.</p>
          ) : doc.nao_conformidades.map((nc: NcRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">NC #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("nao_conformidades", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="md:col-span-2"><Label className="text-xs">Descricao do desvio</Label><Textarea rows={2} className="mt-1" value={nc.descricao ?? ""} onChange={ev => setRow("nao_conformidades", i, { descricao: ev.target.value })} placeholder="Descreva o desvio encontrado..." /></div>
                <div><Label className="text-xs">Setor</Label><Input className="mt-1" value={nc.setor ?? ""} onChange={ev => setRow("nao_conformidades", i, { setor: ev.target.value })} /></div>
                <div><Label className="text-xs">Data de identificacao</Label><Input type="date" className="mt-1" value={nc.dataIdentificacao ?? ""} onChange={ev => setRow("nao_conformidades", i, { dataIdentificacao: ev.target.value })} /></div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={nc.tipo ?? "Operacional"} onValueChange={v => setRow("nao_conformidades", i, { tipo: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Operacional">Operacional</SelectItem>
                      <SelectItem value="Documental">Documental</SelectItem>
                      <SelectItem value="Legal">Legal / Normativa</SelectItem>
                      <SelectItem value="EPI">EPI / EPC</SelectItem>
                      <SelectItem value="Treinamento">Treinamento</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Gravidade</Label>
                  <Select value={nc.gravidade ?? "media"} onValueChange={v => setRow("nao_conformidades", i, { gravidade: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Critica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label className="text-xs">Acao corretiva</Label><Textarea rows={2} className="mt-1" value={nc.acaoCorretiva ?? ""} onChange={ev => setRow("nao_conformidades", i, { acaoCorretiva: ev.target.value })} placeholder="Descreva a acao corretiva proposta..." /></div>
                <div><Label className="text-xs">Responsavel</Label><Input className="mt-1" value={nc.responsavel ?? ""} onChange={ev => setRow("nao_conformidades", i, { responsavel: ev.target.value })} /></div>
                <div><Label className="text-xs">Prazo</Label><Input type="date" className="mt-1" value={nc.prazo ?? ""} onChange={ev => setRow("nao_conformidades", i, { prazo: ev.target.value })} /></div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={nc.status ?? "Aberta"} onValueChange={v => setRow("nao_conformidades", i, { status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aberta">Aberta</SelectItem>
                      <SelectItem value="Em tratamento">Em tratamento</SelectItem>
                      <SelectItem value="Encerrada">Encerrada</SelectItem>
                      <SelectItem value="Reaberta">Reaberta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* 8.16 Treinamentos Obrigatorios por NR */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Treinamentos Obrigatorios por NR</h2>
            <Button size="sm" variant="outline" onClick={() => addRow("treinamentos_nr", { nr: "NR-01", treinamento: "", cargaHoraria: "", periodicidade: "Anual", publicoAlvo: "", dataRealizada: "", dataVencimento: "", responsavel: "", status: "Pendente" })} className="gap-1">
              <ListPlus size={14} /> Adicionar treinamento
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Controle de treinamentos obrigatorios por NR com vencimentos por colaborador / grupo.</p>
          {doc.treinamentos_nr.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum treinamento cadastrado.</p>
          ) : doc.treinamentos_nr.map((tr: TreinNrRow, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Treinamento #{i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => delRow("treinamentos_nr", i)}><X size={14} className="text-rose-600" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">NR aplicavel</Label>
                  <Select value={tr.nr ?? "NR-01"} onValueChange={v => setRow("treinamentos_nr", i, { nr: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["NR-01","NR-05","NR-06","NR-07","NR-09","NR-10","NR-11","NR-12","NR-13","NR-15","NR-16","NR-17","NR-18","NR-20","NR-23","NR-32","NR-33","NR-35","CIPA","Brigada de Incendio","Primeiros Socorros","Outro"].map(nr => (
                        <SelectItem key={nr} value={nr}>{nr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Nome do treinamento</Label><Input className="mt-1" value={tr.treinamento ?? ""} onChange={ev => setRow("treinamentos_nr", i, { treinamento: ev.target.value })} placeholder="ex.: Uso correto de EPI" /></div>
                <div><Label className="text-xs">Carga horaria (h)</Label><Input className="mt-1" value={tr.cargaHoraria ?? ""} onChange={ev => setRow("treinamentos_nr", i, { cargaHoraria: ev.target.value })} placeholder="ex.: 8" /></div>
                <div>
                  <Label className="text-xs">Periodicidade</Label>
                  <Select value={tr.periodicidade ?? "Anual"} onValueChange={v => setRow("treinamentos_nr", i, { periodicidade: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admissional">Admissional</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                      <SelectItem value="Bienal">Bienal (2 anos)</SelectItem>
                      <SelectItem value="Trienal">Trienal (3 anos)</SelectItem>
                      <SelectItem value="Unica vez">Unica vez</SelectItem>
                      <SelectItem value="Conforme necessidade">Conforme necessidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Publico-alvo</Label><Input className="mt-1" value={tr.publicoAlvo ?? ""} onChange={ev => setRow("treinamentos_nr", i, { publicoAlvo: ev.target.value })} placeholder="ex.: Todos os colaboradores, Operadores" /></div>
                <div><Label className="text-xs">Responsavel</Label><Input className="mt-1" value={tr.responsavel ?? ""} onChange={ev => setRow("treinamentos_nr", i, { responsavel: ev.target.value })} /></div>
                <div><Label className="text-xs">Data realizada</Label><Input type="date" className="mt-1" value={tr.dataRealizada ?? ""} onChange={ev => setRow("treinamentos_nr", i, { dataRealizada: ev.target.value })} /></div>
                <div><Label className="text-xs">Data de vencimento</Label><Input type="date" className="mt-1" value={tr.dataVencimento ?? ""} onChange={ev => setRow("treinamentos_nr", i, { dataVencimento: ev.target.value })} /></div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={tr.status ?? "Pendente"} onValueChange={v => setRow("treinamentos_nr", i, { status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Agendado">Agendado</SelectItem>
                      <SelectItem value="Concluido">Concluido</SelectItem>
                      <SelectItem value="Vencido">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
            <p className="text-xs text-muted-foreground">Vincule laudos, medicoes, fotos, LTCAT, PCA, PPR, APR e outros documentos tecnicos ao PGR.</p>
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
