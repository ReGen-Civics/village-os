/**
 * ONE ROLE'S OWN PAGE, `/roles/<slug>` (the lead, 20 Nov 2026; the roles lane's idea 3).
 *
 * The role's card at the top of the page, a way back to every role, and its share link. The address follows
 * shared/roleSlug.ts, which the server reads too, so the link a card copies is one the server can preview:
 * server/routes/roleShare.ts puts the role's name, purpose and art into the page's link-preview tags, which is
 * what a messaging app shows. A role the village does not list, or no longer has, says so in one line and
 * leads back to /roles.
 *
 * Its own lazily loaded page, so none of it rides /roles' first view. The card is FullRoleCard: a founding team
 * role in the founding register with its sections, any other in the directory's.
 *
 * THE FULL ROLE (20 Nov 2026): /roles became an index of compact cards, so everything a role's row used to open
 * inline lives here, below the card: the roles this steward will build (in full, where the index has one line),
 * the holders' cards, proposing it for next season or proposing an agent, raising a tension, the seat's history,
 * the needs it carries and what a connected service holds about it.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { readerLanguage } from "@/lib/readerLanguage";
import { useLocale } from "@/i18n/LocaleProvider";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { BTN_NOTICE, BTN_SECONDARY, HINT, LINK, TILE, WORLD } from "@/components/journey/look";
import SeatHistory from "@/components/power/SeatHistory";
import LeadBuilds, { buildsFor } from "@/components/roleCard/LeadBuilds";
import { agentProposalHref, proposeRoleHref } from "@/components/roleProposal/QuickPath";
import { useAuth } from "@/contexts/AuthContext";
import { useModule, useModuleOn } from "@/modules/ModuleProvider";
import { useNewcomerOrVisitor } from "@/lib/newcomer";
import { seatHistoryShown } from "@shared/roleSheetInputs";
import { heldButRecruiting } from "@shared/roleListing";
import { gameFetch } from "@/lib/gameApi";
import { anchorCircleId } from "@shared/circlePicker";
import { roleForSlug, rolePath } from "@shared/roleSlug";
import FullRoleCard, { mayApply } from "@/components/roleCard/FullRoleCard";
import { termsSlotFor } from "@/components/power/SeatTermsSlot";
import { AnchorCircleTip } from "@/components/roleCard/CardTips";
import { readFoundingTeam, type FoundingTeamAnswer } from "@/components/roleCard/roleCardApi";
import { useCrumbLeaf } from "@/components/nav/crumbLeaf";

const SeatLinkCopy = lazy(() => import("@/components/roleCard/SeatLinkCopy"));
// The seat's record below the card, each loaded when it is drawn.
const RoleHolderCards = lazy(() => import("@/components/playerCard/RoleHolderCards"));
const RaiseTension = lazy(() => import("@/components/roleTension/RaiseTension"));
const SeatNeeds = lazy(() => import("@/components/power/SeatNeeds"));
const SeatVendorFacts = lazy(() => import("@/components/power/SeatVendorFacts"));

interface OrgRead {
  roles: Array<Record<string, any> & { id: string }>;
  circles: Array<Record<string, any>>;
  people: unknown;
  /** Every row as served, demonstration seats included, for the history's reach (`seatHistoryShown`). */
  allRoles: unknown[];
}

export default function RoleShare() {
  const { t } = useLingui();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  // The propose doors lead to the role-proposal form, which needs the governance module and a member
  // (whole-app QA, 25 Nov 2026): a visitor on a shared link was sent to a sign-in or module-off card.
  const governanceOn = useModuleOn("governance");
  const newcomer = useNewcomerOrVisitor();
  const mayPropose = governanceOn && !newcomer;
  // Who may say what a seat is held for; the server refuses everybody else by itself.
  const canTagNeeds = !!user && (user.role === "admin" || user.role === "founder");
  // Whose words the vendor panel shows: the listing's, so no connector is named here.
  const vendorName = useModule("saberra")?.name ?? t({ message: `the connected service`, context: "roles page, a connected service's fallback name" });
  const [, params] = useRoute("/roles/:slug");
  const slug = params?.slug ?? "";
  const [org, setOrg] = useState<OrgRead | null | "failed">(null);
  const [founding, setFounding] = useState<FoundingTeamAnswer | null>(null);
  const { locale } = useLocale(); // circle names come in the reader's language (lib/readerLanguage.ts)
  useEffect(() => {
    let live = true;
    gameFetch("/api/org", readerLanguage(locale))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => live && setOrg({ roles: Array.isArray(d?.roles) ? d.roles.filter((r: any) => r && !r.isExample && typeof r.id === "string") : [], circles: Array.isArray(d?.circles) ? d.circles : [], people: d?.people ?? null, allRoles: Array.isArray(d?.roles) ? d.roles : [] }))
      .catch(() => live && setOrg("failed"));
    void readFoundingTeam().then((a) => live && setFounding(a));
    return () => {
      live = false;
    };
  }, [locale]);

  const roles = org && org !== "failed" ? org.roles : [];
  const role = org && org !== "failed" ? roleForSlug(slug, roles) : null;
  useCrumbLeaf(role ? String(role.name ?? "") : null); // the last crumb (components/nav/Breadcrumbs.tsx)
  const circles = org && org !== "failed" ? org.circles : [];
  const circle = role ? circles.find((c) => String(c?.id) === String(role.circleId ?? "")) : null;
  const anchorId = anchorCircleId(circles as any);
  const anchorRow = circles.find((c) => String(c?.id) === anchorId);
  const anchorTip = useMemo(() => (anchorRow?.name ? { name: String(anchorRow.name), purpose: String(anchorRow.purpose ?? "") } : null), [anchorRow?.name, anchorRow?.purpose]);
  const featured = !!role && !!founding?.on && founding.roleIds.includes(String(role.id));
  const pathOf = (r: { id: string; name?: unknown; slug?: unknown }) => rolePath({ id: String(r.id), name: r.name as string, slug: r.slug as string }, roles.map((x) => ({ id: String(x.id), name: x.name, slug: x.slug })));
  // The roles this steward will build, in full (the index has one line of them).
  const builds = role ? buildsFor(String(role.id), roles, circles as Array<{ id: string; leadRoleId?: string | null }>, (r) => heldButRecruiting(r) && mayApply(r)) : [];
  const historyShown = org && org !== "failed" ? seatHistoryShown(org.people as any, org.allRoles as any) : false;
  const path = role ? rolePath({ id: String(role.id), name: role.name, slug: role.slug }, roles.map((r) => ({ id: String(r.id), name: r.name, slug: r.slug }))) : "";

  // The bar says the role's own address, so a reader who arrived by its id copies the same link a card copies.
  useEffect(() => {
    if (!role || !path || window.location.pathname === path) return;
    // Only while the bar still names THIS role: an effect that runs late, after a press already moved to another role's
    // page, must never write the old role back over it (a race seen under load, 20 Nov 2026).
    const now = window.location.pathname.match(/^\/roles\/([^/]+)/)?.[1] ?? "";
    if (roleForSlug(now, roles) !== role) return;
    window.history.replaceState(window.history.state, "", path + window.location.hash);
  }, [role, path, roles]);

  const back = (
    <Link href="/roles" className={`inline-flex min-h-11 items-center gap-2 ${LINK}`} data-role-page-back="">
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t({ message: "All roles", context: "a role's own page: back to the roles page" })}
    </Link>
  );

  return (
    <AnchorCircleTip.Provider value={anchorTip}>
      <Layout>
        <section className={`${WORLD} pb-16 pt-4 sm:py-12`}>
          {/* A tighter gap on a phone, so a coming-soon card's longer note still leaves its act whole on the first screen. */}
          <div className="container mx-auto flex max-w-6xl flex-col gap-3 sm:gap-5" data-role-page={role ? String(role.id) : ""}>
            {back}
            {org === null || (role && founding === null) ? (
              <p role="status" className={`py-10 text-center ${HINT}`}>{t({ message: "Loading the role…", context: "a role's own page" })}</p>
            ) : !role ? (
              <div role="status" className={`${TILE} flex flex-col gap-2`} data-role-page-missing="">
                <h1 className="font-display text-2xl text-card-foreground">{t({ message: "That role is not on this page anymore.", context: "a role's own page: no role by this address" })}</h1>
                <p className={HINT}>{t({ message: "Every role the village lists is on the roles page.", context: "a role's own page: no role by this address" })}</p>
              </div>
            ) : (
              <>
                <h1 className="sr-only">{String(role.name ?? "")}</h1>
                <FullRoleCard
                  key={String(role.id)}
                  seat={role}
                  circleName={circle ? String(circle.name ?? "") : null}
                  register={featured ? "founding" : "game"}
                  sections={featured ? (founding?.sections[String(role.id)] ?? null) : null}
                  villagePay={founding?.villagePay ?? null}
                  lifted
                  settings={termsSlotFor(role)}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Suspense fallback={null}>
                    <SeatLinkCopy path={path} seatName={String(role.name ?? "")} bare />
                  </Suspense>
                  <Link href="/roles" className={`inline-flex min-h-11 items-center ${LINK}`}>
                    {t({ message: "See every role", context: "a role's own page: the roles page" })}
                  </Link>
                </div>
                <LeadBuilds
                  leadName={String(role.name ?? "")}
                  roles={builds}
                  onOpen={(id) => {
                    const child = roles.find((r) => String(r.id) === id);
                    if (child) navigate(pathOf(child));
                  }}
                />
                <Suspense fallback={null}>
                  <div className="flex flex-col gap-4" data-role-page-record="">
                    <RoleHolderCards role={role} />
                    {mayPropose && (
                    <div className="flex flex-wrap gap-3">
                      <Link href={proposeRoleHref(String(role.id))} className={BTN_NOTICE}>
                        {t`Propose this role for next season`}
                      </Link>
                      {role.card?.agentMayHold === true && (
                        <Link href={agentProposalHref(String(role.id))} className={BTN_SECONDARY}>
                          <Trans context="roles directory: a member proposes an agent they keep">Propose an agent for this role</Trans>
                        </Link>
                      )}
                    </div>
                    )}
                    <RaiseTension roleId={String(role.id)} roleName={String(role.name ?? "")} />
                    {/* The seat's whole record, ended holdings included. */}
                    <div className="border-t border-border pt-4">
                      <SeatHistory roleId={String(role.id)} canSeePeople={historyShown} />
                    </div>
                    {/* Which of the village's needs this seat carries (R18): a description, never a condition on holding it. */}
                    <div className="border-t border-border pt-4">
                      <SeatNeeds roleId={String(role.id)} canEdit={canTagNeeds} />
                    </div>
                    <div className="border-t border-border pt-4 empty:hidden empty:border-t-0 empty:pt-0">
                      <SeatVendorFacts entityKind="org_role" entityId={String(role.id)} serviceName={vendorName} />
                    </div>
                  </div>
                </Suspense>
              </>
            )}
          </div>
        </section>
      </Layout>
    </AnchorCircleTip.Provider>
  );
}
