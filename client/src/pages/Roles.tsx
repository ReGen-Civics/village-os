/**
 * /roles, AS APPROVED IN 1.3.41 (the lead, 21 Nov 2026): 1.3.42's compact index cards are undone, and the founding
 * team leads with its full role cards again (FoundingTeam.tsx). Kept from the lead's asks: the groups in order (Open
 * roles, Open ventures, Upcoming roles, then the roles held now), one frame per role with its card inside it
 * (FoundingLineup.tsx), and "Related roles this role will onboard:" in a lead role's row. Old links to one role (`?seat=`, `?role=`,
 * `#<id>`, `#role-<id>`, `#<slug>`) land on its own page, `/roles/<slug>` (RoleShare.tsx), its share link.
 */
import ArchetypeStep from "@/components/roleDraft/ArchetypeStep";
import SeatHistory from "@/components/power/SeatHistory"; // kept static: lazy, it folds the shared shell chunk into the main bundle (main JS budget)
import CircleName from "@/components/circles/CircleName";
import { anchorCircleId } from "@shared/circlePicker";
import SeasonGoals from "@/components/roleDraft/SeasonGoals";
import { BTN_NOTICE, BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, H1, H2, LINK, RING, TILE, WORLD } from "@/components/journey/look";
import NotListedChip from "@/components/NotListedChip";
import { ComingSoonChip, HeldByAgentLine, VentureChip } from "@/components/ComingSoon";
import { FourWaysSection, GiftSection, StartVentureButton } from "@/components/ContributorRoutes";
import Layout from "@/components/Layout";
import { Link, useLocation } from "wouter";
import { m, AnimatePresence } from "framer-motion";
import { ArrowRight, Briefcase, ChevronDown } from "lucide-react";
import { iconFor } from "@/lib/circleIcons";
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { GROUP_BREAK, GROUP_H2 } from "@/components/roleCard/groupLook";
import { AnchorCircleTip } from "@/components/roleCard/CardTips";
import { rolePath } from "@shared/roleSlug";
import { prefersReducedMotion } from "@/components/natural/useReducedMotion";
import SeatClaimCard from "@/components/SeatClaimCard";
import { swatchFor } from "@/lib/swatch";
import { gameFetch, useSeason } from "@/lib/gameApi";
import { PeopleLockNote, type PeopleTier } from "@/components/PeopleLock";
import { applyHrefFor, guardedAction, termsSlotFor } from "@/components/power/SeatTermsSlot";
import EditRoleButton, { NewRoleFromCardButton } from "@/components/roleEdit/EditRoleButton";
import { agentProposalHref, proposeRoleHref } from "@/components/roleProposal/QuickPath";
import { useClassNames } from "@/components/power/useClassNames";
import { useModule } from "@/modules/ModuleProvider";
import { useAuth, useIsAdmin } from "@/contexts/AuthContext";
import ComingSoonRoles, { type SoonRole } from "@/components/roleCard/ComingSoonRoles";
import { soonIsPaid } from "@/components/roleCard/frontWords";
import { waitlistHash } from "@shared/roleWaitlist";
import { useMyCommitment } from "@/lib/useMyCommitment";
import { rolesWithinReach } from "@shared/commitment";
import { Trans, useLingui } from "@lingui/react/macro";
import FoldedTeamTimeline from "@/components/roleCard/FoldedTeamTimeline";
import RoleRowArt from "@/components/roleCard/RoleRowArt";
import { isSeatState, type SeatStateWord, type SheetContext } from "@shared/roleSheet";
import { fromOrgSeat, orgHolderName, seasonForSheet, seatHistoryShown } from "@shared/roleSheetInputs";
import FoundingTeam, { useLineupView, type FoundingRole } from "@/components/roleCard/FoundingTeam";
import { orgChartOf } from "@/components/roleCard/orgChart";
import type { BuiltRole } from "@/components/roleCard/LeadBuilds";
import { heldButRecruiting, rolesLeadWillBuild, ventureOpenNow } from "@shared/roleListing";
import FullRoleCard, { mayApply } from "@/components/roleCard/FullRoleCard";
import { readFoundingTeam, type FoundingTeamAnswer } from "@/components/roleCard/roleCardApi";
import { DEFAULT_OTHER_WAYS, OTHER_WAYS_DEFAULTS } from "@shared/otherWays";
import RootsFilterToggle from "@/components/roots/RootsFilterToggle";
import { useRootsFilter } from "@/components/roots/useRootsFilter";

// The org chart door beside the roster (Rye, 16 Nov 2026) loads after the first view: it sits below the open roles.
const OrgPreview = lazy(() => import("@/components/roleCard/OrgPreview"));
// Who asked to hear when a coming-soon role opens: admins only, loaded only for them.
const WaitlistAdmin = lazy(() => import("@/components/roleCard/WaitlistAdmin"));
// A role row's opened body and the conflict steps at the foot of the page load when they are drawn, off the
// first view of /roles (scripts/route-first-view.json; the lead, 19 Nov 2026: headroom for the role cards).
const SeatNeeds = lazy(() => import("@/components/power/SeatNeeds"));
const VillageConflictSteps = lazy(() => import("@/components/governance/VillageConflictSteps"));
const SeatTradingCard = lazy(() => import("@/components/power/SeatTradingCard"));
const SeatVendorFacts = lazy(() => import("@/components/power/SeatVendorFacts"));
const RoleHolderCards = lazy(() => import("@/components/playerCard/RoleHolderCards"));
const RaiseTension = lazy(() => import("@/components/roleTension/RaiseTension"));
const SeatAction = lazy(() => import("@/components/power/SeatAction"));
const SeatLinkCopy = lazy(() => import("@/components/roleCard/SeatLinkCopy"));
// The roles held now and the team's timeline sit below the groups, so they load after the first view.
const RosterList = lazy(() => import("@/components/roleCard/RosterCards"));

interface RoleEntry {
  id: string;
  name: string;
  /** The circle this seat sits in, resolved from its id to a display name. */
  group: string;
  circleId?: string | null;
  status: SeatStateWord;
  holders?: string[];
  icon?: string;
  color?: string;
  /** A seeded demonstration seat. Its history is demo rows, so it stays off. */
  isExample?: boolean;
  /** The `/api/org` row as it arrived, which the role card reads for itself. */
  raw: any;
  /** Its own page's address, `/roles/<slug>` (shared/roleSlug.ts). */
  path: string;
}

/** What every expanded card on the page reads besides its own row. */
interface SheetSource {
  circles: any[];
  people: PeopleTier | null;
  village: unknown;
  ctx: SheetContext;
  /** The raise-hand route lives under `/api/map`, so the door follows that module. */
  raiseHand: boolean;
  /** Whether the seat's history is shown to this reader (`seatHistoryShown`). */
  historyShown: boolean;
}


// The subtitles under each circle heading used to be a hardcoded map of one
// village's circle names, living in platform code: a fork got no subtitle for
// any circle it actually had. They come from the circle's own purpose now.

// The header's badge says the seat's state in the card's own words
// (`STATE_WORDS`), keyed by the union, so the row and the card below it can
// never disagree and a sixth state cannot draw an empty badge. A seat whose
// term reached its date used to fall through to "Open Role" here.
const statusBadge: Record<SeatStateWord, string> = {
  // The sheet's state colours (docs/DESIGN_RULE.md): held is living green, open is the gold of
  // what can be taken up, the rest are quiet. Semantic tokens, so they read on the night ground.
  filled: "bg-open/10 text-open border border-open/40",
  open: "bg-notice/10 text-notice border border-notice/50",
  forming: "bg-muted text-foreground border border-border",
  partial: "bg-muted text-foreground border border-border",
  expired: "bg-muted text-muted-foreground border border-border",
};

function normalizeStatus(s: unknown): SeatStateWord {
  const v = String(s ?? "").toLowerCase();
  if (isSeatState(v)) return v;
  if (v.startsWith("fill")) return "filled";
  if (v.startsWith("part")) return "partial";
  if (v.startsWith("form")) return "forming";
  return "open";
}

/** What an old in-page link to one role named, read once on arrival: `?seat=`, `?role=`, or the hash. */
function oldLink(): { seat: string | null; hash: string | null } {
  if (typeof window === "undefined") return { seat: null, hash: null };
  const q = new URLSearchParams(window.location.search);
  const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return { seat: q.get("seat") || q.get("role") || null, hash: h || null };
}

/** The role an old link names: by id for `?seat=`, by id, `role-<id>` or slug for a hash. */
export function roleForOldLink(link: { seat: string | null; hash: string | null }, roles: ReadonlyArray<{ id: string; path: string }>): { id: string; path: string } | null {
  if (link.seat) return roles.find((r) => r.id === link.seat) ?? null;
  const h = link.hash;
  if (!h || h.startsWith("waitlist-")) return null;
  const id = h.startsWith("role-") ? h.slice(5) : h;
  return roles.find((r) => r.id === id || r.id === h || r.path === `/roles/${h}`) ?? null;
}

/** The gap between role rows: room enough that each row reads as its own panel (the lead, 21 Nov 2026). */
const ROWS = "space-y-5";

interface RoleCardProps {
  role: RoleEntry;
  expanded: boolean;
  onToggle: () => void;
  index: number;
  /** Whether this reader may say what the seat is held for. */
  canTagNeeds: boolean;
  sheet: SheetSource;
}

function RoleCard({ role, expanded, onToggle, index, canTagNeeds, sheet }: RoleCardProps) {
  // Whose words the vendor panel shows. Taken from the listing rather than
  // written here, because another fork's connector is a different service
  // and a literal would be this platform naming one of them.
  const { t } = useLingui();
  const vendorName = useModule("saberra")?.name ?? t({ message: `the connected service`, context: "roles page, a connected service's fallback name" });
  const stateWords: Record<SeatStateWord, string> = {
    open: t({ message: `Open`, context: "roles page, role state" }),
    partial: t({ message: `Partly held`, context: "roles page, role state" }),
    filled: t({ message: `Held`, context: "roles page, role state" }),
    forming: t({ message: `Forming`, context: "roles page, role state" }),
    expired: t`Ready to be re-chosen`,
  };
  const headerId = `${useId().replace(/[^a-zA-Z0-9]/g, "")}-seat`;
  const Icon = iconFor(role.icon);
  // Admin-editable colour, resolved together with the ink that stays legible
  // on it. See client/src/lib/swatch.ts.
  const swatch = swatchFor(role.color);
  const holders = (role.holders ?? []).filter(Boolean);
  const [fullOpen, setFullOpen] = useState(false);
  return (
    <m.div
      data-role-row={role.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
    >
      <button
        id={headerId}
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left bg-card hover:bg-muted transition-colors p-5 rounded-2xl border border-border shadow-sm scroll-mt-28 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <RoleRowArt roleId={role.id} Icon={Icon} swatch={swatch} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h3 className="font-display text-lg font-bold text-foreground leading-tight">{role.name}</h3>
                {/* A coming-soon role says so in place of its state, until someone holds it (Rye, 16 Nov 2026). */}
                {(role.raw?.comingSoon === true || role.raw?.futureVenture === true) && role.status !== "filled" && role.status !== "partial" ? (
                  role.raw?.futureVenture === true ? <VentureChip role={role.raw} /> : <ComingSoonChip role={role.raw} />
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[role.status]}`}>
                    {stateWords[role.status]}
                  </span>
                )}
                <NotListedChip role={role.raw} />
                <HeldByAgentLine role={role.raw} className="basis-full" />
                {/* 0374: the card says an agent may hold it (a card that has not said shows nothing). */}
                {(role.raw?.card?.heldBy === "agent" || role.raw?.card?.heldBy === "either") && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-foreground border border-border" data-testid="agent-may-hold">
                    <Trans context="roles directory chip">Can be held by an agent</Trans>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {role.group}
                {holders.length > 0 && (
                  <span className="text-open font-medium"> · {holders.join(", ")}</span>
                )}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 mt-2 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-muted p-6 rounded-b-2xl border border-t-0 border-border space-y-5">
              <Suspense fallback={null}>
              {/* The role card, the same one the map draws, from this page's
                  own `/api/org` row at whatever tier it was served. The row
                  header above already says the circle and the state, so the
                  card leaves both out and is named by that header. Its one
                  door is a raised hand, offered while the map module is on
                  for this reader; the contact relay stays on the map. */}
              <SeatTradingCard
                embedded
                labelledBy={headerId}
                input={fromOrgSeat(role.raw, sheet.circles, sheet.people, sheet.village, { raiseHand: sheet.raiseHand })}
                ctx={sheet.ctx}
                action={guardedAction(role.raw, <SeatAction circleId={role.circleId ?? null} applyHref={applyHrefFor(role.raw)} />)}
                settings={termsSlotFor(role.raw)}
              />
              {/* The full card: everything the role editor holds, read-only (build list 4.4). */}
              {!role.isExample && (
                <details className="group rounded-xl border border-border bg-card" data-full-card-details={role.id} onToggle={(e) => setFullOpen((e.currentTarget as HTMLDetailsElement).open)}>
                  <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                    {t({ message: "Read the full card", context: "roles page, opens a role's full card" })}
                  </summary>
                  <div className="p-2 sm:p-3">
                    {/* Mounted once opened, so a closed row reads nothing more. */}
                    {fullOpen && <FullRoleCard seat={role.raw} circleName={role.group} showTitle={false} labelledBy={headerId} />}
                  </div>
                </details>
              )}
              {/* The seat as a link, for sending to whoever might hold it.
                  Outside the night card, in this page's own light inks. Not
                  on a demonstration seat: nobody is recruited for one, so a
                  link to it has nothing to ask anybody. */}
              {!role.isExample && <RoleHolderCards role={role.raw} />}
              {!role.isExample && <SeatLinkCopy path={role.path} seatName={role.name} />}
              {/* For a holder of the power to decide the structure, and nobody else: the editor is its own chunk. */}
              {!role.isExample && <EditRoleButton roleId={role.id} onSaved={() => window.location.reload()} />}
              {!role.isExample && (
                <Link href={proposeRoleHref(role.id)} className={`w-fit ${BTN_NOTICE}`}>
                  {t`Propose this role for next season`}
                </Link>
              )}
              {!role.isExample && role.raw?.card?.agentMayHold === true && (
                <Link href={agentProposalHref(role.id)} className={`w-fit ${BTN_SECONDARY}`}>
                  <Trans context="roles directory: a member proposes an agent they keep">Propose an agent for this role</Trans>
                </Link>
              )}
              {!role.isExample && <RaiseTension roleId={role.id} roleName={role.name} />}
              {/* The card is the seat today. This is the seat's whole record,
                  ended holdings included, which is the half a village loses
                  when it keeps its org chart in a document. Fetched only once
                  a reader opens the card. */}
              {!role.isExample && (
                <div className="pt-4 border-t border-border">
                  <SeatHistory roleId={role.id} canSeePeople={sheet.historyShown} />
                </div>
              )}
              {/* Which of the village's needs this seat carries (R18). A
                  description of the seat and never a condition on holding it:
                  who may sit here is decided by `org.seat` and by nothing
                  written on this line. */}
              {!role.isExample && (
                <div className="pt-4 border-t border-border">
                  <SeatNeeds roleId={role.id} canEdit={canTagNeeds} />
                </div>
              )}
              {/* What a connected service holds about this seat, in that
                  service's own words. Open to every member on purpose: the
                  question it answers is whether to put your hand up for this
                  seat, and that is not a steward's question. Renders nothing
                  at all when no such module is on. */}
              {!role.isExample && (
                <div className="pt-4 border-t border-border empty:hidden empty:pt-0 empty:border-t-0">
                  <SeatVendorFacts entityKind="org_role" entityId={role.id} serviceName={vendorName} />
                </div>
              )}
              </Suspense>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

export default function Roles() {
  // An old link to one role, read once on arrival; it lands on that role's own page once the roles load.
  const [, navigate] = useLocation();
  const [link] = useState(oldLink);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [linkMissed, setLinkMissed] = useState(false);
  // The page holds the view: on the team sheet it draws the roles held now below its groups.
  const [lineupView, setLineupView] = useLineupView();
  // The roles stay behind step one until the visitor picks an archetype (which leaves the
  // page) or presses "See all roles". A link to one seat is a question about that seat, so it shows them
  // (it lands on the seat's own page, or says in one line that the seat is gone, with every role listed).
  const [showAll, setShowAll] = useState(link.seat !== null);
  const allHeading = useRef<HTMLHeadingElement>(null);
  const revealed = useRef(link.seat !== null);
  useEffect(() => {
    if (showAll && !revealed.current) allHeading.current?.focus();
    revealed.current = showAll;
  }, [showAll]);
  const [roles, setRoles] = useState<RoleEntry[] | null>(null);
  const [circles, setCircles] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [people, setPeople] = useState<PeopleTier | null>(null);
  const [village, setVillage] = useState<unknown>(undefined);
  const [historyShown, setHistoryShown] = useState(false);
  const [seatCounts, setSeatCounts] = useState({ seats: 0, held: 0 });
  // The founding team section (org.founding_team). Null until read; a failed read is the section off.
  const [founding, setFounding] = useState<FoundingTeamAnswer | null>(null);
  // Bumped by "Try again" after a failed read of the founding team.
  const [foundingTries, setFoundingTries] = useState(0);
  // VERIFY 2.2: the server sends an unlisted role to a steward or an admin, with its chip. The
  // page used to list them all by default, so a founder checking "List only these" still saw
  // every role and read the update as not taken. Now the page shows what a visitor sees, and
  // the admin view is one switch away.
  const [showUnlisted, setShowUnlisted] = useState(false);
  useEffect(() => {
    let live = true;
    void readFoundingTeam().then((a) => live && setFounding(a));
    return () => {
      live = false;
    };
  }, [foundingTries]);
  // Who may say what a seat is held for. The server refuses everybody else by
  // itself; this only decides whether the control is drawn.
  const { user } = useAuth();
  // What this member says they can give now (0383): a role that needs more than that, and says it is required, waits behind one press.
  const memberPct = useMyCommitment(!!user).pct;
  const [showBeyond, setShowBeyond] = useState(false);
  const { t } = useLingui();
  const canTagNeeds = !!user && (user.role === "admin" || user.role === "founder");
  const isAdmin = useIsAdmin();
  // "Show only what matches my roots": the same filter and rule the quests board runs.
  const roots = useRootsFilter(user?.id ?? null);
  // The card's clock and the village's class names: one cached read each for
  // the whole page, however many rows are opened.
  const season = useSeason();
  const classNames = useClassNames();
  // A raised hand posts under `/api/map`, which the map module gates. Offered
  // only while this reader's catalog lists the module as on: a catalog that
  // failed to load offers nothing, because the door would answer 404.
  const map = useModule("map");
  const raiseHand = !!map && map.lifecycle !== "off";

  // Seats are rows now (0049), not cards in a document. `state` arrives
  // DERIVED from live holdings against the seat count, so the page can no
  // longer show a seat marked filled with nobody in it, which the card-shaped
  // chart did for two seats at once.
  //
  // `gameFetch` carries the member's token; the bare `fetch` this replaces did
  // not. `/api/org` tiers holder names behind `map.viewPeople` and reads the
  // Authorization header alone, so this page asked as a stranger every time
  // and the holders list was empty for every reader it ever had.
  useEffect(() => {
    gameFetch("/api/org")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!data || !Array.isArray(data.roles)) throw new Error("bad shape");
        const circleById = new Map<string, any>(
          (data.circles ?? []).map((c: any) => [c.id, c]),
        );
        setCircles(data.circles ?? []);
        setPeople(data.people ?? null);
        setVillage(data.village);
        setHistoryShown(seatHistoryShown(data.people, data.roles));
        setSeatCounts({
          seats: (data.roles as any[]).reduce((n, r: any) => n + Number(r.seats ?? 0), 0),
          held: (data.roles as any[]).reduce((n, r: any) => n + Number(r.holderCount ?? 0), 0),
        });
        setRoles(
          (data.roles as any[]).map((r: any, i: number) => ({
            id: String(r.id ?? `role-${i}`),
            name: String(r.name ?? "Untitled role"),
            circleId: r.circleId ?? null,
            group: String(circleById.get(r.circleId)?.name ?? "Unplaced roles"),
            status: normalizeStatus(r.state),
            // An agent's member row carries a vendor's name; the header says
            // "An agent", as the card under it and the public tier do.
            holders: (r.holders ?? []).map(orgHolderName).filter((n: string | null): n is string => !!n),
            icon: r.icon ?? undefined,
            color: r.color ?? undefined,
            isExample: !!r.isExample,
            raw: r,
            path: rolePath({ id: String(r.id ?? `role-${i}`), name: r.name, slug: r.slug }, data.roles),
          })),
        );
      })
      .catch(() => setFailed(true));
  }, []);

  // An old link to one role becomes its own page, replacing the entry; a gone role says so in one line.
  useEffect(() => {
    if (!roles || (!link.seat && !link.hash)) return;
    const hit = roleForOldLink(link, roles.filter((r) => !r.isExample));
    if (hit) {
      navigate(hit.path, { replace: true });
      return;
    }
    if (link.seat) {
      setLinkMissed(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("seat");
      url.searchParams.delete("role");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [roles, link, navigate]);

  const toggle = (id: string) => {
    setExpandedRole(expandedRole === id ? null : id);
    setLinkMissed(false);
  };
  const sheet: SheetSource = {
    circles,
    people,
    village,
    ctx: { now: new Date(), season: seasonForSheet(season), classNames },
    raiseHand,
    historyShown,
  };

  // The circle the others link back to is the village's own top circle, or
  // none. This line named "the General Coordinating Circle" to every village.
  // Held invisible until /api/org answers, so the sentence never grows a
  // clause in front of the reader.
  const anchorId = anchorCircleId(circles);
  // The anchor circle's own purpose is its tooltip on every role card here (the lead, 20 Nov 2026; CardTips.tsx).
  const anchorRow = circles.find((c) => String(c?.id) === anchorId);
  const anchorTip = useMemo(() => (anchorRow?.name ? { name: String(anchorRow.name), purpose: String(anchorRow.purpose ?? "") } : null), [anchorRow?.name, anchorRow?.purpose]);

  // Grouped by circle, in the order the village sorted its circles, with a
  // dormant circle's seats still listed under it.
  const circleOrder = new Map(circles.map((c, i) => [c.name, i]));
  const featured: FoundingRole[] = founding?.on
    ? founding.roleIds
        .map((id) => (roles ?? []).find((r) => r.id === id))
        .filter((r): r is RoleEntry => !!r && r.raw?.listed !== false)
        .map((r) => ({ seat: r.raw, circleName: r.group, sections: founding.sections[r.id] ?? null, path: r.path, settings: termsSlotFor(r.raw) }))
    : [];
  const otherWays = founding?.otherWays ?? DEFAULT_OTHER_WAYS;
  const leads = featured.length > 0;
  // One h1 per page: the founding team's heading while it leads, the page's own otherwise.
  const HeroHeading = leads ? "h2" : "h1";
  // The header waits for both reads, so it never draws on top and then jumps below the founding team.
  const heroShown = founding !== null && (!founding.on || roles !== null || failed);
  const featuredShown = new Set(featured.map((f) => String(f.seat.id)));
  // Hiring the founding team first (Rye, 14 Nov 2026): while it leads, every other listed role that is
  // still open sits right under it as "opening next", applied for now and answered once the team is in.
  // Future ventures (the Operations Steward, 16 Nov 2026): their own section while the founding team leads, with no lead.
  // The ventures open now come first, each in its own order (the lead, 23 Nov 2026: highlight the ones open now).
  const ventures = leads ? (roles ?? []).filter((r) => r.raw?.futureVenture === true && !r.isExample && !featuredShown.has(r.id)).sort((a, b) => Number(ventureOpenNow(b.raw)) - Number(ventureOpenNow(a.raw))) : [];
  const ventureIds = new Set(ventures.map((r) => r.id));
  // Coming soon (the lead, 19 Nov 2026): directly under the open roles and above the roles held now, each with its
  // waitlist. Shown even while unlisted, as a coming-soon role always is (shared/roleListing.ts).
  const liveCircles = circles.filter((c: any) => c && c.status !== "dormant" && !c.isExample);
  const soon = (roles ?? []).filter((r) => r.raw?.comingSoon === true && r.raw?.futureVenture !== true && !r.isExample && r.status !== "filled" && !featuredShown.has(r.id));
  const soonIds = new Set(soon.map((r) => r.id));
  // Every upcoming role will be paid (the lead, 23 Nov 2026): each says so unless its track says otherwise (soonIsPaid).
  const soonRoles: SoonRole[] = soon.map((r) => ({ id: r.id, name: r.name, aim: typeof r.raw?.aim === "string" ? r.raw.aim : null, circleName: r.group || null, paid: soonIsPaid(r.raw) }));
  // Future ventures and the coming-soon roles each get their own group while the founding team leads (the lead,
  // 20 Nov 2026: Open roles, then Open ventures, then Upcoming roles).
  const openingNext = leads ? (roles ?? []).filter((r) => !featuredShown.has(r.id) && !ventureIds.has(r.id) && !soonIds.has(r.id) && r.raw?.listed !== false && !r.isExample && r.status !== "filled") : [];
  // Held and still recruiting (the lead, 17 Nov 2026): it stays where held roles sit and keeps its Apply.
  const welcomesMore = (r: RoleEntry) => heldButRecruiting(r.raw) && mayApply(r.raw);
  const welcomingIds = new Set((roles ?? []).filter(welcomesMore).map((r) => r.id));
  // Roles this lead will build (Rye, 16 Nov 2026): each lead's coming-soon roles, by the circles it leads.
  const builds: Record<string, BuiltRole[]> = Object.fromEntries(
    featured.map((f) => {
      const id = String(f.seat.id);
      const soon = rolesLeadWillBuild(id, (roles ?? []).map((r) => ({ ...r.raw, id: r.id, circleId: r.circleId ?? null })), circles);
      // The roles already held in the circles this steward leads sit beside them, as Held, with no Apply (the content list, 16 Nov 2026).
      const led = new Set(circles.filter((c: any) => c.leadRoleId === id).map((c: any) => String(c.id)));
      const held = (roles ?? []).filter((r) => r.id !== id && !!r.circleId && led.has(r.circleId) && !r.isExample && r.raw?.futureVenture !== true && r.raw?.listed !== false && r.status === "filled");
      return [
        id,
        [
          ...soon.map((r: any) => ({ id: String(r.id), name: String(r.name ?? ""), aim: r.aim ?? null })),
          ...held.map((r) => ({ id: r.id, name: r.name, aim: r.raw?.aim ?? null, held: true, heldByAgent: r.raw?.heldByAgent === true, recruiting: welcomingIds.has(r.id) })),
        ],
      ];
    }),
  );
  // A built role opens in its own row, in "opening next" or the directory, and is scrolled to.
  const openBuilt = (id: string) => {
    // A coming-soon role opens its waitlist card (ComingSoonRoles follows the hash).
    if (soonIds.has(id)) {
      window.location.hash = waitlistHash(id);
      return;
    }
    setExpandedRole(id);
    requestAnimationFrame(() => document.querySelector(`[data-role-row="${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: "start", behavior: prefersReducedMotion() ? "instant" : "smooth" }));
  };
  const openingNextIds = new Set(openingNext.map((r) => r.id));
  const unlistedCount = (roles ?? []).filter((r) => r.raw?.listed === false).length;
  // Each role appears once: a featured role lives in the founding section.
  const listedDirectory = (roles ?? []).filter((r) => (showUnlisted || r.raw?.listed !== false) && !featuredShown.has(r.id) && !openingNextIds.has(r.id) && !ventureIds.has(r.id) && !soonIds.has(r.id));
  // The roots filter hides only roles tagged with none of the reader's roots.
  const byRoots = roots.apply(listedDirectory, (r) => (Array.isArray(r.raw?.archetypes) ? r.raw.archetypes : []));
  const rootKept = new Set(byRoots.shown.map((r) => r.id));
  const rooted = listedDirectory.filter((r) => rootKept.has(r.id));
  // Filters work for the reader alone, never ranks anyone.
  const reach = rolesWithinReach(rooted, (r) => ({ commitmentPct: r.raw?.card?.commitmentPct ?? null, commitmentRequired: r.raw?.card?.commitmentRequired === true }), memberPct);
  // The founding team is held to the same reach: a founding role that needs more than the reader has waits too.
  const featuredReach = rolesWithinReach(featured, (f) => ({ commitmentPct: f.seat?.card?.commitmentPct ?? null, commitmentRequired: f.seat?.card?.commitmentRequired === true }), memberPct);
  const featuredHidden = featuredReach.beyond;
  const featuredVisible = showBeyond ? featured : featured.filter((f) => !featuredHidden.includes(f));
  // "Related roles this role will onboard:" in a lead role's row: the coming-soon roles of the circles it leads (the lead, 21 Nov 2026).
  const toBeAdded: Record<string, Array<{ id: string; name: string }>> = Object.fromEntries(Object.entries(builds).map(([id, list]) => [id, list.filter((b) => !b.held).map((b) => ({ id: b.id, name: b.name }))]));
  // "N roles, one timeline" (the lead, 20 Nov 2026): the open founding roles' dated deliverables, one lane each.
  const withDates = featuredVisible.filter((f) => (f.sections?.deliverables?.length ?? 0) > 0);
  const teamRows = withDates.length >= 2 ? withDates.flatMap((f) => (f.sections?.deliverables ?? []).map((d) => ({ ...d, role: String(f.seat.name ?? "") }))) : [];
  const teamTitle = t({ message: `${withDates.length} roles, one timeline`, context: "founding team: every open role's dated outcomes on one timeline" });
  const teamTimeline = teamRows.length > 0 ? <FoldedTeamTimeline rows={teamRows} title={teamTitle} /> : null;
  const roleCount = (n: number) => <span className="text-lg font-normal text-muted-foreground">({n})</span>;
  // The first group's heading, over the founding team's roles and the roles opening next.
  const openHeading = (
    <h2 id="open-now-heading" className={GROUP_H2}>
      {t({ message: "Open roles", context: "team sheet group" })} {roleCount(featuredVisible.length + openingNext.length)}
    </h2>
  );
  // The rest of the founding circle, for the team view (Rye, 14 Nov): the roles someone already holds
  // in the circles the founding roles sit in, holders named only as /api/org names them to this reader.
  const featuredIds = new Set(featured.map((f) => String(f.seat.id)));
  const foundingCircles = new Set(featured.map((f) => f.seat.circleId).filter(Boolean));
  const foundingFilled = (roles ?? [])
    .filter((r) => !featuredIds.has(r.id) && r.circleId && foundingCircles.has(r.circleId) && r.raw?.listed !== false && !r.isExample && (r.status === "filled" || r.status === "partial" || (r.holders?.length ?? 0) > 0))
    .map((r) => ({ id: r.id, name: r.name, holders: r.holders ?? [] }));
  // A held role still recruiting keeps its place on the roster, with an Apply beside it (the lead, 17 Nov 2026).
  const teamFilled = (founding?.team?.length ? founding.team : foundingFilled).map((f) => (welcomingIds.has(f.id) ? { ...f, recruiting: true } : f));
  // The org chart beside the roster (Rye, 16 Nov 2026): the /circles drawing, with the held team roles a
  // visitor's /api/org leaves out (they are unlisted) drawn too, so the picture agrees with the roster.
  const chart = orgChartOf(circles, (roles ?? []).map((r) => r.raw), featured[0]?.seat?.circleId ?? null, teamFilled);
  const orgPreview = chart ? (
    <Suspense fallback={null}>
      <OrgPreview circles={circles} seats={chart.seats} counts={chart.counts} />
    </Suspense>
  ) : null;
  const beyondCount = reach.beyond.length + featuredHidden.length;
  const directory = showBeyond ? rooted : rooted.filter((r) => !reach.beyond.includes(r));
  const rootsOffered = roots.available && byRoots.tagged;
  // 0383: required roles that ask more than the reader can give now, held back with one door to show them.
  // Drawn once: above the founding team when it holds one of them, else above the directory.
  const beyondLine =
    beyondCount > 0 ? (
      <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground" data-roles-beyond={beyondCount}>
                <span>
                  {beyondCount === 1
                    ? t({ message: "1 role needs more time than you have right now.", context: "roles page: required roles beyond the reader's percent, one" })
                    : t({ message: `${beyondCount} roles need more time than you have right now.`, context: "roles page: required roles beyond the reader's percent, several" })}
                </span>
                <button type="button" className="min-h-11 font-medium text-notice underline underline-offset-2 hover:text-foreground" onClick={() => setShowBeyond((v) => !v)} aria-pressed={showBeyond}>
                  {showBeyond ? t({ message: "Hide them again", context: "roles page: hide the roles beyond the reader's percent" }) : t({ message: "Show them anyway", context: "roles page: show the roles beyond the reader's percent" })}
                </button>
              </div>
    ) : null;
  const groups: { title: string; subtitle: string; circleId: string | null; roles: RoleEntry[] }[] = [];
  for (const role of directory) {
    const g = groups.find((x) => x.title === role.group);
    if (g) g.roles.push(role);
    else {
      const circle = circles.find((c) => c.name === role.group);
      groups.push({ title: role.group, subtitle: circle?.purpose ?? "", circleId: circle?.id ?? null, roles: [role] });
    }
  }
  groups.sort(
    (a, b) => (circleOrder.get(a.title) ?? 999) - (circleOrder.get(b.title) ?? 999),
  );


  const otherWaysSection = (
    <>
          {/* Don't see your gift in a role? (the lead, 23 Nov 2026): the other three ways to build, at the end of the lists. */}
          <GiftSection />
          {/* OTHER WAYS TO JOIN: clearly secondary to the founding team, and open from the start. */}
          <section aria-labelledby="other-ways" className={`mx-auto mb-14 max-w-4xl ${featured.length > 0 ? "border-t border-border pt-10" : ""}`} data-other-ways="">
            <h2 id="other-ways" className={`${H2} mb-2`}>{t({ message: "Other ways to join", context: "roles page, other ways to join" })}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{t({ message: "Not every way in is a founding role. Each of these is open now.", context: "roles page, other ways to join" })}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              <li className={TILE}>
                <Link href="/role-proposals/new" className={`inline-flex min-h-11 items-center gap-2 ${LINK}`} data-propose-new-role="">
                  {t({ message: "Propose a new role", context: "roles page, other ways to join" })}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{t({ message: "Propose is for a role we don't list. Tell us the role you see, and the village decides.", context: "roles page, other ways to join" })}</p>
              </li>
              <li className={TILE}>
                <Link href="/quests" className={`inline-flex min-h-11 items-center gap-2 ${LINK}`}>
                  {t({ message: "Take a quest, alone or with others", context: "roles page, other ways to join" })}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </li>
              {/* QA2-07: the resident path and the gifts tile, the village's own words (shared/otherWays.ts). */}
              <li className={TILE} data-other-way="seeder">
                <Link href={otherWays.seeder.href} className={`inline-flex min-h-11 items-center gap-2 ${LINK}`}>
                  {otherWays.seeder.title === OTHER_WAYS_DEFAULTS.seederTitle ? t({ message: "Become a Founding Seeder", context: "roles page, other ways to join" }) : otherWays.seeder.title}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {otherWays.seeder.line === OTHER_WAYS_DEFAULTS.seederLine ? t({ message: "Live here one day? Start on the resident path.", context: "roles page, other ways to join" }) : otherWays.seeder.line}
                </p>
              </li>
              <li className={TILE} data-other-way="gifts">
                <Link href={otherWays.gifts.href} className={`inline-flex min-h-11 items-center gap-2 ${LINK}`}>
                  {otherWays.gifts.title === OTHER_WAYS_DEFAULTS.giftsTitle ? t({ message: "Offer your gifts", context: "roles page, other ways to join" }) : otherWays.gifts.title}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {otherWays.gifts.line === OTHER_WAYS_DEFAULTS.giftsLine ? t({ message: "Volunteer or work-trade: tell us what you would like to give.", context: "roles page, other ways to join" }) : otherWays.gifts.line}
                </p>
              </li>
            </ul>
            {/* QA2-02: while the founding team is featured, the game's way in sits here, quiet and
                secondary, with no "Step one": the founding application keeps the only steps on the page. */}
            {featured.length > 0 && (
              <div className="mt-8" data-game-way="">
                {/* One quiet door (design pass D-04, M3): the roots, the season and the board live on
                    /roles/select, so the paid roles never share a scroll with the game. */}
                <h3 className="font-display text-2xl leading-tight text-foreground">{t({ message: "Find your place in the game", context: "roles page, other ways to join" })}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t({ message: "Choose the root you grow from, see this season's goals, and pick the roles you play.", context: "roles page, other ways to join: the game's door" })}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link href="/roles/select" className={BTN_SECONDARY} data-game-door="">
                    {t({ message: "Explore the game", context: "roles page, other ways to join: the game's door" })}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  {!showAll && (
                    <button type="button" onClick={() => setShowAll(true)} className={`min-h-11 text-sm font-medium ${LINK}`}>
                      {t({ message: "See all roles", context: "roles page archetypes" })}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
    </>
  );

  return (
    <AnchorCircleTip.Provider value={anchorTip}>
    <Layout>
      {/* The sheet's world (docs/DESIGN_RULE.md): the same night ground and display face as the profile. */}
      {/* Until the reads decide whether the founding team leads, the page keeps the leading
          layout's top and holds the season's goals and the other ways back (page speed pass,
          14 Nov 2026): it used to draw the other layout first, 48px more top with the goals
          in view, and then push it all down and away, a layout shift of up to 0.99 on a phone. */}
      <section className={`${WORLD} ${leads || !heroShown ? "pb-16 pt-4 sm:py-16" : "py-16"} sm:py-24`}>
        <div className="container">
          {/* Until the founding team answers, the page says it is loading, and a failed read says so
              with a way to ask again, instead of the founding team silently missing (resilience P2-6).
              The region is there from first paint, so the change is what gets announced. */}
          <div role="status" className="mx-auto max-w-4xl" data-founding-status="">
            {!heroShown && !founding?.failed && (
              <p className="py-10 text-center text-muted-foreground">{t({ message: `Loading roles…`, context: "roles page" })}</p>
            )}
            {founding?.failed && (
              <div className={`${TILE} mb-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between`}>
                <p className="text-sm text-foreground">
                  {t({ message: "We couldn't load the founding team just now.", context: "roles page: the founding team read failed" })}
                </p>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() => {
                    setFounding(null);
                    setFoundingTries((n) => n + 1);
                  }}
                >
                  {t({ message: "Try again", context: "roles page: read the founding team again" })}
                </button>
              </div>
            )}
          </div>
          {/* FOUR WAYS TO BUILD (the lead, 23 Nov 2026), at the top; Join the team points at the open roles below. */}
          <FourWaysSection hrefs={leads ? { team: "#open-now-heading" } : featured.length === 0 ? { team: "/roles/select" } : {}} />
          {leads && (
            <>
              {featuredHidden.length > 0 && beyondLine}
              {/* 1. OPEN ROLES: the founding team's full cards, each role in its own frame, then the roles opening next. */}
              {featuredVisible.length > 0 && <FoundingTeam lead roles={featuredVisible} villagePay={founding?.villagePay ?? null} filled={teamFilled} orgPreview={orgPreview} fill={founding?.fill ?? {}} laterCount={openingNext.length} builds={builds} onOpenBuilt={openBuilt} view={lineupView} onView={setLineupView} heading={openHeading} toBeAdded={toBeAdded} sheetRoster={false} comingSoon={teamTimeline} />}
              {featuredVisible.length === 0 && openingNext.length > 0 && <div className="mx-auto mb-6 max-w-4xl">{openHeading}</div>}
              {openingNext.length > 0 && (
                <section id="opening-next" aria-labelledby="opening-next-heading" className="mx-auto mb-14 max-w-4xl scroll-mt-24" data-opening-next={openingNext.length}>
                  <h3 id="opening-next-heading" className={`${H2} mb-2`}>{t({ message: "More roles, opening next", context: "roles page, roles after the founding team" })}</h3>
                  <p className="mb-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {t({ message: "We're filling the founding team first, so it may be a while before we reply. You're welcome to apply now, and we'll write to you as soon as we're ready to talk.", context: "roles page, roles after the founding team" })}
                  </p>
                  {/* Hear first about new roles (Rye, 15 Nov 2026): the community calls, and the newsletter when the village has one. */}
                  <p className="mb-6 max-w-2xl text-sm leading-relaxed text-foreground" data-hear-first="">
                    {t({ message: "Hear first about new opportunities:", context: "roles page, roles after the founding team" })}{" "}
                    <Link href="/events" className={LINK}>{t({ message: "join a community call", context: "roles page, roles after the founding team" })}</Link>
                    {otherWays.newsletter ? (
                      <>
                        {" "}
                        {t({ message: "and", context: "roles page, hear first: join a call and sign up" })}{" "}
                        <a href={otherWays.newsletter} target="_blank" rel="noopener noreferrer" className={LINK}>{t({ message: "sign up for our newsletter", context: "roles page, roles after the founding team" })}</a>
                      </>
                    ) : null}
                    .
                  </p>
                  <div className={ROWS}>
                    {openingNext.map((role, i) => (
                      <RoleCard key={role.id} role={role} expanded={expandedRole === role.id} onToggle={() => toggle(role.id)} index={i} canTagNeeds={canTagNeeds} sheet={sheet} />
                    ))}
                  </div>
                </section>
              )}
              {/* 2. OPEN VENTURES: a row the village flagged `futureVenture` (0399). With none, the group says so. */}
              <section id="future-ventures" aria-labelledby="future-ventures-heading" className={`mx-auto mb-14 max-w-4xl scroll-mt-24 lg:max-w-6xl ${GROUP_BREAK}`} data-future-ventures={ventures.length}>
                <p className={EYEBROW}>{t({ message: "Build with us", context: "roles page, the open ventures' eyebrow" })}</p>
                <h2 id="future-ventures-heading" className={`${GROUP_H2} mt-1 mb-2`}>
                  {t({ message: "Open ventures", context: "roles page, ventures to build and run, applied for with a pitch" })} {roleCount(ventures.length)}
                </h2>
                {/* What a venture is, and the one door to pitch your own (the lead, 23 Nov 2026). */}
                <p className="mb-2 max-w-2xl text-base leading-relaxed text-foreground" data-venture-explainer="">
                  {t({ message: "A venture is a business you build and run on the land with the village. You earn from what you build; it is separate from a paid role.", context: "roles page, open ventures: what a venture is" })}
                </p>
                <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {t({ message: "Pieces of the village we're inviting people to build and run. Bring your venture: apply to hold one, and pitch your vision.", context: "roles page, open ventures" })}
                </p>
                <StartVentureButton />
                {ventures.length > 0 ? (
                  <div className="grid items-start gap-4 lg:grid-cols-2" data-ventures-grid="">
                    {/* Two columns on a desktop (the lead, 21 Nov 2026); an opened venture takes the full width. */}
                    {ventures.map((role, i) => (
                      <div key={role.id} className={expandedRole === role.id ? "lg:col-span-2" : undefined}><RoleCard role={role} expanded={expandedRole === role.id} onToggle={() => toggle(role.id)} index={i} canTagNeeds={canTagNeeds} sheet={sheet} /></div>
                    ))}
                  </div>
                ) : (
                  <p className={`${TILE} text-sm text-muted-foreground`} data-ventures-none="">
                    {t({ message: "No venture is open yet. When the village opens one, it shows here.", context: "roles page, no open venture" })}{" "}
                    <Link href="/role-proposals/new" className={LINK} data-ventures-propose="">{t({ message: "Have one in mind? Propose it.", context: "roles page, no open venture: propose one as a new role" })}</Link>
                  </p>
                )}
              </section>
              {/* 3. UPCOMING ROLES: the coming-soon roles, each with its waitlist and Apply early. */}
              {soonRoles.length > 0 && (
                <div className="mx-auto mb-14 max-w-4xl lg:max-w-6xl">
                  <ComingSoonRoles roles={soonRoles} className={GROUP_BREAK} />
                </div>
              )}
              {/* The roles held now, as the team sheet drew them, with the org chart (Rye, 16 and 17 Nov 2026). */}
              {lineupView === "sheet" && featuredVisible.length > 0 && teamFilled.length > 0 && (
                <section aria-labelledby="holding-now-heading" className="mx-auto mb-14 max-w-6xl" data-holding-now={teamFilled.length}>
                  <h2 id="holding-now-heading" className="mb-3 text-xs font-bold uppercase tracking-widest text-notice">{t({ message: "Holding it now", context: "team sheet group: the roles held now" })}</h2>
                  <div className={`grid gap-4 ${orgPreview ? "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : ""}`}>
                    {/* First in the page order, so a phone meets the door to the org chart above the cards. */}
                    {orgPreview && <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1" data-org-preview="">{orgPreview}</div>}
                    <Suspense fallback={null}>
                      <RosterList filled={teamFilled} team={featured[0]?.circleName ?? null} variant="sheet" className={`grid gap-3 sm:grid-cols-2 ${orgPreview ? "lg:col-start-1 lg:row-start-1 xl:grid-cols-3" : "lg:grid-cols-3"}`} />
                    </Suspense>
                  </div>
                </section>
              )}
              {otherWaysSection}
            </>
          )}

          {/* Header: below "Other ways to join" while the founding team leads (design pass M1 and D-04). */}
          {heroShown && (
          <>
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className={`${RING} mx-auto mb-6 size-16`}>
              <Briefcase className="w-7 h-7" aria-hidden="true" />
            </div>
            <HeroHeading className={`${H1} mb-4`}>
              {t({ message: `Roles and Circles`, context: "roles page" })}
            </HeroHeading>
            {/* One circle for now (Rye, 14 Nov 2026, through the coordinator): the Anchor Circle holds the whole village.
                Nothing here implies hiring or building circles. */}
            {/* Said only while the village has one live circle, named from the data (the lead, 19 Nov 2026: other circles
                now hold roles, so a line naming one circle as the whole village would be untrue). */}
            {liveCircles.length === 1 && (
              <p className="text-lg leading-relaxed text-muted-foreground max-w-2xl mx-auto sm:text-xl" data-anchor-only="">
                {t({ message: `For now the ${String(liveCircles[0].name ?? "")} holds the whole village. Other circles grow only if and when the work needs them.`, context: "roles page intro, one circle for now" })}
              </p>
            )}
            <div className="mt-4 flex justify-center">
              <NewRoleFromCardButton onMade={() => window.location.reload()} />
            </div>
            {canTagNeeds && (
              <p className="mt-3 text-sm">
                <Link href="/role-measures" className={LINK}>
                  {t({ message: "How roles are going", context: "roles page measures door" })}
                </Link>
              </p>
            )}
            {/* The draft board: pick characters, scout, shortlist, apply (pages/RoleDraft.tsx). While the
                founding team is featured, its one act per card is the page's primary act, so this stays off. */}
            {featured.length === 0 && (
              <Link
                href="/roles/select"
                className={`mt-6 ${BTN_PRIMARY}`}
              >
                {t({ message: "Browse the open roles", context: "roles page button" })}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </m.div>
          </>
          )}
          {heroShown && !leads && otherWaysSection}

          {/* The season's goals are the game's register: on /roles/select while the founding team leads. */}
          {heroShown && !leads && <SeasonGoals />}
          {featured.length === 0 && <ArchetypeStep allShown={showAll} onSeeAll={() => setShowAll(true)} />}

          <div className="max-w-4xl mx-auto">
            {/* Offered here because this is the page that names you: the
                seat the village wrote down under your name is right below.
                Renders nothing for anyone with nothing to claim, which is
                every visit after the first. */}
            <SeatClaimCard />
            {isAdmin && (
              <Suspense fallback={null}>
                <WaitlistAdmin />
              </Suspense>
            )}
            {/* How it works */}
            <m.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mb-14 grid sm:grid-cols-2 gap-4"
            >
              {[
                { label: t({ message: `Roles`, context: "roles page, how it works" }), description: t`Specific responsibilities inside a circle. One person can hold many roles. If a person leaves, the role stays and gets reassigned.` },
                { label: t({ message: `Consent`, context: "roles page, how it works" }), description: t`Decisions move forward when no one has a reasoned objection that the proposal would cause harm or block the aim. Everyone loving them is not the bar.` },
              ].map((item) => (
                <div key={item.label} className={TILE}>
                  <div className="text-sm font-bold text-foreground mb-1">{item.label}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </m.div>

            {showAll && (
              <div>
                <h2 ref={allHeading} tabIndex={-1} className="mb-8 font-display text-3xl text-foreground focus:outline-none">
                  {t({ message: "All roles and circles", context: "roles page archetypes" })}
                </h2>
            {/* Members-only people: every seat card below still carries its
                aim, its domain and whether it is held. This says whose names
                are missing and how to reach them. */}
            {roles !== null && (
              <div className="mb-12">
                <PeopleLockNote people={people} seats={seatCounts.seats} held={seatCounts.held} />
              </div>
            )}
            {/* "Show only what matches my roots", offered only when some role carries roots. */}
            {rootsOffered && (
              <div className="mb-8">
                <RootsFilterToggle filter={roots} total={listedDirectory.length} shown={rooted.length} noun="roles" />
              </div>
            )}
            {featuredHidden.length === 0 && beyondLine}
            {/* The admin view: only a reader the server sent unlisted roles to has anything to switch on. */}
            {unlistedCount > 0 && (
              <label className="mb-8 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground" data-show-unlisted="">
                <input type="checkbox" className="size-5 accent-notice" checked={showUnlisted} onChange={(e) => setShowUnlisted(e.target.checked)} />
                <span>
                  {t({ message: `Show the ${unlistedCount} roles visitors do not see (admin view)`, context: "roles page, steward switch for unlisted roles" })}
                </span>
              </label>
            )}
            {roles !== null && featured.length > 0 && groups.length === 0 && (
              <p className="mb-8 text-sm text-muted-foreground">{t({ message: "The roles open now are the founding roles above.", context: "roles page, empty directory" })}</p>
            )}
            {/* Same always-present polite region as Circles.tsx: the node is
                in the DOM from first paint, so the change from the loading
                line to the failure line is the thing announced. */}
            <div role="status">
              {roles === null && !failed && (
                <div className="text-center text-muted-foreground py-16">{t({ message: `Loading roles…`, context: "roles page" })}</div>
              )}
              {failed && (
                <div className="text-center text-muted-foreground py-16">
                  {t`The roles list is catching its breath. Please refresh in a moment.`}
                </div>
              )}
              {linkMissed && (
                <p className="text-center text-sm text-muted-foreground mb-8">
                  {t`That role is not on this page anymore.`}
                </p>
              )}
            </div>

            {groups.map(({ title, subtitle, circleId, roles: groupRoles }) => (
              <div className="mb-14" key={title}>
                <div className="mb-6">
                  <h2 className={`${H2} mb-1`}>{circleId ? <CircleName name={title} anchor={circleId === anchorId} /> : title}</h2>
                  {subtitle && (
                    <p className="text-muted-foreground text-sm">{subtitle}</p>
                  )}
                  {/* The circle's own card: its words, its roles and who agreed to them. */}
                  {circleId ? (
                    <Link
                      href={`/circles/${encodeURIComponent(circleId)}`}
                      className={`inline-flex min-h-11 items-center text-sm ${LINK}`}
                    >
                      {t`Open this circle's card`}
                    </Link>
                  ) : null}
                </div>
                <div className={ROWS}>
                  {groupRoles.map((role, i) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      expanded={expandedRole === role.id}
                      onToggle={() => toggle(role.id)}
                      index={i}
                      canTagNeeds={canTagNeeds}
                      sheet={sheet}
                    />
                  ))}
                </div>
              </div>
            ))}

              </div>
            )}

            {/* Upcoming roles, after the roles open now (the lead, 20 Nov 2026: the groups in this order). */}
            {!leads && soonRoles.length > 0 && (
              <div className="mb-14">
                <ComingSoonRoles roles={soonRoles} />
              </div>
            )}

            {/* When a tension is between people: the village's own restorative
                steps, the same ones /governance prints. This block used to be
                a compiled process every fork published as its own, sending
                tensions up to a "Leadership Circle" no fork is given and
                promising a trial period and an evaluation that nothing in the
                platform schedules. The reasoning is in VillageConflictSteps. */}
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`mt-4 ${CARD}`}
            >
              <h2 className={`${H2} mb-4`}>
                {t({ message: "How we evolve through conflict", context: "roles page, conflict steps heading" })}
              </h2>
              <Suspense fallback={null}>
                <VillageConflictSteps />
              </Suspense>
            </m.div>
          </div>

        </div>
      </section>
    </Layout>
    </AnchorCircleTip.Provider>
  );
}
