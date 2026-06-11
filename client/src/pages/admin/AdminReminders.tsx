import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Send, Settings, CheckCircle2, Clock, Info, Megaphone } from "lucide-react";
import { Link } from "wouter";

export default function AdminReminders() {
  const settingsQuery = trpc.admin.getReminderSettings.useQuery();
  const logsQuery = trpc.admin.emailLogs.useQuery();

  const updateSettings = trpc.admin.updateReminderSettings.useMutation({
    onSuccess: () => { toast.success("Configurações salvas!"); settingsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const sendNow = trpc.admin.sendReminders.useMutation({
    onSuccess: (r) => { toast.success(`${r.sent} lembrete(s) enviado(s)!`); logsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [days, setDays] = useState(7);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (settingsQuery.data) {
      setDays(settingsQuery.data.inactiveDaysThreshold);
      setEnabled(settingsQuery.data.isEnabled);
    }
  }, [settingsQuery.data]);

  const logs = logsQuery.data ?? [];

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
          <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
            Lembretes de Inatividade
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Regra automática e recorrente: avisa colaboradores que ficaram sem acessar a plataforma.</p>
        </div>

        {/* Distinction from Campaigns */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex gap-3">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900/90 space-y-1">
            <p><strong>Quando usar esta aba:</strong> para manter o engajamento — um disparo automático para quem está há muitos dias sem entrar, independente de curso ou pesquisa.</p>
            <p className="flex items-center gap-1 flex-wrap">
              <span>Para cobrar um <strong>curso</strong> ou <strong>pesquisa específica</strong>, com filtros por filial/setor, preview e templates, use a aba</span>
              <Link href="/admin/campanhas" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2">
                <Megaphone size={13} /> Campanhas
              </Link>.
            </p>
          </div>
        </div>

        {/* Settings Card */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground">Configurações de Lembretes</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="days" className="text-sm">
                Dias sem acesso para disparar lembrete
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value) || 7)}
                  className="w-24 h-10"
                />
                <span className="text-sm text-muted-foreground">dias de inatividade</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Funcionários sem acesso há mais de {days} dias receberão um lembrete automático.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Status dos Lembretes</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-secondary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
                </button>
                <span className={`text-sm font-medium ${enabled ? "text-secondary" : "text-muted-foreground"}`}>
                  {enabled ? "Ativado" : "Desativado"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {enabled ? "Lembretes automáticos estão ativos." : "Lembretes automáticos estão pausados."}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => updateSettings.mutate({ inactiveDaysThreshold: days, isEnabled: enabled })}
              disabled={updateSettings.isPending}
              className="bg-primary text-primary-foreground"
            >
              {updateSettings.isPending ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</span>
              ) : "Salvar Configurações"}
            </Button>

            <Button
              variant="outline"
              onClick={() => sendNow.mutate()}
              disabled={sendNow.isPending}
              className="flex items-center gap-2"
            >
              {sendNow.isPending ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />Enviando...</span>
              ) : (
                <><Send size={14} /> Disparar Agora</>
              )}
            </Button>
          </div>
        </div>

        {/* Email Logs */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground">Histórico de Envios</h2>
          </div>

          {logsQuery.isLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum e-mail enviado ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Destinatário</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium text-foreground">{log.recipientEmail}</td>
                      <td className="px-5 py-3 text-muted-foreground capitalize">{log.type.replace('_', ' ')}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1"><Clock size={11} />{new Date(log.sentAt).toLocaleString("pt-BR")}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {log.success ? (
                          <span className="inline-flex items-center gap-1 text-xs text-secondary"><CheckCircle2 size={12} />Enviado</span>
                        ) : (
                          <span className="text-xs text-red-500">Falhou</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

