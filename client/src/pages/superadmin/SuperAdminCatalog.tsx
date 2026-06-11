import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Star, BookOpen, Route } from "lucide-react";

export default function SuperAdminCatalog() {
  const utils = trpc.useUtils();
  const allMods = trpc.admin?.listModules ? trpc.admin.listModules.useQuery() : null;
  // Fall back to modules.list (always tenant-aware), but super_admin sees all
  const fallbackMods = trpc.modules.list.useQuery(undefined, { enabled: !allMods });
  const trailsQ = (trpc.trails as any)?.list?.useQuery?.() ?? null;
  const fallbackTrails = trpc.trails.listActive.useQuery(undefined, { enabled: !trailsQ });

  const modules = (allMods?.data ?? fallbackMods.data ?? []) as any[];
  const trails = (trailsQ?.data ?? fallbackTrails.data ?? []) as any[];

  const setMod = trpc.superAdmin.setModuleMasterFlag.useMutation({
    onSuccess: () => { toast.success("Atualizado"); allMods?.refetch?.(); fallbackMods.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const setTrail = trpc.superAdmin.setTrailMasterFlag.useMutation({
    onSuccess: () => { toast.success("Atualizado"); trailsQ?.refetch?.(); fallbackTrails.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Catálogo Master</h1>
          <p className="text-sm text-muted-foreground">Promova conteúdos para o catálogo público disponível a todos os clientes.</p>
        </div>

        <section>
          <h2 className="font-semibold flex items-center gap-2 mb-3"><BookOpen size={18} /> Cursos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map((m: any) => (
              <div key={m.id} className={`p-4 rounded-lg border ${m.isCatalogMaster ? "border-yellow-400 bg-yellow-50" : "bg-white"}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{m.description}</div>
                  </div>
                  <button onClick={() => setMod.mutate({ moduleId: m.id, isMaster: !m.isCatalogMaster })}
                    className={`p-2 rounded ${m.isCatalogMaster ? "bg-yellow-400 text-white" : "bg-muted hover:bg-yellow-200"}`}
                    title={m.isCatalogMaster ? "Remover do catálogo" : "Promover a catálogo"}>
                    <Star size={16} fill={m.isCatalogMaster ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold flex items-center gap-2 mb-3"><Route size={18} /> Trilhas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {trails.map((t: any) => (
              <div key={t.id} className={`p-4 rounded-lg border ${t.isCatalogMaster ? "border-yellow-400 bg-yellow-50" : "bg-white"}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                  </div>
                  <button onClick={() => setTrail.mutate({ trailId: t.id, isMaster: !t.isCatalogMaster })}
                    className={`p-2 rounded ${t.isCatalogMaster ? "bg-yellow-400 text-white" : "bg-muted hover:bg-yellow-200"}`}>
                    <Star size={16} fill={t.isCatalogMaster ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
