import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Search } from "lucide-react";
import { Link } from "wouter";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  received: { label: "Recebida", color: "bg-slate-100 text-slate-700" },
  under_analysis: { label: "Em análise", color: "bg-amber-100 text-amber-800" },
  investigating: { label: "Em investigação", color: "bg-blue-100 text-blue-800" },
  concluded_substantiated: { label: "Concluída - Procedente", color: "bg-green-100 text-green-800" },
  concluded_unsubstantiated: { label: "Concluída - Improcedente", color: "bg-rose-100 text-rose-800" },
  archived: { label: "Arquivada", color: "bg-slate-200 text-slate-700" },
};

export default function DenunciaTrack() {
  const [code, setCode] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const q = trpc.denuncia.trackByProtocol.useQuery({ protocolCode: query || "" }, { enabled: !!query, retry: false });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="text-blue-700" size={32} />
          <div>
            <h1 className="text-2xl font-bold">Acompanhar Denúncia</h1>
            <p className="text-sm text-muted-foreground">Insira seu código de protocolo.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="DEN-XXXXXXXXXXXX" className="font-mono" />
          </div>
          <Button onClick={() => setQuery(code.trim())} disabled={!code.trim()} className="w-full">
            <Search size={16} className="mr-2" /> Consultar
          </Button>

          {q.isLoading && query && <div className="text-center text-sm text-muted-foreground">Buscando…</div>}
          {q.error && <div className="p-3 bg-rose-50 border border-rose-200 rounded text-sm text-rose-800">Protocolo não encontrado.</div>}
          {q.data && (
            <div className="space-y-3 mt-4">
              <div>
                <span className="text-xs uppercase text-muted-foreground">Status</span>
                <div className="mt-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${STATUS_LABELS[q.data.status]?.color || "bg-slate-100"}`}>
                    {STATUS_LABELS[q.data.status]?.label || q.data.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Aberta em</span>
                <div className="text-sm">{q.data.createdAt ? new Date(q.data.createdAt as any).toLocaleString("pt-BR") : "-"}</div>
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Última atualização</span>
                <div className="text-sm">{q.data.updatedAt ? new Date(q.data.updatedAt as any).toLocaleString("pt-BR") : "-"}</div>
              </div>
              {q.data.responseToReporter && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="text-xs uppercase text-blue-700 font-semibold mb-1">Resposta ao denunciante</div>
                  <div className="text-sm whitespace-pre-wrap">{q.data.responseToReporter}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/denuncia" className="underline">Registrar nova denúncia</Link>
          {" · "}
          <Link href="/login" className="underline">Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}
