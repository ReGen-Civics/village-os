import ReadingCopyNote from "@/components/ReadingCopyNote";
import { useVillageLinks } from "@/lib/gameApi";
import { usePageContent } from "@/hooks/usePageContent";
import { fillPageWords } from "@/hooks/useGoodNeighborName";
import { Emphasized } from "@/components/PageText";
import { GOOD_NEIGHBOR_PAGE } from "@shared/pageContent/goodNeighbor";
import { GOOD_NEIGHBOR_WORD } from "@shared/pageContent/goodNeighborName";
import type { ResolvedItem } from "@shared/pageContent/types";
import { Link } from "wouter";
import { useMemo } from "react";
import { Heart, MessageCircle, DollarSign, Leaf, Globe, Shield, Baby, AlertCircle, ArrowRight, CheckCircle2, Calendar } from "lucide-react";
import { Vesica } from "@/components/sacred/glyphs";
import { MushroomNetwork } from "@/components/sacred/living";
import { useStoryPageOffAlone } from "@/lib/brochure";
import { BTN_PRIMARY, BTN_SECONDARY, RING } from "@/components/journey/look";
import { ChapterHead, ITEM, PANEL, PanelHead } from "./chapterParts";

/**
 * THE GOOD NEIGHBOR CRITERIA, a chapter of /rights (the rights fold, 27 Nov
 * 2026). It was its own page at /good-neighbor, which now redirects here.
 * Every word is the village's own, from Admin, Pages, Good Neighbor
 * (shared/pageContent/goodNeighbor.ts), in the same order and with the same
 * numbering it always had; only the frame changed. The icons are handed out
 * in order.
 */
const CRITERION_ICONS = [Heart, MessageCircle, DollarSign, MushroomNetwork, Leaf, Globe, Shield, Baby];

/** The filled boxes of a row's numbered lines (`practice1`..`practice5`), in order. */
function numberedLines(row: ResolvedItem, prefix: string): string[] {
  return [1, 2, 3, 4, 5].map((i) => (row[`${prefix}${i}`] ?? "").trim()).filter(Boolean);
}

export const GOOD_NEIGHBOR_CHAPTER = "good-neighbor";

export default function GoodNeighborChapter() {
  // Blank hides the button rather than pointing at another village.
  const { eventsUrl } = useVillageLinks();
  // A link to a story page switched off on its own in Admin, Pages is left out.
  const pageOff = useStoryPageOffAlone();
  // Every word here is the village's own, from Admin, Pages, Good Neighbor.
  // `{good-neighbor}` is this chapter's own headline field, so renaming the
  // criteria renames every mention of them at once.
  const resolved = usePageContent(GOOD_NEIGHBOR_PAGE);
  const page = useMemo(
    () => (resolved ? fillPageWords(resolved, { [GOOD_NEIGHBOR_WORD]: resolved.hero.fields.name }) : null),
    [resolved],
  );
  if (!page) {
    // Nothing until the saved words arrive, so the defaults never flash first.
    return <div className="min-h-[60vh]" aria-busy="true" />;
  }
  const { hero, values, criteria, dealbreakers, process, commitments, closing } = page;
  return (
    <div className="space-y-6">
      {/* A reading copy in the reader's language says so, and that the English is binding. */}
      <ReadingCopyNote spec={GOOD_NEIGHBOR_PAGE} />
      <ChapterHead
        chapter={GOOD_NEIGHBOR_CHAPTER}
        Icon={Vesica}
        eyebrow={hero.fields.eyebrow || undefined}
        title={hero.fields.name}
        intro={<Emphasized text={hero.fields.intro} />}
      >
        {hero.fields.quote && (
          <blockquote className="mt-5 border-l-2 border-notice/60 pl-4 text-lg italic text-foreground">
            "<Emphasized text={hero.fields.quote} />"
            {hero.fields.quoteBy && <span className="mt-1 block text-sm not-italic text-muted-foreground">- {hero.fields.quoteBy}</span>}
          </blockquote>
        )}
      </ChapterHead>

      {/* What this village values */}
      {!values.hidden && (
        <section className={PANEL}>
          <PanelHead heading={values.fields.heading} />
          <ul className="grid gap-3 md:grid-cols-3">
            {values.lists.items.map((item, i) => (
              <li key={`${i}-${item.title}`} className="min-w-0 rounded-xl border border-border bg-muted p-4">
                <h4 className="font-display text-lg font-semibold text-foreground break-words">{item.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  <Emphasized text={item.body} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The criteria, numbered as they always were */}
      <section className={PANEL}>
        <PanelHead heading={criteria.fields.heading} intro={criteria.fields.intro} />
        <ol className="space-y-4">
          {criteria.lists.items.map((criterion, index) => {
            const Icon = CRITERION_ICONS[index % CRITERION_ICONS.length];
            const practices = numberedLines(criterion, "practice");
            return (
              <li key={`${index}-${criterion.title}`} className="m-germ rounded-xl border border-border bg-muted p-4 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className={`${RING} bg-card`} aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                      <h4 className="min-w-0 font-display text-xl font-semibold text-foreground break-words">{criterion.title}</h4>
                    </div>
                    <p className="text-sm font-medium text-notice break-words">{criterion.subtitle}</p>
                  </div>
                </div>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  <Emphasized text={criterion.description} />
                </p>
                {practices.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {practices.map((practice, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 flex-shrink-0 text-notice" aria-hidden="true" />
                        <p className="min-w-0 text-sm text-muted-foreground break-words">{practice}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {criterion.note && (
                  <p className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm italic text-muted-foreground">
                    <Emphasized text={criterion.note} />
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Dealbreakers */}
      {!dealbreakers.hidden && (
        <section className="m-germ rounded-2xl border border-destructive/50 bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-2 flex items-center gap-3">
            <AlertCircle className="size-6 flex-shrink-0 text-destructive" aria-hidden="true" />
            <h3 className="min-w-0 font-display text-2xl font-semibold text-card-foreground break-words sm:text-3xl">{dealbreakers.fields.heading}</h3>
          </div>
          <p className="mb-5 max-w-2xl text-muted-foreground">
            <Emphasized text={dealbreakers.fields.intro} />
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {dealbreakers.lists.groups.map((group, gi) => (
              <div key={`${gi}-${group.category}`} className="min-w-0 rounded-xl border border-border bg-muted p-4">
                <h4 className="mb-3 font-semibold text-foreground break-words">{group.category}</h4>
                <ul className="space-y-2">
                  {numberedLines(group, "item").map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 size-1.5 flex-shrink-0 rounded-full bg-destructive" aria-hidden="true" />
                      <p className="min-w-0 text-sm text-muted-foreground break-words">{item}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How fit is assessed */}
      {!process.hidden && (
        <section className={PANEL}>
          <PanelHead heading={process.fields.heading} intro={process.fields.intro} />
          <ol className="space-y-3">
            {process.lists.steps.map((item, i) => (
              <li key={`${i}-${item.title}`} className={ITEM}>
                <span className={`${RING} bg-card font-semibold`} aria-hidden="true">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground break-words">{item.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Emphasized text={item.body} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* What this village commits to you */}
      {!commitments.hidden && (
        <section className={PANEL}>
          <PanelHead heading={commitments.fields.heading} intro={commitments.fields.intro} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {commitments.lists.items.map((item, i) => (
              <li key={i} className={ITEM}>
                <CheckCircle2 className="mt-0.5 size-5 flex-shrink-0 text-notice" aria-hidden="true" />
                <p className="min-w-0 text-sm text-muted-foreground break-words">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Closing, and the chapter's doors */}
      {!closing.hidden && (
        <section className={`${PANEL} break-words`}>
          <h3 className="font-display text-2xl font-semibold text-card-foreground sm:text-3xl">{closing.fields.heading}</h3>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            <Emphasized text={closing.fields.body} />
          </p>
          {closing.fields.body2 && (
            <p className="mt-3 leading-relaxed text-muted-foreground">
              <Emphasized text={closing.fields.body2} />
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {!pageOff("/love-letter") && (
              <Link href="/love-letter" className={BTN_PRIMARY}>
                {closing.fields.commitLabel}
                <ArrowRight className="size-4 flex-shrink-0" />
              </Link>
            )}
            {eventsUrl && closing.fields.eventsLabel && (
              <a href={eventsUrl} target="_blank" rel="noopener noreferrer" className={`${BTN_SECONDARY} bg-card`}>
                <Calendar className="size-4 flex-shrink-0" aria-hidden="true" />
                {closing.fields.eventsLabel}
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
