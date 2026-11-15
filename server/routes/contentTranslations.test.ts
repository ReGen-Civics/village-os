/**
 * APPROVE OR IMPROVE A TRANSLATION (server/routes/contentTranslations.ts), over
 * the real handlers and a scratch schema. The model is a stub: nothing here
 * calls a provider, and nothing runs against a live village.
 *
 *   - the power that writes the English is asked on every route;
 *   - a person's translation is approved in their name, and checked like the English;
 *   - machine drafts are off unless the server says on, never touch pay words, and
 *     a model answer that breaks the words in braces is refused;
 *   - approving a draft of English that has since changed is refused;
 *   - a member's suggestion is accepted through the same write.
 */
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { createOrgRole } from "../lib/orgChart";
import { adminEditControl } from "../lib/adminSuggestions";
import { translationsFor } from "../repos/contentTranslations";
import { register, type MachineDraftAsk } from "./contentTranslations";

const configured = testDbConfigured();
if (!configured) console.warn("[contentTranslations routes] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function fakeRes() {
  const r: any = { statusCode: 200, body: undefined as any, headers: {} as Record<string, string> };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  r.set = (k: string, v: string) => ((r.headers[k] = v), r);
  return r;
}

describe.skipIf(!configured)("translations of the village's words, over the real routes", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  const handlers = new Map<string, Handler>();
  const env: NodeJS.ProcessEnv = {};
  let allowed = true;
  let spent = false;
  const asked: string[] = [];
  let draftAnswer: (ask: MachineDraftAsk) => Record<string, string> = () => ({});
  const drafts: MachineDraftAsk[] = [];
  const content: Record<string, unknown> = {};

  const call = async (method: string, path: string, { query = {}, body = {} }: { query?: any; body?: any } = {}) => {
    const h = handlers.get(`${method} ${path}`);
    if (!h) throw new Error(`no route ${method} ${path}`);
    const res = fakeRes();
    await h({ query, body, get: () => undefined, headers: {} }, res);
    return res;
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await createOrgRole(pool, { id: "legal-steward", name: "Legal Steward", aim: "Hold the legal side of {village}.", accountabilities: ["Keep the books"] });
    await pool.query("UPDATE org_roles SET compensation_reality = 'Paid each moon.' WHERE id = 'legal-steward'");
    const record = (method: string) => (p: string, h: Handler) => void handlers.set(`${method} ${p}`, h);
    register({ get: record("GET"), put: record("PUT"), post: record("POST"), delete: record("DELETE") } as any, {
      guardCapability: async (_req, res, cap) => {
        asked.push(cap);
        if (!allowed) res.status(403).json({ error: "forbidden" });
        return allowed;
      },
      authedUser: async () => ({ id: "u-mara" }),
      getPool: () => pool,
      overLimit: async () => spent,
      contentSection: (s) => content[s],
      machineDraft: async (ask) => {
        drafts.push(ask);
        return draftAnswer(ask);
      },
      env,
    });
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  const rows = async (kind: "role_card" | "page_section", ref: string) => translationsFor(pool, kind, [ref], "es");

  it("asks the power that writes the English, and refuses without it", async () => {
    asked.length = 0;
    allowed = false;
    const r = await call("GET", "/api/admin/content-translations", { query: { kind: "role_card", ref: "legal-steward", locale: "es" } });
    expect(r.statusCode).toBe(403);
    const p = await call("PUT", "/api/admin/content-translations", { body: { kind: "page_section", ref: "page-journey-steward", field: "hero.headline", locale: "es", text: "x" } });
    expect(p.statusCode).toBe(403);
    expect(asked).toEqual(["org.decide", "story.tell"]);
    expect(await rows("page_section", "page-journey-steward")).toEqual([]);
    allowed = true;
  });

  it("lists a card's fields with their English and protection", async () => {
    const r = await call("GET", "/api/admin/content-translations", { query: { kind: "role_card", ref: "legal-steward", locale: "es" } });
    expect(r.statusCode).toBe(200);
    const by = Object.fromEntries(r.body.fields.map((f: any) => [f.field, f]));
    expect(by.aim).toMatchObject({ english: "Hold the legal side of {village}.", protection: "open", translation: null });
    expect(by["accountabilities.0"]).toMatchObject({ english: "Keep the books" });
    expect(by.compensation_reality).toMatchObject({ protection: "human_only" });
    expect(r.body.machineDrafts).toBe(false);
    // The editor names where a draft's words go before anything is sent.
    expect(r.body.machineDraftService).toBe("Anthropic's Claude");
    expect(r.body.machineDraftNotice).toMatch(/Anthropic's Claude/);
  });

  it("refuses a binding page, a field that is not there, and a broken translation", async () => {
    const b = await call("GET", "/api/admin/content-translations", { query: { kind: "page_section", ref: "page-love-letter", locale: "es" } });
    expect(b.statusCode).toBe(404);
    const missing = await call("PUT", "/api/admin/content-translations", { body: { kind: "role_card", ref: "legal-steward", field: "domain", locale: "es", text: "x" } });
    expect(missing.statusCode).toBe(404);
    const braces = await call("PUT", "/api/admin/content-translations", { body: { kind: "role_card", ref: "legal-steward", field: "aim", locale: "es", text: "Sostener lo legal de la aldea." } });
    expect(braces.statusCode).toBe(400);
    expect(braces.body.message).toMatch(/\{village\}/);
  });

  it("stores a person's translation, approved in their name", async () => {
    const r = await call("PUT", "/api/admin/content-translations", { body: { kind: "role_card", ref: "legal-steward", field: "compensation_reality", locale: "es", text: "Se paga cada luna." } });
    expect(r.statusCode).toBe(200);
    expect((await rows("role_card", "legal-steward")).find((x) => x.field === "compensation_reality")).toMatchObject({ status: "approved", approvedBy: "u-mara" });
  });

  it("drafts nothing while machine drafts are off", async () => {
    const r = await call("POST", "/api/admin/content-translations/draft", { body: { kind: "role_card", ref: "legal-steward", locale: "es" } });
    expect(r.statusCode).toBe(403);
    expect(drafts).toHaveLength(0);
  });

  it("stops a holder who asks for too many drafts in an hour, before anything is sent", async () => {
    env.CONTENT_MACHINE_DRAFTS = "on";
    spent = true;
    const r = await call("POST", "/api/admin/content-translations/draft", { body: { kind: "role_card", ref: "legal-steward", locale: "es" } });
    expect(r.statusCode).toBe(429);
    expect(drafts).toHaveLength(0);
    spent = false;
  });

  it("drafts the open fields, never pay words, and refuses a draft that drops the braces", async () => {
    env.CONTENT_MACHINE_DRAFTS = "on";
    draftAnswer = () => ({ aim: "Sostener lo legal de la aldea.", name: "Steward de Legal", "accountabilities.0": "Llevar las cuentas", compensation_reality: "Pagado" });
    const r = await call("POST", "/api/admin/content-translations/draft", { body: { kind: "role_card", ref: "legal-steward", locale: "es" } });
    expect(r.statusCode).toBe(200);
    expect(drafts[0].items.map((i) => i.field).sort()).toEqual(["accountabilities.0", "aim", "name"]);
    expect(r.body).toMatchObject({ drafted: 2, refused: 1, left: 0 });
    const got = Object.fromEntries((await rows("role_card", "legal-steward")).map((x) => [x.field, x]));
    expect(got.name).toMatchObject({ status: "ai_draft", createdBy: null });
    expect(got.aim).toBeUndefined();
    // The person's pay words stand; the model's were never asked for, and are not stored.
    expect(got.compensation_reality).toMatchObject({ text: "Se paga cada luna.", status: "approved" });
  });

  it("approves only the draft of the English the holder read", async () => {
    const list = await call("GET", "/api/admin/content-translations", { query: { kind: "role_card", ref: "legal-steward", locale: "es" } });
    const name = list.body.fields.find((f: any) => f.field === "name");
    expect(name.translation).toMatchObject({ status: "ai_draft", stale: false });
    const stale = await call("POST", "/api/admin/content-translations/approve", { body: { kind: "role_card", ref: "legal-steward", field: "name", locale: "es", sourceHash: "0".repeat(64) } });
    expect(stale.statusCode).toBe(409);
    const ok = await call("POST", "/api/admin/content-translations/approve", { body: { kind: "role_card", ref: "legal-steward", field: "name", locale: "es", sourceHash: name.sourceHash } });
    expect(ok.statusCode).toBe(200);
    expect((await rows("role_card", "legal-steward")).find((x) => x.field === "name")).toMatchObject({ status: "approved", approvedBy: "u-mara" });
  });

  it("shows a translation as stale once the English changes", async () => {
    await pool.query("UPDATE org_roles SET name = 'Legal and Finance Steward' WHERE id = 'legal-steward'");
    const list = await call("GET", "/api/admin/content-translations", { query: { kind: "role_card", ref: "legal-steward", locale: "es" } });
    // Kept, not dropped: the editor shows the old Spanish as "needs update" beside the new English.
    expect(list.body.fields.find((f: any) => f.field === "name")).toMatchObject({
      english: "Legal and Finance Steward",
      translation: { text: "Steward de Legal", status: "approved", stale: true, needsUpdate: true },
    });
  });

  it("accepts a member's suggestion through the same write, and refuses a stale one", async () => {
    const control = adminEditControl("page_translation")!;
    expect(control).toBeTruthy();
    const payload = { kind: "page_section", ref: "page-journey-steward", field: "hero.eyebrow", locale: "es", text: "  Sostener un rol  " };
    const prepared = await control.prepare!(payload, "u-ivo");
    expect(prepared.problem).toBeNull();
    const version = prepared.version!;
    // A role card's control will not carry a page's words.
    expect(adminEditControl("role_card_translation")!.problem(payload)).toMatch(/names its kind/);
    expect(await control.apply(prepared.payload, version, { decidedBy: "u-mara" })).toEqual({ ok: true });
    expect((await rows("page_section", "page-journey-steward")).find((x) => x.field === "hero.eyebrow")).toMatchObject({ text: "Sostener un rol", status: "approved", approvedBy: "u-mara" });
    // The translation moved since: the old version no longer applies.
    const again = await control.apply({ ...prepared.payload as object, text: "Otro" }, version, { decidedBy: "u-mara" });
    expect(again).toMatchObject({ ok: false, status: 409 });
  });

  it("takes a translation away", async () => {
    const r = await call("DELETE", "/api/admin/content-translations", { body: { kind: "page_section", ref: "page-journey-steward", field: "hero.eyebrow", locale: "es" } });
    expect(r.body).toEqual({ ok: true, removed: true });
    expect((await rows("page_section", "page-journey-steward")).find((x) => x.field === "hero.eyebrow")).toBeUndefined();
  });
});
