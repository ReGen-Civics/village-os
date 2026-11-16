// @vitest-environment jsdom
/**
 * "Add to your phone": which road a browser gets, and the rules that keep the
 * card from nagging.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INSTALL_MEMORY_KEY,
  MAX_OFFERS,
  REOFFER_AFTER_DAYS,
  heldInstallPrompt,
  installRoad,
  isIosSafari,
  mayOfferNow,
  ownInstallOffer,
  readInstallMemory,
  rememberDismissed,
  resetInstallPromptForTests,
  type BeforeInstallPromptEvent,
} from "./installPrompt";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

const nav = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints }) as Navigator;
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  resetInstallPromptForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the road", () => {
  it("a held install event is the prompt road", () => {
    expect(installRoad({} as BeforeInstallPromptEvent, nav(ANDROID))).toBe("prompt");
  });
  it("Safari on iPhone, and on an iPad that says it is a Mac, gets the steps", () => {
    expect(isIosSafari(nav(IPHONE_SAFARI))).toBe(true);
    expect(isIosSafari(nav(IPAD_DESKTOP_UA, 5))).toBe(true);
    expect(installRoad(null, nav(IPHONE_SAFARI))).toBe("ios");
  });
  it("another iOS browser, a desktop Mac, or an Android with no event gets nothing", () => {
    expect(installRoad(null, nav(IPHONE_CHROME))).toBe("none");
    expect(installRoad(null, nav(IPAD_DESKTOP_UA, 0))).toBe("none");
    expect(installRoad(null, nav(ANDROID))).toBe("none");
  });
});

describe("not nagging", () => {
  const now = new Date("2026-11-15T12:00:00.000Z");

  it("offers on a first visit, and never while running installed", () => {
    expect(mayOfferNow(readInstallMemory(), false, now)).toBe(true);
    expect(mayOfferNow(readInstallMemory(), true, now)).toBe(false);
  });

  it("a dismissal waits the re-offer window", () => {
    rememberDismissed(now);
    const day = 24 * 60 * 60 * 1000;
    expect(mayOfferNow(readInstallMemory(), false, new Date(now.getTime() + (REOFFER_AFTER_DAYS - 1) * day))).toBe(false);
    expect(mayOfferNow(readInstallMemory(), false, new Date(now.getTime() + (REOFFER_AFTER_DAYS + 1) * day))).toBe(true);
  });

  it(`after ${MAX_OFFERS} dismissals it never shows by itself again`, () => {
    for (let i = 0; i < MAX_OFFERS; i++) rememberDismissed(new Date("2025-01-01T00:00:00.000Z"));
    expect(mayOfferNow(readInstallMemory(), false, now)).toBe(false);
  });

  it("never after an install", () => {
    localStorage.setItem(INSTALL_MEMORY_KEY, JSON.stringify({ dismissals: 0, lastDismissedAt: null, installed: true }));
    expect(mayOfferNow(readInstallMemory(), false, now)).toBe(false);
  });

  it("with no storage, stays away", () => {
    expect(mayOfferNow(null, false, now)).toBe(false);
  });
});

describe("holding the browser's event", () => {
  it("prevents the browser's own offer only while a page owns it", () => {
    const fire = () => {
      const e = new Event("beforeinstallprompt", { cancelable: true });
      window.dispatchEvent(e);
      return e;
    };
    const changed = vi.fn();
    const release = ownInstallOffer(changed);
    const e1 = fire();
    expect(e1.defaultPrevented).toBe(true);
    expect(heldInstallPrompt()).toBe(e1);
    expect(changed).toHaveBeenCalled();
    release();
    const e2 = fire();
    expect(e2.defaultPrevented).toBe(false);
  });
});
