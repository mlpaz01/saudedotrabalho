import { describe, expect, it } from "vitest";
import {
  PLATFORM_FEATURE_MANIFEST,
  PLATFORM_RELEASE,
} from "./platformFeatureManifest";

describe("manifesto versionado da plataforma", () => {
  it("mantém códigos únicos e conteúdo comercial completo", () => {
    const codes = PLATFORM_FEATURE_MANIFEST.map(item => item.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(PLATFORM_RELEASE.code).toMatch(/^\d{4}\.\d{2}\.\d{2}/);

    for (const item of PLATFORM_FEATURE_MANIFEST) {
      expect(item.version).toBeTruthy();
      expect(item.description.length).toBeGreaterThan(30);
      expect(item.problem.length).toBeGreaterThan(30);
      expect(item.objective.length).toBeGreaterThan(30);
      expect(item.benefits.length).toBeGreaterThan(1);
      expect(item.resources.length).toBeGreaterThan(1);
      expect(item.roles.length).toBeGreaterThan(0);
      expect(item.route.startsWith("/")).toBe(true);
    }
  });

  it("mantém PCD e PCA como módulos independentes", () => {
    const pcd = PLATFORM_FEATURE_MANIFEST.find(item => item.code === "pcd_management");
    const pca = PLATFORM_FEATURE_MANIFEST.find(item => item.code === "pca");
    expect(pcd?.route).toBe("/admin/gestao-pcd");
    expect(pca?.route).toBe("/admin/pca");
    expect(pcd?.moduleName).not.toBe(pca?.moduleName);
  });

  it("protege funcionalidades premium ao distribuir planos", () => {
    const clinic = PLATFORM_FEATURE_MANIFEST.find(item => item.code === "clinic_portal");
    const portfolio = PLATFORM_FEATURE_MANIFEST.find(item => item.code === "commercial_portfolio");
    expect(clinic?.planNames).toEqual(["Enterprise"]);
    expect(portfolio?.planNames).toEqual([]);
  });
});
