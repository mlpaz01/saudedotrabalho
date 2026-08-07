import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  FileSearch,
  Pencil,
  Plus,
  Search,
  Sheet,
  Trash2,
  Video,
} from "lucide-react";

const roleOptions = [
  ["user", "Colaborador"],
  ["chefia", "Chefia"],
  ["cipa", "CIPA"],
  ["sesmt", "SESMT"],
  ["rh", "RH"],
  ["admin", "Administrador"],
  ["company_admin", "SuperAdmin da rede"],
  ["psicologo", "Psicólogo"],
  ["medico", "Médico"],
];
const blank = {
  slug: "",
  title: "",
  summary: "",
  module: "",
  route: "/manual",
  roles: ["user"],
  keywords: [],
  whatIs: "",
  purpose: "",
  accessPath: "",
  steps: [],
  cautions: [],
  faq: [],
  problems: [],
  screenshots: [],
  videoUrl: null,
  isActive: true,
  sortOrder: 0,
  workflowStatus: "rascunho",
  auditStatus: "nao_auditado",
  auditNotes: "",
  sourceName: null,
  sourceRow: null,
};
const lines = (value: string) =>
  value
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

export default function SuperAdminGuidance() {
  const query = trpc.guidance.listAdmin.useQuery();
  const statsQ = trpc.guidance.catalogStats.useQuery();
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [auditFilter, setAuditFilter] = useState("");
  const save = trpc.guidance.upsert.useMutation({
    onSuccess: () => {
      query.refetch();
      setEditing(null);
      statsQ.refetch();
      toast.success("Artigo salvo no fluxo editorial.");
    },
    onError: e => toast.error(e.message),
  });
  const remove = trpc.guidance.remove.useMutation({
    onSuccess: () => {
      query.refetch();
      statsQ.refetch();
    },
  });
  const importCatalog = trpc.guidance.importCatalog.useMutation({
    onSuccess: result => {
      query.refetch();
      statsQ.refetch();
      toast.success(
        result.inserted
          ? `${result.inserted} artigo(s) importado(s) para validação.`
          : "O catálogo de 163 artigos já está carregado."
      );
    },
    onError: error => toast.error(error.message),
  });
  const auditCatalog = trpc.guidance.auditCatalog.useMutation({
    onSuccess: result => {
      query.refetch();
      statsQ.refetch();
      toast.success(
        `${result.structurallyOk} artigo(s) com estrutura adequada; ${result.reviewed} exigem revisão.`
      );
    },
    onError: error => toast.error(error.message),
  });
  const changeStatus = trpc.guidance.changeStatus.useMutation({
    onSuccess: () => {
      query.refetch();
      statsQ.refetch();
      toast.success("Status editorial atualizado.");
    },
    onError: error => toast.error(error.message),
  });
  const articles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return ((query.data || []) as any[]).filter(row => {
      if (status && row.workflowStatus !== status) return false;
      if (auditFilter && row.auditStatus !== auditFilter) return false;
      if (!needle) return true;
      return [row.title, row.slug, row.module, row.summary].some(value =>
        String(value || "")
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [query.data, search, status, auditFilter]);
  const stats = (statsQ.data || {}) as any;
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Manuais e Orientações</h1>
            <p className="mt-1 text-sm text-slate-500">
              Artigos publicados aqui alimentam o Manual do Usuário e a primeira
              camada de suporte por IA.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={importCatalog.isPending}
              onClick={() => importCatalog.mutate()}
            >
              <Sheet size={15} className="mr-1" /> Importar catálogo
            </Button>
            <Button
              variant="outline"
              disabled={auditCatalog.isPending}
              onClick={() => auditCatalog.mutate()}
            >
              <FileSearch size={15} className="mr-1" /> Auditar catálogo
            </Button>
            <Button onClick={() => setEditing({ ...blank })}>
              <Plus size={15} className="mr-1" /> Criar artigo
            </Button>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {[
            ["Total", stats.total || 0],
            ["Rascunho", stats.rascunho || 0],
            ["Em validação", stats.em_validacao || 0],
            ["Aprovados", stats.aprovado || 0],
            ["Publicados", stats.publicado || 0],
            ["Revisar", stats.revisar || 0],
            ["Auditados", stats.auditados || 0],
          ].map(([label, value]) => (
            <div className="min-h-20 border bg-white p-3" key={String(label)}>
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-2 text-xl font-bold">{value}</div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 border bg-white p-3 md:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <Input
              className="pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar título, módulo, slug ou conteúdo"
            />
          </div>
          <select
            className="h-10 border bg-white px-2 text-sm"
            value={status}
            onChange={event => setStatus(event.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="em_validacao">Em validação</option>
            <option value="aprovado">Aprovado</option>
            <option value="publicado">Publicado</option>
            <option value="arquivado">Arquivado</option>
          </select>
          <select
            className="h-10 border bg-white px-2 text-sm"
            value={auditFilter}
            onChange={event => setAuditFilter(event.target.value)}
          >
            <option value="">Todas as auditorias</option>
            <option value="nao_auditado">Não auditado</option>
            <option value="revisar">Revisar</option>
            <option value="estrutura_ok">Estrutura adequada</option>
            <option value="aprovado">Aprovado</option>
          </select>
        </div>
        <div className="overflow-auto border bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left">Artigo</th>
                <th className="p-3 text-left">Módulo</th>
                <th className="p-3 text-left">Perfis</th>
                <th className="p-3 text-left">Vídeo</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Auditoria</th>
                <th className="p-3 text-left">Origem</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {articles.map(row => (
                <tr className="border-t" key={row.id}>
                  <td className="p-3">
                    <b>{row.title}</b>
                    <div className="text-xs text-slate-500">{row.slug}</div>
                  </td>
                  <td className="p-3">{row.module}</td>
                  <td className="p-3 text-xs">{row.roles.join(", ")}</td>
                  <td className="p-3">
                    {row.videoUrl ? (
                      <Video size={17} className="text-teal-700" />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="rounded-sm">
                      {row.workflowStatus}
                    </Badge>
                  </td>
                  <td className="max-w-xs p-3">
                    <div
                      className={
                        row.auditStatus === "revisar"
                          ? "font-medium text-amber-700"
                          : "font-medium text-emerald-700"
                      }
                    >
                      {row.auditStatus}
                    </div>
                    {row.auditNotes ? (
                      <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {row.auditNotes}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs text-slate-500">
                    {row.sourceName ? `Excel · linha ${row.sourceRow}` : "Manual"}
                  </td>
                  <td className="p-3 text-right">
                    {row.workflowStatus !== "publicado" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Aprovar e publicar"
                        onClick={() =>
                          confirm(
                            row.auditStatus === "revisar"
                              ? "A auditoria ainda recomenda revisão. Publicar mesmo assim?"
                              : "Publicar este artigo no Manual e na base da IA?"
                          ) &&
                          changeStatus.mutate({
                            id: row.id,
                            status: "publicado",
                            confirmation: true,
                          })
                        }
                      >
                        <CheckCircle2 size={15} className="text-emerald-700" />
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(row)}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        confirm("Excluir este artigo?") &&
                        remove.mutate({ id: row.id })
                      }
                    >
                      <Trash2 size={15} className="text-rose-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!articles.length ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Nenhum artigo corresponde aos filtros.
            </p>
          ) : null}
        </div>
        {editing && (
          <ArticleEditor
            value={editing}
            close={() => setEditing(null)}
            save={(value: any) => save.mutate(value)}
            busy={save.isPending}
          />
        )}
      </div>
    </AppLayout>
  );
}

function ArticleEditor({
  value,
  close,
  save,
  busy,
}: {
  value: any;
  close: () => void;
  save: (v: any) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<any>({ ...blank, ...value });
  const set = (key: string, val: any) =>
    setForm((old: any) => ({ ...old, [key]: val }));
  return (
    <Dialog open onOpenChange={v => !v && close()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen size={18} />
            {form.id ? "Editar artigo" : "Novo artigo"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Label text="Título">
              <Input
                value={form.title}
                onChange={e => set("title", e.target.value)}
              />
            </Label>
            <Label text="Slug">
              <Input
                value={form.slug}
                onChange={e =>
                  set(
                    "slug",
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                  )
                }
              />
            </Label>
            <Label text="Módulo">
              <Input
                value={form.module}
                onChange={e => set("module", e.target.value)}
              />
            </Label>
            <Label text="Rota da funcionalidade">
              <Input
                value={form.route}
                onChange={e => set("route", e.target.value)}
              />
            </Label>
            <Label text="Status editorial">
              <select
                className="h-10 w-full border bg-white px-2 text-sm"
                value={form.workflowStatus}
                onChange={e => set("workflowStatus", e.target.value)}
              >
                <option value="rascunho">Rascunho</option>
                <option value="em_validacao">Em validação</option>
                <option value="aprovado">Aprovado</option>
                {form.workflowStatus === "publicado" ? (
                  <option value="publicado">Publicado</option>
                ) : null}
                <option value="arquivado">Arquivado</option>
              </select>
            </Label>
            <Label text="Resultado da auditoria">
              <select
                className="h-10 w-full border bg-white px-2 text-sm"
                value={form.auditStatus}
                onChange={e => set("auditStatus", e.target.value)}
              >
                <option value="nao_auditado">Não auditado</option>
                <option value="revisar">Revisar</option>
                <option value="estrutura_ok">Estrutura adequada</option>
                <option value="aprovado">Aprovado</option>
              </select>
            </Label>
          </div>
          <Label text="Notas da auditoria">
            <Textarea
              value={form.auditNotes || ""}
              onChange={e => set("auditNotes", e.target.value)}
            />
          </Label>
          <Label text="Resumo">
            <Textarea
              value={form.summary}
              onChange={e => set("summary", e.target.value)}
            />
          </Label>
          <div>
            <div className="mb-2 text-xs font-semibold">Perfis autorizados</div>
            <div className="flex flex-wrap gap-3">
              {roleOptions.map(([role, label]) => (
                <label className="flex items-center gap-2 text-sm" key={role}>
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={e =>
                      set(
                        "roles",
                        e.target.checked
                          ? [...form.roles, role]
                          : form.roles.filter((x: string) => x !== role)
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Label text="Palavras-chave, uma por linha">
            <Textarea
              value={(form.keywords || []).join("\n")}
              onChange={e => set("keywords", lines(e.target.value))}
            />
          </Label>
          <Label text="O que é?">
            <Textarea
              value={form.whatIs}
              onChange={e => set("whatIs", e.target.value)}
            />
          </Label>
          <Label text="Para que serve?">
            <Textarea
              value={form.purpose}
              onChange={e => set("purpose", e.target.value)}
            />
          </Label>
          <Label text="Como acessar?">
            <Input
              value={form.accessPath}
              onChange={e => set("accessPath", e.target.value)}
            />
          </Label>
          <div className="grid gap-3 md:grid-cols-2">
            <Label text="Passos, um por linha">
              <Textarea
                rows={7}
                value={(form.steps || []).join("\n")}
                onChange={e => set("steps", lines(e.target.value))}
              />
            </Label>
            <Label text="Cuidados, um por linha">
              <Textarea
                rows={7}
                value={(form.cautions || []).join("\n")}
                onChange={e => set("cautions", lines(e.target.value))}
              />
            </Label>
          </div>
          <Label text="URL do vídeo">
            <Input
              type="url"
              value={form.videoUrl || ""}
              onChange={e => set("videoUrl", e.target.value || null)}
              placeholder="https://..."
            />
          </Label>
          <div className="grid gap-3 md:grid-cols-2">
            <Label text="URLs de imagens, uma por linha">
              <Textarea
                value={(form.screenshots || [])
                  .map((x: any) => x.url)
                  .join("\n")}
                onChange={e =>
                  set(
                    "screenshots",
                    lines(e.target.value).map((url, index) => ({
                      url,
                      alt: `Tela ${index + 1}`,
                    }))
                  )
                }
              />
            </Label>
            <Label text="Ordem">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={e => set("sortOrder", Number(e.target.value))}
              />
            </Label>
          </div>
          {form.sourceName ? (
            <div className="border bg-slate-50 p-3 text-xs text-slate-600">
              Origem: {form.sourceName} · linha {form.sourceRow}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={
                busy ||
                !form.title ||
                !form.slug ||
                !form.module ||
                !form.roles.length
              }
              onClick={() => save(form)}
            >
              Salvar artigo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <span className="mb-1 block">{text}</span>
      {children}
    </label>
  );
}
