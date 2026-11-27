// @vitest-environment jsdom
/**
 * THE LANDING PAGE'S WINDOW ONTO THE MAP PROMISES NOTHING ABOUT THE LAND.
 *
 * It said every building "traces to something true: a funded build, a claimed
 * quest, a filled role", the same promise the map's own guide made in her
 * first line, the council stop, the Sanctuary card and the Now tip. On
 * 2026-10-02 those four were taken back (shared/mapArtifactWelcomeWalk.test.ts),
 * because the map's seed is sample data, and this was their twin on the
 * village's front page.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";

vi.mock("@/modules/ModuleProvider", () => ({
  useModule: (id: string) => ({ id, lifecycle: "public" }),
}));
const pushVillageConfig = vi.fn(async () => {});
vi.mock("@/components/map/configPush", () => ({ pushVillageConfig, readLand: () => Promise.resolve(null) }));

import MapPeek, { PEEK_SRC } from "./MapPeek";

/**
 * THE FOUR-MEGABYTE MAP WAITS FOR A CONNECTION THAT CAN AFFORD IT.
 *
 * The header promises the live map stays a still card on `saveData` and on
 * 2g or 3g. The test matched 2g only (`(^|-)(2g|slow-2g)$`), so a 3g visitor
 * who scrolled the home page downloaded the whole map (sweep, 2026-10-31).
 * Each case mounts the card with the card already in view, so the only thing
 * standing between it and the iframe is the connection check.
 */
describe("MapPeek on a metered connection", () => {
  const withConnection = (connection: unknown) => {
    Object.defineProperty(navigator, "connection", { value: connection, configurable: true });
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
        observe() {
          this.cb([{ isIntersecting: true }]);
        }
        disconnect() {}
      },
    );
    const { container, unmount } = render(<Router><MapPeek /></Router>);
    const live = !!container.querySelector("iframe");
    unmount();
    return live;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as any).connection;
  });

  it.each([
    ["3g", { effectiveType: "3g" }],
    ["2g", { effectiveType: "2g" }],
    ["slow-2g", { effectiveType: "slow-2g" }],
    ["saveData on 4g", { effectiveType: "4g", saveData: true }],
  ])("stays a still card on %s", (_name, connection) => {
    expect(withConnection(connection)).toBe(false);
  });

  it.each([
    ["4g", { effectiveType: "4g" }],
    ["no connection API (Safari)", undefined],
  ])("goes live on %s", (_name, connection) => {
    expect(withConnection(connection)).toBe(true);
  });
});

describe("MapPeek", () => {
  it("is one link to the map, never a link inside a link", () => {
    const { container } = render(<Router><MapPeek /></Router>);
    expect(container.querySelectorAll("a a")).toHaveLength(0);
    const links = container.querySelectorAll('a[href="/map"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("aria-label")).toBe("Open the Living Map");
  });

  it("invites a visitor in and says how the map works, with no promise about what is on it", () => {
    render(<Router><MapPeek /></Router>);
    expect(screen.getByRole("heading", { name: "See the village" })).toBeTruthy();
    const words = document.body.textContent ?? "";
    expect(words).toContain("The village drawn as a map you can walk. Step in and tap any building to open its door.");
    expect(words).not.toMatch(/traces to something true|funded build|claimed quest/);
  });
});

/**
 * THE PEEK SHOWS THE VILLAGE'S MAP AS IT STANDS, DRAWN CLEAN (the lead, 27 Nov 2026).
 *
 * The frame had no shell, so the artifact drew its own sample village with every control on. It now opens the map in
 * its peek mode and answers the map's `grounds-ready` with the same config push the Living Map sends.
 */
describe("MapPeek's frame", () => {
  const inView = () =>
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
        observe() {
          this.cb([{ isIntersecting: true }]);
        }
        disconnect() {}
      },
    );
  afterEach(() => {
    vi.unstubAllGlobals();
    pushVillageConfig.mockClear();
  });

  it("opens the map in its peek mode, with no welcome card", () => {
    inView();
    const { container } = render(<Router><MapPeek /></Router>);
    expect(PEEK_SRC).toBe("/grounds/index.html#peek&skipIntro");
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(PEEK_SRC);
  });

  it("pushes the village's own map when its own frame says it is ready", async () => {
    inView();
    const { container } = render(<Router><MapPeek /></Router>);
    const win = (container.querySelector("iframe") as HTMLIFrameElement).contentWindow;
    window.dispatchEvent(new MessageEvent("message", { data: { type: "grounds-ready" }, origin: window.location.origin, source: win }));
    await vi.waitFor(() => expect(pushVillageConfig).toHaveBeenCalledTimes(1));
    expect((pushVillageConfig.mock.calls[0] as unknown[])[0]).toBe(win);
  });

  it("answers no other window, and no other origin", async () => {
    inView();
    const { container } = render(<Router><MapPeek /></Router>);
    const win = (container.querySelector("iframe") as HTMLIFrameElement).contentWindow;
    window.dispatchEvent(new MessageEvent("message", { data: { type: "grounds-ready" }, origin: window.location.origin, source: window }));
    window.dispatchEvent(new MessageEvent("message", { data: { type: "grounds-ready" }, origin: "https://elsewhere.example", source: win }));
    await new Promise((r) => setTimeout(r, 20));
    expect(pushVillageConfig).not.toHaveBeenCalled();
  });
});
