import { Link } from "wouter";
import ReadingCopyNote from "@/components/ReadingCopyNote";
import { usePageContent, usePageLang } from "@/hooks/usePageContent";
import { Emphasized } from "@/components/PageText";
import { RIGHTS_STEWARD_PAGE } from "@shared/pageContent/rights";
import { Heart, TreePine, Star, Compass, Shield, Leaf, ArrowRight, CheckCircle2 } from "lucide-react";
import { MushroomNetwork, SeedGlint, TendingHands, TreeCrown } from "@/components/sacred/living";
import { useStoryPageOffAlone } from "@/lib/brochure";
import { BTN_PRIMARY, BTN_SECONDARY, RING } from "@/components/journey/look";
import { CHARTER, ChapterHead, ITEM, MARK_CARRIED, MARK_HELD, PANEL, PanelHead } from "./chapterParts";

/*
 * STEWARD RIGHTS, a chapter of /rights (the rights fold, 27 Nov 2026). It was
 * its own page at /steward-rights, which now redirects here. Every word is the
 * village's own, from Admin, Pages, Steward rights
 * (shared/pageContent/rights.ts), in the same order it always had; only the
 * frame changed. Icons are handed out by position, so a village that adds a
 * card gets the next one.
 *
 * The pay card used to explain what the recognition token is, how a pool of
 * the value token is shared across it, and (from `money.valueConversion`)
 * what that value converts to. Rye, 2026-10-22: a token may be named and no
 * sentence says what it does, because every village designs its own token
 * rules. So the card says only that each role and quest shows its worth on
 * its own card (TOKEN_COPY_PROPOSAL row 18), and this chapter reads no token
 * name and no conversion sentence at all.
 */
const RIGHT_ICONS = [MushroomNetwork, Heart, Star, Compass, Leaf, Shield, SeedGlint, TreePine];
const RESPONSIBILITY_ICONS = [MushroomNetwork, TreePine, Compass, Heart, SeedGlint, Star, Leaf, Shield];
/** Each stage's mark, by position, in a gold ring (look.ts RING): the sheet's tokens only. */
const STAGE_ICONS = [Star, Compass, TreeCrown, TreePine, Heart];

export const STEWARD_CHAPTER = "steward-rights";

export default function StewardRightsChapter() {
  // Null until the saved words have arrived: the title plate keeps its space
  // and stays invisible meanwhile, so a visitor never reads the platform's
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
  return (
    <div className="space-y-6">
      {/* A reading copy in the reader's language says so, and that the English is binding. */}
      <ReadingCopyNote spec={RIGHTS_STEWARD_PAGE} />
      <ChapterHead
        chapter={STEWARD_CHAPTER}
        Icon={TendingHands}
        eyebrow={hero?.eyebrow || " "}
        title={hero?.headline || " "}
        intro={<Emphasized text={hero?.intro || " "} />}
        waiting={!page}
      />

      {/* Co-ownership framing */}
      {ownership && !ownership.hidden && (
        <div className={`${CHARTER} break-words`}>
          <span className={`${RING} mt-0.5`} aria-hidden="true">
            <TreePine className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 lang={langOf("ownership.heading")} className="font-display text-2xl font-semibold text-foreground">
              {ownership.fields.heading}
            </h3>
            <p lang={langOf("ownership.body")} className="mt-2 leading-relaxed text-muted-foreground">
              <Emphasized text={ownership.fields.body} />
            </p>
          </div>
        </div>
      )}

      {/* Rights */}
      {rights && !rights.hidden && (
        <section className={PANEL}>
          <PanelHead
            eyebrow={rights.fields.eyebrow}
            heading={rights.fields.heading}
            intro={rights.fields.intro}
            lang={{ eyebrow: langOf("rights.eyebrow"), heading: langOf("rights.heading"), intro: langOf("rights.intro") }}
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {rights.lists.items.map((right, i) => {
              const Icon = RIGHT_ICONS[i % RIGHT_ICONS.length];
              return (
                <li key={`${i}-${right.title}`} className={ITEM}>
                  <span className={MARK_HELD} aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 break-words">
                    <h4 className="font-semibold text-foreground">{right.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      <Emphasized text={right.description} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Responsibilities */}
      {responsibilities && !responsibilities.hidden && (
        <section className={PANEL}>
          <PanelHead
            eyebrow={responsibilities.fields.eyebrow}
            heading={responsibilities.fields.heading}
            intro={responsibilities.fields.intro}
            lang={{
              eyebrow: langOf("responsibilities.eyebrow"),
              heading: langOf("responsibilities.heading"),
              intro: langOf("responsibilities.intro"),
            }}
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {responsibilities.lists.items.map((item, i) => {
              const Icon = RESPONSIBILITY_ICONS[i % RESPONSIBILITY_ICONS.length];
              return (
                <li key={`${i}-${item.title}`} className={ITEM}>
                  <span className={MARK_CARRIED} aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 break-words">
                    <h4 className="font-semibold text-foreground">{item.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      <Emphasized text={item.description} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* The path forward: the stages as stepping stones on one trail. */}
      {progression && !progression.hidden && (
        <section className={PANEL}>
          <PanelHead
            eyebrow={progression.fields.eyebrow}
            heading={progression.fields.heading}
            intro={progression.fields.intro}
            lang={{ eyebrow: langOf("progression.eyebrow"), heading: langOf("progression.heading"), intro: langOf("progression.intro") }}
          />
          <ol className="ml-[22px] space-y-3 border-l-2 border-notice/30">
            {progression.lists.stages.map((stage, i, all) => {
              const Icon = STAGE_ICONS[i % STAGE_ICONS.length];
              return (
                <li key={`${i}-${stage.level}`} className="relative pl-8">
                  <span className={`${RING} absolute -left-[23px] top-1 bg-card`} aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  {/* A tag, when the village gives the stage one, takes the place of the check and drops under the words on a phone. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-muted p-4 break-words">
                    <div className="min-w-[10rem] flex-1">
                      <h4 className="font-semibold text-foreground">{stage.level}</h4>
                      <p className="text-sm text-muted-foreground">{stage.description}</p>
                    </div>
                    {stage.years ? (
                      <span className="whitespace-nowrap rounded-full bg-notice/10 px-3 py-1 text-xs font-medium text-notice">
                        {stage.years}
                      </span>
                    ) : (
                      i < all.length - 1 && <CheckCircle2 className="ml-auto size-5 flex-shrink-0 text-open opacity-60" aria-hidden="true" />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {progression.fields.footnote && (
            <p lang={langOf("progression.footnote")} className="mt-4 text-xs text-muted-foreground break-words">
              {progression.fields.footnote}
            </p>
          )}
        </section>
      )}

      {/* The chapter's closing doors */}
      {cta && !cta.hidden && (
        <section className={`${PANEL} break-words`}>
          <h3 lang={langOf("cta.heading")} className="font-display text-2xl font-semibold text-card-foreground">
            {cta.fields.heading}
          </h3>
          <p lang={langOf("cta.body")} className="mt-2 text-muted-foreground">
            <Emphasized text={cta.fields.body} />
          </p>
          {/* Each door is ONE link: a <button> inside a <Link> is a control inside a control. */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {!pageOff("/steward") && (
              <Link href="/steward" className={BTN_PRIMARY}>
                {cta.fields.primaryLabel}
                <ArrowRight className="size-4 flex-shrink-0" />
              </Link>
            )}
            {cta.fields.secondaryLabel && (
              <Link href="/quests" className={`${BTN_SECONDARY} bg-card`}>
                {cta.fields.secondaryLabel}
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
