/**
 * THE ONE PRIMARY ACT, within thumb reach (moved out of pages/ProposeARole.tsx, which holds the file-lines
 * ceiling). On a phone the tab bar steps out (M2, data-hides-tabbar-phone on the form) and this bar rides
 * above the keyboard (--stone-kb, visualViewport). On a desk (lg) it is not sticky at all: it rests at the
 * card's foot behind a rule, with Enter named beside Continue (D-06).
 *
 * Solid on a phone (applicant journey QA, 15 Nov 2026): a see-through bar let the field under it show
 * through. Its height is `--stone-bar-h`, which index.css reads as the scroll padding, so a focused field
 * stops above the bar and never under it (a11y sweep P1-2).
 */
import type * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/journey/look";
import { Fireflies } from "@/components/journey/nature";
import { EnterHint } from "./ApplySteps";

const BUTTON = `${BTN_PRIMARY} py-3`;

export default function StoneBar({ keyboard, stone, last, nextName, sending, onBack, onNext }: { keyboard: number; stone: number; last: number; nextName: string; sending: boolean; onBack: () => void; onNext: () => void }) {
  const { t } = useLingui();
  return (
    <div
      style={{ "--stone-kb": `${keyboard}px` } as React.CSSProperties}
      data-keyboard={keyboard > 0 ? "open" : undefined}
      className="sticky bottom-[calc(var(--stone-kb,0px)+env(safe-area-inset-bottom,0px)+0.5rem)] z-20 -mx-5 mt-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:-mx-10 sm:px-8 lg:static lg:mx-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-6 lg:shadow-none"
      data-stone-bar=""
    >
      <button type="button" onClick={onBack} disabled={stone === 0} className={`${BTN_SECONDARY} disabled:invisible`} data-stone-back="">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {/* On a phone the arrow says it, so Continue has the width; a screen reader still hears "Back". */}
        <span className="max-sm:sr-only">{t({ message: "Back", context: "open proposal stones" })}</span>
      </button>
      {stone < last && <EnterHint />}
      {stone < last ? (
        <Fireflies key={`next-${stone}`} className="min-w-0 flex-1 justify-end sm:flex-none">
          <button type="button" onClick={onNext} className={`${BUTTON} w-full sm:w-auto`} data-stone-next="">
            <span className="min-w-0 break-words">{t({ message: `Continue to ${nextName}`, context: "founding application steps" })}</span>
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
          </button>
        </Fireflies>
      ) : (
        <Fireflies key="send" className="min-w-0 flex-1 justify-end sm:flex-none">
          <button type="submit" disabled={sending} className={`${BUTTON} w-full sm:w-auto`}>
            {sending ? t({ message: "Sending...", context: "open proposal send" }) : t({ message: "Send my application", context: "founding application send" })}
            {!sending && <ArrowRight className="size-5" aria-hidden="true" />}
          </button>
        </Fireflies>
      )}
    </div>
  );
}
