import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { IdCard, Check, X } from "lucide-react";

export default function AdminQualifications() {
  const [tab, setTab] = useState<"pending" | "dashboard">("pending");
  const { data: pending, refetch } = (trpc as any).qualifications.listPendingValidations.useQuery({});
  const { data: stats } = (trpc as any).qualifications.dashboardStats.useQuery({});
  const validate = (trpc as any).qualifications.validateQualification.useMutation({
    onSuccess: () => {
      toast.success("Validação registrada");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <IdCard className="text-primary" />
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Qualificações e Habilitações
        </h1>
      </div>

      <div className="flex gap-2 border-b mb-6">
        <button onClick={() => setTab("pending")}
          className={`px-4 py-2 text-sm font-medium ${tab === "pending" ? "border-b-2 border-primary text-primary" : "text-gray-500"}`}>
          Pendentes {pending ? `(${pending.length})` : ""}
        </button>
        <button onClick={() => setTab("dashboard")}
          className={`px-4 py-2 text-sm font-medium ${tab === "dashboard" ? "border-b-2 border-primary text-primary" : "text-gray-500"}`}>
          Dashboard
        </button>
      </div>

      {tab === "pending" && (
        <div className="bg-white rounded-lg shadow p-6">
          {!pending || pending.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma qualificação pendente de validação.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left">
                  <tr>
                    <th className="py-2">Colaborador</th>
                    <th className="py-2">Tipo</th>
                    <th className="py-2">Número</th>
                    <th className="py-2">Emissor</th>
                    <th className="py-2">Emissão</th>
                    <th className="py-2">Validade</th>
                    <th className="py-2">Documento</th>
                    <th className="py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((q: any) => (
                    <tr key={q.id} className="border-b">
                      <td className="py-2">
                        <div className="font-medium">{q.userName}</div>
                        <div className="text-xs text-gray-500">{q.userEmail}</div>
                      </td>
                      <td className="py-2">{q.qualificationType}</td>
                      <td className="py-2">{q.qualificationNumber || "-"}</td>
                      <td className="py-2">{q.issuer || "-"}</td>
                      <td className="py-2">{q.issuedAt ? String(q.issuedAt).slice(0, 10) : "-"}</td>
                      <td className="py-2">{q.validUntil ? String(q.validUntil).slice(0, 10) : "Indeterminada"}</td>
                      <td className="py-2">
                        {q.documentUrl ? (
                          <a className="text-primary underline text-xs" href={q.documentUrl} target="_blank" rel="noreferrer">Abrir</a>
                        ) : "-"}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const notes = prompt("Observações (opcional):") || undefined;
                              validate.mutate({ id: q.id, decision: "approved", notes });
                            }}
                            className="bg-emerald-600 text-white rounded px-2 py-1 text-xs inline-flex items-center gap-1"
                          >
                            <Check size={12} /> Aprovar
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt("Motivo da rejeição:") || undefined;
                              validate.mutate({ id: q.id, decision: "rejected", notes });
                            }}
                            className="bg-red-600 text-white rounded px-2 py-1 text-xs inline-flex items-center gap-1"
                          >
                            <X size={12} /> Rejeitar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "dashboard" && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Total" value={stats.total} color="bg-slate-100" />
          <Kpi label="Válidas" value={stats.valid} color="bg-emerald-100" />
          <Kpi label="Pendentes" value={stats.pending} color="bg-gray-100" />
          <Kpi label="Vencidas" value={stats.expired} color="bg-red-100" />
          <Kpi label="Vencem em 30d" value={stats.expiring30} color="bg-orange-100" />
          <Kpi label="Vencem em 60d" value={stats.expiring60} color="bg-amber-100" />
          <Kpi label="Vencem em 90d" value={stats.expiring90} color="bg-yellow-100" />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
