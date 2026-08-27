import { describe, expect, it } from "vitest";
import { featureMatchesAudience, probabilityForCommercialStatus, scopeSql } from "./commercialRouter";

describe("isolamento comercial por rede", () => {
  it("gera filtros diferentes para o SuperAdmin Global e cada White Label", () => {
    expect(scopeSql({ ownerType: "global", ownerId: 0 })).toBe("commercial_owner_type='global' AND commercial_owner_id=0");
    expect(scopeSql({ ownerType: "white_label", ownerId: 12 }, "p")).toBe("p.commercial_owner_type='white_label' AND p.commercial_owner_id=12");
    expect(scopeSql({ ownerType: "white_label", ownerId: 13 }, "p")).not.toBe(scopeSql({ ownerType: "white_label", ownerId: 12 }, "p"));
  });
});

describe("probabilidade do pipeline comercial", () => {
  it("aplica as probabilidades da planilha de referência", () => {
    expect(probabilityForCommercialStatus("novo_lead")).toBe(10);
    expect(probabilityForCommercialStatus("proposta_enviada")).toBe(60);
    expect(probabilityForCommercialStatus("contrato_em_assinatura")).toBe(95);
    expect(probabilityForCommercialStatus("convertida")).toBe(100);
    expect(probabilityForCommercialStatus("perdida")).toBe(0);
  });

  it("mantém compatibilidade com propostas do pipeline antigo", () => {
    expect(probabilityForCommercialStatus("lead")).toBe(10);
    expect(probabilityForCommercialStatus("reprovada")).toBe(0);
  });
});

describe("portfólio comercial por perfil", () => {
  it("prioriza conteúdo coerente com o público selecionado", () => {
    const pcmso = { name: "PCMSO Integrado", category: "Saúde Ocupacional", module_name: "Central Médica", audience_json: '["Médico do Trabalho","SESMT"]' };
    const analytics = { name: "Analytics Executivo", category: "Inteligência", module_name: "Dashboards", audience_json: '["Diretoria"]' };
    expect(featureMatchesAudience(pcmso, "medico")).toBe(true);
    expect(featureMatchesAudience(pcmso, "diretoria")).toBe(false);
    expect(featureMatchesAudience(analytics, "diretoria")).toBe(true);
  });
});
