import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { orChat } from "./contentforge/openrouter";
import {
  canReadKnowledgeArticle,
  knowledgeArticles,
  searchKnowledgeArticleList,
} from "./knowledgeCatalog";
import { loadCustomKnowledgeArticles } from "./guidanceRouter";
import { protectedProcedure, router } from "./trpc";

function roleOf(ctx: any) {
  const role = String(ctx.user?.role || "user");
  return role === "psicologo" ? "psychologist" : role;
}

function deterministicAnswer(question: string, articles: any[]) {
  const first = articles[0];
  if (!first)
    return "Não encontrei um procedimento correspondente na base atual. Você pode solicitar suporte humano e informar o caminho da tela e a mensagem exibida.";
  const steps = first.steps
    .slice(0, 6)
    .map((step: string, index: number) => `${index + 1}. ${step}`)
    .join("\n");
  return `Encontrei o procedimento “${first.title}”.\n\nCaminho: ${first.accessPath}\n\n${steps}\n\nAtenção: ${first.cautions[0] || "confira os dados antes de concluir."}`;
}

async function allArticles() {
  const custom = await loadCustomKnowledgeArticles();
  const merged = new Map(knowledgeArticles.map(article => [article.slug, article]));
  for (const article of custom) merged.set(article.slug, article);
  return Array.from(merged.values());
}

export const knowledgeRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(500).default(""),
        module: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const role = roleOf(ctx);
      const catalog = await allArticles();
      const articles = searchKnowledgeArticleList(
        catalog,
        input.query,
        role,
        input.limit
      ).filter(article => !input.module || article.module === input.module);
      return {
        articles,
        modules: Array.from(
          new Set(
            catalog
              .filter(article => canReadKnowledgeArticle(article, role))
              .map(article => article.module)
          )
        ).sort(),
      };
    }),

  get: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(160) }))
    .query(async ({ ctx, input }) => {
      const article = (await allArticles()).find(item => item.slug === input.slug);
      if (!article)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Artigo não encontrado.",
        });
      if (!canReadKnowledgeArticle(article, roleOf(ctx)))
        throw new TRPCError({ code: "FORBIDDEN" });
      return article;
    }),

  ask: protectedProcedure
    .input(z.object({ question: z.string().min(3).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const articles = searchKnowledgeArticleList(await allArticles(), input.question, roleOf(ctx), 4);
      const references = articles.map(
        ({ slug, title, summary, accessPath }) => ({
          slug,
          title,
          summary,
          accessPath,
        })
      );
      const fallback = deterministicAnswer(input.question, articles);
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey || !articles.length)
        return { answer: fallback, references, usedAi: false };
      const context = articles
        .map(
          (article, index) =>
            `ARTIGO ${index + 1}: ${article.title}\nCaminho: ${article.accessPath}\nResumo: ${article.summary}\nPassos:\n${article.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}\nCuidados:\n${article.cautions.join("\n")}`
        )
        .join("\n\n");
      try {
        const answer = await orChat(
          [
            {
              role: "system",
              content:
                "Você é o assistente de suporte da Plataforma Saúde do Trabalho. Responda em português brasileiro, de forma breve e operacional, usando exclusivamente os artigos fornecidos. Não invente telas, botões, regras ou integrações. Se os artigos não resolverem, diga isso e recomende suporte humano. Preserve LGPD e nunca exponha dados de outro usuário.",
            },
            {
              role: "user",
              content: `PERGUNTA:\n${input.question}\n\nBASE DE CONHECIMENTO AUTORIZADA:\n${context}`,
            },
          ],
          apiKey,
          false
        );
        return { answer: answer.trim() || fallback, references, usedAi: true };
      } catch {
        return { answer: fallback, references, usedAi: false };
      }
    }),
});
