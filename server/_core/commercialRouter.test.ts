import { describe, expect, it } from "vitest";
import { scopeSql } from "./commercialRouter";

describe("isolamento comercial por rede", () => {
  it("gera filtros diferentes para o SuperAdmin Global e cada White Label", () => {
    expect(scopeSql({ ownerType: "global", ownerId: 0 })).toBe("commercial_owner_type='global' AND commercial_owner_id=0");
    expect(scopeSql({ ownerType: "white_label", ownerId: 12 }, "p")).toBe("p.commercial_owner_type='white_label' AND p.commercial_owner_id=12");
    expect(scopeSql({ ownerType: "white_label", ownerId: 13 }, "p")).not.toBe(scopeSql({ ownerType: "white_label", ownerId: 12 }, "p"));
  });
});
