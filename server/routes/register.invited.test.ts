/**
 * An adopted application's link was mailed to one address. An account made at
 * THAT address through it starts with the address proved and gets no "confirm
 * your address" letter (audit P9). An account made at any other address through
 * the same link proves nothing, so it is mailed the letter as before.
 *
 * Audit, 15 Nov 2026: a link the email did NOT carry was handed to the adopter
 * to pass on, so it proves nothing about any address. And when somebody made an
 * account at the address first without proving it, the invited person takes
 * that account over instead of being told the address already has one.
 *
 * No database: every dependency is handed to the route.
 */
import { describe, expect, it } from "vitest";
import { register } from "./register";
import { whenInviteDescribed } from "../lib/inviteDoor";

whenInviteDescribed("p9-", async () => ({ roles: ["Gate Keeper"], name: "Juno", email: "Juno@Example.test", mailed: true }));
// A link the email did not carry: the adopter was handed it.
whenInviteDescribed("p9h-", async () => ({ roles: ["Gate Keeper"], name: "Juno", email: "Juno@Example.test", mailed: false }));

function door(opts: { linkId?: string; existing?: any } = {}) {
  const added: any[] = [];
  const letters: string[] = [];
  const claims: string[] = [];
  const released: string[] = [];
  const welcomed: string[] = [];
  const reachEnded: string[] = [];
  const rows = new Map<string, any>();
  if (opts.existing) rows.set(opts.existing.email.toLowerCase(), { ...opts.existing });
  let handler: ((req: any, res: any) => Promise<unknown>) | null = null;
  register({ post: (_p: string, h: any) => void (handler = h) } as any, {
    overLimit: async () => false,
    clientIp: () => "127.0.0.1",
    members: {
      existsByEmail: async (e: string) => rows.has(e.toLowerCase()),
      add: async (m: any) => void added.push(m),
      byEmail: async (e: string) => rows.get(e.toLowerCase()) ?? null,
      update: async (_id: string, mutate: (m: any) => void) => {
        const row = Array.from(rows.values())[0];
        mutate(row);
        return row;
      },
    },
    endReachAround: async (id: string, change: () => Promise<any>) => {
      reachEnded.push(id);
      return change();
    },
    hashPassword: async (p: string) => `hashed:${p}`,
    makeHandle: async () => "juno",
    joined: async () => undefined,
    encodeToken: (u: string, _e: string, v?: number) => `token:${u}:${v ?? 0}`,
    publicUser: (m: any) => ({ id: m.id }),
    sendVerification: async (m: any) => void letters.push(m.email),
    invites: {
      required: () => true,
      resolve: async () => ({ ok: true, id: opts.linkId ?? "p9-link" }) as any,
      claim: async (_inv: string, userId: string) => {
        claims.push(userId);
        return "inviter-1";
      },
      release: async (_inv: string, userId: string) => void released.push(userId),
      welcome: async (_inviter: string, userId: string) => void welcomed.push(userId),
    },
  });
  return {
    added,
    letters,
    claims,
    released,
    welcomed,
    reachEnded,
    row: () => Array.from(rows.values())[0],
    async post(email: string) {
      const res: any = { code: 200, body: null, status: (c: number) => ((res.code = c), res), json: (b: any) => ((res.body = b), res) };
      await handler!({ body: { name: "Juno", email, password: "a long passphrase", paths: ["steward"], invite: "tok" }, headers: {} }, res);
      return res as { code: number; body: any };
    },
  };
}

describe("an invitation mailed to an address proves it (audit P9)", () => {
  it("the account made at that address starts proved and is sent no confirmation letter", async () => {
    const d = door();
    await d.post("juno@example.test");
    expect(d.added[0].emailVerifiedAt).toEqual(expect.any(String));
    expect(d.letters).toEqual([]);
  });

  it("CONTROL: the same link used with a different address proves nothing and sends the letter", async () => {
    const d = door();
    await d.post("somebody-else@example.test");
    expect(d.added[0].emailVerifiedAt).toBeNull();
    expect(d.letters).toEqual(["somebody-else@example.test"]);
  });

  it("a link the email did not carry, which the adopter was handed, proves nothing even at the same address (audit, 15 Nov 2026)", async () => {
    const d = door({ linkId: "p9h-link" });
    await d.post("juno@example.test");
    expect(d.added[0].emailVerifiedAt).toBeNull();
    expect(d.letters).toEqual(["juno@example.test"]);
  });
});

describe("the invited person takes over an account nobody proved at their address (audit, 15 Nov 2026)", () => {
  const planted = () => ({ id: "u-planted", email: "juno@example.test", passwordHash: "planted", emailVerifiedAt: null, tokenVersion: 2 });

  it("takes the row: the password replaced, the address proved, every old session ended, the link taken and its arrival run", async () => {
    const d = door({ existing: planted() });
    const r = await d.post("juno@example.test");
    expect(r.code).toBe(200);
    expect(r.body).toMatchObject({ success: true, tookOver: true, token: "token:u-planted:3", user: { id: "u-planted" } });
    expect(d.row()).toMatchObject({ passwordHash: "hashed:a long passphrase", tokenVersion: 3 });
    expect(d.row().emailVerifiedAt).toEqual(expect.any(String));
    expect(d.claims).toEqual(["u-planted"]);
    expect(d.welcomed).toEqual(["u-planted"]);
    expect(d.reachEnded).toEqual(["u-planted"]);
    expect(d.added).toEqual([]);
  });

  it("CONTROL: an account that proved the address is never taken: the answer is as before", async () => {
    const d = door({ existing: { ...planted(), emailVerifiedAt: "2026-01-01T00:00:00.000Z" } });
    const r = await d.post("juno@example.test");
    expect(r.code).toBe(409);
    expect(r.body.error).toBe("Email already exists");
    expect(d.row().passwordHash).toBe("planted");
    expect(d.claims).toEqual([]);
  });

  it("CONTROL: a link the adopter was handed takes nothing over", async () => {
    const d = door({ linkId: "p9h-link", existing: planted() });
    const r = await d.post("juno@example.test");
    expect(r.code).toBe(409);
    expect(d.row().passwordHash).toBe("planted");
    expect(d.claims).toEqual([]);
  });

  it("CONTROL: the mailed link opened with another address takes nothing over", async () => {
    const d = door({ existing: { ...planted(), email: "other@example.test" } });
    const r = await d.post("other@example.test");
    expect(r.code).toBe(409);
    expect(d.row().passwordHash).toBe("planted");
  });
});
