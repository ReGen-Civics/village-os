import Layout from "@/components/Layout";
import { Link } from "wouter";
import ReadingCopyNote from "@/components/ReadingCopyNote";
import { m } from "framer-motion";
import { usePageContent, usePageLang } from "@/hooks/usePageContent";
import { Emphasized } from "@/components/PageText";
import { RIGHTS_STEWARD_PAGE } from "@shared/pageContent/rights";
import {
  Heart,
  TreePine,
  Star,
  Compass,
  Shield,
  Leaf,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { MushroomNetwork, SeedGlint, TreeCrown } from "@/components/sacred/living";
import { useStoryPageOffAlone } from "@/lib/brochure";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CARD_FEATURED, EYEBROW, RING, WORLD } from "@/components/journey/look";

/*
 * Every word on this page is the village's own, from Admin, Pages, Steward
 * rights (shared/pageContent/rights.ts). Icons and colours stay here and are
 * handed out by position, so a village that adds a card gets the next one.
 *
 * The pay card used to explain what the recognition token is, how a pool of
 * the value token is shared across it, and (from `money.valueConversion`)
 * what that value converts to. Rye, 2026-10-22: a token may be named and no
 * sentence says what it does, because every village designs its own token
 * rules. So the card says only that each role and quest shows its worth on
 * its own card (TOKEN_COPY_PROPOSAL row 18), and this page reads no token
 * name and no conversion sentence at all.
 */
const RIGHT_ICONS = [MushroomNetwork, Heart, Star, Compass, Leaf, Shield, SeedGlint, TreePine];
const RESPONSIBILITY_ICONS = [MushroomNetwork, TreePine, Compass, Heart, SeedGlint, Star, Leaf, Shield];
/** Each stage's mark, by position, in a gold ring (look.ts RING): the sheet's tokens only. */
const STAGE_LOOKS = [{ icon: Star }, { icon: Compass }, { icon: TreeCrown }, { icon: TreePine }, { icon: Heart }];

export default function StewardRights() {
  // Null until the saved words have arrived: the hero keeps its space and
  // stays invisible meanwhile, so a visitor never reads the platform's
  // defaults and then watches them change.
  const langOf = usePageLang(RIGHTS_STEWARD_PAGE);
  const page = usePageContent(RIGHTS_STEWARD_PAGE);
  // A link to a story page switched off on its own in Admin, Pages is left out.
  const pageOff = useStoryPageOffAlone();
  const hero = page?.hero.fields;
  const ownership = page?.ownership;
  const rights = page?.rights;
  const responsibilities = page?.responsibilities;
  const progression = page?.progression;
  const cta = page?.cta;
  const waiting = page ? "" : " invisible";
  return (
    <Layout>
      {/* The night world (public launch, 24 Nov 2026): the sheet's ground and
          tokens, the same words. The hero was a teal-to-sage gradient with
          cream type and blurred white and amber blobs. */}
      <div className={WORLD}>
      {/* Hero */}
      <section className="relative py-20 overflow-hidden">
        <div className="container relative z-10 max-w-3xl">
          {/* A reading copy in the reader's language says so, and that the English is binding. */}
          <ReadingCopyNote spec={RIGHTS_STEWARD_PAGE} />
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <span className={`${RING} size-10 flex-shrink-0`} aria-hidden="true">
              <TreePine className="w-5 h-5" />
            </span>
            <span className={`min-w-0 break-words ${EYEBROW} text-sm${waiting}`}>
              {hero?.eyebrow || " "}
            </span>
          </m.div>
          <m.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`font-display text-4xl md:text-5xl font-semibold text-foreground mb-4 break-words${waiting}`}
          >
            {hero?.headline || " "}
          </m.h1>
          <m.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`text-muted-foreground text-lg leading-relaxed break-words${waiting}`}
          >
            <Emphasized text={hero?.intro || " "} />
          </m.p>
        </div>
      </section>

      {/* Co-ownership framing */}
      {ownership && !ownership.hidden && (
      <section className="py-16 bg-muted">
        <div className="container max-w-3xl">
          <div
            className={`m-germ ${CARD_FEATURED} text-center break-words`}
          >
            <TreePine className="w-10 h-10 text-open mx-auto mb-4" aria-hidden="true" />
            <h2 lang={langOf("ownership.heading")} className="font-display text-2xl font-semibold text-foreground mb-3">
              {ownership.fields.heading}
            </h2>
            <p lang={langOf("ownership.body")} className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
              <Emphasized text={ownership.fields.body} />
            </p>
          </div>
        </div>
      </section>
      )}

      {/* Rights */}
      {rights && !rights.hidden && (
      <section className="py-20 bg-background">
        <div className="container max-w-4xl">
          <div className="text-center mb-12 break-words">
            <span lang={langOf("rights.eyebrow")} className={`${EYEBROW} text-sm`}>
              {rights.fields.eyebrow}
            </span>
            <h2 lang={langOf("rights.heading")} className="font-display text-3xl md:text-4xl font-semibold text-foreground mt-2">
              {rights.fields.heading}
            </h2>
            <p lang={langOf("rights.intro")} className="text-muted-foreground mt-3 max-w-xl mx-auto">
              <Emphasized text={rights.fields.intro} />
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {rights.lists.items.map((right, i) => {
              const Icon = RIGHT_ICONS[i % RIGHT_ICONS.length];
              return (
                <div
                  key={`${i}-${right.title}`}
                  className={`m-germ ${CARD}`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`${RING} size-10 flex-shrink-0 mt-0.5`} aria-hidden="true">
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 break-words">
                      <h3 className="font-semibold text-foreground mb-2">{right.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        <Emphasized text={right.description} />
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* Responsibilities */}
      {responsibilities && !responsibilities.hidden && (
      <section className="py-20 bg-muted">
        <div className="container max-w-4xl">
          <div className="text-center mb-12 break-words">
            <span lang={langOf("responsibilities.eyebrow")} className={`${EYEBROW} text-sm`}>
              {responsibilities.fields.eyebrow}
            </span>
            <h2 lang={langOf("responsibilities.heading")} className="font-display text-3xl md:text-4xl font-semibold text-foreground mt-2">
              {responsibilities.fields.heading}
            </h2>
            <p lang={langOf("responsibilities.intro")} className="text-muted-foreground mt-3 max-w-xl mx-auto">
              <Emphasized text={responsibilities.fields.intro} />
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {responsibilities.lists.items.map((item, i) => {
              const Icon = RESPONSIBILITY_ICONS[i % RESPONSIBILITY_ICONS.length];
              return (
                <div
                  key={`${i}-${item.title}`}
                  className={`m-germ ${CARD}`}
                >
                  <div className="flex items-start gap-4">
                    <span className="inline-flex size-10 flex-shrink-0 mt-0.5 items-center justify-center rounded-full border border-open/50 text-open" aria-hidden="true">
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 break-words">
                      <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        <Emphasized text={item.description} />
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* Progression Path */}
      {progression && !progression.hidden && (
      <section className="py-20 bg-background">
        <div className="container max-w-3xl">
          <div className="text-center mb-12 break-words">
            <span lang={langOf("progression.eyebrow")} className={`${EYEBROW} text-sm`}>
              {progression.fields.eyebrow}
            </span>
            <h2 lang={langOf("progression.heading")} className="font-display text-3xl font-semibold text-foreground mt-2">
              {progression.fields.heading}
            </h2>
            <p lang={langOf("progression.intro")} className="text-muted-foreground mt-3 max-w-xl mx-auto">
              <Emphasized text={progression.fields.intro} />
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {progression.lists.stages.map((stage, i, all) => {
              const look = STAGE_LOOKS[i % STAGE_LOOKS.length];
              return (
                <div
                  key={`${i}-${stage.level}`}
                  className="m-germ flex items-center gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <span className={`${RING} size-12 flex-shrink-0`} aria-hidden="true">
                    <look.icon className="w-6 h-6" />
                  </span>
                  {/* A tag, when the village gives the stage one, takes the
                      place of the check and drops under the words on a phone. */}
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2 break-words">
                    <div className="flex-1 min-w-[10rem]">
                      <div className="font-semibold text-foreground">{stage.level}</div>
                      <div className="text-muted-foreground text-sm">{stage.description}</div>
                    </div>
                    {stage.years ? (
                      <span className="text-xs font-medium text-notice bg-notice/10 px-3 py-1 rounded-full whitespace-nowrap">
                        {stage.years}
                      </span>
                    ) : (
                      i < all.length - 1 && <CheckCircle2 className="w-5 h-5 text-open ml-auto opacity-60 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {progression.fields.footnote && (
            <p lang={langOf("progression.footnote")} className="text-xs text-muted-foreground text-center mt-4 break-words">
              {progression.fields.footnote}
            </p>
          )}
        </div>
      </section>
      )}

      {/* CTA */}
      {cta && !cta.hidden && (
      <section className="py-16 bg-muted">
        <div className="container max-w-2xl text-center break-words">
          <h2 lang={langOf("cta.heading")} className="font-display text-2xl font-semibold text-foreground mb-4">
            {cta.fields.heading}
          </h2>
          <p lang={langOf("cta.body")} className="text-muted-foreground mb-8">
            <Emphasized text={cta.fields.body} />
          </p>
          {/* Each door is ONE link. A <button> inside a <Link> is a control
              inside a control: two tab stops for one action, read as "link,
              button", and invalid HTML. self-center keeps the content width
              the old inline button had in the phone's column. */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!pageOff("/steward") && (
              <Link
                href="/steward"
                className={`${BTN_PRIMARY} self-center`}
              >
                {cta.fields.primaryLabel}
                <ArrowRight className="w-4 h-4 flex-shrink-0" />
              </Link>
            )}
            {cta.fields.secondaryLabel && (
              <Link
                href="/quests"
                className={`${BTN_SECONDARY} self-center bg-card`}
              >
                {cta.fields.secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </section>
      )}
      </div>
    </Layout>
  );
}
