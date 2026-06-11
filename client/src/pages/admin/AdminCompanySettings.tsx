import { useState, useEffect } from "react";
import { useParams } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, Save, Palette } from "lucide-react";

export default function AdminCompanySettings() {
  const params = useParams<{ id: string }>();
  const companyId = parseInt(params.id ?? "0");
  const { data: company, isLoading } = trpc.companies.get.useQuery({ id: companyId }, { enabled: !!companyId });

  const [form, setForm] = useState({
    name: "",
    cnpj: "",
    logoUrl: "",
    primaryColor: "#1e3a5f",
    description: "",
    phone: "",
    website: "",
    address: "",
    loginBgUrl: "",
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        cnpj: company.cnpj ?? "",
        logoUrl: (company as any).logoUrl ?? "",
        primaryColor: (company as any).primaryColor ?? "#1e3a5f",
        description: (company as any).description ?? "",
        phone: (company as any).phone ?? "",
        website: (company as any).website ?? "",
        address: (company as any).address ?? "",
        loginBgUrl: (company as any).loginBgUrl ?? "",
      });
    }
  }, [company]);

  const updateMut = trpc.companies.updateSettings.useMutation({
    onSuccess: () => toast.success("Configuracoes salvas com sucesso!"),
    onError: (e) => toast.error(e.message),
  });

  function handleSave() {
    updateMut.mutate({ id: companyId, ...form });
  }

  if (isLoading) return <AppLayout><div className="p-6 text-muted-foreground">Carregando...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
          <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
            Configuracoes da Empresa
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{company?.name ?? "Empresa"}</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-5">
          <h2 className="font-semibold flex items-center gap-2"><Building2 size={16} className="text-primary" /> Dados da Empresa</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome da Empresa</label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">CNPJ</label>
              <Input value={form.cnpj} onChange={(e) => setForm(f => ({ ...f, cnpj: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Telefone</label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+55 21 9999-9999" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Website</label>
              <Input value={form.website} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://empresa.com.br" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Endereco</label>
            <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, Numero, Cidade, UF" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Descricao</label>
            <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-5">
          <h2 className="font-semibold flex items-center gap-2"><Palette size={16} className="text-primary" /> Identidade Visual (White-label)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Cor Primaria</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primaryColor} onChange={(e) => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border border-border" />
                <Input value={form.primaryColor} onChange={(e) => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="font-mono text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Previa da Cor</label>
              <div className="w-full h-10 rounded-lg border border-border" style={{ backgroundColor: form.primaryColor }} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">URL da Logomarca</label>
            <Input value={form.logoUrl} onChange={(e) => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
            {form.logoUrl && <img src={form.logoUrl} alt="logo preview" className="mt-2 h-12 object-contain border rounded p-1" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">URL da Imagem de Login (fundo)</label>
            <Input value={form.loginBgUrl} onChange={(e) => setForm(f => ({ ...f, loginBgUrl: e.target.value }))} placeholder="https://..." />
            {form.loginBgUrl && <img src={form.loginBgUrl} alt="bg preview" className="mt-2 h-24 w-full object-cover border rounded" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateMut.isPending} className="gap-2">
            <Save size={16} /> {updateMut.isPending ? "Salvando..." : "Salvar Configuracoes"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
