import { describe, expect, it } from "vitest";
import { codeMatches, domainTakesMail, hashCode, makeCode, sendCodeLetter } from "./entranceCode";

const SECRET = "secret-for-the-code-tests-only-0123456789"; // module-review-ok: a test fixture key for the HMAC, never a real credential

describe("the entrance's code", () => {
  it("is six digits, kept only as a hash bound to its entry", () => {
    for (let i = 0; i < 50; i++) expect(makeCode()).toMatch(/^[0-9]{6}$/);
    const h = hashCode(SECRET, "pe-a", "123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
    expect(codeMatches(SECRET, "pe-a", "123456", h)).toBe(true);
    expect(codeMatches(SECRET, "pe-b", "123456", h)).toBe(false);
    expect(codeMatches(SECRET, "pe-a", "123457", h)).toBe(false);
    expect(codeMatches("another-secret-entirely-0123456789", "pe-a", "123456", h)).toBe(false);
  });

  it("asks DNS whether a domain takes mail, and lets a DNS hiccup through", async () => {
    const fail = (code: string) => async () => {
      throw Object.assign(new Error(code), { code });
    };
    expect(await domainTakesMail("ok.example", { resolveMx: async () => [{}], resolve4: fail("ENOTFOUND") })).toBe("yes");
    expect(await domainTakesMail("a-only.example", { resolveMx: fail("ENODATA"), resolve4: async () => ["192.0.2.1"] })).toBe("yes");
    expect(await domainTakesMail("gone.example", { resolveMx: fail("ENOTFOUND"), resolve4: fail("ENOTFOUND") })).toBe("no");
    expect(await domainTakesMail("slow.example", { resolveMx: () => new Promise(() => undefined), resolve4: fail("ENOTFOUND") }, 20)).toBe("unknown");
    expect(await domainTakesMail("broken.example", { resolveMx: fail("ESERVFAIL"), resolve4: fail("ESERVFAIL") })).toBe("unknown");
    expect(await domainTakesMail("nodot", { resolveMx: async () => [{}], resolve4: async () => [] })).toBe("no");
  });

  it("writes the code into its letter, and says sign in when the address has an account", async () => {
    const sent: { subject: string; html: string; text?: string; origin?: string }[] = [];
    const deps = { sendEmail: async (o: { subject: string; html: string; text?: string; origin?: string }) => (sent.push(o), { sent: true }), escapeHtml: (s: string) => s, projectName: () => "Test Village" };
    await sendCodeLetter(deps, "a@example.org", "123456", false);
    await sendCodeLetter(deps, "a@example.org", "654321", true);
    expect(sent[0].subject).toBe("123 456 is your code for Test Village");
    expect(sent[0].origin).toBe("entrance.code");
    expect(sent[0].html).toContain("keep exploring");
    expect(sent[1].html).toContain("sign in");
    expect(await sendCodeLetter({ ...deps, sendEmail: async () => { throw new Error("down"); } }, "a@example.org", "1", false)).toEqual({ sent: false, reason: "failed" });
  });
});
