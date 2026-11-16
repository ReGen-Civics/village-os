import { describe, expect, it, vi } from "vitest";
import { claimOpen, register, sendRecoveryLetter } from "./authRecovery";

describe("whether a village can still be claimed", () => {
  it("is open while nobody holds the founder or admin role", () => {
    expect(claimOpen([])).toBe(true);
    expect(claimOpen([{ role: "member" }, { role: undefined }, {}])).toBe(true);
  });

  it("closes the moment a founder or an admin exists, the bootstrap route's own test", () => {
    expect(claimOpen([{ role: "member" }, { role: "founder" }])).toBe(false);
    expect(claimOpen([{ role: "admin" }])).toBe(false);
  });
});

/*
 * R110: the answer must not wait on the email provider, or a real account's
 * answer is slower than an unknown address's by one send.
 */
describe("forgot-password answers without waiting on the send", () => {
  async function drive(user: any, sendEmail: (o: any) => Promise<{ sent: boolean; reason?: string }>) {
    const handlers = new Map<string, (req: any, res: any) => Promise<void>>();
    const app = {
      get: (path: string, h: any) => handlers.set(`GET ${path}`, h),
      post: (path: string, h: any) => handlers.set(`POST ${path}`, h),
    } as any;
    const audits: string[] = [];
    register(app, {
      authSecret: "x".repeat(64),
      members: { byEmail: async () => user, all: async () => [] },
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
      resetPerIpHourly: () => 10,
      sendEmail,
      escapeHtml: (s) => s,
      origin: () => "https://village.example.test",
      projectName: () => "Riverbend",
      recordAudit: (text) => audits.push(text),
    });
    let answered: unknown = null;
    const res = { status: () => res, json: (b: unknown) => { answered = b; return res; } };
    await handlers.get("POST /api/auth/forgot-password")!({ body: { email: "someone@example.test" } }, res);
    return { answered, audits };
  }

  it("a real account gets its answer while the send is still pending, and the same answer as no account", async () => {
    let sendStarted = false;
    const never = new Promise<{ sent: boolean }>(() => {});
    const real = await drive({ id: "u-1", email: "someone@example.test", passwordHash: "$2b$10$x", tokenVersion: 0 }, () => {
      sendStarted = true;
      return never;
    });
    const nobody = await drive(null, () => never);
    expect(sendStarted, "the send was started").toBe(true);
    expect(real.answered).toEqual(nobody.answered);
    expect(real.audits).toEqual(["auth:password-reset-requested"]);
  });

  it("a send that fails in the background is logged, and never throws", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await sendRecoveryLetter({ sendEmail: async () => { throw new Error("provider down"); } }, { id: "u-2", email: "a@example.test" }, "reset", { origin: "auth.reset", subject: "s", html: "h" });
      await sendRecoveryLetter({ sendEmail: async () => ({ sent: false, reason: "no_api_key" }) }, { id: "u-3", email: "b@example.test" }, "claim", { origin: "auth.first_password", subject: "s", html: "h" });
      const said = err.mock.calls.map((c) => String(c[0])).join("\n");
      expect(said).toContain("recovery email FAILED for u-2");
      expect(said).toContain("NOT SENT for u-3 (claim): reason=no_api_key");
    } finally {
      err.mockRestore();
    }
  });
});
