/**
 * "JOIN THE FOUNDING TEAM" (phase A, lane A3, build list 2.1, 2.3 and 1.11):
 * the top of the Roles and Circles page while the village has turned the
 * section on (`org.founding_team`) and named its roles
 * (`org.founding_team_roles`, read by shared/foundingTeam.ts on the server).
 *
 * THE FOUNDING REGISTER. Same night world, quieter: larger display type, more
 * space, gold rules, and the Seed of Life only as structure behind the
 * heading. No moss and no game words here. One role is open at a time, so the
 * one firefly cluster sits on that card's one act, "Apply for this role".
 *
 * THE TEAM AS POSITIONS (Rye, 14 Nov 2026, FoundingLineup.tsx): the open roles
 * are drawn as a team sheet by default, or as a formation, and the chosen
 * role's card opens below, piece by piece. A phone opens on the team alone,
 * one thing at a time; a desktop opens on the first role's card.
 */
import { useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { RoleCardSections, VillagePay } from "@shared/roleCardSections";
import { seedOfLifeCentres, fx } from "@/components/journey/nature";
import FoundingLineup, { type FilledRole, type LineupView } from "./FoundingLineup";
import FullRoleCard from "./FullRoleCard";
import { useWide } from "./useWide";

/** The Seed of Life as quiet line work: structure, never ornament that moves. */
function SeedLines({ className = "" }: { className?: string }) {
  const centres = seedOfLifeCentres(60, 60, 20);
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={`pointer-events-none text-notice ${className}`}>
      {centres.map((c, i) => (
        <circle key={i} cx={fx(c.x)} cy={fx(c.y)} r={20} fill="none" stroke="currentColor" strokeWidth={0.4} />
      ))}
      <circle cx={60} cy={60} r={40} fill="none" stroke="currentColor" strokeWidth={0.4} />
    </svg>
  );
}

export interface FoundingRole {
  seat: Record<string, any>;
  circleName: string | null;
  sections: RoleCardSections | null;
}

/**
 * `lead`: the section opens the page (design pass M1 and D-04, 12 Nov 2026). Its heading is then the
 * page's h1, and on a phone the spacing is tighter so the role rows sit in the first screen.
 */
const VIEW_KEY = "founding-team-view";
function readView(): LineupView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "formation" ? "formation" : "sheet";
  } catch {
    return "sheet";
  }
}

const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function FoundingTeam({
  roles,
  initialOpen = null,
  villagePay = null,
  lead = false,
  filled = [],
}: {
  roles: FoundingRole[];
  initialOpen?: string | null;
  villagePay?: VillagePay | null;
  lead?: boolean;
  /** The filled roles of the founding circle, holders as the village shows them to this reader. */
  filled?: FilledRole[];
}) {
  const { t } = useLingui();
  const headingId = `${useId().replace(/[^a-zA-Z0-9]/g, "")}-founding`;
  const Heading = lead ? "h1" : "h2";
  const wide = useWide();
  // A phone opens on the list, one thing at a time; a desktop opens on the first role beside it.
  const [open, setOpen] = useState<string | null>(initialOpen);
  // The team sheet by default (Rye, 14 Nov); a reader's own choice is remembered on this device.
  const [view, setViewState] = useState<LineupView>(readView);
  const setView = (v: LineupView) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // A browser that keeps nothing still switches; it only forgets.
    }
  };
  // `open` is null until a reader chooses, and "" once a phone reader closes the open row.
  const shown = open === null ? (wide ? String(roles[0]?.seat?.id ?? "") || null : null) : open || null;
  if (roles.length === 0) return null;
  const current = roles.find((r) => String(r.seat.id) === shown) ?? null;

  return (
    <section aria-labelledby={headingId} className={`relative mx-auto max-w-6xl ${lead ? "mb-10 sm:mb-16" : "mb-16"}`} data-founding-team="">
      <div className={`relative overflow-hidden ${lead ? "border-b py-4 sm:border-t sm:py-14" : "border-y py-10 sm:py-14"} border-notice/40`}>
        <SeedLines className="absolute -right-10 -top-10 size-64 opacity-20 sm:size-80" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-notice">{t({ message: "Founding team", context: "founding team section eyebrow" })}</p>
        <Heading id={headingId} className="mt-3 font-display text-4xl leading-tight text-foreground sm:text-6xl">
          {t({ message: "Join the founding team", context: "founding team section heading" })}
        </Heading>
        <p className={`${lead ? "mt-3" : "mt-5"} max-w-2xl text-lg leading-relaxed text-muted-foreground sm:mt-5 sm:text-xl`}>
          {t({ message: "We are building our team of people who will lead each domain of the village from the foundation through to completion.", context: "founding team section lede" })}
        </p>
      </div>

      <div className={`${lead ? "mt-5" : "mt-10"} grid gap-6 sm:mt-10`}>
        {/* The team as positions (Rye, 14 Nov): a team sheet by default, a formation on request.
            Choosing a role opens its card below, piece by piece. */}
        <FoundingLineup
          roles={roles}
          filled={filled}
          view={view}
          onView={setView}
          shown={shown}
          cardId={`${headingId}-card`}
          onOpen={(id) => {
            setOpen(shown === id && !wide ? "" : id);
            if (shown === id) return;
            requestAnimationFrame(() => {
              const card = document.getElementById(`${headingId}-card`);
              if (card && typeof card.scrollIntoView === "function") card.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
            });
          }}
        />
        <div id={`${headingId}-card`} className="scroll-mt-24">
          {current ? (
            <FullRoleCard key={String(current.seat.id)} seat={current.seat} circleName={current.circleName} sections={current.sections} villagePay={villagePay} register="founding" lifted={lead} />
          ) : wide ? (
            <p className="rounded-2xl border border-dashed border-notice/40 p-8 text-muted-foreground">{t({ message: "Choose a role to read it in full.", context: "founding team, no role open" })}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
