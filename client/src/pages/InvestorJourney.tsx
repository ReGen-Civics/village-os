import Layout from "@/components/Layout";
import { altOr, statedFacts, useBrandImages, useVillageLinks, useVillageSettings } from "@/lib/gameApi";
import WhyCostaRica from "@/components/WhyCostaRica";
import FaqSection from "@/components/FaqSection";
import PathConsentBox, { FORM_CONSENT_FIELD } from "@/components/comms/PathConsentBox";
import InvestorSummary from "@/components/InvestorSummary";
import { Emphasized, Highlighted } from "@/components/PageText";
import { JourneyLink, leavesSite } from "@/components/journey/JourneyLink";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  CARD_FEATURED,
  CHIP,
  CHIP_SOFT,
  EYEBROW,
  FIELD,
  HINT,
  LABEL,
  LEDE,
  NOTE,
  RING,
  TICK,
  TILE,
  WORLD,
} from "@/components/journey/look";
import { SeedOfLife } from "@/components/journey/nature";
import { useJourneyContent, useJourneyProgress } from "@/hooks/useJourneyContent";
import { buttonAction, percent, stepPoints, type TargetContext } from "@/lib/journeyPage";
import { INVESTOR_FIGURE_IDS, INVESTOR_JOURNEY, JOURNEY_LEGACY_STEP_IDS } from "@shared/pageContent/journeys";
import { useEffect, useState } from "react";
import { useLingui, Trans } from "@lingui/react/macro";
import { m, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  Calendar,
  Heart,
  Building,
  Users,
  Sparkles,
  ChevronDown,
  ExternalLink,
  Send,
  MapPin,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

/*
 * EVERY WORD ON THIS PAGE IS THE VILLAGE'S OWN, from Admin, Pages, Investor
 * journey (shared/pageContent/journeys.ts). What stays here is the look: the
 * icons, handed out by position, and the forms' machinery.
 *
 * THE NIGHT WORLD (investor remake, 24 Nov 2026). The page stands in the
 * sheet's world like the landing, /roles and the steward and resident paths
 * (docs/DESIGN_RULE.md): semantic tokens, the display face, panels, gold for
 * the one main act. It used to be the app's light ground with brand-ink
 * gradients, the one door from the landing that still looked like another
 * site. Phone first: one column, the picture above the words, each person's
 * story a short row. From `lg` up the picture stands beside the words and the
 * journey's heading stays in view beside its steps.
 */

/** Icons for the steps, in order; a longer list starts again from the top. */
const STEP_ICONS = [Sparkles, FileText, Calendar, Heart];

/*
 * KEY NUMBERS ARE THE VILLAGE'S OWN, OR THERE ARE NONE.
 *
 * These four tiles used to be literals in this file: a land appreciation
 * percentage, an appraisal with its month, a projected internal rate of return,
 * and a target raise, all about one specific property in one specific country.
 * Any village that pulled this platform published every one of them as its own
 * the first time somebody opened this page, and no screen anywhere could change
 * them.
 *
 * What stays here is the tile's icon. Its heading and the sentence explaining
 * the figure are the page's words; what a figure IS comes from the village,
 * through Admin, Settings. A village that has stated none of them gets the
 * honest sentence rather than an empty grid, and never a default: a number
 * nobody typed is a claim nobody made.
 */
const METRIC_LOOKS: Record<(typeof INVESTOR_FIGURE_IDS)[number], { icon: typeof TrendingUp }> = {
  appreciation: { icon: TrendingUp },
  appraisal: { icon: Building },
  projectedReturn: { icon: BarChart3 },
  targetRaise: { icon: Zap },
};

/** The icon for each person card, handed out in order. */
const PERSONA_ICONS = [MapPin, Users, Heart, Sparkles, TrendingUp, Building];

/** A section's heading on the night ground: the display face, never bold on the sheet. */
const SECTION_H2 = "font-display text-3xl leading-tight text-foreground sm:text-4xl break-words";

const PACK_FORM = "pack-form";
const CALL_FORM = "call-form";

export default function InvestorJourney() {
  const page = useJourneyContent(INVESTOR_JOURNEY);
  const hero = page?.hero.fields;
  const figures = page?.figures;
  const personas = page?.personas;
  const steps = page?.steps.lists.items ?? null;
  const phases = page?.phases;
  const closing = page?.closing;
  const casePoints = page && !page.case.hidden ? page.case.lists.points : [];
  const risks = page && !page.risks.hidden && (page.risks.fields.intro || page.risks.lists.items.length) ? page.risks : null;
  // The "not an offer" line: under the hero's buttons and in both forms, never twice on the page itself.
  const notice = page && !page.notice.hidden ? page.notice.fields.body : "";
  const accreditationOn = !!page && !page.accreditation.hidden;
  const brand = useBrandImages();
  const settings = useVillageSettings();
  const { t } = useLingui();
  // NULL IS "NOT LOADED YET", NEVER "NOTHING STATED". Without this line the
  // page tells every visitor "this village has not published any figures" for
  // the length of one fetch, including on a village that has published four,
  // which is a sentence the product would be saying out of a default rather
  // than out of what happened.
  const loaded = settings !== null;
  const financialMetrics = statedFacts(
    settings,
    (figures?.lists.tiles ?? []).flatMap((tile) => {
      const look = (METRIC_LOOKS as Record<string, (typeof METRIC_LOOKS)[keyof typeof METRIC_LOOKS] | undefined>)[tile.id ?? ""];
      return look ? [{ key: tile.id ?? "", title: tile.title, detail: tile.detail, ...look }] : [];
    }),
  );
  const progress = useJourneyProgress("amora-investor-progress", steps, JOURNEY_LEGACY_STEP_IDS.investor);
  const walkedCount = progress.doneCount;
  const stepCount = progress.total;
  const countLine = t({ message: `${walkedCount} of ${stepCount} steps completed`, context: "investor path ticked off" });
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [showPackForm, setShowPackForm] = useState(false);
  const [showCallForm, setShowCallForm] = useState(false);
  const [packFormData, setPackFormData] = useState({ name: "", email: "", investmentRange: "", message: "", accredited: false });
  const [callFormData, setCallFormData] = useState({ name: "", email: "", preferredTime: "", message: "" });
  // The "walk me through the next steps" box on each form (5.11): unticked unless the person ticks it.
  const [packConsent, setPackConsent] = useState(false);
  const [callConsent, setCallConsent] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  // This village's own destinations. A button whose destination is blank is
  // not drawn: an investment commitment is the single worst enquiry to
  // misroute, so a blank contact address hides it rather than addressing it
  // to somebody else.
  const { eventsUrl, contactEmail, mailTo } = useVillageLinks();
  const targets: TargetContext = { eventsUrl, mailTo, subject: hero?.contactSubject ?? "", forms: [PACK_FORM, CALL_FORM] };
  const openForm = (form: string) => (form === PACK_FORM ? setShowPackForm(true) : setShowCallForm(true));
  /*
   * AN EMPTY PACK IS NOT OFFERED (the lead, 24 Nov 2026: "If nothing is in
   * packet let the button be disabled"). The public summary says whether any
   * document is in the pack; until one is, every "request the pack" button is
   * drawn disabled with one line saying why, and the server refuses a request
   * that arrives anyway. Unknown (still loading, an older server) leaves the
   * button as it was: the server's refusal is the backstop.
   */
  const [packReady, setPackReady] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/investor-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j && typeof j.packReady === "boolean") setPackReady(j.packReady); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const packClosed = packReady === false;
  const formDisabled = (form: string) => form === PACK_FORM && packClosed;
  const opensPack = (b: { action: { kind: string; form?: string } } | null | undefined) => !!b && b.action.kind === "form" && b.action.form === PACK_FORM;
  const packPreparing = t({ message: "The investor pack is being prepared.", context: "investor page: under a disabled request-the-pack button" });
  const heroPrimary = buttonAction(hero?.primaryLabel, hero?.primaryTarget, targets);
  const heroSecondary = buttonAction(hero?.secondaryLabel, hero?.secondaryTarget, targets);
  const closingPrimary = buttonAction(closing?.fields.primaryLabel, closing?.fields.primaryTarget, targets);
  const closingSecondary = buttonAction(closing?.fields.secondaryLabel, closing?.fields.secondaryTarget, targets);
  // Named once so the two failure paths below cannot drift apart. With no
  // published address the sentence simply stops after "try again": pointing a
  // failed investor at a mailbox this village does not own is how the lead
  // disappears without anybody noticing.
  const retryNote = contactEmail
    ? `Something went wrong. Please try again or email ${contactEmail}.`
    : "Something went wrong. Please try again.";

  const handlePackFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accreditationOn && !packFormData.accredited) {
      setFormSuccess(page?.accreditation.fields.reminder ?? null);
      setTimeout(() => setFormSuccess(null), 4000);
      return;
    }
    try {
      /*
       * Everything the form asks for reaches the lead (POST
       * /api/investor-docs/request). A village that switched the
       * accreditation question off sends null, recorded as "not asked".
       */
      const response = await fetch("/api/investor-docs/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: packFormData.name,
          email: packFormData.email,
          accredited: accreditationOn ? packFormData.accredited : null,
          investmentRange: packFormData.investmentRange,
          message: packFormData.message,
          [FORM_CONSENT_FIELD]: packConsent,
        }),
      });
      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        setFormSuccess(result.message || "Check your email - we've sent you the full investor packet.");
        setShowPackForm(false);
        setPackFormData({ name: "", email: "", investmentRange: "", message: "", accredited: false });
        setPackConsent(false);
        setTimeout(() => setFormSuccess(null), 6000);
      } else if (response.status === 409) {
        // The pack emptied while the form was open: the server's own sentence, and the buttons close.
        const result = await response.json().catch(() => ({}));
        setFormSuccess(String(result.message || packPreparing));
        setShowPackForm(false);
        setPackReady(false);
        setTimeout(() => setFormSuccess(null), 6000);
      } else {
        setFormSuccess(retryNote);
        setTimeout(() => setFormSuccess(null), 5000);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setFormSuccess(retryNote);
      setTimeout(() => setFormSuccess(null), 5000);
    }
  };

  const handleCallFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "investor-call",
          data: { ...callFormData, [FORM_CONSENT_FIELD]: callConsent }
        })
      });
      if (response.ok) {
        setFormSuccess(page?.callForm.fields.thanks ?? null);
        setShowCallForm(false);
        setCallFormData({ name: "", email: "", preferredTime: "", message: "" });
        setCallConsent(false);
        setTimeout(() => setFormSuccess(null), 5000);
      }
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  // Until the saved words arrive the hero keeps its space and stays
  // invisible, so a visitor never reads the defaults and watches them change.
  const waiting = hero ? "" : " invisible";
  const heroArt = brand.investorHero;

  return (
    <Layout>
      {/* The sheet's world (docs/DESIGN_RULE.md), as the landing and the other paths are. */}
      <div className={WORLD}>
      {/* Hero. The picture is a framed card beside the words from lg up and
          above them on a phone, the way the landing's path cards carry it, so
          no sentence sits on a photograph. */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 lg:py-20">
        <div className={`container relative z-10 grid gap-8 lg:items-center ${heroArt ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14" : ""}`}>
          <div className="relative order-2 max-w-2xl lg:order-1">
            {/* THE COPY SITS ON AN OPAQUE BAND, as on Home and Master Plan. It
                matches the ground, so it is invisible here; it is what keeps
                the copy's ratio whatever a village later paints behind it.
                heroCopy.contrast.test.tsx */}
            <div aria-hidden="true" className="absolute -inset-x-4 -inset-y-5 rounded-2xl bg-background" />
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative mb-5 flex items-center gap-3"
            >
              {/* A gold ring, the way the sheet carries its icons. It used to rock forever beside the text. */}
              <span className={RING} aria-hidden="true">
                <TrendingUp className="size-5" />
              </span>
              <span className={`${EYEBROW} min-w-0 break-words${waiting}`}>{hero?.eyebrow || " "}</span>
            </m.div>

            {/* 36px under 360px wide: at 48px "Regeneration" is one unbreakable word
                that inked to x=336 at 320px, past the 304px column. From 360px up,
                the display size. break-words is for a village's own longer word. */}
            <m.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className={`relative mb-5 font-display text-4xl leading-tight text-foreground min-[360px]:text-5xl lg:text-6xl break-words${waiting}`}
            >
              <Highlighted
                text={hero?.headline || " "}
                phrase={hero?.highlight ?? ""}
                render={(phrase) => <span className="italic text-notice">{phrase}</span>}
              />
            </m.h1>

            <m.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className={`relative mb-8 text-lg leading-relaxed text-muted-foreground sm:text-xl break-words${waiting}`}
            >
              <Emphasized text={hero?.intro ?? ""} />
            </m.p>

            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="relative flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap"
            >
              {/* The first button opens the page's own pack form by default,
                  posting to this village's own server: the lead is captured,
                  it reaches the right village, and the request passes through
                  the accreditation step the journey already had. */}
              {heroPrimary && (
                <JourneyLink action={heroPrimary.action} onForm={openForm} formDisabled={formDisabled} className={BTN_PRIMARY}>
                  <FileText className="size-5" aria-hidden="true" />
                  {heroPrimary.label}
                </JourneyLink>
              )}
              {heroSecondary && (
                <JourneyLink action={heroSecondary.action} onForm={openForm} formDisabled={formDisabled} className={`${BTN_SECONDARY} bg-card`}>
                  <Calendar className="size-5" aria-hidden="true" />
                  {heroSecondary.label}
                </JourneyLink>
              )}
            </m.div>
            {packClosed && (opensPack(heroPrimary) || opensPack(heroSecondary)) && (
              <p className="relative mt-3 text-sm text-muted-foreground" data-pack-preparing="">{packPreparing}</p>
            )}
            {notice ? (
              <p className="relative mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground break-words">{notice}</p>
            ) : null}
          </div>

          {/* THE PICTURE RENDERS ONLY WHEN THERE IS ONE. It came from a
              hardcoded fallback on one village's old site that now 404s; no
              picture is the honest state, and the words stand alone. */}
          {heroArt ? (
            <m.figure
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="order-1 overflow-hidden rounded-2xl border border-notice/50 bg-card shadow-sm lg:order-2"
            >
              <img
                src={heroArt}
                alt={altOr(brand.investorHeroAlt, "The land and the buildings on it")}
                className="h-52 w-full object-cover min-[420px]:h-64 sm:h-80 lg:h-[30rem]"
                style={brand.investorHeroFocus ? { objectPosition: brand.investorHeroFocus } : undefined}
              />
            </m.figure>
          ) : null}
        </div>
      </section>

      {/* Why this village: the village's own reasons, numbered. Not drawn until it writes one. */}
      {page && casePoints.length > 0 && (
      <section className="pb-12 sm:pb-16">
        <div className="container">
          <div className="mb-6 max-w-2xl sm:mb-8">
            <h2 className={`${SECTION_H2} mb-3`}>{page.case.fields.heading}</h2>
            {page.case.fields.intro ? (
              <p className={LEDE}>
                <Emphasized text={page.case.fields.intro} />
              </p>
            ) : null}
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {casePoints.map((point, index) => (
              <li key={`${index}-${point.title}`} className="flex min-w-0 gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-col sm:p-6">
                <span className={`${RING} font-display text-lg`} aria-hidden="true">{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-card-foreground break-words sm:text-xl">{point.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground break-words sm:text-base">
                    <Emphasized text={point.detail} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      )}

      {/* Key numbers. A panel either way: the figures on tiles, or the
          village's one honest sentence in the panel they would fill. */}
      {figures && !figures.hidden && (
      <section className="pb-12 sm:pb-16">
        <div className="container">
          {loaded && financialMetrics.length ? (
            <div className={CARD}>
              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10">
                <div className="mb-6 lg:mb-0">
                  <h2 className={SECTION_H2}>{figures.fields.heading}</h2>
                  <p className={`${NOTE} mt-3`}>{figures.fields.intro}</p>
                  {figures.fields.disclaimer ? (
                    <p className="mt-4 text-xs italic leading-relaxed text-muted-foreground">{figures.fields.disclaimer}</p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {financialMetrics.map((metric) => (
                    <div key={metric.key} className={`${TILE} min-w-0`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="min-w-0 font-display text-lg text-foreground break-words">{metric.title}</h3>
                        <span className={`${RING} size-9`} aria-hidden="true">
                          <metric.icon className="size-4" />
                        </span>
                      </div>
                      <div className="font-display text-3xl text-notice break-words sm:text-4xl">{metric.value}</div>
                      <div className="mt-1 text-xs font-medium text-muted-foreground">{metric.note}</div>
                      <p className={`${HINT} mt-3 leading-relaxed break-words`}>{metric.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={`${CARD} flex items-start gap-4`}>
              <span className={RING} aria-hidden="true">
                <BarChart3 className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-2xl text-card-foreground break-words">{figures.fields.heading}</h2>
                {/* R56: state what is true and get out of the way. A village with
                    no figures yet is early, and saying so beats an empty grid. The
                    line telling the village where to enter them belongs in Admin,
                    never on its public page. */}
                <p className={`${NOTE} mt-1.5`}>{!loaded ? " " : figures.fields.empty}</p>
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      <InvestorSummary />

      {/* Who invests in this village. A short row each on a phone, a card each from sm up. */}
      {personas && !personas.hidden && (
      <section className="border-t border-border/60 py-14 sm:py-20">
        <div className="container">
          <div className="mb-8 max-w-2xl sm:mb-10">
            <h2 className={`${SECTION_H2} mb-3`}>{personas.fields.heading}</h2>
            <p className={LEDE}>
              <Emphasized text={personas.fields.intro} />
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
            {personas.lists.items.map((persona, index) => {
              const Icon = PERSONA_ICONS[index % PERSONA_ICONS.length];
              return (
                <li
                  key={`${index}-${persona.title}`}
                  className="flex min-w-0 items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-notice/60 sm:flex-col sm:p-6"
                >
                  <span className={RING} aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg text-card-foreground break-words sm:text-xl">{persona.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground break-words sm:text-base">{persona.subtitle}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      )}

      <WhyCostaRica />

      {/* The journey. From lg up its heading and the seed stay in view beside the steps. */}
      {page && steps && (
      <section className="py-14 sm:py-20">
        <div className="container grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 className={`${SECTION_H2} mb-3`}>{page.steps.fields.heading}</h2>
            <p className={`${LEDE} mb-6`}>
              <Emphasized text={page.steps.fields.intro} />
            </p>
            {/* Progress grows as a Seed of Life, one circle per step ticked; never a filling bar. */}
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              <SeedOfLife
                total={Math.min(Math.max(stepCount, 1), 19)}
                walked={Math.min(walkedCount, 19)}
                label={countLine}
                size="md"
              />
              <p className={HINT}>{countLine}</p>
            </div>
          </div>

          <ol className="space-y-3">
            {steps.map((step, index) => {
              const isCompleted = progress.isDone(step);
              const isExpanded = expandedStep === index;
              const StepIcon = STEP_ICONS[index % STEP_ICONS.length];
              const action = buttonAction(step.actionLabel, step.actionTarget, targets);

              return (
                <li
                  key={`${index}-${step.title}`}
                  className={`overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors ${
                    isCompleted ? "border-notice/70" : "border-border hover:border-notice/50"
                  }`}
                >
                  <div
                    className="cursor-pointer p-4 sm:p-5"
                    onClick={() => setExpandedStep(isExpanded ? null : index)}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Named and typed the way the steward, resident and prosperity
                          journeys already do it. This one was the outlier:
                          sixteen bare icon buttons whose only child is an svg,
                          so a screen reader announced "button" and this was the
                          ONLY keyboard path to mark an investor stage done. */}
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isCompleted}
                        aria-label={`${step.title}: mark as ${isCompleted ? "not done" : "done"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          progress.toggle(step);
                        }}
                        className="-mx-2.5 -mt-1.5 -mb-2.5 inline-flex size-11 flex-shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="size-6 text-notice" />
                        ) : (
                          <Circle className="size-6 text-muted-foreground transition-colors hover:text-notice" />
                        )}
                      </button>

                      <span
                        aria-hidden="true"
                        className={`hidden size-10 flex-shrink-0 items-center justify-center rounded-full border bg-muted min-[400px]:inline-flex ${
                          isCompleted ? "border-notice text-notice" : "border-border text-muted-foreground"
                        }`}
                      >
                        <StepIcon className="size-5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className={`${CHIP_SOFT} break-words`}>
                            <Trans context="InvestorJourney, span">Stage: {step.stage}</Trans>
                          </span>
                          <m.span
                            className="shrink-0"
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="size-5 text-muted-foreground" aria-hidden="true" />
                          </m.span>
                        </div>
                        <h3 className={`font-display text-xl break-words ${
                          isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                        }`}>
                          {step.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground break-words sm:text-base">
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
                        <div className="px-4 pb-5 sm:px-5 sm:pl-[4.75rem]">
                          <div className={`${TILE} mb-4`}>
                            <h4 className="mb-3 text-sm font-semibold text-foreground"><Trans context="InvestorJourney, h4">What you'll accomplish:</Trans></h4>
                            <ul className="grid gap-2 sm:grid-cols-2">
                              {stepPoints(step).map((detail, i) => (
                                <li key={i} className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground break-words">
                                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-open" />
                                  <span className="min-w-0 break-words">{detail}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          {action && (
                            <JourneyLink action={action.action} onForm={openForm} formDisabled={formDisabled} className={`${BTN_PRIMARY} text-sm`}>
                              {action.label}
                              {leavesSite(action.action) ? <ExternalLink className="size-4" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
                            </JourneyLink>
                          )}
                          {packClosed && opensPack(action) && <p className="mt-2 text-sm text-muted-foreground" data-pack-preparing="">{packPreparing}</p>}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
      )}

      {/* The village's phases. Not drawn until the village lists a phase: a
          heading over an empty band would say the village plans nothing. */}
      {phases && !phases.hidden && phases.lists.items.length > 0 && (
      <section className="border-t border-border/60 py-14 sm:py-20">
        <div className="container">
          <div className="mb-8 max-w-2xl">
            <h2 className={`${SECTION_H2} mb-3`}>{phases.fields.heading}</h2>
            <p className={LEDE}>
              <Emphasized text={phases.fields.intro} />
            </p>
          </div>

          <ul className="grid gap-3 md:grid-cols-2">
            {phases.lists.items.map((phase, index) => {
              const filled = percent(phase.progress);
              const active = phase.status === phases.fields.activeStatus;
              return (
              <li key={`${index}-${phase.name}`} className={`${TILE} bg-card`}>
                {/* The status keeps to the name's line while the name has 9rem
                    there, and drops below it when it does not: a long status
                    at 320px left the name a sliver. */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex min-w-0 grow basis-36 items-center gap-3">
                    <span className={`${RING} size-9`} aria-hidden="true">
                      <Building className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-lg text-foreground break-words">{phase.name}</div>
                      <div className="text-sm text-muted-foreground break-words">{phase.units}</div>
                    </div>
                  </div>
                  {phase.status && (
                  <span className={active ? CHIP : CHIP_SOFT}>
                    {phase.status}
                  </span>
                  )}
                </div>
                {/* The village's own figure for how far this phase has come. */}
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={phase.name}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={filled}
                >
                  <div className="h-full rounded-full bg-notice" style={{ width: `${filled}%` }} />
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      </section>
      )}

      {/* What could go wrong, said plainly, before the questions. */}
      {risks && (
      <section className="py-14 sm:py-20">
        <div className="container">
          <div className={CARD}>
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10">
              <div className="mb-6 lg:mb-0">
                <h2 className={`${SECTION_H2} mb-3`}>{risks.fields.heading}</h2>
                {risks.fields.intro ? (
                  <p className={NOTE}>
                    <Emphasized text={risks.fields.intro} />
                  </p>
                ) : null}
              </div>
              {risks.lists.items.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {risks.lists.items.map((risk, index) => (
                    <li key={`${index}-${risk.title}`} className={`${TILE} min-w-0`}>
                      <h3 className="font-display text-lg text-foreground break-words">{risk.title}</h3>
                      <p className={`${HINT} mt-1.5 leading-relaxed break-words`}>
                        <Emphasized text={risk.detail} />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {page && <FaqSection pathway="investor" heading={page.faq.fields.heading} />}

      {/* The closing invitation: the one panel on the page that says "start here". */}
      {closing && !closing.hidden && (
      <section className="py-14 sm:py-20">
        <div className="container">
          <div className={`${CARD_FEATURED} mx-auto max-w-2xl text-center`}>
            <span className={`${RING} mx-auto mb-5 size-12`} aria-hidden="true">
              <Sparkles className="size-6" />
            </span>
            <h2 className={`${SECTION_H2} mb-4`}>{closing.fields.heading}</h2>
            <p className={`${NOTE} mx-auto mb-8 max-w-xl`}>
              <Emphasized text={closing.fields.body} />
            </p>
            <div className="flex flex-col justify-center gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
              {closingPrimary && (
                <JourneyLink action={closingPrimary.action} onForm={openForm} formDisabled={formDisabled} className={BTN_PRIMARY}>
                  {closingPrimary.label}
                  <ArrowRight className="size-5" aria-hidden="true" />
                </JourneyLink>
              )}
              {closingSecondary && (
                <JourneyLink action={closingSecondary.action} onForm={openForm} formDisabled={formDisabled} className={BTN_SECONDARY}>
                  {closingSecondary.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </JourneyLink>
              )}
            </div>
            {packClosed && (opensPack(closingPrimary) || opensPack(closingSecondary)) && (
              <p className="mt-3 text-sm text-muted-foreground" data-pack-preparing="">{packPreparing}</p>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Success Message */}
      <AnimatePresence>
        {formSuccess && (
          <m.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role="status"
            className="fixed inset-x-4 top-4 z-50 rounded-xl border border-notice/60 bg-card px-5 py-3 text-foreground shadow-sm sm:left-auto sm:right-4 sm:max-w-sm"
          >
            {formSuccess}
          </m.div>
        )}
      </AnimatePresence>
      </div>

      {/* Investor Pack Form Modal. The dialog is portalled out of the world,
          so it carries the sheet's class itself, as BadgeRoster's does. */}
      <Dialog open={showPackForm} onOpenChange={(o) => { if (!o) setShowPackForm(false); }}>
        <DialogContent className="sheet-night max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-card p-6 text-card-foreground shadow-sm sm:max-w-md sm:p-8">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-card-foreground">
              <Trans context="InvestorJourney, DialogTitle">Request Investor Pack
            </Trans></DialogTitle>
            <DialogDescription className="sr-only">
              <Trans context="InvestorJourney, DialogDescription">Request the full investor pack with financials and development timeline.
            </Trans></DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePackFormSubmit} className="space-y-4">
            <div>
              <label className={`${LABEL} mb-1.5 block`}><Trans context="InvestorJourney, label">Name</Trans></label>
              <input
                type="text"
                value={packFormData.name}
                onChange={(e) => setPackFormData({ ...packFormData, name: e.target.value })}
                required
                className={FIELD}
              />
            </div>
            <div>
              <label className={`${LABEL} mb-1.5 block`}><Trans context="InvestorJourney, label">Email</Trans></label>
              <input
                type="email"
                value={packFormData.email}
                onChange={(e) => setPackFormData({ ...packFormData, email: e.target.value })}
                required
                className={FIELD}
              />
            </div>
            <div>
              <label className={`${LABEL} mb-1.5 block`}><Trans context="InvestorJourney, label">Investment Range</Trans></label>
              <input
                type="text"
                placeholder={page?.packForm.fields.rangeHint || undefined}
                value={packFormData.investmentRange}
                onChange={(e) => setPackFormData({ ...packFormData, investmentRange: e.target.value })}
                className={FIELD}
              />
            </div>
            <div>
              <label className={`${LABEL} mb-1.5 block`}><Trans context="InvestorJourney, label">Message (optional)</Trans></label>
              <textarea
                value={packFormData.message}
                onChange={(e) => setPackFormData({ ...packFormData, message: e.target.value })}
                rows={3}
                className={`${FIELD} resize-none`}
              />
            </div>
            {accreditationOn && (
            <label className={`${TILE} flex cursor-pointer items-start gap-3 text-sm text-foreground`}>
              <input
                type="checkbox"
                checked={packFormData.accredited}
                onChange={(e) => setPackFormData({ ...packFormData, accredited: e.target.checked })}
                className={TICK}
              />
              <span className="leading-snug break-words">
                {page?.accreditation.fields.statement}
              </span>
            </label>
            )}
            <PathConsentBox checked={packConsent} onChange={setPackConsent} />
            {notice ? <p className="text-xs leading-relaxed text-muted-foreground">{notice}</p> : null}
            <button type="submit" className={`${BTN_PRIMARY} w-full`}>
              <Trans context="InvestorJourney, button"><Send className="size-4" aria-hidden="true" />
              Send Request
            </Trans></button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Call Form Modal */}
      <Dialog open={showCallForm} onOpenChange={(o) => { if (!o) setShowCallForm(false); }}>
        <DialogContent className="sheet-night max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-card p-6 text-card-foreground shadow-sm sm:max-w-md sm:p-8">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-card-foreground">
              <Trans context="InvestorJourney, DialogTitle">Schedule a Call
            </Trans></DialogTitle>
            <DialogDescription className="sr-only">
              <Trans context="InvestorJourney, DialogDescription">Schedule a one-on-one investment call with our team.
            </Trans></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCallFormSubmit} className="space-y-4">
            <div>
              <label className={`${LABEL} mb-1.5 block`}><Trans context="InvestorJourney, label">Name</Trans></label>
              <input
                type="text"
                value={callFormData.name}
                onChange={(e) => setCallFormData({ ...callFormData, name: e.target.value })}
                required
                className={FIELD}
              />
            </div>
            <div>
              <label className={`${LABEL} mb-1.5 block`}><Trans context="InvestorJourney, label">Email</Trans></label>
              <input
                type="email"
                value={callFormData.email}
                onChange={(e) => setCallFormData({ ...callFormData, email: e.target.value })}
                required
                className={FIELD}
              />
            </div>
            <div>
              <label className={`${LABEL} mb-1.5 block`}><Trans context="InvestorJourney, label">Preferred Time</Trans></label>
              <input
                type="text"
                placeholder={page?.callForm.fields.timeHint || undefined}
                value={callFormData.preferredTime}
                onChange={(e) => setCallFormData({ ...callFormData, preferredTime: e.target.value })}
                className={FIELD}
              />
            </div>
            <div>
              <label className={`${LABEL} mb-1.5 block`}><Trans context="InvestorJourney, label">Message (optional)</Trans></label>
              <textarea
                value={callFormData.message}
                onChange={(e) => setCallFormData({ ...callFormData, message: e.target.value })}
                rows={3}
                className={`${FIELD} resize-none`}
              />
            </div>
            <PathConsentBox checked={callConsent} onChange={setCallConsent} />
            {notice ? <p className="text-xs leading-relaxed text-muted-foreground">{notice}</p> : null}
            <button type="submit" className={`${BTN_PRIMARY} w-full`}>
              <Trans context="InvestorJourney, button"><Send className="size-4" aria-hidden="true" />
              Request Call
            </Trans></button>
          </form>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}
