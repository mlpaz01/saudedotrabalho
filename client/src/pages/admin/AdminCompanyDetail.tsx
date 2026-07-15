import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, MapPin, Layers, Users, Plus, Trash2, ArrowLeft, Settings, Save, MessageSquare, Send } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function AdminCompanyDetail() {
  const params = useParams<{ id: string }>();
  const companyId = parseInt(params.id ?? "0");

  const { data: company } = trpc.companies.get.useQuery({ id: companyId });
  const { data: branches, refetch: refetchBranches } = trpc.companies.branches.useQuery({ companyId });
  const { data: sectors, refetch: refetchSectors } = trpc.companies.sectors.useQuery({ companyId });
  const { data: employees } = trpc.companies.usersByCompany.useQuery({ companyId });
  const { data: engagement } = trpc.companies.sectorEngagement.useQuery({ companyId });
  const { data: templateLibrary } = trpc.templateLibrary.list.useQuery({ companyId, includeCompanySurveys: true } as any);
  const platformConfigQ = (trpc.companies as any).getPlatformConfig.useQuery({ companyId });
  const commTemplatesQ = (trpc.companies as any).listCommunicationTemplates.useQuery({ companyId });

  const createBranch = trpc.companies.createBranch.useMutation({ onSuccess: () => { refetchBranches(); } });
  const deleteBranch = trpc.companies.deleteBranch.useMutation({ onSuccess: () => { refetchBranches(); } });
  const createSector = trpc.companies.createSector.useMutation({ onSuccess: () => { refetchSectors(); } });
  const deleteSector = trpc.companies.deleteSector.useMutation({ onSuccess: () => { refetchSectors(); } });
  const updatePlatformConfig = (trpc.companies as any).updatePlatformConfig.useMutation({
    onSuccess: () => { toast.success("Configurações salvas."); platformConfigQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar configurações."),
  });
  const upsertCommTemplate = (trpc.companies as any).upsertCommunicationTemplate.useMutation({
    onSuccess: () => { toast.success("Template de mensagem salvo."); commTemplatesQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar template."),
  });
  const sendCommTest = (trpc.companies as any).sendCommunicationTemplateTest.useMutation({
    onSuccess: (r: any) => toast.success(r?.preview ? "Simulação registrada em modo preview." : "Mensagem de teste enviada."),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar teste."),
  });

  const [branchForm, setBranchForm] = useState({ name: "", city: "", state: "" });
  const [sectorForm, setSectorForm] = useState({ name: "", branchId: "" });
  const [branchOpen, setBranchOpen] = useState(false);
  const [sectorOpen, setSectorOpen] = useState(false);
  const [configForm, setConfigForm] = useState({
    drpsTemplateId: "",
    aepTemplateId: "",
    accessMethod: "email",
    communicationChannel: "email",
    requireWhatsappOnFirstAccess: false,
  });
  const [selectedMessageKey, setSelectedMessageKey] = useState("welcome");
  const [messageForm, setMessageForm] = useState({ title: "", body: "", isActive: true });
  const [testPhone, setTestPhone] = useState("21970364911");

  useEffect(() => {
    const cfg = platformConfigQ.data as any;
    if (!cfg) return;
    setConfigForm({
      drpsTemplateId: cfg.drpsTemplateId ? String(cfg.drpsTemplateId) : "",
      aepTemplateId: cfg.aepTemplateId ? String(cfg.aepTemplateId) : "",
      accessMethod: cfg.accessMethod ?? "email",
      communicationChannel: cfg.communicationChannel ?? "email",
      requireWhatsappOnFirstAccess: !!cfg.requireWhatsappOnFirstAccess,
    });
  }, [platformConfigQ.data]);

  const surveyTemplates = ((templateLibrary as any)?.surveys ?? []) as any[];
  const drpsTemplates = surveyTemplates.filter((s) => s.category === "psicossocial");
  const aepTemplates = surveyTemplates.filter((s) => s.category === "aep");
  const commTemplates = ((commTemplatesQ.data ?? []) as any[]);
  const selectedMessage = commTemplates.find((t: any) => t.eventKey === selectedMessageKey) ?? commTemplates[0];

  useEffect(() => {
    if (!selectedMessage) return;
    setSelectedMessageKey(selectedMessage.eventKey);
    setMessageForm({
      title: selectedMessage.title ?? "",
      body: selectedMessage.body ?? "",
      isActive: selectedMessage.isActive !== false,
    });
  }, [selectedMessage?.eventKey, selectedMessage?.title, selectedMessage?.body, selectedMessage?.isActive]);

  const getEngagementColor = (pct: number) => {
    if (pct >= 90) return "#22c55e";
    if (pct >= 70) return "#f59e0b";
    if (pct >= 50) return "#f97316";
    return "#ef4444";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/admin/empresas">
        <Button variant="ghost" size="sm" className="gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> Voltar</Button>
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">{company?.name}</h1>
          {company?.cnpj && <p className="text-sm text-muted-foreground">CNPJ: {company.cnpj}</p>}
        </div>
      </div>

      <Tabs defaultValue="estrutura">
        <TabsList className="mb-4">
          <TabsTrigger value="estrutura">Estrutura</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionários ({(employees ?? []).length})</TabsTrigger>
          <TabsTrigger value="engajamento">Engajamento</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        {/* TAB: ESTRUTURA */}
        <TabsContent value="estrutura">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Filiais */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Filiais
                  </CardTitle>
                  <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1"><Plus className="w-3 h-3" /> Adicionar</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Nova Filial</DialogTitle></DialogHeader>
                      <div className="space-y-3 mt-2">
                        <div><Label>Nome *</Label><Input value={branchForm.name} onChange={e => setBranchForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Matriz, Filial Norte" /></div>
                        <div><Label>Cidade</Label><Input value={branchForm.city} onChange={e => setBranchForm(f => ({...f, city: e.target.value}))} /></div>
                        <div><Label>Estado (UF)</Label><Input value={branchForm.state} onChange={e => setBranchForm(f => ({...f, state: e.target.value}))} maxLength={2} placeholder="SP" /></div>
                        <Button className="w-full" onClick={async () => { await createBranch.mutateAsync({ companyId, ...branchForm }); setBranchForm({name:"",city:"",state:""}); setBranchOpen(false); }}>Criar Filial</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(branches ?? []).map(b => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <div className="font-medium text-sm">{b.name}</div>
                        {b.city && <div className="text-xs text-muted-foreground">{b.city}{b.state ? ` — ${b.state}` : ''}</div>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteBranch.mutateAsync({ id: b.id })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {(branches ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma filial cadastrada</p>}
                </div>
              </CardContent>
            </Card>

            {/* Setores */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Setores
                  </CardTitle>
                  <Dialog open={sectorOpen} onOpenChange={setSectorOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1"><Plus className="w-3 h-3" /> Adicionar</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Novo Setor</DialogTitle></DialogHeader>
                      <div className="space-y-3 mt-2">
                        <div><Label>Nome do Setor *</Label><Input value={sectorForm.name} onChange={e => setSectorForm(f => ({...f, name: e.target.value}))} placeholder="Ex: RH, Comercial, TI" /></div>
                        <div><Label>Filial (opcional)</Label>
                          <Select value={sectorForm.branchId} onValueChange={v => setSectorForm(f => ({...f, branchId: v}))}>
                            <SelectTrigger><SelectValue placeholder="Todas as filiais" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Todas as filiais</SelectItem>
                              {(branches ?? []).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button className="w-full" onClick={async () => { await createSector.mutateAsync({ companyId, branchId: sectorForm.branchId ? parseInt(sectorForm.branchId) : undefined, name: sectorForm.name }); setSectorForm({name:"",branchId:""}); setSectorOpen(false); }}>Criar Setor</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(sectors ?? []).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <div className="font-medium text-sm">{s.name}</div>
                        {s.branchId && <div className="text-xs text-muted-foreground">{(branches ?? []).find(b => b.id === s.branchId)?.name}</div>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSector.mutateAsync({ id: s.id })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {(sectors ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum setor cadastrado</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: FUNCIONÁRIOS */}
        <TabsContent value="funcionarios">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Nome</th>
                      <th className="text-left p-2 font-semibold">E-mail</th>
                      <th className="text-left p-2 font-semibold">Setor</th>
                      <th className="text-left p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(employees ?? []).map((e, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2">{e.employeeName ?? "—"}</td>
                        <td className="p-2 text-muted-foreground">{e.email}</td>
                        <td className="p-2">{e.sector ?? "—"}</td>
                        <td className="p-2">
                          <Badge variant={e.hasSetPassword ? "default" : "secondary"} className="text-xs">
                            {e.hasSetPassword ? "Ativo" : "Pendente"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(employees ?? []).length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum funcionário importado</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: ENGAJAMENTO */}
        <TabsContent value="engajamento">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(engagement ?? []).map((e, i) => {
              const pct = e.total > 0 ? Math.round((Number(e.completed) / Number(e.total)) * 100) : 0;
              const color = getEngagementColor(pct);
              return (
                <Card key={i} style={{ borderTop: `3px solid ${color}` }}>
                  <CardContent className="p-4 text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{e.sector ?? "Sem setor"}</div>
                    <div className="text-2xl font-bold" style={{ color }}>{pct}%</div>
                    <div className="text-xs text-muted-foreground mt-1">{e.active}/{e.total} ativos</div>
                  </CardContent>
                </Card>
              );
            })}
            {(engagement ?? []).length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">Sem dados de engajamento ainda</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="configuracoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4" /> Templates, acesso e comunicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Template DRPS padrão</Label>
                  <Select value={configForm.drpsTemplateId || "__none__"} onValueChange={(v) => setConfigForm((f) => ({ ...f, drpsTemplateId: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Usar seleção manual" /></SelectTrigger>
                    <SelectContent className="max-w-[90vw]">
                      <SelectItem value="__none__">Sem padrão definido</SelectItem>
                      {drpsTemplates.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)} className="whitespace-normal">
                          {t.title} {t.source === "company" ? "(empresa)" : "(plataforma)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Template AEP padrão</Label>
                  <Select value={configForm.aepTemplateId || "__none__"} onValueChange={(v) => setConfigForm((f) => ({ ...f, aepTemplateId: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Usar seleção manual" /></SelectTrigger>
                    <SelectContent className="max-w-[90vw]">
                      <SelectItem value="__none__">Sem padrão definido</SelectItem>
                      {aepTemplates.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)} className="whitespace-normal">
                          {t.title} {t.source === "company" ? "(empresa)" : "(plataforma)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Método de acesso</Label>
                  <Select value={configForm.accessMethod} onValueChange={(v) => setConfigForm((f) => ({ ...f, accessMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Login por e-mail</SelectItem>
                      <SelectItem value="cpf">Login por CPF</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp como principal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Canal de comunicação</Label>
                  <Select value={configForm.communicationChannel} onValueChange={(v) => setConfigForm((f) => ({ ...f, communicationChannel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="both">E-mail + WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm mt-6">
                  <input
                    type="checkbox"
                    checked={configForm.requireWhatsappOnFirstAccess}
                    onChange={(e) => setConfigForm((f) => ({ ...f, requireWhatsappOnFirstAccess: e.target.checked }))}
                  />
                  Exigir WhatsApp no primeiro acesso
                </label>
              </div>

              <div className="flex justify-end">
                <Button
                  className="gap-2"
                  disabled={updatePlatformConfig.isPending}
                  onClick={() => updatePlatformConfig.mutate({
                    companyId,
                    drpsTemplateId: configForm.drpsTemplateId ? Number(configForm.drpsTemplateId) : null,
                    aepTemplateId: configForm.aepTemplateId ? Number(configForm.aepTemplateId) : null,
                    accessMethod: configForm.accessMethod,
                    communicationChannel: configForm.communicationChannel,
                    requireWhatsappOnFirstAccess: configForm.requireWhatsappOnFirstAccess,
                  })}
                >
                  <Save className="w-4 h-4" /> Salvar configurações
                </Button>
              </div>

              <div className="border rounded-xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-700" /> Templates de WhatsApp
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Padronize textos por empresa. Variaveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{titulo}}"} e {"{{link}}"}.
                    </p>
                  </div>
                  {selectedMessage?.source === "company" ? (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300">Personalizado</Badge>
                  ) : (
                    <Badge variant="outline">Padrao da plataforma</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Evento</Label>
                    <Select value={selectedMessageKey} onValueChange={setSelectedMessageKey}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {commTemplates.map((t: any) => (
                          <SelectItem key={t.eventKey} value={t.eventKey}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Titulo interno</Label>
                    <Input value={messageForm.title} onChange={(e) => setMessageForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <Label>Texto da mensagem</Label>
                  <Textarea rows={5} value={messageForm.body} onChange={(e) => setMessageForm((f) => ({ ...f, body: e.target.value }))} />
                </div>

                {selectedMessage?.preview && (
                  <div className="rounded-lg border bg-white p-3 text-xs text-slate-700">
                    <div className="font-semibold mb-1">Previa com dados simulados</div>
                    <div className="whitespace-pre-wrap">{selectedMessage.preview}</div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <Label>WhatsApp para teste</Label>
                    <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="(21) 97036-4911" />
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={sendCommTest.isPending || !selectedMessageKey}
                    onClick={() => sendCommTest.mutate({ companyId, eventKey: selectedMessageKey, phone: testPhone })}
                  >
                    <Send className="w-4 h-4" /> Enviar teste
                  </Button>
                  <Button
                    className="gap-2"
                    disabled={upsertCommTemplate.isPending || !selectedMessageKey || !messageForm.body.trim()}
                    onClick={() => upsertCommTemplate.mutate({
                      companyId,
                      eventKey: selectedMessageKey,
                      title: messageForm.title || selectedMessage?.title || selectedMessageKey,
                      body: messageForm.body,
                      isActive: messageForm.isActive,
                    })}
                  >
                    <Save className="w-4 h-4" /> Salvar texto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
