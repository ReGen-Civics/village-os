/**
 * The Treasury's two reads (server/routes/treasury.ts), against fake deps: the
 * doors answer what the gate says for each power, and the mint options open
 * only to a `token.mint` holder and carry a name and a token, never an email.
 */
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { register } from "./treasury";

const held = new Set<string>();
let signedIn = true;
let server: http.Server;
let base = "";

beforeAll(async () => {
  const app = express();
  register(app, {
    authedUser: (async () => (signedIn ? { id: "u-t" } : null)) as any,
    mayAct: (async (_req: any, cap: string) => ({ ok: held.has(cap) })) as any,
    guardCapability: (async (_req: any, res: any, cap: string) => {
      if (held.has(cap)) return true;
      res.status(401).json({ error: "auth_required" });
      return false;
    }) as any,
    members: {
      all: async () => [
        { id: "u-zed", name: "Zed Example", email: "zed@example.test", handle: "zed", role: "member" },
        { id: "u-ana", name: "Ana Example", email: "ana@example.test", handle: null, role: "admin" },
        { id: "x-1", name: "Standing Example", isExample: true },
      ],
    } as any,
    tokens: () => [
      { slug: "village-voice", name: "Village Voice", decimals: 3, governance: "platform" },
      { slug: "gratitude", name: "Gratitude", governance: "platform" },
      { slug: "hypha", name: "Hypha", governance: "hypha" },
      { slug: "demo", name: "Demo", governance: "platform", isExample: true },
    ],
    mintCap: () => 500,
  });
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });
beforeEach(() => { held.clear(); signedIn = true; });

const get = async (path: string) => {
  const r = await fetch(base + path);
  return { status: r.status, json: await r.json() };
};

describe("GET /api/treasury/doors", () => {
  it("refuses a visitor", async () => {
    signedIn = false;
    expect((await get("/api/treasury/doors")).status).toBe(401);
  });

  it("answers each door from the gate", async () => {
    expect((await get("/api/treasury/doors")).json).toEqual({ mint: false, cashPay: false, pay: false });
    held.add("token.mint");
    expect((await get("/api/treasury/doors")).json).toEqual({ mint: true, cashPay: false, pay: false });
    held.clear();
    held.add("moon.approve_alone");
    expect((await get("/api/treasury/doors")).json).toEqual({ mint: false, cashPay: false, pay: true });
    held.add("cash.pay");
    expect((await get("/api/treasury/doors")).json).toEqual({ mint: false, cashPay: true, pay: true });
  });
});

describe("GET /api/treasury/mint-options", () => {
  it("refuses a member without token.mint, cash.pay alone included", async () => {
    held.add("cash.pay");
    expect((await get("/api/treasury/mint-options")).status).toBe(401);
  });

  it("answers a token.mint holder the mintable tokens and a name for each member, and no email", async () => {
    held.add("token.mint");
    const r = await get("/api/treasury/mint-options");
    expect(r.status).toBe(200);
    expect(r.json.tokens).toEqual([{ slug: "village-voice", name: "Village Voice", decimals: 3 }]);
    expect(r.json.members).toEqual([
      { id: "u-ana", name: "Ana Example", handle: null },
      { id: "u-zed", name: "Zed Example", handle: "zed" },
    ]);
    expect(r.json.mintCapPerCycle).toBe(500);
    expect(JSON.stringify(r.json)).not.toContain("@example.test");
  });
});
