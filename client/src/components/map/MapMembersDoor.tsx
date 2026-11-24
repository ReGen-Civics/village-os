/**
 * THE LIVING MAP IS FOR MEMBERS (the lead, 24 Nov 2026). The gate is the map module's own lifecycle:
 * at Members (Admin, Modules, Map), `requireModule("map")` answers a reader who is not signed in with
 * 401 `auth_required`, and a portal visitor is never signed in (visitors hold no accounts: the lead,
 * 24 Nov 2026).
 *
 * In front of the map pages: asks the map once whether this reader may open it, and if the server
 * says sign in first, shows a calm page that sends them to the circles, which stay open. Anything
 * else (the map answers, the module is off, the network fails) renders the page as before, which
 * then meets whatever the server says on its own reads.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Map as MapIcon } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { gameFetch } from "@/lib/gameApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_FEATURED, EYEBROW, H1, LEDE, WORLD } from "@/components/journey/look";

type Verdict = "asking" | "open" | "members_only";

export default function MapMembersDoor({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth();
  const userId = auth?.user ? String((auth.user as { id?: unknown }).id ?? "") : "";
  const authLoading = !!auth?.loading;
  const [verdict, setVerdict] = useState<Verdict>("asking");

  useEffect(() => {
    if (authLoading) return;
    let live = true;
    setVerdict("asking");
    gameFetch("/api/map/config")
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          const body = (await r.json().catch(() => null)) as { error?: string } | null;
          return body?.error === "auth_required" || body?.error === "entrance_required" ? "members_only" : "open";
        }
        return "open";
      })
      .catch(() => "open" as const)
      .then((v) => live && setVerdict(v as Verdict));
    return () => {
      live = false;
    };
  }, [userId, authLoading]);

  if (verdict === "asking") return null;
  if (verdict === "open") return <>{children}</>;
  return <MapForMembers signedIn={!!userId} />;
}

function MapForMembers({ signedIn }: { signedIn: boolean }) {
  const { t } = useLingui();
  return (
    <Layout>
      <div className={WORLD}>
        <main className="container flex max-w-2xl flex-col gap-8 py-12 sm:py-20" data-map-members-only="">
          <section className={`${CARD_FEATURED} flex flex-col gap-6`}>
            <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-notice text-notice" aria-hidden="true">
              <MapIcon className="size-6" />
            </span>
            <p className={EYEBROW}>{t({ message: "The living map", context: "map members only: eyebrow" })}</p>
            <h1 className={H1}>{t({ message: "The living map is for members", context: "map members only: heading" })}</h1>
            <p className={LEDE}>
              {t({
                message: "Members see the land, its places and who holds each role. The circles, and what each one is for, are open to you now.",
                context: "map members only: what the map holds, and what is open instead",
              })}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="/circles" className={`${BTN_PRIMARY} text-base`}>
                {t({ message: "See the circles", context: "map members only: the main button" })}
              </a>
              {!signedIn && (
                <a href={`/login?next=${encodeURIComponent("/map")}`} className={BTN_SECONDARY}>
                  {t({ message: "I am a member: sign in", context: "map members only: sign in" })}
                </a>
              )}
            </div>
          </section>
        </main>
      </div>
    </Layout>
  );
}
