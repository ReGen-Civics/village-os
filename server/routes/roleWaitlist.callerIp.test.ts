/**
 * THE VISITOR'S OWN ADDRESS, NEVER THE EDGE'S (applicant QA, 20 Nov 2026). The coming-soon waitlist and the role
 * card's reads keyed their rate limits on Express's `req.ip`, which, with no "trust proxy" set, is the platform edge's
 * address behind it: every visitor shared one bucket, so five sign-ups an hour from anybody closed the waitlist to
 * the whole village. They now key on `callerIp` (server/lib/clientIp.ts), the rule server/index.ts uses.
 */
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerRoleWaitlistRoutes } from "./roleWaitlist";
import { registerRoleEditRoutes } from "./roleEdit";

let server: http.Server;
let base = "";
const keys: string[] = [];
const limit = async (key: string) => {
  keys.push(key);
  // Every ask is answered "over the limit", so the route stops before it reads a database.
  return true;
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const nobody = async () => null;
  registerRoleWaitlistRoutes(app, { authedUser: nobody, isAdmin: async () => false, getPool: () => { throw new Error("no database in this test"); }, overLimit: limit });
  registerRoleEditRoutes(app, {
    authedUser: nobody,
    isAdmin: async () => false,
    getPool: () => { throw new Error("no database in this test"); },
    overLimit: limit,
    liveHoldersOf: async () => [],
    publishDeps: {} as never,
    circleName: () => null,
    canReadTerms: async () => false,
  });
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

// Two visitors arriving through the same proxy on loopback, as every visitor arrives through the edge.
const from = (ip: string) => ({ "x-forwarded-for": ip, "content-type": "application/json" });

describe("rate limits key on the visitor, through the proxy", () => {
  it("the waitlist counts each visitor on their own", async () => {
    keys.length = 0;
    for (const ip of ["203.0.113.7", "198.51.100.9"]) {
      const r = await fetch(`${base}/api/roles/waitlist`, { method: "POST", headers: from(ip), body: JSON.stringify({ email: "a@example.test", roleIds: ["x"] }) }); // module-review-ok: the test client dialling its own server on localhost
      expect(r.status).toBe(429);
    }
    expect(keys).toEqual(["role-waitlist:203.0.113.7", "role-waitlist:198.51.100.9"]);
  });

  it("the role card's reads, the founding team and the edit door count each visitor on their own", async () => {
    keys.length = 0;
    for (const route of ["/api/org/role-card/finance", "/api/org/founding-team", "/api/org/role-edit/access"]) {
      const r = await fetch(base + route, { headers: from("203.0.113.7") }); // module-review-ok: the test client dialling its own server on localhost
      expect(r.status).toBe(429);
    }
    expect(keys).toEqual(["role-card:203.0.113.7", "founding-team:203.0.113.7", "role-edit-access:203.0.113.7"]);
    // The loopback socket itself is never the key (the fault: one bucket for the whole village).
    expect(keys.some((k) => /127\.0\.0\.1|::1/.test(k))).toBe(false);
  });
});
