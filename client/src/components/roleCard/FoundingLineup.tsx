/**
 * THE FOUNDING TEAM AS POSITIONS (Rye, 14 Nov 2026: "showing the open roles more like showing the
 * positions on an epic team (think fantasy sports)"; approved mockup C,
 * https://claude.ai/artifact/NaavCsufyAEHKowgEdKFAX. Rye: "Both, defaulting to team sheet, with
 * both as options so I can get broader feedback").
 *
 * Two ways to draw the same team, chosen by the reader:
 *   - the TEAM SHEET (default): the open roles first, each a row with its art, "Open role", its
 *     name, its aim, a few facts and the domains it holds, then the filled roles of the same circle;
 *   - the FORMATION: the circle as one ring, the open roles and the roles held now together, each
 *     open role with the domains it holds.
 *
 * POSITIONS, NEVER PLAYERS. No stats, ratings, rankings or comparisons of people, and no AI picks
 * anyone (standing ruling). A filled role names its holder as "Role (FirstName)" only when the
 * village shows names to this reader; otherwise it says "Filled". The glow marks an open role.
 *
 * ONE CIRCLE, DOMAINS NOT SUB-CIRCLES (Rye, 14 Nov 2026): "really should just be Anchor as that's our
 * only and starting circle for now ... Less 'circles they grow' and more 'domains they hold'." Each open
 * role shows the domains it holds, from its own domain words (shared/rolePieces.ts). Nothing here
 * implies hiring or building a circle: "we're aiming to stay lean with the roles and lean more into
 * quests and other ways to co-create".
 *
 * BACK ON /roles (the lead, 21 Nov 2026): 1.3.42 replaced this with compact index cards, which was not asked for.
 * The approved design is back with two changes the lead did ask for: the page's groups in their new order (the
 * roles held now and the coming-soon roles are drawn by the page, below Open ventures, so the sheet holds only
 * the open roles), and each role one framed panel, its card opening inside its own frame, so a reader always
 * knows which role they are reading. A lead role names the roles still to come under it in one line.
 */
import { lazy, Suspense, type ReactNode } from "react";
import { LayoutList, Target } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { RoleFill } from "@shared/commitmentRange";
import { applyByParts, frontKind, pillKind, volunteerLine } from "./frontWords";
import { cardPay, NO_VILLAGE_PAY, type VillagePay } from "@shared/roleCardSections";
import { useShareNames } from "@/components/ContributionWord";
import { roleCardView } from "@shared/roleCardView";
import { commitmentLabel } from "./rewardWords";
import { roleArtFor } from "@shared/roleDraft";
import { useRoleArt } from "@/lib/natureArt";
import { seedOfLifeCentres, fx } from "@/components/journey/nature";
import ArtImage from "@/components/roleDraft/ArtImage";
import type { FoundingRole } from "./FoundingTeam";
import { Domains, FillMeter, OpenPill } from "./lineupParts";
import FoundingRow from "./FoundingRow";
import type { FilledRole, LineupView } from "./RosterCards";

export type { FilledRole, LineupView };

// The roster sits below the open roles, so its cards load after the page's first view (route-first-view.json).
const RosterList = lazy(() => import("./RosterCards"));

const archetypesOf = (seat: Record<string, any>): string[] => (Array.isArray(seat?.archetypes) ? seat.archetypes.map(String) : []);
const characterArtOf = (seat: Record<string, any>) => roleArtFor({ archetypes: archetypesOf(seat), raw: seat });

export interface FoundingLineupProps {
  roles: FoundingRole[];
  filled: FilledRole[];
  /** How full each role is, by id (Rye, 14 Nov 2026, ruling 4). */
  fill?: Record<string, RoleFill>;
  view: LineupView;
  onView: (v: LineupView) => void;
  /** The open card's role id, if any. */
  shown: string | null;
  onOpen: (roleId: string) => void;
  cardId: string;
  /** The org chart beside the roster (Rye, 16 Nov 2026): a picture in picture of /circles, one link into it. */
  orgPreview?: ReactNode;
  /** The coming-soon roles and their waitlist (the lead, 19 Nov 2026): under the open roles, above the roles held now. */
  comingSoon?: ReactNode;
  /** The open card's slot. On the team sheet it opens inside its own role's frame, so the reader stays where they clicked. */
  cardSlot?: ReactNode;
  /** The group's heading, "Open roles (n)", drawn above the tally (the lead, 20 Nov 2026: the page's groups). */
  heading?: ReactNode;
  /** The roles still to come under each lead role, by the lead's id: one line in its row (the lead, 21 Nov 2026). */
  toBeAdded?: Record<string, ReadonlyArray<{ id: string; name: string }>>;
  /** Opens one of those roles where the page shows it. */
  onOpenAdded?: (id: string) => void;
  /** Whether the team sheet draws the roles held now. The /roles page draws them itself, below its other groups. */
  sheetRoster?: boolean;
  /** The village's pay shape, for the front's pay mix where a card writes none of its own (the lead, 23 Nov 2026). */
  villagePay?: VillagePay | null;
}

export default function FoundingLineup({ roles, filled, fill = {}, view, onView, shown, onOpen, cardId, orgPreview = null, comingSoon = null, cardSlot = null, heading = null, toBeAdded = {}, onOpenAdded, sheetRoster = true, villagePay = null }: FoundingLineupProps) {
  const roleArt = useRoleArt();
  const artOf = (seat: Record<string, any>) => roleArt(seat?.id) ?? characterArtOf(seat);
  const { t, i18n } = useLingui();
  const shareNames = useShareNames();
  const circle = roles[0]?.circleName ?? null;

  const toggle = (
    <div className="inline-flex overflow-hidden rounded-xl border border-border" role="group" aria-label={t({ message: "How to show the team", context: "founding team view switch" })}>
      {(
        [
          ["sheet", LayoutList, t({ message: "Team sheet", context: "founding team view: a list of roles" })],
          ["formation", Target, t({ message: "Formation", context: "founding team view: the team drawn in rings" })],
        ] as const
      ).map(([v, Icon, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onView(v)}
          className={`inline-flex min-h-11 items-center gap-1.5 px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${view === v ? "bg-muted text-card-foreground" : "text-muted-foreground hover:text-card-foreground"}`}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );

  const tally = (
    <ul className="flex flex-wrap gap-2 text-xs font-semibold text-card-foreground" data-testid="lineup-tally">
      <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1">
        <span className="size-2 rounded-full bg-notice" aria-hidden="true" />
        {t({ message: `${roles.length} open`, context: "founding team tally: open roles" })}
      </li>
      {filled.length > 0 && (
        <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1">
          <span className="size-2 rounded-full bg-muted-foreground" aria-hidden="true" />
          {t({ message: `${filled.length} filled`, context: "founding team tally: filled roles" })}
        </li>
      )}
    </ul>
  );

  return (
    <div className="flex flex-col gap-5" data-lineup={view}>
      {heading}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tally}
        {toggle}
      </div>
      {view === "sheet" ? (
        <div className="flex flex-col gap-3" data-testid="team-sheet">
          {!heading && <p className="text-xs font-bold uppercase tracking-widest text-notice">{t({ message: "Open now", context: "team sheet group" })}</p>}
          {/* ONE FRAME PER ROLE (the lead, 21 Nov 2026): the row and, once opened, its card sit inside one bordered
              panel, with a wide gap to the next, so a reader always knows which role they are in. */}
          <ul className="grid gap-8">
            {roles.map((r) => {
              const id = String(r.seat.id);
              const here = shown === id;
              // The card's own words for where (sections.where) win over the fixed label, as on the opened card.
              const whereWords = r.sections?.where?.trim();
              const tileSeat = whereWords ? { ...r.seat, card: { ...(r.seat.card ?? {}), whereText: whereWords } } : r.seat;
              const where = roleCardView(tileSeat).rows.find((row) => row.id === "where")?.lines[0] ?? null;
              // The front's kind (its pill) and pay split, never an amount, and the last day to apply (the lead, 23 Nov 2026).
              const kind = frontKind(r.seat, r.sections);
              const applyBy = applyByParts(i18n, r.sections?.applyBy);
              return (
                <FoundingRow
                  key={id}
                  id={id}
                  name={String(r.seat.name ?? "")}
                  aim={typeof r.seat.aim === "string" && r.seat.aim ? r.seat.aim : null}
                  art={artOf(r.seat)}
                  kind={kind}
                  payShape={cardPay(r.sections, villagePay ?? NO_VILLAGE_PAY)?.shape ?? []}
                  shareNames={shareNames}
                  volunteer={volunteerLine(i18n, kind)}
                  applyBy={applyBy}
                  circle={r.circleName}
                  commitment={commitmentLabel(i18n, r.seat) || (typeof r.seat.timeCommitment === "string" ? r.seat.timeCommitment : null)}
                  where={where}
                  fill={fill[id] ?? null}
                  seat={r.seat}
                  toBeAdded={toBeAdded[id] ?? []}
                  onOpenAdded={onOpenAdded}
                  here={here}
                  cardSlot={cardSlot}
                  onOpen={() => onOpen(id)}
                  cardId={cardId}
                />
              );
            })}
          </ul>
          {comingSoon}
          {sheetRoster && filled.length > 0 && (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-notice">{t({ message: "Holding it now", context: "team sheet group: the roles held now" })}</p>
              <div className={`grid gap-4 ${orgPreview ? "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : ""}`}>
                {/* First in the page order, so a phone meets the door to the org chart above the cards. */}
                {orgPreview && <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1" data-org-preview="">{orgPreview}</div>}
                <Suspense fallback={null}>
                  <RosterList filled={filled} team={circle} variant="sheet" className={`grid gap-3 sm:grid-cols-2 ${orgPreview ? "lg:col-start-1 lg:row-start-1 xl:grid-cols-3" : "lg:grid-cols-3"}`} />
                </Suspense>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-notice/40 bg-[radial-gradient(ellipse_at_50%_30%,var(--muted),transparent_70%)] px-3 py-8 sm:px-6" data-testid="formation">
          <svg viewBox="0 0 120 120" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-4 size-[34rem] -translate-x-1/2 text-notice opacity-15">
            {seedOfLifeCentres(60, 60, 20).map((c, i) => (
              <circle key={i} cx={fx(c.x)} cy={fx(c.y)} r={20} fill="none" stroke="currentColor" strokeWidth={0.3} />
            ))}
            <circle cx={60} cy={60} r={40} fill="none" stroke="currentColor" strokeWidth={0.3} />
          </svg>
          {circle && <p className="relative mb-6 text-center font-display text-2xl text-card-foreground">{circle}</p>}
          <ul className="relative flex flex-wrap justify-center gap-x-5 gap-y-8">
            {roles.map((r) => {
              const id = String(r.seat.id);
              const here = shown === id;
              return (
                <li key={id} className="flex w-56 flex-col items-center gap-2 text-center">
                  <button
                    type="button"
                    onClick={() => onOpen(id)}
                    aria-expanded={here}
                    aria-controls={cardId}
                    className="group flex flex-col items-center gap-2 rounded-2xl text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    data-founding-role={id}
                  >
                    <span className={`relative rounded-full bg-gradient-to-br from-notice/40 via-notice to-notice/40 p-[3px] shadow-[0_0_28px] shadow-notice/40 motion-safe:transition-transform motion-safe:group-hover:-translate-y-1 ${here ? "outline-2 outline-offset-4 outline-notice" : ""}`}>
                      <ArtImage portrait src={artOf(r.seat)} className="relative size-24 rounded-full" imgClassName="object-top" />
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <OpenPill kind={pillKind(frontKind(r.seat, r.sections))} />
                      </span>
                    </span>
                    <span className="mt-2 font-semibold leading-snug text-card-foreground">{String(r.seat.name ?? "")}</span>
                  </button>
                  {commitmentLabel(i18n, r.seat) && <p className="text-sm text-muted-foreground" data-commitment-label="">{commitmentLabel(i18n, r.seat)}</p>}
                  {fill[id] && <FillMeter f={fill[id]} center />}
                  <Domains seat={r.seat} center />
                </li>
              );
            })}
          </ul>
          {comingSoon && <div className="relative mx-auto mt-10 max-w-3xl text-left">{comingSoon}</div>}
          {filled.length > 0 && (
            <>
              <p className="relative mb-5 mt-10 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                {t({ message: "Holding it now", context: "formation: the roles held now" })}
              </p>
              <Suspense fallback={null}>
                <RosterList filled={filled} team={circle} variant="formation" className="relative grid grid-cols-2 justify-items-center gap-x-3 gap-y-6 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-5" />
              </Suspense>
              {orgPreview && <div className="relative mx-auto mt-8 w-full max-w-sm lg:max-w-xs" data-org-preview="">{orgPreview}</div>}
            </>
          )}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {t({ message: "A role shows the work it holds. Nothing here rates or compares people.", context: "founding team: the no-stats line" })}
      </p>
    </div>
  );
}
