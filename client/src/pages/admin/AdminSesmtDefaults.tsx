import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FileText,
  Save,
  Loader2,
  Building2,
  Sparkles,
  Globe2,
} from "lucide-react";

// Bruno R5 #6/#8 — Textos padrão multi-documento.
// Empresas editam o próprio texto (escopo company). Super Admin pode editar o GLOBAL,
// com opção de aplicar a clientes atuais e/ou definir como template para futuros.
// Tipos: PGR, Psico (Laudo Psicossocial), AEP, LTCAT.

const DOC_TYPES = [
  { key: "pgr", label: "PGR — Programa de Gerenciamento de Riscos" },
  { key: "psico", label: "Laudo Psicossocial (DRPS)" },
  { key: "aep", label: "AEP — Análise Ergonômica Preliminar" },
  { key: "ltcat", label: "LTCAT — Laudo Técnico das Condições Ambientais" },
  { key: "pcmso", label: "PCMSO — Programa de Controle Médico" },
  { key: "insalubridade", label: "Laudo de Insalubridade" },
  { key: "periculosidade", label: "Laudo de Periculosidade" },
] as const;
type DocKey = (typeof DOC_TYPES)[number]["key"];

export default function AdminSesmtDefaults() {
  const { user } = useAuth();
  const isGlobal =
    user?.role === "admin_global" || user?.role === "super_admin";

  const [docType, setDocType] = useState<DocKey>("pgr");
  const [scope, setScope] = useState<"company" | "global">("company");
  const [pickedCompanyId, setPickedCompanyId] = useState<number | null>(null);
  const [applyToCurrent, setApplyToCurrent] = useState(false);
  const [applyToFuture, setApplyToFuture] = useState(true);

  const companiesQ = trpc.pgr.listCompanies.useQuery(undefined, {
    enabled: isGlobal,
  });
  const companies = (companiesQ.data ?? []) as Array<{
    id: number;
    name: string;
  }>;

  const enabled =
    scope === "global" ? isGlobal : !isGlobal || !!pickedCompanyId;
  const queryInput = {
    docType,
    scope,
    ...(scope === "company" && isGlobal && pickedCompanyId
      ? { companyId: pickedCompanyId }
      : {}),
  };
  const dataQ = trpc.sesmt.getDefaultTextsV2.useQuery(queryInput, { enabled });

  const saveMut = trpc.sesmt.saveDefaultTextsV2.useMutation({
    onSuccess: (r: any) => {
      if (r?.appliedToCompanies)
        toast.success(
          `Texto global salvo e aplicado a ${r.appliedToCompanies} empresa(s).`
        );
      else toast.success("Texto padrão salvo.");
      const received =
        Number(r?.normalization?.introduction?.received || 0) +
        Number(r?.normalization?.conclusion?.received || 0);
      const saved =
        Number(r?.normalization?.introduction?.saved || 0) +
        Number(r?.normalization?.conclusion?.saved || 0);
      if (received > saved + 1000)
        toast.info(
          `A formatação invisível do editor foi limpa: ${received.toLocaleString("pt-BR")} caracteres recebidos e ${saved.toLocaleString("pt-BR")} salvos.`,
          { duration: 7000 }
        );
      dataQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const [intro, setIntro] = useState("");
  const [concl, setConcl] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dataQ.data) {
      setIntro(dataQ.data.texto_introducao ?? "");
      setConcl(dataQ.data.texto_conclusao ?? "");
      setApplyToFuture(!!(dataQ.data as any).applyToFuture);
      setDirty(false);
    }
  }, [dataQ.data]);

  function save() {
    if (scope === "company" && isGlobal && !pickedCompanyId) {
      toast.error("Selecione a empresa.");
      return;
    }
    saveMut.mutate({
      docType,
      scope,
      ...(scope === "company" && isGlobal && pickedCompanyId
        ? { companyId: pickedCompanyId }
        : {}),
      textoIntroducao: intro,
      textoConclusao: concl,
      ...(scope === "global" ? { applyToCurrent, applyToFuture } : {}),
    });
  }

  const docLabel = DOC_TYPES.find(d => d.key === docType)?.label ?? "";
  const isSeed = (dataQ.data as any)?.source?.startsWith?.("seed");
  const isGlobalFallback = (dataQ.data as any)?.source === "global-fallback";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        <header>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <FileText size={22} className="text-primary" />
            Textos Padrão dos Documentos Técnicos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre Introdução e Conclusão padrão para PGR, PCMSO, laudos
            psicossociais e documentos técnicos. Cada documento gerado herda
            essa cópia, ficando totalmente editável.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Tipo de documento
            </label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as DocKey)}
              className="w-full border rounded px-3 py-2 bg-white"
            >
              {DOC_TYPES.map(d => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          {isGlobal && (
            <div>
              <label className="block text-xs font-semibold mb-1">Escopo</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value as any)}
                className="w-full border rounded px-3 py-2 bg-white"
              >
                <option value="company">Empresa específica</option>
                <option value="global">🌐 GLOBAL (todas as empresas)</option>
              </select>
            </div>
          )}
          {isGlobal && scope === "company" && (
            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
                <Building2 size={12} /> Empresa
              </label>
              <select
                value={pickedCompanyId ?? ""}
                onChange={e =>
                  setPickedCompanyId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full border rounded px-3 py-2 bg-white"
              >
                <option value="">— selecione —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!enabled && (
          <div className="text-sm text-muted-foreground p-8 text-center border border-dashed rounded-lg">
            {scope === "company"
              ? "Selecione a empresa para carregar e editar."
              : "Carregando..."}
          </div>
        )}

        {enabled && (
          <>
            {scope === "global" && (
              <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-3 text-xs flex items-start gap-2">
                <Globe2 size={14} className="text-indigo-700 shrink-0 mt-0.5" />
                <div className="text-indigo-900">
                  <b>Você está editando o texto GLOBAL para "{docLabel}".</b>{" "}
                  Usado como fallback para empresas que não tenham texto próprio
                  cadastrado.
                </div>
              </div>
            )}
            {isSeed && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs flex items-start gap-2">
                <Sparkles
                  size={14}
                  className="text-amber-700 shrink-0 mt-0.5"
                />
                <div className="text-amber-900">
                  <b>Texto sugestivo pré-preenchido.</b> Edite e clique em
                  "Salvar" para fixar como padrão.
                </div>
              </div>
            )}
            {isGlobalFallback && (
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs flex items-start gap-2">
                <Globe2 size={14} className="text-sky-700 shrink-0 mt-0.5" />
                <div className="text-sky-900">
                  Esta empresa ainda usa o texto <b>GLOBAL</b>. Salvar agora
                  cria uma versão própria para a empresa, sem afetar o global.
                </div>
              </div>
            )}

            <section className="bg-white border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">
                  1. Introdução — {docLabel}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {intro.length} caracteres
                </span>
              </div>
              <RichTextEditor
                value={intro}
                onChange={html => {
                  setIntro(html);
                  setDirty(true);
                }}
                minHeight={320}
                placeholder="Comece a digitar a introdução..."
              />
            </section>

            <section className="bg-white border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">
                  2. Conclusão — {docLabel}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {concl.length} caracteres
                </span>
              </div>
              <RichTextEditor
                value={concl}
                onChange={html => {
                  setConcl(html);
                  setDirty(true);
                }}
                minHeight={220}
                placeholder="Comece a digitar a conclusão técnica..."
              />
            </section>

            {scope === "global" && (
              <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 space-y-2">
                <div className="text-sm font-semibold text-indigo-900">
                  Aplicação do texto global
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToCurrent}
                    onChange={e => setApplyToCurrent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <b>Aplicar aos clientes ATUAIS</b> — sobrescreve o texto
                    próprio de todas as empresas ativas com esta versão global.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToFuture}
                    onChange={e => setApplyToFuture(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <b>Aplicar aos clientes FUTUROS</b> — empresas novas ou que
                    não tenham texto próprio usam este global automaticamente.
                  </span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                {dirty
                  ? "Alterações não salvas — clique em Salvar para aplicar."
                  : (dataQ.data as any)?.updatedAt
                    ? `Última atualização: ${new Date((dataQ.data as any).updatedAt).toLocaleString("pt-BR")}`
                    : ""}
              </div>
              <Button
                onClick={save}
                disabled={saveMut.isPending || !dirty}
                className="gap-2"
              >
                {saveMut.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Salvar como padrão
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
