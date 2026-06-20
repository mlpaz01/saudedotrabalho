import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RotateCcw, Plus, Trash2, Save, CalendarDays } from "lucide-react";

export default function AdminPGRRevision() {
  const [selectedPgrId, setSelectedPgrId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    versao: "",
    dataRevisao: "",
    responsavel: "",
    alteracaoRealizada: "",
  });

  const { data: pgrList, isLoading: loadingPgrs } = trpc.pgr.list.useQuery();

  const {
    data: revisions,
    isLoading: loadingRevisions,
    refetch: refetchRevisions,
  } = trpc.analytics.listPgrRevisions.useQuery(
    { pgrId: selectedPgrId },
    { enabled: !!selectedPgrId }
  );

  const saveRevision = trpc.analytics.savePgrRevision.useMutation({
    onSuccess: () => {
      toast.success("Revisão salva com sucesso!");
      setShowForm(false);
      setFormData({ versao: "", dataRevisao: "", responsavel: "", alteracaoRealizada: "" });
      refetchRevisions();
    },
    onError: (err) => {
      toast.error("Erro ao salvar revisão: " + err.message);
    },
  });

  const deleteRevision = trpc.analytics.deletePgrRevision.useMutation({
    onSuccess: () => {
      toast.success("Revisão excluída com sucesso!");
      refetchRevisions();
    },
    onError: (err) => {
      toast.error("Erro ao excluir revisão: " + err.message);
    },
  });

  const handleOpenForm = () => {
    const nextVersion = revisions && revisions.length > 0
      ? (() => {
          const last = revisions[revisions.length - 1];
          const parts = (last.versao || "1.0").split(".");
          const major = parseInt(parts[0] || "1", 10);
          const minor = parseInt(parts[1] || "0", 10);
          return `${major}.${minor + 1}`;
        })()
      : "1.0";

    setFormData({
      versao: nextVersion,
      dataRevisao: new Date().toISOString().split("T")[0],
      responsavel: "",
      alteracaoRealizada: "",
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!selectedPgrId) {
      toast.error("Selecione um PGR.");
      return;
    }
    if (!formData.versao || !formData.dataRevisao || !formData.responsavel || !formData.alteracaoRealizada) {
      toast.error("Preencha todos os campos.");
      return;
    }
    saveRevision.mutate({
      pgrId: selectedPgrId,
      versao: formData.versao,
      dataRevisao: formData.dataRevisao,
      responsavel: formData.responsavel,
      alteracaoRealizada: formData.alteracaoRealizada,
    });
  };

  const handleDelete = (revisionId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta revisão?")) return;
    deleteRevision.mutate({ id: revisionId });
  };

  const selectedPgr = pgrList?.find((p: any) => p.id === selectedPgrId);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <RotateCcw className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Histórico de Revisões do PGR
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Controle de versões e alterações realizadas no Programa de Gerenciamento de Riscos
            </p>
          </div>
        </div>

        {/* PGR Selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecionar PGR
          </label>
          {loadingPgrs ? (
            <div className="text-sm text-gray-400">Carregando PGRs...</div>
          ) : (
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedPgrId}
              onChange={(e) => {
                setSelectedPgrId(e.target.value);
                setShowForm(false);
              }}
            >
              <option value="">-- Selecione um PGR --</option>
              {pgrList?.map((pgr: any) => (
                <option key={pgr.id} value={pgr.id}>
                  {pgr.razaoSocial} — {pgr.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Revisions Table */}
        {selectedPgrId && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-gray-500" />
                <h2 className="text-base font-semibold text-gray-800">
                  Revisões{selectedPgr ? ` — ${selectedPgr.razaoSocial}` : ""}
                </h2>
              </div>
              <Button
                onClick={handleOpenForm}
                className="flex items-center gap-2 text-sm"
                disabled={showForm}
              >
                <Plus className="h-4 w-4" />
                Adicionar Revisão
              </Button>
            </div>

            {loadingRevisions ? (
              <div className="text-sm text-gray-400 py-6 text-center">
                Carregando revisões...
              </div>
            ) : !revisions || revisions.length === 0 ? (
              <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
                Nenhuma revisão registrada para este PGR.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 pr-4 font-semibold text-gray-600 whitespace-nowrap">Versão</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600 whitespace-nowrap">Data da Revisão</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600 whitespace-nowrap">Responsável</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Alteração Realizada</th>
                      <th className="pb-3 font-semibold text-gray-600 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(revisions || [])].sort((a: any, b: any) =>
                      new Date(a.dataRevisao).getTime() - new Date(b.dataRevisao).getTime()
                    ).map((rev: any) => (
                      <tr
                        key={rev.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono text-xs font-semibold">
                            v{rev.versao}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">
                          {rev.dataRevisao
                            ? new Date(rev.dataRevisao + "T00:00:00").toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">
                          {rev.responsavel || "—"}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 max-w-xs">
                          <span className="block truncate" title={rev.alteracaoRealizada}>
                            {rev.alteracaoRealizada || "—"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDelete(rev.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Excluir revisão"
                            disabled={deleteRevision.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inline Add Form */}
            {showForm && (
              <div className="border border-blue-200 rounded-xl bg-blue-50 p-5 space-y-4 mt-2">
                <h3 className="text-sm font-semibold text-blue-800">Nova Revisão</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Versão
                    </label>
                    <Input
                      value={formData.versao}
                      onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                      placeholder="Ex: 1.1"
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Data da Revisão
                    </label>
                    <Input
                      type="date"
                      value={formData.dataRevisao}
                      onChange={(e) => setFormData({ ...formData, dataRevisao: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Responsável
                    </label>
                    <Input
                      value={formData.responsavel}
                      onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                      placeholder="Nome do responsável"
                      className="bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Alteração Realizada
                  </label>
                  <textarea
                    value={formData.alteracaoRealizada}
                    onChange={(e) => setFormData({ ...formData, alteracaoRealizada: e.target.value })}
                    placeholder="Descreva as alterações realizadas nesta revisão..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={saveRevision.isPending}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Save className="h-4 w-4" />
                    {saveRevision.isPending ? "Salvando..." : "Salvar Revisão"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="text-sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
