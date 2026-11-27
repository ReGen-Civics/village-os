/**
 * THE PIECES EVERY CHAPTER OF /rights IS DRAWN WITH (the rights fold, 27 Nov 2026).
 *
 * Rights and agreements is one page holding four chapters: the Good Neighbor
 * criteria, resident rights, steward rights and Leaving Well. Each chapter's
 * words are exactly the words its own page printed; these pieces are only the
 * frame, so the four read as one codex in the profile's look
 * (docs/DESIGN_RULE.md, components/journey/look.ts).
 */
import type { ComponentType, ReactNode } from "react";
import { EYEBROW, LEDE, RING } from "@/components/journey/look";
import { Emphasized } from "@/components/PageText";

/** A chapter's own heading id, so the page's switcher and a screen reader name the same thing. */
export const chapterHeadingId = (chapter: string) => `${chapter}-title`;

/** A panel inside a chapter: the profile's CARD, a little tighter on a phone. */
export const PANEL = "m-germ rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7";

/** The banner a chapter leads with (the role card's shared goal): gold edge, a gold wash. */
export const CHARTER = "m-germ flex gap-4 rounded-2xl border border-notice/50 bg-notice/10 p-5 sm:p-6";

/** One card of a list (a right, a responsibility, a criterion's practice): a tile on the panel. */
export const ITEM = "flex min-w-0 gap-3 rounded-xl border border-border bg-muted p-4";

/** The small round mark on an item, gold for what is held and green for what is carried. */
export const MARK_HELD = "grid size-10 shrink-0 place-items-center rounded-full border-2 border-notice text-notice";
export const MARK_CARRIED = "grid size-10 shrink-0 place-items-center rounded-full border-2 border-open/60 text-open";

/**
 * The title plate at the top of a chapter: the emblem, the small label, the
 * chapter's own headline (an h2: the page holds the one h1) and its sentence.
 * `waiting` keeps the plate's space and hides its words until they arrive.
 */
export function ChapterHead({
  chapter,
  Icon,
  eyebrow,
  title,
  intro,
  waiting = false,
  titleClass = "text-3xl sm:text-4xl",
  children,
}: {
  chapter: string;
  Icon: ComponentType<{ className?: string }>;
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  waiting?: boolean;
  titleClass?: string;
  children?: ReactNode;
}) {
  const hide = waiting ? " invisible" : "";
  return (
    <header className="rounded-2xl border border-notice/40 bg-card p-5 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className={`${RING} size-14`} aria-hidden="true">
          <Icon className="size-7" />
        </span>
        <div className="min-w-0 flex-1 break-words">
          {eyebrow ? <p className={`${EYEBROW}${hide}`}>{eyebrow}</p> : null}
          <h2
            id={chapterHeadingId(chapter)}
            tabIndex={-1}
            className={`mt-1 font-display ${titleClass} leading-tight text-foreground focus:outline-none${hide}`}
          >
            {title}
          </h2>
        </div>
      </div>
      {intro ? <div className={`${LEDE} mt-4 max-w-none sm:text-lg${hide}`}>{intro}</div> : null}
      {children}
    </header>
  );
}

/** A section's heading inside a chapter panel: the village's small label, its heading (h3), its sentence. */
export function PanelHead({
  eyebrow,
  heading,
  intro,
  lang,
}: {
  eyebrow?: string;
  heading: ReactNode;
  intro?: string;
  lang?: { eyebrow?: string; heading?: string; intro?: string };
}) {
  return (
    <div className="mb-5 break-words">
      {eyebrow ? (
        <p lang={lang?.eyebrow} className={EYEBROW}>
          {eyebrow}
        </p>
      ) : null}
      <h3 lang={lang?.heading} className="mt-1 font-display text-2xl font-semibold leading-tight text-card-foreground sm:text-3xl">
        {heading}
      </h3>
      {intro ? (
        <p lang={lang?.intro} className="mt-2 max-w-2xl text-muted-foreground">
          <Emphasized text={intro} />
        </p>
      ) : null}
    </div>
  );
}
