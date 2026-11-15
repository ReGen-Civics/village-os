/**
 * The two rules `content_translations` keeps in its statements
 * (server/repos/contentTranslations.ts), on a real schema:
 *   - a machine draft never replaces an approved translation of the same English;
 *   - approving approves only the draft the approver saw.
 */
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { approveDraft, removeTranslation, sourceHash, translationsFor, writeTranslation } from "./contentTranslations";

const configured = testDbConfigured();
if (!configured) console.warn("[contentTranslations] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

describe.skipIf(!configured)("content_translations, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  const aim = { kind: "role_card" as const, refKey: "legal-steward", field: "aim", locale: "es" };
  const english = "Hold the legal side of {village}.";
  const h = sourceHash(english);

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  const read = async () => (await translationsFor(pool, "role_card", ["legal-steward"], "es")).find((r) => r.field === "aim") ?? null;

  it("stores a machine draft with no author and no approver", async () => {
    expect(await writeTranslation(pool, { ...aim, text: "Llevar lo legal de {village}.", sourceHash: h, status: "ai_draft", by: null })).toBe("written");
    expect(await read()).toMatchObject({ status: "ai_draft", createdBy: null, approvedBy: null, sourceHash: h });
  });

  it("approves only the draft of the English the approver saw", async () => {
    expect(await approveDraft(pool, aim, sourceHash("Some other English."), "u-mara")).toBe(false);
    expect((await read())?.status).toBe("ai_draft");
    expect(await approveDraft(pool, aim, h, "u-mara")).toBe(true);
    expect(await read()).toMatchObject({ status: "approved", approvedBy: "u-mara" });
    // Already approved: a second approval changes nothing.
    expect(await approveDraft(pool, aim, h, "u-ivo")).toBe(false);
    expect((await read())?.approvedBy).toBe("u-mara");
  });

  it("keeps an approved translation when a machine drafts the same English again", async () => {
    expect(await writeTranslation(pool, { ...aim, text: "Otro borrador de {village}.", sourceHash: h, status: "ai_draft", by: null })).toBe("kept-approved");
    expect(await read()).toMatchObject({ text: "Llevar lo legal de {village}.", status: "approved" });
  });

  it("lets a machine draft new English over an approved translation of the old", async () => {
    const h2 = sourceHash("Hold the legal and finance side of {village}.");
    expect(await writeTranslation(pool, { ...aim, text: "Llevar lo legal y las finanzas de {village}.", sourceHash: h2, status: "ai_draft", by: null })).toBe("written");
    expect(await read()).toMatchObject({ status: "ai_draft", sourceHash: h2, approvedBy: null });
  });

  it("lets a person's improvement replace a draft, approved in their name", async () => {
    const h2 = sourceHash("Hold the legal and finance side of {village}.");
    expect(await writeTranslation(pool, { ...aim, text: "Sostener lo legal y las finanzas de {village}.", sourceHash: h2, status: "approved", by: "u-ivo" })).toBe("written");
    expect(await read()).toMatchObject({ status: "approved", createdBy: "u-ivo", approvedBy: "u-ivo" });
  });

  it("reads one locale and one kind only, and removes a translation", async () => {
    await writeTranslation(pool, { ...aim, locale: "fr", text: "Tenir {village}.", sourceHash: h, status: "approved", by: "u-ivo" });
    await writeTranslation(pool, { ...aim, kind: "role_card_sections", field: "aiSupport", text: "Apoyo.", sourceHash: h, status: "approved", by: "u-ivo" });
    const es = await translationsFor(pool, "role_card", ["legal-steward", "nobody"], "es");
    expect(es.map((r) => `${r.kind}/${r.field}/${r.locale}`)).toEqual(["role_card/aim/es"]);
    expect(await removeTranslation(pool, aim)).toBe(true);
    expect(await read()).toBeNull();
    expect(await translationsFor(pool, "role_card", [], "es")).toEqual([]);
  });

  it("hashes the English it would show, ignoring the spaces around it", () => {
    expect(sourceHash("  Hold it. ")).toBe(sourceHash("Hold it."));
    expect(sourceHash("Hold it.")).not.toBe(sourceHash("Hold it!"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
