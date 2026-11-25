// @vitest-environment jsdom
/**
 * THE TOP PAGES' ICONS (the lead, 25 Nov 2026): one icon per page, keyed by the
 * address the menus and the bar use, loaded after the first paint, and drawn
 * beside each menu entry's label.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ACCOUNT_MENU, NAV, isGroup } from "@/config/nav";
import { PATH_SLOT, TAB_SLOTS } from "@/config/mobileNav";
import { ROUTE_ICONS, loadRouteIcons, resetRouteIconsForTests, routeIcon, type RouteIcon } from "./routeIcons";
import { ROUTE_ICON_SET } from "./routeIconSet";
import MenuIcon from "@/components/nav/MenuIcon";
import { EarthshipDome, Gathering, HeartLeaf, LeafCompass, SteppingStones, Sunrise } from "@/components/sacred/living";

afterEach(() => {
  cleanup();
  resetRouteIconsForTests();
});

const Fallback: RouteIcon = () => <svg data-fallback="" />;

describe("the set", () => {
  it("names only addresses a menu entry or a bar slot uses, so every row is drawn somewhere", () => {
    const known = new Set([...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].map((l) => l.href));
    for (const s of TAB_SLOTS) if (s.path) known.add(s.path);
    for (const href of Object.keys(ROUTE_ICON_SET)) expect(known.has(href), href).toBe(true);
  });

  it("covers the top pages", () => {
    for (const href of ["/", "/quests", "/roles", "/circles", "/gratitude", "/profile", "/governance", "/decisions"]) expect(ROUTE_ICON_SET[href], href).toBeTruthy();
  });

  it("draws each page one way everywhere: the bar's own five slots and the menus agree (the lead, 25 Nov 2026)", () => {
    for (const slot of TAB_SLOTS) if (slot.path && !slot.personal && ROUTE_ICON_SET[slot.path]) expect(ROUTE_ICON_SET[slot.path], slot.path).toBe(slot.Icon);
    expect(ROUTE_ICON_SET["/"]).toBe(EarthshipDome);
    // The stones are the path, and quests the leaf compass (the lead, 25 Nov 2026), in the bar and every menu.
    expect(ROUTE_ICON_SET["/path"]).toBe(SteppingStones);
    expect(PATH_SLOT.Icon).toBe(SteppingStones);
    expect(ROUTE_ICON_SET["/quests"]).toBe(LeafCompass);
    expect(TAB_SLOTS.find((s) => s.path === "/quests")?.Icon).toBe(LeafCompass);
    expect(ROUTE_ICON_SET["/gratitude"]).toBe(HeartLeaf);
    expect(ROUTE_ICON_SET["/events"]).toBe(Gathering);
    expect(ROUTE_ICON_SET["/seasonal-festivals"]).toBe(Sunrise);
  });

  it("draws the living family: each icon renders one aria-hidden svg in currentColor", () => {
    for (const [href, Icon] of Object.entries(ROUTE_ICON_SET)) {
      const { container, unmount } = render(<Icon className="size-4" />);
      const svg = container.querySelector("svg");
      expect(svg, href).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden"), href).toBe("true");
      expect(svg?.getAttribute("stroke"), href).toBe("currentColor");
      unmount();
    }
  });
});

describe("loading after the first paint", () => {
  it("answers with the fallback until the set has landed, and with the page's icon after", async () => {
    expect(routeIcon("/roles", Fallback)).toBe(Fallback);
    await loadRouteIcons();
    expect(ROUTE_ICONS["/roles"]).toBe(ROUTE_ICON_SET["/roles"]);
    expect(routeIcon("/roles", Fallback)).toBe(ROUTE_ICON_SET["/roles"]);
    expect(routeIcon("/nowhere", Fallback)).toBe(Fallback);
  });

  it("CONTROL: nothing imports the set itself, so it can never ride on the first page", () => {
    const root = join(__dirname, "..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name) && !name.includes(".test.") && /from\s+["'][^"']*routeIconSet["']/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});

describe("a menu entry's icon", () => {
  it("keeps an empty place before the set lands, so labels line up, and draws the page's icon after", async () => {
    const { container, rerender } = render(<MenuIcon href="/quests" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("span[aria-hidden]")).not.toBeNull();
    await act(async () => {
      await loadRouteIcons();
    });
    rerender(<MenuIcon href="/quests" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("living-leaf-compass");
  });

  it("uses the entry's own icon where the page has none, and `bare` draws nothing at all", () => {
    const own = render(<MenuIcon href="/investor" fallback={Fallback} />);
    expect(own.container.querySelector("[data-fallback]")).not.toBeNull();
    own.unmount();
    const bare = render(<MenuIcon href="/nowhere" bare />);
    expect(bare.container.innerHTML).toBe("");
  });

  it("the header's sheet draws it in its chip, and no chip without an icon", async () => {
    await act(async () => {
      await loadRouteIcons();
    });
    const chip = render(<MenuIcon href="/decisions" chip />);
    expect(chip.container.querySelector("span[data-menu-icon] svg")).not.toBeNull();
    chip.unmount();
    expect(render(<MenuIcon href="/nowhere" chip />).container.innerHTML).toBe("");
  });
});
