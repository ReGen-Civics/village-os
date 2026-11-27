/**
 * /governance/treasury: THE VILLAGE'S ONE TREASURY, a view of the Governance page (the lead, 27 Nov 2026: fold the
 * treasury pages into Govern > Treasury, "consider what this treasury tab is doing and what those functions are doing
 * for members or a treasurer").
 *
 * Under the first screen (#desks: the real moon, this moon's purse, and a door to each desk the reader holds), five
 * sections, each drawn only for whoever the server says needs it, most used first:
 *
 *   #end-of-moon  cash.pay or moon.approve_alone   End of Moon pay: the recaps to confirm, Pay by member (#pay-board),
 *                                                  and, for cash.pay, the review's settings, folded
 *   #cash         cash.pay                   the cash still owed, and the bank transfers recorded against it
 *   #prices       role.pay                   the pricing desk: each open quest's price beside the engine's suggestion
 *   #mint         token.mint                 the hand mint and the grants waiting for a second signer
 *   #cash-budget  every signed-in member     the cash budget (BudgetDesk); its editor opens for a holder of role.pay,
 *                                            and a member suggests a change instead (BudgetSuggest)
 *
 * A desk this reader does not hold is one quiet line saying who it opens for, with the same anchor, so an old link
 * to it lands on that sentence.
 *
 * Which desks open is the server's answer, never this page's: `GET /api/treasury/doors` (the same `mayAct` every
 * write asks) for the three treasury powers, and the pricing desk's own read (`GET /api/quests/pricing-desk`, which
 * asks role.pay) for prices. That first read is handed to the desk, so it is asked once. The board waits for both
 * answers before it counts anything.
 *
 * The desks are Admin's, drawn here in the sheet's look (components/treasury/deskLooks.ts) so Admin keeps its own.
 *
 * The old addresses redirect here (client/src/lib/treasuryAddress.ts): /treasury to #desks, /cash-payouts to #cash
 * (or the hash it carried, so `#pay-board` still lands), /pricing to #prices, /budget to #cash-budget.
 *
 * A lazy route. Every desk is a lazy chunk of its own, and the privileged ones never join a shared group
 * (client/src/lib/privilegedChunks.ts), so a member who holds none of these powers downloads none of them.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Lock } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { authToken, gameFetch } from "@/lib/gameApi";
import { useModuleOn } from "@/modules/ModuleProvider";
import { SignInDoors } from "@/components/modules/ModuleGate";
import { BreathingLoader } from "@/components/natural";
import MoonPhase from "@/components/journey/nature/MoonPhase";
import { GoldenSpiral, Lotus, SeedOfLife, Triad, Tripoint } from "@/components/sacred/glyphs";
import { BTN_PRIMARY, CARD, CARD_FEATURED, DOOR, EYEBROW, H1, H2, HINT, LEDE, LINK, NOTE, QUIET, RING, STATEMENT, TILE, WORLD } from "@/components/journey/look";
import { SHEET_LOOK } from "@/components/budgets/budgetLook";
import { NOT_COUNTED_WORDS } from "@/components/budgets/budgetWords";
import BudgetSuggest, { suggestDoorOf } from "@/components/budgets/BudgetSuggest";
import { formatMoney } from "@shared/money";
import type { BudgetRead } from "@/components/budgets/budgetApi";
import GovernanceTabs from "@/components/governance/now/GovernanceTabs";
import { useTreasuryDoors, type TreasuryDoors } from "@/components/treasury/useTreasuryDoors";
import { CASH_SHEET, PRICING_SHEET, SETTINGS_SHEET_KIT, SettingsKitContext } from "@/components/treasury/deskLooks";
import { goToSection, holdSection } from "@/lib/sectionAnchor";
import { TREASURY_PATH, TREASURY_SECTIONS, isTreasurySection, treasuryHref, type TreasurySection } from "@/lib/treasuryAddress";

const BudgetDesk = lazy(() => import("@/components/budgets/BudgetDesk"));
const ReviewQueue = lazy(() => import("@/components/myMoon/ReviewQueue"));
const PayBoard = lazy(() => import("@/components/myMoon/PayBoard"));
const CashPayoutsTab = lazy(() => import("@/components/admin/CashPayoutsTab"));
const PricingDesk = lazy(() => import("@/components/valuation/PricingDesk"));
/** The mint for a holder who is not an admin: MintDesk's own privileged chunk. */
const MintSection = lazy(() => import("@/components/admin/MintDesk").then((m) => ({ default: m.MintFromTreasury })));
/** The End of Moon review's settings (payers, village settings, the moon's rhythm), through the cash desk's chunk. */
const MoonReviewSettings = lazy(() => import("@/components/admin/CashPayoutsTab").then((m) => ({ default: m.MoonReviewSettings })));

/** `MOON_REVIEW_MODULE` in shared/moonRecap.ts, spelled here so this chunk does not carry that file. */
const MOON_REVIEW_MODULE = "moon-review";
/** The pricing desk's read, which asks role.pay itself (server/routes/questPay.ts). */
const PRICING_READ = "/quests/pricing-desk";

/** Where the cash budget sits, for the /budget redirect and every link to it. */
export const CASH_BUDGET_HREF = treasuryHref(TREASURY_SECTIONS.budget);

/** Which desks this reader may open: the server's doors, and the pricing desk's own answer. */
export interface OpenDesks {
  endOfMoon: boolean;
  cash: boolean;
  prices: boolean;
  mint: boolean;
}

export function openDesks(doors: TreasuryDoors | null | undefined, mayPrice: boolean): OpenDesks {
  return { endOfMoon: !!doors?.pay, cash: !!doors?.cashPay, prices: mayPrice, mint: !!doors?.mint };
}

type DeskKey = keyof OpenDesks;

/** A desk's glyph: sacred geometry where a stock icon would be arbitrary (docs/DESIGN_RULE.md). */
const GLYPH: Record<DeskKey | "budget", (p: { className?: string }) => ReactNode> = {
  budget: SeedOfLife,
  endOfMoon: Lotus,
  cash: Triad,
  prices: GoldenSpiral,
  mint: Tripoint,
};

const SECTION_OF: Record<DeskKey | "budget", TreasurySection> = {
  budget: TREASURY_SECTIONS.budget,
  endOfMoon: TREASURY_SECTIONS.endOfMoon,
  cash: TREASURY_SECTIONS.cash,
  prices: TREASURY_SECTIONS.prices,
  mint: TREASURY_SECTIONS.mint,
};

/** Most used first: a moon's pay, then the cash it sends, then the prices that set it, then the rare mint. */
const DESK_ORDER: readonly DeskKey[] = ["endOfMoon", "cash", "prices", "mint"];

function useDeskWords() {
  const { t } = useLingui();
  return {
    budget: {
      title: t({ message: "Cash budget", context: "treasury: a desk" }),
      line: t({ message: "What the village plans to pay this moon, and what is left.", context: "treasury: a desk" }),
      opensFor: "",
    },
    endOfMoon: {
      title: t({ message: "End of Moon pay", context: "treasury: a desk" }),
      line: t({ message: "Confirm what was agreed against what was delivered.", context: "treasury: a desk" }),
      opensFor: t({ message: "End of Moon pay opens for whoever holds the power to pay or to approve the moon alone.", context: "treasury: a desk this reader does not hold" }),
    },
    cash: {
      title: t({ message: "Cash to pay out", context: "treasury: a desk" }),
      line: t({ message: "Send what is owed by bank transfer, then record it here.", context: "treasury: a desk" }),
      opensFor: t({ message: "Cash to pay out opens for whoever holds the treasurer's power to pay cash.", context: "treasury: a desk this reader does not hold" }),
    },
    prices: {
      title: t({ message: "Quest prices", context: "treasury: a desk" }),
      line: t({ message: "Price each open quest beside the suggested figure.", context: "treasury: a desk" }),
      opensFor: t({ message: "Quest prices open for whoever holds the power to set pay, such as the Treasurer.", context: "treasury: a desk this reader does not hold" }),
    },
    mint: {
      title: t({ message: "Mint tokens", context: "treasury: a desk" }),
      line: t({ message: "Pay a request or give a bonus in the village's tokens.", context: "treasury: a desk" }),
      opensFor: t({ message: "Mint tokens opens for whoever holds the power to mint.", context: "treasury: a desk this reader does not hold" }),
    },
  } as const;
}

/** A section's head: the desk's glyph in a gold ring, then its name and the one thing it is for. */
function SectionHead({ desk, id, title, line }: { desk: DeskKey | "budget"; id: string; title: string; line: string }) {
  const Glyph = GLYPH[desk];
  return (
    <div className="flex items-start gap-4">
      <span className={RING} aria-hidden="true">
        <Glyph className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id={id} className={`${H2} outline-none`} data-section-focus tabIndex={-1}>
          {title}
        </h2>
        <p className={HINT}>{line}</p>
      </div>
    </div>
  );
}

const dayOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/**
 * THE MOON'S PURSE: the one figure the pay engine reads (`cashBudgetLeft`), as three purses, so the treasury opens on
 * what the village holds before any table. What is left is gold, and on a phone it comes first, full width, with the
 * other two side by side under it. A village with no line for pay this moon says so in one line.
 */
function Purses({ read }: { read: BudgetRead | null }) {
  const { t, i18n } = useLingui();
  if (!read) return null;
  const { figure, villageCurrency } = read;
  if (!figure) {
    return (
      <p className={NOTE} data-treasury-purses="none">
        {villageCurrency
          ? t({ message: "No line for role pay or quest pay counts in this moon yet, so the budget sets no limit on pay.", context: "budget desk no figure" })
          : t({ message: "The village has no currency set yet, so there is no figure to work out. An admin sets it in the setup wizard.", context: "budget desk no figure" })}
      </p>
    );
  }
  const notCounted = figure.working?.notCounted ?? [];
  const reasons = Array.from(new Set(notCounted.map((n) => n.reason))).map((r) => i18n._(NOT_COUNTED_WORDS[r]));
  const purse = (label: string, minor: number, left = false) => (
    <div className={`${TILE} ${left ? "max-sm:order-first max-sm:col-span-2" : "max-sm:px-3 max-sm:py-2"}`}>
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 font-display leading-none sm:mt-2 sm:text-4xl ${left ? "text-3xl text-notice" : "text-xl text-foreground"}`}
        data-budget-left={left ? "" : undefined}
      >
        {formatMoney(minor, figure.currency)}
      </dd>
    </div>
  );
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3" data-treasury-purses aria-label={t({ message: "This moon's cash", context: "treasury: the purses, read aloud" })}>
        {purse(t({ message: "Planned", context: "budget figure" }), figure.plannedMinor)}
        {purse(t({ message: "Already promised", context: "budget figure" }), figure.committedMinor)}
        {purse(t({ message: "Left this moon", context: "budget figure" }), figure.leftMinor, true)}
      </dl>
      {notCounted.length > 0 ? (
        <p className={HINT}>
          {t({ message: `${notCounted.length} lines touch this moon and do not count yet: ${reasons.join("; ")}.`, context: "budget desk lines not counted" })}
        </p>
      ) : null}
      {read.note?.note ? <p className={HINT}>{read.note.note}</p> : null}
    </>
  );
}

/** Land on the section the address names once the page has drawn it, then hold it while the desks above load. */
function useLandOnTreasury(ready: boolean): void {
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !ready || typeof window === "undefined") return;
    let h = "";
    try {
      h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    } catch {
      h = "";
    }
    if (!isTreasurySection(h)) {
      landed.current = true;
      return;
    }
    // A desk draws its own section late (Pay by member's #pay-board is inside a lazy chunk), so look again for a few
    // seconds until it is there, and stop the moment the reader takes the page over.
    let release = () => {};
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timer);
      for (const e of READER_INPUT) window.removeEventListener(e, stop, true);
    };
    const look = () => {
      if (goToSection(h, { push: false })) {
        landed.current = true;
        stop();
        release = holdSection(h);
      } else if (++tries < LAND_TRIES) timer = setTimeout(look, LAND_EVERY_MS);
      else stop();
    };
    for (const e of READER_INPUT) window.addEventListener(e, stop, { capture: true, passive: true });
    timer = setTimeout(look, 0);
    return () => {
      stop();
      release();
    };
  }, [ready]);
}

/** How long a landing looks for a section that draws late: every 150ms for six seconds. */
const LAND_EVERY_MS = 150;
const LAND_TRIES = 40;
/** Input that means the reader has taken the page over (the same four sectionAnchor's hold listens for). */
const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

export default function GovernanceTreasury() {
  const { t } = useLingui();
  const { user, token } = useAuth();
  const bearer = token ?? authToken() ?? "";
  const doors = useTreasuryDoors(user ? token : null);
  const moonReviewOn = useModuleOn(MOON_REVIEW_MODULE);
  const [budget, setBudget] = useState<BudgetRead | null>(null);
  const onBudget = useCallback((read: BudgetRead) => setBudget(read), []);
  const [suggesting, setSuggesting] = useState(false);
  const words = useDeskWords();

  // The pricing desk asks through the member's own session; a refusal is its sentence, never a code.
  const priceCall = useCallback(async (path: string, body?: unknown, method = "POST") => {
    const r = await gameFetch(`/api${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) return { error: t({ message: "The pricing desk is for whoever holds the pay-setting power, such as the Treasurer.", context: "treasury: prices refused" }) };
    return data;
  }, [t]);

  // Quest prices open on the pricing desk's own answer (role.pay, asked by its read). The first read is kept and
  // handed to the desk when it opens, so the server is asked once.
  const firstPriceRead = useRef<Promise<any> | null>(null);
  const [mayPrice, setMayPrice] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!user) {
      setMayPrice(false);
      return;
    }
    let live = true;
    const asked = priceCall(PRICING_READ, undefined, "GET").catch(() => ({}));
    firstPriceRead.current = asked;
    void asked.then((d) => {
      if (live) setMayPrice(!!(d && typeof d === "object" && "model" in d && d.model));
    });
    return () => {
      live = false;
    };
  }, [user, priceCall]);
  const deskCall = useCallback(async (path: string, body?: unknown, method = "POST") => {
    if (path === PRICING_READ && method === "GET" && firstPriceRead.current) {
      const kept = firstPriceRead.current;
      firstPriceRead.current = null;
      return kept;
    }
    return priceCall(path, body, method);
  }, [priceCall]);

  // The board counts nothing until both answers are back.
  const known = doors !== undefined && mayPrice !== undefined;
  const open = openDesks(doors, mayPrice === true);
  const held = known ? DESK_ORDER.filter((k) => open[k]) : [];
  const notHeld = known ? DESK_ORDER.filter((k) => !open[k]) : [];
  const suggestDoor = suggestDoorOf(budget);
  useLandOnTreasury(!!user && known);

  const jump = (section: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (goToSection(section)) e.preventDefault();
  };
  const startSuggesting = () => setSuggesting(true);
  useEffect(() => {
    if (suggesting) requestAnimationFrame(() => goToSection("budget-suggest"));
  }, [suggesting]);

  return (
    <Layout>
      <div className={WORLD} data-world="night">
        <div className="mx-auto max-w-4xl space-y-6 px-4 pb-6 pt-4 sm:space-y-8 sm:py-12 xl:max-w-[1200px]">
          <header className="space-y-2">
            <p className={EYEBROW}>
              <Trans context="governance now: eyebrow">How the village decides</Trans>
            </p>
            <h1 className={H1}>
              <Trans context="governance now: h1">Governance</Trans>
            </h1>
            <p className={LEDE}>
              <Trans context="governance treasury: lede">The village's money in one place: what it can pay this moon, and the desks that pay it.</Trans>
            </p>
          </header>
          <GovernanceTabs signedIn={!!authToken()} />

          {!user ? (
            <section className={CARD} aria-labelledby="treasury-signed-out">
              <h2 id="treasury-signed-out" className={`${H2} mb-2`}>
                <Trans context="treasury: signed out">The treasury</Trans>
              </h2>
              <p className={`${HINT} mb-4`}>
                <Trans context="treasury: signed out">Sign in to read the village's cash budget, and any treasury desk the village has given you.</Trans>
              </p>
              <SignInDoors next={`${TREASURY_PATH}${typeof window === "undefined" ? "" : window.location.hash}`} align="start" />
            </section>
          ) : (
            <>
              {/* The first screen: the moon, the village's purse for it, then what this reader does here. */}
              <section id={TREASURY_SECTIONS.desks} aria-labelledby="treasury-desks" className={`${CARD_FEATURED} scroll-mt-28`} data-governance-treasury="desks">
                <div className="flex items-center gap-4 sm:gap-6">
                  <MoonPhase size="md" showName className="items-center" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={EYEBROW}>
                      <Trans context="treasury: hero eyebrow">The treasury, this moon</Trans>
                    </p>
                    <h2 id="treasury-desks" className={`${STATEMENT} outline-none`} data-section-focus tabIndex={-1}>
                      {held.length > 0
                        ? t({ message: "Your treasury desks", context: "treasury: hero, a holder of a treasury power" })
                        : t({ message: "The village's cash, in the open", context: "treasury: hero, a member" })}
                    </h2>
                    {budget ? (
                      <p className={HINT}>{t({ message: `${dayOf(budget.moon.startsOn)} to ${dayOf(budget.moon.endsOn)}`, context: "budget desk moon dates" })}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:mt-6 sm:gap-6">
                  <Purses read={budget} />

                  {!known ? (
                    <BreathingLoader />
                  ) : held.length > 0 ? (
                    <nav aria-label={t({ message: "Your desks", context: "treasury: the desk board, read aloud" })} className="space-y-3">
                      <p className={HINT} data-treasury-keys>
                        {held.length === 1
                          ? t({ message: "The village gave you the power behind this desk by its vote.", context: "treasury: hero, a holder" })
                          : t({ message: `The village gave you the powers behind these ${held.length} desks by its vote.`, context: "treasury: hero, a holder" })}
                      </p>
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {held.map((k, i) => {
                          const Glyph = GLYPH[k];
                          const section = SECTION_OF[k];
                          return (
                            <li key={k}>
                              {/* The first desk is the next door: gold-edged, the one lit act on this panel. */}
                              <a href={`#${section}`} onClick={jump(section)} className={`${DOOR} h-full py-3 ${i === 0 ? "border-notice bg-notice/10" : ""}`} data-treasury-door={k}>
                                <span className="flex min-w-0 items-center gap-3">
                                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-notice text-notice" aria-hidden="true">
                                    <Glyph className="size-5" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-foreground">{words[k].title}</span>
                                    <span className="block text-sm font-normal text-muted-foreground">{words[k].line}</span>
                                  </span>
                                </span>
                                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-notice transition-transform group-hover:translate-x-0.5" />
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                      <p className={HINT}>
                        <a href={`#${TREASURY_SECTIONS.budget}`} onClick={jump(TREASURY_SECTIONS.budget)} className={`${LINK} inline-flex min-h-11 items-center`} data-treasury-door="budget">
                          <Trans context="treasury: the quiet link to the budget, under a holder's desks">The cash budget, line by line</Trans>
                        </a>
                      </p>
                    </nav>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {suggestDoor ? (
                        <button type="button" className={BTN_PRIMARY} onClick={startSuggesting} aria-expanded={suggesting} data-treasury-act="suggest">
                          <Trans context="treasury: hero, a member's one act">Suggest a change to the budget</Trans>
                        </button>
                      ) : null}
                      <a href={`#${TREASURY_SECTIONS.budget}`} onClick={jump(TREASURY_SECTIONS.budget)} className={`${LINK} inline-flex min-h-11 items-center`}>
                        <Trans context="treasury: hero, a member's link to the lines">Read the budget, line by line</Trans>
                      </a>
                    </div>
                  )}
                </div>
              </section>

              {open.endOfMoon ? (
                <section id={TREASURY_SECTIONS.endOfMoon} aria-labelledby="end-of-moon-h" className="scroll-mt-28 space-y-4 [&_#pay-board]:scroll-mt-28" data-governance-treasury="end-of-moon">
                  <SectionHead desk="endOfMoon" id="end-of-moon-h" title={words.endOfMoon.title} line={words.endOfMoon.line} />
                  <Suspense fallback={<BreathingLoader />}>
                    {moonReviewOn ? (
                      <div className={CARD}>
                        <ReviewQueue />
                      </div>
                    ) : null}
                    {/* Each member's cash sent from escrow and the token pay to approve; asks cash.pay or moon.approve_alone. */}
                    <PayBoard password={bearer} />
                    {open.cash ? (
                      // The review's own rules (payers, village settings, the moon's rhythm), answered to the cash power: folded, last.
                      <details className={`${CARD} group`} data-governance-treasury="moon-settings">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-foreground">
                          <Trans context="treasury: the End of Moon review's settings, folded">End of Moon review settings</Trans>
                          <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-notice transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="mt-4">
                          {/* The editors read the sheet's kit from context; Admin provides none and keeps its own. */}
                          <SettingsKitContext.Provider value={SETTINGS_SHEET_KIT}>
                            <MoonReviewSettings password={bearer} look={CASH_SHEET} bare />
                          </SettingsKitContext.Provider>
                        </div>
                      </details>
                    ) : null}
                  </Suspense>
                </section>
              ) : null}

              {open.cash ? (
                <section id={TREASURY_SECTIONS.cash} aria-labelledby="cash-h" className="scroll-mt-28 space-y-4" data-governance-treasury="cash">
                  <SectionHead desk="cash" id="cash-h" title={words.cash.title} line={words.cash.line} />
                  <div className={CARD}>
                    <Suspense fallback={<BreathingLoader />}>
                      <CashPayoutsTab password={bearer} withPayBoard={false} withHeading={false} withSettings={false} look={CASH_SHEET} />
                    </Suspense>
                  </div>
                </section>
              ) : null}

              {open.prices ? (
                <section id={TREASURY_SECTIONS.prices} aria-labelledby="prices-h" className="scroll-mt-28 space-y-4" data-governance-treasury="prices">
                  <SectionHead desk="prices" id="prices-h" title={words.prices.title} line={words.prices.line} />
                  <div className={CARD}>
                    <Suspense fallback={<BreathingLoader />}>
                      <PricingDesk call={deskCall} bare look={PRICING_SHEET} />
                    </Suspense>
                  </div>
                </section>
              ) : null}

              {open.mint ? (
                <section id={TREASURY_SECTIONS.mint} aria-labelledby="mint-h" className="scroll-mt-28 space-y-4" data-governance-treasury="mint">
                  <SectionHead desk="mint" id="mint-h" title={words.mint.title} line={words.mint.line} />
                  <div className={CARD}>
                    <Suspense fallback={<BreathingLoader />}>
                      <MintSection password={bearer} />
                    </Suspense>
                  </div>
                </section>
              ) : null}

              {/* Last for a holder, whose desks are the work; for a member it is the one section, straight under the moon. */}
              <section id={TREASURY_SECTIONS.budget} aria-labelledby="cash-budget-h" className="scroll-mt-28 space-y-4" data-governance-treasury="cash-budget">
                <SectionHead
                  desk="budget"
                  id="cash-budget-h"
                  title={t({ message: "What the village can pay in cash", context: "budget page" })}
                  line={t({ message: "Every member reads it. Whoever holds the budget power changes it.", context: "treasury: budget" })}
                />
                {suggesting && budget && suggestDoor ? (
                  <div id="budget-suggest" className="scroll-mt-28">
                    <BudgetSuggest read={budget} door={suggestDoor} bearer={bearer} look={SHEET_LOOK} onClose={() => setSuggesting(false)} />
                  </div>
                ) : null}
                <Suspense fallback={<BreathingLoader />}>
                  <BudgetDesk bearer={bearer} look={SHEET_LOOK} onRead={onBudget} showFigure={false} />
                </Suspense>
              </section>

              {notHeld.length > 0 ? (
                // A desk this reader does not hold: one quiet line saying who it opens for, at the desk's own anchor.
                <section aria-labelledby="other-desks-h" className="space-y-2" data-governance-treasury="keepers">
                  <h2 id="other-desks-h" className={EYEBROW}>
                    {held.length > 0
                      ? t({ message: "The other desks", context: "treasury: the desks this reader does not hold" })
                      : t({ message: "The treasurer's desks", context: "treasury: the desks this reader does not hold" })}
                  </h2>
                  <ul className="space-y-2">
                    {notHeld.map((k) => (
                      <li key={k} id={SECTION_OF[k]} className={`${QUIET} flex scroll-mt-28 items-start gap-3`} data-treasury-locked={k}>
                        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <p className={`${HINT} outline-none`} data-section-focus tabIndex={-1}>{words[k].opensFor}</p>
                      </li>
                    ))}
                  </ul>
                  <p className={HINT}>
                    <Trans context="treasury: who keeps the books, for a member who holds no treasury power">The treasurer's desks open here for whoever the village gives those powers by its vote.</Trans>{" "}
                    <Link href="/powers" className={LINK}>
                      <Trans context="link to the powers page">What We Look After</Trans>
                    </Link>
                  </p>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
