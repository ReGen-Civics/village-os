// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { installTouchLight } from "./touchLight";

/** jsdom has no PointerEvent constructor everywhere; a MouseEvent of the same type carries clientX and clientY. */
function press(el: Element, x: number, y: number) {
  el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: x, clientY: y }));
}

function card() {
  document.body.innerHTML = `<a class="m-touch" href="/roles"><span id="inner">Join the team</span></a><p id="outside">Text</p>`;
  const a = document.querySelector<HTMLElement>(".m-touch")!;
  a.getBoundingClientRect = () => ({ left: 100, top: 40, right: 300, bottom: 140, width: 200, height: 100, x: 100, y: 40, toJSON() {} }) as DOMRect;
  return a;
}

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  document.body.innerHTML = "";
});

describe("installTouchLight", () => {
  it("marks where a press landed, relative to the card, from a press on its child", () => {
    const a = card();
    uninstall = installTouchLight();
    press(document.getElementById("inner")!, 130, 65);
    expect(a.style.getPropertyValue("--m-x")).toBe("30px");
    expect(a.style.getPropertyValue("--m-y")).toBe("25px");
    expect(a.dataset.mPress).toBe("a");
  });

  it("flips between two names so every press restarts the light", () => {
    const a = card();
    uninstall = installTouchLight();
    press(a, 150, 50);
    press(a, 150, 50);
    expect(a.dataset.mPress).toBe("b");
    press(a, 150, 50);
    expect(a.dataset.mPress).toBe("a");
  });

  it("ignores presses outside a card, and stops when uninstalled", () => {
    const a = card();
    uninstall = installTouchLight();
    press(document.getElementById("outside")!, 10, 10);
    expect(a.dataset.mPress).toBeUndefined();
    uninstall();
    uninstall = undefined;
    press(a, 150, 50);
    expect(a.dataset.mPress).toBeUndefined();
  });
});
