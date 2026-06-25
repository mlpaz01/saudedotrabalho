import { useState, useMemo, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail, Plus, BookOpen, ClipboardList, Send, ChevronRight, ChevronLeft,
  Users, Calendar, Eye, FileText, X, CheckCircle2, AlertCircle, Sparkles,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default function AdminCampaigns() {
  const [view, setView] = useState<"list" | "wizard" | "detail">("list");
  const [detailId, setDetailId] = useState<number | null>(null);

  const list = trpc.emailCampaigns.list.useQuery();

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-5">
        <div className="relative pl-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
            <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
              Campanhas de Email
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Envie lembretes para cobrar cursos pendentes ou pesquisas não respondidas.
            </p>
          </div>
          {view === "list" && (
            <Button onClick={() => setView("wizard")} className="bg-primary text-primary-foreground">
              <Plus size={16} className="mr-1" /> Nova campanha
            </Button>
          )}
          {view !== "list" && (
            <Button variant="outline" onClick={() => { setView("list"); setDetailId(null); }}>
              <ChevronLeft size={16} className="mr-1" /> Voltar
            </Button>
          )}
        </div>

        {view === "list" && (
          <CampaignList
            campaigns={list.data ?? []}
            loading={list.isLoading}
            onOpen={(id) => { setDetailId(id); setView("detail"); }}
          />
        )}
        {view === "wizard" && (
          <CampaignWizard onDone={() => { setView("list"); list.refetch(); }} />
        )}
        {view === "detail" && detailId && (
          <CampaignDetail campaignId={detailId} onRefetch={() => list.refetch()} />
        )}
      </div>
    </AppLayout>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LIST
// ────────────────────────────────────────────────────────────────────────────
function CampaignList({ campaigns, loading, onOpen }: any) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border p-10 text-center text-muted-foreground">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Carregando campanhas...
      </div>
    );
  }
  if (!campaigns.length) {
    return (
      <div className="bg-white rounded-xl border border-border p-10 text-center">
        <Mail size={32} className="mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-muted-foreground">Nenhuma campanha criada ainda.</p>
        <p className="text-xs text-muted-foreground mt-1">Clique em "Nova campanha" para começar.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
            <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
            <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Destinatários</th>
            <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Criada em</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c: any) => (
            <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition cursor-pointer" onClick={() => onOpen(c.id)}>
              <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
              <td className="px-5 py-3 text-muted-foreground">{labelType(c.campaignType)}</td>
              <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
              <td className="px-5 py-3 text-center text-muted-foreground">
                {c.sentCount}/{c.totalRecipients}
                {c.failedCount > 0 && <span className="text-rose-600 ml-1">({c.failedCount} falhas)</span>}
              </td>
              <td className="px-5 py-3 text-xs text-muted-foreground">{fmtDateTime(c.createdAt)}</td>
              <td className="px-5 py-3 text-right">
                <ChevronRight size={16} className="text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// WIZARD
// ────────────────────────────────────────────────────────────────────────────
function CampaignWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [campaignType, setCampaignType] = useState<"course_pending" | "survey_pending" | "custom">("course_pending");
  const [targetModuleId, setTargetModuleId] = useState<number | null>(null);
  const [targetSurveyId, setTargetSurveyId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [maxCompletionPercent, setMaxCompletionPercent] = useState<number>(100);
  // Bruno round 3: filtro por perfil — necessário pra AEP (só chefias) e similares
  const [targetRole, setTargetRole] = useState<"todos"|"colaborador"|"chefia"|"rh"|"sesmt"|"admin">("todos");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<"now" | "scheduled" | "recurring">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  const tree = trpc.lessons.hierarchyTree.useQuery();

  // Companies the current user can act on. RH sees only their own (1); Admin Global sees many.
  const companies = useMemo(
    () => (tree.data ?? []).map((c: any) => ({ id: c.company.id, name: c.company.name })),
    [tree.data]
  );
  const isMultiCompany = companies.length > 1;
  // Auto-select when the user manages a single company (RH); otherwise require a pick.
  useEffect(() => {
    if (companyId == null && companies.length === 1) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  const modules = trpc.emailCampaigns.getModules.useQuery(companyId ? { companyId } : undefined);
  const surveys = trpc.emailCampaigns.getSurveys.useQuery(companyId ? { companyId } : undefined);
  const templates = trpc.emailCampaigns.getTemplates.useQuery();

  const allBranches = useMemo(() => {
    const arr: { id: number; name: string }[] = [];
    for (const c of tree.data ?? []) {
      if (companyId && c.company.id !== companyId) continue;
      for (const b of c.branches) if (b.branch.id > 0) arr.push({ id: b.branch.id, name: b.branch.name });
    }
    return arr;
  }, [tree.data, companyId]);
  const allSectors = useMemo(() => {
    const arr: { id: number; name: string; branchId: number }[] = [];
    for (const c of tree.data ?? []) {
      if (companyId && c.company.id !== companyId) continue;
      for (const b of c.branches) for (const s of b.sectors)
        if (s.sector.id > 0) arr.push({ id: s.sector.id, name: s.sector.name, branchId: b.branch.id });
    }
    return arr;
  }, [tree.data, companyId]);
  const sectorsForBranch = branchId ? allSectors.filter((s) => s.branchId === branchId) : allSectors;

  const previewQuery = trpc.emailCampaigns.previewRecipients.useQuery(
    {
      campaignType: campaignType as "course_pending" | "survey_pending",
      companyId: companyId ?? undefined,
      targetModuleId: targetModuleId ?? undefined,
      targetSurveyId: targetSurveyId ?? undefined,
      branchId,
      sectorId,
      maxCompletionPercent,
      targetRole,
    },
    { enabled: step >= 4 && campaignType !== "custom" && (targetModuleId !== null || targetSurveyId !== null) }
  );

  const createMut = trpc.emailCampaigns.create.useMutation();
  const sendMut = trpc.emailCampaigns.send.useMutation();

  function loadTemplate(key: string) {
    setTemplateKey(key);
    const t = (templates.data ?? []).find((x: any) => x.key === key);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  function canAdvance(): boolean {
    if (step === 1) return !!campaignType && (!isMultiCompany || companyId != null);
    if (step === 2) {
      if (campaignType === "course_pending") return targetModuleId !== null;
      if (campaignType === "survey_pending") return targetSurveyId !== null;
      return true;
    }
    if (step === 5) return !!subject && !!body;
    return true;
  }

  async function handleCreateAndSend() {
    if (!name.trim()) {
      toast.error("Defina um nome interno para a campanha");
      return;
    }
    try {
      const r = await createMut.mutateAsync({
        name,
        companyId: companyId ?? undefined,
        campaignType,
        targetModuleId,
        targetSurveyId,
        branchId,
        sectorId,
        maxCompletionPercent,
        targetRole,
        emailSubject: subject,
        emailBody: body,
        scheduleType,
        scheduledAt: scheduleType === "scheduled" && scheduledAt ? scheduledAt : null,
      });
      toast.success(`Campanha criada com ${r.recipientCount} destinatário(s)`);
      if (scheduleType === "now") {
        const sendR = await sendMut.mutateAsync({ campaignId: r.id });
        if (sendR.preview) {
          toast.info(`Modo PREVIEW: ${sendR.sent} email(s) registrados em log (SMTP não configurado).`);
        } else {
          toast.success(`Enviadas: ${sendR.sent}, Falhas: ${sendR.failed}`);
        }
      } else {
        toast.info(`Campanha agendada (envio manual ou cron pendente).`);
      }
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar campanha");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <Stepper step={step} />
      <div className="p-6 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-4">
            {isMultiCompany && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Users size={16} /> Empresa da campanha
                </label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Você administra mais de uma empresa. Selecione para qual empresa esta campanha será enviada.
                </p>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white"
                  value={companyId ?? ""}
                  onChange={(e) => {
                    setCompanyId(e.target.value ? Number(e.target.value) : null);
                    setTargetModuleId(null);
                    setTargetSurveyId(null);
                    setBranchId(null);
                    setSectorId(null);
                  }}
                >
                  <option value="">Selecione uma empresa...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <h2 className="text-lg font-semibold text-foreground">Que tipo de campanha você quer enviar?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TypeCard
                icon={<BookOpen size={28} />}
                title="Cobrar curso pendente"
                desc="Lembre colaboradores que ainda não concluíram um curso obrigatório."
                active={campaignType === "course_pending"}
                onClick={() => setCampaignType("course_pending")}
              />
              <TypeCard
                icon={<ClipboardList size={28} />}
                title="Cobrar pesquisa pendente"
                desc="Convide quem ainda não respondeu uma pesquisa específica."
                active={campaignType === "survey_pending"}
                onClick={() => setCampaignType("survey_pending")}
              />
              <TypeCard
                icon={<Sparkles size={28} />}
                title="Mensagem personalizada"
                desc="Crie um aviso livre para todos os colaboradores da empresa."
                active={campaignType === "custom"}
                onClick={() => setCampaignType("custom")}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {campaignType === "course_pending" ? "Qual curso?" : campaignType === "survey_pending" ? "Qual pesquisa?" : "Sem alvo específico"}
            </h2>
            {campaignType === "course_pending" && (
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm"
                value={targetModuleId ?? ""}
                onChange={(e) => setTargetModuleId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione um curso...</option>
                {(modules.data ?? []).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            )}
            {campaignType === "survey_pending" && (
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm"
                value={targetSurveyId ?? ""}
                onChange={(e) => setTargetSurveyId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione uma pesquisa...</option>
                {(surveys.data ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.title} ({s.status})</option>
                ))}
              </select>
            )}
            {campaignType === "custom" && (
              <p className="text-sm text-muted-foreground">Esta campanha será enviada para todos os colaboradores que passarem nos filtros do próximo passo.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Filtros de público</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Filial</label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1"
                  value={branchId ?? ""}
                  onChange={(e) => { setBranchId(e.target.value ? Number(e.target.value) : null); setSectorId(null); }}
                >
                  <option value="">Todas</option>
                  {allBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Setor</label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1"
                  value={sectorId ?? ""}
                  onChange={(e) => setSectorId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Todos</option>
                  {sectorsForBranch.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {/* Bruno round 3: filtro Perfil — essencial pra AEP (chefias) e similares */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Perfil</label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as any)}
                >
                  <option value="todos">Todos</option>
                  <option value="colaborador">Colaborador</option>
                  <option value="chefia">Chefia / Liderança</option>
                  <option value="rh">RH</option>
                  <option value="sesmt">SESMT</option>
                  <option value="admin">Administrador</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Use <b>Chefia / Liderança</b> para enviar pesquisas como AEP só pra lideranças.
                </p>
              </div>
              {campaignType === "course_pending" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">% máx. já assistido</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={maxCompletionPercent}
                    onChange={(e) => setMaxCompletionPercent(Number(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Apenas quem assistiu menos que este % será incluído.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Eye size={18} /> Pré-visualização dos destinatários
            </h2>
            {campaignType === "custom" ? (
              <p className="text-sm text-muted-foreground">Mensagem personalizada não usa pré-visualização — todos os colaboradores que passarem nos filtros receberão.</p>
            ) : previewQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Calculando...</div>
            ) : (
              <>
                <div className="bg-primary/5 border border-primary/20 rounded-md px-4 py-3 text-sm">
                  <strong className="text-primary">{(previewQuery.data ?? []).length}</strong> destinatário(s) receberão a campanha.
                </div>
                <div className="max-h-80 overflow-y-auto border border-border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Nome</th>
                        <th className="text-left px-3 py-2">Email</th>
                        <th className="text-right px-3 py-2">% assistido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewQuery.data ?? []).map((r: any) => (
                        <tr key={r.userId} className="border-t border-border">
                          <td className="px-3 py-1.5">{r.name || "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.email}</td>
                          <td className="px-3 py-1.5 text-right">{r.percentWatched != null ? Math.round(r.percentWatched) + "%" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText size={18} /> Modelo e conteúdo
            </h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Escolha um modelo</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {(templates.data ?? []).map((t: any) => (
                  <button
                    key={t.key}
                    onClick={() => loadTemplate(t.key)}
                    className={`text-left border rounded-md px-3 py-2 text-sm transition ${templateKey === t.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Assunto</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" placeholder="Assunto do email" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Corpo do email</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 font-mono"
                placeholder="Conteúdo do email..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis: <code>{"{{name}}"}</code>, <code>{"{{course_title}}"}</code>, <code>{"{{survey_title}}"}</code>, <code>{"{{link}}"}</code>
              </p>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar size={18} /> Agendamento
            </h2>
            <div className="space-y-3">
              <Radio name="schedule" value="now" current={scheduleType} onChange={setScheduleType as any} label="Enviar agora" desc="Os emails serão disparados imediatamente após confirmar." />
              <Radio name="schedule" value="scheduled" current={scheduleType} onChange={setScheduleType as any} label="Agendar para data específica" desc="A campanha ficará em fila até a data informada." />
              {scheduleType === "scheduled" && (
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="max-w-xs" />
              )}
              <Radio name="schedule" value="recurring" current={scheduleType} onChange={setScheduleType as any} label="Recorrente (em breve)" desc="Configuração de cron será adicionada em versão futura." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome interno da campanha (para sua referência)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Ex: Lembrete NR-1 - junho/2026" />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Send size={18} /> Confirmar e enviar
            </h2>
            <div className="bg-muted/20 rounded-md p-4 space-y-2 text-sm">
              <div><strong>Nome:</strong> {name || <span className="text-muted-foreground">(sem nome)</span>}</div>
              <div><strong>Tipo:</strong> {labelType(campaignType)}</div>
              {campaignType === "course_pending" && (
                <div><strong>Curso alvo:</strong> {(modules.data ?? []).find((m: any) => m.id === targetModuleId)?.title ?? "—"}</div>
              )}
              {campaignType === "survey_pending" && (
                <div><strong>Pesquisa alvo:</strong> {(surveys.data ?? []).find((s: any) => s.id === targetSurveyId)?.title ?? "—"}</div>
              )}
              <div><strong>Destinatários estimados:</strong> {(previewQuery.data ?? []).length}</div>
              <div><strong>Assunto:</strong> {subject}</div>
              <div><strong>Agendamento:</strong> {scheduleType === "now" ? "Imediato" : scheduleType === "scheduled" ? `Em ${scheduledAt || "(sem data)"}` : "Recorrente"}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5" />
              <span>Se o SMTP não estiver configurado no .env, a campanha rodará em "modo preview": os emails são registrados em log mas não enviados.</span>
            </div>
            <Button
              onClick={handleCreateAndSend}
              disabled={createMut.isPending || sendMut.isPending}
              className="bg-primary text-primary-foreground"
            >
              {createMut.isPending || sendMut.isPending ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processando...</span>
              ) : (
                <><Send size={16} className="mr-1" /> {scheduleType === "now" ? "Criar e enviar agora" : "Criar campanha"}</>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-muted/20">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => (s - 1) as Step)}>
          <ChevronLeft size={14} className="mr-1" /> Voltar
        </Button>
        {step < 7 && (
          <Button
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={!canAdvance()}
            className="bg-primary text-primary-foreground"
          >
            Próximo <ChevronRight size={14} className="ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Tipo", "Alvo", "Filtros", "Preview", "Conteúdo", "Agendar", "Confirmar"];
  return (
    <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-primary/5 to-transparent">
      <div className="flex items-center gap-2 overflow-x-auto">
        {labels.map((l, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={l} className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {done ? <CheckCircle2 size={14} /> : n}
              </div>
              <span className={`text-xs ${active ? "font-semibold text-primary" : "text-muted-foreground"}`}>{l}</span>
              {i < labels.length - 1 && <div className="w-6 h-px bg-border" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypeCard({ icon, title, desc, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`text-left border-2 rounded-xl p-5 transition ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
    >
      <div className={`${active ? "text-primary" : "text-muted-foreground"} mb-2`}>{icon}</div>
      <div className="font-semibold text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}

function Radio({ name, value, current, onChange, label, desc }: any) {
  return (
    <label className={`flex items-start gap-3 border rounded-md px-3 py-2 cursor-pointer transition ${current === value ? "border-primary bg-primary/5" : "border-border"}`}>
      <input
        type="radio"
        name={name}
        checked={current === value}
        onChange={() => onChange(value)}
        className="mt-1"
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DETAIL
// ────────────────────────────────────────────────────────────────────────────
function CampaignDetail({ campaignId, onRefetch }: { campaignId: number; onRefetch: () => void }) {
  const q = trpc.emailCampaigns.get.useQuery({ id: campaignId });
  const sendMut = trpc.emailCampaigns.send.useMutation();

  async function handleSendAgain() {
    try {
      const r = await sendMut.mutateAsync({ campaignId });
      if (r.preview) {
        toast.info(`Modo PREVIEW: ${r.sent} email(s) registrados em log.`);
      } else {
        toast.success(`Enviadas: ${r.sent}, Falhas: ${r.failed}`);
      }
      q.refetch();
      onRefetch();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  }

  if (q.isLoading) return <div className="bg-white rounded-xl border border-border p-10 text-center text-muted-foreground">Carregando...</div>;
  if (!q.data) return null;
  const { campaign, recipients } = q.data;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{campaign.name}</h2>
            <div className="text-sm text-muted-foreground mt-1">
              {labelType(campaign.campaignType)} · Criada em {fmtDateTime(campaign.createdAt)}
            </div>
            <div className="mt-2"><StatusBadge status={campaign.status} /></div>
          </div>
          <Button onClick={handleSendAgain} disabled={sendMut.isPending} className="bg-primary text-primary-foreground">
            <Send size={14} className="mr-1" /> {sendMut.isPending ? "Enviando..." : campaign.status === "sent" ? "Reenviar pendentes" : "Enviar agora"}
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatBox label="Total destinatários" value={campaign.totalRecipients} icon={<Users size={16} />} />
          <StatBox label="Enviados" value={campaign.sentCount} icon={<CheckCircle2 size={16} />} color="text-emerald-600" />
          <StatBox label="Falhas" value={campaign.failedCount} icon={<AlertCircle size={16} />} color="text-rose-600" />
        </div>
        <div className="mt-4 bg-muted/20 rounded-md p-3">
          <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Assunto</div>
          <div className="text-sm">{campaign.emailSubject}</div>
          <div className="text-xs font-medium text-muted-foreground uppercase mb-1 mt-3">Corpo</div>
          <pre className="text-sm whitespace-pre-wrap font-sans">{campaign.emailBody}</pre>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/20">
          <h3 className="font-semibold text-foreground">Destinatários ({recipients.length})</h3>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="text-left px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">Nome</th>
                <th className="text-left px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="text-left px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-left px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">Enviado em</th>
                <th className="text-left px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">Erro</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-5 py-1.5">{r.name || "—"}</td>
                  <td className="px-5 py-1.5 text-muted-foreground">{r.email}</td>
                  <td className="px-5 py-1.5"><StatusBadge status={r.status} small /></td>
                  <td className="px-5 py-1.5 text-xs text-muted-foreground">{r.sentAt ? fmtDateTime(r.sentAt) : "—"}</td>
                  <td className="px-5 py-1.5 text-xs text-rose-600 max-w-xs truncate">{r.error || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon, color = "text-primary" }: any) {
  return (
    <div className="bg-muted/30 rounded-md p-3 flex items-center gap-3">
      <div className={color}>{icon}</div>
      <div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status, small = false }: { status: string; small?: boolean }) {
  const cfg: Record<string, { color: string; label: string }> = {
    draft: { color: "bg-slate-100 text-slate-700", label: "Rascunho" },
    queued: { color: "bg-amber-100 text-amber-700", label: "Em fila" },
    sending: { color: "bg-blue-100 text-blue-700", label: "Enviando" },
    sent: { color: "bg-emerald-100 text-emerald-700", label: "Enviado" },
    failed: { color: "bg-rose-100 text-rose-700", label: "Falhou" },
    pending: { color: "bg-slate-100 text-slate-700", label: "Pendente" },
    preview_sent: { color: "bg-amber-100 text-amber-700", label: "Preview" },
  };
  const c = cfg[status] ?? { color: "bg-slate-100 text-slate-700", label: status };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded ${small ? "text-[10px]" : "text-xs"} font-medium ${c.color}`}>{c.label}</span>;
}

function labelType(t: string) {
  if (t === "course_pending") return "Cobrança de curso";
  if (t === "survey_pending") return "Cobrança de pesquisa";
  if (t === "custom") return "Personalizada";
  return t;
}

function fmtDateTime(v: any) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("pt-BR"); } catch { return "—"; }
}

