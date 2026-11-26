/**
 * `GET /api/me/capabilities`: the viewer's own keys, as the read side of the one gate answers them.
 *
 * Pinned here: a plain member gets no admin key; the live view (a request marked to read as a plain member)
 * gets a member's set even when its holder is a founder; an unmarked admin may look through every key, as
 * `mayStillSee` lets them; a seated key shows; nobody signed out is answered. No database is needed: the
 * context is the shape `capabilityCtx` builds in server/index.ts.
 */
import { describe, expect, it } from "vitest";
import { ALL_CAPABILITIES, type CapabilityCtx } from "../../shared/capabilities";
import { asPlainMemberHeaders } from "../lib/readAsMember";
import { heldForReading, register } from "./myCapabilities";

const ctx = (over: Partial<CapabilityCtx> = {}): CapabilityCtx => ({
  stageIndex: 0,
  stageIndexOf: () => 0,
  roleCapabilities: [],
  badgeCapabilities: [],
  badgeVoteCapabilities: [],
  badgeDenies: [],
  stageUnlockOverrides: {},
  isAdmin: false,
  isFounder: false,
  villageHeld: [],
  alignedConfidentiality: false,
  ...over,
} as CapabilityCtx);

/** The admin-only keys: what an admin may look through and a plain member, with nothing seated, may not. */
const ADMIN_KEYS = ["cash.pay", "org.seat", "quest.consent", "intake.moderate", "role.pay"] as const;

function ask(user: Record<string, unknown> | null, c: CapabilityCtx, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  let get: ((req: any, res: any) => Promise<unknown>) | undefined;
  register({ get: (p: string, h: any) => { if (p === "/api/me/capabilities") get = h; } } as any, {
    authedUser: (async () => user) as any,
    capabilityCtx: (async () => c) as any,
  });
  return new Promise((resolve) => {
    const res: any = {
      statusCode: 200,
      set() { return this; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { resolve({ status: this.statusCode, body }); return this; },
    };
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    void get!({ headers: lower, get: (n: string) => lower[n.toLowerCase()] }, res);
  });
}

describe("GET /api/me/capabilities", () => {
  it("gives a plain member no admin key", async () => {
    const r = await ask({ id: "m1", role: "member" }, ctx());
    expect(r.status).toBe(200);
    for (const key of ADMIN_KEYS) expect(r.body.capabilities).not.toContain(key);
  });

  it("gives the live view a member's set, even when its holder is a founder", async () => {
    const founder = { id: "f1", role: "founder" };
    const asMember = await ask({ id: "m1", role: "member" }, ctx());
    const live = await ask(founder, ctx({ isAdmin: true, isFounder: true }), asPlainMemberHeaders());
    expect(live.body.capabilities).toEqual(asMember.body.capabilities);
    for (const key of ADMIN_KEYS) expect(live.body.capabilities).not.toContain(key);
  });

  it("lets an unmarked admin look through every key, as the list routes do", async () => {
    const r = await ask({ id: "a1", role: "admin" }, ctx({ isAdmin: true }));
    expect(r.body.capabilities).toEqual([...ALL_CAPABILITIES]);
  });

  it("shows a key the member's seat carries, and only their own keys", async () => {
    const r = await ask({ id: "m2", role: "member" }, ctx({ roleCapabilities: ["quest.consent"] }));
    expect(r.body.capabilities).toContain("quest.consent");
    expect(r.body.capabilities).not.toContain("cash.pay");
    expect(Object.keys(r.body)).toEqual(["capabilities"]);
  });

  it("answers nobody signed out", async () => {
    const r = await ask(null, ctx());
    expect(r.status).toBe(401);
  });

  it("is the read side of the gate: a plain member's set never includes what a seat alone would grant", () => {
    expect(heldForReading("member", ctx(), false)).toEqual(heldForReading("founder", ctx({ isAdmin: true, isFounder: true }), true));
  });
});
