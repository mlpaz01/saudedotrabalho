import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Award, ChevronDown, ChevronUp, Eye } from "lucide-react";

export default function AdminCertificates() {
  const modulesQuery = trpc.admin.listModules.useQuery();
  const utils = trpc.useUtils();
  const modules = modulesQuery.data ?? [];

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, {
    certTitle: string;
    certBody: string;
    certSignerName: string;
    certSignerRole: string;
  }>>({});
  const [previewId, setPreviewId] = useState<number | null>(null);

  const updateMutation = trpc.admin.updateModuleCert.useMutation({
    onSuccess: () => {
      toast.success("Configuração do certificado salva!");
      utils.admin.listModules.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function getForm(mod: typeof modules[0]) {
    return forms[mod.id] ?? {
      certTitle: mod.certTitle ?? `Certificado de Conclusão`,
      certBody: mod.certBody ?? `Este certificado atesta a participação e aprovação no curso indicado, demonstrando o comprometimento com o desenvolvimento profissional e com a saúde, segurança e qualidade de vida no trabalho.`,
      certSignerName: mod.certSignerName ?? ``,
      certSignerRole: mod.certSignerRole ?? ``,
    };
  }

  function setForm(id: number, field: string, value: string) {
    const mod = modules.find((m) => m.id === id);
    if (!mod) return;
    setForms((prev) => ({
      ...prev,
      [id]: { ...getForm(mod), [field]: value },
    }));
  }

  function handleSave(mod: typeof modules[0]) {
    const f = getForm(mod);
    updateMutation.mutate({
      moduleId: mod.id,
      certTitle: f.certTitle,
      certBody: f.certBody,
      certSignerName: f.certSignerName,
      certSignerRole: f.certSignerRole,
    });
  }

  const previewModule = previewId !== null ? modules.find((m) => m.id === previewId) : null;
  const previewForm = previewModule ? getForm(previewModule) : null;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-400 to-transparent" />
          <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
            Configuração de Certificados
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure o título, texto e assinatura do certificado de cada curso
          </p>
        </div>

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Como funciona:</strong> Ao concluir 100% de um curso, o funcionário pode emitir o certificado. 
          O certificado exibirá o título, texto e assinatura que você configurar aqui. 
          Se não configurado, serão usados valores padrão.
        </div>

        {/* Module list */}
        {modulesQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse h-16" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((mod) => {
              const isExpanded = expandedId === mod.id;
              const f = getForm(mod);
              const isConfigured = !!(mod.certTitle || mod.certSignerName);

              return (
                <div key={mod.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                  {/* Module header row */}
                  <button
                    className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : mod.id)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Award size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{mod.title}</span>
                        {isConfigured ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Configurado</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Padrão</span>
                        )}
                      </div>
                      {isConfigured && mod.certSignerName && (
                        <p className="text-xs text-muted-foreground mt-0.5">Assinado por: {mod.certSignerName}</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={18} className="text-muted-foreground flex-shrink-0" />}
                  </button>

                  {/* Expanded form */}
                  {isExpanded && (
                    <div className="border-t border-border p-5 space-y-4 bg-muted/10">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">
                          Título do Certificado
                        </label>
                        <Input
                          placeholder="Certificado de Conclusão"
                          value={f.certTitle}
                          onChange={(e) => setForm(mod.id, "certTitle", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">
                          Texto do Certificado
                        </label>
                        <Textarea
                          placeholder="Certificamos que o(a) participante concluiu com êxito..."
                          value={f.certBody}
                          onChange={(e) => setForm(mod.id, "certBody", e.target.value)}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          O nome do funcionário e o nome do curso são adicionados automaticamente.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">
                            Nome do Responsável pela Assinatura
                          </label>
                          <Input
                            placeholder="Ex: Dra. Ana Paula Silva"
                            value={f.certSignerName}
                            onChange={(e) => setForm(mod.id, "certSignerName", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">
                            Cargo / Função
                          </label>
                          <Input
                            placeholder="Ex: Coordenadora de Saúde do Trabalho"
                            value={f.certSignerRole}
                            onChange={(e) => setForm(mod.id, "certSignerRole", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          onClick={() => handleSave(mod)}
                          disabled={updateMutation.isPending}
                          className="bg-primary text-primary-foreground"
                        >
                          {updateMutation.isPending ? "Salvando..." : "Salvar Configuração"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setPreviewId(mod.id)}
                          className="gap-2"
                        >
                          <Eye size={14} /> Pré-visualizar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewModule && previewForm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Certificate preview */}
            <div className="relative p-10 text-center"
              style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #f0f7f4 50%, #e8f4f8 100%)" }}
            >
              {/* Outer border */}
              <div className="absolute inset-4 border-2 border-[#1e3a5f] rounded-lg pointer-events-none" />
              <div className="absolute inset-6 border border-[#2d7a5f] rounded-lg pointer-events-none" />

              <div className="relative z-10 space-y-4">
                <div>
                  <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain mx-auto mb-2" />
                  <p className="text-[#1e3a5f] font-bold text-lg tracking-widest uppercase" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Saúde do Trabalho
                  </p>
                  <p className="text-[#2d7a5f] text-xs">Plataforma de Saúde Mental e Bem-Estar Corporativo</p>
                </div>
                <div className="border-t border-[#1e3a5f]/20 pt-4">
                  <p className="text-[#1e3a5f] font-bold text-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {previewForm.certTitle || "Certificado de Conclusão"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-500 text-sm">Certificamos que</p>
                  <p className="text-[#1e3a5f] font-bold text-xl border-b-2 border-[#2d7a5f] inline-block pb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Nome do Funcionário
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    {previewForm.certBody || "Este certificado atesta a participação e aprovação no curso indicado, demonstrando o comprometimento com o desenvolvimento profissional e com a saúde, segurança e qualidade de vida no trabalho."}
                  </p>
                  <p className="text-[#2d7a5f] font-semibold text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {previewModule.title}
                  </p>
                </div>
                {previewForm.certSignerName && (
                  <div className="border-t border-[#1e3a5f]/20 pt-4 mt-4">
                    <p className="text-[#1e3a5f] font-semibold text-sm">{previewForm.certSignerName}</p>
                    {previewForm.certSignerRole && (
                      <p className="text-gray-500 text-xs">{previewForm.certSignerRole}</p>
                    )}
                  </div>
                )}
                <p className="text-gray-400 text-xs mt-4">Código de Verificação: XXXX-XXXX-XXXX</p>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <Button variant="outline" onClick={() => setPreviewId(null)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
