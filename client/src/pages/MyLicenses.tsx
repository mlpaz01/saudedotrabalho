import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { IdCard, Plus, Edit2, Trash2 } from "lucide-react";

function daysUntil(dt: any): number {
  if (!dt) return Infinity;
  return Math.ceil((new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtDate(dt: any) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("pt-BR");
}

function StatusBadge({ expiresAt }: { expiresAt: any }) {
  if (!expiresAt) return <Badge variant="secondary">Sem vencimento</Badge>;
  const d = daysUntil(expiresAt);
  if (d < 0) return <Badge className="bg-red-500 text-white">🔴 Vencida há {Math.abs(d)}d</Badge>;
  if (d <= 30) return <Badge className="bg-yellow-500 text-white">🟡 Vence em {d}d</Badge>;
  return <Badge className="bg-green-500 text-white">🟢 Válida</Badge>;
}

interface LicenseForm {
  id?: number;
  licenseType: string;
  licenseNumber: string;
  issuedAt: string;
  expiresAt: string;
  documentUrl: string;
  notes: string;
}

const emptyForm: LicenseForm = {
  licenseType: "",
  licenseNumber: "",
  issuedAt: "",
  expiresAt: "",
  documentUrl: "",
  notes: "",
};

export default function MyLicenses() {
  const { data: licenses, refetch } = trpc.licenses.list.useQuery();
  const createMut = trpc.licenses.create.useMutation();
  const updateMut = trpc.licenses.update.useMutation();
  const deleteMut = trpc.licenses.delete.useMutation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LicenseForm>(emptyForm);

  const handleSave = async () => {
    if (!form.licenseType.trim()) { toast.error("Tipo de licença obrigatório"); return; }
    try {
      if (form.id) {
        await updateMut.mutateAsync({
          id: form.id,
          licenseType: form.licenseType,
          licenseNumber: form.licenseNumber || undefined,
          issuedAt: form.issuedAt || undefined,
          expiresAt: form.expiresAt || undefined,
          documentUrl: form.documentUrl || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Licença atualizada");
      } else {
        await createMut.mutateAsync({
          licenseType: form.licenseType,
          licenseNumber: form.licenseNumber || undefined,
          issuedAt: form.issuedAt || undefined,
          expiresAt: form.expiresAt || undefined,
          documentUrl: form.documentUrl || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Licença adicionada");
      }
      setOpen(false);
      setForm(emptyForm);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  };

  const handleEdit = (l: any) => {
    setForm({
      id: l.id,
      licenseType: l.licenseType ?? "",
      licenseNumber: l.licenseNumber ?? "",
      issuedAt: l.issuedAt ? new Date(l.issuedAt).toISOString().slice(0, 10) : "",
      expiresAt: l.expiresAt ? new Date(l.expiresAt).toISOString().slice(0, 10) : "",
      documentUrl: l.documentUrl ?? "",
      notes: l.notes ?? "",
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta licença?")) return;
    await deleteMut.mutateAsync({ id });
    toast.success("Licença removida");
    refetch();
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IdCard className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Minhas Licenças</h1>
              <p className="text-sm text-muted-foreground">CNH, ART, certificações profissionais</p>
            </div>
          </div>
          <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Adicionar licença
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(licenses ?? []).length === 0 ? (
            <Card className="md:col-span-2">
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma licença cadastrada. Adicione sua primeira!
              </CardContent>
            </Card>
          ) : (
            (licenses ?? []).map((l: any) => (
              <Card key={l.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold">{l.licenseType}</h3>
                      {l.licenseNumber && <p className="text-sm text-muted-foreground">Nº {l.licenseNumber}</p>}
                    </div>
                    <StatusBadge expiresAt={l.expiresAt} />
                  </div>
                  <div className="text-sm space-y-1 mb-3">
                    <p><span className="text-muted-foreground">Emitida em:</span> {fmtDate(l.issuedAt)}</p>
                    <p><span className="text-muted-foreground">Vence em:</span> {fmtDate(l.expiresAt)}</p>
                    {l.notes && <p className="text-xs text-muted-foreground italic mt-2">{l.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(l)} className="gap-1">
                      <Edit2 className="w-3 h-3" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(l.id)} className="gap-1 text-red-600">
                      <Trash2 className="w-3 h-3" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar licença" : "Adicionar licença"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm font-medium">Tipo *</label>
                <Input placeholder="Ex: CNH, ART, NR-10" value={form.licenseType} onChange={e => setForm({ ...form, licenseType: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Número</label>
                <Input value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Emitida em</label>
                  <Input type="date" value={form.issuedAt} onChange={e => setForm({ ...form, issuedAt: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Vence em</label>
                  <Input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">URL do documento</label>
                <Input placeholder="https://..." value={form.documentUrl} onChange={e => setForm({ ...form, documentUrl: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Observações</label>
                <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
