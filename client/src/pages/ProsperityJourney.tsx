import Layout from "@/components/Layout";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, RING, WORLD } from "@/components/journey/look";
import { SeedOfLife } from "@/components/journey/nature";
import { altOr, useBrandImages, useVillageLinks } from "@/lib/gameApi";
import FaqSection from "@/components/FaqSection";
import { useVillageName } from "@/hooks/useVillageName";
import { useValueTokenName } from "@/hooks/useTokenNames";
import { Emphasized, Highlighted } from "@/components/PageText";
import { JourneyLink, leavesSite } from "@/components/journey/JourneyLink";
import { useJourneyContent, useJourneyProgress } from "@/hooks/useJourneyContent";
import { usePageLang } from "@/hooks/usePageContent";
import { buttonAction, stepPoints, type JourneyAction, type TargetContext } from "@/lib/journeyPage";
import { JOURNEY_LEGACY_STEP_IDS, JOURNEY_TARGETS, PROSPERITY_JOURNEY } from "@shared/pageContent/journeys";
import PacketRequestForm, { PACKET_ANCHOR } from "@/components/prosperity/PacketRequestForm";
import { useGuideName } from "@/hooks/useGuideName";
import { guideNameAtSentenceStart } from "@shared/guideName";
import { useState } from "react";
import { useLingui, Trans } from "@lingui/react/macro";
import { m, AnimatePresence } from "framer-motion";
import {
  Sprout,
  ArrowRight,
  CheckCircle2,
  Circle,
  Calendar,
  Heart,
  FileText,
  PartyPopper,
  Download,
  ChevronDown,
  ExternalLink} from "lucide-react";
import { CouncilCircle, MushroomNetwork, Pines } from "@/components/sacred/living";

/*
 * EVERY WORD ON THIS PAGE IS THE VILLAGE'S OWN, from Admin, Pages, Prosperity
 * journey (shared/pageContent/journeys.ts). What stays here is the look: the
 * icons and tier colours, handed out by position.
 */

/** Icons for the steps, in order; a longer list starts again from the top. */
const STEP_ICONS = [Calendar, Download, FileText, Heart, CouncilCircle, PartyPopper, Pines];

/**
 * Tier card edges and heading inks, lowest first, in the sheet's tokens only
 * (docs/DESIGN_RULE.md): gold for what is held, green for what is living. The
 * old brand tints (teal, sage, coral) went dark on the night ground.
 */
const TIER_COLORS = [
  "text-foreground border-border",
  "text-open border-open/40",
  "text-notice border-notice/40",
  "text-notice border-notice/70",
];

export default function ProsperityJourney() {
  const valueName = useValueTokenName();
  const villageName = useVillageName();
  // The village's own name for its guide, or "The village guide" while it has
  // none. Raised to a capital because the step's words open a sentence with it.
  const guide = useGuideName();
  const langOf = usePageLang(PROSPERITY_JOURNEY);
  const page = useJourneyContent(PROSPERITY_JOURNEY, (resolved) => ({
    guide: guideNameAtSentenceStart(guide.name),
    acronym: resolved.tiers.fields.acronym,
    framework: resolved.tiers.fields.framework,
  }));
  const hero = page?.hero.fields;
  const steps = page?.steps.lists.items ?? null;
  const brand = useBrandImages();
  // This village's own destinations. Blank hides the control that would use
  // one: an unconfigured village shows nothing rather than a button that
  // mails a stranger's enquiry to a different village.
  const { eventsUrl, mailTo } = useVillageLinks();
  const targets: TargetContext = { eventsUrl, mailTo, subject: hero?.contactSubject ?? "" };
  /*
   * THE PACKET IS ASKED FOR ON THE PAGE (24 Nov 2026). Every button that would
   * have written to the village (the contact shortcut, or a mailto: a village
   * typed) goes to the request form in the packet band instead: a mailto:
   * opens nothing on a phone with no mail app. It works with no contact address
   * set, because the form reaches the village's inbox itself.
   */
  const act = (label: string | undefined, raw: string | undefined) => {
    const words = (label ?? "").trim();
    const target = (raw ?? "").trim();
    if (words && (target === JOURNEY_TARGETS.contact || /^mailto:/i.test(target))) {
      return { label: words, action: { kind: "anchor", href: `#${PACKET_ANCHOR}` } as JourneyAction };
    }
    return buttonAction(label, raw, targets);
  };
  const heroPrimary = act(hero?.primaryLabel, hero?.primaryTarget);
  const heroSecondary = act(hero?.secondaryLabel, hero?.secondaryTarget);
  const packetCta = act(page?.packet.fields.ctaLabel, page?.packet.fields.ctaTarget);
  const closingPrimary = act(page?.closing.fields.primaryLabel, page?.closing.fields.primaryTarget);
  const closingSecondary = act(page?.closing.fields.secondaryLabel, page?.closing.fields.secondaryTarget);
  const progress = useJourneyProgress("amora-prosperity-progress", steps, JOURNEY_LEGACY_STEP_IDS.prosperity);
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const { t } = useLingui();
  const walkedCount = progress.doneCount;
  const stepCount = progress.total;
  const seedLabel = t({ message: `${walkedCount} of ${stepCount} steps completed`, context: "prosperity path ticked off" });

  // Until the saved words arrive the hero keeps its space and stays
  // invisible, so a visitor never reads the defaults and watches them change.
  const waiting = hero ? "" : " invisible";

  return (
    <Layout>
      {/* THE NIGHT WORLD (public launch, 24 Nov 2026): the page stands on the
          sheet's ground like /resident and /steward, in the semantic tokens
          only, with no looping motion beside its words. */}
      <div className={WORLD}>
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* THE HERO RENDERS ONLY WHEN THERE IS ONE.
              This was a bare <img> whose src came from the brand overlay with a
              hardcoded fallback behind it, so it always had a URL. The fallback
              pointed at one village's WordPress site and every one of those URLs
              now 404s, which is why the live page renders a torn image. With the
              fallback gone the src would simply be empty, and an <img src=""> is
              a broken image too. No picture is the honest state, and the gradient
              below carries the section on its own. */}
          {brand.prosperityHero ? (
            <m.img
              src={brand.prosperityHero}
              alt={altOr(brand.prosperityHeroAlt, "People at work on a village business")}
              className="w-full h-full object-cover"
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.5 }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60" />
        </div>

        <div className="container relative z-10">
          <div className="relative max-w-2xl">
            {/* THE COPY SITS ON AN OPAQUE BAND, as on Home and Master Plan. A
                photograph under text cannot promise a ratio: at 320 to 768px this
                one showed through under the eyebrow, the heading and the
                paragraph. On the band each is two named colours whatever the
                picture is, and with no picture the band is the colour it sits
                on. heroCopy.contrast.test.tsx */}
            <div
              aria-hidden="true"
              className="absolute -inset-x-5 -inset-y-6 sm:-inset-x-8 sm:-inset-y-10 rounded-2xl bg-background"
            />
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative flex items-center gap-3 mb-6"
            >
              <span className={`${RING} size-12 shrink-0`} aria-hidden="true">
                <Sprout className="w-6 h-6" />
              </span>
              <span className={`${EYEBROW} text-sm min-w-0 break-words${waiting}`}>{hero?.eyebrow || " "}</span>
            </m.div>

            {/* 36px under 360px wide: at 48px "Regenerative" is one unbreakable word
                that inked to x=333 at 320px, past the 304px column and the section's
                overflow-hidden edge, so its end was cut off. From 360px up, unchanged.
                break-words is for a village's own longer word at the field's limit. */}
            <m.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`relative font-display text-4xl min-[360px]:text-5xl md:text-6xl font-semibold text-foreground mb-6 break-words${waiting}`}
            >
              <Highlighted
                text={hero?.headline || " "}
                phrase={hero?.highlight ?? ""}
                render={(phrase) => <span className="text-notice italic">{phrase}</span>}
              />
            </m.h1>

            <m.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`relative text-xl text-muted-foreground leading-relaxed mb-8 break-words${waiting}`}
            >
              <Emphasized text={hero?.intro ?? ""} />
            </m.p>

            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative flex flex-wrap gap-4"
            >
              {heroPrimary && (
                <JourneyLink action={heroPrimary.action} className={BTN_PRIMARY}>
                  <Download className="w-5 h-5" />
                  {heroPrimary.label}
                </JourneyLink>
              )}
              {heroSecondary && (
                <JourneyLink action={heroSecondary.action} className={`${BTN_SECONDARY} bg-card`}>
                  {heroSecondary.label}
                </JourneyLink>
              )}
            </m.div>
          </div>
        </div>
      </section>

      {/* Shared enterprise & Co-Ownership */}
      {page && !page.economy.hidden && (
      <section className="py-16 bg-muted">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div
              className="m-germ text-center min-w-0"
            >
              <Heart className="w-12 h-12 text-notice mx-auto mb-4" aria-hidden="true" />
              <h2 lang={langOf("economy.firstHeading")} className="font-display text-xl font-semibold text-foreground mb-3 break-words">
                {page.economy.fields.firstHeading}
              </h2>
              <p className="text-muted-foreground text-sm break-words">
                {/* No conversion sentence here (Rye, 2026-10-22: copy never says
                    what a token does; token row 27). */}
                <Emphasized text={page.economy.fields.firstBody} />
              </p>
            </div>

            <div
              className="m-germ text-center min-w-0"
            >
              <MushroomNetwork className="w-12 h-12 text-notice mx-auto mb-4" aria-hidden="true" />
              <h2 lang={langOf("economy.secondHeading")} className="font-display text-xl font-semibold text-foreground mb-3 break-words">
                {page.economy.fields.secondHeading}
              </h2>
              <p lang={langOf("economy.secondBody")} className="text-muted-foreground text-sm break-words">
                <Emphasized text={page.economy.fields.secondBody} />
              </p>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Interactive Journey Steps */}
      {page && steps && (
      <section className="py-20 bg-background">
        <div className="container">
          <div
            className="m-germ text-center mb-8"
          >
            <h2 lang={langOf("steps.heading")} className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 break-words">
              {page.steps.fields.heading}
            </h2>
            {/* "{count} steps" follows the list; it said "seven" in code. */}
            <p lang={langOf("steps.intro")} className="text-muted-foreground max-w-2xl mx-auto mb-6">
              <Emphasized text={page.steps.fields.intro} />
            </p>

            {/* Progress grows as a Seed of Life, one circle per step ticked; never a filling bar (DESIGN_RULE). */}
            <div className="flex flex-col items-center gap-2">
              <SeedOfLife
                total={Math.min(Math.max(progress.total, 1), 19)}
                walked={Math.min(progress.doneCount, 19)}
                label={seedLabel}
                size="md"
              />
              <p className="text-sm text-muted-foreground">
                <Trans context="ProsperityJourney, p">{progress.doneCount} of {progress.total} steps completed
              </Trans></p>
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isCompleted = progress.isDone(step);
                const isExpanded = expandedStep === index;
                const StepIcon = STEP_ICONS[index % STEP_ICONS.length];
                const action = act(step.actionLabel, step.actionTarget);

                return (
                  <div
                    key={`${index}-${step.title}`}
                    className={`m-germ bg-card rounded-xl shadow-sm overflow-hidden transition-all ${
                      isCompleted ? "border border-l-4 border-border border-l-notice" : "border border-l-4 border-border border-l-transparent hover:border-l-notice/50"
                    }`}
                  >
                    <div
                      className="p-5 cursor-pointer"
                      onClick={() => setExpandedStep(isExpanded ? null : index)}
                    >
                      <div className="flex items-start gap-4">
                        {/*
                          This is a CHECKBOX, not a button: it records whether
                          someone has done this step of their own journey. It
                          shipped as a nameless 24px button with no state
                          exposed, so a screen reader announced "button" and
                          never said which step or whether it was done — on one
                          of the three pages a new member is walked through
                          first. Same fix in ResidentJourney and StewardJourney.
                        */}
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isCompleted}
                          aria-label={`${step.title}: mark as ${isCompleted ? "not done" : "done"}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            progress.toggle(step);
                          }}
                          className="flex-shrink-0 -mx-2.5 -mt-2 -mb-2.5 inline-flex size-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <m.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            {isCompleted ? (
                              <CheckCircle2 className="w-6 h-6 text-notice" />
                            ) : (
                              <Circle className="w-6 h-6 text-muted-foreground hover:text-notice transition-colors" />
                            )}
                          </m.div>
                        </button>

                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isCompleted ? "bg-notice/10" : "bg-muted"
                        }`}>
                          <StepIcon className={`w-5 h-5 ${isCompleted ? "text-notice" : "text-muted-foreground"}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            {/* The title keeps to the chip's line while it has 6rem there, and
                                takes its own line below the chip when it does not: a long
                                stage name at 320px left it a sliver one letter wide. */}
                            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-w-0">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                isCompleted ? "bg-notice/10 text-notice" : "bg-muted text-muted-foreground"
                              }`}>
                                {step.stage}
                              </span>
                              <h3 className={`font-display text-lg font-semibold basis-24 grow max-w-full break-words ${
                                isCompleted ? "text-muted-foreground" : "text-foreground"
                              }`}>
                                {step.title}
                              </h3>
                            </div>
                            <m.div className="shrink-0" animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            </m.div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <m.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-0 ml-14">
                            <div className="bg-muted rounded-lg p-4 mb-4">
                              <ul className="grid grid-cols-2 gap-2">
                                {stepPoints(step).map((detail, i) => (
                                  <m.li
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center gap-2 text-sm text-muted-foreground min-w-0 break-words"
                                  >
                                    <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-open" />
                                    <span className="min-w-0 break-words">{detail}</span>
                                  </m.li>
                                ))}
                              </ul>
                            </div>
                            {action && (
                              <JourneyLink
                                action={action.action}
                                className={`${BTN_PRIMARY} text-sm`}
                              >
                                {action.label}
                                {leavesSite(action.action) ? <ExternalLink className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                              </JourneyLink>
                            )}
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Impact tiers. The id stays whatever the tiers are called, so a step's
          "#ari-tiers" button lands here. */}
      {page && !page.tiers.hidden && (
      <section id="ari-tiers" className="py-20 bg-card">
        <div className="container">
          <div
            className="m-germ text-center mb-12"
          >
            <h2 lang={langOf("tiers.heading")} className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 break-words">
              {page.tiers.fields.heading}
            </h2>
            <p lang={langOf("tiers.intro")} className="text-muted-foreground max-w-2xl mx-auto">
              <Emphasized text={page.tiers.fields.intro} />
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {page.tiers.lists.items.map((tier, index) => (
              <div
                key={`${index}-${tier.tier}`}
                className={`m-germ bg-muted p-6 rounded-xl shadow-sm border-2 ${TIER_COLORS[index % TIER_COLORS.length]} min-w-0`}
              >
                <h3 className="font-display text-2xl font-semibold mb-2 break-words">
                  {tier.tier}
                </h3>
                <p className="text-sm font-medium text-muted-foreground mb-3 break-words">
                  {tier.description}
                </p>
                <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-4 break-words">
                  {tier.focus}
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground"><Trans context="ProsperityJourney, p">Impact Metrics:</Trans></p>
                  <ul className="space-y-1">
                    {[tier.metric1, tier.metric2, tier.metric3].filter(Boolean).map((metric, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-center gap-2 min-w-0 break-words">
                        <span className="w-1 h-1 shrink-0 rounded-full bg-current" />
                        <span className="min-w-0 break-words">{metric}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* THE PACKET REQUEST (24 Nov 2026): the band holds the request form
          itself, so it needs no contact address and opens on any phone. Its
          send button says what it does ("Send my request"): the band's own
          button words were written for a mail link ("Email the Village"). */}
      {page && !page.packet.hidden && (
      <section id={PACKET_ANCHOR} className="scroll-mt-24 py-20 bg-muted" data-packet-band="">
        <div className="container">
          <div
            className="m-germ max-w-2xl mx-auto text-center"
          >
            <h2 lang={langOf("packet.heading")} className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 break-words">
              {page.packet.fields.heading}
            </h2>
            <p lang={langOf("packet.body")} className="text-muted-foreground mb-8">
              <Emphasized text={page.packet.fields.body} />
            </p>
            {packetCta && packetCta.action.kind !== "anchor" ? (
              <JourneyLink action={packetCta.action} className={`${BTN_PRIMARY} mb-8`}>
                <Download className="w-5 h-5" />
                {packetCta.label}
              </JourneyLink>
            ) : null}
            <PacketRequestForm />
          </div>
        </div>
      </section>
      )}

      {/* Final CTA. Two controls, so it survives on either one. */}
      {page && !page.closing.hidden && (closingPrimary || closingSecondary) && (
      <section className="py-20 bg-background">
        <div className="container">
          <div
            className="m-germ max-w-2xl mx-auto text-center"
          >
            <Sprout className="w-12 h-12 text-open mx-auto mb-6" aria-hidden="true" />
            <h2 lang={langOf("closing.heading")} className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 break-words">
              {page.closing.fields.heading}
            </h2>
            <p lang={langOf("closing.body")} className="text-muted-foreground mb-8">
              <Emphasized text={page.closing.fields.body} />
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {closingPrimary && (
                <JourneyLink action={closingPrimary.action} className={BTN_PRIMARY}>
                  <Calendar className="w-5 h-5" />
                  {closingPrimary.label}
                </JourneyLink>
              )}
              {closingSecondary && (
                <JourneyLink action={closingSecondary.action} className={`${BTN_SECONDARY} bg-card`}>
                  <Download className="w-5 h-5" />
                  {closingSecondary.label}
                </JourneyLink>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {page && <FaqSection pathway="prosperity" heading={page.faq.fields.heading} />}
      </div>
    </Layout>
  );
}
