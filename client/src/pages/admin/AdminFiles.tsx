import { useState, useRef } from "react";
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
import {
  FolderOpen, Upload, Trash2, Download, FileText, FileBarChart, Shield, Loader2, Plus,
} from "lucide-react";

const DOC_TYPES = [
  { v: "pgr",    label: "PGR — Programa de Gerenciamento de Riscos" },
  { v: "drps",   label: "DRPS — Diagnóstico de Riscos Psicossociais" },
  { v: "aep",    label: "AEP — Análise Ergonômica Preliminar" },
  { v: "ltcat",  label: "LTCAT — Laudo Técnico de Condições Ambientais" },
  { v: "pca",    label: "PCA — Programa de Conservação Auditiva" },
  { v: "ppr",    label: "PPR — Programa de Proteção Respiratória" },
  { v: "pcmso",  label: "PCMSO — Programa de Controle Médico" },
  { v: "ppra",   label: "PPRA — Programa de Prevenção de Riscos" },
  { v: "laudo",  label: "Laudo Técnico" },
  { v: "nr01",   label: "Conformidade NR-01" },
  { v: "outros", label: "Outros documentos" },
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  pgr:  <Shield size={16} className="text-blue-600" />,
  drps: <FileBarChart size={16} className="text-purple-600" />,
  aep:  <FileBarChart size={16} className="text-teal-600" />,
};

function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminFiles() {
  const [filterType, setFilterType] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", docType: "pgr",
    fileBase64: "", fileName: "", mimeType: "application/pdf",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const listQ = trpc.documents.list.useQuery({ docType: filterType === "all" ? undefined : filterType || undefined });
  const docs = (listQ.data ?? []) as any[];

  const uploadMut = trpc.documents.upload.useMutation({
    onSuccess: () => {
      toast.success("Documento enviado com sucesso!");
      setShowUpload(false);
      setForm({ name: "", description: "", docType: "pgr", fileBase64: "", fileName: "", mimeType: "application/pdf" });
      listQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar documento"),
  });
  const delMut = trpc.documents.remove.useMutation({
    onSuccess: () => {
      toast.success("Documento removido");
      listQ.refetch();
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({
        ...f,
        fileBase64: ev.target?.result as string,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        name: f.name || file.name.replace(/\.[^.]+$/, ""),
      }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen size={22} className="text-primary" />
              Arquivos e Documentos SST
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Repositório centralizado de documentos: PGR, DRPS, AEP, LTCAT, PCA, PPR e demais laudos técnicos.
            </p>
          </div>
          <Button onClick={() => setShowUpload(true)} className="gap-2">
            <Plus size={14} /> Enviar documento
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm text-slate-500 whitespace-nowrap">Filtrar por tipo:</Label>
          <Select value={filterType || "all"} onValueChange={setFilterType}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-400">{docs.length} documento(s)</span>
        </div>

        {/* Document list */}
        {listQ.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white border rounded-xl">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum documento enviado ainda.</p>
            <p className="text-sm mt-1">Clique em "Enviar documento" para adicionar o primeiro arquivo.</p>
            <Button className="mt-4 gap-2" variant="outline" onClick={() => setShowUpload(true)}>
              <Upload size={14} /> Enviar primeiro documento
            </Button>
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Documento</th>
                  <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold">Tamanho</th>
                  <th className="text-left px-4 py-3 font-semibold">Enviado por</th>
                  <th className="text-left px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d: any) => (
                  <tr key={d.id} className="border-t hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {TYPE_ICON[d.docType] ?? <FileText size={16} className="text-slate-500" />}
                        <div>
                          <p className="font-medium text-slate-900">{d.name}</p>
                          {d.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{d.description}</p>
                          )}
                          <p className="text-xs text-slate-400">{d.fileName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded uppercase font-semibold tracking-wide">
                        {d.docType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatSize(d.fileSize)}</td>
                    <td className="px-4 py-3 text-slate-500">{d.uploaderName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <a href={d.fileUrl} target="_blank" rel="noreferrer" download={d.fileName}>
                          <Button variant="ghost" size="sm" title="Baixar arquivo">
                            <Download size={13} />
                          </Button>
                        </a>
                        <Button
                          variant="ghost" size="sm"
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => setDeleteTarget(d)}
                          title="Remover documento"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Upload dialog */}
        <Dialog open={showUpload} onOpenChange={(o) => !o && setShowUpload(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload size={16} /> Enviar Documento SST
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo de documento</Label>
                <Select
                  value={form.docType}
                  onValueChange={(v) => setForm((f) => ({ ...f, docType: v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Arquivo</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFile}
                />
                <div className="flex gap-2 mt-1 items-center">
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                    <Upload size={14} /> Selecionar arquivo
                  </Button>
                  {form.fileName && (
                    <span className="text-sm text-slate-600 truncate max-w-[200px]" title={form.fileName}>
                      {form.fileName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX, XLSX, CSV, TXT, JPG, PNG — máx. 10 MB</p>
              </div>

              <div>
                <Label>Nome do documento <span className="text-red-500">*</span></Label>
                <Input
                  className="mt-1"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: PGR 2026 — Setor Administrativo"
                />
              </div>

              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea
                  className="mt-1"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ciclo de validade, responsável técnico, observações..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpload(false)}>Cancelar</Button>
              <Button
                disabled={!form.fileBase64 || !form.name.trim() || uploadMut.isPending}
                onClick={() => uploadMut.mutate({
                  name: form.name,
                  description: form.description || undefined,
                  docType: form.docType,
                  fileBase64: form.fileBase64,
                  fileName: form.fileName,
                  mimeType: form.mimeType,
                })}
                className="gap-2"
              >
                {uploadMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Enviar documento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover documento?</AlertDialogTitle>
              <AlertDialogDescription>
                O arquivo <b>{deleteTarget?.name}</b> ({deleteTarget?.fileName}) será excluído permanentemente do
                servidor. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 hover:bg-rose-700"
                onClick={() => delMut.mutate({ id: deleteTarget.id })}
              >
                Remover permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
