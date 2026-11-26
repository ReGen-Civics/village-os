/**
 * The front door of a village that does not serve the brochure pages.
 *
 * The brochure home (Home.tsx) tells the first village's own story in compiled
 * copy, and a new village switched that story off (shared/brochure.ts). This
 * page is what "/" renders instead. It says only what the village itself has
 * set: its name, its line, its place and its picture, all from the Setup
 * Wizard, and it points at the parts of the platform every village has: the
 * quest board, the gratitude wall and the page about how the village decides.
 * Each of those is a core surface that cannot be switched off, so no link here
 * can land on a missing page.
 *
 * A blank field hides its line rather than printing a placeholder.
 */
import { useVillageDocFields } from "@/hooks/useVillageDocTranslation";
import { lazy, Suspense, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useModules } from "@/modules/ModuleProvider";
import SeasonBanner from "@/components/SeasonBanner";
import { Image } from "@/components/Image";
import { Link } from "wouter";
import { Heart } from "lucide-react";
import { CouncilCircle, LeafCompass } from "@/components/sacred/living";
import { altOr, useBrandImages, useGameConfig } from "@/lib/gameApi";
import { useVillageLocation, useVillageName } from "@/hooks/useVillageName";
import { useAuth } from "@/contexts/AuthContext";
import { useTokenName } from "@/hooks/useTokenNames";
import { useClaimOpen } from "@/lib/claimLink";
import { Trans, useLingui } from "@lingui/react/macro";

/** The wall is named after the village's own recognition token, as the footer names it. */
type T = ReturnType<typeof useLingui>["t"];
const doors = (tokenName: string, t: T) => [
  {
    href: "/quests",
    title: t({ message: "Quests", context: "village welcome: a door card" }),
    body: t({ message: "The work this village needs, open for anyone.", context: "village welcome: a door card" }),
    // The quests' one mark, as the tab bar draws it (the leaf compass; the lead, 25 Nov 2026).
    Icon: LeafCompass,
  },
  {
    href: "/gratitude",
    title: t({ message: `${tokenName} Wall`, context: "village welcome: a door card, the recognition token's wall" }),
    body: t({ message: "Who has helped whom.", context: "village welcome: a door card" }),
    Icon: Heart,
  },
  {
    href: "/governance",
    title: t({ message: "How we decide", context: "village welcome: a door card" }),
    body: t({ message: "Who holds which power, and how a proposal becomes a decision.", context: "village welcome: a door card" }),
    Icon: CouncilCircle,
  },
];

/**
 * THE VILLAGE'S OWN WELCOME AS ITS SIGNED-OUT HOME, when it says so: a village
 * running the rites module with `welcome.asHome` set shows a visitor its rites
 * welcome here (QA P4-3). Asked only while that module is served, so every
 * other village renders exactly as before, with no extra request.
 */
const RitesWelcome = lazy(() => import("./rites/Welcome"));

export default function VillageWelcome() {
  const { user } = useAuth();
  const { modules, loaded } = useModules();
  const ritesOn = modules.some((m) => m.id === "rites");
  const [asHome, setAsHome] = useState<boolean | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (user || !ritesOn) return setAsHome(false);
    let alive = true;
    fetch("/api/rites/public")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setAsHome(d?.asHome === true))
      .catch(() => alive && setAsHome(false));
    return () => {
      alive = false;
    };
  }, [loaded, user, ritesOn]);
  if (!user && asHome === null) return null;
  if (asHome)
    return (
      <Suspense fallback={null}>
        <RitesWelcome />
      </Suspense>
    );
  return <NeutralWelcome />;
}

function NeutralWelcome() {
  const name = useVillageName();
  const location = useVillageLocation();
  const brand = useBrandImages();
  // The tagline in the reader's language where the village has translated it (village_doc "brand").
  const taglineWords = useVillageDocFields("brand")["project.tagline"];
  const ownTagline = useGameConfig()?.project?.tagline;
  const tagline = String(taglineWords || ownTagline || "").trim();
  const { user } = useAuth();
  const claimOpen = useClaimOpen();
  const tokenName = useTokenName("Recognition");
  const { t } = useLingui();

  return (
    <Layout>
      <section className="relative overflow-hidden bg-teal-band">
        {brand.hero ? (
          <div className="absolute inset-0 z-0">
            <Image
              src={brand.hero}
              alt={altOr(brand.heroAlt, t({ message: "The village and the land around it", context: "village welcome: the hero photograph" }))}
              priority
              className="w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-teal-band via-teal-band/85 to-teal-band/25" />
          </div>
        ) : null}

        <div className="container relative z-10 py-16 md:py-24">
          <div className="relative max-w-2xl">
            {/* An opaque band under the copy, as on the brochure home, so the
                contrast is a property of two named colours and never of the
                photograph behind them. */}
            <div
              aria-hidden="true"
              className="absolute -inset-x-5 -inset-y-6 sm:-inset-x-8 sm:-inset-y-10 rounded-3xl bg-teal-band"
            />
            <h1 className="relative font-display text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
              {name}
            </h1>
            {tagline ? <p className="relative text-xl text-white leading-relaxed mb-2">{tagline}</p> : null}
            {location ? <p className="relative text-white mb-8">{location}</p> : <div className="mb-8" />}
            <div className="relative flex flex-wrap gap-4">
              {user ? (
                <Link
                  href="/quests"
                  className="min-h-[44px] px-6 py-3 bg-white text-teal-band rounded-lg font-semibold hover:bg-cream"
                >
                  <Trans context="village welcome: a button">See the open quests</Trans>
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="min-h-[44px] px-6 py-3 bg-white text-teal-band rounded-lg font-semibold hover:bg-cream"
                  >
                    <Trans context="village welcome: a button">Sign in</Trans>
                  </Link>
                  <Link
                    href="/request-membership"
                    className="min-h-[44px] px-6 py-3 border border-white text-white rounded-lg font-semibold hover:bg-white/10"
                  >
                    <Trans context="village welcome: a button">Ask to join</Trans>
                  </Link>
                </>
              )}
              {/* Only while nobody holds the founder role: a founder who has just
                  deployed lands here and needs the one door in (lib/claimLink.ts). */}
              {claimOpen ? (
                <Link
                  href="/claim"
                  className="min-h-[44px] px-6 py-3 border border-white text-white rounded-lg font-semibold hover:bg-white/10"
                >
                  <Trans context="village welcome: a button, only while no founder holds the village">Founders: claim this village</Trans>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <SeasonBanner />

      <section className="container py-12 md:py-16">
        <ul className="grid gap-6 md:grid-cols-3">
          {doors(tokenName, t).map(({ href, title, body, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="block h-full rounded-2xl border border-border bg-card p-6 hover:shadow-md transition-shadow"
              >
                <Icon className="w-6 h-6 text-teal-deep mb-3" aria-hidden="true" />
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">{title}</h2>
                <p className="text-muted-foreground leading-relaxed">{body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
