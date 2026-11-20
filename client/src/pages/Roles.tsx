/**
 * /roles: AN INDEX OF ROLES, ONE CARD EACH (the lead, 20 Nov 2026: "redesign /roles so roles are easy to tell apart").
 *
 * The page used to open the first founding role's whole card inline, with the roles that steward will build
 * between it and the next role, so a reader could not tell where one role ended. Now every role is one compact,
 * bounded card (RoleIndexCard.tsx) with the same anatomy, grouped by status under headings with counts:
 * "Open now", "Coming soon", "Future ventures". Nothing expands inline and nothing pops out: the whole role, with
 * its one-minute panel, its tabs, its phone Apply and its share link, lives on its own page, `/roles/<slug>`
 * (RoleShare.tsx). A steward's coming-soon roles are one line inside its card.
 *
 * WHICH GROUP. From the `/api/org` row itself, never from a guess: `futureVenture: true` is a future venture
 * (0399), `comingSoon: true` is coming soon (unless someone already holds it, as before), and every other listed
 * role nobody fully holds is open now, the founding team's roles first, in the village's order. A held role still
 * recruiting stays on the roster with its Apply (the lead, 17 Nov 2026).
 *
 * OLD LINKS. `/roles?seat=<id>`, `/roles?role=<id>` and `/roles#<id>` (or `#role-<id>`, or `#<slug>`) used to
 * open a row on this page. They now replace themselves with the role's own page. `#waitlist-<id>` still opens
 * that coming-soon card's waitlist here (ComingSoonRoles.tsx).
 */
import ArchetypeStep from "@/components/roleDraft/ArchetypeStep";
import SeasonGoals from "@/components/roleDraft/SeasonGoals";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, H1, H2, LINK, TILE, WORLD } from "@/components/journey/look";
import Layout from "@/components/Layout";
import { Link, useLocation } from "wouter";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { anchorCircleId } from "@shared/circlePicker";
import { AnchorCircleTip } from "@/components/roleCard/CardTips";
import { rolePath } from "@shared/roleSlug";
import SeatClaimCard from "@/components/SeatClaimCard";
import { gameFetch } from "@/lib/gameApi";
import { NewRoleFromCardButton } from "@/components/roleEdit/EditRoleButton";
import { useAuth, useIsAdmin } from "@/contexts/AuthContext";
import ComingSoonRoles, { type SoonRole } from "@/components/roleCard/ComingSoonRoles";
import { useMyCommitment } from "@/lib/useMyCommitment";
import { rolesWithinReach } from "@shared/commitment";
import { useLingui } from "@lingui/react/macro";
import { isSeatState, type SeatStateWord } from "@shared/roleSheet";
import { orgHolderName } from "@shared/roleSheetInputs";
import type { FilledRole } from "@/components/roleCard/RosterCards";
import { orgChartOf } from "@/components/roleCard/orgChart";
import { heldButRecruiting, rolesLeadWillBuild } from "@shared/roleListing";
import { applyHrefForRole, mayApply } from "@/components/roleCard/FullRoleCard";
import RoleIndexCard from "@/components/roleCard/RoleIndexCard";
import { readFoundingTeam, type FoundingTeamAnswer } from "@/components/roleCard/roleCardApi";
import { DEFAULT_OTHER_WAYS, OTHER_WAYS_DEFAULTS } from "@shared/otherWays";
import RootsFilterToggle from "@/components/roots/RootsFilterToggle";
import { useRootsFilter } from "@/components/roots/useRootsFilter";

// Below the cards, so each loads after the first view (scripts/route-first-view.json).
const OrgPreview = lazy(() => import("@/components/roleCard/OrgPreview"));
const RosterList = lazy(() => import("@/components/roleCard/RosterCards"));
const DeliverablesGantt = lazy(() => import("@/components/roleCard/DeliverablesGantt"));
// Who asked to hear when a coming-soon role opens: admins only, loaded only for them.
const WaitlistAdmin = lazy(() => import("@/components/roleCard/WaitlistAdmin"));
const VillageConflictSteps = lazy(() => import("@/components/governance/VillageConflictSteps"));

interface RoleEntry {
  id: string;
  name: string;
  /** The circle this seat sits in, resolved from its id to a display name. */
  group: string;
  circleId: string | null;
  status: SeatStateWord;
  holders: string[];
  isExample: boolean;
  /** The `/api/org` row as it arrived, which the card reads for itself. */
  raw: any;
  /** Its own page's address, `/roles/<slug>` (shared/roleSlug.ts). */
  path: string;
}

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

export default function Roles() {
  const { t } = useLingui();
  const [, navigate] = useLocation();
  const [link] = useState(oldLink);
  const [linkMissed, setLinkMissed] = useState(false);
  const [roles, setRoles] = useState<RoleEntry[] | null>(null);
  const [circles, setCircles] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  // The founding team section (org.founding_team). Null until read; a failed read is the section off.
  const [founding, setFounding] = useState<FoundingTeamAnswer | null>(null);
  // Bumped by "Try again" after a failed read of the founding team.
  const [foundingTries, setFoundingTries] = useState(0);
  // VERIFY 2.2: the page shows what a visitor sees, and the roles a visitor does not see are one switch away.
  const [showUnlisted, setShowUnlisted] = useState(false);
  useEffect(() => {
    let live = true;
    void readFoundingTeam().then((a) => live && setFounding(a));
    return () => {
      live = false;
    };
  }, [foundingTries]);
  const { user } = useAuth();
  // What this member says they can give now (0383): a role that needs more than that, and says it is required, waits behind one press.
  const memberPct = useMyCommitment(!!user).pct;
  const [showBeyond, setShowBeyond] = useState(false);
  const canTagNeeds = !!user && (user.role === "admin" || user.role === "founder");
  const isAdmin = useIsAdmin();
  // "Show only what matches my roots": the same filter and rule the quests board runs.
  const roots = useRootsFilter(user?.id ?? null);

  // `gameFetch` carries the member's token: `/api/org` tiers holder names behind `map.viewPeople`.
  useEffect(() => {
    gameFetch("/api/org")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!data || !Array.isArray(data.roles)) throw new Error("bad shape");
        const circleById = new Map<string, any>((data.circles ?? []).map((c: any) => [c.id, c]));
        setCircles(data.circles ?? []);
        setRoles(
          (data.roles as any[]).map((r: any, i: number) => ({
            id: String(r.id ?? `role-${i}`),
            name: String(r.name ?? "Untitled role"),
            circleId: r.circleId ?? null,
            group: String(circleById.get(r.circleId)?.name ?? "Unplaced roles"),
            status: normalizeStatus(r.state),
            // An agent's member row carries a vendor's name; the roster says "An agent".
            holders: (r.holders ?? []).map(orgHolderName).filter((n: string | null): n is string => !!n),
            isExample: !!r.isExample,
            raw: r,
            path: rolePath({ id: String(r.id ?? `role-${i}`), name: r.name, slug: r.slug }, data.roles),
          })),
        );
      })
      .catch(() => setFailed(true));
  }, []);

  // An old link to one role becomes that role's own page, replacing the entry so Back still leaves in one press.
  // A link to a role the page no longer lists says so in one line, and the address drops the role.
  useEffect(() => {
    if (!roles || (!link.seat && !link.hash)) return;
    const hit = roleForOldLink(link, roles);
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

  const anchorId = anchorCircleId(circles);
  // The anchor circle's own purpose is its tooltip on every role card here (the lead, 20 Nov 2026; CardTips.tsx).
  const anchorRow = circles.find((c) => String(c?.id) === anchorId);
  const anchorTip = useMemo(() => (anchorRow?.name ? { name: String(anchorRow.name), purpose: String(anchorRow.purpose ?? "") } : null), [anchorRow?.name, anchorRow?.purpose]);

  const stateWords: Record<SeatStateWord, string> = {
    open: t({ message: `Open`, context: "roles page, role state" }),
    partial: t({ message: `Partly held`, context: "roles page, role state" }),
    filled: t({ message: `Held`, context: "roles page, role state" }),
    forming: t({ message: `Forming`, context: "roles page, role state" }),
    expired: t`Ready to be re-chosen`,
  };

  const all = (roles ?? []).filter((r) => !r.isExample);
  const byId = new Map(all.map((r) => [r.id, r]));
  const featured = founding?.on ? founding.roleIds.map((id) => byId.get(id)).filter((r): r is RoleEntry => !!r && r.raw?.listed !== false) : [];
  const leads = featured.length > 0;
  const featuredIds = new Set(featured.map((r) => r.id));
  const shownToReader = (r: RoleEntry) => showUnlisted || r.raw?.listed !== false;
  // Future ventures: their own group, whatever their state, as before.
  const ventures = all.filter((r) => r.raw?.futureVenture === true && !featuredIds.has(r.id));
  // Coming soon: shown even while unlisted, as a coming-soon role always is (shared/roleListing.ts), until someone holds it.
  const soon = all.filter((r) => r.raw?.comingSoon === true && r.raw?.futureVenture !== true && r.status !== "filled" && !featuredIds.has(r.id));
  const soonIds = new Set(soon.map((r) => r.id));
  const ventureIds = new Set(ventures.map((r) => r.id));
  // Open now: the founding team first, in the village's order, then every other listed role nobody fully holds.
  const rest = all.filter((r) => !featuredIds.has(r.id) && !soonIds.has(r.id) && !ventureIds.has(r.id) && shownToReader(r) && r.status !== "filled");
  // The roots filter hides only roles tagged with none of the reader's roots.
  const byRoots = roots.apply(rest, (r) => (Array.isArray(r.raw?.archetypes) ? r.raw.archetypes : []));
  const rootKept = new Set(byRoots.shown.map((r) => r.id));
  const rooted = rest.filter((r) => rootKept.has(r.id));
  const openAll = [...featured, ...rooted];
  // Filters work for the reader alone, never rank anyone.
  const reach = rolesWithinReach(openAll, (r) => ({ commitmentPct: r.raw?.card?.commitmentPct ?? null, commitmentRequired: r.raw?.card?.commitmentRequired === true }), memberPct);
  const beyondCount = reach.beyond.length;
  const open = showBeyond ? openAll : openAll.filter((r) => !reach.beyond.includes(r));
  const openFeatured = open.filter((r) => featuredIds.has(r.id));
  const openNext = open.filter((r) => !featuredIds.has(r.id));
  const unlistedCount = all.filter((r) => r.raw?.listed === false).length;

  // A held role still recruiting keeps its place on the roster, with an Apply beside it (the lead, 17 Nov 2026).
  const welcomingIds = new Set(all.filter((r) => heldButRecruiting(r.raw) && mayApply(r.raw)).map((r) => r.id));
  // Who holds it now: the team the server sends while the founding team leads (unlisted held roles included),
  // else the founding circles' held roles, else every listed role someone holds.
  const foundingCircles = new Set(featured.map((r) => r.circleId).filter(Boolean));
  const heldRows = all
    .filter((r) => !featuredIds.has(r.id) && r.raw?.listed !== false && (r.status === "filled" || r.status === "partial" || r.holders.length > 0))
    .filter((r) => !leads || (r.circleId && foundingCircles.has(r.circleId)))
    .map((r) => ({ id: r.id, name: r.name, holders: r.holders }));
  const teamFilled: FilledRole[] = (founding?.team?.length ? founding.team : heldRows).map((f) => (welcomingIds.has(f.id) ? { ...f, recruiting: true } : f));
  const chart = leads ? orgChartOf(circles, all.map((r) => r.raw), featured[0]?.circleId ?? null, teamFilled) : null;
  const team = featured[0]?.group ?? null;

  // A steward's coming-soon roles, by the circles it leads, as one line in its card.
  const rows = all.map((r) => ({ ...r.raw, id: r.id, circleId: r.circleId }));
  const childrenOf = (id: string) => rolesLeadWillBuild(id, rows, circles).map((c: any) => ({ id: String(c.id), name: String(c.name ?? ""), path: byId.get(String(c.id))?.path ?? `/roles/${encodeURIComponent(String(c.id))}` }));

  // "N roles, one timeline" (the lead, 20 Nov 2026): the founding roles' dated deliverables, one lane each.
  const withDates = featured.filter((r) => (founding?.sections[r.id]?.deliverables?.length ?? 0) > 0);
  const teamRows = withDates.length >= 2 ? withDates.flatMap((r) => (founding?.sections[r.id]?.deliverables ?? []).map((d) => ({ ...d, role: r.name }))) : [];
  const teamTitle = t({ message: `${withDates.length} roles, one timeline`, context: "founding team: every open role's dated outcomes on one timeline" });

  const otherWays = founding?.otherWays ?? DEFAULT_OTHER_WAYS;
  // The header waits for both reads, so it never draws one layout and then jumps to the other.
  const heroShown = founding !== null && (!founding.on || roles !== null || failed);
  const liveCircles = circles.filter((c: any) => c && c.status !== "dormant" && !c.isExample);

  const card = (r: RoleEntry) => (
    <RoleIndexCard
      key={r.id}
      seat={r.raw}
      path={r.path}
      circleName={r.group}
      kind={r.raw?.futureVenture === true ? "venture" : "open"}
      stateWord={stateWords[r.status]}
      fill={founding?.fill?.[r.id] ?? null}
      whereWords={featuredIds.has(r.id) ? (founding?.sections[r.id]?.where ?? null) : null}
      applyHref={mayApply(r.raw) ? applyHrefForRole(r.id) : null}
      children={childrenOf(r.id)}
    />
  );
  const soonRoles: SoonRole[] = soon.map((r) => ({ id: r.id, name: r.name, seat: r.raw, path: r.path, circleName: r.group }));
  const roleCount = (n: number) => <span className="text-lg font-normal text-muted-foreground">({n})</span>;

  const beyondLine =
    beyondCount > 0 ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground" data-roles-beyond={beyondCount}>
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

  return (
    <AnchorCircleTip.Provider value={anchorTip}>
      <Layout>
        <section className={`${WORLD} pb-16 pt-6 sm:py-14`}>
          <div className="container mx-auto max-w-5xl">
            {/* Until the founding team answers, the page says it is loading, and a failed read says so with a way to ask again. */}
            <div role="status" data-founding-status="">
              {!heroShown && !founding?.failed && <p className="py-10 text-center text-muted-foreground">{t({ message: `Loading roles…`, context: "roles page" })}</p>}
              {founding?.failed && (
                <div className={`${TILE} mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between`}>
                  <p className="text-sm text-foreground">{t({ message: "We couldn't load the founding team just now.", context: "roles page: the founding team read failed" })}</p>
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

            {heroShown && (
              <m.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8" data-roles-header="">
                {leads ? (
                  <>
                    <p className={EYEBROW}>{t({ message: "Founding team", context: "founding team section eyebrow" })}</p>
                    <h1 className={`${H1} mt-2`}>{t({ message: "Join the founding team", context: "founding team section heading" })}</h1>
                    <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                      {t({ message: "We are forming the founding team: the people who will hold each domain of the village, from the foundation through to completion.", context: "founding team section lede" })}
                    </p>
                    {/* Hiring the founding team first (Rye, 14 Nov 2026). */}
                    <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground" data-hiring-first="">
                      {t({ message: "We are filling these roles first. More roles open after them.", context: "founding team section, hiring first" })}{" "}
                      {openNext.length > 0 && (
                        <a href="#opening-next" className={LINK}>
                          {t({ message: "See the roles opening next", context: "founding team section, hiring first" })}
                        </a>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className={H1}>{t({ message: `Roles and Circles`, context: "roles page" })}</h1>
                    {/* Said only while the village has one live circle, named from the data (the lead, 19 Nov 2026). */}
                    {liveCircles.length === 1 && (
                      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground" data-anchor-only="">
                        {t({ message: `For now the ${String(liveCircles[0].name ?? "")} holds the whole village. Other circles grow only if and when the work needs them.`, context: "roles page intro, one circle for now" })}
                      </p>
                    )}
                    <Link href="/roles/select" className={`mt-5 ${BTN_PRIMARY}`}>
                      {t({ message: "Browse the open roles", context: "roles page button" })}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <NewRoleFromCardButton onMade={() => window.location.reload()} />
                  {canTagNeeds && (
                    <Link href="/role-measures" className={`text-sm ${LINK}`}>
                      {t({ message: "How roles are going", context: "roles page measures door" })}
                    </Link>
                  )}
                </div>
              </m.header>
            )}

            {/* Renders nothing for anyone with nothing to claim, which is every visit after the first. */}
            <SeatClaimCard />
            {isAdmin && (
              <Suspense fallback={null}>
                <WaitlistAdmin />
              </Suspense>
            )}

            <div className="mb-6 grid gap-3 empty:hidden">
              {beyondLine}
              {/* "Show only what matches my roots", offered only when some role carries roots. */}
              {roots.available && byRoots.tagged && <RootsFilterToggle filter={roots} total={rest.length} shown={rooted.length} noun="roles" />}
              {/* The admin view: only a reader the server sent unlisted roles to has anything to switch on. */}
              {unlistedCount > 0 && (
                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground" data-show-unlisted="">
                  <input type="checkbox" className="size-5 accent-notice" checked={showUnlisted} onChange={(e) => setShowUnlisted(e.target.checked)} />
                  <span>{t({ message: `Show the ${unlistedCount} roles visitors do not see (admin view)`, context: "roles page, steward switch for unlisted roles" })}</span>
                </label>
              )}
            </div>

            {/* Always in the page, so the change from the loading line to the failure line is what is announced. */}
            <div role="status">
              {roles === null && !failed && heroShown && <div className="py-10 text-center text-muted-foreground">{t({ message: `Loading roles…`, context: "roles page" })}</div>}
              {failed && <div className="py-10 text-center text-muted-foreground">{t`The roles list is catching its breath. Please refresh in a moment.`}</div>}
              {linkMissed && <p className="mb-6 text-center text-sm text-muted-foreground">{t`That role is not on this page anymore.`}</p>}
            </div>

            {roles !== null && (
              <div className="flex flex-col gap-12">
                <section aria-labelledby="open-now-heading" data-open-now={open.length}>
                  <h2 id="open-now-heading" className={H2}>
                    {t({ message: "Open now", context: "team sheet group" })} {roleCount(open.length)}
                  </h2>
                  {openFeatured.length > 0 && <ul className="mt-4 grid gap-4 md:grid-cols-2" data-open-founding="">{openFeatured.map(card)}</ul>}
                  {openNext.length > 0 && (
                    <div id="opening-next" className="mt-6 scroll-mt-24" data-opening-next={openNext.length}>
                      {leads && (
                        <>
                          <h3 className="font-display text-xl text-foreground">{t({ message: "More roles, opening next", context: "roles page, roles after the founding team" })}</h3>
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            {t({ message: "We're filling the founding team first, so it may be a while before we reply. You're welcome to apply now, and we'll write to you as soon as we're ready to talk.", context: "roles page, roles after the founding team" })}
                          </p>
                          {/* Hear first about new roles (Rye, 15 Nov 2026): the community calls, and the newsletter when the village has one. */}
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground" data-hear-first="">
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
                        </>
                      )}
                      <ul className="mt-4 grid gap-4 md:grid-cols-2">{openNext.map(card)}</ul>
                    </div>
                  )}
                  {open.length === 0 && <p className="mt-2 text-sm text-muted-foreground" data-open-none="">{t({ message: "No role is open right now.", context: "roles page, no open role" })}</p>}
                </section>

                {soonRoles.length > 0 && <ComingSoonRoles roles={soonRoles} />}

                {ventures.length > 0 && (
                  <section id="future-ventures" aria-labelledby="future-ventures-heading" className="scroll-mt-24" data-future-ventures={ventures.length}>
                    <h2 id="future-ventures-heading" className={H2}>
                      {t({ message: "Future ventures", context: "roles page, ventures to build and run, applied for with a pitch" })} {roleCount(ventures.length)}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {t({ message: "Pieces of the village we're inviting people to build and run. Apply to hold one, and pitch your vision.", context: "roles page, future ventures" })}
                    </p>
                    <ul className="mt-4 grid gap-4 md:grid-cols-2">{ventures.map(card)}</ul>
                  </section>
                )}

                {/* The founding roles' deliverables on one timeline, below the open roles (the lead, 19 and 20 Nov 2026). */}
                {teamRows.length > 0 && (
                  <section aria-label={teamTitle} className={CARD} data-team-deliverables="">
                    <h2 className={H2}>{teamTitle}</h2>
                    <p className="mb-4 mt-1 text-sm text-muted-foreground">{t({ message: "Tap a bar for its dates. The dotted lines are the gates the roles share.", context: "founding team timeline: how to read it" })}</p>
                    <Suspense fallback={null}>
                      <DeliverablesGantt rows={teamRows} label={teamTitle} />
                    </Suspense>
                  </section>
                )}

                {/* Who holds it now, as a roster (Rye, 17 Nov 2026), with the org chart beside it (Rye, 16 Nov 2026). */}
                {teamFilled.length > 0 && (
                  <section aria-labelledby="holding-now-heading" data-holding-now={teamFilled.length}>
                    <h2 id="holding-now-heading" className={H2}>
                      {t({ message: "Holding it now", context: "team sheet group: the roles held now" })} {roleCount(teamFilled.length)}
                    </h2>
                    <div className={`mt-4 grid gap-4 ${chart ? "lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start" : ""}`}>
                      {chart && (
                        <div className="lg:col-start-2 lg:row-start-1" data-org-preview="">
                          <Suspense fallback={null}>
                            <OrgPreview circles={circles} seats={chart.seats} counts={chart.counts} />
                          </Suspense>
                        </div>
                      )}
                      <Suspense fallback={null}>
                        <RosterList filled={teamFilled} team={team} variant="sheet" className={`grid gap-3 sm:grid-cols-2 ${chart ? "lg:col-start-1 lg:row-start-1" : "lg:grid-cols-3"}`} />
                      </Suspense>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{t({ message: "A role shows the work it holds. Nothing here rates or compares people.", context: "founding team: the no-stats line" })}</p>
                  </section>
                )}
              </div>
            )}

            {heroShown && (
              <section aria-labelledby="other-ways" className="mt-14 border-t border-border pt-10" data-other-ways="">
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
                {/* QA2-02: while the founding team is featured, the game's way in sits here, quiet and secondary. */}
                {leads && (
                  <div className="mt-8" data-game-way="">
                    <h3 className="font-display text-2xl leading-tight text-foreground">{t({ message: "Find your place in the game", context: "roles page, other ways to join" })}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{t({ message: "Choose the root you grow from, see this season's goals, and pick the roles you play.", context: "roles page, other ways to join: the game's door" })}</p>
                    <Link href="/roles/select" className={`mt-4 ${BTN_SECONDARY}`} data-game-door="">
                      {t({ message: "Explore the game", context: "roles page, other ways to join: the game's door" })}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </section>
            )}

            {/* The season's goals and the archetypes are the game's register: on /roles/select while the founding team leads. */}
            {heroShown && !leads && (
              <div className="mt-14">
                <SeasonGoals />
                <ArchetypeStep allShown onSeeAll={() => document.getElementById("open-now-heading")?.scrollIntoView?.({ block: "start" })} />
              </div>
            )}

            <m.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-14 grid gap-4 sm:grid-cols-2">
              {[
                { label: t({ message: `Roles`, context: "roles page, how it works" }), description: t`Specific responsibilities inside a circle. One person can hold many roles. If a person leaves, the role stays and gets reassigned.` },
                { label: t({ message: `Consent`, context: "roles page, how it works" }), description: t`Decisions move forward when no one has a reasoned objection that the proposal would cause harm or block the aim. Everyone loving them is not the bar.` },
              ].map((item) => (
                <div key={item.label} className={TILE}>
                  <div className="mb-1 text-sm font-bold text-foreground">{item.label}</div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </m.div>

            {/* When a tension is between people: the village's own restorative steps, the same ones /governance prints. */}
            <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`mt-4 ${CARD}`}>
              <h2 className={`${H2} mb-4`}>{t({ message: "How we evolve through conflict", context: "roles page, conflict steps heading" })}</h2>
              <Suspense fallback={null}>
                <VillageConflictSteps />
              </Suspense>
            </m.div>
          </div>
        </section>
      </Layout>
    </AnchorCircleTip.Provider>
  );
}
