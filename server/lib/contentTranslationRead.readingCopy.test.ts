import type { Pool } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import { sourceHash } from "../repos/contentTranslations";
import { pageEnglishAt, pageTranslation } from "./contentTranslationRead";

/** A pool that answers the translation read with these rows for the kind asked, as the table stores them. */
function poolWith(byKind: Record<string, Array<{ field: string; text: string; english: string; status: string }>>, section: string) {
  const asked: string[] = [];
  const pool = {
    query: async (_sql: string, params: unknown[]) => {
      const kind = String(params[0]);
      asked.push(kind);
      const rows = (byKind[kind] ?? []).map((r) => ({
        kind, ref_key: section, field: r.field, locale: "es", text: r.text, source_hash: sourceHash(r.english),
        status: r.status, created_by: "x", approved_by: "x", updated_at: new Date(0),
      }));
      return [rows, []];
    },
  } as unknown as Pool;
  return { pool, asked };
}

describe("a binding page answers with its reading copy, never a translation (the lead, 26 Nov 2026)", () => {
  const section = "page-rights-resident";
  const english = pageEnglishAt(section, null, "hero.headline")!;

  it("lays only the lines a person accepted, marked as a reading copy", async () => {
    const { pool, asked } = poolWith(
      {
        reading_copy: [
          { field: "hero.headline", text: "Sus derechos", english, status: "approved" },
          { field: "hero.intro", text: "Borrador de máquina", english: pageEnglishAt(section, null, "hero.intro")!, status: "ai_draft" },
        ],
        page_section: [{ field: "hero.headline", text: "Nunca", english, status: "approved" }],
      },
      section,
    );
    const t = await pageTranslation(pool, section, null, "es");
    expect(t).toEqual({ fields: { "hero.headline": "Sus derechos" }, machine: [], locale: "es", readingCopy: true });
    expect(asked).toEqual(["reading_copy"]);
  });

  it("a line written against English that has since changed is not shown", async () => {
    const { pool } = poolWith({ reading_copy: [{ field: "hero.headline", text: "Sus derechos", english: "Older words", status: "approved" }] }, section);
    expect(await pageTranslation(pool, section, null, "es")).toBeNull();
  });

  it("CONTROL: an ordinary page still reads its translation, unmarked", async () => {
    const home = "page-home";
    const { pool, asked } = poolWith({ page_section: [{ field: "hero.headline", text: "Hola", english: pageEnglishAt(home, null, "hero.headline")!, status: "approved" }] }, home);
    const t = await pageTranslation(pool, home, null, "es");
    expect(t?.fields).toEqual({ "hero.headline": "Hola" });
    expect(t && "readingCopy" in t).toBe(false);
    expect(asked).toEqual(["page_section"]);
  });
});
