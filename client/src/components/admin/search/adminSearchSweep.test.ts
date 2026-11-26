/**
 * EVERY TAB'S OWN NAME, PLUS ENTER, LANDS ON THAT TAB.
 *
 * The live-pass admin walk typed "Introductions" and pressed Enter and got the
 * dial "Introductions one person receives per day" in place of the page. Enter
 * opens the first result, so this sweeps every tab in the menu, built with the
 * real menu, the real controls and every real dial, and holds the first result
 * for a tab's own name to that tab.
 */
import { describe, expect, it } from "vitest";
import { CONTROL_ENTRIES, OUTSIDE_ENTRIES, dialEntry, rankAdminSearch } from "@shared/adminSearch";
import { VARIABLES } from "@shared/gameVariables";
import { navGroups } from "../adminNavGroups";
import { pageEntries, searchEntries } from "./adminSearchModel";

// Both shapes of the menu: before setup is complete it carries the setup tab too.
const groups = [...navGroups(false), ...navGroups(true)];
const entries = searchEntries(groups, [...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES, ...VARIABLES.map(dialEntry)]);
const pages = pageEntries(groups);

describe("Enter on a tab's own name", () => {
  it("opens the Introductions page, never the dial named after it", () => {
    const intro = pages.find((p) => p.title === "Introductions");
    expect(intro, "the menu has an Introductions page").toBeTruthy();
    expect(rankAdminSearch("Introductions", entries)[0].id).toBe(intro!.id);
    expect(rankAdminSearch("introductions", entries)[0].id).toBe(intro!.id);
  });

  it.each(pages.map((p) => [p.title, p] as const))("%s lands on its own tab", (title, page) => {
    const first = rankAdminSearch(title, entries)[0];
    // Two menu entries may share a name; Enter then lands on the first of them, which is still that name's page.
    const sameName = pages.filter((p) => p.title.toLowerCase() === title.toLowerCase()).map((p) => p.id);
    expect(sameName).toContain(first.id);
    expect(first.kind).toBe("page");
    void page;
  });
});
