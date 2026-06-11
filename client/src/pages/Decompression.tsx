import AppLayout from "@/components/AppLayout";
import VideoPlayer from "@/components/VideoPlayer";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Leaf, Wind, Brain, Sparkles, Play, Clock } from "lucide-react";

const CATEGORY_CONFIG = {
  yoga: { label: "Yoga", icon: <Leaf size={16} />, color: "bg-green-50 text-green-700 border-green-200" },
  meditacao: { label: "Meditação", icon: <Brain size={16} />, color: "bg-purple-50 text-purple-700 border-purple-200" },
  respiracao: { label: "Respiração", icon: <Wind size={16} />, color: "bg-blue-50 text-blue-700 border-blue-200" },
  outro: { label: "Outros", icon: <Sparkles size={16} />, color: "bg-amber-50 text-amber-700 border-amber-200" },
};

type Category = keyof typeof CATEGORY_CONFIG;

export default function Decompression() {
  const videosQuery = trpc.decompression.list.useQuery();
  const videos = videosQuery.data ?? [];
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [playing, setPlaying] = useState<number | null>(null);

  const categories = ["all", ...Object.keys(CATEGORY_CONFIG)] as (Category | "all")[];
  const filtered = activeCategory === "all" ? videos : videos.filter((v) => v.category === activeCategory);

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-secondary/10 via-accent/20 to-secondary/5 rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute top-4 right-4 w-24 h-24 border border-secondary/20 rounded-full" />
          <div className="absolute bottom-2 right-12 w-12 h-12 border border-secondary/15 rounded-full" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-secondary/20 rounded-xl flex items-center justify-center">
                <Leaf size={22} className="text-secondary" />
              </div>
              <div className="w-0.5 h-8 bg-secondary/30" />
              <p className="text-xs text-secondary/70 uppercase tracking-widest font-medium">Bem-estar</p>
            </div>
            <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
              Área de Descompressão
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-lg leading-relaxed">
              Sua cabine virtual de calmaria. Pause, respire e cuide da sua saúde mental com práticas de yoga, meditação e exercícios de respiração.
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const config = cat === "all" ? null : CATEGORY_CONFIG[cat as Category];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {config?.icon}
                {cat === "all" ? "Todos" : config?.label}
              </button>
            );
          })}
        </div>

        {/* Videos Grid */}
        {videosQuery.isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-border p-4 animate-pulse">
                <div className="aspect-video bg-muted rounded-lg mb-3" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Leaf size={32} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum conteúdo disponível nesta categoria.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((video) => {
              const config = CATEGORY_CONFIG[video.category as Category];
              const isPlaying = playing === video.id;

              return (
                <div key={video.id} className="module-card bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                  {/* Thumbnail / Player */}
                  <div className="aspect-video bg-gradient-to-br from-secondary/15 to-accent/20 relative">
                    {isPlaying && video.videoUrl ? (
                      <VideoPlayer url={video.videoUrl} autoPlay />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <button
                          onClick={() => setPlaying(isPlaying ? null : video.id)}
                          className="w-14 h-14 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                        >
                          <Play size={22} className="text-secondary ml-1" />
                        </button>
                        <span className="mt-2 text-xs text-secondary/70 font-medium">{video.durationMinutes} min</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${config?.color}`}>
                      {config?.icon}
                      {config?.label}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground leading-snug mb-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{video.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock size={11} />
                      <span>{video.durationMinutes} minutos</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
