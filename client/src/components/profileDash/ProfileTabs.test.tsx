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

  /** A target jsdom can place: drawn, visible, and at `at.top` on the page (jsdom has no layout). */
  const target = (id: string, at: { top: number }) => {
    const el = document.createElement("div");
    el.id = id;
    el.scrollIntoView = vi.fn();
    el.getClientRects = () => [{}] as unknown as DOMRectList;
    el.getBoundingClientRect = () => ({ top: at.top }) as DOMRect;
    return el;
  };

  it("scroll to an anchor once its tab draws it, and again each time the reads above push it down", () => {
    vi.useFakeTimers();
    try {
      const at = { top: 1600 };
      const el = target("my-moon", at);
      scrollWhenShown("my-moon");
      expect(el.scrollIntoView).not.toHaveBeenCalled();
      // Drawn a moment later.
      document.body.appendChild(el);
      vi.advanceTimersByTime(100);
      expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
      // The cards above land and push it 6,900px down: it follows.
      at.top = 8500;
      vi.advanceTimersByTime(100);
      expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
      // A pause between reads is no reason to stop: a read that lands two seconds later is followed too.
      vi.advanceTimersByTime(2000);
      expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
      at.top = 9000;
      vi.advanceTimersByTime(100);
      expect(el.scrollIntoView).toHaveBeenCalledTimes(3);
      // Ten seconds on, it has let go.
      vi.advanceTimersByTime(10000);
      at.top = 9500;
      vi.advanceTimersByTime(500);
      expect(el.scrollIntoView).toHaveBeenCalledTimes(3);
      el.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it("let go the moment the reader scrolls, and give up after ten seconds", () => {
    vi.useFakeTimers();
    try {
      const at = { top: 500 };
      const el = target("about", at);
      document.body.appendChild(el);
      scrollWhenShown("about");
      expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event("wheel"));
      at.top = 4000;
      vi.advanceTimersByTime(500);
      expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
      el.remove();

      // A scrollbar drag fires no event: the page moved while the target held still, so it lets go too.
      const still = { top: 700 };
      const held = target("wallet", still);
      document.body.appendChild(held);
      scrollWhenShown("wallet");
      expect(held.scrollIntoView).toHaveBeenCalledTimes(1);
      // The reader drags 400px down: the target moves up the screen and stays where it is on the page.
      Object.defineProperty(window, "scrollY", { value: 400, configurable: true });
      still.top = 300;
      vi.advanceTimersByTime(100);
      still.top = 0;
      Object.defineProperty(window, "scrollY", { value: 700, configurable: true });
      vi.advanceTimersByTime(300);
      expect(held.scrollIntoView).toHaveBeenCalledTimes(1);
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      held.remove();

      // A target that never settles is chased for ten seconds at most.
      const moving = { top: 0 };
      const restless = target("ledger", moving);
      document.body.appendChild(restless);
      scrollWhenShown("ledger");
      for (let i = 0; i < 150; i++) {
        moving.top += 50;
        vi.advanceTimersByTime(100);
      }
      expect((restless.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(101);
      restless.remove();
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
