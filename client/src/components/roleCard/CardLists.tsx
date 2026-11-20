/**
 * THE CARD'S LISTS THAT SIT IN PIECES A READER OPENS (the lead, Anchor session of 19 Nov 2026): the rhythm,
 * grouped by cadence, and the "Once you're selected" steps. Loaded lazily by the role card, so neither rides
 * the first view of /roles (scripts/route-first-view.json).
 */
import { lazy, Suspense, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { splitLine } from "@shared/rolePieces";
import type { Deliverable } from "@shared/roleDeliverables";

const DeliverablesGantt = lazy(() => import("./DeliverablesGantt"));

/** The rhythm: "Weekly: ..." lines group under their cadence, in the order each cadence first appears, as bullets. */
export function rhythmGroups(lines: readonly string[]): Array<{ cadence: string | null; items: string[] }> {
  const out: Array<{ cadence: string | null; items: string[] }> = [];
  for (const l of lines) {
    const s = splitLine(l);
    const key = s.title ?? null;
    const g = out.find((x) => (x.cadence ?? "").toLowerCase() === (key ?? "").toLowerCase());
    if (g) g.items.push(s.body);
    else out.push({ cadence: key, items: [s.body] });
  }
  return out;
}

export function Rhythm({ lines }: { lines: string[] }) {
  return (
    <ul className="grid gap-3">
      {rhythmGroups(lines).map((g, k) => (
        <li key={k} className="grid gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0 @xl:grid-cols-[8rem_minmax(0,1fr)] @xl:gap-4">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-notice">
            {g.cadence && <CalendarDays className="size-3.5" aria-hidden="true" />}
            {g.cadence ?? ""}
          </span>
          <ul className="list-disc space-y-1 pl-5 leading-relaxed marker:text-notice">
            {g.items.map((it, n) => (
              <li key={n} className="text-card-foreground">{it}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}


/** The onboarding steps, numbered, each "Label: words" line with its label as the step's title. */
export function OnboardingSteps({ lines, plain = false }: { lines: string[]; plain?: boolean }) {
  if (plain) {
    return (
      <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed marker:text-notice" data-testid="onboarding">
        {lines.map((l, k) => (
          <li key={k}>{l}</li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="grid gap-2.5" data-testid="onboarding">
      {lines.map((l, k) => {
        const s = splitLine(l);
        return (
          <li key={k} className="flex min-w-0 gap-3 rounded-xl border border-border bg-muted p-3.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card font-display text-notice" aria-hidden="true">{k + 1}</span>
            <span className="min-w-0 leading-snug text-card-foreground">
              {s.title ? (
                <>
                  <span className="block font-semibold">{s.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{s.body}</span>
                </>
              ) : (
                s.body
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The directory card's new blocks (the game register): Deliverables and the village's sessions near the top,
 * the onboarding steps at the end. The host hands its own `block` so the headings match the card's.
 */
export function GameCardExtras({ part, deliverables, rhythm, onboarding, block }: { part: "top" | "end"; deliverables: Deliverable[]; rhythm: string[]; onboarding: string[]; block: (heading: string, testId: string, body: ReactNode) => ReactNode }) {
  const { t } = useLingui();
  if (part === "end") return onboarding.length ? <>{block(t({ message: "Once you're selected", context: "role card: the onboarding steps" }), "onboarding-block", <OnboardingSteps lines={onboarding} plain />)}</> : null;
  const title = t({ message: "Deliverables", context: "role card: the dated outcomes" });
  return (
    <>
      {deliverables.length > 0 &&
        block(
          title,
          "deliverables",
          <Suspense fallback={null}>
            <DeliverablesGantt rows={deliverables} label={title} />
          </Suspense>,
        )}
      {rhythm.length > 0 && block(t({ message: "Sessions everyone attends", context: "role card: the village's shared sessions" }), "shared-rhythm", <Rhythm lines={rhythm} />)}
    </>
  );
}
