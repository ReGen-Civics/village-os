/**
 * SEVERAL PAY SUGGESTIONS, TICKED BY HAND, SET ONE ROLE AT A TIME.
 *
 * Rye, 28 Nov 2026, on Sera's pay and new-role suggestions: "Can manually
 * select multiple." A pay row is ticked by hand, never by "Tick all shown",
 * and the bar's "Set pay for N roles" opens this walk:
 *
 *   1. Every ticked role is listed by name with what Sera lists for it, as the
 *      list itself words it, before any setter opens.
 *   2. Each role opens in turn in its own pay setter (the one a single pay row
 *      opens), handed that role's figure and its stored estimate.
 *   3. The end says what happened to each role.
 *
 * There is NO BATCH WRITE. Each role is its own act through the pay route,
 * with its own record, its own check against the band, and its own second
 * signer where that rule applies. A role the person skips has nothing sent.
 * Leaving the walk at any point sends nothing more.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { SeraActs } from "@/components/review/useSeraActs";
import { seraPayFromRow } from "@/lib/seraPay";
import { primary, secondary } from "@/components/review/seraStyles";

const SeraPaySetter = lazy(() => import("@/components/review/SeraPaySetter"));

/** What the pay route answered for one role, or that the person moved on without sending. */
type Outcome = "set" | "awaiting_second" | "village" | "skipped";

export default function SeraPayWalk({ acts, agent }: { acts: SeraActs; agent: string }) {
  const { t } = useLingui();
  const rows = acts.payWalk;
  // Before the first role: -1. Past the last: the summary.
  const [at, setAt] = useState(-1);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const walkKey = rows ? rows.map((d) => d.key).join("|") : "";
  // A walk that opens starts at its list, with nothing recorded.
  useEffect(() => {
    setAt(-1);
    setOutcomes({});
  }, [walkKey]);

  if (!rows || rows.length === 0) return null;
  const n = rows.length;
  const row = at >= 0 && at < n ? rows[at] : null;
  const done = at >= n;
  const said = row ? outcomes[row.key] : undefined;
  const first = rows[0].subject.name;
  const step = at + 1;
  const name = row?.subject.name ?? "";
  const next = () => {
    if (row && !outcomes[row.key]) setOutcomes((o) => ({ ...o, [row.key]: "skipped" }));
    setAt((i) => i + 1);
  };
  const resultWords = (who: string, outcome: Outcome | undefined): string =>
    outcome === "set"
      ? t({ message: `${who}: pay is set.`, context: "sera pay" })
      : outcome === "awaiting_second"
        ? t({ message: `${who}: waiting for a second signer. Its pay stays as it is until they sign.`, context: "sera pay" })
        : outcome === "village"
          ? t({ message: `${who}: nobody else can sign this figure, so it goes to the village.`, context: "sera pay" })
          : t({ message: `${who}: skipped. Nothing was sent.`, context: "sera pay" });

  return (
    <Sheet open onOpenChange={(open) => !open && acts.closePayWalk()}>
      <SheetContent
        side="bottom"
        overlayClassName="z-[70]"
        className="z-[70] max-h-[92vh] overflow-y-auto md:left-1/2 md:right-auto md:bottom-6 md:-translate-x-1/2 md:w-[680px] md:rounded-2xl bg-card rounded-t-2xl px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] gap-3 text-card-foreground [overflow-wrap:anywhere]"
      >
        <div data-testid="pay-walk" className="flex flex-col gap-3">
          <SheetTitle className="text-[19px] leading-snug font-bold text-foreground pr-8">
            {n === 1 ? <Trans context="sera pay">Set pay for 1 role</Trans> : <Trans context="sera pay">Set pay for {n} roles, one at a time</Trans>}
          </SheetTitle>
          <SheetDescription className="text-[15px] leading-normal text-muted-foreground">
            <Trans context="sera pay">Each role is set on its own, in its own pay setter. Nothing is sent until you press Set this role's pay there.</Trans>
          </SheetDescription>

          {at < 0 && (
            <>
              <ul className="flex flex-col gap-2 text-[15px] leading-normal text-foreground">
                {rows.map((d) => (
                  <li key={d.key} data-testid="pay-walk-line" className="rounded-lg border border-border px-3 py-2">
                    <span className="block font-semibold">{d.subject.name}</span>
                    <span className="block text-muted-foreground">{d.words.sentence}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setAt(0)} className={`${primary} min-h-[48px] text-[15px]`}>
                  <Trans context="sera pay">Start with {first}</Trans>
                </button>
                <button type="button" onClick={() => acts.closePayWalk()} className={`${secondary} min-h-[48px] text-[15px]`}>
                  <Trans context="sera pay">Not now</Trans>
                </button>
              </div>
            </>
          )}

          {row && row.subject.ourId && (
            <>
              <p className="text-[15px] font-semibold text-foreground">
                <Trans context="sera pay">Role {step} of {n}: {name}</Trans>
              </p>
              <div className="rounded-xl border border-border p-3">
                <Suspense fallback={<p className="text-[13px] text-muted-foreground"><Trans context="sera pay">Opening this role's pay.</Trans></p>}>
                  <SeraPaySetter
                    key={row.key}
                    role={{ id: row.subject.ourId, name: row.subject.name }}
                    sera={seraPayFromRow(row, agent)}
                    onOutcome={(state) => setOutcomes((o) => ({ ...o, [row.key]: state }))}
                  />
                </Suspense>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={next} className={`${said ? primary : secondary} min-h-[48px] text-[15px]`}>
                  {said ? (step === n ? <Trans context="sera pay">Finish</Trans> : <Trans context="sera pay">Next role</Trans>) : <Trans context="sera pay">Skip this role</Trans>}
                </button>
              </div>
            </>
          )}

          {done && (
            <>
              <ul className="pl-5 list-disc flex flex-col gap-2 text-[15px] leading-normal text-foreground">
                {rows.map((d) => (
                  <li key={d.key} data-testid="pay-walk-result">{resultWords(d.subject.name, outcomes[d.key])}</li>
                ))}
              </ul>
              <button type="button" onClick={() => acts.closePayWalk()} className={`${primary} min-h-[48px] text-[15px]`}>
                <Trans context="sera pay">Back to the list</Trans>
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
