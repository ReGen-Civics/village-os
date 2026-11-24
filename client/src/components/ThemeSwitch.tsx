/**
 * THE LIGHT AND DARK SWITCH, in the site header on every width.
 *
 * Quiet on purpose (the lead, 24 Nov 2026: "not SO obvious on top, just one of
 * the icons with a tiny light or dark under it"): one glyph for the mode the
 * page is in, its name small beneath it, and a tap moves to the other. The
 * button is a 44px target and says in words what a tap will do. Choosing
 * applies at once and is remembered in this browser (lib/colourMode.ts holds
 * the order and the storage).
 *
 * Hidden until MODES_LIVE, unless this browser already holds a choice: that is
 * how a tester previews the modes before they are on for everybody.
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { LanguagePicker } from "@/i18n/LanguagePicker";
import { DaySun, NightMoon } from "@/components/sacred/glyphs";
import { MODES_LIVE, applyMode, currentMode, storedMode, type Mode } from "@/lib/colourMode";

export default function ThemeSwitch({ live = MODES_LIVE }: { live?: boolean }) {
  const { t } = useLingui();
  const [mode, setMode] = useState<Mode>(() => currentMode());
  const [shown] = useState(() => live || storedMode() !== null);
  // The first-paint script painted <html> with the platform's ground so the
  // page never flashes; once the stylesheet is here it decides, so a village's
  // own day-* or night-* ground is not held under that inline colour.
  useEffect(() => {
    document.documentElement.style.removeProperty("background-color");
  }, []);
  if (!shown) return null;

  const next: Mode = mode === "light" ? "dark" : "light";
  const flip = () => {
    applyMode(next, true);
    setMode(next);
  };
  const Glyph = mode === "light" ? DaySun : NightMoon;
  const name =
    mode === "light"
      ? t({ message: "Light", context: "site header: under the mode switch, the mode the page is in" })
      : t({ message: "Dark", context: "site header: under the mode switch, the mode the page is in" });
  const action =
    next === "dark"
      ? t({ message: "Switch to dark mode", context: "site header: the mode switch, read aloud" })
      : t({ message: "Switch to light mode", context: "site header: the mode switch, read aloud" });

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={action}
      title={action}
      data-theme-switch={mode}
      className="theme-switch inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 opacity-85 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
    >
      <Glyph className="size-5" />
      <span aria-hidden="true" className="text-xs leading-none">{name}</span>
    </button>
  );
}

/** The header's two settings, side by side on every width: the mode, then the language. */
export function ModeAndLanguage({ villageDefault }: { villageDefault: string | null }) {
  return (
    <>
      <ThemeSwitch />
      <LanguagePicker villageDefault={villageDefault} />
    </>
  );
}

/**
 * The header logo's mask, for light mode's repaint (index.css, `.village-logo`).
 *
 * The mask is /api/brand/logo-mark.png, the logo redrawn on this site's own
 * origin: a logo on another host cannot be a CSS mask without CORS. It is
 * asked for only while a mode is set, and the logo is repainted only once the
 * mask has LOADED, so a mask that fails leaves the logo drawn as it is rather
 * than invisible. The address carries a short hash of the logo's, so a new
 * logo is a new mask past any cache.
 */
export function logoMaskUrl(src: string): string {
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return `/api/brand/logo-mark.png?v=${(h >>> 0).toString(36)}`;
}

export function useLogoMask(src: string | undefined): { "data-mask"?: ""; style?: Record<string, string> } {
  const [ready, setReady] = useState<string | null>(null);
  useEffect(() => {
    if (!src || !document.documentElement.dataset.mode) return;
    const url = logoMaskUrl(src);
    const img = new Image();
    img.onload = () => setReady(url);
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [src]);
  return ready ? { "data-mask": "", style: { "--logo-src": `url("${ready}")` } } : {};
}
