import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Megaphone, ArrowLeft, FileText, Video as VideoIcon, Image as ImageIcon, BookOpen, ClipboardList, ExternalLink, Download } from "lucide-react";

/**
 * SP5 #3 — Área "Campanhas" exclusiva pro colaborador.
 *
 * Bruno (jun/2026) pediu uma tela visual e interativa por mês:
 *  - Janeiro Branco / Fevereiro Roxo / Março Azul-Marinho / Setembro Amarelo /
 *    Outubro Rosa / Novembro Azul ... cada uma com identidade própria.
 *  - Só campanhas marcadas como ATIVA pelo RH aparecem aqui.
 *  - Conteúdo: banner, cartazes (imagens), materiais (PDFs), vídeos, cursos,
 *    pesquisas — vindos de preventive_library_materials + preventive_library_links.
 *  - Disponível pra todos os perfis (Colaborador / RH / SESMT / Chefia).
 *  - Link do sino e e-mail apontam pra cá.
 */

// Tema visual por mês — paleta + ícone/gradiente.
const MONTH_THEMES: Record<number, { name: string; gradient: string; text: string; accent: string }> = {
  1:  { name: "Janeiro Branco",       gradient: "from-slate-50 to-white",       text: "#1e293b", accent: "#e2e8f0" },
  2:  { name: "Fevereiro Roxo",       gradient: "from-purple-100 to-purple-50", text: "#581c87", accent: "#a855f7" },
  3:  { name: "Março Azul-Marinho",   gradient: "from-blue-200 to-blue-50",     text: "#1e3a8a", accent: "#1e3a8a" },
  4:  { name: "Abril Verde",          gradient: "from-emerald-100 to-emerald-50",text: "#065f46", accent: "#10b981" },
  5:  { name: "Maio Amarelo",         gradient: "from-amber-100 to-amber-50",   text: "#78350f", accent: "#f59e0b" },
  6:  { name: "Junho Vermelho",       gradient: "from-red-100 to-red-50",       text: "#7f1d1d", accent: "#ef4444" },
  7:  { name: "Julho Verde-água",     gradient: "from-teal-100 to-teal-50",     text: "#134e4a", accent: "#14b8a6" },
  8:  { name: "Agosto Dourado",       gradient: "from-yellow-100 to-yellow-50", text: "#713f12", accent: "#eab308" },
  9:  { name: "Setembro Amarelo",     gradient: "from-yellow-200 to-yellow-50", text: "#854d0e", accent: "#facc15" },
  10: { name: "Outubro Rosa",         gradient: "from-pink-200 to-pink-50",     text: "#831843", accent: "#ec4899" },
  11: { name: "Novembro Azul",        gradient: "from-sky-200 to-sky-50",       text: "#075985", accent: "#0ea5e9" },
  12: { name: "Dezembro Vermelho",    gradient: "from-rose-200 to-rose-50",     text: "#881337", accent: "#f43f5e" },
};

const MATERIAL_ICONS: Record<string, any> = {
  cartaz: ImageIcon,
  banner: ImageIcon,
  pdf: FileText,
  ebook: BookOpen,
  video: VideoIcon,
  apresentacao: FileText,
  default: FileText,
};

export default function CampanhasIndex() {
  const [, navigate] = useLocation();
  const q = trpc.preventiveLibrary.listActiveForEmployee.useQuery();
  const camps = (q.data ?? []) as any[];

  // Agrupa por mês
  const byMonth = new Map<number, any[]>();
  for (const c of camps) {
    const m = c.month ?? 0;
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(c);
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone size={24} className="text-blue-600" />
            Campanhas Preventivas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Campanhas ativas da sua empresa. Clique em uma para acessar materiais, vídeos, cursos e pesquisas.
          </p>
        </div>

        {q.isLoading && <p className="text-sm text-slate-400 py-12 text-center">Carregando campanhas...</p>}

        {!q.isLoading && camps.length === 0 && (
          <div className="bg-white border-2 border-dashed rounded-2xl p-12 text-center text-slate-500">
            <Megaphone size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma campanha ativa no momento.</p>
            <p className="text-xs mt-1">Quando o RH ativar uma campanha, ela aparecerá aqui.</p>
          </div>
        )}

        {/* Listagem por mês */}
        {[...byMonth.entries()].sort(([a], [b]) => a - b).map(([month, list]) => {
          const theme = MONTH_THEMES[month] ?? { name: "Outras", gradient: "from-slate-100 to-white", text: "#1e293b", accent: "#64748b" };
          return (
            <section key={month}>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: theme.text }}>
                {theme.name}
              </h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {list.map((c) => {
                  // Bruno round 3: cor do ÍCONE segue a cor escolhida na campanha (c.color).
                  // O agrupamento por mês mantém o gradient temático no fundo, mas cada
                  // campanha individual usa SUA própria cor pro ícone/border de destaque.
                  const campColor = c.color || theme.accent;
                  // Procura banner: primeiro material image como cartaz/banner
                  const banner = (c.materials || []).find((m: any) =>
                    (m.material_type === "cartaz" || m.material_type === "banner") &&
                    (m.mime_type || "").startsWith("image/")
                  );
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/campanhas/${c.id}`)}
                      className="text-left bg-white border-2 rounded-2xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-0.5"
                      style={{ borderColor: campColor }}
                    >
                      {banner?.file_url && (
                        <div className="w-full h-32 bg-slate-100 overflow-hidden">
                          <img src={banner.file_url} alt={c.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className={`bg-gradient-to-br ${theme.gradient} p-5`}>
                        <div className="flex items-start gap-2">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: campColor }}>
                            <Megaphone size={18} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-base" style={{ color: theme.text }}>{c.name}</div>
                            {c.theme && <div className="text-xs mt-0.5 opacity-70" style={{ color: theme.text }}>{c.theme}</div>}
                          </div>
                        </div>
                        {c.description && <p className="text-xs mt-3 line-clamp-2" style={{ color: theme.text }}>{c.description}</p>}
                        <div className="mt-3 flex gap-3 text-[11px]" style={{ color: theme.text }}>
                          <span className="opacity-80">{c.materials.length} material(is)</span>
                          <span className="opacity-80">{c.links.length} conteúdo(s) interativo(s)</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </AppLayout>
  );
}

// Página de uma campanha específica (acessada via /campanhas/:id)
export function CampanhaDetail() {
  const params = useParams() as { id: string };
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const q = trpc.preventiveLibrary.getCampaignForEmployee.useQuery({ id }, { enabled: !!id });
  const data = q.data as any;

  if (q.isLoading) {
    return <AppLayout><div className="p-8 text-slate-400 text-sm">Carregando campanha...</div></AppLayout>;
  }
  if (q.isError || !data) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto p-8 text-center">
          <h1 className="text-xl font-bold">Campanha indisponível</h1>
          <p className="text-sm text-muted-foreground mt-2">{(q.error as any)?.message ?? "Esta campanha não está mais ativa."}</p>
          <button onClick={() => navigate("/campanhas")} className="mt-4 text-sm text-blue-600 hover:underline">← Voltar para Campanhas</button>
        </div>
      </AppLayout>
    );
  }

  const c = data.campaign;
  const theme = MONTH_THEMES[Number(c.month_number) ?? 0] ?? { name: "Campanha", gradient: "from-slate-100 to-white", text: "#1e293b", accent: "#64748b" };
  const materials = (data.materials ?? []) as any[];
  const links = (data.links ?? []) as any[];
  // Bruno round 3: cor escolhida na campanha + banner com destaque grande
  const campColor = c.color || theme.accent;
  const banners = materials.filter((m: any) =>
    (m.material_type === "cartaz" || m.material_type === "banner") &&
    (m.mime_type || "").startsWith("image/")
  );
  const restMaterials = materials.filter((m: any) => !banners.includes(m));

  return (
    <AppLayout>
      <div className={`bg-gradient-to-br ${theme.gradient} -mx-6 -mt-6 px-6 pt-6 pb-10 border-b-4`} style={{ borderColor: campColor }}>
        <div className="max-w-6xl mx-auto">
          <button onClick={() => navigate("/campanhas")} className="text-xs hover:underline flex items-center gap-1 mb-3" style={{ color: theme.text }}>
            <ArrowLeft size={12} /> Voltar para Campanhas
          </button>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: campColor }}>
              <Megaphone size={28} className="text-white" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider opacity-70 font-semibold" style={{ color: theme.text }}>{theme.name}</div>
              <h1 className="text-3xl font-bold mt-1" style={{ color: theme.text }}>{c.name}</h1>
              {c.theme && <p className="mt-1 opacity-80" style={{ color: theme.text }}>{c.theme}</p>}
            </div>
          </div>
          {c.description && (
            <p className="mt-4 max-w-3xl text-sm" style={{ color: theme.text }}>{c.description}</p>
          )}
        </div>
      </div>

      {/* Bruno round 3: cartazes/banners exibidos com DESTAQUE (não como simples anexos) */}
      {banners.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <section>
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <ImageIcon size={18} style={{ color: campColor }} /> Cartazes da campanha
            </h2>
            <div className={banners.length === 1 ? "" : "grid md:grid-cols-2 gap-4"}>
              {banners.map((b: any) => (
                <a key={b.id} href={b.file_url} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border-2 hover:shadow-xl transition-all" style={{ borderColor: campColor }}>
                  <img src={b.file_url} alt={b.title} className="w-full object-contain bg-slate-50" style={{ maxHeight: banners.length === 1 ? 520 : 360 }} />
                  <div className="px-4 py-3 bg-white">
                    <div className="font-semibold text-sm">{b.title}</div>
                    {b.description && <p className="text-xs text-slate-600 mt-0.5">{b.description}</p>}
                  </div>
                </a>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {materials.length === 0 && links.length === 0 && (
          <p className="text-sm text-slate-500">A campanha está ativa, mas ainda sem materiais cadastrados. Volte em breve.</p>
        )}

        {restMaterials.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-3">Materiais educativos</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {restMaterials.map((m) => {
                const Icon = MATERIAL_ICONS[m.material_type ?? "default"] ?? MATERIAL_ICONS.default;
                const isImg = (m.mime_type || "").startsWith("image/");
                return (
                  <a key={m.id} href={m.file_url ?? "#"} target="_blank" rel="noreferrer" className="border rounded-xl p-4 hover:shadow-md transition-all bg-white block" style={{ borderColor: campColor + "55" }}>
                    {isImg && m.file_url ? (
                      <img src={m.file_url} alt={m.title} className="w-full h-48 object-cover rounded mb-2" />
                    ) : (
                      <div className="h-20 flex items-center justify-center bg-slate-50 rounded mb-2">
                        <Icon size={36} style={{ color: campColor }} />
                      </div>
                    )}
                    <div className="font-medium text-sm">{m.title}</div>
                    {m.material_type && <div className="text-[11px] text-slate-500 mt-0.5 uppercase">{m.material_type}</div>}
                    {m.description && <p className="text-xs mt-1 text-slate-600 line-clamp-2">{m.description}</p>}
                    {m.file_url && (
                      <div className="mt-2 text-xs flex items-center gap-1" style={{ color: campColor }}>
                        <Download size={11} /> Abrir / baixar
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {links.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-3">Conteúdo interativo da plataforma</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {links.map((l) => {
                const href = linkHref(l.link_type, l.ref_id);
                const Icon = l.link_type === "survey" ? ClipboardList : l.link_type === "course" || l.link_type === "module" ? BookOpen : ExternalLink;
                return (
                  <a key={l.id} href={href} className="border rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all bg-white block">
                    <div className="flex items-start gap-2">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-50">
                        <Icon size={16} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{l.title || `${l.link_type} #${l.ref_id}`}</div>
                        {l.notes && <p className="text-xs mt-0.5 text-slate-600 line-clamp-2">{l.notes}</p>}
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">{l.link_type}</div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}

function linkHref(type: string, refId: number): string {
  // Bruno round 3: /missao/curso/X exigia contexto de missão que não temos aqui.
  // Direciono pro player de curso direto, que aceita qualquer module.
  switch (type) {
    case "survey":  return `/pesquisas/${refId}/responder`;
    case "module":
    case "course":  return `/cursos/${refId}`;
    case "lesson":  return `/cursos/${refId}`;
    default:        return "#";
  }
}
