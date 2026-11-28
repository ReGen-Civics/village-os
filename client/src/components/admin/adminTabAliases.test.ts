// @vitest-environment jsdom
/**
 * EVERY OLD ADMIN ADDRESS STILL LANDS ON ITS CONTROL.
 *
 * One case per alias (the cuts of 27 Nov 2026 and the two broken links fixed
 * with them), then the rules that keep the table honest: an alias opens a tab
 * the menu really has, never a second alias, and every `/admin?tab=` link the
 * product ships names a tab or an alias. The last rule is the one that would
 * have caught `?tab=org`: a notice link to a tab that never existed.
 */
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CONTROL_ENTRIES, VISIT_PROGRAM_SETTING, adminSearchHref } from "@shared/adminSearch";
import { ACCESS_TASKS_LINK } from "../../../../server/lib/roleAccess";
import { ADMIN_TABS, tabFromSearch } from "./adminAreas";
import { navGroups } from "./adminNavGroups";
import { LEFT_ADMIN, MOVED_TABS, leftAdminTarget, settleTabAddress, settledSearch, tabLanding } from "./adminTabAliases";

const ROOT = path.resolve(__dirname, "../../../..");
const NAV_KEYS = new Set([...navGroups(false), ...navGroups(true)].flatMap((g) => g.items.map((i) => i.key)));

/** What an address opens: the Admin tab and the settled query, or the page outside Admin. */
function landing(address: string): { tab?: string; search?: string; outside?: string } {
  const search = address.slice(address.indexOf("?"));
  const tab = tabFromSearch(search);
  const outside = leftAdminTarget(tab);
  return outside ? { outside } : { tab, search: settledSearch(search) ?? search };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/admin");
});

describe("an old admin address lands on its control", () => {
  it("email-settings opens Mail settings, the one page it always was", () => {
    expect(landing("/admin?tab=email-settings")).toEqual({ tab: "comms-settings", search: "?tab=comms-settings" });
    // The deep link the launch page and the sign-in round trip carry keeps the rest of its address.
    expect(landing("/admin?tab=email-settings&from=launch").search).toBe("?tab=comms-settings&from=launch");
  });

  it("forum-moderation opens the one Reports queue (the forum's notices still name this key)", () => {
    expect(landing("/admin?tab=forum-moderation")).toEqual({ tab: "reports", search: "?tab=reports" });
  });

  it("message-reports opens the one Reports queue (the message notices still name this key)", () => {
    expect(landing("/admin?tab=message-reports")).toEqual({ tab: "reports", search: "?tab=reports" });
  });

  it("visit-config opens Pages on the visit program editor", () => {
    expect(landing("/admin?tab=visit-config")).toEqual({ tab: "pages", search: `?tab=pages&setting=${VISIT_PROGRAM_SETTING}` });
    // The same address Admin search lands on, so the two cannot drift.
    const control = CONTROL_ENTRIES.find((e) => e.id === VISIT_PROGRAM_SETTING)!;
    expect(adminSearchHref(control)).toBe(`/admin${landing("/admin?tab=visit-config").search}`);
  });

  it("org opens the org chart: a role-access notice already sent still lands", () => {
    expect(landing("/admin?tab=org")).toEqual({ tab: "org-chart", search: "?tab=org-chart" });
  });

  it("quest-claims lands on finished work in the review list", () => {
    expect(landing("/admin?tab=quest-claims")).toEqual({ outside: "/admin/review?kind=claim" });
  });

  it("pricing-desk lands on the Treasury's pricing desk", () => {
    expect(landing("/admin?tab=pricing-desk")).toEqual({ outside: "/governance/treasury#prices" });
  });

  it("budgets lands on the Treasury's cash budget", () => {
    expect(landing("/admin?tab=budgets")).toEqual({ outside: "/governance/treasury#cash-budget" });
  });

  it("a button that still names a folded tab opens where its control lives", () => {
    // The Setup Wizard's content step still says `visit-config` (setupProgress.ts).
    expect(tabLanding("visit-config")).toEqual({ tab: "pages", params: { setting: VISIT_PROGRAM_SETTING } });
    expect(tabLanding("players")).toEqual({ tab: "players" });
  });
});

describe("the address itself is settled, so a copied link is the new one", () => {
  it("rewrites an old tab address in place and keeps the hash", () => {
    window.history.replaceState({}, "", "/admin?tab=forum-moderation&from=bell#top");
    expect(settleTabAddress()).toBe("?tab=reports&from=bell");
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/admin?tab=reports&from=bell#top");
  });

  it("leaves a current address, and a bare /admin, exactly as they were", () => {
    for (const address of ["/admin?tab=players&circle=c1", "/admin", "/admin?tab=quest-claims"]) {
      window.history.replaceState({}, "", address);
      settleTabAddress();
      expect(window.location.pathname + window.location.search).toBe(address);
    }
    expect(settledSearch("?tab=players")).toBeNull();
    expect(settledSearch("")).toBeNull();
  });
});

describe("the alias table stays honest", () => {
  it("every moved tab opens a tab the menu has and Home lists", () => {
    const listed = new Set(ADMIN_TABS.map((t) => t.key));
    for (const [old, moved] of Object.entries(MOVED_TABS)) {
      expect(NAV_KEYS.has(moved.tab), `${old} -> ${moved.tab} is in the menu`).toBe(true);
      expect(listed.has(moved.tab), `${old} -> ${moved.tab} is in the area list`).toBe(true);
    }
  });

  it("no alias is also a live tab, and no alias points at another alias", () => {
    const aliases = [...Object.keys(MOVED_TABS), ...Object.keys(LEFT_ADMIN)];
    expect(new Set(aliases).size).toBe(aliases.length);
    for (const old of aliases) {
      expect(NAV_KEYS.has(old), `${old} left the menu`).toBe(false);
      expect(ADMIN_TABS.some((t) => t.key === old), `${old} left the area list`).toBe(false);
    }
    for (const moved of Object.values(MOVED_TABS)) expect(aliases).not.toContain(moved.tab);
  });

  it("every page a tab left Admin for is a route the app registers", () => {
    const app = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf8");
    for (const [old, target] of Object.entries(LEFT_ADMIN)) {
      const route = target.replace(/[?#].*$/, "");
      expect(app.includes(`path="${route}"`), `${old} -> ${route}`).toBe(true);
    }
  });
});

describe("every admin tab link the product ships lands", () => {
  /** Comments out: a comment may name an old address to say where it went. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

  function shipped(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== "locales" && e.name !== "seeds") shipped(p, out);
      } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
  }

  /**
   * A link that opens Admin on nothing, known and reported, outside the change
   * that added this test. Fixing one means deleting its line here: the case
   * below fails while a line names a link that has started to land.
   */
  const KNOWN_BROKEN: Record<string, string> = {
    content: "server/lib/seatApplicationCloser.ts tells admins the confidentiality agreement is unwritten and links to a tab that never existed. Reported 27 Nov 2026.",
  };

  const links = new Map<string, string[]>();
  for (const dir of ["server", "shared", "client/src"]) {
    for (const file of shipped(path.join(ROOT, dir))) {
      for (const m of Array.from(code(fs.readFileSync(file, "utf8")).matchAll(/\/admin\?tab=([a-z0-9-]+)/gi))) {
        links.set(m[1], [...(links.get(m[1]) ?? []), path.relative(ROOT, file).replace(/\\/g, "/")]);
      }
    }
  }

  it("finds the links (a scan that found none would pass everything)", () => {
    expect(links.size).toBeGreaterThan(20);
    expect(links.has("forum-moderation")).toBe(true);
    expect(links.has("org-chart")).toBe(true);
  });

  it("each names a tab in the menu, or an alias that lands", () => {
    const lost = Array.from(links.entries())
      .filter(([key]) => !NAV_KEYS.has(key) && !(key in MOVED_TABS) && !(key in LEFT_ADMIN) && !(key in KNOWN_BROKEN))
      .map(([key, files]) => `${key} (${files.join(", ")})`);
    expect(lost).toEqual([]);
    for (const key of Object.keys(KNOWN_BROKEN)) {
      expect(links.has(key) && !NAV_KEYS.has(key) && !(key in MOVED_TABS), `${key} is still shipped and still lands nowhere`).toBe(true);
    }
  });

  it("the role-access notice names the org chart's real key", () => {
    expect(ACCESS_TASKS_LINK).toBe("/admin?tab=org-chart");
    expect(NAV_KEYS.has(new URLSearchParams(ACCESS_TASKS_LINK.split("?")[1]).get("tab")!)).toBe(true);
  });
});
