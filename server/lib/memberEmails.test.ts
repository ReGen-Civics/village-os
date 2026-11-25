import { describe, expect, it } from "vitest";
import { EMAIL_CODE_TRIES, EMAIL_CODE_TTL_MS, MAX_EXTRA_ADDRESSES } from "../../shared/memberEmails";
import { ADDRESS_REFUSAL, addressCodeLetter, addressRefusal, checkAddressCode, makeAddressCode, pendingFor, readPending } from "./memberEmails";

const SECRET = "k".repeat(64);
const proved = { id: "u-1", email: "me@home.test", emailVerifiedAt: "2026-11-01T00:00:00.000Z" };

describe("the code mailed to a new address", () => {
  it("is six digits, and the digest kept in its place never contains it", () => {
    for (let i = 0; i < 50; i++) expect(makeAddressCode()).toMatch(/^\d{6}$/);
    const p = pendingFor(SECRET, "u-1", "Ops@Village.test", "123456", 1000);
    expect(p.email).toBe("ops@village.test");
    expect(JSON.stringify(p)).not.toContain("123456");
    expect(p.expiresAt).toBe(1000 + EMAIL_CODE_TTL_MS);
  });

  it("proves only this account and this address, before it expires and while tries are left", () => {
    const p = pendingFor(SECRET, "u-1", "ops@village.test", "123456", 1000);
    expect(checkAddressCode(SECRET, "u-1", p, "123456", 2000)).toBe("ok");
    expect(checkAddressCode(SECRET, "u-1", p, " 123 456 ", 2000)).toBe("ok");
    expect(checkAddressCode(SECRET, "u-2", p, "123456", 2000)).toBe("wrong");
    expect(checkAddressCode("other".repeat(13), "u-1", p, "123456", 2000)).toBe("wrong");
    expect(checkAddressCode(SECRET, "u-1", p, "654321", 2000)).toBe("wrong");
    expect(checkAddressCode(SECRET, "u-1", p, "12345", 2000)).toBe("wrong");
    expect(checkAddressCode(SECRET, "u-1", p, "123456", 1000 + EMAIL_CODE_TTL_MS + 1)).toBe("expired");
    expect(checkAddressCode(SECRET, "u-1", { ...p, tries: EMAIL_CODE_TRIES }, "123456", 2000)).toBe("spent");
    expect(checkAddressCode(SECRET, "u-1", null, "123456", 2000)).toBe("none");
  });

  it("reads a pending code off the member's prefs, and nothing malformed", () => {
    const p = pendingFor(SECRET, "u-1", "ops@village.test", "123456");
    expect(readPending({ prefs: { pendingEmail: p } })).toEqual(p);
    expect(readPending({ prefs: { pendingEmail: { email: "x" } } })).toBeNull();
    expect(readPending({})).toBeNull();
  });

  it("the letter carries the code and says what happens if it was not you", () => {
    const l = addressCodeLetter((s) => s, "Riverbend", "042817");
    expect(l.subject).toContain("042817");
    expect(l.text).toContain("Your code: 042817");
    expect(l.html).toContain("If it was not you, do nothing");
  });
});

describe("what may be attached", () => {
  const base = { address: "ops@village.test", account: proved, extras: [], ownerElsewhere: null };

  it("an address nobody holds, on a proved account with room, may be sent a code", () => {
    expect(addressRefusal(base)).toBeNull();
  });

  it("an unproved account is refused before anything about another account is read", () => {
    const unproved = { ...proved, emailVerifiedAt: null };
    expect(addressRefusal({ ...base, account: unproved, ownerElsewhere: "u-9" })).toBe(ADDRESS_REFUSAL.mainUnproved);
  });

  it("refuses another account's address, its own addresses, malformed ones and a full account", () => {
    expect(addressRefusal({ ...base, ownerElsewhere: "u-9" })).toBe(ADDRESS_REFUSAL.takenElsewhere);
    expect(addressRefusal({ ...base, ownerElsewhere: "u-1" })).toBe(ADDRESS_REFUSAL.alreadyYours);
    expect(addressRefusal({ ...base, extras: [{ email: "ops@village.test" }] })).toBe(ADDRESS_REFUSAL.alreadyYours);
    expect(addressRefusal({ ...base, address: "ME@home.test" })).toBe(ADDRESS_REFUSAL.alreadyMain);
    expect(addressRefusal({ ...base, address: "no at sign" })).toBe(ADDRESS_REFUSAL.invalid);
    expect(addressRefusal({ ...base, address: "a@b.test, c@d.test" })).toBe(ADDRESS_REFUSAL.invalid);
    const full = Array.from({ length: MAX_EXTRA_ADDRESSES }, (_, i) => ({ email: `x${i}@x.test` }));
    expect(addressRefusal({ ...base, extras: full })).toBe(ADDRESS_REFUSAL.full);
  });
});
