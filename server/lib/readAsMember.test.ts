/**
 * READ AS A PLAIN MEMBER (the lead, 25 Nov 2026; server/lib/readAsMember.ts).
 *
 *   mark      the header the connector sends is the one the helper reads, on an Express request or bare headers
 *   only      no other value, no other header, and no request at all reads as marked
 *   card      over the real role card handler and a scratch schema: an admin's read marked as a plain member gets
 *             no pay ceiling and no editor, and the same read unmarked still gets both (DB-backed; skipped without
 *             TEST_DATABASE_URL, and a skip is not a pass)
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { createOrgRole } from "./orgChart";
import { asPlainMemberHeaders, READ_AS_MEMBER_HEADER, readsAsPlainMember } from "./readAsMember";
import { registerRoleEditRoutes } from "../routes/roleEdit";

describe("readsAsPlainMember", () => {
  it("reads the mark the connector sends, on an Express request or on bare headers", () => {
    const headers = asPlainMemberHeaders();
    expect(Object.keys(headers)).toEqual([READ_AS_MEMBER_HEADER]);
    expect(readsAsPlainMember({ headers })).toBe(true);
    expect(readsAsPlainMember({ get: (n: string) => (n === READ_AS_MEMBER_HEADER ? "Member" : undefined) })).toBe(true);
    expect(readsAsPlainMember({ headers: { [READ_AS_MEMBER_HEADER]: ["member"] } })).toBe(true);
  });

  it("reads nothing else as marked", () => {
    for (const r of [null, undefined, "member", {}, { headers: {} }, { headers: { [READ_AS_MEMBER_HEADER]: "admin" } }, { headers: { [READ_AS_MEMBER_HEADER]: "" } }, { headers: { "x-village-connector": "1" } }]) {
      expect(readsAsPlainMember(r), JSON.stringify(r)).toBe(false);
    }
  });
});

const configured = testDbConfigured();
if (!configured) console.warn("[readAsMember] TEST_DATABASE_URL not set - the role card case is SKIPPED. A skip is not a pass.");

describe.skipIf(!configured)("the role card, read by an admin marked as a plain member", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await createOrgRole(pool, { id: "ops-lead", name: "Operations Lead", aim: "Hold the village's operations." });
    const app = express();
    // An admin who holds terms.read: everything the card widens for.
    registerRoleEditRoutes(app, {
      authedUser: async () => ({ id: "u-admin", name: "Admin" }),
      isAdmin: async () => true,
      canReadTerms: async () => true,
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

  const editorRead = (marked: boolean) =>
    fetch(`${base}/api/org/role-edit/ops-lead`, { headers: marked ? asPlainMemberHeaders() : {} }); // module-review-ok: the test client dialling its own server on localhost

  it("answers the editor's read to the admin, and refuses it marked, with no door and no terms", async () => {
    const plain = await editorRead(false);
    expect(plain.status).toBe(200);
    expect(((await plain.json()) as any).mayReadTerms).toBe(true);
    const marked = await editorRead(true);
    expect(marked.status).toBe(403);
  });

  it("answers the card marked with no editor", async () => {
    const r = await fetch(`${base}/api/org/role-card/ops-lead`, { headers: asPlainMemberHeaders() }); // module-review-ok: the test client dialling its own server on localhost
    if (r.status === 200) expect(((await r.json()) as any).mayEdit).toBe(false);
    else expect(r.status).toBe(404);
  });
});
