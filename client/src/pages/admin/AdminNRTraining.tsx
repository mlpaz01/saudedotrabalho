import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { GraduationCap, Plus, Trash2, Edit, Loader2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const NR_LIST = [
  "NR-01","NR-05","NR-06","NR-07","NR-08","NR-09","NR-10","NR-11","NR-12","NR-13",
  "NR-14","NR-15","NR-16","NR-17","NR-18","NR-20","NR-21","NR-23","NR-25","NR-26",
  "NR-32","NR-33","NR-34","NR-35","NR-36","NR-37","CIPA","Brigada de Incêndio",
  "Primeiros Socorros","Direção Defensiva","Outros",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  em_dia:   { label: "Em dia",   color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={13} /> },
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700",     icon: <Clock size={13} /> },
  vencido:  { label: "Vencido",  color: "bg-rose-100 text-rose-700",       icon: <AlertTriangle size={13} /> },
};

function emptyForm() {
  return {
    nrCode: "NR-01", trainingName: "", durationHours: "", validityMonths: "12",
    dueDate: "", status: "pendente", pendingCount: "0", notes: "",
  };
}

export default function AdminNRTraining() {
  const [filterNr, setFilterNr] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm());

  const listQ = trpc.nrTraining.list.useQuery({ nrCode: filterNr || undefined });
  const records = (listQ.data ?? []) as any[];

  const overdue = records.filter(r => r.status === "vencido").length;
  const pending = records.filter(r => r.status === "pendente").length;
  const ok = records.filter(r => r.status === "em_dia").length;

  const upsertMut = trpc.nrTraining.upsert.useMutation({
    onSuccess: () => {
      toast.success(editId ? "Treinamento atualizado!" : "Treinamento cadastrado!");
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      listQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });
  const delMut = trpc.nrTraining.remove.useMutation({
    onSuccess: () => {
      toast.success("Registro removido");
      listQ.refetch();
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  function openEdit(rec: any) {
    setEditId(rec.id);
    setForm({
      nrCode: rec.nrCode, trainingName: rec.trainingName,
      durationHours: rec.durationHours ? String(rec.durationHours) : "",
      validityMonths: rec.validityMonths ? String(rec.validityMonths) : "12",
      dueDate: rec.dueDate ?? "", status: rec.status,
      pendingCount: String(rec.pendingCount ?? 0), notes: rec.notes ?? "",
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.trainingName.trim()) { toast.error("Informe o nome do treinamento"); return; }
    upsertMut.mutate({
      id: editId ?? undefined,
      nrCode: form.nrCode,
      trainingName: form.trainingName,
      durationHours: form.durationHours ? Number(form.durationHours) : undefined,
      validityMonths: form.validityMonths ? Number(form.validityMonths) : undefined,
      dueDate: form.dueDate || null,
      status: form.status,
      pendingCount: Number(form.pendingCount) || 0,
      notes: form.notes || undefined,
    });
  }

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap size={22} className="text-primary" />
              Controle de Treinamentos NR
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestão de treinamentos obrigatórios por norma regulamentadora — vencimentos, pendências e evidências.
            </p>
          </div>
          <Button onClick={() => { setEditId(null); setForm(emptyForm()); setShowForm(true); }} className="gap-2">
            <Plus size={14} /> Novo treinamento
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
            <AlertTriangle size={20} className="text-rose-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-rose-700">{overdue}</p>
            <p className="text-xs text-rose-600">Vencidos</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <Clock size={20} className="text-amber-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-700">{pending}</p>
            <p className="text-xs text-amber-600">Pendentes</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <CheckCircle2 size={20} className="text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-700">{ok}</p>
            <p className="text-xs text-emerald-600">Em dia</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm text-slate-500 whitespace-nowrap">Filtrar por NR:</Label>
          <Select value={filterNr} onValueChange={setFilterNr}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todas as NRs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as NRs</SelectItem>
              {NR_LIST.map(nr => <SelectItem key={nr} value={nr}>{nr}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-400">{records.length} registro(s)</span>
        </div>

        {/* Training list */}
        {listQ.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white border rounded-xl">
            <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum treinamento cadastrado ainda.</p>
            <p className="text-sm mt-1">Cadastre os treinamentos obrigatórios por NR para sua empresa.</p>
            <Button className="mt-4 gap-2" variant="outline" onClick={() => { setEditId(null); setForm(emptyForm()); setShowForm(true); }}>
              <Plus size={14} /> Cadastrar primeiro treinamento
            </Button>
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">NR</th>
                  <th className="text-left px-4 py-3 font-semibold">Treinamento</th>
                  <th className="text-left px-4 py-3 font-semibold">Validade</th>
                  <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                  <th className="text-left px-4 py-3 font-semibold">Pendentes</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => {
                  const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG["pendente"];
                  return (
                    <tr key={r.id} className="border-t hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">{r.nrCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.trainingName}</p>
                        {r.durationHours && (
                          <p className="text-xs text-slate-500">{r.durationHours}h de carga horária</p>
                        )}
                        {r.notes && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{r.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {r.validityMonths ? `${r.validityMonths} meses` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {r.dueDate ? new Date(r.dueDate).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.pendingCount > 0 ? (
                          <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-semibold">{r.pendingCount} colaboradores</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="Editar">
                            <Edit size={13} />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => setDeleteTarget(r)}
                            title="Remover"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Form dialog */}
        <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap size={16} /> {editId ? "Editar Treinamento" : "Novo Treinamento NR"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>NR relacionada</Label>
                  <Select value={form.nrCode} onValueChange={(v) => setF("nrCode", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NR_LIST.map(nr => <SelectItem key={nr} value={nr}>{nr}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setF("status", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_dia">Em dia</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Treinamento obrigatório <span className="text-red-500">*</span></Label>
                <Input className="mt-1" value={form.trainingName} onChange={e => setF("trainingName", e.target.value)}
                  placeholder="Ex: Treinamento NR-10 — Segurança em Instalações Elétricas" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Carga horária (h)</Label>
                  <Input className="mt-1" type="number" value={form.durationHours}
                    onChange={e => setF("durationHours", e.target.value)} placeholder="Ex: 40" />
                </div>
                <div>
                  <Label>Validade (meses)</Label>
                  <Input className="mt-1" type="number" value={form.validityMonths}
                    onChange={e => setF("validityMonths", e.target.value)} placeholder="12" />
                </div>
                <div>
                  <Label>Colaboradores pendentes</Label>
                  <Input className="mt-1" type="number" value={form.pendingCount}
                    onChange={e => setF("pendingCount", e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>Data de vencimento</Label>
                <Input className="mt-1" type="date" value={form.dueDate} onChange={e => setF("dueDate", e.target.value)} />
              </div>
              <div>
                <Label>Notas / observações (opcional)</Label>
                <Textarea className="mt-1" value={form.notes} onChange={e => setF("notes", e.target.value)}
                  placeholder="Certificados necessários, local do treinamento, fornecedor..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button disabled={!form.trainingName.trim() || upsertMut.isPending} onClick={handleSave} className="gap-2">
                {upsertMut.isPending && <Loader2 size={14} className="animate-spin" />}
                {editId ? "Salvar alterações" : "Cadastrar treinamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover registro?</AlertDialogTitle>
              <AlertDialogDescription>
                O treinamento <b>{deleteTarget?.trainingName}</b> ({deleteTarget?.nrCode}) será excluído permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 hover:bg-rose-700"
                onClick={() => delMut.mutate({ id: deleteTarget.id })}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
