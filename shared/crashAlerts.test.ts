/**
 * WHO HEARS ABOUT A CRASH (shared/crashAlerts.ts): the dial, its grammar, and
 * the choice of recipients. Empty is every admin and founder; a list is the
 * admins and founders it names, plus the addresses with no account, which get
 * the email alone; a member who is neither never hears one; and a list that
 * names no usable address falls back to everyone, so the alarm still rings.
 */
import { describe, expect, it } from "vitest";
import {
  CRASH_ALERT_MAX_RECIPIENTS,
  CRASH_ALERT_RECIPIENTS_KEY,
  CRASH_ALERT_TYPE,
  crashAlertRecipients,
  crashAlertRecipientsProblem,
  parseCrashAlertRecipients,
} from "./crashAlerts";
import { VARIABLES_BY_KEY, ringOf, validateVariable, withheldFromPublic, membersOnlyOnPublic } from "./gameVariables";
import { NOTIFICATION_KINDS } from "./notificationKinds";
import { NOTIFICATION_KIND_WORDS } from "./notificationKindWords";
import { neverProposable } from "./approvalInbox";

const village = [
  { id: "f1", role: "founder", email: "Founder@Example.org" },
  { id: "a1", role: "admin", email: "ops@example.org" },
  { id: "a2", role: "admin", email: "jess@example.org" },
  { id: "m1", role: "member", email: "member@example.org" },
  { id: "m2", role: "steward", email: "steward@example.org" },
];
const ids = (rs: readonly { id: string }[]) => rs.map((r) => r.id);

describe("crashAlertRecipients", () => {
  it("an empty list tells every admin and founder, and nobody else", () => {
    for (const raw of ["", "   ", undefined, null]) {
      const out = crashAlertRecipients(village, raw);
      expect(ids(out.recipients), String(raw)).toEqual(["f1", "a1", "a2"]);
      expect(out.narrowed).toBe(false);
    }
  });

  it("a list tells only the admins and founders it names, whatever the case and spacing", () => {
    const out = crashAlertRecipients(village, " OPS@example.org ");
    expect(ids(out.recipients)).toEqual(["a1"]);
    expect(out.narrowed).toBe(true);
    expect(ids(crashAlertRecipients(village, "ops@example.org, founder@example.org").recipients)).toEqual(["f1", "a1"]);
  });

  it("never tells a member who is not an admin or founder, even when the list names them", () => {
    const out = crashAlertRecipients(village, "member@example.org, steward@example.org, ops@example.org");
    expect(ids(out.recipients)).toEqual(["a1"]);
    expect(ids(crashAlertRecipients(village, "").recipients)).not.toContain("m1");
  });

  it("an address with no account is an email-only recipient, and the panel is not told", () => {
    const out = crashAlertRecipients(village, "Ops@Inbox.example");
    expect(ids(out.recipients)).toEqual([]);
    expect(out.addresses).toEqual(["ops@inbox.example"]);
    expect(out.narrowed).toBe(true);
    expect(out.listMatchedNobody).toBe(false);
  });

  it("a mixed list tells the named accounts in the app and emails the plain addresses", () => {
    const out = crashAlertRecipients(village, "jess@example.org, inbox@ops.example, member@example.org, ops@example.org");
    expect(ids(out.recipients)).toEqual(["a1", "a2"]);
    expect(out.addresses).toEqual(["inbox@ops.example"]);
    expect(out.listMatchedNobody).toBe(false);
  });

  it("an account's address never becomes a plain address, whatever its case or role", () => {
    const out = crashAlertRecipients(village, "FOUNDER@example.org, member@example.org, steward@example.org");
    expect(ids(out.recipients)).toEqual(["f1"]);
    expect(out.addresses).toEqual([]);
  });

  it("falls back to every admin and founder when the list names no usable address, and says so", () => {
    for (const raw of ["member@example.org", "member@example.org, steward@example.org", "not-an-email, ;;, @x"]) {
      const out = crashAlertRecipients(village, raw);
      expect(ids(out.recipients), raw).toEqual(["f1", "a1", "a2"]);
      expect(out.addresses, raw).toEqual([]);
      expect(out.narrowed, raw).toBe(false);
    }
    expect(crashAlertRecipients(village, "member@example.org").listMatchedNobody).toBe(true);
    // Only junk parses to an empty list, which is blank: everyone, with nothing to log.
    expect(crashAlertRecipients(village, "not-an-email").listMatchedNobody).toBe(false);
  });
});

describe("parseCrashAlertRecipients", () => {
  it("lowercases, trims, drops junk and repeats", () => {
    expect(parseCrashAlertRecipients(" A@b.org, a@B.org ,, not-an-email, c@d.org")).toEqual(["a@b.org", "c@d.org"]);
  });
});

describe("the dial", () => {
  const def = VARIABLES_BY_KEY[CRASH_ALERT_RECIPIENTS_KEY];

  it("is registered under the shared key, blank by default", () => {
    expect(def).toBeTruthy();
    expect(def.key).toBe("ops.crash_alert_recipients");
    expect(def.type).toBe("text");
    expect(def.default).toBe("");
  });

  it("accepts blank and a list of addresses, and refuses anything else at the door", () => {
    expect(validateVariable(def, "")).toBeNull();
    expect(validateVariable(def, "ops@example.org")).toBeNull();
    expect(validateVariable(def, "ops@example.org, founder@example.org")).toBeNull();
    expect(validateVariable(def, "ops@example.org;founder@example.org")).toMatch(/separated by commas/);
    expect(validateVariable(def, "ops")).toMatch(/separated by commas/);
    expect(validateVariable(def, "ops@example.org,")).toMatch(/separated by commas/);
    expect(validateVariable(def, "ops@example.org, OPS@example.org")).toMatch(/only be listed once/);
    const many = Array.from({ length: CRASH_ALERT_MAX_RECIPIENTS + 1 }, (_, i) => `p${i}@x.io`).join(",");
    expect(crashAlertRecipientsProblem(many)).toMatch(/At most/);
  });

  it("says in its words that a plain address gets the email only", () => {
    expect(def.label).toBe("Addresses that hear about crashes");
    expect(def.description).toContain("An admin or founder's address also gets the notice in the app");
    expect(def.description).toContain("gets the email only");
    expect(def.description).toContain("Blank tells every admin and founder.");
    expect(def.description).not.toMatch(/[\u2013\u2014]/);
  });

  it("can be proposed: the ring is open and the approval inbox does not refuse its key or label", () => {
    expect(ringOf(def)).toBe("open");
    expect(neverProposable(CRASH_ALERT_RECIPIENTS_KEY)).toBeNull();
    expect(neverProposable(`${def.key} ${def.label}`)).toBeNull();
  });

  it("keeps the addresses off every public surface", () => {
    expect(withheldFromPublic({ withheld: def.withheld, value: "ops@example.org" })).toBe(true);
    expect(membersOnlyOnPublic(CRASH_ALERT_RECIPIENTS_KEY)).toBe(true);
  });
});

describe("the crash_alert kind", () => {
  it("is its own kind, registered with its words, apart from payment alerts", () => {
    expect(CRASH_ALERT_TYPE).toBe("crash_alert");
    expect(CRASH_ALERT_TYPE).not.toBe("payments_alert");
    expect(NOTIFICATION_KINDS[CRASH_ALERT_TYPE]).toMatchObject({ group: "village", celebrate: false });
    expect(NOTIFICATION_KIND_WORDS[CRASH_ALERT_TYPE]?.blurb).toBeTruthy();
  });
});
