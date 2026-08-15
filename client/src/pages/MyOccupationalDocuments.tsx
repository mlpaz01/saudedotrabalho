import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  ClipboardCheck,
  Download,
  FileCheck2,
  FileClock,
  FlaskConical,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

type DocumentKind = "exam_order" | "aso" | "exam_result" | "referral";

function date(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString("pt-BR");
}

function saveDataUrl(dataBase64: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataBase64;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function MyOccupationalDocuments() {
  const query = trpc.occupationalLifecycle.myOccupationalDocuments.useQuery();
  const download =
    trpc.occupationalLifecycle.downloadMyOccupationalDocument.useMutation({
      onSuccess: result => saveDataUrl(result.dataBase64, result.fileName),
      onError: error =>
        toast.error(error.message || "Documento não disponível."),
    });
  const data = query.data || {
    orders: [],
    asos: [],
    results: [],
    referrals: [],
  };

  function downloadDocument(kind: DocumentKind, id: number) {
    download.mutate({ kind, id });
  }

  return (
    <AppLayout>
      <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Stethoscope size={24} /> Documentos Ocupacionais
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Segundas vias digitais emitidas exclusivamente para o seu cadastro.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Requisições vigentes" value={data.orders.length} />
          <Metric label="ASOs finalizados" value={data.asos.length} />
          <Metric label="Resultados disponíveis" value={data.results.length} />
          <Metric label="Encaminhamentos" value={data.referrals.length} />
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-4">
            <TabsTrigger value="orders">Minhas Requisições</TabsTrigger>
            <TabsTrigger value="asos">Meus ASOs</TabsTrigger>
            <TabsTrigger value="results">Meus Resultados</TabsTrigger>
            <TabsTrigger value="referrals">Meus Encaminhamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <DocumentList
              loading={query.isLoading}
              empty="Nenhuma requisição vigente foi emitida para você."
              icon={<FileClock size={30} />}
            >
              {data.orders.map((row: any) => (
                <DocumentRow
                  key={row.id}
                  title={row.exam_name}
                  subtitle={`${row.order_number} · ${row.provider_name || "Prestador a definir"}`}
                  details={`Emissão: ${date(row.issue_date)} · Válida até: ${date(row.valid_until)}${Number(row.version_number || 1) > 1 ? ` · Versão ${row.version_number}` : ""}`}
                  status="Vigente"
                  onDownload={() => downloadDocument("exam_order", Number(row.id))}
                  busy={download.isPending}
                />
              ))}
            </DocumentList>
          </TabsContent>

          <TabsContent value="asos">
            <DocumentList
              loading={query.isLoading}
              empty="Nenhum ASO finalizado foi disponibilizado."
              icon={<FileCheck2 size={30} />}
            >
              {data.asos.map((row: any) => (
                <DocumentRow
                  key={row.id}
                  title={`ASO ${String(row.aso_type || "ocupacional").replaceAll("_", " ")}`}
                  subtitle={`Conclusão: ${String(row.fitness_status || "-").toUpperCase()}`}
                  details={`Emitido em ${date(row.issued_at)}`}
                  status="Finalizado"
                  onDownload={() => downloadDocument("aso", Number(row.id))}
                  busy={download.isPending}
                />
              ))}
            </DocumentList>
          </TabsContent>

          <TabsContent value="results">
            <DocumentList
              loading={query.isLoading}
              empty="Nenhum resultado de exame identificado para o seu cadastro."
              icon={<FlaskConical size={30} />}
            >
              {data.results.map((row: any) => (
                <DocumentRow
                  key={row.id}
                  title={row.exam_name}
                  subtitle={row.laboratory_name || "Laboratório não informado"}
                  details={`Realizado em ${date(row.performed_at)} · Situação: ${String(row.classification || "pendente de revisão").replaceAll("_", " ")}`}
                  status="Identidade confirmada"
                  onDownload={() =>
                    downloadDocument("exam_result", Number(row.id))
                  }
                  busy={download.isPending}
                />
              ))}
            </DocumentList>
          </TabsContent>

          <TabsContent value="referrals">
            <DocumentList
              loading={query.isLoading}
              empty="Nenhum encaminhamento foi emitido para você."
              icon={<ClipboardCheck size={30} />}
            >
              {data.referrals.map((row: any) => (
                <DocumentRow
                  key={row.id}
                  title={
                    row.destination_name ||
                    String(row.destination_type || "Encaminhamento").replaceAll(
                      "_",
                      " "
                    )
                  }
                  subtitle={`Médico: ${row.doctor_name || "não informado"}`}
                  details={`Emitido em ${date(row.referral_date)}`}
                  status="Disponível"
                  onDownload={() =>
                    downloadDocument("referral", Number(row.id))
                  }
                  busy={download.isPending}
                />
              ))}
            </DocumentList>
          </TabsContent>
        </Tabs>

        <p className="border-l-4 border-primary bg-white p-3 text-xs text-muted-foreground">
          Cada consulta é vinculada à sua sessão autenticada. Documentos de
          outros colaboradores não são exibidos nem aceitos pelo download.
        </p>
      </main>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold text-primary">{value}</div>
    </div>
  );
}

function DocumentList({
  loading,
  empty,
  icon,
  children,
}: {
  loading: boolean;
  empty: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  if (loading)
    return <div className="border bg-white p-10 text-center">Carregando...</div>;
  if (!count)
    return (
      <div className="border bg-white p-10 text-center text-muted-foreground">
        <div className="mx-auto mb-3 w-fit">{icon}</div>
        {empty}
      </div>
    );
  return <div className="divide-y border bg-white">{children}</div>;
}

function DocumentRow({
  title,
  subtitle,
  details,
  status,
  onDownload,
  busy,
}: {
  title: string;
  subtitle: string;
  details: string;
  status: string;
  onDownload: () => void;
  busy: boolean;
}) {
  return (
    <article className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <span className="bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            {status}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{details}</p>
      </div>
      <Button variant="outline" onClick={onDownload} disabled={busy}>
        <Download size={15} /> Baixar
      </Button>
    </article>
  );
}
