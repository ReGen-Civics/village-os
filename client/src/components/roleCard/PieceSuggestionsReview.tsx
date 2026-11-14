/**
 * WHAT THE APPLICANT WOULD MAKE OF THE ROLE, as the people deciding read it (Rye, 14 Nov 2026;
 * approved mockup B, "what the deciders see").
 *
 * The role's card with every piece open, and the applicant's suggestions under the piece they are
 * about. Read-only. The applicant's own words, as they wrote them: nothing summarises, scores or
 * ranks them, and no AI reads them (coordinator, 14 Nov). A role the village no longer lists still
 * shows its suggestions, grouped by piece.
 */
import { lazy, Suspense } from "react";
import { useLingui } from "@lingui/react/macro";
import { PIECE_KEYS, PIECE_NAMES, type PieceKey, type PieceSuggestion } from "@shared/pieceSuggestions";
import { SuggestionLine } from "./ShapeTheRole";
import { useOrgSeats } from "./useOrgSeat";

// The card loads only when it is opened, so the pages that mount this keep their own chunks and the
// first page never gains the card's imports (guard-boot-set, 14 Nov).
const FullRoleCard = lazy(() => import("./FullRoleCard"));

function Lines({ list }: { list: PieceSuggestion[] }) {
  return (
    <ul className="grid gap-2">
      {list.map((s, i) => (
        <SuggestionLine key={i} s={s} />
      ))}
    </ul>
  );
}

export default function PieceSuggestionsReview({ suggestions, roles }: { suggestions: PieceSuggestion[] | null | undefined; roles: Array<{ id: string; name: string | null }> }) {
  const { t } = useLingui();
  const list = suggestions ?? [];
  const roleIds = Array.from(new Set(list.map((s) => s.roleId)));
  const seats = useOrgSeats(roleIds);
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="op-shape" className="grid gap-3" data-testid="piece-suggestions-review">
      <h2 id="op-shape" className="text-lg font-bold text-foreground">
        {t({ message: "What they would make of the role", context: "open proposal: the applicant's suggestions on the role card" })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t({ message: "Their own words, beside each piece of the role card they are about. Nothing here is scored or summarised.", context: "open proposal: suggestions lede" })}
      </p>
      {roleIds.map((roleId) => {
        const mine = list.filter((s) => s.roleId === roleId);
        const found = seats[roleId];
        const name = roles.find((r) => r.id === roleId)?.name ?? null;
        if (found && found !== "missing") {
          return (
            <Suspense key={roleId} fallback={<Lines list={mine} />}>
            <FullRoleCard
              seat={found.seat}
              circleName={found.circleName}
              register="founding"
              lifted
              noAct
              allPieces
              after={(piece) => {
                const here = mine.filter((s) => s.piece === piece);
                return here.length ? <Lines list={here} /> : null;
              }}
            />
            </Suspense>
          );
        }
        return (
          <div key={roleId} className="rounded-xl border border-border bg-card p-4" data-suggestions-flat={roleId}>
            {name && <p className="font-semibold text-foreground">{name}</p>}
            {PIECE_KEYS.filter((k: PieceKey) => mine.some((s) => s.piece === k)).map((k) => (
              <div key={k} className="mt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-notice">{PIECE_NAMES[k]}</h3>
                <Lines list={mine.filter((s) => s.piece === k)} />
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
