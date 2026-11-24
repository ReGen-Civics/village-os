/**
 * THE LIGHT AND DARK SWITCH, in the site header on every width.
 *
 * Two halves of one pill, a sun and a moon, each a 44px target and each
 * `aria-pressed`, so it reads as a choice of two rather than a toggle whose
 * state has to be guessed. Choosing applies at once and is remembered in this
 * browser (lib/colourMode.ts holds the order and the storage).
 *
 * Hidden until MODES_LIVE, unless this browser already holds a choice: that is
 * how a tester previews the modes before they are on for everybody.
 */
import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { LanguagePicker } from "@/i18n/LanguagePicker";
import { MODES_LIVE, applyMode, currentMode, storedMode, type Mode } from "@/lib/colourMode";

export default function ThemeSwitch({ live = MODES_LIVE }: { live?: boolean }) {
  const { t } = useLingui();
  const [mode, setMode] = useState<Mode>(() => currentMode());
  const [shown] = useState(() => live || storedMode() !== null);
  if (!shown) return null;

  const pick = (next: Mode) => {
    applyMode(next, true);
    setMode(next);
  };

  const half =
    "inline-flex size-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current";

  return (
    <div
      role="group"
      aria-label={t({ message: "Light or dark", context: "site header: the colour mode switch" })}
      className="theme-switch inline-flex items-center rounded-full border p-0.5"
      data-theme-switch
    >
      <button type="button" aria-pressed={mode === "light"} onClick={() => pick("light")} className={half} data-on={mode === "light" ? "" : undefined}>
        <Sun className="size-5" aria-hidden="true" />
        <span className="sr-only">{t({ message: "Light", context: "site header: the colour mode switch" })}</span>
      </button>
      <button type="button" aria-pressed={mode === "dark"} onClick={() => pick("dark")} className={half} data-on={mode === "dark" ? "" : undefined}>
        <Moon className="size-5" aria-hidden="true" />
        <span className="sr-only">{t({ message: "Dark", context: "site header: the colour mode switch" })}</span>
      </button>
    </div>
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
