import Layout from "@/components/Layout";
import BuildProgress from "@/components/BuildProgress";
import SeasonBanner from "@/components/SeasonBanner";
import MapPeek from "@/components/MapPeek";
import { useFourWaysHeading, useRouteWords, useVentureHref } from "@/components/ContributorRoutes";
import { altOr, useBrandImages, useGameConfig, useVillageLinks } from "@/lib/gameApi";
import { Link } from "wouter";
import { m } from "framer-motion";
import {
  TrendingUp,
  Users,
  Home as HomeIcon,
  Sparkles,
  ArrowRight,
  Heart,
  Calendar,
  MapPin,
  TreePine,
  CheckCircle2,
  FileText,
  Laptop,
  GraduationCap,
  Sunset,
  Zap,
  Briefcase,
  Globe
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, EYEBROW, LINK, NOTE, RING, WORLD } from "@/components/journey/look";
import { ROLES_SECTIONS } from "@/lib/sectionAnchor";
import { Image } from "@/components/Image";
import { usePageContent } from "@/hooks/usePageContent";
import { Emphasized, Highlighted } from "@/components/PageText";
import { HOME_PAGE } from "@shared/pageContent/home";
import { scrollBehavior } from "@/components/natural/scrollBehavior";
import { useStoryPageOffAlone } from "@/lib/brochure";
import { uploadSrcSet } from "@shared/uploadVariants";
import { FOUNDING_CARD_ART, FOUR_WAYS_ART, artFocusOr, shouldShowWhole } from "@shared/pathCardArt";



/**
 * The art on a journey card, and what a card looks like before there is any.
 *
 * These four pictures used to be four literal URLs on one village's WordPress
 * site. All four now 404, so the homepage renders four torn images with their
 * alt text spilling out of the rounded corner, and every fork of this platform
 * would have been hot-linking that village's domain for its own artwork even
 * when the files were there.
 *
 * So the source is the brand overlay the Setup Wizard writes, and a village
 * that has not added its art yet gets a quiet mark instead of a broken one.
 * The card keeps its accessible name either way: a sighted visitor sees a
 * deliberate empty panel and a screen reader still hears which journey this is.
 *
 * A bare <img> rather than <Image> for the same reason the markup below always
 * used one: the hover zoom is `transition-transform` and the component's fade
 * is `transition-opacity`, and one would silently cancel the other.
 *
 * The frame is near the photos' own shape (square on a phone, 4:5 in the
 * desktop row) and the browser gets the whole picture, never the old 3:1 band
 * the server cut around the centre: a portrait cut to 3:1 kept a quarter of
 * its height, and the cards showed sky or cut people off at the eyes.
 * `focus` is the village's own focal point or the top-weighted default
 * (shared/pathCardArt.ts), and a picture far from the frame's shape is shown
 * whole on the panel's soft ground instead of being cut.
 */
const JOURNEY_ART_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw";
const JOURNEY_FRAME = "relative -mx-5 -mt-5 mb-4 block aspect-square overflow-hidden rounded-t-2xl bg-muted lg:aspect-[4/5]";
function JourneyArt({ src, srcSet, alt, focus }: { src: string | undefined; srcSet?: string; alt: string; focus: string }) {
  const [failed, setFailed] = useState(false);
  const [whole, setWhole] = useState(false);
  if (!src || failed) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-muted/40 text-muted-foreground/50"
        role="img"
        aria-label={alt}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-8 w-8">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M21 16l-5-5-5.5 5.5" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      srcSet={srcSet ?? uploadSrcSet(src)}
      sizes={JOURNEY_ART_SIZES}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        setWhole(shouldShowWhole(img.naturalWidth, img.naturalHeight, img.clientWidth, img.clientHeight));
      }}
      style={{ objectPosition: whole ? "50% 50%" : focus }}
      data-art-fit={whole ? "whole" : "cover"}
      className={`absolute inset-0 h-full w-full ${whole ? "object-contain" : "object-cover"} transition-transform duration-500 group-hover:scale-105`}
    />
  );
}


/** What each path card needs that is not words: where it goes, its icon, its picture. */
const PATH_CARD_LOOK = {
  investor: { icon: TrendingUp, href: "/investor", color: "bg-amber", imageKey: "investorHero", altKey: "investorHeroAlt", focusKey: "investorHeroFocus" },
  steward: { icon: Users, href: "/steward", color: "bg-sage", imageKey: "stewardHero", altKey: "stewardHeroAlt", focusKey: "stewardHeroFocus" },
  resident: { icon: HomeIcon, href: "/resident", color: "bg-teal", imageKey: "residentHero", altKey: "residentHeroAlt", focusKey: "residentHeroFocus" },
  prosperity: { icon: Sparkles, href: "/prosperity", color: "bg-teal-light", imageKey: "prosperityHero", altKey: "prosperityHeroAlt", focusKey: "prosperityHeroFocus" },
} as const;

/**
 * The headline steps down a size as it grows, so a village's own longer line
 * still sits in about four lines instead of running six deep. Up to 36
 * characters keeps the original size, which the platform's own headline fits.
 */
function headlineSize(text: string): string {
  const n = Array.from(text).length;
  if (n <= 36) return "text-5xl md:text-7xl";
  if (n <= 44) return "text-4xl md:text-6xl";
  return "text-4xl md:text-5xl";
}

/** Icons for the stages and the people cards, handed out in order. */
const STAGE_ICONS = [Heart, Calendar, Users, CheckCircle2, HomeIcon, TreePine];
const PERSONA_LOOKS = [
  { icon: Laptop, color: "bg-teal/10", iconColor: "text-teal-deep" },
  { icon: GraduationCap, color: "bg-sage/20", iconColor: "text-sage" },
  { icon: Sunset, color: "bg-amber/20", iconColor: "text-amber-ink" },
  { icon: Zap, color: "bg-primary/10", iconColor: "text-primary" },
  { icon: Briefcase, color: "bg-teal-light/20", iconColor: "text-teal-deep" },
  { icon: Globe, color: "bg-sage-light/40", iconColor: "text-sage" },
  { icon: MapPin, color: "bg-teal/10", iconColor: "text-teal-deep" },
  { icon: FileText, color: "bg-sage/20", iconColor: "text-sage" },
  { icon: Heart, color: "bg-amber/20", iconColor: "text-amber-ink" },
];

export default function Home() {
  const { t } = useLingui();
  // Blank hides both buttons rather than pointing at another village.
  const { eventsUrl } = useVillageLinks();
  const project = useGameConfig()?.project;
  const brand = useBrandImages();
  // Every word on this page is the village's own, from Admin, Pages, Home
  // (shared/pageContent/home.ts). Null until the saved words have arrived:
  // the hero keeps its space and stays invisible meanwhile, so a visitor never
  // reads the platform's defaults and then watches them change.
  const page = usePageContent(HOME_PAGE);
  const heroFields = page?.hero.fields;
  /*
   * THE HERO'S WORDS ARE THE VILLAGE'S OWN, IN IDENTITY (the lead, 24 Nov 2026: "this should be editable in admin").
   * Admin, Make this site yours, Identity, holds a Homepage headline and a Homepage sentence (`project.heroHeadline`,
   * `project.heroBody` in the brand document); blank keeps the words in Admin, Pages, Home. The founding team line that
   * used to follow the sentence was not the village's to change, so it is gone: the founding team has its own card in
   * the four ways at the foot of the page.
   */
  const hero: Record<string, string> | undefined = heroFields
    ? { ...heroFields, headline: project?.heroHeadline?.trim() || heroFields.headline, subline: project?.heroBody?.trim() || heroFields.subline }
    : undefined;
  const journey = page?.journey;
  const paths = page?.paths;
  // A journey switched off on its own in Admin, Pages takes its card with it,
  // and with no card left the section draws nothing, as if it were hidden.
  const pageOff = useStoryPageOffAlone();
  const pathCards = (paths?.lists.cards ?? []).filter((card) => {
    const look = PATH_CARD_LOOK[card.id as keyof typeof PATH_CARD_LOOK];
    return !!look && !pageOff(look.href);
  });
  const personas = page?.personas;
  const cta = page?.cta;
  // Whether the village has its founding team on: its card leads the four ways at the
  // foot of the page, and the steward path card is its door in the paths row (#1522).
  // The read never blocks the page.
  const foundingRead = useFoundingOn();
  const founding = foundingRead === true;
  /*
   * THE PAGE DRAWS ONCE, AT ITS SIZE (page speed pass, 14 Nov 2026). The hero's
   * words, the founding line in it and the ways in all wait on two reads (the
   * page's words and the founding switch), and the sections under them drew
   * first, at the top of an empty hero, then got pushed off the screen as the
   * hero filled: a layout shift of 1.5 to 2 on a phone, most of it twice over.
   * So until both have answered, the hero holds its place invisibly and
   * nothing is drawn under it; then everything arrives in place, and what
   * arrives below the screen moves nothing a visitor can see.
   */
  const ready = !!page && foundingRead !== null;
  const pathsShown = !!paths && !paths.hidden && pathCards.length > 0;
  const waysShown = pathsShown;
  return (
    <Layout>
      {/* THE LANDING STANDS IN THE NIGHT WORLD (D-01, docs/DESIGN_RULE.md): the
          same ground, tokens and display face as the founding pages a visitor
          goes on to, so the first screen and the second are one place. */}
      <div className={WORLD}>
      {/* Hero Section. Words first, then the picture (M11): the photograph
          mounts once the words are there, so a slow phone paints the sentence
          and never an empty frame. */}
      <section className="relative overflow-hidden" data-landing-hero="">
        <div className="absolute inset-0 z-0">
          {/* THE HERO RENDERS ONLY WHEN THERE IS ONE, the same rule the four
              journey pages follow. A village with no uploaded art gets the
              night ground and nothing that reads as a broken photograph. A
              hero that IS configured and then fails to load keeps Image's
              mark and the village's own alt text, because that is breakage.
              priority: it is the largest paint once it arrives. */}
          {brand.hero && hero ? (
            <>
              <Image
                src={brand.hero}
                // The same srcset and sizes the server names in its preload of `/` (server/lib/pageMeta.ts, spliceHeroPreload), so the browser fetches the picture once.
                srcSet={uploadSrcSet(brand.hero)}
                sizes="100vw"
                alt={altOr(brand.heroAlt, "The village and the land around it")}
                priority
                className="w-full h-full"
              />
              {/* The scrim belongs to the photograph and goes with it: dark
                  where the words sit, open where the land is, and dark again
                  at the foot where the ways in overlap the hero. */}
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
            </>
          ) : null}
        </div>

        <div className={`container relative z-10 pt-12 sm:pt-20 lg:pt-28 ${waysShown ? "pb-32 sm:pb-36 lg:pb-44" : "pb-16 lg:pb-24"}`}>
          <div className="relative max-w-2xl">
            {/* THE COPY SITS ON AN OPAQUE BAND, so its contrast is a property
                of two named colours and holds whatever photograph is behind
                it. With no photograph the band is the ground itself and never
                shows; with one, it is the dark panel the words need. */}
            <div
              aria-hidden="true"
              className="absolute -inset-x-5 -inset-y-6 sm:-inset-x-8 sm:-inset-y-10 rounded-2xl bg-background"
            />
            {hero?.badge ? (
              <p className={`relative mb-5 ${EYEBROW}`}>{hero.badge}</p>
            ) : null}
            <h1
              style={{ animationDelay: "0.05s" }}
              className={`hero-rise relative font-display ${headlineSize(hero?.headline ?? "")} leading-[1.08] text-foreground text-balance mb-6 break-words${ready ? "" : " invisible"}`}
            >
              <Highlighted
                text={hero?.headline || "\u00a0"}
                phrase={hero?.highlight ?? ""}
                render={(phrase) => <span className="text-notice">{phrase}</span>}
              />
            </h1>

            <p
              style={{ animationDelay: "0.1s" }}
              className={`hero-rise relative max-w-[34em] text-lg sm:text-xl text-foreground/90 leading-relaxed mb-8${ready ? "" : " invisible"}`}
            >
              <Emphasized text={hero?.subline ?? ""} strongClassName="font-semibold text-foreground" />
            </p>
            {/* No buttons here (the lead, 24 Nov 2026: "since we have 4 button cards right next"): the paths
                sit just under the hero and the four ways at the foot of the page. */}
          </div>
        </div>
      </section>

      {/* THE PATHS, overlapping the hero's foot (D-01, D-16): the four paths, one row on a desktop,
          every card the same height with its door at the bottom; a column on a phone. While the
          village has its founding team on, the Village Steward card is that team's door (option B,
          the lead, 24 Nov 2026). The gold founding card lives in the four ways at the foot of the
          page (the lead, 24 Nov 2026), so this row is the four paths only. */}
      {ready ? (
      <>
      <section id="choose-path" aria-labelledby={waysShown ? "choose-path-h" : undefined} className={waysShown ? "relative z-20 scroll-mt-24 pb-16 sm:pb-20" : undefined}>
        {waysShown && (
        <div className="container -mt-24 sm:-mt-28 lg:-mt-32">
          {paths && pathsShown ? (
            <div className="relative mb-5 max-w-2xl">
              <p className={EYEBROW}>{paths.fields.eyebrow}</p>
              <h2 id="choose-path-h" className="mt-2 font-display text-2xl leading-tight text-foreground sm:text-3xl">
                {paths.fields.heading}
              </h2>
            </div>
          ) : (
            <h2 id="choose-path-h" className="sr-only">
              {t({ message: "Ways in", context: "landing, the ways in heading when the paths are hidden" })}
            </h2>
          )}
          <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
            {pathsShown && pathCards.map((card) => {
              const look = PATH_CARD_LOOK[card.id as keyof typeof PATH_CARD_LOOK];
              if (!look) return null;
              const art = brand[look.imageKey];
              // Option B (the lead, 24 Nov 2026): "the Village Steward IS the core team and we
              // should make this clearer". While the village has its founding team on, the
              // steward card is that team's door: a Paid role label, one plain line, and the
              // button opens the founding team on /roles. Off, it is the steward path as before.
              const coreTeam = founding && card.id === "steward";
              return (
                <li key={card.id} className="min-w-0">
                  <Link href={coreTeam ? `/roles#${ROLES_SECTIONS.team}` : look.href} className={`${WAY_CARD} border border-border`} data-way={coreTeam ? "core-team" : undefined}>
                    {/* The village's own art for this way in, when it has added
                        some; a card without art is a quiet card, never a frame. */}
                    {art ? (
                      <span className={JOURNEY_FRAME}>
                        <JourneyArt src={art} alt={altOr(brand[look.altKey], card.title)} focus={artFocusOr(brand[look.focusKey])} />
                      </span>
                    ) : null}
                    {coreTeam ? (
                      <span className="mb-2 inline-flex items-center self-start rounded-full border border-notice/60 bg-muted px-2.5 py-0.5 text-xs font-semibold text-notice" data-paid-role="">
                        {t({ message: "Paid role", context: "landing, the steward card's label while the founding team is on" })}
                      </span>
                    ) : null}
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <h3 className="font-display text-2xl leading-tight text-foreground">{card.title}</h3>
                      <span className="text-sm text-muted-foreground">{card.subtitle}</span>
                    </span>
                    {coreTeam ? (
                      <span className="mt-2 block text-sm font-semibold leading-relaxed text-foreground sm:text-base">
                        {t({ message: "The founding team who hold the village's core domains.", context: "landing, the steward card's line while the founding team is on" })}
                      </span>
                    ) : null}
                    <span className={`mt-2 block ${WAY_BODY}`}>{card.description}</span>
                    <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-foreground group-hover:text-notice">
                      <span>Choose {card.title}</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {paths && pathsShown && paths.fields.intro ? (
            <p className={`mt-6 max-w-2xl ${NOTE}`}>
              <Emphasized text={paths.fields.intro} />
            </p>
          ) : null}
        </div>
        )}
      </section>

      <SeasonBanner />

      {/* Journey Stages */}
      {journey && !journey.hidden && (
      <section className="border-y border-border/60 bg-card/40 py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              {journey.fields.heading}
            </h2>
            <p className={`mx-auto ${NOTE} max-w-2xl`}>
              <Emphasized text={journey.fields.intro} />
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 md:gap-0">
            {journey.lists.stages.map((item, index, all) => {
              const Icon = STAGE_ICONS[index % STAGE_ICONS.length];
              return (
              <div key={`${index}-${item.name}`} className="flex items-center">
                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col items-center px-6 py-4"
                >
                  <span className={`${RING} mb-3 size-14`} aria-hidden="true">
                    <Icon className="w-6 h-6" />
                  </span>
                  <span className="font-display text-lg text-foreground">
                    {item.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.description}
                  </span>
                </m.div>
                {index < all.length - 1 && (
                  <ArrowRight aria-hidden="true" className="w-5 h-5 text-muted-foreground hidden md:block" />
                )}
              </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      <BuildProgress />

      {/* Seeing the place, after the ways in. */}
      <MapPeek />

      {/* Who comes to this village */}
      {personas && !personas.hidden && (
      <section className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <m.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className={`mb-4 inline-block ${EYEBROW}`}
            >
              {personas.fields.eyebrow}
            </m.span>
            <m.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-4xl md:text-5xl text-foreground mb-4"
            >
              {personas.fields.heading}
            </m.h2>
            <m.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              <Emphasized text={personas.fields.intro} />
            </m.p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {personas.lists.items.map((persona, index) => {
              const look = PERSONA_LOOKS[index % PERSONA_LOOKS.length];
              return (
              <m.div
                key={`${index}-${persona.label}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.07 }}
                className="bg-card rounded-xl p-6 shadow-sm border border-border"
              >
                <span className={`${RING} mb-4`} aria-hidden="true">
                  <look.icon className="w-5 h-5" />
                </span>
                <h3 className="font-display text-lg text-foreground mb-1">
                  {persona.label}
                </h3>
                {persona.tagline && (
                <p className="text-notice text-sm font-medium italic mb-3">
                  "{persona.tagline}"
                </p>
                )}
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {persona.body}
                </p>
              </m.div>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              {personas.fields.footer}
            </p>
            <a
              href="#choose-path"
              className={`inline-flex min-h-11 items-center gap-2 ${LINK}`}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("choose-path")
                  ?.scrollIntoView({ behavior: scrollBehavior() });
              }}
            >
              Pick your path <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
      )}

      {/* CTA Section */}
      {cta && !cta.hidden && (
      <section className="border-t border-border/60 bg-card/40 py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <m.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-4xl md:text-5xl text-foreground mb-6"
            >
              {cta.fields.heading}
            </m.h2>
            <m.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-xl text-muted-foreground mb-8"
            >
              <Emphasized text={cta.fields.body} />
            </m.p>
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-4"
            >
              {eventsUrl && (
                <a
                  href={eventsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={BTN_SECONDARY}
                >
                  <Calendar className="w-5 h-5" />
                  {cta.fields.primaryLabel}
                </a>
              )}
              {eventsUrl && cta.fields.secondaryLabel && (
                <a
                  href={eventsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={BTN_SECONDARY}
                >
                  {cta.fields.secondaryLabel}
                </a>
              )}
            </m.div>
          </div>
        </div>
      </section>
      )}

      <FourWaysToBuild founding={founding} />
      </>
      ) : null}
      </div>
    </Layout>
  );
}

/**
 * FOUR WAYS TO BUILD, ONCE, AT THE FOOT OF THE PAGE (the lead, 24 Nov 2026): "Put this just once at the bottom of the
 * landing page - we already have the 4 paths option", and "Move the 'founding team' card as it is down to the '4 ways
 * to build' and have it replace the join the team button. Then redesign the other 3 cards to look more like the team
 * card and add animals to them. That way there are 8 different routes here."
 *
 * The founding team card as it was in the paths row (its painting, the gold edge, "Roles with rewards", "See the open
 * roles"), then Start a venture, Become a partner and Propose a quest in the same card: a painting on top, an
 * eyebrow, the verb, its line, what you bring and what you get back, and the door. A village with its founding team
 * off gets Join the team in the same card. No reply promise here: a person is told when they will hear back once
 * they have sent (shared/contributorRoutes.ts, REPLY_WINDOW_MOONS_VARIABLE).
 */
function FourWaysToBuild({ founding }: { founding: boolean }) {
  const { t } = useLingui();
  const heading = useFourWaysHeading();
  const words = useRouteWords();
  const ventureHref = useVentureHref();
  const others = [
    { key: "venture", href: ventureHref, art: FOUR_WAYS_ART.venture, eyebrow: t({ message: "A business of your own", context: "landing, four ways: the venture card's eyebrow" }) },
    { key: "partner", href: "/partner", art: FOUR_WAYS_ART.partner, eyebrow: t({ message: "Work alongside us", context: "landing, four ways: the partner card's eyebrow" }) },
    { key: "quest", href: "/propose-quest", art: FOUR_WAYS_ART.quest, eyebrow: t({ message: "One piece of work", context: "landing, four ways: the quest card's eyebrow" }) },
  ] as const;
  const bringBack = (w: { bring: string; back: string }) => (
    <dl className="mt-3 grid gap-1.5 text-sm">
      <div>
        <dt className="inline font-semibold text-foreground">{t({ message: "You bring", context: "four ways to build: the label before what you bring" })}: </dt>
        <dd className="inline text-muted-foreground">{w.bring}</dd>
      </div>
      <div>
        <dt className="inline font-semibold text-foreground">{t({ message: "You get back", context: "four ways to build: the label before what you get back" })}: </dt>
        <dd className="inline text-muted-foreground">{w.back}</dd>
      </div>
    </dl>
  );
  return (
    <section aria-labelledby="four-ways-h" className="border-t border-border/60 py-16 sm:py-20" data-four-ways="">
      <div className="container">
        <h2 id="four-ways-h" className="mb-5 font-display text-2xl leading-tight text-foreground sm:text-3xl">
          {heading}
        </h2>
        <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li className="min-w-0" data-route="team">
            <Link href={`/roles#${ROLES_SECTIONS.team}`} className={`${WAY_CARD} ${founding ? "border-2 border-notice/60" : "border border-border"}`} data-way={founding ? "founding" : "team"} data-route-door="team">
              <span className={JOURNEY_FRAME}>
                <JourneyArt src={FOUNDING_CARD_ART.src} srcSet={FOUNDING_CARD_ART.srcSet} alt="" focus={FOUNDING_CARD_ART.focus} />
              </span>
              {founding ? (
                <>
                  <span className={EYEBROW}>{t({ message: "Roles with rewards", context: "landing, founding team card eyebrow" })}</span>
                  <h3 className="mt-2 font-display text-2xl leading-tight text-foreground">{t({ message: "Founding team", context: "landing, founding team card title" })}</h3>
                  <span className={`mt-2 block ${WAY_BODY}`}>
                    {t({ message: "Hold a whole domain of the village, from the foundation through to completion.", context: "landing, founding team card body" })}
                  </span>
                </>
              ) : (
                <>
                  <span className={EYEBROW}>{t({ message: "A role on the team", context: "landing, four ways: the team card's eyebrow" })}</span>
                  <h3 className="mt-2 font-display text-2xl leading-tight text-foreground">{words.team.verb}</h3>
                  <span className={`mt-2 block ${WAY_BODY}`}>{words.team.line}</span>
                  {bringBack(words.team)}
                </>
              )}
              <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-notice">
                {founding ? t({ message: "See the open roles", context: "landing, founding team card door" }) : words.team.verb}
                <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
          {others.map((o) => (
            <li key={o.key} className="min-w-0" data-route={o.key}>
              <Link href={o.href} className={`${WAY_CARD} border border-border`} data-route-door={o.key}>
                <span className={JOURNEY_FRAME}>
                  <JourneyArt src={o.art.src} srcSet={o.art.srcSet} alt="" focus={o.art.focus} />
                </span>
                <span className={EYEBROW}>{o.eyebrow}</span>
                <h3 className="mt-2 font-display text-2xl leading-tight text-foreground">{words[o.key].verb}</h3>
                <span className={`mt-2 block ${WAY_BODY}`}>{words[o.key].line}</span>
                {bringBack(words[o.key])}
                <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-foreground group-hover:text-notice">
                  {words[o.key].verb}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** A way-in card: the whole card is the door, every one the same height, the door's words at the foot. */
const WAY_CARD =
  "group flex h-full flex-col rounded-2xl bg-card p-5 shadow-sm transition-colors hover:border-notice/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const WAY_BODY = "text-sm leading-relaxed text-muted-foreground sm:text-base";

/** How long the landing page waits on the founding switch before it draws without it. */
const FOUNDING_READ_WAIT_MS = 8000;

/**
 * Whether the village has its founding team section on: null until the read
 * answers, false when it fails, and false once FOUNDING_READ_WAIT_MS has gone
 * by, so a stalled read never holds the page back. A late yes still turns the
 * section on.
 */
function useFoundingOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const stall = setTimeout(() => live && setOn((v) => (v === null ? false : v)), FOUNDING_READ_WAIT_MS);
    // The same public read the roles page makes (GET /api/org/founding-team),
    // asked for its one yes or no; any failure is the section off.
    fetch("/api/org/founding-team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setOn(d?.on === true && Array.isArray(d?.roleIds) && d.roleIds.length > 0))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
      clearTimeout(stall);
    };
  }, []);
  return on;
}
