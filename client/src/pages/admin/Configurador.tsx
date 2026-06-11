import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, X, Settings2 } from "lucide-react";

type Tab = "master" | "own" | "assignments";

export default function Configurador() {
  const [tab, setTab] = useState<Tab>("master");
  const data = trpc.catalog.listAvailable.useQuery();
  const enrollMut = trpc.catalog.enroll.useMutation({
    onSuccess: () => { toast.success("Conteúdo ativado"); data.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const unenrollMut = trpc.catalog.unenroll.useMutation({
    onSuccess: () => { toast.success("Removido"); data.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const cloneMod = trpc.catalog.cloneModule.useMutation({
    onSuccess: () => { toast.success("Curso clonado"); data.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const cloneTrail = trpc.catalog.cloneTrail.useMutation({
    onSuccess: () => { toast.success("Trilha clonada"); data.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const d: any = data.data ?? { masterModules: [], ownModules: [], masterTrails: [], ownTrails: [], enrollments: [] };
  const isEnrolled = (type: string, id: number) =>
    d.enrollments.some((e: any) => e.contentType === type && e.contentId === id && e.isActive);

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><Settings2 /> Configurador</h1>
          <p className="text-sm text-muted-foreground">Ative conteúdos do catálogo master ou personalize para sua empresa.</p>
        </div>

        <div className="flex gap-2 border-b">
          <button onClick={() => setTab("master")} className={`px-4 py-2 text-sm ${tab === "master" ? "border-b-2 border-primary text-primary font-semibold" : "text-muted-foreground"}`}>Catálogo Master</button>
          <button onClick={() => setTab("own")} className={`px-4 py-2 text-sm ${tab === "own" ? "border-b-2 border-primary text-primary font-semibold" : "text-muted-foreground"}`}>Meu Conteúdo</button>
          <button onClick={() => setTab("assignments")} className={`px-4 py-2 text-sm ${tab === "assignments" ? "border-b-2 border-primary text-primary font-semibold" : "text-muted-foreground"}`}>Atribuições</button>
        </div>

        {tab === "master" && (
          <div className="space-y-6">
            <section>
              <h2 className="font-semibold mb-2">Cursos disponíveis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {d.masterModules.map((m: any) => {
                  const enrolled = isEnrolled("module", m.id);
                  return (
                    <div key={m.id} className="border rounded-lg p-4 bg-white">
                      <div className="font-medium">{m.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{m.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">{m.durationMinutes ?? 0} min</div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => enrolled ? unenrollMut.mutate({ contentType: "module", contentId: m.id }) : enrollMut.mutate({ contentType: "module", contentId: m.id })}
                          className={`text-xs px-3 py-1.5 rounded flex items-center gap-1 ${enrolled ? "bg-green-100 text-green-700" : "bg-primary text-white"}`}>
                          {enrolled ? <><Check size={12} /> Ativo</> : "Ativar como está"}
                        </button>
                        <button onClick={() => cloneMod.mutate({ moduleId: m.id })} className="text-xs px-3 py-1.5 rounded border flex items-center gap-1">
                          <Copy size={12} /> Clonar e personalizar
                        </button>
                      </div>
                    </div>
                  );
                })}
                {d.masterModules.length === 0 && <p className="text-sm text-muted-foreground">Nenhum curso no catálogo master ainda.</p>}
              </div>
            </section>
            <section>
              <h2 className="font-semibold mb-2">Trilhas disponíveis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {d.masterTrails.map((t: any) => {
                  const enrolled = isEnrolled("trail", t.id);
                  return (
                    <div key={t.id} className="border rounded-lg p-4 bg-white">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => enrolled ? unenrollMut.mutate({ contentType: "trail", contentId: t.id }) : enrollMut.mutate({ contentType: "trail", contentId: t.id })}
                          className={`text-xs px-3 py-1.5 rounded ${enrolled ? "bg-green-100 text-green-700" : "bg-primary text-white"}`}>
                          {enrolled ? "Ativo" : "Ativar"}
                        </button>
                        <button onClick={() => cloneTrail.mutate({ trailId: t.id })} className="text-xs px-3 py-1.5 rounded border">Clonar</button>
                      </div>
                    </div>
                  );
                })}
                {d.masterTrails.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma trilha no catálogo master.</p>}
              </div>
            </section>
          </div>
        )}

        {tab === "own" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...d.ownModules.map((x: any) => ({ ...x, _t: "module" })), ...d.ownTrails.map((x: any) => ({ ...x, _t: "trail" }))].map((m: any) => (
              <div key={`${m._t}-${m.id}`} className="border rounded-lg p-4 bg-white">
                <div className="text-xs uppercase text-muted-foreground">{m._t === "module" ? "Curso" : "Trilha"}</div>
                <div className="font-medium">{m.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{m.description}</div>
              </div>
            ))}
            {d.ownModules.length === 0 && d.ownTrails.length === 0 && <p className="text-sm text-muted-foreground">Nenhum conteúdo próprio ainda. Clone do catálogo para personalizar.</p>}
          </div>
        )}

        {tab === "assignments" && (
          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr><th className="p-3 text-left">Tipo</th><th className="p-3 text-left">ID</th><th className="p-3 text-left">Filiais</th><th className="p-3 text-left">Setores</th><th className="p-3 text-right">Ações</th></tr>
              </thead>
              <tbody>
                {d.enrollments.filter((e: any) => e.isActive).map((e: any) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3">{e.contentType}</td>
                    <td className="p-3">{e.contentId}</td>
                    <td className="p-3">{Array.isArray(e.assignedToBranches) ? e.assignedToBranches.join(", ") : "Todos"}</td>
                    <td className="p-3">{Array.isArray(e.assignedToDepartments) ? e.assignedToDepartments.join(", ") : "Todos"}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => unenrollMut.mutate({ contentType: e.contentType, contentId: e.contentId })} className="text-xs text-red-600 inline-flex items-center gap-1"><X size={12} /> Remover</button>
                    </td>
                  </tr>
                ))}
                {d.enrollments.filter((e: any) => e.isActive).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma atribuição ativa.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
