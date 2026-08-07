import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Syringe, CalendarDays, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";

export default function MyVaccines() {
  const utils = trpc.useUtils();
  const query = trpc.medical.myVaccinations.useQuery();
  const records = (query.data || []) as any[];

  async function downloadReceipt(id: number) {
    try {
      const result = await (utils as any).client.medical.downloadPrivate.query({
        kind: "vaccination_receipt",
        id,
      });
      const anchor = document.createElement("a");
      anchor.href = result.dataBase64;
      anchor.download = result.fileName;
      anchor.click();
    } catch (error: any) {
      toast.error(error?.message || "Comprovante não disponível.");
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Minhas Vacinas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Histórico de doses, próximas aplicações e comprovantes registrados
            pela empresa.
          </p>
        </div>
        {query.isLoading ? (
          <p>Carregando...</p>
        ) : !records.length ? (
          <div className="border bg-white p-10 text-center text-slate-500">
            <Syringe className="mx-auto mb-3" />
            <p>Nenhuma vacinação registrada.</p>
          </div>
        ) : (
          <div className="divide-y border bg-white">
            {records.map(row => (
              <div
                key={row.id}
                className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-600" size={18} />
                    <b>{row.vaccine_name}</b>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Dose {row.dose_number} de {row.dose_count} · Lote{" "}
                    {row.lot || "não informado"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.manufacturer || "Fabricante não informado"} ·{" "}
                    {row.location || "Local não informado"}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 text-sm sm:items-end">
                  <div className="flex items-center gap-1">
                    <CalendarDays size={14} />
                    {new Date(row.vaccination_date).toLocaleDateString("pt-BR")}
                  </div>
                  {row.next_dose_date && (
                    <div className="text-amber-700">
                      Próxima dose:{" "}
                      {new Date(row.next_dose_date).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                  {Number(row.has_receipt) === 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadReceipt(Number(row.id))}
                    >
                      <Download size={14} className="mr-1" /> Comprovante
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
