import { describe, expect, it } from "vitest";
import { KNOW_US_LINK_KEYS, knowUsLinksFrom, knowUsLinksOf, nextOfWay, STEWARD_PATH_FALLBACK, type KnowUsLinkKey } from "./knowUsLinks";

const NOW = new Date("2026-11-15T12:00:00Z");
const settings = (over: Partial<Record<KnowUsLinkKey, string>> = {}) => (key: KnowUsLinkKey) => over[key] ?? "";

describe("step 1's acts (Rye, 15 Nov 2026)", () => {
  it("links the next public call, tour and potluck from the calendar first, with its date and place", () => {
    const events = [
      { title: "Weekly Potluck", startsAt: "2026-11-20T23:00:00Z", locationText: "The Rancho", link: null },
      { title: "Weekly Potluck", startsAt: "2026-11-18T23:00:00Z", locationText: "The Rancho", link: null },
      { title: "Community Call & Webinar", startsAt: "2026-11-19T17:00:00Z", link: "https://meet.example.test/call" },
      { title: "Land Tour", startsAt: "2026-11-21T14:00:00Z", link: "/events" },
    ];
    const l = knowUsLinksFrom(settings({ [KNOW_US_LINK_KEYS.call]: "https://village.example.test/calls" }), events, NOW);
    expect(l.potluck.next).toMatchObject({ startsAt: "2026-11-18T23:00:00.000Z", place: "The Rancho", href: "/events" });
    expect(l.call).toMatchObject({ href: "https://meet.example.test/call", next: { title: "Community Call & Webinar" } });
    expect(l.tour.href).toBe("/events");
  });

  it("falls back to the village's own link when the calendar has none, and offers nothing with neither (never a dead link)", () => {
    const l = knowUsLinksFrom(settings({ [KNOW_US_LINK_KEYS.tour]: "https://book.example.test/tour", [KNOW_US_LINK_KEYS.recording]: "https://video.example.test/last" }), [], NOW);
    expect(l.tour).toEqual({ href: "https://book.example.test/tour", next: null });
    expect(l.recording).toBe("https://video.example.test/last");
    expect(l.call).toEqual({ href: null, next: null });
    expect(l.potluck).toEqual({ href: null, next: null });
  });

  it("ignores past and cancelled events and other titles (control)", () => {
    const events = [
      { title: "Potluck", startsAt: "2026-11-01T23:00:00Z" },
      { title: "Potluck", startsAt: "2026-11-30T23:00:00Z", status: "cancelled" },
      { title: "Full moon", startsAt: "2026-11-24T14:54:00Z" },
    ];
    expect(nextOfWay(events, "potluck", NOW)).toBeNull();
    expect(nextOfWay(events, "call", NOW)).toBeNull();
  });

  it("refuses a link that is not this site's page or an https address, and sends the new to /steward by default", () => {
    const l = knowUsLinksFrom(settings({ [KNOW_US_LINK_KEYS.recording]: "javascript:alert(1)", [KNOW_US_LINK_KEYS.potluck]: "//elsewhere.example" }), [], NOW);
    expect(l.recording).toBeNull();
    expect(l.potluck.href).toBeNull();
    expect(l.stewardPath).toBe(STEWARD_PATH_FALLBACK);
    expect(knowUsLinksFrom(settings({ [KNOW_US_LINK_KEYS.stewardPath]: "/paths/steward" }), [], NOW).stewardPath).toBe("/paths/steward");
  });

  it("reads the form's answer back safely: anything missing or unsafe is no act", () => {
    expect(knowUsLinksOf(undefined)).toEqual({ recording: null, call: { href: null, next: null }, tour: { href: null, next: null }, potluck: { href: null, next: null }, stewardPath: "/steward" });
    const back = knowUsLinksOf({ recording: "http://insecure.example", call: { href: "/events", next: { title: "Call", startsAt: "nope" } } });
    expect(back.recording).toBeNull();
    expect(back.call).toEqual({ href: "/events", next: null });
  });
});
