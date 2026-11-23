/**
 * THE SEND PAGE'S READS, OVER REAL HTTP AND A REAL SCHEMA.
 *
 * `server/routes/pay.ts` mounted on its own with the real members repository
 * against the scratch schema. What is pinned is the privacy promise in its
 * header, case by case, and the two refusals a request link can meet:
 *
 *   - a search is for a signed-in accepted member, needs two letters, matches a
 *     PREFIX of a handle or of a word of a name and never a substring, answers
 *     at most six, and never lists the asker, a standing example, somebody who
 *     has left, or somebody not yet a member;
 *   - an answer carries a handle, a name and the id, never an address;
 *   - the recent row is the asker's own counterparts, newest first;
 *   - a request link to your own handle is refused, an org link says ventures
 *     cannot take payments yet, and an unknown handle finds nobody;
 *   - the summary reads what the member holds and what a credit is worth.
 *
 * Every name is fake.
 */
import http from "node:http";
import express from "express";
import type { Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { allTokens, loadTokenRegistry, memberAccount, MINT_FAUCET, postTransfer } from "../lib/ledger";
import { usersRepo } from "../repos/users";
import { PAY_SEARCH_LIMIT } from "../../shared/payLink";
import { MEMBERS_SEARCH, NOBODY_THERE, ORG_NOT_YET, OWN_LINK, register, searchTerm } from "./pay";

const configured = testDbConfigured();
if (!configured) console.warn("[pay routes] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const person = (id: string, name: string, handle: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  handle,
  email: `${id}@village.example.test`,
  passwordHash: "x",
  tokenVersion: 0,
  membershipGranted: true,
  prefs: {},
  ...extra,
});

const PEOPLE = [
  person("u-ora", "Ora Vale", "ora"),
  person("u-ana", "Ana Mora", "ana"),
  person("u-anabel", "Anabel Rios", "bel"),
  person("u-juan", "Juan Ananda", "juanito"),
  person("u-dan", "Dan Banana", "danb"),
  person("u-ghost", "Ana Gone", "departed-ana", { email: "deleted-u-ghost@anonymized.invalid" }),
  person("u-demo", "Ana Example", "anaex", { isExample: true }),
  person("u-new", "Anouk Newcomer", "anouk", { membershipGranted: false, stageGranted: null }),
  ...Array.from({ length: 8 }, (_, i) => person(`u-many${i}`, `Andra ${i}`, `andra${i}`)),
];

describe.skipIf(!configured)("/api/pay reads", () => {
  let db: TestDb;
  let pool: Pool;
  let server: http.Server;
  let base = "";
  const state = { viewer: "u-ora" as string | null, limited: false };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db);
    await loadTokenRegistry(pool);
    const members = usersRepo(pool);
    for (const p of PEOPLE) await members.add(p as any);
    const app = express();
    app.use(express.json());
    register(app, {
      authedUser: async () => (state.viewer ? await members.byId(state.viewer) : null),
      getPool: () => pool,
      members,
      overLimit: async () => state.limited,
      projectCurrency: () => "USD",
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("the test server did not report a port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  const get = async (url: string) => {
    const res = await fetch(`${base}${url}`); // module-review-ok: this suite's own loopback server, not an outbound call
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  const ids = (body: any) => (body.people ?? []).map((p: any) => p.id);

  it("refuses a visitor everything", async () => {
    state.viewer = null;
    for (const url of ["/api/pay", "/api/pay/people?q=ana", "/api/pay/recent", "/api/pay/resolve?to=@ana"]) {
      expect((await get(url)).status, url).toBe(401);
    }
    state.viewer = "u-ora";
  });

  it("finds by a handle prefix or a word of a name, never a substring, and never the asker", async () => {
    const r = await get("/api/pay/people?q=ana");
    expect(r.status).toBe(200);
    // "Ana Mora" and "Anabel Rios" by name, "Juan Ananda" by his second word. "Dan Banana" holds
    // "ana" only inside a word, so a substring search would list him and this one does not.
    expect(ids(r.body).sort()).toEqual(["u-ana", "u-anabel", "u-juan"]);
    expect(ids((await get("/api/pay/people?q=@bel")).body)).toEqual(["u-anabel"]);
    expect(ids((await get("/api/pay/people?q=ora")).body)).toEqual([]);
  });

  it("never lists somebody who has left, a standing example, or somebody not yet a member", async () => {
    const found = ids((await get("/api/pay/people?q=an")).body);
    expect(found).not.toContain("u-ghost");
    expect(found).not.toContain("u-demo");
    expect(ids((await get("/api/pay/people?q=anouk")).body)).toEqual([]);
  });

  it("answers handle, name and id only, at most six, and nothing under two letters", async () => {
    const r = await get("/api/pay/people?q=andra");
    expect(r.body.people).toHaveLength(PAY_SEARCH_LIMIT);
    for (const p of r.body.people) expect(Object.keys(p).sort()).toEqual(["handle", "id", "kind", "name"]);
    expect(JSON.stringify(r.body)).not.toContain("@village.example.test");
    expect((await get("/api/pay/people?q=a")).body).toEqual({ people: [] });
    expect(searchTerm(" @A ")).toBeNull();
    expect(searchTerm("@AN")).toBe("an");
  });

  it("keeps the search for members, and bounds it", async () => {
    state.viewer = "u-new";
    const r = await get("/api/pay/people?q=ana");
    expect(r.status).toBe(403);
    expect(r.body.error).toBe(MEMBERS_SEARCH);
    state.viewer = "u-ora";
    state.limited = true;
    expect((await get("/api/pay/people?q=ana")).status).toBe(429);
    expect((await get("/api/pay/resolve?to=@ana")).status).toBe(429);
    state.limited = false;
  });

  it("opens a request link to a member, and refuses your own, an org's and nobody's", async () => {
    const r = await get(`/api/pay/resolve?to=${encodeURIComponent("@Ana")}`);
    expect(r.status).toBe(200);
    expect(r.body.payee).toEqual({ kind: "member", id: "u-ana", handle: "ana", name: "Ana Mora" });
    // Somebody not yet a member shared their own link, so it opens.
    expect((await get("/api/pay/resolve?to=anouk")).body.payee?.id).toBe("u-new");
    expect(await get("/api/pay/resolve?to=@ora")).toEqual({ status: 409, body: { error: OWN_LINK } });
    expect(await get(`/api/pay/resolve?to=${encodeURIComponent("org:garden")}`)).toEqual({ status: 404, body: { error: ORG_NOT_YET } });
    expect(await get("/api/pay/resolve?to=@nobody-here")).toEqual({ status: 404, body: { error: NOBODY_THERE } });
    expect((await get("/api/pay/resolve?to=@anaex")).status).toBe(404);
    expect((await get("/api/pay/resolve?to=")).status).toBe(400);
  });

  it("lists the asker's own counterparts, newest first, and nobody else's", async () => {
    const credit = allTokens().find((t) => t.kind === "credit" && t.governance === "platform");
    expect(credit, "a platform credit token in the migrated registry").toBeTruthy();
    const slug = credit!.slug;
    const minted = await postTransfer(pool, { from: MINT_FAUCET, to: memberAccount("u-ora"), tokenType: slug, amount: 5000, source: "test_mint", idempotencyKey: "pay-test-mint" });
    expect(minted.ok, minted.ok ? "" : minted.error).toBe(true);
    const send = (to: string, key: string) =>
      postTransfer(pool, { from: memberAccount("u-ora"), to: memberAccount(to), tokenType: slug, amount: 100, source: "member_send", sourceRef: to, idempotencyKey: key });
    expect((await send("u-anabel", "pay-test-1")).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 1100));
    expect((await send("u-ana", "pay-test-2")).ok).toBe(true);
    expect(ids((await get("/api/pay/recent")).body)).toEqual(["u-ana", "u-anabel"]);
    // Ana sees Ora, who paid her, and not Anabel, whom she never paid.
    state.viewer = "u-ana";
    expect(ids((await get("/api/pay/recent")).body)).toEqual(["u-ora"]);
    state.viewer = "u-juan";
    expect(ids((await get("/api/pay/recent")).body)).toEqual([]);
    state.viewer = "u-ora";

    const summary = (await get("/api/pay")).body;
    expect(summary.me).toEqual({ kind: "member", id: "u-ora", handle: "ora", name: "Ora Vale" });
    const row = summary.tokens.find((t: any) => t.slug === slug);
    if (row) expect(row.balance).toBe(4800);
    expect(summary.villageCurrency).toBe("USD");
  });
});
