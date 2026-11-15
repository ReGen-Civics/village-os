/**
 * Two small parts of the welcome (CompanionWelcome.tsx): the name box on beat 1
 * and the moon promise on beat 6.
 */
import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import MicButton from "@/components/MicButton";
import { BTN_GOLD, KICKER } from "@/components/profileDash/dashUi";
import type { PetKind, PetTint } from "@shared/companionItems";
import { Bubble, INPUT, MIC_CLASS, Pet, type useSpeech } from "./welcomeKit";

export function NameBox({ initial, quiet, onSend }: { initial: string; quiet: boolean; onSend: (v: string) => void }) {
  const { t } = useLingui();
  const [v, setV] = useState(initial);
  return (
    <div className="flex items-stretch gap-2">
      <label htmlFor="cw-name" className="sr-only">
        <Trans context="companion welcome">A name for your companion</Trans>
      </label>
      <input
        id="cw-name"
        className={INPUT}
        value={v}
        maxLength={40}
        placeholder={t({ message: `A name…`, context: "companion welcome" })}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSend(v);
        }}
      />
      {!quiet ? <MicButton onText={(chunk) => setV(chunk.replace(/[.!?]+$/, "").trim())} className={MIC_CLASS} /> : null}
      <button type="button" className={`${BTN_GOLD} !min-h-11 !px-4`} onClick={() => onSend(v)}>
        <Trans context="companion welcome">Send</Trans>
      </button>
    </div>
  );
}

export function MoonPromise({
  who,
  kind,
  tint,
  motion,
  speak,
  quiet,
  onNext,
}: {
  who: string;
  kind: PetKind;
  tint: PetTint;
  motion: string;
  speak: ReturnType<typeof useSpeech>["speak"];
  quiet: boolean;
  onNext: () => void;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setFilled(true), 300);
    return () => window.clearTimeout(t);
  }, []);
  const row = (label: string, width: string, colour: string, value: string) => (
    <div className="grid grid-cols-[90px_1fr_46px] items-center gap-2 text-xs">
      <span>{label}</span>
      <span className="cw-track flex h-2.5 overflow-hidden rounded-[5px] bg-dash-track">
        <i style={{ width: filled ? width : "0%", background: colour }} />
      </span>
      <b className="text-right tabular-nums text-dash-gold-lit">{value}</b>
    </div>
  );
  return (
    <>
      <div className="flex items-center gap-2.5">
        <Pet kind={kind} tint={tint} size={56} motion={motion} />
        <div className="min-w-0 flex-1">
          <Bubble
            key="moon"
            who={who}
            text="One last thing, and it matters. The goals you set guide us, and we'll make real progress on them. But this is an early village and it changes fast. So you're paid for what you truly got done."
            speak={speak}
            quiet={quiet}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 rounded-[14px] border border-dash-edge bg-card p-3">
        <p className={KICKER}>
          <Trans context="companion welcome">End of Moon, how it adds up</Trans>
        </p>
        <p className="m-0 text-xs text-muted-foreground">
          <Trans context="companion welcome">An example moon:</Trans>
        </p>
        {row("Goal tasks", "80%", "var(--color-dash-gold)", "4 of 5")}
        {row("Extra tasks the village needed", "45%", "var(--color-dash-thanks)", "+3")}
        {row("Your invoice", "100%", "var(--color-dash-voice)", "All 7")}
      </div>
      <div className="cw-fade rounded-[14px] border border-dash-edge bg-dash-raised px-3.5 py-3 text-[15px] text-foreground">
        <p className="m-0">
          <Trans context="companion welcome">Everything you do lands in your tasks, even the ones nobody planned. At End of Moon we add it all up, and if it's far from what you agreed, your pay follows what you actually delivered.</Trans>
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
        <span className="m-0 text-xs text-muted-foreground">
          <Trans context="companion welcome">Goals guide. Tasks show the truth.</Trans>
        </span>
        <button type="button" className={`${BTN_GOLD} !min-h-9 !px-3.5 !py-1.5 !text-[13px]`} onClick={onNext}>
          <Trans context="companion welcome">Got it</Trans>
        </button>
      </div>
    </>
  );
}
