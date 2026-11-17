// @vitest-environment jsdom
/**
 * "Forget my answers on this device" forgets, even when a save is still pending.
 *
 * The application page saves its draft in a passive effect whenever the box is ticked. On a slow machine the render
 * that ticks the box can be on screen before that effect has run; pressing Forget then cleared the device, and the
 * pending save wrote the draft straight back (CI, PR #1421: `apply-draft:v1:public:r-host` left behind). Forget now
 * lets every pending save run first, then clears.
 *
 * The race is made on purpose here: the tick is a state change outside act, and Forget is pressed from a
 * MutationObserver, which runs after React has drawn the button and before React runs its passive effects.
 */
import { afterEach, describe, expect, it } from "vitest";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { RememberOnDevice } from "./RememberOnDevice";

const KEY = "apply-draft:v1:public:r-host";
const applyKeys = () => Object.keys(window.localStorage).filter((k) => k.startsWith("apply-"));

let tick: (on: boolean) => void = () => {};

/** The page's shape: a draft saved in a passive effect whenever the box is ticked. */
function Page() {
  const [remember, setRemember] = useState(false);
  tick = setRemember;
  useEffect(() => {
    if (remember) window.localStorage.setItem(KEY, JSON.stringify({ name: "Rowan" }));
  }, [remember]);
  return <RememberOnDevice on={remember} onChange={setRemember} onForgotten={() => {}} />;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  window.localStorage.clear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("forget my answers on this device", () => {
  it("clears the device even when the save from the tick has not run yet", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<Page />));
    expect(applyKeys()).toEqual([]);

    // Outside act, so React schedules the render and its effects the way a browser does.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    let pressedWhileSavePending = false;
    const pressed = new Promise<void>((resolve) => {
      const seen = new MutationObserver(() => {
        const forget = host!.querySelector<HTMLButtonElement>("[data-forget-on-device]");
        if (!forget) return;
        seen.disconnect();
        // The button is drawn and the save has not run: the window the race lives in.
        pressedWhileSavePending = applyKeys().length === 0;
        forget.click();
        resolve();
      });
      seen.observe(host!, { childList: true, subtree: true });
    });
    tick(true);
    await pressed;
    // Let every scheduled render and effect finish.
    await new Promise((r) => setTimeout(r, 50));

    expect(pressedWhileSavePending, "the race was set up: Forget was pressed before the save ran").toBe(true);
    expect(applyKeys()).toEqual([]);
    expect(host!.querySelector<HTMLInputElement>("#propose-remember")!.checked).toBe(false);
  });

  it("unticking forgets the same way", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<Page />));
    act(() => tick(true));
    expect(applyKeys()).toEqual([KEY]);
    act(() => host!.querySelector<HTMLInputElement>("#propose-remember")!.click());
    expect(applyKeys()).toEqual([]);
  });
});
