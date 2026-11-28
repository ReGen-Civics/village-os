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

  /** Where the page sits, as jsdom cannot scroll. */
  const pageAt = (y: number) => Object.defineProperty(window, "scrollY", { value: y, configurable: true });

  it("never yanks a reader who moved before the target was drawn", () => {
    vi.useFakeTimers();
    try {
      pageAt(0);
      const el = target("my-moon", { top: 1600 });
      scrollWhenShown("my-moon");
      // The reader scrolls (a wheel before the listeners, or a scrollbar) while the reads are still out.
      pageAt(900);
      vi.advanceTimersByTime(100);
      document.body.appendChild(el);
      vi.advanceTimersByTime(5000);
      expect(el.scrollIntoView).not.toHaveBeenCalled();
      el.remove();
    } finally {
      pageAt(0);
      vi.useRealTimers();
    }
  });

  it("does not follow on arrival when the page is already scrolled and nothing is drawn yet", () => {
    vi.useFakeTimers();
    try {
      pageAt(640); // the browser put a reader back where they were, or they scrolled first
      const el = target("roles", { top: 300 });
      scrollWhenShown("roles", { arrival: true });
      document.body.appendChild(el);
      vi.advanceTimersByTime(3000);
      expect(el.scrollIntoView).not.toHaveBeenCalled();
      // A jump made on the page (not an arrival) still follows from wherever the page sits.
      scrollWhenShown("roles");
      expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event("wheel"));
      el.remove();
    } finally {
      pageAt(0);
      vi.useRealTimers();
    }
  });

  it("keeps following through a key or a press inside a dialog, and holds off the browser's restore meanwhile", () => {
    vi.useFakeTimers();
    try {
      pageAt(0);
      const at = { top: 1200 };
      const el = target("my-moon", at);
      document.body.appendChild(el);
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      const close = document.createElement("button");
      dialog.appendChild(close);
      document.body.appendChild(dialog);
      history.scrollRestoration = "auto";
      scrollWhenShown("my-moon");
      expect(history.scrollRestoration).toBe("manual");
      expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
      // Escape closes the level-up moment: that is not the reader taking the page.
      close.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      close.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      at.top = 2400;
      vi.advanceTimersByTime(100);
      expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
      // A key outside the dialog is: it lets go, and the browser's own restore comes back.
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      at.top = 3000;
      vi.advanceTimersByTime(300);
      expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
      expect(history.scrollRestoration).toBe("auto");
      dialog.remove();
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
