import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Download,
  FileArchive,
  FileText,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

const categories = [
  ["atestados", "Atestados"],
  ["epi_epc", "EPI/EPC"],
  ["vacinacao", "Vacinação"],
  ["treinamentos", "Treinamentos"],
  ["certificados", "Certificados"],
  ["qualificacoes", "Qualificações e habilitações"],
  ["exames", "Exames"],
  ["documentos_externos", "Documentos externos"],
  ["outros", "Outros"],
] as const;

function saveDataUrl(dataUrl: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function dateText(value: unknown) {
  if (!value) return "Data não informada";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("pt-BR");
}

function SourceList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: any[];
  empty: string;
}) {
  return (
    <section className="border bg-white">
      <header className="border-b px-4 py-3">
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </header>
      <div className="divide-y">
        {rows.map((row, index) => (
          <div
            className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
            key={`${title}-${row.id}-${index}`}
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-900">
                {row.title || "Registro sem título"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {dateText(row.created_at)}
                {row.reference ? ` · ${row.reference}` : ""}
                {row.status ? ` · ${row.status}` : ""}
                {row.dose_number ? ` · Dose ${row.dose_number}` : ""}
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-sm">
              Integrado
            </Badge>
          </div>
        ))}
        {!rows.length && (
          <p className="px-4 py-5 text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </section>
  );
}

export default function EmployeeDossier({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const dossier = trpc.medical.getDossier.useQuery(
    { collaboratorId: id },
    { enabled: id > 0 }
  );
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof categories)[number][0]>(
    "documentos_externos"
  );
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const upload = trpc.medical.addDossierDocument.useMutation({
    onSuccess: () => {
      toast.success("Documento arquivado no dossiê.");
      setOpen(false);
      setTitle("");
      setFile(null);
      dossier.refetch();
    },
    onError: error => toast.error(error.message),
  });

  async function submit() {
    if (!file || !title.trim()) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 12 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      upload.mutate({
        collaboratorId: id,
        category,
        title: title.trim(),
        fileName: file.name,
        fileBase64: String(reader.result),
      });
    reader.onerror = () => toast.error("Não foi possível ler o arquivo.");
    reader.readAsDataURL(file);
  }

  async function download(documentId: number) {
    try {
      const result = await (utils as any).client.medical.downloadPrivate.query({
        kind: "dossier",
        id: documentId,
      });
      saveDataUrl(result.dataBase64, result.fileName);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível baixar o documento.");
    }
  }

  if (dossier.isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">
          Carregando dossiê...
        </div>
      </AppLayout>
    );
  }
  if (!dossier.data || dossier.error) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-rose-700">
          {dossier.error?.message || "Colaborador não localizado."}
        </div>
      </AppLayout>
    );
  }

  const { patient, documents, integrations } = dossier.data as any;

  return (
    <AppLayout>
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <button
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setLocation(`/admin/colaboradores/${id}`)}
        >
          <ArrowLeft size={16} /> Voltar para a Visão 360
        </button>

        <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-700">
              <FileArchive size={17} /> Dossiê documental
            </div>
            <h1 className="text-2xl font-bold text-slate-950">
              {patient.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {patient.cpf || "CPF não informado"} ·{" "}
              {patient.position || "Cargo não informado"} ·{" "}
              {patient.branch_name || "Sem filial"} /{" "}
              {patient.sector_name || "Sem setor"}
            </p>
          </div>
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus size={16} /> Adicionar documento
          </Button>
        </header>

        <div className="border-l-4 border-teal-600 bg-teal-50 p-4 text-sm text-teal-950">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 shrink-0" size={20} />
            <p>
              <b>Integração sem duplicidade.</b> Certificados, EPI/EPC,
              vacinação e afastamentos abaixo são referências dos módulos de
              origem. O prontuário clínico continua restrito à Central Médica e
              não é exposto neste dossiê administrativo.
            </p>
          </div>
        </div>

        <section className="border bg-white">
          <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="font-semibold text-slate-900">
                Documentos adicionados ao dossiê
              </h2>
              <p className="text-xs text-slate-500">
                Arquivos externos preservados em armazenamento privado.
              </p>
            </div>
            <Badge variant="outline" className="rounded-sm">
              {documents.length} arquivo(s)
            </Badge>
          </header>
          <div className="divide-y">
            {documents.map((row: any) => (
              <div
                className="flex items-center justify-between gap-3 px-4 py-3"
                key={row.id}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {row.title}
                  </div>
                  <div className="text-xs text-slate-500">
                    {categories.find(item => item[0] === row.category)?.[1] ||
                      row.category}{" "}
                    · {dateText(row.created_at)} · {row.file_name}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Baixar documento"
                  onClick={() => download(Number(row.id))}
                >
                  <Download size={16} />
                </Button>
              </div>
            ))}
            {!documents.length && (
              <p className="px-4 py-5 text-sm text-slate-500">
                Nenhum documento externo foi adicionado.
              </p>
            )}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <SourceList
            title="Certificados e treinamentos"
            rows={integrations.certificates || []}
            empty="Nenhum certificado emitido."
          />
          <SourceList
            title="Entregas de EPI/EPC"
            rows={integrations.epiEpc || []}
            empty="Nenhuma entrega registrada."
          />
          <SourceList
            title="Vacinação"
            rows={integrations.vaccinations || []}
            empty="Nenhuma vacinação registrada."
          />
          <SourceList
            title="Atestados e afastamentos"
            rows={integrations.leaves || []}
            empty="Nenhum afastamento administrativo registrado."
          />
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar documento ao dossiê</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-1 text-sm">
              <span>Categoria</span>
              <select
                className="border bg-white p-2"
                value={category}
                onChange={event => setCategory(event.target.value as any)}
              >
                {categories.map(item => (
                  <option key={item[0]} value={item[0]}>
                    {item[1]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Título</span>
              <Input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Identifique o documento"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Arquivo</span>
              <Input
                type="file"
                onChange={event => setFile(event.target.files?.[0] || null)}
              />
            </label>
            <p className="text-xs text-slate-500">
              <FileText className="mr-1 inline" size={13} /> O arquivo original
              será preservado com usuário, data e hora do envio.
            </p>
            <Button
              disabled={!file || !title.trim() || upload.isPending}
              onClick={submit}
            >
              {upload.isPending ? "Arquivando..." : "Arquivar documento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
