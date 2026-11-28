/**
 * ONE NAME PER PAGE (27 Nov 2026, the lead's "do first" list): the menu's word for a page, the browser tab's and the
 * breadcrumb's are the same words. The breadcrumb reads the menu itself (navBearings.ts), so this holds the menu and
 * the page titles (shared/pageTitles.ts) together, case aside.
 *
 * Left out, each for a reason: an entry that opens a section of a page (its address has a #), which the page's own
 * title names; a story page, whose menu name is the village's own (Admin, Pages); and the named pairs below.
 */
import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, NAV, isGroup } from "./nav";
import { EXACT_TITLES, pageTitleFor } from "@shared/pageTitles";

/** Pages the menu names twice on purpose, or whose address is a redirect with no page of its own. */
const NAMED_APART: Readonly<Record<string, string>> = {
  "/roles": "Join's Open Roles and Govern's Roles: the same page, the way in and how the village is organised",
  "/feedback": "a redirect into the guide's panel on the page the member came from",
};

describe("one name per page", () => {
  const entries = [...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].filter(
    (l) => !l.href.includes("#") && !l.brochure && !NAMED_APART[l.href],
  );

  it("gives the browser tab the menu's word for every page the menu opens", () => {
    const apart = entries.filter((l) => pageTitleFor(l.href).toLowerCase() !== l.label.toLowerCase()).map((l) => `${l.href}: menu "${l.label}", tab "${pageTitleFor(l.href)}"`);
    expect(apart).toEqual([]);
  });

  it("names Governance's hub and views by their menu words, and every page below them still has a name", () => {
    expect(pageTitleFor("/governance")).toBe("What's happening now");
    expect(pageTitleFor("/governance/")).toBe("What's happening now");
    expect(pageTitleFor("/governance/work?kind=x")).toBe("Waiting on you");
    expect(pageTitleFor("/governance/decisions/42")).toBe("Decisions");
    expect(pageTitleFor("/governance/how")).toBe("How we work together");
    expect(Object.keys(EXACT_TITLES)).toEqual(["/governance"]);
  });
});
