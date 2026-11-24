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
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { LanguagePicker } from "@/i18n/LanguagePicker";
import { DaySun, NightMoon } from "@/components/sacred/glyphs";
import { MODES_LIVE, applyMode, currentMode, storedMode, type Mode } from "@/lib/colourMode";

export default function ThemeSwitch({ live = MODES_LIVE }: { live?: boolean }) {
  const { t } = useLingui();
  const [mode, setMode] = useState<Mode>(() => currentMode());
  const [shown] = useState(() => live || storedMode() !== null);
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
