import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Wrench, Plus, Search, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

type SectorRow = {
  id: number;
  company_id: number;
  branch_id?: number | null;
  name: string;
  branch_name?: string | null;
  company_name?: string | null;
  users_count?: number | null;
};

type BranchRow = { id: number; company_id: number; name: string };

type FormState = { name: string; branchId: string; companyId: string };

const EMPTY: FormState = { name: "", branchId: "", companyId: "" };

export default function AdminDepartments() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isGlobal = user?.role === "admin_global" || user?.role === "super_admin";

  const [selectedCompany, setSelectedCompany] = useState<number | "all">("all");
  const [selectedBranch, setSelectedBranch] = useState<number | "all">("all");

  const companiesQ = trpc.companies.list.useQuery(undefined, { enabled: isGlobal });

  const branchesInput = isGlobal && selectedCompany !== "all" ? { companyId: Number(selectedCompany) } : {};
  const branchesQ = trpc.branchesAdmin.list.useQuery(branchesInput);

  const listInput = (() => {
    const inp: any = {};
    if (isGlobal && selectedCompany !== "all") inp.companyId = Number(selectedCompany);
    if (selectedBranch !== "all") inp.branchId = Number(selectedBranch);
    return inp;
  })();
  const listQ = trpc.departmentsAdmin.list.useQuery(listInput);

  const createMut = trpc.departmentsAdmin.create.useMutation({
    onSuccess: () => { toast.success("Setor criado"); utils.departmentsAdmin.list.invalidate(); setOpen(false); setForm(EMPTY); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.departmentsAdmin.update.useMutation({
    onSuccess: () => { toast.success("Setor atualizado"); utils.departmentsAdmin.list.invalidate(); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.departmentsAdmin.delete.useMutation({
    onSuccess: () => { toast.success("Setor excluido"); utils.departmentsAdmin.list.invalidate(); setDeleting(null); },
    onError: (e) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<SectorRow | null>(null);
  const [deleting, setDeleting] = useState<SectorRow | null>(null);

  const sectors: SectorRow[] = (listQ.data ?? []) as any;
  const branches: BranchRow[] = (branchesQ.data ?? []) as any;
  const companies = (companiesQ.data ?? []) as any[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sectors;
    return sectors.filter((s) =>
      String(s.name ?? "").toLowerCase().includes(q) ||
      String(s.branch_name ?? "").toLowerCase().includes(q) ||
      String(s.company_name ?? "").toLowerCase().includes(q)
    );
  }, [sectors, search]);

  // Branches scoped to the form's current company (for create flow)
  const branchesForCompany = useMemo(() => {
    if (!isGlobal) return branches;
    if (!form.companyId) return branches;
    return branches.filter((b) => b.company_id === Number(form.companyId));
  }, [branches, form.companyId, isGlobal]);

  function openEdit(s: SectorRow) {
    setEditing(s);
    setForm({
      name: s.name ?? "",
      branchId: s.branch_id ? String(s.branch_id) : "",
      companyId: String(s.company_id ?? ""),
    });
  }

  function openCreate() {
    setForm({
      ...EMPTY,
      companyId: isGlobal && selectedCompany !== "all" ? String(selectedCompany) : "",
      branchId: selectedBranch !== "all" ? String(selectedBranch) : "",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        name: form.name.trim(),
        branchId: form.branchId ? Number(form.branchId) : undefined,
      });
    } else {
      if (isGlobal && !form.branchId && !form.companyId) {
        toast.error("Selecione empresa ou filial");
        return;
      }
      createMut.mutate({
        name: form.name.trim(),
        branchId: form.branchId ? Number(form.branchId) : undefined,
      });
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
                <Wrench className="w-7 h-7" /> Setores
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {listQ.isLoading ? "Carregando..." : `${filtered.length} setor(es)`}
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo Setor</Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, filial ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {isGlobal && (
            <select
              className="border border-border rounded-md px-3 py-2 text-sm bg-white"
              value={String(selectedCompany)}
              onChange={(e) => { setSelectedCompany(e.target.value === "all" ? "all" : Number(e.target.value)); setSelectedBranch("all"); }}
            >
              <option value="all">Empresa: todas</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select
            className="border border-border rounded-md px-3 py-2 text-sm bg-white"
            value={String(selectedBranch)}
            onChange={(e) => setSelectedBranch(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">Filial: todas</option>
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Filial</th>
                {isGlobal && <th className="p-3 text-left">Empresa</th>}
                <th className="p-3 text-center">Colab.</th>
                <th className="p-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-muted-foreground">{s.branch_name ?? "-"}</td>
                  {isGlobal && <td className="p-3 text-muted-foreground">{s.company_name ?? "-"}</td>}
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted/60">
                      <Users size={12} /> {s.users_count ?? 0}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)} title="Editar"><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(s)} className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Excluir">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!listQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={isGlobal ? 5 : 4} className="p-8 text-center text-muted-foreground">
                  <Wrench className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Nenhum setor cadastrado.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open || !!editing} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Setor" : "Novo Setor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {isGlobal && !editing && (
              <div>
                <Label>Empresa</Label>
                <select
                  className="w-full mt-2 border rounded-md px-3 py-2 text-sm bg-white"
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value, branchId: "" })}
                >
                  <option value="">Selecione...</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <Label>Filial</Label>
              <select
                className="w-full mt-2 border rounded-md px-3 py-2 text-sm bg-white"
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              >
                <option value="">-- sem filial --</option>
                {branchesForCompany.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Producao" />
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
            <AlertDialogTitle>Excluir setor?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  Remover <strong>{deleting.name}</strong>?
                  {(deleting.users_count ?? 0) > 0 && (
                    <span className="block mt-2 text-rose-600 text-sm">
                      Atencao: {deleting.users_count} colaborador(es) vinculados. A operacao sera bloqueada ate reatribuir.
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
