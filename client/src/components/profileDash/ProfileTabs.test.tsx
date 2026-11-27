// @vitest-environment jsdom
/**
 * THE MEMBER PORTAL'S TABS, round 2 of the menu (the lead, 27 Nov 2026: "I'm also looking at the member portal and I'm
 * seeing some things could be rearranged here too, following the same logic"). The member's own tabs never read as the
 * village's pages the site menu names Quests, Roles and Treasury; the ids stay, so every /profile#anchor still opens
 * its tab. Today keeps what is next: the hero moved to the Sheet, the door to proposing to My work and My roles.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import ProfileTabs, { PROFILE_TABS, TAB_OF_ANCHOR } from "./ProfileTabs";

i18n.load("en", {});
i18n.activate("en");

describe("the member portal's tabs", () => {
  it("are Today, My work, My roles, My treasury and Sheet, five at most", () => {
    render(
      <I18nProvider i18n={i18n}>
        <ProfileTabs tab="today" onTab={() => {}} />
      </I18nProvider>,
    );
    const names = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(names).toEqual(["Today", "My work", "My roles", "My treasury", "Sheet"]);
    expect(PROFILE_TABS.length).toBeLessThanOrEqual(5);
  });

  it("keep their ids, so the anchors the rest of the app links to still open them", () => {
    expect(TAB_OF_ANCHOR["my-tasks"]).toBe("quests");
    expect(TAB_OF_ANCHOR["cash-owed"]).toBe("treasury");
    expect(TAB_OF_ANCHOR["sheet-paths"]).toBe("sheet");
  });

  it("put the hero on the Sheet and the door to proposing on My work and My roles, so Today starts with what is next", () => {
    const page = readFileSync(resolve(__dirname, "../../pages/Profile.tsx"), "utf8");
    const before = (marker: string) => page.slice(Math.max(0, page.indexOf(marker) - 400), page.indexOf(marker));
    expect(before("<ProfileHero")).toMatch(/tabOf\("sheet"\)\}>\s*$/);
    expect(before("<ProposeBanner")).toContain('tabOf(["quests", "roles"])');
  });
});
