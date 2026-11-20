/**
 * ONE ROLE'S OWN PAGE, `/roles/<slug>` (the lead, 20 Nov 2026; the roles lane's idea 3).
 *
 * The role's card at the top of the page, a way back to every role, and its share link. The address follows
 * shared/roleSlug.ts, which the server reads too, so the link a card copies is one the server can preview:
 * server/routes/roleShare.ts puts the role's name, purpose and art into the page's link-preview tags, which is
 * what a messaging app shows. A role the village does not list, or no longer has, says so in one line and
 * leads back to /roles.
 *
 * Its own lazily loaded page, so none of it rides /roles' first view. The card is the same FullRoleCard /roles
 * draws: a founding team role in the founding register with its sections, any other in the directory's.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { HINT, LINK, TILE, WORLD } from "@/components/journey/look";
import { gameFetch } from "@/lib/gameApi";
import { anchorCircleId } from "@shared/circlePicker";
import { roleForSlug, rolePath } from "@shared/roleSlug";
import FullRoleCard from "@/components/roleCard/FullRoleCard";
import { AnchorCircleTip } from "@/components/roleCard/CardTips";
import { readFoundingTeam, type FoundingTeamAnswer } from "@/components/roleCard/roleCardApi";

const SeatLinkCopy = lazy(() => import("@/components/roleCard/SeatLinkCopy"));

interface OrgRead {
  roles: Array<Record<string, any> & { id: string }>;
  circles: Array<Record<string, any>>;
}

export default function RoleShare() {
  const { t } = useLingui();
  const [, params] = useRoute("/roles/:slug");
  const slug = params?.slug ?? "";
  const [org, setOrg] = useState<OrgRead | null | "failed">(null);
  const [founding, setFounding] = useState<FoundingTeamAnswer | null>(null);
  useEffect(() => {
    let live = true;
    gameFetch("/api/org")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => live && setOrg({ roles: Array.isArray(d?.roles) ? d.roles.filter((r: any) => r && !r.isExample && typeof r.id === "string") : [], circles: Array.isArray(d?.circles) ? d.circles : [] }))
      .catch(() => live && setOrg("failed"));
    void readFoundingTeam().then((a) => live && setFounding(a));
    return () => {
      live = false;
    };
  }, []);

  const roles = org && org !== "failed" ? org.roles : [];
  const role = org && org !== "failed" ? roleForSlug(slug, roles) : null;
  const circles = org && org !== "failed" ? org.circles : [];
  const circle = role ? circles.find((c) => String(c?.id) === String(role.circleId ?? "")) : null;
  const anchorId = anchorCircleId(circles as any);
  const anchorRow = circles.find((c) => String(c?.id) === anchorId);
  const anchorTip = useMemo(() => (anchorRow?.name ? { name: String(anchorRow.name), purpose: String(anchorRow.purpose ?? "") } : null), [anchorRow?.name, anchorRow?.purpose]);
  const featured = !!role && !!founding?.on && founding.roleIds.includes(String(role.id));
  const path = role ? rolePath({ id: String(role.id), name: role.name, slug: role.slug }, roles.map((r) => ({ id: String(r.id), name: r.name, slug: r.slug }))) : "";

  // The bar says the role's own address, so a reader who arrived by its id copies the same link a card copies.
  useEffect(() => {
    if (role && path && window.location.pathname !== path) window.history.replaceState(window.history.state, "", path + window.location.hash);
  }, [role, path]);

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
          <div className="container mx-auto flex max-w-6xl flex-col gap-5" data-role-page={role ? String(role.id) : ""}>
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
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Suspense fallback={null}>
                    <SeatLinkCopy path={path} seatName={String(role.name ?? "")} bare />
                  </Suspense>
                  <Link href="/roles" className={`inline-flex min-h-11 items-center ${LINK}`}>
                    {t({ message: "See every role", context: "a role's own page: the roles page" })}
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      </Layout>
    </AnchorCircleTip.Provider>
  );
}
