import { describe, expect, it } from "vitest";
import { cardBookingOf } from "./cardBooking";
import { readCardBooking, roleCardView } from "./roleCardView";
import { readParameter } from "./roleParameters";

describe("how each conversation is booked on the public card", () => {
  it("reads a booking page, a wa.me link and the bare word whatsapp", () => {
    expect(cardBookingOf("https://cal.example.org/role")).toEqual({ kind: "link", url: "https://cal.example.org/role" });
    expect(cardBookingOf("https://wa.me/15550001111")?.kind).toBe("whatsapp");
    expect(cardBookingOf("WhatsApp")).toEqual({ kind: "note" });
    expect(cardBookingOf("http://insecure.example")).toBeNull();
    expect(cardBookingOf("javascript:alert(1)")).toBeNull();
    expect(cardBookingOf(null)).toBeNull();
  });

  it("the note never carries a number, and a bad answer reads as nothing", () => {
    expect(JSON.stringify(cardBookingOf("whatsapp"))).not.toMatch(/\d/);
    expect(readCardBooking({ kind: "link", url: "javascript:1" })).toBeNull();
    expect(readCardBooking({ kind: "link", url: "https://user:pw@evil.example/x" })).toBeNull();
    expect(readCardBooking({ kind: "note", url: "https://wa.me/1555" })).toEqual({ kind: "note" });
  });

  it("a role's booking setting may hold the word whatsapp", () => {
    expect(readParameter("bookingUrl", "whatsapp")).toEqual({ ok: true, value: "whatsapp" });
    expect(readParameter("bookingUrl", "ftp://x").ok).toBe(false);
  });

  it("the card's interviews row carries each step's booking beside its line", () => {
    const view = roleCardView({
      card: {
        firstConversation: "Steward",
        conversations: [
          { roleId: "a", minutes: 30, roleName: "Finance", booking: { kind: "link", url: "https://cal.example.org/f" } },
          { roleId: "b", minutes: 30, roleName: "Care", booking: { kind: "note" } },
        ],
      },
    });
    const row = view.rows.find((r) => r.id === "interviews")!;
    expect(row.bookings).toEqual([null, { kind: "link", url: "https://cal.example.org/f" }, { kind: "note" }, null]);
    expect(row.bookings!.length).toBe(row.lines.length);
  });

  it("the first review reads the village's words when it has them", () => {
    expect(roleCardView({ card: { reviewAfterDays: 30 } }).rows.find((r) => r.id === "review")!.lines).toEqual(["First review after 30 days"]);
    expect(roleCardView({ card: { reviewAfterDays: 30, firstReview: "at the first new moon celebration" } }).rows.find((r) => r.id === "review")!.lines).toEqual(["First review at the first new moon celebration"]);
  });
});
