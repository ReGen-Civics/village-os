import Layout from "@/components/Layout";
import { WORLD } from "@/components/journey/look";
import { Link } from "wouter";
import { m } from "framer-motion";
import { useVillageLinks } from "@/lib/gameApi";
import { useHypha } from "@/modules/ModuleProvider";
import { usePageContent, usePageLang } from "@/hooks/usePageContent";
import { Emphasized } from "@/components/PageText";
import { HyphaAdminNote } from "@/components/HyphaAdminNote";
import { HOW_WE_CREATE_PAGE } from "@shared/pageContent/howWeCreate";
import type { ResolvedItem } from "@shared/pageContent/types";
import {
  Sprout,
  ArrowRight,
  Heart,
  Calendar,
  CircleDot,
  Repeat,
  Settings,
  Palette,
  Scale,
  Handshake,
  Leaf,
  Compass,
} from "lucide-react";
import { CouncilCircle, MushroomNetwork } from "@/components/sacred/living";
import { useStoryPageOffAlone } from "@/lib/brochure";
import { Trans } from "@lingui/react/macro";

/*
 * Every word on this page is the village's own, from Admin, Pages, How We
 * Create (shared/pageContent/howWeCreate.ts). Icons, emoji and colours stay
 * here and are handed out by position.
 *
 * THE TOKEN SECTION SAYS WHAT A TOKEN IS CALLED AND NOTHING ABOUT WHAT IT DOES
 * (Rye, 2026-10-22: "every community will design their own rules for these
 * and other tokens so don't mention what it does anywhere"). The pool card,
 * the conversion card, the `money.valueConversion` line and the footnote that
 * sat here are gone; the section links to /game-mechanics, which is generated
 * from the rules the village actually set.
 */
const PRINCIPLE_ICONS = [CircleDot, Settings, Heart, Repeat, Leaf, Compass];
const TOKEN_CARD_ICONS = ["🤝", "📊", "🌱"];
const METHOD_ICONS = [CouncilCircle, Handshake, MushroomNetwork, Palette, CircleDot, Compass];
const SEASON_LOOKS = [
  { emoji: "🌱", color: "bg-open/10 text-open" },
  { emoji: "☀️", color: "bg-notice/10 text-notice" },
  { emoji: "🍂", color: "bg-notice/10 text-notice" },
  { emoji: "❄️", color: "bg-muted text-foreground" },
  { emoji: "🌿", color: "bg-open/10 text-open" },
  { emoji: "🌙", color: "bg-muted text-foreground" },
];

/** Wide-screen columns for a row of up to three cards, so one card sits centred instead of in a third of the row. */
const TOKEN_GRID = ["", "max-w-md", "md:grid-cols-2 max-w-3xl", "md:grid-cols-3 max-w-4xl"];

/** The filled boxes of a row's numbered lines (`item1`..`item5`), in order. */
function numberedLines(row: ResolvedItem, prefix: string): string[] {
  return [1, 2, 3, 4, 5].map((i) => (row[`${prefix}${i}`] ?? "").trim()).filter(Boolean);
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function HowWeCreate() {
  // Blank hides the button rather than pointing at another village.
  const { eventsUrl } = useVillageLinks();
  // A link to a story page switched off on its own in Admin, Pages is left out.
  const pageOff = useStoryPageOffAlone();
  const hypha = useHypha();
  const langOf = usePageLang(HOW_WE_CREATE_PAGE);
  const page = usePageContent(HOW_WE_CREATE_PAGE);
  if (!page) {
    // Nothing until the saved words arrive, so the defaults never flash first.
    return (
      <Layout>
        <section className="min-h-[70vh]" aria-busy="true" />
      </Layout>
    );
  }
  const { hero, principles, tokens, governance, seasons, cta } = page;
  // A Hypha section needs a Hypha space to describe: the village's switch AND its DHO link.
  const hyphaSection = page.hypha;
  const showHypha = !hyphaSection.hidden && hypha.configured;
  const tokenCards = tokens.lists.cards;
  return (
    <Layout>
      {/* The night world (public launch, 24 Nov 2026): the sheet's look, same words. */}
      <div className={WORLD}>
      <section className="py-24">
        <div className="container">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <m.div
              className="w-16 h-16 rounded-full bg-notice/10 flex items-center justify-center mx-auto mb-6"
            >
              <Sprout className="w-8 h-8 text-notice" aria-hidden="true" />
            </m.div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4 break-words">
              {hero.fields.headline}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              <Emphasized text={hero.fields.intro} />
            </p>
          </m.div>

          {/* Core Principles */}
          {!principles.hidden && principles.lists.items.length > 0 && (
            <m.div
              className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {principles.lists.items.map((principle, i) => {
                const Icon = PRINCIPLE_ICONS[i % PRINCIPLE_ICONS.length];
                return (
                  <m.div
                    key={`${i}-${principle.title}`}
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 hover:shadow-sm transition-shadow min-w-0"
                  >
                    <div className="w-14 h-14 rounded-xl bg-notice/10 flex items-center justify-center mb-4">
                      <Icon className="w-7 h-7 text-notice" />
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-foreground mb-3 break-words">
                      {principle.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      <Emphasized text={principle.description} />
                    </p>
                  </m.div>
                );
              })}
            </m.div>
          )}

          {/* Our tokens: named, with a link to the rules the village set. */}
          {!tokens.hidden && (
            <div
              className="m-germ bg-card border border-border rounded-2xl p-8 md:p-12 mb-20 shadow-sm"
            >
              <div className={`text-center${tokenCards.length ? " mb-12" : ""}`}>
                <m.div
                >
                  <Heart className="w-12 h-12 text-notice mx-auto mb-4" />
                </m.div>
                <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 break-words">
                  {tokens.fields.heading}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto mb-2">
                  <Emphasized text={tokens.fields.intro} />
                </p>
                {tokens.fields.linkLabel && (
                  <Link
                    href="/game-mechanics"
                    className="inline-flex items-center gap-1 text-notice font-semibold hover:underline"
                  >
                    {tokens.fields.linkLabel}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>

              {tokenCards.length > 0 && (
                <div className={`grid gap-6 mx-auto ${TOKEN_GRID[Math.min(tokenCards.length, 3)]}`}>
                  {tokenCards.map((item, index) => (
                    <m.div
                      key={`${index}-${item.title}`}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.15 }}
                      whileHover={{ y: -8, scale: 1.02 }}
                      className="bg-card p-6 rounded-xl text-center shadow-sm hover:shadow-sm transition-all min-w-0"
                    >
                      <m.div
                        className="w-14 h-14 rounded-full bg-notice/10 flex items-center justify-center mx-auto mb-4"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                      >
                        <span className="text-2xl">{TOKEN_CARD_ICONS[index % TOKEN_CARD_ICONS.length]}</span>
                      </m.div>
                      <h3 className="font-display text-lg font-semibold text-foreground mb-2 break-words">
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        <Emphasized text={item.body} />
                      </p>
                    </m.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Governance Structure */}
          {!governance.hidden && (
            <div
              className="m-germ bg-card rounded-2xl p-8 md:p-12 mb-20 border border-border"
            >
              <div className="text-center mb-12">
                <MushroomNetwork className="w-12 h-12 text-open mx-auto mb-4" />
                <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 break-words">
                  {governance.fields.heading}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  <Emphasized text={governance.fields.intro} />
                </p>
              </div>

              {governance.lists.phases.length > 0 && (
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {governance.lists.phases.map((phase, i) => (
                    <div
                      key={`${i}-${phase.title}`}
                      className="m-germ bg-card p-6 rounded-xl border border-border min-w-0"
                    >
                      <h3 className="font-display text-lg font-semibold text-foreground mb-3 break-words">{phase.title}</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {numberedLines(phase, "item").map((line, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="text-open">→</span> <span className="min-w-0 break-words">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {governance.fields.buttonLabel && (
                <div
                  className="m-germ text-center"
                >
                  <Link href="/roles" className="inline-flex items-center gap-2 px-6 py-3 bg-notice text-background rounded-xl hover:bg-notice/90 transition-colors font-medium">
                      {governance.fields.buttonLabel}
                      <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Flexible Governance with Hypha */}
          {showHypha && (
            <div className="max-w-4xl mx-auto mb-20">
              <div
                className="m-germ text-center mb-12"
              >
                <Scale className="w-12 h-12 text-open mx-auto mb-4" />
                <h2 lang={langOf("hypha.heading")} className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 break-words">
                  {hyphaSection.fields.heading}
                </h2>
                <p lang={langOf("hypha.intro")} className="text-muted-foreground max-w-2xl mx-auto">
                  <Emphasized text={hyphaSection.fields.intro} />
                </p>
              </div>

              {hyphaSection.lists.methods.length > 0 && (
                <m.div
                  className="grid sm:grid-cols-2 gap-6"
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  {hyphaSection.lists.methods.map((option, i) => {
                    const Icon = METHOD_ICONS[i % METHOD_ICONS.length];
                    return (
                      <m.div
                        key={`${i}-${option.name}`}
                        variants={itemVariants}
                        whileHover={{ scale: 1.02 }}
                        className="bg-card p-6 rounded-xl shadow-sm border border-border/50 min-w-0"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-open/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-6 h-6 text-open" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-xl font-semibold text-foreground mb-2 break-words">
                              {option.name}
                            </h3>
                            <p className="text-muted-foreground text-sm mb-3">
                              <Emphasized text={option.description} />
                            </p>
                            {option.best && <p className="text-xs text-open font-medium"><Trans context="HowWeCreate, p">Best for: {option.best}</Trans></p>}
                          </div>
                        </div>
                      </m.div>
                    );
                  })}
                </m.div>
              )}

              <div
                className="m-germ mt-8 p-6 bg-card rounded-xl border border-border"
              >
                <h3 className="font-display text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-open flex-shrink-0" />
                  <span lang={langOf("hypha.boxHeading")} className="min-w-0 break-words">{hyphaSection.fields.boxHeading}</span>
                </h3>
                <p lang={langOf("hypha.boxBody")} className="text-muted-foreground text-sm leading-relaxed">
                  <Emphasized text={hyphaSection.fields.boxBody} />
                </p>
              </div>
            </div>
          )}
          {!hyphaSection.hidden && <HyphaAdminNote />}

          {/* Seasonal Rhythm */}
          {!seasons.hidden && (
            <div className="max-w-3xl mx-auto mb-20">
              <div
                className="m-germ text-center mb-8"
              >
                <m.div
                >
                  <Repeat className="w-12 h-12 text-open mx-auto mb-4" />
                </m.div>
                <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 break-words">
                  {seasons.fields.heading}
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  <Emphasized text={seasons.fields.intro} />
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                {seasons.lists.seasons.map((item, index) => {
                  const look = SEASON_LOOKS[index % SEASON_LOOKS.length];
                  return (
                    <m.div
                      key={`${index}-${item.name}`}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.03 }}
                      className="bg-card p-6 rounded-xl shadow-sm border border-border/50 min-w-0"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{look.emoji}</span>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${look.color}`}>
                          {item.name}
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-semibold text-foreground mb-2 break-words">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        <Emphasized text={item.description} />
                      </p>
                    </m.div>
                  );
                })}
              </div>
              {seasons.fields.note && (
                <div
                  className="m-germ mt-8 p-5 bg-muted rounded-xl text-center border border-border/40"
                >
                  <p className="text-sm text-muted-foreground">
                    <Emphasized text={seasons.fields.note} />
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          {!cta.hidden && (
            <div
              className="m-germ max-w-3xl mx-auto text-center bg-muted border border-border p-8 rounded-2xl"
            >
              <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-4 break-words">
                {cta.fields.heading}
              </h2>
              <p className="text-muted-foreground mb-6">
                <Emphasized text={cta.fields.body} />
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {!pageOff("/co-creators-guide") && (
                  <Link
                    href="/co-creators-guide"
                    className="px-6 py-3 bg-notice text-background rounded-xl font-medium uppercase tracking-wider text-sm hover:bg-notice/90 transition-all flex items-center gap-2"
                  >
                    {cta.fields.guideLabel}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                )}
                {eventsUrl && cta.fields.eventsLabel && (
                  <a
                    href={eventsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-muted text-foreground rounded-full font-medium uppercase tracking-wider text-sm hover:bg-muted/80 transition-all flex items-center gap-2"
                  >
                    <Calendar className="w-5 h-5" />
                    {cta.fields.eventsLabel}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      </div>
    </Layout>
  );
}
