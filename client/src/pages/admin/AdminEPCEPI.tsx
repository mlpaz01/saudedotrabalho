import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Plus, Trash2, Save, HardHat, Wrench } from "lucide-react";

type Tipo = "EPC" | "EPI";
type Status = "existente" | "recomendado" | "obrigatorio";

interface EpcEpiRow {
  id?: string;
  tipo: Tipo;
  descricao: string;
  numeroCa: string;
  riscoVinculado: string;
  periodicidadeTroca: string;
  nivelProtecao: string;
  status: Status;
}

function newRow(tipo: Tipo): EpcEpiRow {
  return {
    tipo,
    descricao: "",
    numeroCa: "",
    riscoVinculado: "",
    periodicidadeTroca: "",
    nivelProtecao: "",
    status: "recomendado",
  };
}

export default function AdminEPCEPI() {
  const [pgrId, setPgrId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tipo>("EPC");
  const [rows, setRows] = useState<EpcEpiRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState<string>("");

  const pgrList = trpc.pgr.list.useQuery();

  const epcEpiQuery = trpc.pgr.listEpcEpi.useQuery(
    { pgrId },
    {
      enabled: !!pgrId,
      onSuccess: (data: EpcEpiRow[]) => {
        if (pgrId !== hasLoaded) {
          setRows(data ?? []);
          setHasLoaded(pgrId);
        }
      },
    }
  );

  const saveMutation = trpc.pgr.saveEpcEpi.useMutation({
    onSuccess: () => {
      toast.success("Equipamentos salvos com sucesso!");
    },
    onError: (err: { message: string }) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  const visibleRows = rows.filter((r) => r.tipo === activeTab);

  function updateRow(index: number, field: keyof EpcEpiRow, value: string) {
    const globalIndex = rows.indexOf(visibleRows[index]);
    setRows((prev) => {
      const next = [...prev];
      next[globalIndex] = { ...next[globalIndex], [field]: value };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, newRow(activeTab)]);
  }

  function removeRow(index: number) {
    const globalIndex = rows.indexOf(visibleRows[index]);
    setRows((prev) => prev.filter((_, i) => i !== globalIndex));
  }

  function handleSave() {
    if (!pgrId) {
      toast.error("Selecione um PGR antes de salvar.");
      return;
    }
    saveMutation.mutate({ pgrId, items: rows });
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="text-blue-600 w-7 h-7" />
            <h1 className="text-2xl font-bold text-gray-900">
              EPC / EPI — Equipamentos de Proteção
            </h1>
          </div>
          <p className="text-gray-500 ml-10">
            Gerencie equipamentos de proteção coletiva e individual vinculados ao PGR
          </p>
        </div>

        {/* PGR Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecionar PGR
          </label>
          <Select value={pgrId} onValueChange={setPgrId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um PGR..." />
            </SelectTrigger>
            <SelectContent>
              {pgrList.data?.map((pgr: { id: string; nome: string }) => (
                <SelectItem key={pgr.id} value={pgr.id}>
                  {pgr.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("EPC")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "EPC"
                  ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Wrench className="w-4 h-4" />
              EPC — Coletivo
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                {rows.filter((r) => r.tipo === "EPC").length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("EPI")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "EPI"
                  ? "border-b-2 border-amber-500 text-amber-600 bg-amber-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <HardHat className="w-4 h-4" />
              EPI — Individual
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                {rows.filter((r) => r.tipo === "EPI").length}
              </span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {!pgrId ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Shield className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Selecione um PGR para visualizar os equipamentos</p>
              </div>
            ) : epcEpiQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <p className="text-sm">Carregando...</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Descrição
                    </th>
                    {activeTab === "EPI" && (
                      <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">
                        Nº CA
                      </th>
                    )}
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Risco Vinculado
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-40">
                      Periodicidade de Troca
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-40">
                      Nível de Proteção
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-44">
                      Status
                    </th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeTab === "EPI" ? 7 : 6}
                        className="text-center py-10 text-gray-400"
                      >
                        Nenhum equipamento cadastrado. Clique em "Adicionar" para começar.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-2">
                          <Input
                            value={row.descricao}
                            onChange={(e) => updateRow(idx, "descricao", e.target.value)}
                            placeholder="Descrição do equipamento"
                            className="h-8 text-sm"
                          />
                        </td>
                        {activeTab === "EPI" && (
                          <td className="px-4 py-2">
                            <Input
                              value={row.numeroCa}
                              onChange={(e) => updateRow(idx, "numeroCa", e.target.value)}
                              placeholder="CA nº"
                              className="h-8 text-sm"
                            />
                          </td>
                        )}
                        <td className="px-4 py-2">
                          <Input
                            value={row.riscoVinculado}
                            onChange={(e) => updateRow(idx, "riscoVinculado", e.target.value)}
                            placeholder="Ex: Ruído, Queda..."
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={row.periodicidadeTroca}
                            onChange={(e) =>
                              updateRow(idx, "periodicidadeTroca", e.target.value)
                            }
                            placeholder="Ex: 12 meses"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={row.nivelProtecao}
                            onChange={(e) =>
                              updateRow(idx, "nivelProtecao", e.target.value)
                            }
                            placeholder="Ex: Alto, Médio"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Select
                            value={row.status}
                            onValueChange={(v) => updateRow(idx, "status", v)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="existente">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                  Existente
                                </span>
                              </SelectItem>
                              <SelectItem value="recomendado">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                                  Recomendado
                                </span>
                              </SelectItem>
                              <SelectItem value="obrigatorio">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                  Obrigatório
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(idx)}
                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Actions */}
          {pgrId && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                size="sm"
                onClick={addRow}
                className={`flex items-center gap-2 ${
                  activeTab === "EPC"
                    ? "text-blue-600 border-blue-200 hover:bg-blue-50"
                    : "text-amber-600 border-amber-200 hover:bg-amber-50"
                }`}
              >
                <Plus className="w-4 h-4" />
                Adicionar {activeTab}
              </Button>

              <Button
                onClick={handleSave}
                disabled={saveMutation.isLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              EPC
            </span>
            <span>Equipamento de Proteção Coletiva</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              EPI
            </span>
            <span>Equipamento de Proteção Individual</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
