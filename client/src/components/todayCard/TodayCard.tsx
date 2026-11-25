/**
 * TODAY'S CARD, FOR YOURSELF (profile overhaul, Direction D; shared/myCard.ts says what it reads).
 *
 * On your own profile, near the top, a card lies face down. Pull it and it turns over: how the day leans, and
 * what today's sky switches on in your own lines. Pulled on demand, never dealt (the lead's open question,
 * answered with the recommended "on demand"): nothing arrives unasked, and the ephemeris is downloaded only
 * by somebody who pulls. Pull again turns it once more; the same day gives the same card, which is honest.
 *
 * Drawn only for a member who has found their lines and only while the Gene Keys module is on; for
 * everybody else it is absent, not an invitation sitting empty. The turn is a transform that reduced motion
 * skips, landing straight on the face.
 */
import { useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Sparkles, RotateCcw } from "lucide-react";
import { gameFetch } from "@/lib/gameApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, H2, HINT, NOTE } from "@/components/journey/look";
import { MY_CARD_API, type MyCard } from "@shared/myCard";

type State = { kind: "down" } | { kind: "pulling" } | { kind: "up"; card: MyCard } | { kind: "refused"; error: string };

async function pull(): Promise<MyCard> {
  const { skyAt } = await import("@shared/geneKeysSky");
  const res = await gameFetch(MY_CARD_API, { method: "POST", body: JSON.stringify({ sky: skyAt(new Date()) }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body?.error === "string" && /\s/.test(body.error) ? body.error : "");
  return body as MyCard;
}

export default function TodayCard() {
  const { t } = useLingui();
  const base = useId();
  const [hasLines, setHasLines] = useState(false);
  const [state, setState] = useState<State>({ kind: "down" });

  useEffect(() => {
    let live = true;
    gameFetch("/api/gene-keys/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.geneKeys) setHasLines(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!hasLines) return null;

  const go = async () => {
    setState({ kind: "pulling" });
    try {
      setState({ kind: "up", card: await pull() });
    } catch (e) {
      const said = e instanceof Error && e.message ? e.message : t({ message: "The card did not turn. Try again.", context: "today's card: a pull that failed" });
      setState({ kind: "refused", error: said });
    }
  };

  const up = state.kind === "up";

  return (
    <section aria-labelledby={`${base}-h`} className={CARD} data-today-card={up ? "up" : "down"}>
      <p className={EYEBROW}>{t({ message: "Today's card", context: "today's card: eyebrow" })}</p>
      <h2 id={`${base}-h`} className={`mt-1 ${H2}`}>
        {t({ message: "A card for your day", context: "today's card: heading" })}
      </h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-[9rem_1fr] sm:items-start">
        {/* The card itself: face down until pulled, then turned. Decoration only; the words beside it carry it. */}
        <div className="mx-auto [perspective:900px] sm:mx-0" aria-hidden="true">
          <div
            className={`relative h-48 w-36 rounded-xl shadow-sm motion-safe:transition-transform motion-safe:duration-700 [transform-style:preserve-3d] ${up ? "[transform:rotateY(180deg)]" : ""}`}
          >
            <div className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-notice/60 bg-muted [backface-visibility:hidden]">
              <Sparkles className={`h-10 w-10 text-notice ${state.kind === "pulling" ? "motion-safe:animate-pulse" : ""}`} />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-notice bg-card p-3 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="font-display text-4xl text-notice">{up ? state.card.sky.gates.Sun.gate : ""}</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t({ message: "The Sun's gate", context: "today's card: the face of the card" })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3" aria-live="polite">
          {up ? (
            <>
              <p className={NOTE}>{state.card.day}</p>
              <p className="text-base leading-relaxed text-foreground" data-today-card-line="">
                {state.card.line}
              </p>
              <details className="rounded-lg border border-border/60 px-3 py-2">
                <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-foreground">
                  {t({ message: "Today's sky", context: "today's card: the fold under the card" })}
                </summary>
                <p className={`mt-1 ${HINT}`}>{state.card.skyLines["human-design"]}</p>
                <p className={`mt-1 ${HINT}`}>{state.card.skyLines.western}</p>
              </details>
            </>
          ) : (
            <p className={NOTE}>
              {t({ message: "Pull a card and read today's sky against your own lines.", context: "today's card: before the pull" })}
            </p>
          )}
          {state.kind === "refused" ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <p className={HINT}>{t({ message: "A lens, never a forecast.", context: "today's card: under the card" })}</p>
          <div>
            {up ? (
              <button type="button" onClick={() => void go()} className={BTN_SECONDARY}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t({ message: "Pull again", context: "today's card: button" })}
              </button>
            ) : (
              <button type="button" onClick={() => void go()} disabled={state.kind === "pulling"} className={BTN_PRIMARY}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {state.kind === "pulling"
                  ? t({ message: "Turning the card", context: "today's card: button while it pulls" })
                  : t({ message: "Pull today's card", context: "today's card: button" })}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
