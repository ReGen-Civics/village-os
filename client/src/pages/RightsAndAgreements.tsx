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
 * document, so printing the page prints all four.
 *
 * WHAT EACH CHAPTER FOLLOWS. The three story chapters keep their own Admin,
 * Pages switches, keyed by their old addresses (shared/brochure.ts), so a
 * village that switched one off still has it off. Leaving Well has no switch:
 * "Leaving well is guaranteed" (shared/constitution.ts), so this page is always
 * served and Leaving Well is always one of its chapters.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ArrowRight, ArrowUp, ChevronRight, DoorOpen } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { BreathingLoader } from "@/components/natural";
import { Vesica } from "@/components/sacred/glyphs";
import { SeedPodHome, TendingHands } from "@/components/sacred/living";
import { useConfigFailed, useGameConfig } from "@/lib/gameApi";
import { storyPageShown } from "@/lib/brochure";
import { focusTargetId } from "@/lib/useFocusTarget";
import { useGoodNeighborName } from "@/hooks/useGoodNeighborName";
import { CHIP_SOFT, DOOR, EYEBROW, H1, LEDE, RING, WORLD } from "@/components/journey/look";
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

const readAddress = () => (typeof window === "undefined" ? { hash: "", search: "" } : { hash: window.location.hash, search: window.location.search });

export default function RightsAndAgreements() {
  const { t } = useLingui();
  const config = useGameConfig();
  const configFailed = useConfigFailed();
  const goodNeighborName = useGoodNeighborName();
  // A story chapter waits for the config: switched-off chapters never flash. Leaving Well never waits for it.
  const ready = !!config || configFailed;
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

  // Bring the chapter to the reader when the address names one: on arrival, and on every pick after.
  // A `?focus=` target is brought by its own chapter (useFocusTarget), so the page leaves that one alone.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !named || !served.includes(named)) return;
    const key = `${address.hash}|${address.search}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    if (focusTargetId(address.search)) return;
    const inner = INNER[address.hash.replace(/^#/, "")] ? document.getElementById(address.hash.replace(/^#/, "")) : null;
    const target = inner ?? document.getElementById(named);
    target?.scrollIntoView({ block: "start" });
    if (!inner) document.getElementById(chapterHeadingId(named))?.focus({ preventScroll: true });
  }, [ready, named, served, address]);

  const pick = useCallback((id: RightsChapter) => {
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
    setAddress(readAddress());
  }, []);
  const toList = useCallback(() => {
    document.getElementById("rights-chapters")?.scrollIntoView({ block: "start" });
  }, []);

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

  return (
    <Layout>
      <div className={WORLD}>
        <div className="container max-w-6xl pb-24 pt-8 sm:pt-12">
          <header className="max-w-3xl">
            <p className={EYEBROW}>
              <Trans context="rights and agreements page: the small label over the title">Agreements</Trans>
            </p>
            <h1 className={`${H1} mt-2`}>
              <Trans context="rights and agreements page: the title">Rights and agreements</Trans>
            </h1>
            <p className={`${LEDE} mt-3`}>
              <Trans context="rights and agreements page: the line under the title">
                What the village promises you, what it asks of you, and how leaving works. Choose one to read.
              </Trans>
            </p>
          </header>

          {!ready ? (
            <div className="mt-10 flex justify-center" aria-busy="true">
              <BreathingLoader />
            </div>
          ) : (
            <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
              {/* The list of chapters: the page's table of contents, and on a wide screen it stays beside the chapter. */}
              <nav
                id="rights-chapters"
                aria-label={t({ message: "Agreements on this page", context: "rights and agreements page: the list of chapters" })}
                className="scroll-mt-32 print:hidden lg:sticky lg:top-24 lg:self-start"
              >
                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {served.map((id) => {
                    const Emblem = EMBLEM[id];
                    const here = id === active;
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
                              screen and Leaving well is never below it. The two-column list has room for the line. */}
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

              <div className="mt-8 min-w-0 lg:mt-0">
                {served.map((id, i) => {
                  const Body = BODY[id];
                  const next = served[(i + 1) % served.length];
                  return (
                    <section
                      key={id}
                      id={id}
                      data-chapter={id}
                      aria-labelledby={chapterHeadingId(id)}
                      className={`scroll-mt-32 ${id === active ? "" : "hidden print:mt-12 print:block"}`}
                    >
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
