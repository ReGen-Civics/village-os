/**
 * "ADD TO YOUR PHONE": when to suggest it, and how, without nagging.
 *
 * Two roads, because the two phone browsers differ:
 *  - Chrome and the browsers built on it fire `beforeinstallprompt` when the
 *    page can be installed. We hold that event and show our own card at a
 *    sensible moment; "Add" calls the browser's own install dialog.
 *  - Safari on iPhone and iPad has no such event. The card shows the three
 *    taps instead: Share, Add to Home Screen, Add.
 * Anything else (a desktop Firefox, say) gets no card.
 *
 * NOT NAGGING, as rules a test holds:
 *  - Never when the page is already running as an installed app.
 *  - Never again after the app is installed (`appinstalled`, remembered).
 *  - A dismissal waits `REOFFER_AFTER_DAYS` before the card may show again,
 *    and after `MAX_OFFERS` dismissals it never comes back by itself. The
 *    page keeps a quiet "Add to your phone" link that opens it any time.
 *
 * Remembered per device under one key, through safeStorage. No storage means
 * no memory, so the card stays away rather than showing on every visit.
 */
import { readStoredJson, writeStoredJson } from "./safeStorage";

export const INSTALL_MEMORY_KEY = "village.install-offer";
export const REOFFER_AFTER_DAYS = 30;
export const MAX_OFFERS = 3;

export interface InstallMemory {
  /** How many times the card was dismissed. */
  dismissals: number;
  lastDismissedAt: string | null;
  installed: boolean;
}

/** The event Chrome fires; not in the DOM lib. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallRoad = "prompt" | "ios" | "none";

const EMPTY: InstallMemory = { dismissals: 0, lastDismissedAt: null, installed: false };

export function readInstallMemory(): InstallMemory | null {
  const read = readStoredJson("local", INSTALL_MEMORY_KEY);
  if (read.status === "unavailable") return null;
  if (read.status !== "value" || !read.value || typeof read.value !== "object") return { ...EMPTY };
  const v = read.value as Partial<InstallMemory>;
  return {
    dismissals: typeof v.dismissals === "number" && v.dismissals >= 0 ? Math.floor(v.dismissals) : 0,
    lastDismissedAt: typeof v.lastDismissedAt === "string" ? v.lastDismissedAt : null,
    installed: v.installed === true,
  };
}

function write(m: InstallMemory): void {
  writeStoredJson("local", INSTALL_MEMORY_KEY, m);
}

export function rememberDismissed(now = new Date()): void {
  const m = readInstallMemory();
  if (!m) return;
  write({ ...m, dismissals: m.dismissals + 1, lastDismissedAt: now.toISOString() });
}

export function rememberInstalled(): void {
  const m = readInstallMemory();
  if (!m) return;
  write({ ...m, installed: true });
}

/** Is this page already running as an installed app? */
export function runningInstalled(win: Window = window): boolean {
  try {
    if (win.matchMedia?.("(display-mode: standalone)").matches) return true;
    if (win.matchMedia?.("(display-mode: fullscreen)").matches) return true;
  } catch {
    /* no matchMedia: carry on */
  }
  return (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Safari on an iPhone or iPad, where Add to Home Screen is a Share-menu item. */
export function isIosSafari(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent || "";
  const iDevice = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  if (!iDevice) return false;
  // Other iOS browsers say who they are; only Safari shows Add to Home Screen
  // in the same place, so the steps would be wrong anywhere else.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

/** Which road this browser offers. */
export function installRoad(held: BeforeInstallPromptEvent | null, nav: Navigator = navigator): InstallRoad {
  if (held) return "prompt";
  if (isIosSafari(nav)) return "ios";
  return "none";
}

/**
 * May the card show by itself now? The quiet link on the page ignores this
 * and always opens the card on a road that exists.
 */
export function mayOfferNow(memory: InstallMemory | null, installedNow: boolean, now = new Date()): boolean {
  if (installedNow) return false;
  if (!memory) return false;
  if (memory.installed) return false;
  if (memory.dismissals >= MAX_OFFERS) return false;
  if (memory.lastDismissedAt) {
    const since = now.getTime() - Date.parse(memory.lastDismissedAt);
    if (Number.isFinite(since) && since < REOFFER_AFTER_DAYS * 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

/*
 * THE HELD EVENT.
 *
 * Chrome fires `beforeinstallprompt` once a page qualifies, which can be
 * before the protocols page has loaded its own code. `holdInstallPrompt`
 * starts listening as early as it is called and keeps the latest event; it
 * calls `preventDefault` only once a page has asked to own the offer, so a
 * village page that never offers keeps the browser's own behaviour.
 */
let held: BeforeInstallPromptEvent | null = null;
let owned = false;
let listening = false;
const listeners = new Set<() => void>();

function onPrompt(e: Event) {
  if (owned) e.preventDefault();
  held = e as BeforeInstallPromptEvent;
  listeners.forEach((l) => l());
}

function onInstalled() {
  held = null;
  rememberInstalled();
  listeners.forEach((l) => l());
}

export function holdInstallPrompt(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
}

/** A page takes over the offer while it is mounted. Returns the release. */
export function ownInstallOffer(onChange: () => void): () => void {
  holdInstallPrompt();
  owned = true;
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) owned = false;
  };
}

export function heldInstallPrompt(): BeforeInstallPromptEvent | null {
  return held;
}

/** Open the browser's own install dialog. The event can be used once. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = held;
  if (!e) return "unavailable";
  held = null;
  try {
    await e.prompt();
    const choice = await e.userChoice;
    if (choice.outcome === "accepted") rememberInstalled();
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

/** For tests. */
export function resetInstallPromptForTests(): void {
  held = null;
  owned = false;
  listeners.clear();
}
