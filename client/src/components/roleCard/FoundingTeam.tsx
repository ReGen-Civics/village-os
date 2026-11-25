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
 * role's card opens below, piece by piece. Every width opens on the team
 * alone, every card closed (the lead, 24 Nov 2026: a card that opened by
 * itself on desktop read as chosen for the reader).
 *
 * BACK ON /roles (the lead, 21 Nov 2026), as approved in 1.3.41, with the page's groups in their new order and each
 * role in its own frame (FoundingLineup.tsx). The view switch is the page's to hold (`useLineupView`), because the
 * page draws the roles held now below its other groups on the team sheet, and the formation keeps them in its ring.
 * The team's timeline moved to the page too, below the upcoming roles.
 */
import { useId, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { RoleCardSections, VillagePay } from "@shared/roleCardSections";
import type { RoleFill } from "@shared/commitmentRange";
import FoundingLineup from "./FoundingLineup";
import type { FilledRole, LineupView } from "./RosterCards";
import FullRoleCard from "./FullRoleCard";
import LeadBuilds, { type BuiltRole } from "./LeadBuilds";
import { useWide } from "./useWide";

export interface FoundingRole {
  seat: Record<string, any>;
  circleName: string | null;
  sections: RoleCardSections | null;
  /** Its own page, `/roles/<slug>`, for the card's share link. */
  path?: string;
  /** The members' terms drawer for a reader allowed to read terms (SeatTermsSlot's `termsSlotFor`). */
  settings?: ReactNode;
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

/** The team sheet or the formation, the reader's own choice remembered on this device (Rye, 14 Nov). */
export function useLineupView(): [LineupView, (v: LineupView) => void] {
  const [view, setViewState] = useState<LineupView>(readView);
  const setView = (v: LineupView) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // A browser that keeps nothing still switches; it only forgets.
    }
  };
  return [view, setView];
}

const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function FoundingTeam({
  roles,
  initialOpen = null,
  villagePay = null,
  lead = false,
  filled = [],
  fill = {},
  laterCount = 0,
  builds = {},
  onOpenBuilt,
  orgPreview = null,
  comingSoon = null,
  view: givenView,
  onView,
  heading = null,
  toBeAdded = {},
  sheetRoster = true,
  anchorId,
}: {
  roles: FoundingRole[];
  initialOpen?: string | null;
  villagePay?: VillagePay | null;
  lead?: boolean;
  /** The filled roles of the founding circle, holders as the village shows them to this reader. */
  filled?: FilledRole[];
  /** How full each role is, by id (Rye, 14 Nov 2026). */
  fill?: Record<string, RoleFill>;
  /** The listed roles that open after this team (Rye, 14 Nov 2026), shown under it at #opening-next. */
  laterCount?: number;
  /** The coming-soon roles each lead will build, by the lead's role id (Rye, 16 Nov 2026). */
  builds?: Record<string, BuiltRole[]>;
  /** Opens a built role's own card on the page. */
  onOpenBuilt?: (id: string) => void;
  /** The org chart beside the roles held now (Rye, 16 Nov 2026): one link into /circles. */
  orgPreview?: ReactNode;
  /** The coming-soon roles and their waitlist, drawn by the lineup under the open roles (the lead, 19 Nov 2026). */
  comingSoon?: ReactNode;
  /** The view, when the page holds it (`useLineupView`); otherwise the section keeps its own. */
  view?: LineupView;
  onView?: (v: LineupView) => void;
  /** The group's heading over the roles, "Open roles (n)". */
  heading?: ReactNode;
  /** The roles still to come under each lead role, by its id, one line in its row. */
  toBeAdded?: Record<string, ReadonlyArray<{ id: string; name: string }>>;
  /** Whether the team sheet draws the roles held now; the /roles page draws them below its other groups. */
  sheetRoster?: boolean;
  /**
   * The section's stable id on its page, `founding-team` on /roles (the lead, 23 Nov 2026): "Join the team" scrolls
   * here and moves focus to the heading (client/src/lib/sectionAnchor.ts).
   */
  anchorId?: string;
}) {
  const { t } = useLingui();
  const headingId = `${useId().replace(/[^a-zA-Z0-9]/g, "")}-founding`;
  const Heading = lead ? "h1" : "h2";
  const wide = useWide();
  // Every width opens on the list with every card closed (the lead, 24 Nov 2026); a reader opens one at a time.
  const [open, setOpen] = useState<string | null>(initialOpen);
  // The team sheet by default (Rye, 14 Nov); a reader's own choice is remembered on this device.
  const [ownView, setOwnView] = useLineupView();
  const view = givenView ?? ownView;
  const setView = onView ?? setOwnView;
  // `open` is null until a reader chooses, and "" once a reader closes the open row.
  const shown = open || null;
  if (roles.length === 0) return null;
  const current = roles.find((r) => String(r.seat.id) === shown) ?? null;

  // On the team sheet the card opens under its own row, so the reader stays where they clicked (QA F7). The formation
  // has no rows to open under, and a sheet with nothing open has no card, so both keep the slot below the lineup.
  const inlineCard = view === "sheet" && current !== null;
  const cardSlot = (
    <div id={`${headingId}-card`} tabIndex={-1} className="scroll-mt-24 focus:outline-none" data-founding-card-slot="">
      {current ? (
        <>
          <FullRoleCard key={String(current.seat.id)} seat={current.seat} circleName={current.circleName} sections={current.sections} villagePay={villagePay} register="founding" lifted={lead} sharePath={current.path} settings={current.settings} />
          {onOpenBuilt && <LeadBuilds leadName={String(current.seat.name ?? "")} roles={builds[String(current.seat.id)] ?? []} onOpen={onOpenBuilt} />}
        </>
      ) : wide && view === "formation" ? (
        <p className="rounded-2xl border border-dashed border-notice/40 p-8 text-muted-foreground">{t({ message: "Choose a role to read it in full.", context: "founding team, no role open" })}</p>
      ) : null}
    </div>
  );

  return (
    <section id={anchorId} aria-labelledby={headingId} className={`relative mx-auto max-w-6xl scroll-mt-24 ${lead ? "mb-10 sm:mb-16" : "mb-16"}`} data-founding-team="">
      <div className={`relative overflow-hidden ${lead ? "border-b py-4 sm:border-t sm:py-14" : "border-y py-10 sm:py-14"} border-notice/40`}>
        {/* No sacred-geometry watermark here: it sat under the mycelium-stitched cards, two motifs on one
            screen; sacred geometry is for emblems and empty states (the lead, 25 Nov 2026, from the QA pass). */}
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-notice">{t({ message: "Founding team", context: "founding team section eyebrow" })}</p>
        <Heading id={headingId} tabIndex={anchorId ? -1 : undefined} data-section-focus={anchorId ? "" : undefined} className="mt-3 font-display text-4xl leading-tight text-foreground outline-none sm:text-6xl">
          {t({ message: "Join the founding team", context: "founding team section heading" })}
        </Heading>
        <p className={`${lead ? "mt-3" : "mt-5"} max-w-2xl text-lg leading-relaxed text-muted-foreground sm:mt-5 sm:text-xl`}>
          {t({ message: "We're forming the founding roles who will hold critical domains from foundation building through to completion.", context: "founding team section lede" })}
        </p>
        {/* Hiring the founding team first (Rye, 14 Nov 2026): one line, so a visitor sharing the link sees there is more to come. */}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground" data-hiring-first="">
          {t({ message: "We are filling these roles first. More roles open after them.", context: "founding team section, hiring first" })}{" "}
          {laterCount > 0 && (
            <a href="#opening-next" className="font-medium text-notice underline underline-offset-2 hover:text-foreground">
              {t({ message: "See the roles opening next", context: "founding team section, hiring first" })}
            </a>
          )}
        </p>
      </div>

      <div className={`${lead ? "mt-5" : "mt-10"} grid gap-6 sm:mt-10`}>
        {/* The team as positions (Rye, 14 Nov): a team sheet by default, a formation on request.
            Choosing a role opens its card below, piece by piece. */}
        <FoundingLineup
          roles={roles}
          laterCount={laterCount}
          filled={filled}
          orgPreview={orgPreview}
          comingSoon={comingSoon}
          heading={heading}
          toBeAdded={toBeAdded}
          onOpenAdded={onOpenBuilt}
          sheetRoster={sheetRoster}
          villagePay={villagePay}
          cardSlot={inlineCard ? cardSlot : null}
          fill={fill}
          view={view}
          onView={setView}
          shown={shown}
          cardId={`${headingId}-card`}
          onOpen={(id) => {
            const closing = shown === id;
            setOpen(closing ? "" : id);
            if (closing) return;
            // QA P1-01: the opened card is brought into view. The scroll is skipped only when the card's top is
            // already in the upper half of the screen.
            requestAnimationFrame(() => {
              const card = document.getElementById(`${headingId}-card`);
              const top = card ? card.getBoundingClientRect().top : -1;
              const inView = top >= 0 && top < window.innerHeight / 2;
              if (card && !inView && typeof card.scrollIntoView === "function") card.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
              // Focus follows the eye (a11y sweep P1-3): a keyboard or screen reader user lands on the card they opened.
              card?.focus({ preventScroll: true });
            });
          }}
        />
        {!inlineCard && cardSlot}
      </div>
    </section>
  );
}
