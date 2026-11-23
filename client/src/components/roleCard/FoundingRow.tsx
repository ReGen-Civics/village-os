/**
 * ONE OPEN FOUNDING ROLE ON THE TEAM SHEET, CLOSED (FoundingLineup.tsx): its painting, its status pill, its name, its
 * aim, its pay split, the apply-by date and the facts, how full it is, the domains it holds and the related roles it
 * will onboard, with "Read the card". Opened, its card sits inside the same frame (the lead, 21 Nov 2026).
 *
 * THE LOOK THE LEAD CHOSE (23 Nov 2026, after the phase 1 options):
 *   - the painting: on a phone a 4:3 band across the top, the whole subject in frame and the words at the full card
 *     width; from 640px a side panel down the card's left edge, full height and edge to edge, as the Upcoming roles
 *     cards draw theirs. The paintings are 720x960, so both crops stay sharp.
 *   - the status pill says the kind ("Open paid role", "Open role"), and the pay split shows as a thin bar with a
 *     one-line legend in place of the old "Open paid role ·" line (PaySplitMini.tsx); a volunteer role says so.
 *   - b2: the apply-by date on its own outlined tile in the village's true gold (the dash gold, never `notice`, which a
 *     village may tint the colour of its buttons), then circle, commitment and place on one line with their signs.
 *   - b1: the related roles as wrapping chips (lineupParts.tsx).
 */
import type { ReactNode } from "react";
import { ArrowRight, CalendarClock, Clock, MapPin, Users } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { RoleFill } from "@shared/commitmentRange";
import type { ShareNames } from "@shared/contributionToken";
import type { PayShare } from "@shared/roleCardSections";
import ArtImage from "@/components/roleDraft/ArtImage";
import { Domains, FillMeter, OpenPill, ToBeAdded } from "./lineupParts";
import { pillKind, type FrontKind } from "./frontWords";
import PaySplitMini from "./PaySplitMini";

export interface FoundingRowProps {
  id: string;
  name: string;
  aim: string | null;
  art: string | null;
  /** The role's kind for its pill and its split: paid, volunteer, or not said. */
  kind: FrontKind | null;
  /** The pay shape in force (the card's own, else the village's), drawn small for a paid role. */
  payShape: readonly PayShare[];
  shareNames: ShareNames;
  /** "Volunteer role", for a volunteer role. */
  volunteer: string | null;
  applyBy: string | null;
  circle: string | null;
  commitment: string | null;
  where: string | null;
  fill: RoleFill | null;
  seat: Record<string, any>;
  toBeAdded: ReadonlyArray<{ id: string; name: string }>;
  onOpenAdded?: (id: string) => void;
  here: boolean;
  cardSlot: ReactNode;
  onOpen: () => void;
  cardId: string;
}

/**
 * The facts grouped (b2): the apply-by date stands on its own outlined gold tile, the time a reader has, its date never
 * split across lines; circle, commitment and place follow as one quiet line, each with its own sign, at 14px.
 */
export function FactsGrouped({ applyBy, circle, commitment, where }: { applyBy: string | null; circle: string | null; commitment: string | null; where: string | null }) {
  const facts = [
    [Users, circle],
    [Clock, commitment],
    [MapPin, where],
  ].filter((f): f is [typeof Users, string] => !!f[1]);
  if (facts.length === 0 && !applyBy) return null;
  return (
    <div className="mt-3 grid gap-2">
      {applyBy && (
        <p className="inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-dash-gold/70 px-3 py-1.5 text-sm font-semibold text-dash-gold-lit" data-front-apply-by="">
          <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">{applyBy}</span>
        </p>
      )}
      {facts.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-card-foreground" data-front-facts="">
          {facts.map(([Icon, f]) => (
            <li key={f} className="inline-flex items-center gap-1.5">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FoundingRow(p: FoundingRowProps) {
  const { t } = useLingui();
  const frame = `rounded-2xl border-2 bg-card shadow-sm ${p.here && p.cardSlot ? "border-notice" : "border-notice/50"}`;
  return (
    <li className={`overflow-hidden ${frame}`} data-role-frame={p.id}>
      <div className={`grid sm:grid-cols-[13rem_minmax(0,1fr)] ${p.here ? "bg-notice/10" : ""}`}>
        <div className="relative aspect-[4/3] border-b border-notice/30 sm:aspect-auto sm:min-h-full sm:border-b-0 sm:border-r">
          <ArtImage portrait src={p.art} className="absolute inset-0" imgClassName="object-[50%_35%]" />
        </div>
        <div className="grid min-w-0 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <OpenPill kind={pillKind(p.kind)} />
            {/* A heading, so a screen reader can move from role to role (the group's heading is an h2). */}
            <h3 className="mt-1 font-display text-2xl leading-snug text-card-foreground sm:text-3xl">{p.name}</h3>
            {p.aim ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.aim}</p> : null}
            {p.kind === "paid" && <PaySplitMini shape={p.payShape} names={p.shareNames} className="mt-2.5" />}
            {p.volunteer && (
              <p className="mt-1.5 text-sm font-semibold text-card-foreground" data-front-kind="">
                {p.volunteer}
              </p>
            )}
            <FactsGrouped applyBy={p.applyBy} circle={p.circle} commitment={p.commitment} where={p.where} />
            {p.fill && <FillMeter f={p.fill} />}
            <Domains seat={p.seat} />
            <ToBeAdded roles={p.toBeAdded} onOpen={p.onOpenAdded} />
          </div>
          <button
            type="button"
            onClick={p.onOpen}
            aria-expanded={p.here}
            aria-controls={p.cardId}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-notice bg-notice px-4 font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-auto"
            data-founding-role={p.id}
          >
            {t({ message: "Read the card", context: "team sheet: open this role's card" })}
            <span className="sr-only">{`: ${p.name}`}</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {p.here && p.cardSlot ? (
        <div className="p-2 sm:p-3" data-card-inline="">
          {p.cardSlot}
        </div>
      ) : null}
    </li>
  );
}
