import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { englishOf, translatableFields } from "./contentTranslationSource";
import { translationTarget } from "../../shared/contentTranslation";

const readers = (section: unknown) => ({ pool: null as unknown as Pool, contentSection: () => section });

describe("the site menu's names take a translation (the lead's Spanish audit, 26 Nov 2026)", () => {
  it("lists each menu row by its place, because its id is a page's path and a path is not an address", async () => {
    const fields = (await translatableFields(readers(null), "page_section", "page-site")) ?? [];
    const menu = fields.filter((f) => f.field.startsWith("menu.pages."));
    expect(menu.length).toBeGreaterThan(0);
    for (const f of menu) {
      expect(f.field, "addressed by place").toMatch(/^menu\.pages\.\d+\.(label|subtitle)$/);
      expect(translationTarget("page_section", "page-site", f.field).ok, f.field).toBe(true);
    }
    expect(fields.some((f) => f.field.includes("/"))).toBe(false);
  });

  it("finds a menu row's English by that place, so the save route accepts it", async () => {
    const fields = (await translatableFields(readers(null), "page_section", "page-site")) ?? [];
    const first = fields.find((f) => /^menu\.pages\.\d+\.label$/.test(f.field));
    expect(first).toBeTruthy();
    expect((await englishOf(readers(null), "page_section", "page-site", first!.field))?.english).toBe(first!.english);
  });
});
