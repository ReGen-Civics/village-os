import { Link } from "wouter";
import ReadingCopyNote from "@/components/ReadingCopyNote";
import { useVillageContent } from "@/hooks/useVillageContent";
import { usePageContent, usePageLang } from "@/hooks/usePageContent";
import { Emphasized } from "@/components/PageText";
import { RIGHTS_RESIDENT_PAGE } from "@shared/pageContent/rights";
import { fillVars } from "@shared/pageContent/resolve";
import { Home, Heart, Shield, Leaf, TreePine, Star, Compass, ArrowRight, Baby, RefreshCw } from "lucide-react";
import { MushroomNetwork, SeedPod, SeedPodHome, TendingHands, TreeCrown } from "@/components/sacred/living";
import { useStoryPageOffAlone } from "@/lib/brochure";
import { BTN_PRIMARY, BTN_SECONDARY, RING } from "@/components/journey/look";
import { CHARTER, ChapterHead, ITEM, MARK_CARRIED, MARK_HELD, PANEL, PanelHead } from "./chapterParts";

/**
 * RESIDENT RIGHTS, a chapter of /rights (the rights fold, 27 Nov 2026). It was
 * its own page at /resident-rights, which now redirects here. Every word is
 * the village's own, from Admin, Pages, Resident rights
 * (shared/pageContent/rights.ts), in the same order it always had; only the
 * frame changed. Icons stay here and are handed out by position, so a village
 * that adds a card gets the next one in the set.
 *
 * S2 brochure lane, 2026-08-30: the Land Share card used to assert the land
 * share transfers "tax-free" as compiled-in platform code: Costa Rica's tax
 * treatment, stated unconditionally, on every fork. It comes from
 * `content.legal.landShareTransferNote` (GET /api/content/legal), which is
 * empty on any instance that has not written its own. See WhyCostaRica.tsx
 * for the fuller version of this same fix; Amora's original wording is
 * preserved as data in server/seeds/amora/brochure-legal-seed.json, not
 * deleted. Since 2026-10-22 the card's words are the village's to edit, and
 * the note arrives through the `{transfer}` word, which only this chapter fills.
 */
const RIGHT_ICONS = [Home, Shield, MushroomNetwork, Leaf, Heart, SeedPod, Star, Compass];
const RESPONSIBILITY_ICONS = [Home, TreePine, TendingHands, SeedPod, MushroomNetwork, Heart, Baby, Star];
const STAGE_ICONS = [Home, Star, TreeCrown, Compass, TreePine];

interface LegalContent {
  landShareTransferNote?: string;
}

export const RESIDENT_CHAPTER = "resident-rights";

export default function ResidentRightsChapter() {
  const { content } = useVillageContent<LegalContent>("legal");
  // Null until the saved words have arrived: the title plate keeps its space
  // and stays invisible meanwhile, so a visitor never reads the platform's
  // defaults and then watches them change.
  const langOf = usePageLang(RIGHTS_RESIDENT_PAGE);
  const page = usePageContent(RIGHTS_RESIDENT_PAGE);
  // A link to a story page switched off on its own in Admin, Pages is left out.
  const pageOff = useStoryPageOffAlone();
  const hero = page?.hero.fields;
  const ownership = page?.ownership;
  const rightsSection = page?.rights;
  const responsibilities = page?.responsibilities;
  const finances = page?.finances;
  const progression = page?.progression;
  const cta = page?.cta;
  const transferNote = content?.landShareTransferNote?.trim();
  const transfer = { transfer: transferNote ? ` ${transferNote}` : "" };
  const financeParagraphs = finances
    ? [finances.fields.body, finances.fields.body2, finances.fields.body3].filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      {/* A reading copy in the reader's language says so, and that the English is binding. */}
      <ReadingCopyNote spec={RIGHTS_RESIDENT_PAGE} />
      <ChapterHead
        chapter={RESIDENT_CHAPTER}
        Icon={SeedPodHome}
        eyebrow={hero?.eyebrow || " "}
        title={hero?.headline || " "}
        intro={<Emphasized text={hero?.intro || " "} />}
        waiting={!page}
      />

      {/* Co-ownership framing */}
      {ownership && !ownership.hidden && (
        <div className={`${CHARTER} break-words`}>
          <span className={`${RING} mt-0.5`} aria-hidden="true">
            <Home className="size-5" />
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
      {rightsSection && !rightsSection.hidden && (
        <section className={PANEL}>
          <PanelHead
            eyebrow={rightsSection.fields.eyebrow}
            heading={rightsSection.fields.heading}
            intro={rightsSection.fields.intro}
            lang={{ eyebrow: langOf("rights.eyebrow"), heading: langOf("rights.heading"), intro: langOf("rights.intro") }}
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {rightsSection.lists.items.map((right, i) => {
              const Icon = RIGHT_ICONS[i % RIGHT_ICONS.length];
              return (
                <li key={`${i}-${right.title}`} className={ITEM}>
                  <span className={MARK_HELD} aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 break-words">
                    <h4 className="font-semibold text-foreground">{right.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      <Emphasized text={fillVars(right.description, transfer)} />
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

      {/* Fees and vision */}
      {finances && !finances.hidden && (
        <section className={`${PANEL} break-words`}>
          <div className="mb-4 flex items-center gap-3">
            <span className={RING} aria-hidden="true">
              <RefreshCw className="size-5" />
            </span>
            <h3 lang={langOf("finances.heading")} className="min-w-0 font-display text-2xl font-semibold text-card-foreground sm:text-3xl">
              {finances.fields.heading}
            </h3>
          </div>
          {financeParagraphs.map((para, i) => (
            <p key={i} className="mb-4 leading-relaxed text-muted-foreground last:mb-0">
              <Emphasized text={para} />
            </p>
          ))}
        </section>
      )}

      {/* Progression: the stages as stepping stones on one trail. */}
      {progression && !progression.hidden && (
        <section className={PANEL}>
          <PanelHead
            eyebrow={progression.fields.eyebrow}
            heading={progression.fields.heading}
            intro={progression.fields.intro}
            lang={{ eyebrow: langOf("progression.eyebrow"), heading: langOf("progression.heading"), intro: langOf("progression.intro") }}
          />
          <ol className="ml-[22px] space-y-3 border-l-2 border-notice/30">
            {progression.lists.stages.map((stage, i) => {
              const Icon = STAGE_ICONS[i % STAGE_ICONS.length];
              return (
                <li key={`${i}-${stage.level}`} className="relative pl-8">
                  <span className={`${RING} absolute -left-[23px] top-1 bg-card`} aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  {/* On a phone the tag drops under the words instead of squeezing them into a sliver beside it. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-muted p-4 break-words">
                    <div className="min-w-[10rem] flex-1">
                      <h4 className="font-semibold text-foreground">{stage.level}</h4>
                      <p className="text-sm text-muted-foreground">{stage.description}</p>
                    </div>
                    {stage.years && (
                      <span className="whitespace-nowrap rounded-full bg-notice/10 px-3 py-1 text-xs font-medium text-notice">
                        {stage.years}
                      </span>
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
            {!pageOff("/resident") && (
              <Link href="/resident" className={BTN_PRIMARY}>
                {cta.fields.primaryLabel}
                <ArrowRight className="size-4 flex-shrink-0" />
              </Link>
            )}
            {/* The Good Neighbor criteria are a chapter of this same page now. */}
            {cta.fields.secondaryLabel && !pageOff("/good-neighbor") && (
              <Link href="/rights#good-neighbor" className={`${BTN_SECONDARY} bg-card`}>
                {cta.fields.secondaryLabel}
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
