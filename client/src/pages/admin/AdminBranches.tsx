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
import { Store, Plus, Search, Pencil, Trash2, MapPin, Users, Layers } from "lucide-react";
import { toast } from "sonner";

const UF = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

type BranchRow = {
  id: number;
  company_id: number;
  name: string;
  city?: string | null;
  state?: string | null;
  company_name?: string | null;
  sectors_count?: number | null;
  users_count?: number | null;
};

type FormState = { name: string; city: string; state: string; companyId: string };

const EMPTY: FormState = { name: "", city: "", state: "", companyId: "" };

export default function AdminBranches() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isGlobal = user?.role === "admin_global" || user?.role === "super_admin";

  const [selectedCompany, setSelectedCompany] = useState<number | "all">("all");
  const companiesQ = trpc.companies.list.useQuery(undefined, { enabled: isGlobal });
  const listQ = trpc.branchesAdmin.list.useQuery(
    isGlobal && selectedCompany !== "all" ? { companyId: Number(selectedCompany) } : {}
  );

  const createMut = trpc.branchesAdmin.create.useMutation({
    onSuccess: () => { toast.success("Filial criada"); utils.branchesAdmin.list.invalidate(); setOpen(false); setForm(EMPTY); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.branchesAdmin.update.useMutation({
    onSuccess: () => { toast.success("Filial atualizada"); utils.branchesAdmin.list.invalidate(); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.branchesAdmin.delete.useMutation({
    onSuccess: () => { toast.success("Filial excluida"); utils.branchesAdmin.list.invalidate(); setDeleting(null); },
    onError: (e) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [deleting, setDeleting] = useState<BranchRow | null>(null);

  const branches: BranchRow[] = (listQ.data ?? []) as any;
  const companies = (companiesQ.data ?? []) as any[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) =>
      String(b.name ?? "").toLowerCase().includes(q) ||
      String(b.city ?? "").toLowerCase().includes(q) ||
      String(b.company_name ?? "").toLowerCase().includes(q)
    );
  }, [branches, search]);

  function openEdit(b: BranchRow) {
    setEditing(b);
    setForm({ name: b.name ?? "", city: b.city ?? "", state: b.state ?? "", companyId: String(b.company_id ?? "") });
  }

  function openCreate() {
    setForm({ ...EMPTY, companyId: isGlobal ? (selectedCompany !== "all" ? String(selectedCompany) : "") : "" });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (isGlobal && !editing && !form.companyId) { toast.error("Selecione a empresa"); return; }
    const base = {
      name: form.name.trim(),
      city: form.city.trim() || undefined,
      state: form.state.trim() ? form.state.trim().toUpperCase() : undefined,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, ...base });
    } else {
      createMut.mutate({
        ...base,
        companyId: isGlobal && form.companyId ? Number(form.companyId) : undefined,
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
                <Store className="w-7 h-7" /> Filiais
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {listQ.isLoading ? "Carregando..." : `${filtered.length} filial(is)`}
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova Filial</Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {isGlobal && (
            <select
              className="border border-border rounded-md px-3 py-2 text-sm bg-white"
              value={String(selectedCompany)}
              onChange={(e) => setSelectedCompany(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">Empresa: todas</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        <div className="bg-white rounded-xl border border-border overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Nome</th>
                {isGlobal && <th className="p-3 text-left">Empresa</th>}
                <th className="p-3 text-left">Cidade/UF</th>
                <th className="p-3 text-center">Setores</th>
                <th className="p-3 text-center">Colab.</th>
                <th className="p-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{b.name}</td>
                  {isGlobal && <td className="p-3 text-muted-foreground">{b.company_name ?? "-"}</td>}
                  <td className="p-3 text-muted-foreground">
                    {b.city || b.state ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} /> {b.city ?? "-"}{b.state ? `/${b.state}` : ""}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted/60">
                      <Layers size={12} /> {b.sectors_count ?? 0}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted/60">
                      <Users size={12} /> {b.users_count ?? 0}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)} title="Editar"><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(b)} className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Excluir">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!listQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={isGlobal ? 6 : 5} className="p-8 text-center text-muted-foreground">
                  <Store className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Nenhuma filial cadastrada.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open || !!editing} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Filial" : "Nova Filial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {isGlobal && !editing && (
              <div>
                <Label>Empresa *</Label>
                <select
                  className="w-full mt-2 border rounded-md px-3 py-2 text-sm bg-white"
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Matriz SP" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Sao Paulo" />
              </div>
              <div>
                <Label>UF</Label>
                <select
                  className="w-full mt-2 border rounded-md px-3 py-2 text-sm bg-white"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                >
                  <option value="">--</option>
                  {UF.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
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
            <AlertDialogTitle>Excluir filial?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  Remover <strong>{deleting.name}</strong>?
                  {((deleting.sectors_count ?? 0) > 0 || (deleting.users_count ?? 0) > 0) && (
                    <span className="block mt-2 text-rose-600 text-sm">
                      Atencao: {deleting.sectors_count ?? 0} setor(es) e {deleting.users_count ?? 0} colaborador(es) vinculados. A operacao sera bloqueada ate reatribuir.
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
