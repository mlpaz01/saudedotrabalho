import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Shield, History } from "lucide-react";

const STATUS_OPTIONS = [
  { v: "received", l: "Recebida" },
  { v: "under_analysis", l: "Em análise" },
  { v: "investigating", l: "Investigando" },
  { v: "concluded_substantiated", l: "Concluída - Procedente" },
  { v: "concluded_unsubstantiated", l: "Concluída - Improcedente" },
  { v: "archived", l: "Arquivada" },
];

export default function AdminDenunciaDetail() {
  const params = useParams();
  const id = Number(params.id);
  const utils = trpc.useUtils();
  const report = trpc.denuncia.getReport.useQuery({ id }, { enabled: !!id });
  const audit = trpc.denuncia.getAuditLog.useQuery({ reportId: id }, { enabled: !!id });

  const [status, setStatus] = useState("received");
  const [internalNotes, setInternalNotes] = useState("");
  const [response, setResponse] = useState("");

  useEffect(() => {
    if (report.data) {
      setStatus(report.data.status);
      setInternalNotes(report.data.internal_notes || "");
      setResponse(report.data.response_to_reporter || "");
    }
  }, [report.data]);

  const update = trpc.denuncia.updateReportStatus.useMutation({
    onSuccess: () => {
      toast.success("Atualizado.");
      utils.denuncia.getReport.invalidate({ id });
      utils.denuncia.getAuditLog.invalidate({ reportId: id });
    },
    onError: (e) => toast.error(e.message),
  });

  if (report.isLoading) return <AppLayout><div className="p-8 text-center">Carregando…</div></AppLayout>;
  if (!report.data) return <AppLayout><div className="p-8 text-center">Não encontrado.</div></AppLayout>;
  const r: any = report.data;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <Link href="/admin/denuncias" className="inline-flex items-center gap-2 text-sm text-blue-700 mb-4">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <Shield className="text-blue-700" size={28} />
          <div>
            <h1 className="text-2xl font-bold font-mono">{r.protocol_code}</h1>
            <p className="text-sm text-muted-foreground">Aberta em {new Date(r.created_at).toLocaleString("pt-BR")}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border p-5 space-y-3">
            <h2 className="font-semibold border-b pb-2">Detalhes</h2>
            <Field label="Categoria">{r.category}</Field>
            <Field label="Gravidade">{r.severity}</Field>
            <Field label="Anônima">{r.is_anonymous ? "Sim" : "Não"}</Field>
            {!r.is_anonymous && (
              <>
                <Field label="E-mail">{r.reporter_email || "-"}</Field>
                <Field label="Telefone">{r.reporter_phone || "-"}</Field>
              </>
            )}
            <Field label="Data do ocorrido">{r.incident_date || "-"}</Field>
            <Field label="Local">{r.incident_location || "-"}</Field>
            <Field label="Acusado - cargo">{r.accused_role || "-"}</Field>
            <Field label="Acusado - setor">{r.accused_department || "-"}</Field>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Descrição</div>
              <div className="p-3 bg-slate-50 rounded text-sm whitespace-pre-wrap">{r.description}</div>
            </div>
            {r.witnesses && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Testemunhas</div>
                <div className="p-3 bg-slate-50 rounded text-sm whitespace-pre-wrap">{r.witnesses}</div>
              </div>
            )}
            <Field label="Retenção até">{r.retention_until}</Field>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-5 space-y-3">
              <h2 className="font-semibold border-b pb-2">Atualizar caso</h2>
              <div>
                <Label>Status</Label>
                <select className="w-full border rounded h-10 px-2" value={status} onChange={e => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div>
                <Label>Notas internas (não visíveis ao denunciante)</Label>
                <Textarea rows={4} value={internalNotes} onChange={e => setInternalNotes(e.target.value)} />
              </div>
              <div>
                <Label>Resposta ao denunciante</Label>
                <Textarea rows={4} value={response} onChange={e => setResponse(e.target.value)} />
              </div>
              <Button onClick={() => update.mutate({ id, status: status as any, internal_notes: internalNotes, response_to_reporter: response })}
                disabled={update.isPending}>
                {update.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <h2 className="font-semibold border-b pb-2 mb-3 flex items-center gap-2"><History size={16} /> Auditoria</h2>
              {audit.data && audit.data.length === 0 && <div className="text-sm text-muted-foreground">Sem eventos.</div>}
              <ul className="space-y-2">
                {(audit.data || []).map((a: any) => (
                  <li key={a.id} className="text-sm border-l-2 border-blue-200 pl-3">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.performed_by_role || "sistema"} · {new Date(a.created_at).toLocaleString("pt-BR")}
                    </div>
                    {a.details && <div className="text-xs mt-1">{a.details}</div>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}
