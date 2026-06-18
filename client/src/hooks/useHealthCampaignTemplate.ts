// /var/www/saudedotrabalho/client/src/hooks/useHealthCampaignTemplate.ts
// Hook que lê ?healthTemplate=<id> da URL e devolve o template completo
// para pré-preencher o formulário em AdminCampaigns.
//
// Uso em AdminCampaigns.tsx:
//
//   const healthTpl = useHealthCampaignTemplate();
//   useEffect(() => {
//     if (!healthTpl) return;
//     setSubject(healthTpl.suggestedEmailSubject);
//     setBody(healthTpl.suggestedEmailBody);
//     setName(healthTpl.name);
//     setAccentColor(healthTpl.colorHex);
//     // opcional: pré-selecionar cursos sugeridos
//   }, [healthTpl?.id]);

import { useMemo } from "react";
import { useSearch } from "wouter";
import { getHealthCampaignById, type HealthCampaignTemplate } from "@/data/healthCampaigns";

export function useHealthCampaignTemplate(): HealthCampaignTemplate | undefined {
  const search = useSearch();
  return useMemo(() => {
    const params = new URLSearchParams(search);
    const id = params.get("healthTemplate");
    if (!id) return undefined;
    return getHealthCampaignById(id);
  }, [search]);
}
