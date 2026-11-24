import { describe, expect, it } from "vitest";
import { apiBehindEntrance, brochureKeysFor, cleanLink, cleanWhatsapp, ENTRANCE_APIS, ENTRANCE_PAGES, pageBehindEntrance, parseEntrance, safeNext } from "./entrance";

describe("what stands behind the entrance", () => {
  it("draws the entrance in front of the roles, the apply form and the game", () => {
    for (const p of ["/roles", "/roles/community-building-steward", "/roles/select", "/propose-a-role", "/propose-a-role?role=x", "/circles/anchor-circle", "/quests/q-1", "/game-mechanics", "/map", "/map/circles", "/powers", "/modules/forum"]) {
      expect(pageBehindEntrance(p), p).toBe(true);
    }
  });

  it("leaves the brochure, the doors and the applicant's own links open", () => {
    for (const p of ["/", "/investor", "/steward", "/resident", "/team", "/visit", "/love-letter", "/login", "/register", "/application-status/abc", "/propose-a-role-x", "/rolesplay", "/email/unsubscribe"]) {
      expect(pageBehindEntrance(p), p).toBe(false);
    }
  });

  it("refuses the reads that carry roles, pay and members' names", () => {
    for (const p of ["/api/org", "/api/org/role-card/x", "/api/org/founding-team", "/api/map", "/api/map/draft", "/api/open-proposals/form", "/api/quests", "/api/quests/q-1", "/api/game/mechanics/history", "/api/game/pulse", "/api/village/powers", "/api/modules/catalog", "/api/forum/threads"]) {
      expect(apiBehindEntrance(p), p).toBe(true);
    }
  });

  it("keeps open what every page or an outside reader needs", () => {
    for (const p of ["/api/game/config", "/api/org/vision", "/api/modules", "/api/settings", "/api/content/page-home", "/api/platform/info", "/api/platform/module-usage", "/api/public/org.json", "/api/entrance", "/api/open-proposals", "/api/open-proposals/confirm", "/api/governance/applications/ref/status", "/api/og/quest/q-1", "/api/organisation"]) {
      expect(apiBehindEntrance(p), p).toBe(false);
    }
  });

  it("holds the audit's judgment calls back until the lead answers", () => {
    for (const p of ["/governance", "/gratitude", "/network", "/events", "/seasonal-festivals"]) expect(pageBehindEntrance(p), p).toBe(false);
    for (const p of ["/api/events", "/api/events/calendar.ics", "/api/season", "/api/governance/voice-spread", "/api/game/gratitude/wall", "/api/network"]) expect(apiBehindEntrance(p), p).toBe(false);
  });

  it("answers a visitor the founding team's open roles and nothing else", () => {
    expect(brochureKeysFor("/api/org/founding-team")).toEqual(["on", "roleIds", "names"]);
    expect(brochureKeysFor("/api/org")).toBeNull();
  });

  it("lists every page and prefix once", () => {
    expect(new Set(ENTRANCE_PAGES).size).toBe(ENTRANCE_PAGES.length);
    expect(new Set(ENTRANCE_APIS).size).toBe(ENTRANCE_APIS.length);
    for (const p of [...ENTRANCE_PAGES, ...ENTRANCE_APIS]) expect(p.startsWith("/") && !p.endsWith("/"), p).toBe(true);
  });
});

describe("the form", () => {
  it("takes a name and an email and nothing else required, with updates unticked unless sent true", () => {
    const r = parseEntrance({ name: "  Ana   María ", email: " ana@example.org " });
    expect(r).toEqual({ ok: true, value: { name: "Ana María", email: "ana@example.org", whatsapp: null, link: null, updates: false } });
    expect(parseEntrance({ name: "Ana", email: "ana@example.org", updates: "yes" })).toMatchObject({ ok: true, value: { updates: false } });
    expect(parseEntrance({ name: "Ana", email: "ana@example.org", updates: true })).toMatchObject({ ok: true, value: { updates: true } });
  });

  it("names the first field that is wrong", () => {
    expect(parseEntrance({ email: "a@b.co" })).toEqual({ ok: false, problem: "name" });
    expect(parseEntrance({ name: "x".repeat(121), email: "a@b.co" })).toEqual({ ok: false, problem: "name" });
    expect(parseEntrance({ name: "Ana", email: "not an email" })).toEqual({ ok: false, problem: "email" });
    expect(parseEntrance({ name: "Ana", email: "a@b.co", whatsapp: "call me" })).toEqual({ ok: false, problem: "whatsapp" });
    expect(parseEntrance({ name: "Ana", email: "a@b.co", link: "javascript:alert(1)" })).toEqual({ ok: false, problem: "link" });
  });

  it("reads a WhatsApp number the way people type one", () => {
    expect(cleanWhatsapp("+506 8888-7777")).toBe("+506 8888-7777");
    expect(cleanWhatsapp("(555) 123.4567")).toBe("(555) 123.4567");
    expect(cleanWhatsapp("")).toBeNull();
    expect(cleanWhatsapp("12345")).toBe(false);
    expect(cleanWhatsapp("+1 234 567 890 123 456 7")).toBe(false);
  });

  it("reads a website or a social handle, and refuses a script", () => {
    expect(cleanLink("https://example.org/me")).toBe("https://example.org/me");
    expect(cleanLink("instagram.com/village")).toBe("instagram.com/village");
    expect(cleanLink("@village")).toBe("@village");
    expect(cleanLink("data:text/html,hi")).toBe(false);
    expect(cleanLink("two words")).toBe(false);
    expect(cleanLink(undefined)).toBeNull();
  });

  it("sends a visitor on within this site only", () => {
    expect(safeNext("/roles/x?seat=y#apply")).toBe("/roles/x?seat=y#apply");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("/a\nb")).toBeNull();
    expect(safeNext(7)).toBeNull();
  });
});
