// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { installRouteGrowth, pageArrives } from "./routeGrowth";

/** What wouter does on navigate: change history, then dispatch "pushState" (wouter/esm/use-browser-location.js). */
function navigate(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("pushState"));
}

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  window.history.replaceState({}, "", "/");
});

const line = () => document.querySelector<HTMLElement>(".m-root-line");

describe("routeGrowth", () => {
  it("leaves the page a visit opens on alone: nothing arrives, no root grows", () => {
    window.history.replaceState({}, "", "/roles");
    uninstall = installRouteGrowth();
    expect(pageArrives()).toBe(false);
    expect(line()).toBeNull();
    expect(document.documentElement.hasAttribute("data-m-arrived")).toBe(false);
  });

  it("grows a root and lets the next page arrive once the reader moves", () => {
    document.body.innerHTML = '<main id="main">Home</main>';
    uninstall = installRouteGrowth();
    navigate("/circles");
    expect(document.documentElement.hasAttribute("data-m-arrived")).toBe(true);
    expect(document.getElementById("main")?.hasAttribute("data-m-stay"), "the page being left holds still").toBe(true);
    expect(pageArrives()).toBe(true);
    expect(line()?.dataset.grow).toBe("a");
    expect(line()?.getAttribute("aria-hidden")).toBe("true");
    navigate("/quests");
    expect(line()?.dataset.grow).toBe("b");
  });

  it("grows from where the reader tapped", () => {
    uninstall = installRouteGrowth();
    Object.defineProperty(window, "innerWidth", { value: 400, configurable: true });
    window.dispatchEvent(new MouseEvent("pointerdown", { clientX: 300 }));
    navigate("/map");
    expect(line()?.style.getPropertyValue("--m-ox")).toBe("75%");
  });

  it("ignores a change of query or hash on the same page", () => {
    uninstall = installRouteGrowth();
    navigate("/roles");
    navigate("/roles?circle=land");
    navigate("/roles#ventures");
    expect(line()?.dataset.grow).toBe("a");
  });

  it("counts back and forward", () => {
    uninstall = installRouteGrowth();
    window.history.pushState({}, "", "/feed");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(pageArrives()).toBe(true);
    expect(line()).not.toBeNull();
  });
});
