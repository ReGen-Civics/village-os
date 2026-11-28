import Layout from "@/components/Layout";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import VillageAgreements from "@/components/governance/VillageAgreements";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import VillageConflictSteps from "@/components/governance/VillageConflictSteps";
import { useModuleOn } from "@/modules/ModuleProvider";
import VoiceSpreadBand from "@/components/governance/VoiceSpreadBand";
import { Eye, MessageSquare, CheckCircle2, Network, ArrowRight, ArrowDown, Lock, Scale, Printer } from "lucide-react";
import { GoldenSpiral, Labyrinth, Lotus, SeedOfLife, Triad } from "@/components/sacred/glyphs";
import { GROUP_BREAK, GROUP_H2 } from "@/components/roleCard/groupLook";
import { Canopy, CouncilCircle, Gathering, MushroomNetwork, Seed, Sprout, TendingHands } from "@/components/sacred/living";
import { useStoryPageShown } from "@/lib/brochure";
import { useHypha } from "@/modules/ModuleProvider";
import { HyphaAdminNote } from "@/components/HyphaAdminNote";
import { usePageContent, usePageLang } from "@/hooks/usePageContent";
import { useVetoHours } from "@/hooks/useVetoHours";
import { Emphasized } from "@/components/PageText";
import { fillVars } from "@shared/pageContent/resolve";
import { GOVERNANCE_PAGE, VETO_HOURS_MIN, vetoWindowWords } from "@shared/pageContent/governance";
import { CANVAS_CREDIT } from "@shared/governanceCanvasText";
import { CANVAS_PUBLIC_MATRIX_PATH } from "@shared/canvasPublicLines";
import { useAuth } from "@/contexts/AuthContext";
import { useNewcomer } from "@/lib/newcomer";
import { readOnDay, useHowWeWorkRead } from "@/lib/howWeWorkRead";
import BreathingLoader from "@/components/natural/BreathingLoader";
import { HOW_WE_WORK_ANCHOR } from "@shared/howWeWorkRead";
import GovernanceTabs from "@/components/governance/now/GovernanceTabs";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CARD_FEATURED, DOOR, EYEBROW, H1, H2, HINT, LEDE, LINK, NOTE, QUIET, RING, TICK, TILE, WORLD } from "@/components/journey/look";

// Each behind its module, so a village with both off downloads none of them.
const ConflictAgreementPublic = lazy(() => import("@/components/canvas/ConflictAgreementPublic"));
const CanvasPublicLines = lazy(() => import("@/components/canvas/CanvasPublicLines"));
const DecisionMatrix = lazy(() => import("@/components/canvas/DecisionMatrix"));
// The members' half: never downloaded for a signed-out visitor.
const GameMechanics = lazy(() => import("./GameMechanics"));

/** The icons the cards and steps take in turn, whatever the village wrote. */
const PRINCIPLE_ICONS = [CheckCircle2, MushroomNetwork, Eye];
const STEP_ICONS = [Seed, MessageSquare, MushroomNetwork, CheckCircle2, Eye];

/** Paragraphs a village left blank are not drawn. */
const paragraphs = (...texts: string[]) => texts.filter((t) => t.trim() !== "");

/** Whether the address asks for the game mechanics: their anchors, a proposal, a dial, a notification's focus. */
function asksForMechanics(): boolean {
  const hash = window.location.hash.slice(1);
  const query = new URLSearchParams(window.location.search);
  return hash === GAME_MECHANICS_ANCHOR || hash.startsWith("mechanics-") || hash.startsWith("proposal-") || query.has("dial") || (query.get("focus") ?? "").startsWith("proposal-");
}

/** The first chapter and every section in it: a link to any of them opens the chapter again once it is folded. */
const CHAPTER_IDS: ReadonlySet<string> = new Set([
  "how-we-work", "voice", "agreements", "canvas", "who-decides", "principles", "decisions", "circles", "conflict", "conflict-agreement", "conflict-agreement-slot", "stewards", "rules", "canvas-on-paper", "hypha", "join-in",
]);

/** Two headings that say the same thing, whatever their case and spacing. */
const sameWords = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/** The anchor every door to the mechanics lands on (the old /game-mechanics redirects here). */
export const GAME_MECHANICS_ANCHOR = "game-mechanics";

/**
 * A section of the page: a panel with its own anchor, clear of the sticky header. It opens the way every
 * section in the sheet's world opens: a glyph in a gold ring, a kicker that places the reader, then the
 * village's own heading in the display face.
 */
function Panel({ id, icon, eyebrow, heading, children, className = CARD }: { id: string; icon: ReactNode; eyebrow: ReactNode; heading: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={`${className} scroll-mt-24 min-w-0`}>
      <div className="mb-4 flex items-center gap-3">
        <span className={RING} aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className={EYEBROW}>{eyebrow}</p>
          <h2 id={`${id}-heading`} className={`${H2} break-words`}>
            {heading}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * HOW WE WORK TOGETHER, at /governance/how, with the GAME MECHANICS under it
 * (the fold of 26 Nov 2026; the lead: "YES first the part of how we work
 * together, then 'we're totally transparent about how the game operates and you
 * can find it all below, all in collapsible menus so people can skip over the
 * "how we work together" once they've read it and go right to the game
 * mechanics part'").
 *
 * THE ORDER IS THE LEAD'S: the village's own account of how it works, block by
 * block, then one line on openness, then the mechanics, every one folded shut
 * (`./GameMechanics`). A jump at the top skips straight to them, and each fold
 * opens from its own anchor. The mechanics are for members: a signed-out
 * visitor reads how the village works and never downloads the rest ("Signed out
 * visitor doesn't need to see game mechanics").
 *
 * The page draws in the sheet's world (docs/DESIGN_RULE.md) beside its sibling
 * views under the Governance tabs. The hero's eyebrow, headline and intro and
 * every section's words are the village's own (Admin, Pages,
 * shared/pageContent/governance.ts); the canvas sections are drawn whatever the
 * village wrote there.
 *
 * WHAT A VISITOR SEES, AND WHAT A MEMBER SEES BESIDE IT (plan 4.6):
 *
 *   - each block's public line under the canvas's question (CanvasPublicLines);
 *   - who decides what: the Decision Matrix rows the platform generates, read
 *     only, from the public door that serves nothing a village wrote;
 *   - the conflict section: the adopted conflict agreement's public view
 *     (ConflictAgreementPublic), roles only.
 *
 * A signed-in member also opens the village's words each block keeps for its
 * members, and the game mechanics. The canvas's readings and its radar are
 * never on this page, for anybody.
 *
 * EACH ADDITION FOLLOWS ITS MODULE (Rye's module ruling, 2026-10-01): the
 * canvas sections render only while the Governance Canvas is on for this
 * reader, the conflict agreement only while Conflict Evolution is on, and the
 * exit policy's restorative steps (VillageConflictSteps, core) otherwise.
 *
 * The live votes are no longer drawn here: the Now and Decisions views sit one
 * tab away, and this page is the one that says how.
 */
export default function Governance() {
  const { t, i18n } = useLingui();
  // Each story page has its own switch now; a door goes with its page.
  const storyShown = useStoryPageShown();
  // A Hypha section needs a Hypha space to describe: the village's switch AND its DHO link.
  const hypha = useHypha();
  // Every word on this page is the village's own. Null until the saved words
  // have arrived, so the defaults never flash first.
  const langOf = usePageLang(GOVERNANCE_PAGE);
  const page = usePageContent(GOVERNANCE_PAGE);
  // The steward's window is the village's setting, never a typed "three days".
  const vetoHours = useVetoHours();
  // The two canvas modules (Rye, 2026-10-01): each section below is behind its own.
  const canvasOn = useModuleOn("canvas");
  const conflictOn = useModuleOn("conflict-evolution");
  const { user } = useAuth();
  // The mechanics are for members (the lead: "Signed out visitor doesn't need to see game mechanics"),
  // read the way the menu and the server read admission (lib/newcomer.ts).
  const member = !useNewcomer();

  /*
   * "I'VE READ THIS" (the lead, 27 Nov 2026). A member who ticked the box at the end of the first chapter sees it
   * folded to one line, with the day they read it and "Read it again"; the mechanics move up under it. The read is
   * theirs, kept server side (shared/howWeWorkRead.ts), so it holds on every device. A link into the chapter (the
   * profile's "Read it again", or any of its sections) opens it again; ticking folds it, unticking clears the read.
   */
  const reading = useHowWeWorkRead(member);
  const [reopened, setReopened] = useState(() => typeof window !== "undefined" && CHAPTER_IDS.has(window.location.hash.slice(1)));
  const chapterRef = useRef<HTMLDivElement | null>(null);
  const foldRef = useRef<HTMLElement | null>(null);
  // The box shows the press at once while it saves; a failed save rolls it back to what the server holds.
  const [pressed, setPressed] = useState<boolean | null>(null);
  const folded = member && !!reading.readAt && !reopened;
  // A member whose read is not known yet: hold the chapter's place, so it never draws and then collapses (QA round 1:
  // a layout shift of 0.48). A failed read counts as known and unread (lib/howWeWorkRead.ts), so the chapter opens.
  // A link straight into the chapter (#conflict, the profile's #how-we-work) opens it at once, read or not, so it
  // never waits here and the arrival scroll has a section to land on (QA round 2).
  const readPending = member && reading.readAt === undefined && !reopened;
  useEffect(() => {
    const opened = () => {
      const id = window.location.hash.slice(1);
      if (window.location.pathname !== "/governance/how" || !CHAPTER_IDS.has(id)) return;
      setReopened(true);
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView?.({ block: "start" }), 0);
    };
    window.addEventListener("hashchange", opened);
    window.addEventListener("pushState", opened);
    return () => {
      window.removeEventListener("hashchange", opened);
      window.removeEventListener("pushState", opened);
    };
  }, []);
  const tick = async (read: boolean) => {
    // A press while the last one is saving is ignored, never disabled: a disabled box drops the keyboard's focus.
    if (reading.saving) return;
    setPressed(read);
    const saved = await reading.save(read);
    setPressed(null);
    if (!saved || !read) return;
    // Folded: focus moves to the line that says so (a screen reader hears it), with the mechanics right under it.
    // Unticking leaves the chapter open and the focus on the box.
    setReopened(false);
    window.setTimeout(() => foldRef.current?.focus(), 0);
  };
  const readAgain = () => {
    setReopened(true);
    // Into the chapter at its first heading, a named place to start reading from.
    window.setTimeout(() => {
      const heading = chapterRef.current?.querySelector<HTMLElement>("h2, h3");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: false });
      } else chapterRef.current?.focus();
    }, 0);
  };

  /*
   * ARRIVING AT AN ANCHOR. The page is drawn after its words arrive, so the
   * browser's own jump to `#conflict` or `#game-mechanics` found nothing to land
   * on. Once the words are in, go there. The mechanics' own folds do the same
   * for theirs once their rules land.
   */
  useEffect(() => {
    if (!page) return;
    // The frame and the timer are cancelled as the page goes: a late one ran after the page was gone (and, in a
    // test, after the window was), which failed a whole test shard at random.
    let frame = 0;
    let timer = 0;
    const go = () => {
      if (window.location.pathname !== "/governance/how") return;
      // A newcomer whose link asked for the mechanics by query alone (?dial=, ?focus=) lands on the locked row
      // too, as the #game-mechanics arrival does, so the row and the way in under it are on the first screen.
      const id = window.location.hash.slice(1) || (!member && asksForMechanics() ? GAME_MECHANICS_ANCHOR : "");
      if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView?.({ block: "start" });
        // The app's ScrollToTop answers a hash 100ms after a new page mounts, and sends a page whose anchor it
        // could not find yet back to the very top. Land again if that is what happened in between.
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (window.scrollY === 0 && el.isConnected && el.getBoundingClientRect().top > window.innerHeight / 2) el.scrollIntoView?.({ block: "start" });
        }, 160);
      });
    };
    // Once when the words land, again when the reader turns out to be a member (the rows above the chapter change)
    // and when a member's held place gives way to the chapter or its folded line
    // (everything under it moved), and for a router link to this page's own anchor (the footer's "Game Mechanics"
    // is one), which wouter sends by pushState and so fires no hashchange.
    go();
    window.addEventListener("pushState", go);
    return () => {
      window.removeEventListener("pushState", go);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!page, readPending, member]);

  if (!page) {
    return (
      <Layout>
        <div className={WORLD}>
          <section className="min-h-[70vh]" aria-busy="true" />
        </div>
      </Layout>
    );
  }
  const { hero, spread, principles, decision, circles, conflict, stewards, rules, cta } = page;
  const hyphaSection = page.hypha;
  const showHypha = !hyphaSection.hidden && hypha.configured;
  const veto = vetoHours === null ? `at least ${vetoWindowWords(VETO_HOURS_MIN)}` : vetoWindowWords(vetoHours);
  const conflictParagraphs = paragraphs(conflict.fields.first, conflict.fields.second, conflict.fields.third);
  const stewardParagraphs = paragraphs(stewards.fields.first, stewards.fields.second, stewards.fields.third, stewards.fields.fourth).map(
    (text) => fillVars(text, { veto }),
  );
  const showStewards = !stewards.hidden && vetoHours !== undefined;
  const showCta = (storyShown("/steward") || storyShown("/love-letter")) && !cta.hidden;

  /*
   * The contents, in page order, naming only what is drawn. On a desktop it
   * stays beside the page; on a phone the one jump that matters is the card at
   * the top.
   */
  const contents: Array<{ id: string; label: ReactNode }> = [
    ...(canvasOn ? [{ id: "canvas", label: t({ message: "Our canvas", context: "how we work together: contents" }) }] : []),
    ...(canvasOn ? [{ id: "who-decides", label: t({ message: "Who decides what", context: "how we work together: contents" }) }] : []),
    ...(!principles.hidden ? [{ id: "principles", label: principles.fields.heading }] : []),
    ...(!decision.hidden ? [{ id: "decisions", label: decision.fields.heading }] : []),
    ...(!circles.hidden ? [{ id: "circles", label: circles.fields.heading }] : []),
    ...(!conflict.hidden ? [{ id: "conflict", label: conflict.fields.heading }] : []),
    ...(showStewards ? [{ id: "stewards", label: stewards.fields.heading }] : []),
    ...(!rules.hidden ? [{ id: "rules", label: rules.fields.heading }] : []),
  ];
  const mechanicsContents: Array<{ id: string; label: string; icon: ReactNode }> = [
    { id: "mechanics-constitution", label: t({ message: "The Constitution", context: "how we work together: contents" }), icon: <SeedOfLife className="size-4" /> },
    { id: "mechanics-dials", label: t({ message: "The Dials", context: "how we work together: contents" }), icon: <GoldenSpiral className="size-4" /> },
    { id: "mechanics-proposals", label: t({ message: "Proposals", context: "how we work together: contents" }), icon: <Triad className="size-4" /> },
    { id: "mechanics-history", label: t({ message: "Amendment History", context: "how we work together: contents" }), icon: <Labyrinth className="size-4" /> },
  ];
  const chapterName = t({ message: "How we work together", context: "how we work together: chapter" });
  const contentsLink = "flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  /*
   * A door pressed again on the anchor already in the address changes nothing
   * the browser reports, so a fold the reader shut since would stay shut. The
   * page says it again; the fold opens and comes into view.
   */
  const again = (id: string) => () => {
    if (window.location.hash === `#${id}`) window.setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 0);
  };
  /*
   * Somebody who is not a member, arriving on a link that asked for the
   * mechanics (the old address, a notification, a dial): one quiet locked row
   * that says so and what opens it, and nothing of the mechanics themselves.
   */
  const askedForMechanics = asksForMechanics();
  /* A newcomer's one act on the first screen: the village's own way in, as the closing invitation names it. */
  const joinAct = storyShown("/steward") && !cta.hidden
    ? { href: "/steward", label: <>{cta.fields.stewardLabel}</> }
    : storyShown("/love-letter") && !cta.hidden
      ? { href: "/love-letter", label: <>{cta.fields.commitmentLabel}</> }
      : { href: "/request-membership", label: <Trans context="governance now: newcomer">How to become a member</Trans> };

  return (
    <Layout>
      <div className={WORLD}>
        <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12 xl:max-w-[1200px]">
          {/* Where you are, the way /roles opens: the council circle in a gold ring, the kicker, the display heading. */}
          <header className="space-y-3">
            <span className={`${RING} mb-2 size-14`} aria-hidden="true">
              <CouncilCircle className="size-7" />
            </span>
            <p className={`${EYEBROW} break-words`}>{hero.fields.eyebrow}</p>
            <h1 className={`${H1} break-words`}>{hero.fields.headline}</h1>
            <p className={`${LEDE} break-words`}>
              <Emphasized text={hero.fields.intro} />
            </p>
          </header>
          <div className="mt-6">
            <GovernanceTabs signedIn={!!user} />
          </div>

          {/* THE JUMP, for a member who has read the first part before. On a
              phone it is the first thing under the tabs; on a desktop the
              contents beside the page carry it too. */}
          {member ? (
            // Once the chapter is folded the mechanics sit right under it, so the jump has nothing left to skip.
            folded || readPending ? null : (
            <div className={`${QUIET} mt-6 flex flex-wrap items-center justify-between gap-3 bg-card`} data-testid="mechanics-jump">
              <p className={`${NOTE} min-w-0`}>
                <Trans context="how we work together: the jump">Read how we work together before?</Trans>
              </p>
              <a href={`#${GAME_MECHANICS_ANCHOR}`} onClick={again(GAME_MECHANICS_ANCHOR)} className={BTN_PRIMARY}>
                <Trans context="how we work together: the jump">Skip to the game mechanics</Trans>
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
            )
          ) : (
            <div className="mt-6 space-y-3">
              {askedForMechanics && (
                <div id={GAME_MECHANICS_ANCHOR} className={`${QUIET} flex scroll-mt-24 flex-wrap items-center justify-between gap-3`} data-testid="mechanics-locked">
                  <p className={`${NOTE} flex min-w-0 items-center gap-2`}>
                    <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {user ? (
                      <span>
                        <Trans context="how we work together: mechanics locked">The game mechanics are for members. They open when the village admits you.</Trans>
                      </span>
                    ) : (
                      <span>
                        <Trans context="how we work together: mechanics locked">The game mechanics are for members.</Trans>
                      </span>
                    )}
                  </p>
                  {!user && (
                    <Link href={`/login?next=${encodeURIComponent(`/governance/how#${GAME_MECHANICS_ANCHOR}`)}`} className={BTN_SECONDARY}>
                      <Trans context="how we work together: mechanics locked">Sign in</Trans>
                    </Link>
                  )}
                </div>
              )}
              {/* A newcomer's one act on the first screen, where a member's jump sits. */}
              <div className={`${QUIET} flex flex-wrap items-center justify-between gap-3 bg-card`} data-testid="join-act">
                <p className={`${NOTE} min-w-0`}>
                  <Trans context="how we work together: newcomer act">Take part in how the village decides.</Trans>
                </p>
                <Link href={joinAct.href} className={BTN_PRIMARY}>
                  {joinAct.label} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}

          <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-8">
            <div className="min-w-0 space-y-6">
              {readPending ? (
                // The chapter's place, held while the member's read is asked for.
                // Short when this device last saw the chapter read (a yes or no only, never when), tall otherwise.
                <div
                  id={HOW_WE_WORK_ANCHOR}
                  aria-busy="true"
                  className={`${reading.seenRead ? "min-h-16" : "min-h-[60vh]"} flex scroll-mt-24 items-start justify-center pt-4`}
                  data-testid="how-we-work-waiting"
                >
                  <BreathingLoader size={32} label={chapterName} />
                </div>
              ) : folded && reading.readAt ? (
                <section ref={foldRef} id={HOW_WE_WORK_ANCHOR} tabIndex={-1} aria-labelledby="how-we-work-read-line" className={`${QUIET} flex scroll-mt-24 flex-wrap items-center justify-between gap-3 bg-card focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`} data-testid="how-we-work-read">
                  <p className={`${NOTE} flex min-w-0 items-center gap-2`}>
                    <CheckCircle2 className="size-5 shrink-0 text-open" aria-hidden="true" />
                    <span id="how-we-work-read-line">
                      <Trans context="how we work together: read">How we work together, read on {readOnDay(reading.readAt, i18n.locale)}</Trans>
                    </span>
                  </p>
                  <button type="button" onClick={readAgain} className={BTN_SECONDARY}>
                    <Trans context="how we work together: read">Read it again</Trans>
                  </button>
                </section>
              ) : (
              <div id="how-we-work" ref={chapterRef} tabIndex={-1} className="scroll-mt-24 space-y-6 focus:outline-none">
                {/* The first of the page's two chapters (groupLook.ts, as /roles splits its chapters). Left out
                    while it would only repeat the headline (the default headline is these same words). */}
                {!sameWords(hero.fields.headline, chapterName) && <h2 className={GROUP_H2}>{chapterName}</h2>}
                {/* Who holds the Voice: the spread across everyone who votes, in
                    groups, and this season's votes as counts. Draws nothing while
                    governance is off, or for a stranger while the village keeps its people. */}
                {!spread.hidden && <VoiceSpreadBand heading={spread.fields.heading} intro={spread.fields.intro} />}

                {/* The agreements the village adopted, for members (W4-agreements-no-page).
                    Renders nothing to a visitor or while governance is off. */}
                <VillageAgreements />

                {/* The canvas, one public line per block. Visitors read the lines; a
                    signed-in member also opens the words kept for members. */}
                {canvasOn && (
                  <section id="canvas" className={`${CARD} scroll-mt-24 min-w-0`}>
                    <Suspense fallback={null}>
                      <CanvasPublicLines />
                    </Suspense>
                  </section>
                )}

                {/* Who decides what: the half of the canvas's Decision Matrix the
                    platform writes from the rules it enforces. Read only, and from
                    the PUBLIC door, which can serve nothing a village wrote. */}
                {canvasOn && (
                  <Panel id="who-decides" icon={<Scale className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">Decision rights</Trans>} heading={<Trans context="governance page section heading">Who Decides What</Trans>}>
                    <p className={NOTE}>
                      <Trans context="governance page: who decides what">For each kind of decision:</Trans>
                    </p>
                    <ul className={`${NOTE} mb-2 list-disc space-y-1 pl-5`}>
                      <li><Trans context="governance page: who decides what">who approves it</Trans></li>
                      <li><Trans context="governance page: who decides what">who is asked first</Trans></li>
                      <li><Trans context="governance page: who decides what">who is told</Trans></li>
                      <li><Trans context="governance page: who decides what">how it is made</Trans></li>
                    </ul>
                    <p className={HINT}>
                      <Trans context="governance page: who decides what">The answers come from the village's rules today, and change when the village changes them.</Trans>
                    </p>
                    <Suspense fallback={null}>
                      <DecisionMatrix src={CANVAS_PUBLIC_MATRIX_PATH} />
                    </Suspense>
                  </Panel>
                )}

                {/* What guides us */}
                {!principles.hidden && (
                  <Panel id="principles" icon={<Lotus className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">What we hold to</Trans>} heading={principles.fields.heading}>
                    {principles.lists.items.length > 0 && (
                      <ul className="grid list-none gap-3 p-0 sm:grid-cols-3">
                        {principles.lists.items.map((p, i) => {
                          const Icon = PRINCIPLE_ICONS[i % PRINCIPLE_ICONS.length];
                          return (
                            <li key={`${i}-${p.title}`} className={`${TILE} min-w-0`}>
                              <Icon className="mb-3 size-6 text-notice" aria-hidden="true" />
                              <h3 className="mb-1.5 font-display text-lg text-foreground break-words">{p.title}</h3>
                              <p className="text-sm leading-relaxed text-muted-foreground break-words">{p.body}</p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Panel>
                )}

                {/* How a decision gets made, as stepping stones */}
                {!decision.hidden && (
                  <Panel id="decisions" icon={<Seed className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">The path of a decision</Trans>} heading={decision.fields.heading}>
                    {decision.fields.intro && <p className={`${NOTE} mb-4 break-words`}>{decision.fields.intro}</p>}
                    {decision.lists.steps.length > 0 && (
                      <ol className="list-none space-y-3 p-0">
                        {decision.lists.steps.map((s, i) => {
                          const Icon = STEP_ICONS[i % STEP_ICONS.length];
                          return (
                            <li key={`${i}-${s.text}`} className={`${TILE} flex items-center gap-4`}>
                              <span className={`${RING} font-display text-lg`}>{i + 1}</span>
                              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <p className="min-w-0 flex-1 leading-relaxed text-foreground break-words">{s.text}</p>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </Panel>
                )}

                {/* Circles and their domains. The circles page draws the real ones. */}
                {!circles.hidden && (
                  <Panel id="circles" icon={<Gathering className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">Who looks after what</Trans>} heading={circles.fields.heading}>
                    {circles.fields.intro && (
                      <p className={`${NOTE} mb-4 break-words`}>
                        <Emphasized text={circles.fields.intro} />
                      </p>
                    )}
                    {circles.lists.items.length > 0 && (
                      <ul className="mb-4 grid list-none gap-3 p-0 sm:grid-cols-2">
                        {circles.lists.items.map((c, i) => (
                          <li key={`${i}-${c.name}`} className={`${TILE} min-w-0`}>
                            <h3 className="mb-1.5 font-display text-lg text-foreground break-words">{c.name}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground break-words">{c.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link href="/circles" className={DOOR}>
                      <span className="min-w-0 break-words">{circles.fields.linkLabel}</span>
                      <ArrowRight className="size-4 shrink-0 text-notice" aria-hidden="true" />
                    </Link>
                  </Panel>
                )}

                {/* Conflict: the village's own words on how tension is worked through
                    (Admin, Pages), then its conflict agreement, public with roles only,
                    and before there is one the restorative steps of its published exit
                    policy. The reasoning is in VillageConflictSteps and ConflictAgreementPublic. */}
                {!conflict.hidden && (
                  <Panel id="conflict" icon={<TendingHands className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">When it gets hard</Trans>} heading={conflict.fields.heading}>
                    {conflictParagraphs.length > 0 && (
                      // One tile per paragraph, the village's words as written: a list a phone reads one at a time.
                      <ul className="mb-5 list-none space-y-3 p-0">
                        {conflictParagraphs.map((text, i) => (
                          <li key={i} className={TILE}>
                            <p className={`${NOTE} break-words`}>
                              <Emphasized text={text} />
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* THE ADOPTED CONFLICT AGREEMENT'S PUBLIC VIEW (plan 4.6 and 6.2), roles
                        only. Before the village saves one, or when it cannot be read,
                        ConflictAgreementPublic prints the exit policy's steps instead. */}
                    <div data-testid="conflict-agreement-slot">
                      {conflictOn ? (
                        <Suspense fallback={null}>
                          <ConflictAgreementPublic />
                        </Suspense>
                      ) : (
                        <VillageConflictSteps />
                      )}
                    </div>
                  </Panel>
                )}

                {/* Stewards, and the fact that they come off. A member has to be able
                    to find out who can stop a decision, how long they have, and what
                    the village can do about it. "How long" is the village's own
                    `governance.veto_hours`, held back until it is known. */}
                {showStewards && (
                  <Panel id="stewards" icon={<Canopy className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">Who can stop a decision</Trans>} heading={stewards.fields.heading}>
                    <ul className="list-none space-y-3 p-0">
                      {stewardParagraphs.map((text, i) => (
                        <li key={i} className={TILE}>
                          <p className={`${NOTE} break-words`}>
                            <Emphasized text={text} />
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}

                {/* How rules evolve */}
                {!rules.hidden && (
                  <Panel id="rules" icon={<Sprout className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">How rules change</Trans>} heading={rules.fields.heading}>
                    <p className={`${NOTE} break-words`}>
                      <Emphasized text={rules.fields.body} />
                    </p>
                  </Panel>
                )}

                {/* The Governance Canvas on paper: twelve questions a group can talk
                    through, printable by anyone, signed in or not. Credited wherever
                    the canvas appears. */}
                {canvasOn && (
                  <Panel id="canvas-on-paper" icon={<Printer className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">Take it with you</Trans>} heading={<Trans>The Governance Canvas, on Paper</Trans>}>
                    <ul className={`${NOTE} mb-3 list-disc space-y-1 pl-5`}>
                      <li><Trans context="governance page: the canvas">Twelve blocks, from purpose to impact, for a group to talk through together.</Trans></li>
                      <li><Trans context="governance page: the canvas">They cover who decides, how conflict is held and how resources move.</Trans></li>
                      <li><Trans context="governance page: the canvas">The workbook prints each block on its own page, with room to write.</Trans></li>
                      <li><Trans context="governance page: the canvas">It can be saved as a Markdown file too.</Trans></li>
                    </ul>
                    <p className={`${HINT} mb-4`}>
                      <Trans>
                        The canvas is the{" "}
                        <a href={CANVAS_CREDIT.url} target="_blank" rel="noreferrer" className={LINK}>
                          {CANVAS_CREDIT.text}
                        </a>
                        .
                      </Trans>
                    </p>
                    <Link href="/canvas/workbook" className={BTN_SECONDARY}>
                      <Trans>Open the canvas workbook</Trans> <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Panel>
                )}

                {/* Hypha: drawn only while this village has a Hypha space to describe. */}
                {showHypha && (
                  <Panel id="hypha" icon={<Network className="size-5" />} eyebrow={<Trans context="how we work together: section kicker">On chain</Trans>} heading={<span lang={langOf("hypha.heading")}>{hyphaSection.fields.heading}</span>}>
                    <p lang={langOf("hypha.body")} className={`${NOTE} mb-4 break-words`}>
                      <Emphasized text={hyphaSection.fields.body} />
                    </p>
                    {storyShown("/co-creators-guide") && (
                      <Link href="/co-creators-guide" className={BTN_SECONDARY}>
                        {hyphaSection.fields.linkLabel} <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    )}
                  </Panel>
                )}
                {!hyphaSection.hidden && <HyphaAdminNote />}

                {/* The invitation. Both of its doors are brochure pages, so it goes
                    with them, and each door goes with its own page when that one is off alone. */}
                {showCta && (
                  <section id="join-in" aria-labelledby="join-in-heading" className={`${CARD_FEATURED} scroll-mt-24 text-center`}>
                    <h2 id="join-in-heading" className={`${H2} mb-3 break-words`}>
                      {cta.fields.heading}
                    </h2>
                    {cta.fields.body && (
                      <p className={`${NOTE} mx-auto mb-6 max-w-2xl break-words`}>
                        <Emphasized text={cta.fields.body} />
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {storyShown("/steward") && (
                        <Link href="/steward" className={BTN_PRIMARY}>
                          {cta.fields.stewardLabel} <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      )}
                      {storyShown("/love-letter") && (
                        <Link href="/love-letter" className={BTN_SECONDARY}>
                          {cta.fields.commitmentLabel}
                        </Link>
                      )}
                    </div>
                  </section>
                )}

                {/* THE BOX AT THE END OF THE CHAPTER, for a member, once their read is known. */}
                {member && reading.readAt !== undefined && (
                  <div className={`${TILE} space-y-1`} data-testid="how-we-work-tick">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className={TICK}
                        checked={pressed ?? !!reading.readAt}
                        aria-disabled={reading.saving || undefined}
                        aria-describedby="how-we-work-read-hint"
                        onChange={(e) => void tick(e.target.checked)}
                      />
                      <span className="font-semibold text-foreground">
                        <Trans context="how we work together: read">I&apos;ve read this</Trans>
                      </span>
                    </label>
                    <p id="how-we-work-read-hint" className={HINT}>
                      <Trans context="how we work together: read">It folds away for you, and your profile keeps it as read. Untick it to clear that.</Trans>
                    </p>
                    {reading.failed && (
                      <p role="alert" className="text-sm text-destructive">
                        <Trans context="how we work together: read">That did not save. Try again.</Trans>
                      </p>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* THE GAME MECHANICS, for members only. One line on openness that
                  promises only what the folds hold, a door to each fold, then the
                  folds themselves, every one shut until it is opened. */}
              {member && (
                <section id={GAME_MECHANICS_ANCHOR} aria-labelledby="game-mechanics-heading" className={`${GROUP_BREAK} mt-6 scroll-mt-24 space-y-4`}>
                  <div className="space-y-2">
                    <p className={EYEBROW}>
                      <Trans context="how we work together: the mechanics">For members</Trans>
                    </p>
                    <h2 id="game-mechanics-heading" className={GROUP_H2}>
                      <Trans context="how we work together: the mechanics">Game mechanics</Trans>
                    </h2>
                    <p className={LEDE}>
                      <Trans context="how we work together: the mechanics">We are open about how the game runs. The laws, the dials, the proposals and every change made are all below, each in its own section. Open the one you need.</Trans>
                    </p>
                  </div>
                  <Suspense
                    fallback={
                      <p className={HINT} role="status">
                        <Trans context="GameMechanics, p">Loading the rules of the Game…</Trans>
                      </p>
                    }
                  >
                    <GameMechanics />
                  </Suspense>
                </section>
              )}
            </div>

            {/* The contents, beside the page on a desktop. */}
            <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
              <nav aria-label={t({ message: "On this page", context: "how we work together: contents" })} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <p className={`${EYEBROW} px-3 pb-2 pt-1`}>
                  <Trans context="how we work together: contents">On this page</Trans>
                </p>
                <ul className="m-0 list-none space-y-0.5 p-0">
                  <li>
                    <a href="#how-we-work" onClick={again(HOW_WE_WORK_ANCHOR)} className={`${contentsLink} font-semibold text-foreground`}>
                      <Trans context="how we work together: contents">How we work together</Trans>
                    </a>
                  </li>
                  {contents.map((c) => (
                    <li key={c.id}>
                      <a href={`#${c.id}`} onClick={again(c.id)} className={`${contentsLink} pl-6`}>
                        <span className="min-w-0 truncate">{c.label}</span>
                      </a>
                    </li>
                  ))}
                  {member && (
                    <>
                      <li className="mt-2 border-t border-border pt-2">
                        <a href={`#${GAME_MECHANICS_ANCHOR}`} onClick={again(GAME_MECHANICS_ANCHOR)} className={`${contentsLink} font-semibold text-foreground`}>
                          <Trans context="how we work together: the mechanics">Game mechanics</Trans>
                        </a>
                      </li>
                      {mechanicsContents.map((m) => (
                        <li key={m.id}>
                          <a href={`#${m.id}`} onClick={again(m.id)} className={`${contentsLink} gap-2 pl-6`}>
                            <span className="text-notice">{m.icon}</span>
                            <span className="min-w-0 truncate">{m.label}</span>
                          </a>
                        </li>
                      ))}
                    </>
                  )}
                </ul>
              </nav>
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
}
