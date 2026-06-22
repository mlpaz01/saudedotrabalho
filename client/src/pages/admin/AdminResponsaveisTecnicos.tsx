import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";

// Signature files are written by the server to /var/www/saudedotrabalho/uploads/signatures
// and served by nginx at the ORIGIN-absolute path "/uploads/...". The SPA itself is mounted
// under "/plataforma/", so we must NOT let a relative/base-prefixed URL be built — always
// resolve against the origin so the request goes to "<origin>/uploads/..." (HTTP 200), never
// "<origin>/plataforma/uploads/..." (HTTP 404).
function signatureSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(data:|https?:)/i.test(url)) return url; // data URL preview or absolute URL
  // Force origin-absolute: strip any leading slash then prefix the origin.
  return `${window.location.origin}/${url.replace(/^\/+/, "")}`;
}

export default function AdminResponsaveisTecnicos() {
  const { user } = useAuth();
  const isGlobal = (user?.role ?? "") === "admin_global" || (user?.role ?? "") === "super_admin";
  // Super Admin (companyId NULL) precisa escolher a empresa antes de cadastrar/listar.
  // Demais perfis usam a empresa do usuário automaticamente (campo nem aparece).
  const [pickedCompanyId, setPickedCompanyId] = useState<number | null>(null);
  const companiesQ = trpc.pgr.listCompanies.useQuery(undefined, { enabled: isGlobal });
  const companies = (companiesQ.data ?? []) as Array<{ id: number; name: string }>;
  const effectiveCompanyId = isGlobal ? pickedCompanyId : (user?.companyId ?? null);

  const list = trpc.responsibleTechnicians.list.useQuery(
    isGlobal && pickedCompanyId ? { companyId: pickedCompanyId } : {},
    { enabled: !isGlobal || !!pickedCompanyId }
  );
  const utils = trpc.useUtils();
  const create = trpc.responsibleTechnicians.create.useMutation({
    onSuccess: (res: any) => {
      utils.responsibleTechnicians.list.invalidate();
      if (res?.signatureUrl) toast.success("Responsável cadastrado com assinatura salva.");
      else toast.success("Responsável cadastrado.");
      reset();
    },
    onError: (err: any) => {
      toast.error(`Falha ao cadastrar: ${err?.message ?? "erro desconhecido"}`);
    },
  });
  const update = trpc.responsibleTechnicians.update.useMutation({
    onSuccess: () => {
      utils.responsibleTechnicians.list.invalidate();
      toast.success("Responsável atualizado.");
      reset();
    },
    onError: (err: any) => {
      toast.error(`Falha ao atualizar: ${err?.message ?? "erro desconhecido"}`);
    },
  });
  const remove = trpc.responsibleTechnicians.remove.useMutation({
    onSuccess: () => {
      utils.responsibleTechnicians.list.invalidate();
      toast.success("Responsável excluído.");
    },
    onError: (err: any) => {
      toast.error(`Falha ao excluir: ${err?.message ?? "erro desconhecido"}`);
    },
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [registration, setRegistration] = useState("");
  const [profession, setProfession] = useState("");
  const [art, setArt] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function reset() {
    setEditingId(null);
    setName(""); setRegistration(""); setProfession(""); setArt("");
    setIsDefault(false); setSignatureBase64(null); setPreview(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/png|jpe?g/i.test(f.type)) { toast.error("Use PNG ou JPG."); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 5 MB)."); return; }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        if (!dataUrl.startsWith("data:")) {
          toast.error("Não foi possível ler a imagem.");
          return;
        }
        setSignatureBase64(dataUrl);
        setPreview(dataUrl);
      };
      reader.onerror = () => toast.error("Erro ao ler o arquivo de assinatura.");
      reader.readAsDataURL(f);
    } catch (err: any) {
      toast.error(`Erro ao processar a imagem: ${err?.message ?? "desconhecido"}`);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe o nome."); return; }
    if (isGlobal && !pickedCompanyId) {
      toast.error("Super Admin: selecione a empresa antes de cadastrar."); return;
    }
    const payload = {
      name: name.trim(),
      registration: registration || null,
      profession: profession || null,
      art: art || null,
      signatureBase64: signatureBase64 || undefined,
      isDefault,
    };
    try {
      if (editingId) update.mutate({ id: editingId, ...payload });
      else create.mutate({ ...(isGlobal ? { companyId: pickedCompanyId! } : {}), ...payload });
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err?.message ?? "desconhecido"}`);
    }
  }

  function startEdit(r: any) {
    setEditingId(r.id);
    setName(r.name || "");
    setRegistration(r.registration || "");
    setProfession(r.profession || "");
    setArt(r.art || "");
    setIsDefault(!!r.isDefault);
    setPreview(r.signatureUrl || null);
    setSignatureBase64(null);
  }

  return (
    <AppLayout>
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Responsáveis Técnicos</h1>
      <p className="text-gray-600 mb-6">Cadastre os técnicos responsáveis e suas assinaturas digitais (PNG) para uso nos laudos.</p>

      {isGlobal && (
        <div className="border border-blue-200 bg-blue-50 rounded p-3 mb-4">
          <label className="block text-xs font-semibold text-blue-900 mb-1">
            Empresa (obrigatório para Super Admin)
          </label>
          <select
            value={pickedCompanyId ?? ""}
            onChange={(e) => setPickedCompanyId(e.target.value ? Number(e.target.value) : null)}
            className="w-full border rounded px-3 py-2 bg-white"
          >
            <option value="">— selecione a empresa —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!pickedCompanyId && (
            <p className="text-xs text-blue-700 mt-1">
              Escolha a empresa para a qual está cadastrando o Responsável Técnico.
              O cadastro fica vinculado a ela e aparece nos laudos dessa empresa.
            </p>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className={`border rounded p-4 mb-6 bg-white space-y-3 ${isGlobal && !pickedCompanyId ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="font-semibold">{editingId ? "Editar responsável" : "Novo responsável"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Nome completo *" value={name} onChange={e=>setName(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Registro profissional (ex.: CRP 06/12345, CREA 123456-D)" value={registration} onChange={e=>setRegistration(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Profissão (ex: Psicóloga, Engenheiro de Segurança)" value={profession} onChange={e=>setProfession(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="ART / Nº documento (opcional)" value={art} onChange={e=>setArt(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={isDefault} onChange={e=>setIsDefault(e.target.checked)} /> Definir como padrão</label>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Assinatura (PNG/JPG) — fundo transparente recomendado</label>
          <input type="file" accept="image/png,image/jpeg" onChange={onFile} />
          {preview && (
            <div className="mt-2 border rounded p-2 inline-block bg-gray-50">
              <img
                src={signatureSrc(preview)}
                alt="assinatura"
                style={{ maxHeight: 80 }}
                onError={() => toast.error("Não foi possível exibir a assinatura (imagem não encontrada no servidor).")}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={create.isPending || update.isPending} className="bg-blue-600 text-white px-4 py-2 rounded">
            {create.isPending || update.isPending ? "Salvando..." : (editingId ? "Salvar alterações" : "Cadastrar")}
          </button>
          {editingId && <button type="button" onClick={reset} className="border px-4 py-2 rounded">Cancelar</button>}
        </div>
      </form>

      <div className="border rounded bg-white">
        <table className="w-full">
          <thead className="bg-gray-50 text-left text-sm">
            <tr>
              <th className="p-2">Assinatura</th>
              <th className="p-2">Nome</th>
              <th className="p-2">Registro</th>
              <th className="p-2">Profissão</th>
              <th className="p-2">Padrão</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  {r.signatureUrl
                    ? <img
                        src={signatureSrc(r.signatureUrl)}
                        alt=""
                        style={{ maxHeight: 40 }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.registration || "—"}</td>
                <td className="p-2">{r.profession || "—"}</td>
                <td className="p-2">{r.isDefault ? "Sim" : ""}</td>
                <td className="p-2 space-x-2">
                  <button onClick={() => startEdit(r)} className="text-blue-600">Editar</button>
                  <button onClick={() => { if (confirm("Excluir este responsável?")) remove.mutate({ id: r.id }); }} className="text-red-600">Excluir</button>
                </td>
              </tr>
            ))}
            {list.data && list.data.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">Nenhum responsável cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </AppLayout>
  );
}
