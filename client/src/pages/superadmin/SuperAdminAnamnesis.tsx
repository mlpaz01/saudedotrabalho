import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

const empty = {
  questionCode: "",
  anamnesisType: "todos",
  groupName: "Histórico de saúde",
  questionText: "",
  responseType: "sim_nao_detalhe",
  options: [] as string[],
  isRequired: false,
  sortOrder: 0,
  isActive: true,
};

export default function SuperAdminAnamnesis() {
  const query =
    trpc.occupationalLifecycle.listAnamnesisQuestionConfig.useQuery();
  const [editing, setEditing] = useState<any | null>(null);
  const save = trpc.occupationalLifecycle.upsertAnamnesisQuestion.useMutation({
    onSuccess: () => {
      query.refetch();
      setEditing(null);
      toast.success("Pergunta salva no questionário ocupacional.");
    },
    onError: error => toast.error(error.message),
  });
  const rows = (query.data || []) as any[];
  const open = (row?: any) =>
    setEditing(
      row
        ? {
            id: Number(row.id),
            questionCode: row.question_code,
            anamnesisType: row.anamnesis_type,
            groupName: row.group_name,
            questionText: row.question_text,
            responseType: row.response_type,
            options: (() => {
              try {
                return JSON.parse(row.options_json || "[]");
              } catch {
                return [];
              }
            })(),
            isRequired: Boolean(Number(row.is_required)),
            sortOrder: Number(row.sort_order || 0),
            isActive: Boolean(Number(row.is_active)),
          }
        : { ...empty }
    );
  const set = (key: string, value: any) =>
    setEditing((current: any) => ({ ...current, [key]: value }));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700">
              <ClipboardList size={15} /> Governança clínica
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Questionários de anamnese
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Defina perguntas, tipo de resposta, obrigatoriedade e ordem.
              Alterações futuras não modificam anamneses históricas já
              concluídas.
            </p>
          </div>
          <Button onClick={() => open()}>
            <Plus size={15} className="mr-2" /> Nova pergunta
          </Button>
        </header>
        <section className="border bg-white">
          <div className="overflow-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="p-3 text-left">Ordem</th>
                  <th className="p-3 text-left">Aplicação</th>
                  <th className="p-3 text-left">Grupo</th>
                  <th className="p-3 text-left">Pergunta</th>
                  <th className="p-3 text-left">Resposta</th>
                  <th className="p-3 text-left">Situação</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">{row.sort_order}</td>
                    <td className="p-3">
                      {String(row.anamnesis_type).replaceAll("_", " ")}
                    </td>
                    <td className="p-3">{row.group_name}</td>
                    <td className="max-w-xl p-3">
                      <b>{row.question_text}</b>
                      <br />
                      <span className="text-xs text-slate-500">
                        {row.question_code}
                        {Number(row.is_required) ? " · obrigatória" : ""}
                      </span>
                    </td>
                    <td className="p-3">
                      {String(row.response_type).replaceAll("_", " ")}
                    </td>
                    <td className="p-3">
                      <Badge
                        className={`rounded-sm ${Number(row.is_active) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
                      >
                        {Number(row.is_active) ? "ativa" : "inativa"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar pergunta"
                        onClick={() => open(row)}
                      >
                        <Pencil size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <Dialog
          open={Boolean(editing)}
          onOpenChange={value => !value && setEditing(null)}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {editing?.id ? "Editar pergunta" : "Nova pergunta"}
              </DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold">
                  Código estável
                  <Input
                    className="mt-1"
                    value={editing.questionCode}
                    onChange={event =>
                      set(
                        "questionCode",
                        event.target.value
                          .replace(/[^a-zA-Z0-9_]/g, "_")
                          .toLowerCase()
                      )
                    }
                  />
                </label>
                <label className="text-xs font-semibold">
                  Aplicação
                  <select
                    className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                    value={editing.anamnesisType}
                    onChange={event => set("anamnesisType", event.target.value)}
                  >
                    <option value="todos">Todos os tipos</option>
                    <option value="admissional">Admissional</option>
                    <option value="periodico">Periódico</option>
                    <option value="retorno">Retorno</option>
                    <option value="mudanca_risco">Mudança de risco</option>
                    <option value="demissional">Demissional</option>
                    <option value="monitoracao_pontual">
                      Monitoração pontual
                    </option>
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Grupo
                  <Input
                    className="mt-1"
                    value={editing.groupName}
                    onChange={event => set("groupName", event.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold">
                  Tipo de resposta
                  <select
                    className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                    value={editing.responseType}
                    onChange={event => set("responseType", event.target.value)}
                  >
                    <option value="texto">Texto curto</option>
                    <option value="texto_longo">Texto longo</option>
                    <option value="sim_nao">Sim/Não</option>
                    <option value="sim_nao_detalhe">Sim/Não + detalhe</option>
                    <option value="numero">Número</option>
                    <option value="data">Data</option>
                    <option value="escala_1_5">Escala 1 a 5</option>
                    <option value="selecao">Seleção</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-xs font-semibold">
                  Pergunta
                  <Textarea
                    className="mt-1"
                    value={editing.questionText}
                    onChange={event => set("questionText", event.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold">
                  Opções, separadas por vírgula
                  <Input
                    className="mt-1"
                    value={editing.options.join(", ")}
                    onChange={event =>
                      set(
                        "options",
                        event.target.value
                          .split(",")
                          .map(item => item.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                </label>
                <label className="text-xs font-semibold">
                  Ordem
                  <Input
                    className="mt-1"
                    type="number"
                    value={editing.sortOrder}
                    onChange={event =>
                      set("sortOrder", Number(event.target.value))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.isRequired}
                    onChange={event => set("isRequired", event.target.checked)}
                  />{" "}
                  Resposta obrigatória
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.isActive}
                    onChange={event => set("isActive", event.target.checked)}
                  />{" "}
                  Pergunta ativa
                </label>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={
                      save.isPending ||
                      editing.questionCode.length < 2 ||
                      editing.questionText.length < 5
                    }
                    onClick={() => save.mutate(editing)}
                  >
                    {save.isPending ? "Salvando..." : "Salvar pergunta"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
