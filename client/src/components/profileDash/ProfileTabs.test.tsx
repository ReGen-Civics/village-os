// @vitest-environment jsdom
/**
 * THE MEMBER PORTAL'S TABS, round 2 of the menu (the lead, 27 Nov 2026: "I'm also looking at the member portal and I'm
 * seeing some things could be rearranged here too, following the same logic"). The member's own tabs never read as the
 * village's pages the site menu names Quests, Roles and Treasury; the ids stay, so every /profile#anchor still opens
 * its tab. The door to proposing moved to My work and My roles; the hero stays on Today.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import ProfileTabs, { PROFILE_TABS, TAB_OF_ANCHOR, scrollWhenShown, tabOfAnchor } from "./ProfileTabs";

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

  it("open My roles for the role cards, the section and each role, and the Sheet for a path's card", () => {
    expect(tabOfAnchor("sheet-roles")).toBe("roles");
    expect(tabOfAnchor("role-seat-garden")).toBe("roles");
    expect(tabOfAnchor("my-moon")).toBe("roles");
    expect(tabOfAnchor("path-resident")).toBe("sheet");
    expect(tabOfAnchor("nowhere")).toBeUndefined();
  });

  it("scroll to an anchor once its tab draws it, waiting for a section that arrives after a read", () => {
    vi.useFakeTimers();
    try {
      const el = document.createElement("div");
      el.id = "my-moon";
      const scrolled = vi.fn();
      el.scrollIntoView = scrolled;
      scrollWhenShown("my-moon");
      expect(scrolled).not.toHaveBeenCalled();
      // Drawn and visible a moment later (jsdom has no layout, so visibility is stubbed).
      document.body.appendChild(el);
      el.getClientRects = () => [{}] as unknown as DOMRectList;
      vi.advanceTimersByTime(100);
      expect(scrolled).toHaveBeenCalledTimes(1);
      el.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keep the hero on Today, and put the door to proposing on My work and My roles", () => {
    const page = readFileSync(resolve(__dirname, "../../pages/Profile.tsx"), "utf8");
    const before = (marker: string) => page.slice(Math.max(0, page.indexOf(marker) - 400), page.indexOf(marker));
    expect(before("<ProfileHero")).toMatch(/tabOf\("today"\)\}>\s*$/);
    expect(before("<ProposeBanner")).toContain('tabOf(["quests", "roles"])');
  });
});
