import { describe, expect, it } from "vitest";
import { resolveImportedRoles } from "./importRoles";

describe("resolveImportedRoles", () => {
  it("preserva colaborador sem inferir chefia pelo cargo", () => {
    expect(resolveImportedRoles("Colaborador", true)).toEqual({ primary: "user", roles: ["user"] });
  });

  it("aceita múltiplos perfis e escolhe o principal pela hierarquia", () => {
    expect(resolveImportedRoles("chefia, cipa", true)).toEqual({ primary: "chefia", roles: ["chefia", "cipa"] });
  });

  it("não concede administrador quando o importador é RH", () => {
    expect(resolveImportedRoles("Administrador", false)).toEqual({ primary: "rh", roles: ["rh"] });
  });

  it("não transforma texto desconhecido em perfil administrativo", () => {
    expect(resolveImportedRoles("Operador de máquinas", true)).toEqual({ primary: "user", roles: ["user"] });
  });
});
