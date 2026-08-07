import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Pencil, Plus, Trash2, Video } from "lucide-react";

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
};
const lines = (value: string) =>
  value
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

export default function SuperAdminGuidance() {
  const query = trpc.guidance.listAdmin.useQuery();
  const [editing, setEditing] = useState<any | null>(null);
  const save = trpc.guidance.upsert.useMutation({
    onSuccess: () => {
      query.refetch();
      setEditing(null);
      toast.success("Orientação publicada na base da IA.");
    },
    onError: e => toast.error(e.message),
  });
  const remove = trpc.guidance.remove.useMutation({
    onSuccess: () => query.refetch(),
  });
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5 p-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manuais e Orientações</h1>
            <p className="mt-1 text-sm text-slate-500">
              Artigos publicados aqui alimentam o Manual do Usuário e a primeira
              camada de suporte por IA.
            </p>
          </div>
          <Button onClick={() => setEditing({ ...blank })}>
            <Plus size={15} className="mr-1" /> Criar artigo
          </Button>
        </header>
        <div className="overflow-auto border bg-white">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left">Artigo</th>
                <th className="p-3 text-left">Módulo</th>
                <th className="p-3 text-left">Perfis</th>
                <th className="p-3 text-left">Vídeo</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {((query.data || []) as any[]).map(row => (
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
                    {row.isActive ? "Publicado" : "Inativo"}
                  </td>
                  <td className="p-3 text-right">
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
          </div>
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => set("isActive", e.target.checked)}
            />{" "}
            Artigo publicado
          </label>
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
              Salvar e publicar
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
