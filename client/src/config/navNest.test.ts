/**
 * THE MENU BY MEMBERSHIP (the lead, 27 Nov 2026): "never showing more than ~5 options while still being able to
 * nest all pages into the menu", "having join be first, and module library at the bottom". docs/MENU_MAP.md is the
 * map; this holds the menu to it for every audience, with every optional module ON, which is the most any reader
 * can be shown.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, NAV, isGroup, type NavGroup, type NavLink } from "./nav";
import { folderHolds, navRows } from "./navNest";

type Audience = { name: string; signedIn: boolean; role: string | null; newcomer: boolean; treasury: boolean };
const AUDIENCES: Audience[] = [
  { name: "a visitor", signedIn: false, role: null, newcomer: true, treasury: false },
  { name: "an applicant signed in, not admitted", signedIn: true, role: "member", newcomer: true, treasury: false },
  { name: "a member", signedIn: true, role: "member", newcomer: false, treasury: false },
  { name: "a role holder with a treasury power", signedIn: true, role: "member", newcomer: false, treasury: true },
  { name: "an admin", signedIn: true, role: "admin", newcomer: false, treasury: true },
  { name: "a founder", signedIn: true, role: "founder", newcomer: false, treasury: true },
];

/** Layout's visible(), with every module on, every story page served and every area in use. */
function visibleTo(a: Audience) {
  return (l: NavLink) =>
    (!a.newcomer || !l.newcomers) &&
    (!l.unlessModule) &&
    (!l.roles || (!!a.role && l.roles.includes(a.role))) &&
    (l.signedIn === undefined || l.signedIn === a.signedIn) &&
    (!l.door || (l.door === "treasury" && a.signedIn && a.treasury));
}

/** The bar this reader sees: groups with something in them, Join first for a newcomer. */
function barFor(a: Audience): { group: NavGroup; links: NavLink[] }[] {
  const ordered = a.newcomer ? [...NAV.filter((e) => isGroup(e) && e.leads === "newcomers"), ...NAV.filter((e) => !(isGroup(e) && e.leads === "newcomers"))] : NAV;
  return ordered.filter(isGroup).map((group) => ({ group, links: group.items.filter(visibleTo(a)) })).filter((g) => g.links.length > 0);
}

describe("the menu by membership", () => {
  it("is all groups: no page takes a slot of the bar on its own", () => {
    expect(NAV.every(isGroup)).toBe(true);
  });

  for (const a of AUDIENCES) {
    describe(a.name, () => {
      it("sees five groups at most, and five rows at most in each, and five links at most in each folder", () => {
        const bar = barFor(a);
        expect(bar.length).toBeLessThanOrEqual(5);
        for (const { group, links } of bar) {
          const rows = navRows(links);
          expect(rows.length, group.label).toBeLessThanOrEqual(5);
          for (const r of rows) if (r.kind === "folder") expect(r.links.length, `${group.label} / ${r.label}`).toBeLessThanOrEqual(5);
        }
        if (a.signedIn) {
          const rows = navRows(ACCOUNT_MENU.filter(visibleTo(a)));
          expect(rows.length, "the account menu").toBeLessThanOrEqual(5);
          for (const r of rows) if (r.kind === "folder") expect(r.links.length, `account / ${r.label}`).toBeLessThanOrEqual(5);
        }
      });

      it("finds the Module Library as the very last entry of the last group", () => {
        const bar = barFor(a);
        const last = bar[bar.length - 1]!;
        expect(last.group.label).toBe("Govern");
        expect(last.links.at(-1)?.href).toBe("/modules");
        // The last row is the last folder (How we work), and the library is its last link.
        const row = navRows(last.links).at(-1)!;
        expect(row.kind === "folder" ? row.links.at(-1)?.href : row.link.href).toBe("/modules");
      });

      it("meets each page once on the phone's More sheet, Quests and the roles excepted (QA, 27 Nov 2026)", () => {
        // The sheet draws the reader's account entries (tiles and the rest) and every group's links; nothing else
        // (MoreSheet.tsx; its own test renders it with every folder open).
        const sheet = [...(a.signedIn ? ACCOUNT_MENU.filter(visibleTo(a)) : []), ...barFor(a).flatMap((g) => g.links)].map((l) => l.href);
        const twice = Array.from(new Set(sheet.filter((h, i) => sheet.indexOf(h) !== i))).sort();
        for (const h of twice) expect(["/quests", "/roles"], h).toContain(h);
      });

      it(a.newcomer ? "meets Join first" : "meets the village first, and Join before Govern", () => {
        const labels = barFor(a).map((g) => g.group.label);
        if (a.newcomer) expect(labels[0]).toBe("Join");
        else expect(labels).toEqual(["Village", "Community", "Join", "Govern"]);
        if (a.newcomer) expect(labels).toEqual(["Join", "Village", "Community", "Govern"]);
      });
    });
  }
});

describe("how roles are going (the lead, 27 Nov 2026: admin for the whole village, leads for their circle)", () => {
  const offeredTo = (a: Audience) => barFor(a).flatMap((g) => g.links).map((l) => l.href);
  it("is a menu door for admins only; a lead reaches their circle's numbers from the circles pages", () => {
    for (const a of AUDIENCES) {
      expect(offeredTo(a).includes("/circles#role-measures"), a.name).toBe(a.role === "admin" || a.role === "founder");
    }
  });
});

describe("what a stranger is shown (the lead, round 2)", () => {
  // "we don't need to show a visitor the wallet, the health of the village, or the library", and "Signed out visitor
  // doesn't need to see game mechanics. Only a member needs to see that." The same for the other member tools.
  const visitor = AUDIENCES[0]!;
  const offered = () => [...barFor(visitor).flatMap((g) => g.links)].map((l) => l.href);

  it("offers no member tool to a visitor", () => {
    for (const h of ["/wallet", "/village-health", "/library", "/game-mechanics", "/tools", "/village-email", "/messages", "/hidden-map", "/circles#role-measures", "/governance/how#game-mechanics"]) {
      expect(offered(), h).not.toContain(h);
    }
  });

  it("offers a visitor what the village is, how to come and see, how to join, its story and team, and the Love Letter", () => {
    for (const h of ["/map", "/quests", "/housing", "/visit", "/roles", "/investor", "/team", "/love-letter", "/governance", "/powers", "/modules"]) {
      expect(offered(), h).toContain(h);
    }
  });

  it("puts the Love Letter in Community, and Housing, Stay and Good Neighbor in Village's Places and homes", () => {
    const at = (href: string) => NAV.filter(isGroup).flatMap((g) => g.items.filter((l) => l.href === href).map((l) => `${g.label}/${l.sub ?? ""}`));
    expect(at("/love-letter")).toEqual(["Community/Our story"]);
    expect(at("/housing")).toEqual(["Village/Places and homes"]);
    expect(at("/stay")).toEqual(["Village/Places and homes"]);
    // A chapter of Rights and agreements since fold 3 (#1857), its switch and its name still under /good-neighbor.
    expect(at("/rights#good-neighbor")).toEqual(["Village/Places and homes"]);
    expect(NAV.filter(isGroup).flatMap((g) => g.items).find((l) => l.href === "/rights#good-neighbor")?.story).toBe("/good-neighbor");
    // Guides holds Rights and agreements and a row for its Leaving Well chapter; the old addresses have no entry.
    expect(at("/rights")).toEqual(["Govern/Guides"]);
    expect(at("/rights#leaving-well")).toEqual(["Govern/Guides"]);
    // The lead's rule names Game Mechanics in Govern: a row of its own in How we work, a member's (round 4).
    expect(at("/governance/how#game-mechanics")).toEqual(["Govern/How we work"]);
    for (const old of ["/good-neighbor", "/resident-rights", "/steward-rights", "/exit-policy", "/photographs", "/changes", "/game-mechanics"]) expect(at(old), old).toEqual([]);
    expect(at("/library")).toEqual(["Village/"]);
    expect(at("/village-health")).toEqual(["Village/"]);
    expect(at("/quests").sort()).toEqual(["Govern/This season", "Village/"]);
    // No catch-all folder, and the Wallet is the member's own (the account menu).
    expect(NAV.filter(isGroup).flatMap((g) => g.items).some((l) => l.sub === "Shared things")).toBe(false);
    expect(ACCOUNT_MENU.find((l) => l.href === "/wallet")?.sub).toBe("Your things");
  });
});

describe("the folders", () => {
  it("draw links that share a folder as one row, in the place of the first of them", () => {
    const rows = navRows([
      { href: "/a", label: "A" },
      { href: "/b", label: "B", sub: "F" },
      { href: "/c", label: "C" },
      { href: "/d", label: "D", sub: "F" },
    ]);
    expect(rows.map((r) => (r.kind === "link" ? r.link.href : `${r.label}:${r.links.map((l) => l.href).join(",")}`))).toEqual(["/a", "F:/b,/d", "/c"]);
  });

  it("draw a folder left with one link as that link, so nobody opens a folder to find one page", () => {
    expect(navRows([{ href: "/b", label: "B", sub: "F" }])).toEqual([{ kind: "link", link: { href: "/b", label: "B", sub: "F" } }]);
  });

  it("open with the menu when the page being read is inside", () => {
    const [row] = navRows([{ href: "/b", label: "B", sub: "F" }, { href: "/d", label: "D", sub: "F" }]);
    expect(folderHolds(row!, "/d")).toBe(true);
    expect(folderHolds(row!, "/x")).toBe(false);
  });
});

describe("every entry has a page, and Your First Walk is gone", () => {
  const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
  const routes = new Set(Array.from(app.matchAll(/<Route\s+path="([^"]+)"/g), (m) => m[1]));
  /**
   * None pending: Rights and agreements (#1857) and the season (#1862) came with the 1.3.98 batch, merged in here, and
   * the Treasury tab (#1843) with 1.3.94.
   */
  const PENDING = new Set<string>();

  it("points every menu entry at a route the app has", () => {
    const hrefs = [...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].map((l) => l.href.split("#")[0]!);
    const missing = hrefs.filter((h) => !routes.has(h) && !PENDING.has(h) && !h.startsWith("/profile"));
    expect(missing).toEqual([]);
  });

  it("offers /first-walk nowhere, and sends an old link home", () => {
    const hrefs = [...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].map((l) => l.href);
    expect(hrefs).not.toContain("/first-walk");
    expect(app).toMatch(/<Route path="\/first-walk">\{\(\) => <Redirect to="\/" replace \/>\}<\/Route>/);
  });

  /**
   * The named exceptions (the lead, round 2): Quests is something you do in the village and the work the season is
   * made of ("Quests could be in both village and in governance"), and the roles are both the way in (Join, Open
   * Roles) and how the village is organised (Govern, Circles & Roles).
   */
  const IN_TWO_PLACES = ["/quests", "/roles"];

  it("lists each page once, so nobody meets the same page in two places, but for the named exceptions", () => {
    const hrefs = [...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].map((l) => l.href);
    const twice = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
    expect(twice.sort()).toEqual([...IN_TWO_PLACES].sort());
    // Each exception sits in two different groups, never twice in one.
    for (const h of IN_TWO_PLACES) {
      const groups = NAV.filter(isGroup).filter((g) => g.items.some((l) => l.href === h)).map((g) => g.label);
      expect(new Set(groups).size, h).toBe(2);
    }
  });
});
