import { describe, expect, it } from "vitest";
import type { WaitlistRow } from "./roleWaitlist";
import { lettersRecipients, oneRowPerAddress, readWaitlistLetter, REMOVE_PAGE_WORDS, UNSUBSCRIBE_LINES, waitlistByRole, waitlistLetterLogLine, WAITLIST_LETTER_LIMITS } from "./roleWaitlistLetters";

const row = (id: string, email: string, roles: string[], createdAt = "2026-11-01T00:00:00.000Z", consent = true): WaitlistRow => ({
  id,
  email,
  whatsapp: null,
  roles: roles.map((r) => ({ id: r, name: r.toUpperCase() })),
  member: false,
  consent,
  createdAt,
});

describe("the waitlist, grouped by role", () => {
  it("counts each role's distinct addresses, largest first, and puts a many-role sign-up in each group", () => {
    const groups = waitlistByRole([row("1", "a@x.org", ["g", "k"]), row("2", "b@x.org", ["g"]), row("3", "a@x.org", ["g"]), row("4", "c@x.org", ["k"])]);
    expect(groups.map((g) => [g.roleId, g.count])).toEqual([
      ["g", 2],
      ["k", 2],
    ]);
    // A repeat sign-up from one address is one person.
    expect(groups[0].rows).toHaveLength(3);
    expect(groups[0].count).toBe(2);
    expect(waitlistByRole([])).toEqual([]);
  });
  it("writes to one row per address, the newest", () => {
    const rows = oneRowPerAddress([row("1", "a@x.org", ["g"], "2026-11-01T00:00:00.000Z"), row("2", "a@x.org", ["g"], "2026-11-05T00:00:00.000Z"), row("3", "b@x.org", ["g"])]);
    expect(rows.map((r) => r.id).sort()).toEqual(["2", "3"]);
  });
});

describe("who a letter goes to", () => {
  it("is only the people whose newest sign-up ticked, once each; unticked and pre-tick rows are never in it", () => {
    const rows = [
      row("1", "yes@x.org", ["g"], "2026-11-01T00:00:00.000Z", true),
      row("2", "yes@x.org", ["g"], "2026-11-02T00:00:00.000Z", true),
      row("3", "no@x.org", ["g"], "2026-11-01T00:00:00.000Z", false),
      row("4", "old@x.org", ["g"], "2026-10-01T00:00:00.000Z", false),
      // Ticked once, then signed up again without the tick: the newest answer decides.
      row("5", "changed@x.org", ["g"], "2026-11-01T00:00:00.000Z", true),
      row("6", "changed@x.org", ["g"], "2026-11-09T00:00:00.000Z", false),
    ];
    expect(lettersRecipients(rows).map((r) => r.email)).toEqual(["yes@x.org"]);
    expect(lettersRecipients(rows.filter((r) => !r.consent))).toEqual([]);
    const g = waitlistByRole(rows)[0];
    expect([g.count, g.yes]).toEqual([4, 1]);
  });
});

describe("reading the request to send", () => {
  const ok = { roleId: "g", subject: " A subject ", body: "Hello\r\nthere", expectedCount: 3, confirm: true, lang: "es" };
  it("reads a complete request, with the person's own press as `confirm: true`", () => {
    expect(readWaitlistLetter(ok)).toEqual({ ok: true, value: { roleId: "g", subject: "A subject", body: "Hello\nthere", expectedCount: 3, lang: "es" } });
  });
  it("is refused without the press, whatever else is right (control: the request above)", () => {
    for (const confirm of [undefined, false, "true", 1, null]) {
      const r = readWaitlistLetter({ ...ok, confirm });
      expect(r.ok).toBe(false);
      expect((r as any).field).toBe("confirm");
    }
  });
  it("refuses a missing role, subject or body and one that is too long", () => {
    expect((readWaitlistLetter({ ...ok, roleId: "" }) as any).field).toBe("roleId");
    expect((readWaitlistLetter({ ...ok, subject: "  " }) as any).field).toBe("subject");
    expect((readWaitlistLetter({ ...ok, subject: "x".repeat(WAITLIST_LETTER_LIMITS.subject + 1) }) as any).field).toBe("subject");
    expect((readWaitlistLetter({ ...ok, body: "" }) as any).field).toBe("body");
    expect((readWaitlistLetter({ ...ok, body: "x".repeat(WAITLIST_LETTER_LIMITS.body + 1) }) as any).field).toBe("body");
    expect(readWaitlistLetter(null).ok).toBe(false);
  });
  it("takes Spanish only when asked for it", () => {
    expect((readWaitlistLetter({ ...ok, lang: "fr" }) as any).value.lang).toBe("en");
  });
});

describe("the words every letter ends with", () => {
  it("name the village, carry the link and are in both languages", () => {
    for (const lang of ["en", "es"] as const) {
      const line = UNSUBSCRIBE_LINES[lang]("Test Village", "https://v.example/email/a?t=abc");
      expect(line).toContain("Test Village");
      expect(line).toContain("https://v.example/email/a?t=abc");
    }
    expect(Object.keys(REMOVE_PAGE_WORDS.es)).toEqual(Object.keys(REMOVE_PAGE_WORDS.en));
  });
  it("the log line names the role and the counts and holds no address", () => {
    const line = waitlistLetterLogLine({ role: "Garden Steward", subject: "It is open", sent: 4, skipped: 1, failed: 0 });
    expect(line).toBe('Letter to the waitlist for Garden Steward: "It is open" (4 sent, 1 skipped)');
    expect(line).not.toContain("@");
  });
});
