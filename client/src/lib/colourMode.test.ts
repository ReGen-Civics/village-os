// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODE, FOLLOW_DEVICE, MODES_LIVE, MODE_KEY, applyMode, resolveMode } from "./colourMode";

const shell = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
/** The shell parsed as a document, so the script is found as an element and never by matching HTML text. */
const firstPaint = (() => {
  const doc = new DOMParser().parseFromString(shell, "text/html");
  const s = Array.from(doc.querySelectorAll("script:not([src])"), (el) => el.textContent ?? "").find((x) => x.includes(MODE_KEY));
  if (!s) throw new Error("client/index.html has no first-paint mode script");
  return s;
})();

function prefers(scheme: "dark" | "light" | null) {
  window.matchMedia = vi.fn((q: string) => ({ matches: scheme !== null && q.includes(scheme) })) as unknown as typeof window.matchMedia;
}

function runShellScript(live: boolean, device: boolean) {
  const src = firstPaint.replace(/var live = (true|false)/, `var live = ${live}`).replace(/device = (true|false)/, `device = ${device}`);
  // The shell's own script, run in a sandbox that holds only what it reads.
  vm.runInNewContext(src, { localStorage: window.localStorage, matchMedia: window.matchMedia, document });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-mode");
  document.documentElement.removeAttribute("style");
  prefers(null);
});
afterEach(() => vi.restoreAllMocks());

describe("resolveMode", () => {
  it("returns the visitor's own choice above everything", () => {
    localStorage.setItem(MODE_KEY, "dark");
    prefers("light");
    expect(resolveMode(true)).toBe("dark");
    expect(resolveMode(false)).toBe("dark");
  });

  it("opens in light whatever the device says, while FOLLOW_DEVICE is off", () => {
    expect(FOLLOW_DEVICE).toBe(false);
    prefers("dark");
    expect(resolveMode(true)).toBe("light");
  });

  it("follows the device when nobody has chosen, once FOLLOW_DEVICE is on", () => {
    prefers("dark");
    expect(resolveMode(true, true)).toBe("dark");
  });

  it("falls back to light when the device says nothing", () => {
    expect(DEFAULT_MODE).toBe("light");
    expect(resolveMode(true)).toBe("light");
  });

  it("sets nothing before modes are live, so the site looks as it did", () => {
    prefers("dark");
    expect(resolveMode(false)).toBeNull();
  });

  it("ignores a stored value that is not a mode", () => {
    localStorage.setItem(MODE_KEY, "sepia");
    expect(resolveMode(false)).toBeNull();
  });
});

describe("applyMode", () => {
  it("marks <html> at once and remembers only when asked", () => {
    applyMode("dark", false);
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(localStorage.getItem(MODE_KEY)).toBeNull();
    applyMode("light", true);
    expect(document.documentElement.dataset.mode).toBe("light");
    expect(localStorage.getItem(MODE_KEY)).toBe("light");
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private window");
    });
    expect(() => applyMode("dark", true)).not.toThrow();
    expect(document.documentElement.dataset.mode).toBe("dark");
  });
});

describe("the first-paint script in client/index.html agrees with colourMode.ts", () => {
  it("carries the same live flag, device flag and fallback", () => {
    expect(firstPaint).toContain(`var live = ${MODES_LIVE}`);
    expect(firstPaint).toContain(`device = ${FOLLOW_DEVICE}`);
    expect(firstPaint).toContain(`fallback = "${DEFAULT_MODE}"`);
  });

  const cases: { stored: string | null; device: "dark" | "light" | null; live: boolean; follow: boolean }[] = [];
  for (const stored of [null, "light", "dark", "sepia"]) for (const device of [null, "light", "dark"] as const) for (const live of [true, false]) for (const follow of [true, false]) cases.push({ stored, device, live, follow });

  it.each(cases)("stored $stored, device $device, live $live, follow $follow", ({ stored, device, live, follow }) => {
    if (stored) localStorage.setItem(MODE_KEY, stored);
    prefers(device);
    const want = resolveMode(live, follow);
    runShellScript(live, follow);
    expect(document.documentElement.getAttribute("data-mode")).toBe(want);
  });
});
