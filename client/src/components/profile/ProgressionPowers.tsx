/**
 * "YOUR PROGRESSION": the groups you are in, the few powers that matter most
 * to you, and everything else one tap away (Rye, 14 Nov 2026).
 *
 * This was a wall of thirty identical chips. Now the top few (the rule is in
 * powerKinds.ts, and the card says it in one line) sit as tiles with an
 * icon for the kind of thing each lets you do, and "Show me everything" opens
 * the full list grouped by kind. Nothing here counts, ranks or scores anyone.
 */
import { useLingui } from "@lingui/react/macro";
import { ChevronDown, MessageCircle, type LucideIcon } from "lucide-react";
import { CouncilCircle, MushroomNetwork, SeedGlint, SeedPin, SeedPod, TendingHands } from "@/components/sacred/living";
import { capabilityLabel } from "@shared/capabilities";
import { powerGroups, powerKindOf, topPowers, type CatalogueRowLike, type PowerKind, type StageTurnLike } from "./powerKinds";

const ICON: Record<PowerKind, LucideIcon> = {
  talk: MessageCircle,
  decide: CouncilCircle,
  people: MushroomNetwork,
  place: SeedPin,
  value: SeedPod,
  keep: TendingHands,
};

const EYEBROW = "mb-2 text-xs font-semibold uppercase tracking-wide text-dash-gold-lit";

export default function ProgressionPowers({
  groups,
  held,
  catalogue,
  history,
}: {
  groups: ReadonlyArray<{ id: string; name: string }>;
  held: readonly string[];
  catalogue: readonly CatalogueRowLike[];
  history: readonly StageTurnLike[];
}) {
  const { t } = useLingui();
  const kindWords: Record<PowerKind, string> = {
    talk: t({ message: "Talk and share", context: "progression: a kind of power" }),
    decide: t({ message: "Decide together", context: "progression: a kind of power" }),
    people: t({ message: "People and roles", context: "progression: a kind of power" }),
    place: t({ message: "Places and gatherings", context: "progression: a kind of power" }),
    value: t({ message: "Work and value", context: "progression: a kind of power" }),
    keep: t({ message: "Keeping the village running", context: "progression: a kind of power" }),
  };
  const top = topPowers(held, catalogue, history);
  const rest = held.length > top.length;
  const grouped = powerGroups(held);

  return (
    <div className="mb-5 space-y-5" data-progression-powers="">
      {groups.length > 0 && (
        /* GROUPS, NOT THE WORK ROLES. These are the standing groups; "Your roles" is the work. */
        <div>
          <p className={EYEBROW}>{t({ message: "Groups you are in", context: "progression: the standing groups heading" })}</p>
          <ul className="flex flex-wrap gap-2">
            {groups.map((r) => (
              <li key={r.id} title={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-notice/60 bg-muted px-3 py-1 text-sm font-medium text-notice">
                <MushroomNetwork className="h-3.5 w-3.5" aria-hidden="true" /> {r.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {held.length > 0 && (
        <div>
          <p className={EYEBROW}>{t({ message: "What you can do", context: "progression: the powers heading" })}</p>
          <p className="mb-3 text-sm text-muted-foreground">
            {t({ message: "First what your roles and groups hand you, then what opened most recently.", context: "progression: why these powers come first" })}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2" data-progression-top="">
            {top.map((key) => {
              const kind = powerKindOf(key);
              const Icon = ICON[kind];
              return (
                <li key={key} title={key} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-deep/15 text-notice" aria-hidden="true">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-card-foreground">{capabilityLabel(key)}</span>
                    <span className="block text-xs text-muted-foreground">{kindWords[kind]}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          {rest && (
            <details className="group mt-3" data-progression-everything="">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-notice [&::-webkit-details-marker]:hidden">
                <SeedGlint className="h-4 w-4" aria-hidden="true" />
                {t({ message: "Show me everything", context: "progression: opens every power, grouped" })}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {grouped.map(({ kind, keys }) => {
                  const Icon = ICON[kind];
                  return (
                    <section key={kind} aria-label={kindWords[kind]} className="rounded-xl border border-border/60 p-3">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                        <Icon className="h-4 w-4 text-notice" aria-hidden="true" />
                        {kindWords[kind]}
                      </h3>
                      <ul className="space-y-1.5">
                        {keys.map((key) => (
                          <li key={key} title={key} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-notice/70" aria-hidden="true" />
                            {capabilityLabel(key)}
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
