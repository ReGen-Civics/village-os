import { describe, expect, it } from "vitest";
import { apiBehindEntrance, brochureKeysFor, cleanCode, cleanLink, lookOver, cleanWhatsapp, isUpdatesAnswer, OPEN_APIS, OPEN_PAGES, pageBehindEntrance, parseEntrance, roleSlugOf, safeNext } from "./entrance";

describe("what stands behind the entrance (an allow-list)", () => {
  it("draws the entrance in front of every page but the doors, the legal pages and the applicant's own links", () => {
    for (const p of ["/", "/roles", "/roles/community-building-steward", "/roles/select", "/propose-a-role", "/propose-a-role?role=x", "/circles/anchor-circle", "/quests/q-1", "/game-mechanics", "/map", "/map/circles", "/powers", "/modules/forum", "/investor", "/steward", "/team", "/visit", "/governance", "/events", "/a-page-added-tomorrow", "/loginx", "/privacyx"]) {
      expect(pageBehindEntrance(p), p).toBe(true);
    }
  });

  it("leaves open signing in, its email links, an applicant's status, the legal pages", () => {
    for (const p of ["/login", "/login?next=%2Froles", "/register", "/forgot-password", "/set-password", "/verify-email", "/email/unsubscribe", "/oauth/authorize", "/claim", "/application-status/abc", "/propose-a-role/confirm", "/privacy", "/terms", "/404"]) {
      expect(pageBehindEntrance(p), p).toBe(false);
    }
  });

  it("refuses every read a page behind it makes, including ones nobody listed", () => {
    for (const p of ["/api/org", "/api/org/vision", "/api/org/role-card/x", "/api/map", "/api/map/draft", "/api/open-proposals", "/api/open-proposals/form", "/api/quests", "/api/game/mechanics", "/api/game/pulse", "/api/village/powers", "/api/modules/catalog", "/api/forum/threads", "/api/events", "/api/content/page-home", "/api/network", "/api/something-new", "/api/game/configx"]) {
      expect(apiBehindEntrance(p), p).toBe(true);
    }
  });

  it("keeps open what every page, signing in, an outside reader and the entrance itself need", () => {
    for (const p of ["/api/entrance", "/api/game/config", "/api/modules", "/api/settings", "/api/platform/info", "/api/i18n/es", "/api/brand", "/api/auth/me", "/api/invites/check", "/api/public/org.json", "/api/og/quest/q-1", "/api/comms/preferences", "/api/application-status/x", "/api/governance/applications/ref/status", "/api/open-proposals/confirm"]) {
      expect(apiBehindEntrance(p), p).toBe(false);
    }
    expect(apiBehindEntrance("/not-api")).toBe(false);
  });

  it("keeps open a gathering's join link and a member's own calendar feed, which carry no cookie", () => {
    expect(apiBehindEntrance("/api/events/ev-1/join")).toBe(false);
    expect(apiBehindEntrance("/api/events/calendar.ics", { token: "abc" })).toBe(false);
    expect(apiBehindEntrance("/api/events/calendar.ics", { token: "" })).toBe(true);
    expect(apiBehindEntrance("/api/events/ev-1/join/more")).toBe(true);
  });

  it("answers a visitor the founding team's open roles and nothing else", () => {
    expect(apiBehindEntrance("/api/org/founding-team")).toBe(true);
    expect(brochureKeysFor("/api/org/founding-team")).toEqual(["on", "roleIds", "names"]);
    expect(brochureKeysFor("/api/org")).toBeNull();
  });

  it("lists every page and prefix once, each a clean path", () => {
    expect(new Set(OPEN_PAGES).size).toBe(OPEN_PAGES.length);
    expect(new Set(OPEN_APIS).size).toBe(OPEN_APIS.length);
    for (const p of [...OPEN_PAGES, ...OPEN_APIS]) expect(p.startsWith("/") && !p.endsWith("/"), p).toBe(true);
  });
});

describe("the keep-in-touch step and the pages opened", () => {
  it("takes yes or no and nothing else", () => {
    expect(isUpdatesAnswer("yes")).toBe(true);
    expect(isUpdatesAnswer("no")).toBe(true);
    for (const v of [true, "Yes", "", null, undefined, 1]) expect(isUpdatesAnswer(v), String(v)).toBe(false);
  });

  it("names the role a page shows, and only a role's own page", () => {
    expect(roleSlugOf("/roles/community-steward")).toBe("community-steward");
    expect(roleSlugOf("/roles/community-steward?seat=x")).toBe("community-steward");
    expect(roleSlugOf("/roles")).toBeNull();
    expect(roleSlugOf("/roles/select")).toBeNull();
    expect(roleSlugOf("/roles/x/apply")).toBeNull();
  });
});

describe("the form", () => {
  it("takes a name and an email and nothing else required; the keep-in-touch answer is never part of it", () => {
    const r = parseEntrance({ name: "  Ana   María ", email: " ana@example.org " });
    expect(r).toEqual({ ok: true, value: { name: "Ana María", email: "ana@example.org", whatsapp: null, link: null, interest: null } });
    expect(parseEntrance({ name: "Ana", email: "ana@example.org", interest: "seeder" })).toMatchObject({ ok: true, value: { interest: "seeder" } });
    expect(parseEntrance({ name: "Ana", email: "ana@example.org", interest: "investor" })).toMatchObject({ ok: true, value: { interest: null } });
    const sneaked = parseEntrance({ name: "Ana", email: "ana@example.org", updates: "yes" });
    expect(sneaked.ok && "updates" in sneaked.value).toBe(false);
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

  it("sends a visitor on within this site only: /roles lands on /roles", () => {
    expect(safeNext("/roles")).toBe("/roles");
    expect(safeNext("/roles/x?seat=y#apply")).toBe("/roles/x?seat=y#apply");
    expect(safeNext("")).toBeNull();
    expect(safeNext("roles")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("/a\nb")).toBeNull();
    expect(safeNext(7)).toBeNull();
  });
});

describe("a short look, then the code", () => {
  it("reads six digits the way people type them", () => {
    expect(cleanCode("123456")).toBe("123456");
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode("123-456")).toBe("123456");
    for (const v of ["12345", "1234567", "12a456", 123456, null]) expect(cleanCode(v), String(v)).toBeNull();
  });

  it("ends the look at whichever comes first, the minutes or the pages, and never without a code to ask", () => {
    const look = { needsCode: true, startedAt: 1_000_000, lookMs: 3 * 60 * 1000, lookPages: 3 };
    expect(lookOver(look, 0, 1_000_000)).toBe(false);
    expect(lookOver(look, 2, 1_000_000 + 60_000)).toBe(false);
    expect(lookOver(look, 3, 1_000_000 + 60_000)).toBe(true);
    expect(lookOver(look, 0, 1_000_000 + 3 * 60 * 1000)).toBe(true);
    expect(lookOver({ ...look, needsCode: false }, 99, 9e12)).toBe(false);
  });
});
