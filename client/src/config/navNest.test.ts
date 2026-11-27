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
        expect(last.group.label).toBe("About");
        expect(last.links.at(-1)?.href).toBe("/modules");
        expect(navRows(last.links).at(-1)).toMatchObject({ kind: "link", link: { href: "/modules" } });
      });

      it(a.newcomer ? "meets Join first" : "meets the village first, and Join after Governance", () => {
        const labels = barFor(a).map((g) => g.group.label);
        if (a.newcomer) expect(labels[0]).toBe("Join");
        else expect(labels).toEqual(["Village", "Community", "Governance", "Join", "About"]);
      });
    });
  }
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
  /** The Treasury tab is #1843's (the fold lane), stacked on the Governance lane's PRs; /budget redirects there until it lands. */
  const PENDING = new Set(["/governance/treasury"]);

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

  it("lists each page once, so nobody meets the same page in two places", () => {
    const hrefs = [...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].map((l) => l.href);
    expect(hrefs.filter((h, i) => hrefs.indexOf(h) !== i)).toEqual([]);
  });
});
