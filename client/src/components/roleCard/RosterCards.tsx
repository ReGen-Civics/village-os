/**
 * THE ROSTER (Rye, 17 Nov 2026, approved mockup https://claude.ai/artifact/FACiWjD7FWeNuDGKxFA6bM): the roles
 * held now, one card per person, for both of FoundingLineup's views. Loaded after the page's first view,
 * because it sits below the open roles. Grouping and order live in ./roster.ts.
 */
import { Bot, UserRound } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { seedOfLifeCentres, fx } from "@/components/journey/nature";
import type { FilledRole, LineupView } from "./FoundingLineup";
import { rosterOf, type RosterEntry } from "./roster";

/** The Seed of Life as quiet line work behind a roster card's crest. */
function CrestSeed({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={`pointer-events-none absolute text-notice ${className}`}>
      {seedOfLifeCentres(60, 60, 20).map((c, i) => (
        <circle key={i} cx={fx(c.x)} cy={fx(c.y)} r={20} fill="none" stroke="currentColor" strokeWidth={0.5} />
      ))}
    </svg>
  );
}

/** The crest: a gold ring around the holder's initial, or a plain mark when there is no name. Never a face. */
function Crest({ entry, size }: { entry: RosterEntry; size: string }) {
  const initial = entry.name ? Array.from(entry.name)[0]?.toLocaleUpperCase() : null;
  const Icon = entry.agent ? Bot : UserRound;
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-notice/40 via-notice to-notice/40 p-[3px] shadow-[0_0_24px] shadow-notice/30 ${size}`} aria-hidden="true">
      <span className="grid size-full place-items-center rounded-full bg-background font-display text-notice">
        {initial ? <span className="text-[1.75em] leading-none">{initial}</span> : <Icon className="size-1/2" />}
      </span>
    </span>
  );
}

/**
 * ONE PERSON ON THE ROSTER (Rye, 17 Nov 2026, approved mockup): a crest, the first name the village shows
 * this reader, the circle as the team and every role they hold as their positions. No numbers, no stats.
 */
function RosterCard({ entry, team, variant }: { entry: RosterEntry; team: string | null; variant: LineupView }) {
  const { t } = useLingui();
  const title = entry.name ?? (entry.agent ? t({ message: "An agent", context: "roster card: a role an agent holds" }) : t({ message: "Filled", context: "team sheet: someone holds this role" }));
  const positionsWord =
    entry.roles.length === 1 ? t({ message: "Position", context: "roster card: the one role a person holds" }) : t({ message: "Positions", context: "roster card: the roles a person holds" });
  const positions = (
    <ul className={`mt-1 grid gap-1 ${variant === "formation" ? "justify-items-center" : ""}`}>
      {entry.roles.map((r) => (
        <li key={r.id} className="flex items-start gap-2 text-sm leading-snug text-card-foreground" data-filled-role={r.id}>
          {/* A centred line wraps under itself, so the formation's positions go without the dot. */}
          {variant === "sheet" && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-notice" aria-hidden="true" />}
          {r.name}
        </li>
      ))}
    </ul>
  );
  if (variant === "formation") {
    return (
      <li className="flex w-full max-w-48 flex-col items-center gap-1 text-center" data-roster-person={entry.key}>
        <Crest entry={entry} size="size-16 text-base sm:size-20 sm:text-lg" />
        <p className="mt-2 font-display text-lg leading-snug text-card-foreground">{title}</p>
        {positions}
      </li>
    );
  }
  return (
    <li className="grid grid-cols-[5.5rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-notice/40 bg-card shadow-sm sm:grid-cols-1 sm:grid-rows-[auto_1fr] sm:content-start" data-roster-person={entry.key}>
      <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-muted to-card sm:h-36 sm:pt-5">
        <CrestSeed className="size-40 opacity-20 sm:size-56" />
        {team && <span className="absolute left-3 top-2.5 hidden text-[0.65rem] font-bold uppercase tracking-widest text-notice sm:inline">{team}</span>}
        <Crest entry={entry} size="size-14 text-base sm:size-20 sm:text-lg" />
      </div>
      <div className="min-w-0 p-3 sm:p-4 sm:pt-3">
        {team && <p className="text-[0.65rem] font-bold uppercase tracking-widest text-notice sm:hidden">{team}</p>}
        <p className="font-display text-xl leading-snug text-card-foreground sm:text-2xl">{title}</p>
        <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{positionsWord}</p>
        {positions}
      </div>
    </li>
  );
}

/** The cards, in a list FoundingLineup lays out: "filled-roles" on the team sheet, "formation-roster" in the formation. */
export default function RosterList({ filled, team, variant, className }: { filled: FilledRole[]; team: string | null; variant: LineupView; className: string }) {
  // One card per person, every role they hold listed; alphabetical, so the order says nothing.
  const roster = rosterOf(filled);
  return (
    <ul className={className} data-testid={variant === "sheet" ? "filled-roles" : "formation-roster"}>
      {roster.map((e) => (
        <RosterCard key={e.key} entry={e} team={team} variant={variant} />
      ))}
    </ul>
  );
}
