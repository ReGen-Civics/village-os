/**
 * The lines that say where the words already in the form came from, and the door to a
 * next role from the sent screen (Rye, 15 Nov 2026: a second application carries over
 * what the person wrote in the first; fireflyPath/applyCarry.ts says what carries).
 */
import { useLingui } from "@lingui/react/macro";
import { ArrowRight } from "lucide-react";
import { BTN_SECONDARY } from "@/components/journey/look";

/** "draft": this role's own saved draft. "carry": their words from an earlier application. */
export function RestoredNote({ kind }: { kind: "draft" | "carry" }) {
  const { t } = useLingui();
  if (kind === "carry") {
    return (
      <p className="mt-2 text-sm text-foreground" data-carried-over="">
        {t({ message: "We filled in what you wrote in your earlier application: your name, contact, about you, what you bring and your voice note's words. Change anything you like. Answers for this role, your price, references, consent and recordings start fresh.", context: "founding application carried over" })}
      </p>
    );
  }
  return (
    <p className="mt-2 text-sm text-foreground" data-draft-restored="">
      {t({ message: "We kept your answers from last time. References, files and recordings are never saved, so add them again.", context: "founding application draft" })}
    </p>
  );
}

/** On the sent screen: apply for another role, starting from what they just wrote. */
export function AnotherRoleDoor({ onChoose }: { onChoose: () => void }) {
  const { t } = useLingui();
  return (
    <div className="grid gap-1" data-another-role="">
      <button type="button" className={`${BTN_SECONDARY} justify-self-start`} onClick={onChoose}>
        {t({ message: "Apply for another role too", context: "open proposal sent" })}
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
      <p className="text-sm text-muted-foreground">{t({ message: "Your name, contact and what you wrote about yourself come with you, so you only add what is new for that role.", context: "open proposal sent" })}</p>
    </div>
  );
}
