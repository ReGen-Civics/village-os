import { describe, expect, it } from "vitest";
import { roleForSlug, rolePath, roleSlug, slugOfName } from "./roleSlug";

const roles = [
  { id: "role-1a2b3c", name: "Lead Finance Steward" },
  { id: "garden", name: "Garden Steward" },
  { id: "role-9f9f9f", name: "Lead Finance Steward" },
  { id: "role-own", name: "Anything", slug: "moon-keeper" },
  { id: "role-select", name: "Select" },
  { id: "role-blank", name: "!!!" },
];

describe("a role's own address", () => {
  it("slugs a name: lower case, accents dropped, dashes, at most 60 characters", () => {
    expect(slugOfName("Ñandú & Café Steward")).toBe("nandu-cafe-steward");
    expect(slugOfName("x".repeat(70)).length).toBe(60);
    expect(slugOfName("  ")).toBe("");
  });

  it("uses the role's own slug, else its name's, and its id when the name gives none, is reserved or is taken earlier", () => {
    expect(roleSlug(roles[0], roles)).toBe("lead-finance-steward");
    expect(roleSlug(roles[2], roles)).toBe("role-9f9f9f");
    expect(roleSlug(roles[3], roles)).toBe("moon-keeper");
    expect(roleSlug(roles[4], roles)).toBe("role-select");
    expect(roleSlug(roles[5], roles)).toBe("role-blank");
    expect(rolePath(roles[1], roles)).toBe("/roles/garden-steward");
  });

  it("reads an address back: an id always, then the first role whose slug it is, and nothing for a stranger", () => {
    expect(roleForSlug("lead-finance-steward", roles)?.id).toBe("role-1a2b3c");
    expect(roleForSlug("role-9f9f9f", roles)?.id).toBe("role-9f9f9f");
    expect(roleForSlug("garden", roles)?.id).toBe("garden");
    expect(roleForSlug("Garden-Steward", roles)?.id).toBe("garden");
    expect(roleForSlug("moon-keeper", roles)?.id).toBe("role-own");
    expect(roleForSlug("select", roles)).toBeNull();
    expect(roleForSlug("nobody", roles)).toBeNull();
    expect(roleForSlug("%E0%A4%A", roles)).toBeNull();
  });

  it("every role's own path leads back to it", () => {
    for (const r of roles) expect(roleForSlug(decodeURIComponent(rolePath(r, roles).slice(7)), roles)?.id).toBe(r.id);
  });
});
