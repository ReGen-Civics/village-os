import Layout from "@/components/Layout";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import VillageAgreements from "@/components/governance/VillageAgreements";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import VillageConflictSteps from "@/components/governance/VillageConflictSteps";
import { useModuleOn } from "@/modules/ModuleProvider";
import VoiceSpreadBand from "@/components/governance/VoiceSpreadBand";
import { Eye, MessageSquare, CheckCircle2, RefreshCw, Network, ArrowRight, ArrowDown, Scale, Printer } from "lucide-react";
import { GoldenSpiral, Labyrinth, SeedOfLife, Triad } from "@/components/sacred/glyphs";
import { GROUP_BREAK, GROUP_H2 } from "@/components/roleCard/groupLook";
import { Canopy, CouncilCircle, MushroomNetwork, Seed } from "@/components/sacred/living";
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
import GovernanceTabs from "@/components/governance/now/GovernanceTabs";
import { BTN_NOTICE, BTN_PRIMARY, BTN_SECONDARY, CARD, CARD_FEATURED, DOOR, EYEBROW, H1, H2, HINT, LEDE, LINK, NOTE, QUIET, RING, TILE, WORLD } from "@/components/journey/look";

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

/** The anchor every door to the mechanics lands on (the old /game-mechanics redirects here). */
export const GAME_MECHANICS_ANCHOR = "game-mechanics";

/** A section of the page: a panel with its own anchor, clear of the sticky header. */
function Panel({ id, icon, heading, children, className = CARD }: { id: string; icon?: ReactNode; heading: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={`${className} scroll-mt-24 min-w-0`}>
      <div className="mb-4 flex items-center gap-3">
        {icon ? (
          <span className={RING} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <h2 id={`${id}-heading`} className={`${H2} min-w-0 break-words`}>
          {heading}
        </h2>
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
  const { t } = useLingui();
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
   * ARRIVING AT AN ANCHOR. The page is drawn after its words arrive, so the
   * browser's own jump to `#conflict` or `#game-mechanics` found nothing to land
   * on. Once the words are in, go there. The mechanics' own folds do the same
   * for theirs once their rules land.
   */
  useEffect(() => {
    if (!page) return;
    const id = window.location.hash.slice(1);
    if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return;
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    // Once, when the words land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!page]);

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
  const contentsLink = "flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
          {member && (
            <div className={`${QUIET} mt-6 flex flex-wrap items-center justify-between gap-3 bg-card`} data-testid="mechanics-jump">
              <p className={`${NOTE} min-w-0`}>
                <Trans context="how we work together: the jump">Read how we work together before?</Trans>
              </p>
              <a href={`#${GAME_MECHANICS_ANCHOR}`} className={BTN_NOTICE}>
                <Trans context="how we work together: the jump">Skip to the game mechanics</Trans>
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
          )}

          <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-8">
            <div className="min-w-0 space-y-6">
              <div id="how-we-work" className="scroll-mt-24 space-y-6">
                {/* The first of the page's two chapters (groupLook.ts, as /roles splits its chapters). */}
                <h2 className={GROUP_H2}>
                  <Trans context="how we work together: chapter">How we work together</Trans>
                </h2>
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
                  <Panel id="who-decides" icon={<Scale className="size-5" />} heading={<Trans context="governance page section heading">Who Decides What</Trans>}>
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
                  <Panel id="principles" heading={principles.fields.heading}>
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
                  <Panel id="decisions" heading={decision.fields.heading}>
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
                  <Panel id="circles" heading={circles.fields.heading}>
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
                  <Panel id="conflict" icon={<Scale className="size-5" />} heading={conflict.fields.heading}>
                    {conflictParagraphs.length > 0 && (
                      <div className={`${NOTE} mb-5 space-y-3`}>
                        {conflictParagraphs.map((text, i) => (
                          <p key={i} className="break-words">
                            <Emphasized text={text} />
                          </p>
                        ))}
                      </div>
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
                  <Panel id="stewards" icon={<Canopy className="size-5" />} heading={stewards.fields.heading}>
                    <div className={`${NOTE} space-y-3`}>
                      {stewardParagraphs.map((text, i) => (
                        <p key={i} className="break-words">
                          <Emphasized text={text} />
                        </p>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* How rules evolve */}
                {!rules.hidden && (
                  <Panel id="rules" icon={<RefreshCw className="size-5" />} heading={rules.fields.heading}>
                    <p className={`${NOTE} break-words`}>
                      <Emphasized text={rules.fields.body} />
                    </p>
                  </Panel>
                )}

                {/* The Governance Canvas on paper: twelve questions a group can talk
                    through, printable by anyone, signed in or not. Credited wherever
                    the canvas appears. */}
                {canvasOn && (
                  <Panel id="canvas-on-paper" icon={<Printer className="size-5" />} heading={<Trans>The Governance Canvas, on Paper</Trans>}>
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
                  <Panel id="hypha" icon={<Network className="size-5" />} heading={<span lang={langOf("hypha.heading")}>{hyphaSection.fields.heading}</span>}>
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
              </div>

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
            <aside className="hidden lg:block">
              <nav aria-label={t({ message: "On this page", context: "how we work together: contents" })} className="sticky top-24 rounded-2xl border border-border bg-card p-3 shadow-sm">
                <p className={`${EYEBROW} px-3 pb-2 pt-1`}>
                  <Trans context="how we work together: contents">On this page</Trans>
                </p>
                <ul className="m-0 list-none space-y-0.5 p-0">
                  <li>
                    <a href="#how-we-work" className={`${contentsLink} font-semibold text-foreground`}>
                      <Trans context="how we work together: contents">How we work together</Trans>
                    </a>
                  </li>
                  {contents.map((c) => (
                    <li key={c.id}>
                      <a href={`#${c.id}`} className={`${contentsLink} pl-6`}>
                        <span className="min-w-0 truncate">{c.label}</span>
                      </a>
                    </li>
                  ))}
                  {member && (
                    <>
                      <li className="mt-2 border-t border-border pt-2">
                        <a href={`#${GAME_MECHANICS_ANCHOR}`} className={`${contentsLink} font-semibold text-foreground`}>
                          <Trans context="how we work together: the mechanics">Game mechanics</Trans>
                        </a>
                      </li>
                      {mechanicsContents.map((m) => (
                        <li key={m.id}>
                          <a href={`#${m.id}`} className={`${contentsLink} gap-2 pl-6`}>
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
