/**
 * THE ROLE CARD IN THE READER'S LANGUAGE MAY NOT BE CACHED ACROSS READERS
 * (coordinator, 15 Nov 2026). GET /api/org/role-card/:id answers a Spanish
 * reader with Spanish words, so it says `no-store` and `Vary: X-Village-Locale`
 * whether or not the reader asked in another language: a cache in front of it
 * can never hand a Spanish card to an English reader.
 *
 * The page route, GET /api/content/:section/translation (server/index.ts),
 * calls the same `noSharedCache`; its header is checked below against the
 * function, and its call against the source.
 *
 * Over the real handler, a real server and a scratch schema.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { createOrgRole } from "../lib/orgChart";
import { noSharedCache } from "../lib/contentTranslationRead";
import { sourceHash, writeTranslation } from "../repos/contentTranslations";
import { registerRoleEditRoutes } from "./roleEdit";

const configured = testDbConfigured();
if (!configured) console.warn("[roleEdit.translation] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

describe("noSharedCache", () => {
  it("says no-store and varies on the reader's language", () => {
    const set: Record<string, string> = {};
    noSharedCache({ set: (k, v) => (set[k] = v) });
    expect(set).toEqual({ "Cache-Control": "no-store", Vary: "X-Village-Locale" });
  });

  it("is called by the page translation route before it answers", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../index.ts"), "utf8");
    const at = src.indexOf('app.get("/api/content/:section/translation"');
    expect(at).toBeGreaterThan(0);
    const body = src.slice(at, src.indexOf("});", at));
    expect(body.indexOf("noSharedCache(res)")).toBeGreaterThan(0);
    expect(body.indexOf("noSharedCache(res)")).toBeLessThan(body.indexOf("res.json("));
  });
});

describe.skipIf(!configured)("GET /api/org/role-card/:id in another language", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await createOrgRole(pool, { id: "legal-steward", name: "Legal Steward", aim: "Hold the legal side." });
    await writeTranslation(pool, { kind: "role_card", refKey: "legal-steward", field: "aim", locale: "es", text: "Sostener lo legal.", sourceHash: sourceHash("Hold the legal side."), status: "ai_draft", by: null });
    const app = express();
    registerRoleEditRoutes(app, {
      authedUser: async () => null,
      isAdmin: async () => false,
      overLimit: async () => false,
      getPool: () => pool,
      liveHoldersOf: async () => [],
    } as any);
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server?.close(() => r()));
    await pool?.end();
    await db?.drop();
  });

  const card = (locale?: string) =>
    fetch(`${base}/api/org/role-card/legal-steward`, { headers: locale ? { "X-Village-Locale": locale } : {} }); // module-review-ok: the test client dialling its own server on localhost

  it("answers a Spanish reader in Spanish, marked, and never for a shared cache", async () => {
    const r = await card("es");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("vary")).toMatch(/X-Village-Locale/i);
    const body = (await r.json()) as any;
    expect(body.translation).toMatchObject({ locale: "es", seat: { aim: "Sostener lo legal." }, machine: ["role_card:aim"] });
  });

  it("answers an English reader in English, with the same headers", async () => {
    const r = await card();
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("vary")).toMatch(/X-Village-Locale/i);
    expect(((await r.json()) as any).translation).toBeNull();
  });
});
