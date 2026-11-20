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
 */
import { Fragment, lazy, Suspense, type ReactNode } from "react";
import { ArrowRight, LayoutList, Sprout, Target } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { RoleFill } from "@shared/commitmentRange";
import { fillLine } from "./cardWordsT";
import { roleCardView } from "@shared/roleCardView";
import { roleArtFor } from "@shared/roleDraft";
import { domainsHeld } from "@shared/rolePieces";
import { seedOfLifeCentres, fx } from "@/components/journey/nature";
import ArtImage from "@/components/roleDraft/ArtImage";
import type { FoundingRole } from "./FoundingTeam";

export type LineupView = "sheet" | "formation";

// The roster sits below the open roles, so its cards load after the page's first view (route-first-view.json).
const RosterList = lazy(() => import("./RosterCards"));

/** A role of the founding circle that someone holds. */
export interface FilledRole {
  id: string;
  name: string;
  /** Holders' names as the village shows them to this reader; empty when it shows none. */
  holders: string[];
  /** Still recruiting (the lead, 17 Nov 2026): the roster keeps it as held and offers Apply beside it. */
  recruiting?: boolean;
}

const archetypesOf = (seat: Record<string, any>): string[] => (Array.isArray(seat?.archetypes) ? seat.archetypes.map(String) : []);
const artOf = (seat: Record<string, any>) => roleArtFor({ archetypes: archetypesOf(seat), raw: seat });

/** The domains a role holds, from its own domain words. */
const domainsOf = (seat: Record<string, any>): string[] => domainsHeld(typeof seat?.domain === "string" ? seat.domain : "");

/** "Domains they hold": the role's domains as quiet chips. */
function Domains({ seat, center = false }: { seat: Record<string, any>; center?: boolean }) {
  const { t } = useLingui();
  const list = domainsOf(seat);
  if (list.length === 0) return null;
  return (
    <div className={`mt-2 grid gap-1.5 ${center ? "justify-items-center text-center" : ""}`} data-domains-held="">
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{t({ message: "Domains they hold", context: "founding team: the domains a role holds" })}</p>
      <ul className={`flex flex-wrap gap-1.5 ${center ? "justify-center" : ""}`}>
        {list.map((d) => (
          <li key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-card-foreground">
            <Sprout className="size-3 text-notice" aria-hidden="true" />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpenPill() {
  const { t } = useLingui();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-notice bg-background/80 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-notice">
      <span className="size-1.5 rounded-full bg-notice motion-safe:animate-pulse" aria-hidden="true" />
      {t({ message: "Open role", context: "founding team: nobody holds this role yet" })}
    </span>
  );
}

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
  /** The open card's slot. On the team sheet it opens under its own row, so the reader stays where they clicked. */
  cardSlot?: ReactNode;
}

/**
 * HOW FULL A ROLE IS (Rye, 14 Nov 2026, ruling 4): what its holders give against what it needs, as a bar
 * and in words, "50% held · 50% open" or "120% held · covered". A shared role stays open below its target.
 * It shows the role's need, never anyone's worth.
 */
function FillMeter({ f, center = false }: { f: RoleFill; center?: boolean }) {
  const { t, i18n } = useLingui();
  const width = Math.min(100, Math.round((f.heldPct / f.targetPct) * 100));
  return (
    <div className={`mt-2 grid gap-1 ${center ? "w-full max-w-40 justify-items-center" : "max-w-xs"}`} data-fill-meter="">
      {/* Without the share (one named holder) there is no bar to draw short of covered. */}
      {(!f.coarse || f.covered) && (
        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className={`block h-full rounded-full ${f.covered ? "bg-muted-foreground" : "bg-notice"}`} style={{ width: `${width}%` }} />
        </span>
      )}
      <span className="text-xs text-muted-foreground">{fillLine(i18n, f)}{f.targetPct !== 100 ? ` ${t({ message: `(of ${f.targetPct}%)`, context: "role fill, a target other than 100" })}` : ""}</span>
    </div>
  );
}

export default function FoundingLineup({ roles, filled, fill = {}, view, onView, shown, onOpen, cardId, orgPreview = null, comingSoon = null, cardSlot = null }: FoundingLineupProps) {
  const { t } = useLingui();
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tally}
        {toggle}
      </div>
      {view === "sheet" ? (
        <div className="flex flex-col gap-3" data-testid="team-sheet">
          <p className="text-xs font-bold uppercase tracking-widest text-notice">{t({ message: "Open now", context: "team sheet group" })}</p>
          <ul className="grid gap-3">
            {roles.map((r) => {
              const id = String(r.seat.id);
              const here = shown === id;
              // The card's own words for where (sections.where) win over the fixed label, as on the opened card.
              const whereWords = r.sections?.where?.trim();
              const tileSeat = whereWords ? { ...r.seat, card: { ...(r.seat.card ?? {}), whereText: whereWords } } : r.seat;
              const where = roleCardView(tileSeat).rows.find((row) => row.id === "where")?.lines[0] ?? null;
              const facts = [r.circleName, typeof r.seat.timeCommitment === "string" ? r.seat.timeCommitment : null, where].filter((x): x is string => !!x);
              return (
                <Fragment key={id}>
                <li className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 ${here ? "border-notice bg-notice/10" : "border-notice/50 bg-card"}`}>
                  <ArtImage portrait src={artOf(r.seat)} className="relative size-14 rounded-xl border border-notice/40 sm:size-[4.5rem]" imgClassName="object-top" />
                  <div className="min-w-0">
                    <OpenPill />
                    <p className="mt-1 font-display text-xl leading-snug text-card-foreground">{String(r.seat.name ?? "")}</p>
                    {typeof r.seat.aim === "string" && r.seat.aim && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.seat.aim}</p>}
                    {facts.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {facts.map((f) => (
                          <li key={f} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{f}</li>
                        ))}
                      </ul>
                    )}
                    {fill[id] && <FillMeter f={fill[id]} />}
                    <Domains seat={r.seat} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(id)}
                    aria-expanded={here}
                    aria-controls={cardId}
                    className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-notice bg-notice px-4 font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:col-span-1"
                    data-founding-role={id}
                  >
                    {t({ message: "Read the card", context: "team sheet: open this role's card" })}
                    <span className="sr-only">{`: ${String(r.seat.name ?? "")}`}</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </li>
                {here && cardSlot && <li className="list-none" data-card-inline="">{cardSlot}</li>}
                </Fragment>
              );
            })}
          </ul>
          {comingSoon}
          {filled.length > 0 && (
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
                        <OpenPill />
                      </span>
                    </span>
                    <span className="mt-2 font-semibold leading-snug text-card-foreground">{String(r.seat.name ?? "")}</span>
                  </button>
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
