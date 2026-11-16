/**
 * What a reader in another language sees of the village's own words
 * (server/lib/contentTranslationRead.ts), on a real schema: a translation shows
 * only while it translates the English shown now; a machine draft is named so
 * the page marks it; a binding page never answers with one; and a request that
 * names no translated language reads the English.
 */
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { pageSpecForSection } from "../../shared/pageContent";
import { resolvePageRaw } from "../../shared/pageContent/resolve";
import { overlayPageRaw } from "../../shared/contentTranslationOverlay";
import { approveDraft, sourceHash, writeTranslation } from "../repos/contentTranslations";
import { machineWritten, pageEnglishAt, pageTranslation, readerLocale, roleCardTranslation } from "./contentTranslationRead";
import type { RoleCardSections } from "../../shared/roleCardSections";

const configured = testDbConfigured();
if (!configured) console.warn("[contentTranslationRead] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const STEWARD = "page-journey-steward";

/** The first plain-text field of a page, read from its spec. */
function firstTextField(section: string): string {
  const spec = pageSpecForSection(section)!;
  for (const s of spec.sections) for (const f of s.fields) if (f.kind !== "link") return `${s.id}.${f.key}`;
  throw new Error("no text field");
}

describe("readerLocale", () => {
  const req = (v?: string) => ({ get: (h: string) => (h === "x-village-locale" ? v : undefined) });
  it("reads a translated language, and nothing else", () => {
    expect(readerLocale(req("es"))).toBe("es");
    expect(readerLocale(req(" es "))).toBe("es");
    expect(readerLocale(req("en"))).toBeNull();
    expect(readerLocale(req("xx"))).toBeNull();
    expect(readerLocale(req())).toBeNull();
  });
});

describe.skipIf(!configured)("translated village words, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  const role = {
    id: "legal-steward",
    name: "Legal Steward",
    aim: "Hold the legal side of {village}.",
    whyItMatters: "Without it nothing is signed.",
    accountabilities: ["Keep the books", "File the forms"],
  };
  const sections = { aiSupport: "An AI drafts the forms.", payNote: "Paid each moon.", qualities: ["Calm", "Careful"], idealBackground: [], payShape: [] } as unknown as RoleCardSections;

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const w = (kind: "role_card" | "role_card_sections", field: string, english: string, text: string, status: "ai_draft" | "approved") =>
      writeTranslation(pool, { kind, refKey: role.id, field, locale: "es", text, sourceHash: sourceHash(english), status, by: status === "approved" ? "u-mara" : null });
    await w("role_card", "aim", role.aim, "Sostener lo legal de {village}.", "approved");
    await w("role_card", "name", role.name, "Steward de Legal", "ai_draft");
    // Made from English the card no longer says: stale, never shown.
    await w("role_card", "why_it_matters", "Without it, nothing gets signed.", "Sin ello no se firma nada.", "approved");
    await w("role_card", "accountabilities.1", "File the forms", "Presentar los formularios", "approved");
    await w("role_card_sections", "qualities.0", "Calm", "Calma", "ai_draft");
    await w("role_card_sections", "payNote", "Paid each moon.", "Se paga cada luna.", "approved");
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("lays the fresh translations over the card, line by line, and names the machine's", async () => {
    const t = await roleCardTranslation(pool, role, sections, "es");
    expect(t).not.toBeNull();
    expect(t!.seat).toEqual({
      aim: "Sostener lo legal de {village}.",
      name: "Steward de Legal",
      accountabilities: ["Keep the books", "Presentar los formularios"],
    });
    expect(t!.sections).toEqual({ qualities: ["Calma", "Careful"], payNote: "Se paga cada luna." });
    expect(t!.machine.sort()).toEqual(["role_card:name", "role_card_sections:qualities.0"]);
  });

  it("falls back to the English once the card's words change", async () => {
    const edited = { ...role, aim: "Hold the legal and finance side of {village}." };
    const t = await roleCardTranslation(pool, edited, null, "es");
    expect(t!.seat.aim).toBeUndefined();
    expect(t!.sections).toEqual({});
  });

  it("answers null for a language with nothing translated", async () => {
    expect(await roleCardTranslation(pool, role, sections, "en-XA")).toBeNull();
  });

  it("translates a page's words against the English it shows, defaults included", async () => {
    const field = firstTextField(STEWARD);
    const english = pageEnglishAt(STEWARD, null, field)!;
    expect(english).toBeTruthy();
    await writeTranslation(pool, { kind: "page_section", refKey: STEWARD, field, locale: "es", text: "Unas palabras en español", sourceHash: sourceHash(english), status: "ai_draft", by: null });
    const t = await pageTranslation(pool, STEWARD, null, "es");
    expect(t).toMatchObject({ fields: { [field]: "Unas palabras en español" }, machine: [field] });

    // The page lays it over its raw words, and only that field changes.
    const spec = pageSpecForSection(STEWARD)!;
    const raw = resolvePageRaw(spec, null);
    const over = overlayPageRaw(raw, t!.fields);
    const [sid, key] = field.split(".");
    expect(over[sid].fields[key]).toBe("Unas palabras en español");
    expect(Object.keys(over)).toEqual(Object.keys(raw));

    // The village rewrites that field: the Spanish of the old words stops showing.
    const stored = { [sid]: { [key]: "Our own new words" } };
    expect(await pageTranslation(pool, STEWARD, stored, "es")).toBeNull();
  });

  // Rye, 15 Nov 2026: drafts are shown marked until a person approves them. Every
  // served draft carries the mark on every reader path; approved words never do.
  it("marks every served draft on the role card and never an approved line, and drops the mark once approved", async () => {
    const r = { ...role, id: "seed-steward", aim: "Keep the seed.", accountabilities: ["Swap seed", "Store seed"] };
    const secs = { aiSupport: "An AI drafts the list.", payNote: "", qualities: ["Patient"], idealBackground: [], payShape: [] } as unknown as RoleCardSections;
    const w = (kind: "role_card" | "role_card_sections", field: string, english: string, text: string, status: "ai_draft" | "approved") =>
      writeTranslation(pool, { kind, refKey: r.id, field, locale: "es", text, sourceHash: sourceHash(english), status, by: status === "approved" ? "u-mara" : null });
    await w("role_card", "aim", r.aim, "Guardar la semilla.", "approved");
    await w("role_card", "accountabilities.0", "Swap seed", "Intercambiar semilla", "ai_draft");
    await w("role_card", "accountabilities.1", "Store seed", "Guardar semilla", "approved");
    await w("role_card_sections", "aiSupport", secs.aiSupport, "Una IA redacta la lista.", "ai_draft");
    const t = (await roleCardTranslation(pool, r, secs, "es"))!;
    expect(t.machine.sort()).toEqual(["role_card:accountabilities.0", "role_card_sections:aiSupport"]);
    expect(t.machine).not.toContain("role_card:aim");
    expect(t.machine).not.toContain("role_card:accountabilities.1");

    expect(await approveDraft(pool, { kind: "role_card", refKey: r.id, field: "accountabilities.0", locale: "es" }, sourceHash("Swap seed"), "u-mara")).toBe(true);
    expect(await approveDraft(pool, { kind: "role_card_sections", refKey: r.id, field: "aiSupport", locale: "es" }, sourceHash(secs.aiSupport), "u-mara")).toBe(true);
    const after = (await roleCardTranslation(pool, r, secs, "es"))!;
    expect(after.seat.accountabilities).toEqual(["Intercambiar semilla", "Guardar semilla"]);
    expect(after.machine).toEqual([]);
  });

  it("marks every served draft on a page and never an approved field", async () => {
    const page = "page-journey-resident";
    const spec = pageSpecForSection(page)!;
    const texts: string[] = [];
    for (const s of spec.sections) for (const f of s.fields) if (f.kind !== "link" && texts.length < 2) texts.push(`${s.id}.${f.key}`);
    expect(texts.length).toBe(2);
    const [drafted, approved] = texts;
    for (const [field, status] of [[drafted, "ai_draft"], [approved, "approved"]] as const) {
      const english = pageEnglishAt(page, null, field)!;
      await writeTranslation(pool, { kind: "page_section", refKey: page, field, locale: "es", text: `es ${field}`, sourceHash: sourceHash(english), status, by: status === "approved" ? "u-mara" : null });
    }
    const t = (await pageTranslation(pool, page, null, "es"))!;
    expect(Object.keys(t.fields).sort()).toEqual([drafted, approved].sort());
    expect(t.machine).toEqual([drafted]);
    await approveDraft(pool, { kind: "page_section", refKey: page, field: drafted, locale: "es" }, sourceHash(pageEnglishAt(page, null, drafted)!), "u-mara");
    expect((await pageTranslation(pool, page, null, "es"))!.machine).toEqual([]);
  });

  it("reads a row with any status but a person's approval as a machine's, and marks it", async () => {
    const field = firstTextField(STEWARD);
    const english = pageEnglishAt(STEWARD, null, field)!;
    await pool.query( // module-review-ok: a test planting a status the store never writes, to prove the reader still marks it
      "INSERT INTO content_translations (kind, ref_key, field, locale, text, source_hash, status) VALUES ('page_section', ?, ?, 'es', 'Palabras', ?, 'pending') ON DUPLICATE KEY UPDATE status = VALUES(status), text = VALUES(text), source_hash = VALUES(source_hash)",
      [STEWARD, field, sourceHash(english)],
    );
    expect((await pageTranslation(pool, STEWARD, null, "es"))!.machine).toEqual([field]);
    expect(machineWritten({ status: "approved" })).toBe(false);
    expect(machineWritten({ status: "ai_draft" })).toBe(true);
  });

  it("never answers with a translation of a binding page", async () => {
    // Even a row written past the store's own refusal is not shown.
    await pool.query( // module-review-ok: a test planting the row the store itself refuses, to prove the reader still hides it
      "INSERT INTO content_translations (kind, ref_key, field, locale, text, source_hash, status) VALUES ('page_section', 'page-love-letter', 'a.b', 'es', 'x', ?, 'approved')",
      [sourceHash("x")],
    );
    expect(await pageTranslation(pool, "page-love-letter", null, "es")).toBeNull();
    expect(await pageTranslation(pool, "page-no-such-page", null, "es")).toBeNull();
    expect(await pageTranslation(pool, "legal", null, "es")).toBeNull();
  });
});
