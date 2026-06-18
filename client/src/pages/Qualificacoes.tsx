import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { IdCard, Upload } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  valido: "bg-emerald-500",
  vencendo_90: "bg-yellow-400",
  vencendo_60: "bg-amber-500",
  vencendo_30: "bg-orange-500",
  vencido: "bg-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  valido: "Válido",
  vencendo_90: "Vence em até 90 dias",
  vencendo_60: "Vence em até 60 dias",
  vencendo_30: "Vence em até 30 dias",
  vencido: "Vencido",
};

export default function Qualificacoes() {
  const { data: list, refetch, isLoading } = (trpc as any).qualifications.listMyQualifications.useQuery();
  const createMut = (trpc as any).qualifications.createMyQualification.useMutation({
    onSuccess: () => {
      toast.success("Qualificação enviada. Aguardando validação do RH.");
      setForm({ qualification_type: "", qualification_number: "", issuer: "", issued_at: "", valid_until: "" });
      setFileB64(null);
      setFileExt(null);
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar"),
  });

  const [form, setForm] = useState({
    qualification_type: "",
    qualification_number: "",
    issuer: "",
    issued_at: "",
    valid_until: "",
  });
  const [fileB64, setFileB64] = useState<string | null>(null);
  const [fileExt, setFileExt] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || "");
      const b64 = res.split(",")[1] || "";
      setFileB64(b64);
      const dot = f.name.lastIndexOf(".");
      setFileExt(dot >= 0 ? f.name.slice(dot + 1).toLowerCase() : "pdf");
    };
    reader.readAsDataURL(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.qualification_type || !form.issued_at) {
      toast.error("Tipo e data de emissão são obrigatórios");
      return;
    }
    createMut.mutate({
      ...form,
      qualification_number: form.qualification_number || undefined,
      issuer: form.issuer || undefined,
      valid_until: form.valid_until || undefined,
      document_base64: fileB64 || undefined,
      document_ext: fileExt || undefined,
    });
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3">
        <IdCard className="text-primary" />
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Qualificações e Habilitações
        </h1>
      </div>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Minhas qualificações</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : !list || list.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma qualificação registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr>
                  <th className="py-2">Status</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Número</th>
                  <th className="py-2">Emissor</th>
                  <th className="py-2">Emissão</th>
                  <th className="py-2">Validade</th>
                  <th className="py-2">Origem</th>
                  <th className="py-2">Documento</th>
                </tr>
              </thead>
              <tbody>
                {list.map((q: any) => {
                  const ds = q.status === "pending_validation" ? "pending" : q.derivedStatus;
                  const color = STATUS_COLOR[q.derivedStatus] || "bg-gray-400";
                  const label = q.status === "pending_validation" ? "Aguardando validação" : (STATUS_LABEL[q.derivedStatus] || q.derivedStatus);
                  return (
                    <tr key={q.id} className="border-b">
                      <td className="py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${q.status === "pending_validation" ? "bg-gray-400" : color}`} />
                          <span className="text-xs">{label}</span>
                        </span>
                      </td>
                      <td className="py-2">{q.qualificationType}</td>
                      <td className="py-2">{q.qualificationNumber || "-"}</td>
                      <td className="py-2">{q.issuer || "-"}</td>
                      <td className="py-2">{q.issuedAt ? String(q.issuedAt).slice(0, 10) : "-"}</td>
                      <td className="py-2">{q.validUntil ? String(q.validUntil).slice(0, 10) : "Indeterminada"}</td>
                      <td className="py-2 text-xs">{q.source === "internal_certificate" ? "Curso interno" : "Upload externo"}</td>
                      <td className="py-2">
                        {q.documentUrl ? (
                          <a className="text-primary underline text-xs" href={q.documentUrl} target="_blank" rel="noreferrer">Ver</a>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Adicionar certificado externo</h2>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Tipo / Curso *</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.qualification_type}
              onChange={(e) => setForm({ ...form, qualification_type: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Número do certificado</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.qualification_number}
              onChange={(e) => setForm({ ...form, qualification_number: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Emissor / Instituição</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Data de emissão *</label>
            <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={form.issued_at}
              onChange={(e) => setForm({ ...form, issued_at: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Validade (opcional)</label>
            <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Documento (PDF/imagem)</label>
            <input type="file" accept="application/pdf,image/*" onChange={onFile} className="text-sm" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={createMut.isPending}
              className="bg-primary text-white rounded px-4 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50">
              <Upload size={14} />
              {createMut.isPending ? "Enviando..." : "Enviar para validação"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
