/**
 * "VALUE IN EQUALS VALUE OUT." (lead, 17 Nov 2026): a callout on the Rewards piece, beside the listed price
 * and the band, with an info control that opens a short explainer.
 *
 * A disclosure popover, never a hover tooltip, so it works on a phone and from a keyboard: a tap, a click,
 * Enter or Space opens and closes it; Escape closes it and puts focus back on the control; a tap outside
 * closes it. The panel opens in the flow under the callout, so it never runs off a narrow screen.
 * Words in valueExplainerWords.ts. Loaded lazily by FullRoleCard, so none of this rides a route's first view.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { valueExplainerWords } from "./valueExplainerWords";
import { MoonText } from "@/components/MoonWord";
import { ContributionText, useShareNames } from "@/components/ContributionWord";

export default function ValueCallout() {
  const { t, i18n } = useLingui();
  const words = valueExplainerWords(i18n, undefined, undefined, useShareNames().equity);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();
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
      <div className="flex items-center justify-between gap-3">
        <p id={headingId} className="font-display text-lg leading-snug text-card-foreground">
          {words.callout}
        </p>
        <button
          ref={control}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={words.open}
          onClick={() => setOpen((o) => !o)}
          className="jw-btn inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-notice hover:bg-notice/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="value-explainer-open"
        >
          <Info className="size-5" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div id={panelId} role="region" aria-labelledby={headingId} className="mt-2 mb-2 rounded-xl border border-border bg-card p-4 shadow-sm" data-testid="value-explainer">
          <div className="flex flex-col gap-3">
            {words.parts.map((p) => (
              <section key={p.key} data-explainer-part={p.key}>
                <p className="text-xs font-semibold uppercase tracking-widest text-notice">{p.heading}</p>
                <p className="mt-1 leading-relaxed text-card-foreground">
                  {p.key === "aim" ? <ContributionText text={p.text} /> : <MoonText text={p.text} />}
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
