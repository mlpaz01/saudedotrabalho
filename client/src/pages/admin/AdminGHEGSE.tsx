import { useState, useMemo } from "react";
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
import { Plus, Trash2, Save, Layers } from "lucide-react";

interface GheGseRow {
  id?: string;
  nome: string;
  tipo: string;
  setor: string;
  funcao: string;
  atividade: string;
  qtdExpostos: string;
  jornada: string;
  ambienteOperacional: string;
}

function emptyRow(): GheGseRow {
  return {
    nome: "",
    tipo: "GHE",
    setor: "",
    funcao: "",
    atividade: "",
    qtdExpostos: "",
    jornada: "",
    ambienteOperacional: "",
  };
}

export default function AdminGHEGSE() {
  const [selectedPgrId, setSelectedPgrId] = useState<string>("");
  const [rows, setRows] = useState<GheGseRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const { data: pgrList, isLoading: pgrLoading } = trpc.pgr.list.useQuery();

  const {
    data: gheGseData,
    isLoading: gheGseLoading,
    isError: gheGseError,
    refetch,
  } = trpc.pgr.listGheGse.useQuery(
    { pgrId: selectedPgrId },
    {
      enabled: !!selectedPgrId,
      onSuccess: (data: GheGseRow[]) => {
        setRows(
          data.map((item: GheGseRow) => ({
            id: item.id,
            nome: item.nome ?? "",
            tipo: item.tipo ?? "GHE",
            setor: item.setor ?? "",
            funcao: item.funcao ?? "",
            atividade: item.atividade ?? "",
            qtdExpostos: item.qtdExpostos != null ? String(item.qtdExpostos) : "",
            jornada: item.jornada ?? "",
            ambienteOperacional: item.ambienteOperacional ?? "",
          }))
        );
        setIsDirty(false);
      },
      onError: () => {
        toast.error("Erro ao carregar GHE/GSE. Tente novamente.");
      },
    }
  );

  const saveMutation = trpc.pgr.saveGheGse.useMutation({
    onSuccess: () => {
      toast.success("GHE/GSE salvos com sucesso!");
      setIsDirty(false);
      refetch();
    },
    onError: (err: { message?: string }) => {
      toast.error(`Erro ao salvar: ${err.message ?? "Tente novamente."}`);
    },
  });

  const pgrOptions = useMemo(() => {
    if (!pgrList) return [];
    return pgrList.map((pgr: { id: string; razaoSocial?: string; title?: string }) => ({
      value: pgr.id,
      label: [pgr.razaoSocial, pgr.title].filter(Boolean).join(" — "),
    }));
  }, [pgrList]);

  function handlePgrChange(value: string) {
    setSelectedPgrId(value);
    setRows([]);
    setIsDirty(false);
  }

  function handleAddRow() {
    setRows((prev) => [...prev, emptyRow()]);
    setIsDirty(true);
  }

  function handleDeleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }

  function handleCellChange(
    index: number,
    field: keyof GheGseRow,
    value: string
  ) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
    setIsDirty(true);
  }

  function handleSave() {
    if (!selectedPgrId) {
      toast.error("Selecione um PGR antes de salvar.");
      return;
    }
    saveMutation.mutate({
      pgrId: selectedPgrId,
      items: rows.map((row) => ({
        id: row.id,
        nome: row.nome,
        tipo: row.tipo,
        setor: row.setor,
        funcao: row.funcao,
        atividade: row.atividade,
        qtdExpostos: row.qtdExpostos !== "" ? Number(row.qtdExpostos) : null,
        jornada: row.jornada,
        ambienteOperacional: row.ambienteOperacional,
      })),
    });
  }

  const isLoading = gheGseLoading && !!selectedPgrId;

  return (
    <AppLayout>
      <div className="p-6 max-w-screen-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Layers className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              GHE / GSE — Grupos Homogêneos de Exposição
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Defina grupos de trabalhadores com exposição similar para cada PGR
            </p>
          </div>
        </div>

        {/* PGR Selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecionar PGR
          </label>
          {pgrLoading ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-md w-80" />
          ) : (
            <Select value={selectedPgrId} onValueChange={handlePgrChange}>
              <SelectTrigger className="w-full max-w-lg">
                <SelectValue placeholder="Selecione um PGR..." />
              </SelectTrigger>
              <SelectContent>
                {pgrOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    Nenhum PGR encontrado
                  </SelectItem>
                ) : (
                  pgrOptions.map(
                    (opt: { value: string; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    )
                  )
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table Card */}
        {selectedPgrId && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">
                {isLoading
                  ? "Carregando..."
                  : `${rows.length} grupo(s) cadastrado(s)`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  disabled={isLoading || saveMutation.isLoading}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar linha
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={
                    !isDirty || isLoading || saveMutation.isLoading
                  }
                >
                  <Save className="w-4 h-4 mr-1" />
                  {saveMutation.isLoading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="p-8 text-center text-gray-400 text-sm">
                <div className="flex justify-center mb-2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                Carregando grupos...
              </div>
            )}

            {/* Error State */}
            {gheGseError && !isLoading && (
              <div className="p-8 text-center text-red-500 text-sm">
                Erro ao carregar os dados. Verifique a conexão e tente novamente.
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !gheGseError && rows.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Layers className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                Nenhum grupo cadastrado. Clique em "Adicionar linha" para
                começar.
              </div>
            )}

            {/* Table */}
            {!isLoading && rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 sticky top-0 z-10">
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        Nome do Grupo
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        Tipo
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        Setor
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        Função
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        Atividade
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        Qtd Expostos
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        Jornada
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        Ambiente Operacional
                      </th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, index) => (
                      <tr
                        key={row.id ?? `new-${index}`}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-3 py-1.5 min-w-[140px]">
                          <Input
                            value={row.nome}
                            onChange={(e) =>
                              handleCellChange(index, "nome", e.target.value)
                            }
                            placeholder="Nome do grupo"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5 min-w-[100px]">
                          <Select
                            value={row.tipo}
                            onValueChange={(value) =>
                              handleCellChange(index, "tipo", value)
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GHE">GHE</SelectItem>
                              <SelectItem value="GSE">GSE</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-1.5 min-w-[130px]">
                          <Input
                            value={row.setor}
                            onChange={(e) =>
                              handleCellChange(index, "setor", e.target.value)
                            }
                            placeholder="Setor"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5 min-w-[130px]">
                          <Input
                            value={row.funcao}
                            onChange={(e) =>
                              handleCellChange(index, "funcao", e.target.value)
                            }
                            placeholder="Função"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5 min-w-[150px]">
                          <Input
                            value={row.atividade}
                            onChange={(e) =>
                              handleCellChange(
                                index,
                                "atividade",
                                e.target.value
                              )
                            }
                            placeholder="Atividade"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5 min-w-[100px]">
                          <Input
                            type="number"
                            min={0}
                            value={row.qtdExpostos}
                            onChange={(e) =>
                              handleCellChange(
                                index,
                                "qtdExpostos",
                                e.target.value
                              )
                            }
                            placeholder="0"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5 min-w-[120px]">
                          <Input
                            value={row.jornada}
                            onChange={(e) =>
                              handleCellChange(
                                index,
                                "jornada",
                                e.target.value
                              )
                            }
                            placeholder="Ex: 8h/dia"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5 min-w-[160px]">
                          <Input
                            value={row.ambienteOperacional}
                            onChange={(e) =>
                              handleCellChange(
                                index,
                                "ambienteOperacional",
                                e.target.value
                              )
                            }
                            placeholder="Ambiente"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteRow(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer save bar when dirty */}
            {isDirty && rows.length > 0 && (
              <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100 bg-amber-50">
                <span className="text-xs text-amber-700">
                  Alterações não salvas
                </span>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isLoading}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {saveMutation.isLoading ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
