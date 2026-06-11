import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Search, Pencil, Trash2, Power, ChevronRight, Users, Layers } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

type CompanyRow = {
  id: number;
  name: string;
  cnpj?: string | null;
  plan?: string | null;
  max_employees?: number | null;
  phone?: string | null;
  primary_color?: string | null;
  logo_url?: string | null;
  description?: string | null;
  is_active?: number | null;
  branches_count?: number | null;
  users_count?: number | null;
};

const PLANS = [
  { value: "free", label: "Free" },
  { value: "basic", label: "Basico" },
  { value: "essencial", label: "Essencial" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function cnpjDigits(v?: string | null) {
  return (v ?? "").replace(/\D/g, "");
}

type FormState = {
  name: string;
  cnpj: string;
  plan: string;
  maxEmployees: string;
  phone: string;
  primaryColor: string;
  logoUrl: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  cnpj: "",
  plan: "essencial",
  maxEmployees: "50",
  phone: "",
  primaryColor: "#1e3a5f",
  logoUrl: "",
  description: "",
};

export default function AdminCompanies() {
  const utils = trpc.useUtils();
  const listQ = trpc.companies.listWithCounts.useQuery();
  const createMut = trpc.companies.createPlus.useMutation({
    onSuccess: () => { toast.success("Empresa criada"); utils.companies.listWithCounts.invalidate(); setOpen(false); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.companies.updatePlus.useMutation({
    onSuccess: () => { toast.success("Empresa atualizada"); utils.companies.listWithCounts.invalidate(); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMut = trpc.companies.toggleActive.useMutation({
    onSuccess: () => { toast.success("Status atualizado"); utils.companies.listWithCounts.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.companies.deleteCompany.useMutation({
    onSuccess: () => { toast.success("Empresa excluida"); utils.companies.listWithCounts.invalidate(); setDeleting(null); },
    onError: (e) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [deleting, setDeleting] = useState<CompanyRow | null>(null);

  const companies: CompanyRow[] = (listQ.data ?? []) as any;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      String(c.name ?? "").toLowerCase().includes(q) ||
      cnpjDigits(c.cnpj).includes(q.replace(/\D/g, ""))
    );
  }, [companies, search]);

  function openEdit(c: CompanyRow) {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      cnpj: c.cnpj ? maskCnpj(c.cnpj) : "",
      plan: c.plan ?? "essencial",
      maxEmployees: c.max_employees != null ? String(c.max_employees) : "50",
      phone: c.phone ?? "",
      primaryColor: c.primary_color ?? "#1e3a5f",
      logoUrl: c.logo_url ?? "",
      description: c.description ?? "",
    });
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function submit() {
    const cnpjD = cnpjDigits(form.cnpj);
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (form.cnpj && cnpjD.length !== 14) { toast.error("CNPJ deve ter 14 digitos"); return; }
    const payload = {
      name: form.name.trim(),
      cnpj: cnpjD || undefined,
      plan: form.plan || undefined,
      maxEmployees: form.maxEmployees ? Number(form.maxEmployees) : undefined,
      phone: form.phone || undefined,
      primaryColor: form.primaryColor || undefined,
      logoUrl: form.logoUrl || undefined,
      description: form.description || undefined,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                <Building2 className="w-7 h-7" /> Empresas
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {listQ.isLoading ? "Carregando..." : `${filtered.length} empresa(s)`}
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova Empresa</Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: (c.primary_color ?? "#1e3a5f") + "1A" }}
                    >
                      <Building2 className="w-5 h-5" style={{ color: c.primary_color ?? "#1e3a5f" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-base truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {c.cnpj && <span>CNPJ {maskCnpj(c.cnpj)}</span>}
                        {c.plan && <Badge variant="outline" className="text-[10px] uppercase">{c.plan}</Badge>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60">
                      <Layers size={12} /> {c.branches_count ?? 0} filial(is)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60">
                      <Users size={12} /> {c.users_count ?? 0} colab.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(c)}>
                      <Pencil size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={c.is_active ? "Desativar" : "Ativar"}
                      onClick={() => toggleMut.mutate({ id: c.id })}
                    >
                      <Power size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Excluir"
                      onClick={() => setDeleting(c)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </Button>
                    <Link href={`/admin/empresas/${c.id}`}>
                      <Button variant="outline" size="sm" className="gap-1">
                        Detalhes <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!listQ.isLoading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border border-border">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma empresa encontrada.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open || !!editing} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div className="md:col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Empresa ABC Ltda" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <Label>Plano</Label>
              <select
                className="w-full mt-2 border rounded-md px-3 py-2 text-sm bg-white"
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
              >
                {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Max. colaboradores</Label>
              <Input type="number" value={form.maxEmployees} onChange={(e) => setForm({ ...form, maxEmployees: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Cor primaria</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="h-10 w-12 border rounded cursor-pointer"
                />
                <Input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <Label>Descricao</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full mt-2 border rounded-md px-3 py-2 text-sm min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  Esta acao remove a empresa <strong>{deleting.name}</strong> e suas filiais/setores. Nao pode ser desfeita.
                  {(deleting.users_count ?? 0) > 0 && (
                    <span className="block mt-2 text-rose-600 text-sm">
                      Atencao: existem {deleting.users_count} colaborador(es) vinculados. A operacao sera bloqueada.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMut.mutate({ id: deleting.id })}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
