/**
 * THE FOUNDING TEAM AS POSITIONS (Rye, 14 Nov 2026: "showing the open roles more like showing the
 * positions on an epic team (think fantasy sports)"; approved mockup C,
 * https://claude.ai/artifact/NaavCsufyAEHKowgEdKFAX. Rye: "Both, defaulting to team sheet, with
 * both as options so I can get broader feedback").
 *
 * Two ways to draw the same team, chosen by the reader:
 *   - the TEAM SHEET (default): the open roles first, each a row with its art, "Open role", its
 *     name, its aim and a few facts, then the filled roles of the same circle;
 *   - the FORMATION: the filled roles of the circle in the centre, and each open lead in front of
 *     the circles it will grow, drawn as dashed places.
 *
 * POSITIONS, NEVER PLAYERS. No stats, ratings, rankings or comparisons of people, and no AI picks
 * anyone (standing ruling). A filled role names its holder as "Role (FirstName)" only when the
 * village shows names to this reader; otherwise it says "Filled". The glow marks an open role.
 *
 * The dashed places come from the village's own chart: circles that grew from the lead's role
 * (`grownFromOrgRoleId`) or that the role leads (`leadRoleId`). Nothing is invented: with no such
 * circle, the lead stands alone.
 */
import { useId } from "react";
import { ArrowRight, LayoutList, Plus, Target, UserRound } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { roleCardView } from "@shared/roleCardView";
import { roleArtFor } from "@shared/roleDraft";
import { roleWithHolders } from "@shared/roleHolderLabel";
import { seedOfLifeCentres, fx } from "@/components/journey/nature";
import ArtImage from "@/components/roleDraft/ArtImage";
import type { FoundingRole } from "./FoundingTeam";

export type LineupView = "sheet" | "formation";

/** A role of the founding circle that someone holds. */
export interface FilledRole {
  id: string;
  name: string;
  /** Holders' names as the village shows them to this reader; empty when it shows none. */
  holders: string[];
}

/** A circle the village has drawn as growing from a lead's role. */
export interface GrowingCircle {
  id: string;
  name: string;
  grownFromOrgRoleId?: string | null;
  leadRoleId?: string | null;
}

const archetypesOf = (seat: Record<string, any>): string[] => (Array.isArray(seat?.archetypes) ? seat.archetypes.map(String) : []);
const artOf = (seat: Record<string, any>) => roleArtFor({ archetypes: archetypesOf(seat), raw: seat });

/** The circles a lead will grow, from the village's chart. */
export function growsFrom(roleId: string, circles: readonly GrowingCircle[]): GrowingCircle[] {
  return circles.filter((c) => c.grownFromOrgRoleId === roleId || c.leadRoleId === roleId);
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
  circles: GrowingCircle[];
  view: LineupView;
  onView: (v: LineupView) => void;
  /** The open card's role id, if any. */
  shown: string | null;
  onOpen: (roleId: string) => void;
  cardId: string;
}

export default function FoundingLineup({ roles, filled, circles, view, onView, shown, onOpen, cardId }: FoundingLineupProps) {
  const { t } = useLingui();
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const filledLabel = (f: FilledRole) => (f.holders.length ? roleWithHolders(f.name, f.holders) : f.name);
  const growing = roles.reduce((n, r) => n + growsFrom(String(r.seat.id), circles).length, 0);

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
          className={`inline-flex min-h-10 items-center gap-1.5 px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${view === v ? "bg-muted text-card-foreground" : "text-muted-foreground hover:text-card-foreground"}`}
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
      {growing > 0 && (
        <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1">
          <span className="size-2 rounded-full border border-dashed border-muted-foreground" aria-hidden="true" />
          {t({ message: `${growing} circles to grow`, context: "founding team tally: circles the leads will grow" })}
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
              const grows = growsFrom(id, circles);
              const where = roleCardView(r.seat).rows.find((row) => row.id === "where")?.lines[0] ?? null;
              const facts = [r.circleName, typeof r.seat.timeCommitment === "string" ? r.seat.timeCommitment : null, where, grows.length ? t({ message: `Grows ${grows.length} circles`, context: "team sheet fact" }) : null].filter((x): x is string => !!x);
              return (
                <li key={id} className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 ${here ? "border-notice bg-notice/10" : "border-notice/50 bg-card"}`}>
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
              );
            })}
          </ul>
          {filled.length > 0 && (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-notice">{roles[0]?.circleName ?? t({ message: "Already on the team", context: "team sheet group" })}</p>
              <ul className="grid gap-2 sm:grid-cols-2" data-testid="filled-roles">
                {filled.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
                      <UserRound className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold leading-snug text-card-foreground">{filledLabel(f)}</span>
                      <span className="text-xs text-muted-foreground">{t({ message: "Filled", context: "team sheet: someone holds this role" })}</span>
                    </span>
                  </li>
                ))}
              </ul>
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
          {filled.length > 0 && (
            <div className="relative mb-8">
              <p className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{roles[0]?.circleName ?? ""}</p>
              <ul className="flex flex-wrap justify-center gap-5">
                {filled.map((f) => (
                  <li key={f.id} className="flex w-36 flex-col items-center gap-2 text-center">
                    <span className="relative grid size-20 place-items-center rounded-full border-2 border-muted-foreground/60 bg-card text-muted-foreground">
                      <UserRound className="size-8" aria-hidden="true" />
                      <span className="absolute -bottom-2 rounded-full border border-border bg-background px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest">{t({ message: "Filled", context: "formation: someone holds this role" })}</span>
                    </span>
                    <span className="mt-1 text-sm font-semibold leading-snug text-card-foreground">{filledLabel(f)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="relative mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            {t({ message: "The leads, and the circles they will grow", context: "formation row" })}
          </p>
          <ul className="relative grid gap-4 md:grid-cols-3">
            {roles.map((r) => {
              const id = String(r.seat.id);
              const here = shown === id;
              const grows = growsFrom(id, circles);
              return (
                <li key={id} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/50 px-3 py-4">
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
                  {grows.length > 0 && (
                    <div className="w-full border-t border-dashed border-border pt-3" id={`${base}-${id}-grows`}>
                      <p className="mb-2 text-center text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{t({ message: "Grows", context: "formation: the circles a lead will grow" })}</p>
                      <ul className="flex flex-wrap justify-center gap-3">
                        {grows.map((c) => (
                          <li key={c.id} className="flex w-24 flex-col items-center gap-1 text-center">
                            <span className="grid size-12 place-items-center rounded-full border border-dashed border-muted-foreground text-muted-foreground" aria-hidden="true">
                              <Plus className="size-4" />
                            </span>
                            <span className="text-xs leading-snug text-muted-foreground">{c.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {t({ message: "A role shows the work it holds. Nothing here rates or compares people.", context: "founding team: the no-stats line" })}
      </p>
    </div>
  );
}
