import { describe, expect, it } from "vitest";
import { readWaitlistSignUp, roleAnchor, waitlistHash } from "./roleWaitlist";

const soon = (id: string) => id === "a" || id === "b";

describe("a waitlist sign-up", () => {
  it("keeps the address as its key, an optional number or wa.me link, and the coming-soon roles", () => {
    expect(readWaitlistSignUp({ email: " Ana@Example.org", roleIds: ["a", "a", "b"] }, soon)).toEqual({ ok: true, value: { emailKey: "ana@example.org", whatsapp: null, roleIds: ["a", "b"] } });
    expect(readWaitlistSignUp({ email: "a@b.co", whatsapp: "https://wa.me/50688888888", roleIds: ["a"] }, soon)).toMatchObject({ ok: true });
  });
  it("refuses a role that is not coming soon, no role, a bad address and a bad number", () => {
    expect(readWaitlistSignUp({ email: "a@b.co", roleIds: ["a", "z"] }, soon)).toMatchObject({ ok: false, field: "roleIds" });
    expect(readWaitlistSignUp({ email: "a@b.co", roleIds: [] }, soon)).toMatchObject({ ok: false, field: "roleIds" });
    expect(readWaitlistSignUp({ email: "nope", roleIds: ["a"] }, soon)).toMatchObject({ ok: false, field: "email" });
    expect(readWaitlistSignUp({ email: "a@b.co", whatsapp: "javascript:alert(1)", roleIds: ["a"] }, soon)).toMatchObject({ ok: false, field: "whatsapp" });
  });
  it("names the card's anchor and the hash that opens its form", () => {
    expect(roleAnchor("garden")).toBe("role-garden");
    expect(waitlistHash("garden")).toBe("waitlist-garden");
  });
});
