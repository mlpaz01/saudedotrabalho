import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/_core/hooks/useAuth";
import { FileText, Save, Loader2, Building2, Sparkles } from "lucide-react";

// Sprint 1.7-A — Perfil SESMT > Texto Padrão do PGR
//
// Permite à consultoria (RH/SESMT) ou ao Super Admin (para empresas específicas)
// cadastrar 2 textos padrão (Introdução + Conclusão) que serão automaticamente
// copiados em todo novo PGR. Cada PGR mantém sua cópia editável; alterar o
// padrão NÃO modifica PGRs existentes.
//
// Formatação aceita (renderizada no PDF):
//  - parágrafos separados por linha em branco
//  - listas com "- " ou "* "
//  - cabeçalhos: linhas inteiras em MAIÚSCULAS (com 6+ chars) viram <h3>
//  - **negrito** vira <b>

export default function AdminSesmtDefaults() {
  const { user } = useAuth();
  const isGlobal = user?.role === "admin_global" || user?.role === "super_admin";

  // Super Admin pode escolher para qual empresa salvar os textos.
  const [pickedCompanyId, setPickedCompanyId] = useState<number | null>(null);
  const companiesQ = trpc.pgr.listCompanies.useQuery(undefined, { enabled: isGlobal });
  const companies = (companiesQ.data ?? []) as Array<{ id: number; name: string }>;
  const queryInput = isGlobal && pickedCompanyId ? { companyId: pickedCompanyId } : {};
  const enabled = !isGlobal || !!pickedCompanyId;

  const dataQ = trpc.sesmt.getDefaultTexts.useQuery(queryInput, { enabled });
  const saveMut = trpc.sesmt.saveDefaultTexts.useMutation({
    onSuccess: () => { toast.success("Texto padrão salvo."); dataQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const [intro, setIntro] = useState("");
  const [concl, setConcl] = useState("");
  const [dirty, setDirty] = useState(false);

  // Carrega os textos vindos do backend (ou os defaults sugestivos) no estado local.
  useEffect(() => {
    if (dataQ.data) {
      setIntro(dataQ.data.texto_introducao ?? "");
      setConcl(dataQ.data.texto_conclusao ?? "");
      setDirty(false);
    }
  }, [dataQ.data]);

  function save() {
    if (isGlobal && !pickedCompanyId) { toast.error("Super Admin: selecione a empresa."); return; }
    saveMut.mutate({
      companyId: isGlobal ? pickedCompanyId! : undefined,
      textoIntroducao: intro,
      textoConclusao: concl,
    });
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <FileText size={22} className="text-primary" />
            Perfil SESMT — Texto Padrão do PGR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre aqui os textos de <b>Introdução</b> e <b>Conclusão</b> do PGR. Esses textos serão
            copiados automaticamente em todo novo PGR criado para sua empresa. Cada PGR mantém sua
            própria cópia editável — alterar o padrão NÃO modifica PGRs existentes.
          </p>
        </header>

        {isGlobal && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
            <label className="block text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
              <Building2 size={12} /> Empresa (obrigatório para Super Admin)
            </label>
            <select
              value={pickedCompanyId ?? ""}
              onChange={(e) => setPickedCompanyId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded px-3 py-2 bg-white"
            >
              <option value="">— selecione a empresa —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {!enabled && (
          <div className="text-sm text-muted-foreground p-8 text-center border border-dashed rounded-lg">
            {isGlobal ? "Selecione a empresa acima para carregar e editar os textos padrão." : "Carregando..."}
          </div>
        )}

        {enabled && (
          <>
            {dataQ.data?.isDefault && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs flex items-start gap-2">
                <Sparkles size={14} className="text-amber-700 shrink-0 mt-0.5" />
                <div className="text-amber-900">
                  <b>Textos sugestivos pré-preenchidos abaixo.</b> Edite à vontade e clique em "Salvar".
                  Após salvar, eles passam a ser o padrão da sua empresa.
                </div>
              </div>
            )}

            <section className="bg-white border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">1. Texto Padrão de Introdução do PGR</h2>
                <span className="text-xs text-muted-foreground">{intro.length} caracteres</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Texto de introdução técnica do PGR. Use a barra de formatação acima para negrito, listas, alinhamento, imagens e tabelas.
              </p>
              <RichTextEditor
                value={intro}
                onChange={(html) => { setIntro(html); setDirty(true); }}
                minHeight={320}
                placeholder="Comece a digitar a introdução do PGR..."
              />
            </section>

            <section className="bg-white border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">2. Texto Padrão de Conclusão do PGR</h2>
                <span className="text-xs text-muted-foreground">{concl.length} caracteres</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Fechamento técnico do PGR. Aparece logo antes da Responsabilidade Técnica e Assinatura.
              </p>
              <RichTextEditor
                value={concl}
                onChange={(html) => { setConcl(html); setDirty(true); }}
                minHeight={220}
                placeholder="Comece a digitar a conclusão técnica..."
              />
            </section>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                {dirty
                  ? "Alterações não salvas — clique em Salvar para aplicar."
                  : dataQ.data?.updatedAt
                    ? `Última atualização: ${new Date(dataQ.data.updatedAt).toLocaleString("pt-BR")}`
                    : ""}
              </div>
              <Button onClick={save} disabled={saveMut.isPending || !dirty} className="gap-2">
                {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar como padrão
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
