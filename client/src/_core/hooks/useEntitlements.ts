import { trpc } from "@/lib/trpc";

export type Entitlements = {
  features: string[];
  full: boolean;
  gatingEnabled: boolean;
  planCode: string | null;
};

/**
 * Resolve as funcionalidades liberadas para a empresa do usuário atual.
 *
 * Projetado para ser seguro por padrão: enquanto carrega (ou se a query falhar),
 * `has()` sempre retorna true para não esconder nada por engano. O backend só
 * restringe de fato quando o Admin Global liga o gating global e a empresa tem
 * um plano com features definidas.
 */
export function useEntitlements() {
  const q = trpc.plans.myEntitlements.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const data = q.data as Entitlements | undefined;

  // Sem dados ainda (ou erro) => permissivo.
  const has = (featureCode: string): boolean => {
    if (!data) return true;
    if (data.full) return true;
    return data.features.includes(featureCode);
  };

  return {
    loading: q.isLoading,
    full: data?.full ?? true,
    gatingEnabled: data?.gatingEnabled ?? false,
    planCode: data?.planCode ?? null,
    features: data?.features ?? [],
    has,
  };
}
