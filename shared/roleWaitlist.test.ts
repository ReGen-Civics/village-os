import { describe, expect, it } from "vitest";
import { cleanWhatsapp, readWaitlistSignUp, roleAnchor, waitlistHash } from "./roleWaitlist";

const soon = (id: string) => id === "a" || id === "b";

describe("a waitlist sign-up", () => {
  it("keeps the address as its key, an optional number or wa.me link, and the coming-soon roles", () => {
    expect(readWaitlistSignUp({ email: " Ana@Example.org", roleIds: ["a", "a", "b"] }, soon)).toEqual({ ok: true, value: { emailKey: "ana@example.org", whatsapp: null, roleIds: ["a", "b"], consent: false } });
    // The tick is unticked by default and only a literal true ticks it.
    for (const consent of [undefined, false, "true", 1, "on", null]) expect((readWaitlistSignUp({ email: "a@b.co", roleIds: ["a"], consent }, soon) as any).value.consent, String(consent)).toBe(false);
    expect((readWaitlistSignUp({ email: "a@b.co", roleIds: ["a"], consent: true }, soon) as any).value.consent).toBe(true);
    expect(readWaitlistSignUp({ email: "a@b.co", whatsapp: "https://wa.me/50688888888", roleIds: ["a"] }, soon)).toMatchObject({ ok: true });
  });
  it("refuses a role that is not coming soon, no role, a bad address and a bad number", () => {
    expect(readWaitlistSignUp({ email: "a@b.co", roleIds: ["a", "z"] }, soon)).toMatchObject({ ok: false, field: "roleIds" });
    expect(readWaitlistSignUp({ email: "a@b.co", roleIds: [] }, soon)).toMatchObject({ ok: false, field: "roleIds" });
    expect(readWaitlistSignUp({ email: "nope", roleIds: ["a"] }, soon)).toMatchObject({ ok: false, field: "email" });
    expect(readWaitlistSignUp({ email: "a@b.co", whatsapp: "javascript:alert(1)", roleIds: ["a"] }, soon)).toMatchObject({ ok: false, field: "whatsapp" });
  });
  it("takes a number as a phone copies it: direction marks, a non-breaking hyphen, full-width digits, a wa.me link without https (applicant reviewer, 24 Nov 2026)", () => {
    // Each of these was refused with "Write the WhatsApp number with its country code" while it looked right on screen.
    const copied = ["\u202a+506 8888 8888\u202c", "+506\u00a08888\u20118888", "\u200e+1 (555) 123-4567", "\uff0b\uff15\uff10\uff16 8888 8888", "wa.me/50688888888", "www.wa.me/50688888888"];
    for (const wa of copied) expect(readWaitlistSignUp({ email: "a@b.co", whatsapp: wa, roleIds: ["a"] }, soon), JSON.stringify(wa)).toMatchObject({ ok: true });
    expect(cleanWhatsapp("\u202a+506 8888\u20118888\u202c")).toBe("+506 8888-8888");
    expect(cleanWhatsapp("wa.me/50688888888")).toBe("https://wa.me/50688888888");
    // Still refused: words, a script link, a number too short (control).
    for (const bad of ["call me", "javascript:alert(1)", "\u202a12\u202c"]) expect(readWaitlistSignUp({ email: "a@b.co", whatsapp: bad, roleIds: ["a"] }, soon), bad).toMatchObject({ ok: false, field: "whatsapp" });
  });
  it("names the card's anchor and the hash that opens its form", () => {
    expect(roleAnchor("garden")).toBe("role-garden");
    expect(waitlistHash("garden")).toBe("waitlist-garden");
  });
});
