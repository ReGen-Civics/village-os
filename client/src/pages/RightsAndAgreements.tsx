/**
 * RIGHTS AND AGREEMENTS (the rights fold, 27 Nov 2026; the lead: "Yes").
 *
 * Four pages became one: the Good Neighbor criteria (/good-neighbor), resident
 * rights (/resident-rights), steward rights (/steward-rights) and Leaving Well
 * (/exit-policy). Each old address redirects here with its own anchor, and its
 * query rides along, so `/exit-policy?focus=begin-departure` still lands on the
 * departure card.
 *
 * LEGAL CARE. These chapters hold binding wording. The fold is layout,
 * navigation and grouping only: every chapter prints exactly the words, order
 * and numbering its own page printed, from the same fields and the same
 * strings, and each keeps its own reading-copy note ("The English text is the
 * binding version"). A wording change is a suggestion for counsel, never code.
 *
 * ONE CHAPTER AT A TIME. The four pages stacked were about 28,000 pixels on a
 * phone. The page opens on a list of the four, and the chapter you pick is the
 * one drawn below it; the address carries its anchor, so a link, a bookmark and
 * the back button all land on the same chapter. Every chapter is still in the
 * document, so printing the page prints all four (calendar/print.css hides the
 * page only around a calendar sheet or a rites packet).
 *
 * WHAT EACH CHAPTER FOLLOWS. The three story chapters keep their own Admin,
 * Pages switches, keyed by their old addresses (shared/brochure.ts), so a
 * village that switched one off still has it off. Leaving Well has no switch:
 * "Leaving well is guaranteed" (shared/constitution.ts), so this page is always
 * served and Leaving Well is always one of its chapters.
 *
 * QA round 1 (27 Nov 2026): a config that never loads shows the try-again card
 * where the story chapters go, never Leaving Well in their place; a pick drops
 * `?focus=`, so arriving from the delete screen no longer pins the page; an
 * address naming a chapter this village does not publish is rewritten to the
 * chapter shown, with one quiet line; the title is focused once its words have
 * arrived; the tab names the chapter; and a phone keeps the chapter's name and
 * "All agreements" in a slim bar under the site header.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ArrowRight, ArrowUp, ChevronRight, DoorOpen, RotateCcw } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { BreathingLoader } from "@/components/natural";
import { Vesica } from "@/components/sacred/glyphs";
import { SeedPodHome, TendingHands } from "@/components/sacred/living";
import { retryGameConfig, useConfigFailed, useGameConfig } from "@/lib/gameApi";
import { storyPageShown } from "@/lib/brochure";
import { focusTargetId } from "@/lib/useFocusTarget";
import { useGoodNeighborName } from "@/hooks/useGoodNeighborName";
import { BTN_SECONDARY, CARD, CHIP_SOFT, DOOR, EYEBROW, H1, HINT, LEDE, QUIET, RING, WORLD } from "@/components/journey/look";
import { chapterHeadingId } from "@/components/rights/chapterParts";
import GoodNeighborChapter from "@/components/rights/GoodNeighborChapter";
import ResidentRightsChapter from "@/components/rights/ResidentRightsChapter";
import StewardRightsChapter from "@/components/rights/StewardRightsChapter";
import LeavingWellChapter from "@/components/rights/LeavingWellChapter";

/** The chapters, most read first: the criteria every applicant reads, then the two rights, then leaving. */
export const RIGHTS_CHAPTERS = ["good-neighbor", "resident-rights", "steward-rights", "leaving-well"] as const;
export type RightsChapter = (typeof RIGHTS_CHAPTERS)[number];

/** Each story chapter's switch, under the address the village switched it by. Leaving Well has none. */
const STORY: Record<RightsChapter, string | null> = {
  "good-neighbor": "/good-neighbor",
  "resident-rights": "/resident-rights",
  "steward-rights": "/steward-rights",
  "leaving-well": null,
};

const BODY: Record<RightsChapter, ComponentType> = {
  "good-neighbor": GoodNeighborChapter,
  "resident-rights": ResidentRightsChapter,
  "steward-rights": StewardRightsChapter,
  "leaving-well": LeavingWellChapter,
};

const EMBLEM: Record<RightsChapter, ComponentType<{ className?: string }>> = {
  "good-neighbor": Vesica,
  "resident-rights": SeedPodHome,
  "steward-rights": TendingHands,
  "leaving-well": DoorOpen,
};

/** Ids that live inside a chapter and may be linked to directly, with the chapter that holds them. */
const INNER: Record<string, RightsChapter> = { "begin-departure": "leaving-well" };

/**
 * The chapters whose list name IS their heading: the Good Neighbor chapter's name is its own headline field, and
 * Leaving Well's is the string its heading prints. Each is named by its heading alone, so a screen reader never
 * says it twice. The two rights chapters may share a heading, so they are named by the list's name and the heading.
 */
const NAMED_BY_HEADING: ReadonlySet<RightsChapter> = new Set<RightsChapter>(["good-neighbor", "leaving-well"]);

const isChapter = (id: string): id is RightsChapter => (RIGHTS_CHAPTERS as readonly string[]).includes(id);

/** The chapter the address names, by its anchor or by a `?focus=` target inside one. Null when it names none. */
export function chapterInAddress(hash: string, search: string): RightsChapter | null {
  let id = hash.replace(/^#/, "");
  try {
    id = decodeURIComponent(id);
  } catch {
    // A malformed escape names nothing.
  }
  if (isChapter(id)) return id;
  if (INNER[id]) return INNER[id];
  const focus = focusTargetId(search);
  return focus && INNER[focus] ? INNER[focus] : null;
}

/** The query with `focus` taken out: it named a card on arrival, and must not pin every move after. */
export function searchWithoutFocus(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("focus");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

const readAddress = () => (typeof window === "undefined" ? { hash: "", search: "" } : { hash: window.location.hash, search: window.location.search });

/**
 * Run `then` once `find` returns an element, now or as soon as it is drawn: a
 * chapter's title is in the document before its words arrive, and invisible
 * until they do. Gives up quietly after a while, so a chapter whose words never
 * come costs nothing.
 */
function whenDrawn(find: () => HTMLElement | null, then: (el: HTMLElement) => void): () => void {
  const ready = () => {
    const el = find();
    return el && !el.classList.contains("invisible") ? el : null;
  };
  const now = ready();
  if (now) {
    then(now);
    return () => {};
  }
  const watch = new MutationObserver(() => {
    const el = ready();
    if (!el) return;
    stop();
    then(el);
  });
  const timer = window.setTimeout(() => stop(), 10_000);
  const stop = () => {
    watch.disconnect();
    window.clearTimeout(timer);
  };
  watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  return stop;
}

/** Where the story chapters go when the village's config would not load: the try-again card, in the page. */
function StoryChaptersUnavailable() {
  const [trying, setTrying] = useState(false);
  return (
    <div role="alert" className={`${CARD} space-y-3`}>
      <p className="font-display text-2xl text-card-foreground">
        <Trans>We couldn't reach the village just now</Trans>
      </p>
      <p className={HINT}>
        <Trans>Check your connection, then try again.</Trans>
      </p>
      <button
        type="button"
        disabled={trying}
        onClick={async () => {
          setTrying(true);
          await retryGameConfig();
          setTrying(false);
        }}
        className={BTN_SECONDARY}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        {trying ? (
          <Trans context="config card: asking the server again">Trying again...</Trans>
        ) : (
          <Trans context="config card: ask the server again">Try again</Trans>
        )}
      </button>
    </div>
  );
}

export default function RightsAndAgreements() {
  const { t } = useLingui();
  const config = useGameConfig();
  const configFailed = useConfigFailed();
  const goodNeighborName = useGoodNeighborName();
  // A story chapter waits for the config: switched-off chapters never flash. Leaving Well never waits for it.
  const ready = !!config || configFailed;
  // The config would not load: the story chapters cannot be known, and their place holds the try-again card.
  const storiesUnknown = !config && configFailed;
  const served = useMemo(
    () => RIGHTS_CHAPTERS.filter((id) => STORY[id] === null || (!!config && storyPageShown(config, STORY[id]!))),
    [config],
  );

  const [address, setAddress] = useState(readAddress);
  useEffect(() => {
    const follow = () => setAddress(readAddress());
    window.addEventListener("hashchange", follow);
    window.addEventListener("popstate", follow);
    // wouter's own events: a link to /rights#<chapter> from inside the page changes only the hash.
    window.addEventListener("pushState", follow);
    window.addEventListener("replaceState", follow);
    return () => {
      window.removeEventListener("hashchange", follow);
      window.removeEventListener("popstate", follow);
      window.removeEventListener("pushState", follow);
      window.removeEventListener("replaceState", follow);
    };
  }, []);
  const named = chapterInAddress(address.hash, address.search);
  const active: RightsChapter = named && served.includes(named) ? named : served[0];
  // The try-again card stands wherever a story chapter would: always, unless Leaving Well is the one asked for.
  const retryHere = storiesUnknown && named !== "leaving-well";

  // An address naming a chapter this village does not publish (switched off in Admin, Pages) is rewritten to
  // the chapter actually shown, and one quiet line says the part asked for is not published here.
  const [notPublished, setNotPublished] = useState(false);
  useEffect(() => {
    if (!config || !named || served.includes(named)) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${active}`);
    setAddress(readAddress());
    setNotPublished(true);
  }, [config, named, served, active]);

  // Bring the chapter to the reader when the address names one: on arrival, and on every pick after. Its
  // title takes focus once its words are drawn. A `?focus=` target is brought by its own chapter
  // (useFocusTarget) on arrival; a pick drops the parameter, so it never holds the page after that.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || retryHere || !named || !served.includes(named)) return;
    const key = `${address.hash}|${address.search}`;
    if (handled.current === key) return;
    handled.current = key;
    if (focusTargetId(address.search)) return;
    const innerId = address.hash.replace(/^#/, "");
    if (INNER[innerId]) return whenDrawn(() => document.getElementById(innerId), (el) => el.scrollIntoView({ block: "start" }));
    return whenDrawn(
      () => document.getElementById(chapterHeadingId(named)),
      (heading) => {
        document.getElementById(named)?.scrollIntoView({ block: "start" });
        heading.focus({ preventScroll: true });
      },
    );
  }, [ready, retryHere, named, served, address]);

  const pick = useCallback((id: RightsChapter) => {
    window.history.pushState(null, "", `${window.location.pathname}${searchWithoutFocus(window.location.search)}#${id}`);
    setNotPublished(false);
    setAddress(readAddress());
  }, []);
  const toList = useCallback(() => {
    document.getElementById("rights-chapters")?.scrollIntoView({ block: "start" });
  }, []);

  const pageName = t({ message: "Rights and agreements", context: "rights and agreements page: the title" });
  const title: Record<RightsChapter, string> = {
    "good-neighbor": goodNeighborName ?? "",
    "resident-rights": t({ message: "Resident rights", context: "rights and agreements page: a chapter's name" }),
    "steward-rights": t({ message: "Steward rights", context: "rights and agreements page: a chapter's name" }),
    // The chapter's own title, the same string its heading prints.
    "leaving-well": t({ message: "Leaving Well", context: "exit policy page title" }),
  };
  const line: Record<RightsChapter, string> = {
    "good-neighbor": t({ message: "Who the village welcomes, and what it asks of every neighbor", context: "rights and agreements page: what a chapter holds" }),
    "resident-rights": t({ message: "What you hold and what you carry as a resident", context: "rights and agreements page: what a chapter holds" }),
    "steward-rights": t({ message: "What you hold and what you carry as a steward", context: "rights and agreements page: what a chapter holds" }),
    "leaving-well": t({ message: "How departure works, and how to begin it", context: "rights and agreements page: what a chapter holds" }),
  };
  const forWhom: Record<RightsChapter, string> = {
    "good-neighbor": t({ message: "Anyone asking to join", context: "rights and agreements page: who a chapter is for" }),
    "resident-rights": t({ message: "Residents", context: "rights and agreements page: who a chapter is for" }),
    "steward-rights": t({ message: "Stewards", context: "rights and agreements page: who a chapter is for" }),
    "leaving-well": t({ message: "Anyone leaving", context: "rights and agreements page: who a chapter is for" }),
  };

  // The tab names the chapter: "Leaving Well · Rights and agreements · <village>". The shell's own title
  // (App.tsx, PageTitle) knows only the path, so this holds the tab while the page is open.
  const village = config?.project?.name?.trim() ?? "";
  const shown = retryHere ? "" : title[active];
  const tabTitle = [shown, pageName, village].filter(Boolean).join(" · ");
  useEffect(() => {
    if (!ready) return;
    const hold = () => {
      if (document.title !== tabTitle) document.title = tabTitle;
    };
    hold();
    const el = document.querySelector("title");
    if (!el) return;
    const watch = new MutationObserver(hold);
    watch.observe(el, { childList: true, characterData: true, subtree: true });
    return () => watch.disconnect();
  }, [ready, tabTitle]);

  const ActiveEmblem = EMBLEM[active];

  return (
    <Layout>
      <div className={WORLD}>
        <div className="container max-w-6xl pb-24 pt-8 sm:pt-12">
          {/* A div, not a <header>: calendar/print.css takes every header off paper, and this one belongs on it. */}
          <div className="max-w-3xl">
            {/* Where the reader stands: this village's own promises. */}
            <p className={EYEBROW}>
              {village ? `${village} · ` : ""}
              <Trans context="rights and agreements page: the small label over the title, after the village's name">What we promise each other</Trans>
            </p>
            <h1 className={`${H1} mt-2`}>
              <Trans context="rights and agreements page: the title">Rights and agreements</Trans>
            </h1>
            <p className={`${LEDE} mt-3`}>
              <Trans context="rights and agreements page: the line under the title">
                What the village promises you, what it asks of you, and how leaving works. Choose one to read.
              </Trans>
            </p>
          </div>

          {!ready ? (
            <div className="mt-10 flex justify-center" aria-busy="true">
              <BreathingLoader />
            </div>
          ) : (
            <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10 print:block">
              {/* The list of chapters: the page's table of contents, and on a wide screen it stays beside the chapter. */}
              <nav
                id="rights-chapters"
                aria-label={t({ message: "Agreements on this page", context: "rights and agreements page: the list of chapters" })}
                className="scroll-mt-28 print:hidden lg:sticky lg:top-24 lg:self-start"
              >
                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {served.map((id) => {
                    const Emblem = EMBLEM[id];
                    const here = id === active && !retryHere;
                    return (
                      <li key={id}>
                        <a
                          href={`#${id}`}
                          aria-current={here ? "true" : undefined}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                            e.preventDefault();
                            pick(id);
                          }}
                          className={`jw-btn group flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            here ? "border-2 border-notice" : "border-border hover:border-notice/60"
                          }`}
                        >
                          {/* The chapter you are reading wears a filled gold ring, the one the profile gives what is held. */}
                          <span className={`${RING} ${here ? "bg-notice/15" : ""}`} aria-hidden="true">
                            <Emblem className="size-5" />
                          </span>
                          {/* On a phone and in the side list: the name and who it is for, so all four fit the first
                              screen and Leaving Well is never below it. The two-column list has room for the line. */}
                          <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                            <span className={`block font-display text-lg leading-tight text-foreground break-words${title[id] ? "" : " invisible"}`}>
                              {title[id] || " "}
                            </span>
                            <span className="hidden text-sm leading-snug text-muted-foreground sm:block lg:hidden">{line[id]}</span>
                            <span className={CHIP_SOFT}>{forWhom[id]}</span>
                          </span>
                          <ChevronRight className={`size-5 shrink-0 ${here ? "text-notice" : "text-muted-foreground group-hover:text-notice"}`} aria-hidden="true" />
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div className="mt-6 min-w-0 lg:mt-0">
                {/* On a phone the chapter's name and the way back to the list stay in reach under the site header
                    (the ProfileTabs pattern: sticky under the header, never over the tab bar). */}
                {!retryHere && (
                  <div
                    data-testid="rights-chapter-bar"
                    className="sticky top-24 z-30 mb-4 flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card/95 py-1 pl-2 pr-1 shadow-sm backdrop-blur print:hidden lg:hidden"
                  >
                    <span className={`${RING} size-8 border`} aria-hidden="true">
                      <ActiveEmblem className="size-4" />
                    </span>
                    {/* The name wraps: a long one ("Good Neighbor Criteria") is read whole at 375px, never cut short. */}
                    <span className="min-w-0 flex-1 break-words font-display text-base leading-tight text-foreground" aria-hidden="true">
                      {title[active] || " "}
                    </span>
                    <button type="button" onClick={toList} className="jw-btn inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-notice hover:bg-muted">
                      <Trans context="rights and agreements page: back to the list of chapters">All agreements</Trans>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {notPublished && !retryHere && (
                  <p role="status" className={`${QUIET} ${HINT} mb-4`}>
                    <Trans context="rights and agreements page: a link named a chapter this village switched off">
                      The part you asked for is not published here. Here is what is.
                    </Trans>
                  </p>
                )}

                {retryHere && <StoryChaptersUnavailable />}

                {served.map((id, i) => {
                  const Body = BODY[id];
                  const next = served[(i + 1) % served.length];
                  return (
                    <section
                      key={id}
                      id={id}
                      data-chapter={id}
                      // The list's name for the chapter, then its own title, where two chapters may share a heading.
                      aria-labelledby={NAMED_BY_HEADING.has(id) ? chapterHeadingId(id) : `${id}-name ${chapterHeadingId(id)}`}
                      className={`scroll-mt-40 lg:scroll-mt-28 ${id === active && !retryHere ? "" : "hidden print:mt-12 print:block"}`}
                    >
                      {!NAMED_BY_HEADING.has(id) && (
                        <span id={`${id}-name`} className="sr-only">
                          {title[id]}
                        </span>
                      )}
                      <Body />
                      {served.length > 1 && (
                        <nav
                          aria-label={t({ message: "More agreements", context: "rights and agreements page: the doors at a chapter's end" })}
                          className="mt-6 flex flex-col gap-3 print:hidden sm:flex-row"
                        >
                          <a
                            href={`#${next}`}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                              e.preventDefault();
                              pick(next);
                            }}
                            className={`${DOOR} flex-1`}
                          >
                            <span className="min-w-0 break-words">
                              <span className="block text-xs font-semibold uppercase tracking-widest text-notice">
                                <Trans context="rights and agreements page: the door to the next chapter">Next</Trans>
                              </span>
                              {title[next] || " "}
                            </span>
                            <ArrowRight className="size-4 shrink-0 text-notice" aria-hidden="true" />
                          </a>
                          <button type="button" onClick={toList} className={`${DOOR} sm:flex-none lg:hidden`}>
                            <Trans context="rights and agreements page: back to the list of chapters">All agreements</Trans>
                            <ArrowUp className="size-4 shrink-0 text-notice" aria-hidden="true" />
                          </button>
                        </nav>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
