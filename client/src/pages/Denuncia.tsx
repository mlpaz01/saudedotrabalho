import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { Link } from "wouter";

const CATEGORIES = [
  { v: "assedio_moral", l: "Assédio Moral" },
  { v: "assedio_sexual", l: "Assédio Sexual" },
  { v: "discriminacao", l: "Discriminação" },
  { v: "corrupcao", l: "Corrupção" },
  { v: "fraude", l: "Fraude" },
  { v: "desvio_conduta", l: "Desvio de Conduta" },
  { v: "seguranca", l: "Segurança / SST" },
  { v: "ambiental", l: "Ambiental" },
  { v: "outros", l: "Outros" },
];
const SEVERITIES = [
  { v: "baixa", l: "Baixa" },
  { v: "media", l: "Média" },
  { v: "alta", l: "Alta" },
  { v: "critica", l: "Crítica" },
];
const FREQUENCIES = [
  { v: "primeira_vez", l: "Primeira vez" },
  { v: "ocasional", l: "Ocasional" },
  { v: "frequente", l: "Frequente" },
  { v: "continua", l: "Contínua" },
];
const RISKS = [
  { v: "baixo", l: "Baixo" },
  { v: "medio", l: "Médio" },
  { v: "alto", l: "Alto" },
  { v: "critico", l: "Crítico" },
];

export default function Denuncia() {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("assedio_moral");
  const [severity, setSeverity] = useState<"baixa" | "media" | "alta" | "critica">("media");
  const [frequency, setFrequency] = useState<"primeira_vez" | "ocasional" | "frequente" | "continua">("primeira_vez");
  const [perceivedRisk, setPerceivedRisk] = useState<"baixo" | "medio" | "alto" | "critico">("medio");
  const [lgpd, setLgpd] = useState(false);
  const [description, setDescription] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");
  const [witnesses, setWitnesses] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reporterEmail, setReporterEmail] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [protocol, setProtocol] = useState<string | null>(null);

  const submit = trpc.denuncia.submitReport.useMutation({
    onSuccess: (d) => { setProtocol(d.protocolCode); toast.success("Denúncia registrada com sucesso."); },
    onError: (e) => toast.error(e.message),
  });

  if (protocol) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-xl shadow-xl p-8 text-center">
          <CheckCircle2 className="mx-auto text-green-600" size={56} />
          <h1 className="text-2xl font-bold mt-4">Denúncia registrada</h1>
          <p className="text-muted-foreground mt-2">Guarde o protocolo abaixo. Você poderá acompanhar a evolução do caso usando este código.</p>
          <div className="my-6 p-5 bg-blue-50 border-2 border-blue-300 rounded-lg">
            <p className="text-xs uppercase text-blue-700 font-semibold tracking-wider">Seu protocolo</p>
            <p className="text-3xl font-mono font-bold text-blue-900 mt-2 select-all">{protocol}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { navigator.clipboard.writeText(protocol); toast.success("Copiado"); }}>
              <Copy size={14} className="mr-2" /> Copiar
            </Button>
          </div>
          <div className="flex gap-3 justify-center">
            <Link href="/denuncia/acompanhar"><Button variant="outline">Acompanhar denúncia</Button></Link>
            <Link href="/login"><Button>Voltar ao login</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!lgpd) { toast.error("Você precisa aceitar a LGPD."); return; }
    if (!description.trim()) { toast.error("Descrição é obrigatória."); return; }
    submit.mutate({
      category: category as any, severity, frequency, perceivedRisk, isAnonymous,
      reporterEmail: isAnonymous ? undefined : reporterEmail,
      reporterPhone: isAnonymous ? undefined : reporterPhone,
      incidentDate: incidentDate || undefined,
      incidentLocation: incidentLocation || undefined,
      description, witnesses: witnesses || undefined,
      lgpdConsent: lgpd,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="text-blue-700" size={32} />
          <div>
            <h1 className="text-2xl font-bold">Canal de Denúncia</h1>
            <p className="text-sm text-muted-foreground">Espaço sigiloso, seguro e em conformidade com a LGPD.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-2 rounded-full ${s <= step ? "bg-blue-600" : "bg-slate-200"}`} />
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">Passo 1: Classificação</h2>
              <div>
                <Label>Categoria</Label>
                <select className="w-full mt-1 border rounded-md h-10 px-3" value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </div>
              <div>
                <Label>Gravidade percebida</Label>
                <select className="w-full mt-1 border rounded-md h-10 px-3" value={severity} onChange={e => setSeverity(e.target.value as any)}>
                  {SEVERITIES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequência da ocorrência</Label>
                  <select className="w-full mt-1 border rounded-md h-10 px-3" value={frequency} onChange={e => setFrequency(e.target.value as any)}>
                    {FREQUENCIES.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Risco percebido</Label>
                  <select className="w-full mt-1 border rounded-md h-10 px-3" value={perceivedRisk} onChange={e => setPerceivedRisk(e.target.value as any)}>
                    {RISKS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md flex gap-3">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-amber-900">
                  <strong>Aviso LGPD:</strong> Os dados desta denúncia serão tratados com sigilo, criptografia e retenção por 5 anos. Você pode optar pelo anonimato no Passo 3.
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={lgpd} onChange={e => setLgpd(e.target.checked)} className="mt-1" />
                <span className="text-sm">Li e concordo com o tratamento de meus dados conforme a LGPD. (obrigatório)</span>
              </label>
              <div className="flex justify-end">
                <Button disabled={!lgpd} onClick={() => setStep(2)}>Próximo</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">Passo 2: O ocorrido</h2>
              <div>
                <Label>Descrição detalhada *</Label>
                <Textarea rows={8} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o ocorrido com o máximo de detalhes possível..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data do ocorrido</Label>
                  <Input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} />
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={incidentLocation} onChange={e => setIncidentLocation(e.target.value)} placeholder="Ex: Filial X, Sala Y" />
                </div>
              </div>
              <div>
                <Label>Testemunhas (opcional)</Label>
                <Textarea rows={3} value={witnesses} onChange={e => setWitnesses(e.target.value)} placeholder="Nomes, cargos ou contatos de eventuais testemunhas..." />
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={() => setStep(3)} disabled={!description.trim()}>Próximo</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">Passo 3: Identificação</h2>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setIsAnonymous(true)}
                  className={`p-4 border-2 rounded-lg text-left ${isAnonymous ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}>
                  <div className="font-semibold">Denúncia Anônima</div>
                  <div className="text-xs text-muted-foreground mt-1">Nenhum dado pessoal será armazenado.</div>
                </button>
                <button type="button" onClick={() => setIsAnonymous(false)}
                  className={`p-4 border-2 rounded-lg text-left ${!isAnonymous ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}>
                  <div className="font-semibold">Identificado</div>
                  <div className="text-xs text-muted-foreground mt-1">Permite contato e retorno individual.</div>
                </button>
              </div>
              {!isAnonymous && (
                <div className="space-y-3">
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" value={reporterEmail} onChange={e => setReporterEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={reporterPhone} onChange={e => setReporterPhone(e.target.value)} />
                  </div>
                </div>
              )}
              {isAnonymous && (
                <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-4 text-sm text-amber-900">
                  <strong>Atenção — Denúncia anônima.</strong>
                  <p className="mt-1">Para preservar seu anonimato, esta denúncia <strong>não será vinculada ao seu cadastro</strong>. Guarde o número do protocolo que será exibido na próxima tela — ele é o único meio de acompanhar o andamento da sua manifestação posteriormente.</p>
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
                <Button onClick={handleSubmit} disabled={submit.isPending}>
                  {submit.isPending ? "Enviando…" : "Enviar denúncia"}
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/denuncia/acompanhar" className="underline">Já tem um protocolo? Acompanhar denúncia</Link>
        </p>
      </div>
    </div>
  );
}
