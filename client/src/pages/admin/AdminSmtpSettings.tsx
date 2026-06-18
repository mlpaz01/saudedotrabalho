import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, Server, ShieldCheck, Send, Save, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export default function AdminSmtpSettings() {
  const utils = trpc.useUtils();
  const cfgQ = trpc.companySmtp.get.useQuery({});

  const [host, setHost] = useState("");
  const [port, setPort] = useState<number>(465);
  const [secure, setSecure] = useState(true);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState("");
  const [fromName, setFromName] = useState("");
  const [rejectUnauthorized, setRejectUnauthorized] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [secureTouched, setSecureTouched] = useState(false);

  // Pre-fill from companySmtp.get on mount / when data arrives
  useEffect(() => {
    const d: any = cfgQ.data;
    if (!d) return;
    setHost(d.host ?? "");
    setPort(d.port ?? 465);
    setSecure(d.secure ?? true);
    setUser(d.user ?? "");
    setFrom(d.from ?? "");
    setFromName(d.fromName ?? "");
    setRejectUnauthorized(d.rejectUnauthorized ?? true);
    setIsActive(d.isActive ?? true);
    setHasPassword(!!d.hasPassword);
    setPass("");
    setSecureTouched(false);
  }, [cfgQ.data]);

  // Auto-suggest secure based on port (until the user manually toggles it)
  function onPortChange(v: number) {
    setPort(v);
    if (!secureTouched) {
      if (v === 465) setSecure(true);
      else if (v === 587 || v === 25 || v === 2525) setSecure(false);
    }
  }

  const saveMut = trpc.companySmtp.save.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva");
      setPass("");
      utils.companySmtp.get.invalidate();
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const testMut = trpc.companySmtp.test.useMutation({
    onSuccess: (r: any) => {
      if (r.ok) toast.success("Conexão validada com sucesso");
      else toast.error("Falha na conexão: " + (r.error || "erro desconhecido"));
      utils.companySmtp.get.invalidate();
    },
    onError: (e) => toast.error(e.message || "Erro ao testar"),
  });

  const sendTestMut = trpc.companySmtp.sendTestEmail.useMutation({
    onSuccess: () => toast.success("E-mail de teste enviado"),
    onError: (e) => toast.error(e.message || "Erro ao enviar e-mail de teste"),
  });

  function handleSave() {
    if (!host.trim()) { toast.error("Informe o servidor SMTP"); return; }
    if (!user.trim()) { toast.error("Informe o usuário/e-mail"); return; }
    if (!from.trim()) { toast.error("Informe o e-mail remetente"); return; }
    if (!hasPassword && !pass.trim()) { toast.error("Informe a senha do e-mail"); return; }
    saveMut.mutate({
      host: host.trim(),
      port: Number(port),
      secure,
      user: user.trim(),
      pass: pass.trim() ? pass : undefined,
      from: from.trim(),
      fromName: fromName.trim() || undefined,
      rejectUnauthorized,
      isActive,
    });
  }

  function handleSendTest() {
    const to = window.prompt("Enviar e-mail de teste para qual endereço?", from || user || "");
    if (!to || !to.trim()) return;
    sendTestMut.mutate({ to: to.trim() });
  }

  const d: any = cfgQ.data;
  const lastTestOk = d?.lastTestOk;
  const lastTestError = d?.lastTestError;
  const lastTestAt = d?.lastTestAt;

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition";
  const labelCls = "block text-sm font-medium text-foreground mb-1.5";
  const hintCls = "text-xs text-muted-foreground mt-1";

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <Mail size={26} /> E-mail / SMTP
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure o servidor de e-mail da SUA empresa. As campanhas serão enviadas a partir desta conta,
            garantindo que seus colaboradores recebam mensagens do remetente oficial da empresa.
          </p>
        </div>

        {/* Status banner */}
        {!cfgQ.isLoading && (lastTestOk || lastTestError) && (
          <div
            className={
              "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm " +
              (lastTestOk
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800")
            }
          >
            {lastTestOk ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
            <div>
              <div className="font-semibold">{lastTestOk ? "Conexão validada" : "Falha na última verificação"}</div>
              {lastTestOk
                ? <div className="text-xs opacity-80">{lastTestAt ? "Último teste: " + new Date(lastTestAt).toLocaleString("pt-BR") : ""}</div>
                : <div className="text-xs opacity-90">{lastTestError}</div>}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info size={18} className="mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            Use as credenciais SMTP fornecidas pelo seu provedor de e-mail (ex.: Google Workspace, Microsoft 365,
            Zoho, ou a hospedagem do seu domínio). Em geral a porta <strong>465</strong> usa SSL e a porta{" "}
            <strong>587</strong> usa TLS (STARTTLS).
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-5">
          {cfgQ.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="animate-spin mr-2" size={18} /> Carregando configuração...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border pb-3">
                <Server size={16} className="text-primary" /> Servidor de envio
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Servidor SMTP (host)</label>
                  <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.suaempresa.com.br" />
                </div>
                <div>
                  <label className={labelCls}>Porta</label>
                  <input className={inputCls} type="number" value={port} onChange={(e) => onPortChange(Number(e.target.value))} placeholder="465" />
                  <div className={hintCls}>465 (SSL) ou 587 (TLS)</div>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-foreground">Conexão segura (SSL/TLS direto)</div>
                  <div className="text-xs text-muted-foreground">Ative para a porta 465 (SSL). Para 587 (STARTTLS), deixe desativado.</div>
                </div>
                <Toggle checked={secure} onChange={(v) => { setSecure(v); setSecureTouched(true); }} />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Usuário / E-mail</label>
                  <input className={inputCls} value={user} onChange={(e) => setUser(e.target.value)} placeholder="rh@suaempresa.com.br" />
                </div>
                <div>
                  <label className={labelCls}>Senha</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder={hasPassword ? "•••••• (senha salva — deixe em branco para manter)" : "Senha do e-mail"}
                  />
                  {hasPassword && <div className={hintCls}>Deixe em branco para manter a senha já salva.</div>}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border pb-3 pt-2">
                <Mail size={16} className="text-primary" /> Identidade do remetente
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>E-mail remetente (from)</label>
                  <input className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="rh@suaempresa.com.br" />
                </div>
                <div>
                  <label className={labelCls}>Nome do remetente</label>
                  <input className={inputCls} value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="RH Sua Empresa" />
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-foreground">Validar certificado TLS</div>
                    <div className="text-xs text-muted-foreground">Recomendado. Desative apenas se o servidor usa certificado autoassinado.</div>
                  </div>
                </div>
                <Toggle checked={rejectUnauthorized} onChange={setRejectUnauthorized} />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-foreground">Configuração ativa</div>
                  <div className="text-xs text-muted-foreground">Quando ativa, as campanhas usam esta conta para envio.</div>
                </div>
                <Toggle checked={isActive} onChange={setIsActive} />
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
                <button
                  onClick={handleSave}
                  disabled={saveMut.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90 transition"
                >
                  {saveMut.isPending ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Salvar configuração
                </button>

                <button
                  onClick={() => testMut.mutate({})}
                  disabled={testMut.isPending || !hasPassword}
                  title={!hasPassword ? "Salve a configuração antes de testar" : undefined}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60 hover:bg-muted/50 transition"
                >
                  {testMut.isPending ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />} Testar conexão
                </button>

                <button
                  onClick={handleSendTest}
                  disabled={sendTestMut.isPending || !hasPassword}
                  title={!hasPassword ? "Salve a configuração antes de enviar" : undefined}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60 hover:bg-muted/50 transition"
                >
                  {sendTestMut.isPending ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />} Enviar e-mail de teste
                </button>
              </div>
              {!hasPassword && (
                <div className="text-xs text-muted-foreground -mt-2">
                  Salve a configuração (com a senha) para liberar os testes de conexão.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
        (checked ? "bg-primary" : "bg-gray-300")
      }
    >
      <span
        className={
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-6" : "translate-x-1")
        }
      />
    </button>
  );
}
