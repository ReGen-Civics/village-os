/**
 * "VALUE IN EQUALS VALUE OUT." (lead, 17 Nov 2026): a callout on the Rewards piece, beside the listed price
 * and the band. The callout's own words are the control that opens a short explainer, with the dotted underline
 * every explained word wears (the lead, 27 Nov 2026: "tooltips should be on the word not next to it"); the round
 * (i) button that sat beside them is gone. "How rewards are set" is the control's description.
 *
 * A disclosure popover, never a hover tooltip, so it works on a phone and from a keyboard: a tap, a click,
 * Enter or Space opens and closes it; Escape closes it and puts focus back on the control; a tap outside
 * closes it. The panel opens in the flow under the callout, so it never runs off a narrow screen.
 * Words in valueExplainerWords.ts. Loaded lazily by FullRoleCard, so none of this rides a route's first view.
 */
import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { valueExplainerWords } from "./valueExplainerWords";
import { MoonText } from "@/components/MoonWord";
import { TokenText, useShareNames } from "@/components/ContributionWord";

export default function ValueCallout() {
  const { t, i18n } = useLingui();
  const words = valueExplainerWords(i18n, undefined, undefined, useShareNames().equity);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const hintId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      control.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={wrap} className="rounded-xl border border-notice/50 bg-muted px-4 py-2" data-testid="value-callout">
      <p id={headingId} className="font-display text-lg leading-snug text-card-foreground">
        <button
          ref={control}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-describedby={hintId}
          onClick={() => setOpen((o) => !o)}
          // The whole line inside the box is the control, 44px tall with the words centred as before, so the target is no
          // smaller than the round button it replaced and nothing around it moves (QA round 2, 27 Nov 2026).
          className="info-word info-word-block flex w-full min-h-11 items-center text-left"
          data-testid="value-explainer-open"
        >
          {words.callout}
        </button>
        <span id={hintId} hidden>
          {words.open}
        </span>
      </p>
      {open && (
        <div id={panelId} role="region" aria-labelledby={headingId} className="mt-2 mb-2 rounded-xl border border-border bg-card p-4 shadow-sm" data-testid="value-explainer">
          <div className="flex flex-col gap-3">
            {words.parts.map((p) => (
              <section key={p.key} data-explainer-part={p.key}>
                <p className="text-xs font-semibold uppercase tracking-widest text-notice">{p.heading}</p>
                <p className="mt-1 leading-relaxed text-card-foreground">
                  {p.key === "aim" ? <TokenText text={p.text} /> : <MoonText text={p.text} />}
                </p>
              </section>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              control.current?.focus();
            }}
            className="jw-btn mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            data-testid="value-explainer-close"
          >
            <X className="size-4" aria-hidden="true" />
            {t({ message: "Close", context: "role card rewards explainer: close" })}
          </button>
        </div>
      )}
    </div>
  );
}
