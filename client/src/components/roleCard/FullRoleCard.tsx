/**
 * THE FULL ROLE CARD (phase A, lane A3, build list 4.4 to 4.8): everything the
 * role editor holds, read-only, in one card.
 *
 *   - the role's words, under the editor's own headings (CARD_WORDS), each
 *     drawn only once it is written, so no heading sits over blank space;
 *   - the founding sections (shared/roleCardSections.ts): "This is a paid
 *     role", Ideal background, Qualities we're looking for, Digital Companion with its
 *     animal companion, and How rewards work as SHARES of the whole, never an
 *     amount or a range;
 *   - the listing details (track, goals, where, languages, how it is filled,
 *     selection criteria), through the same view model every card host reads
 *     (RoleCardParams, shared/roleCardView.ts);
 *   - the roots it grows from (RootsSlot, drawn by the roots kit's RootTags);
 *   - who last edited it and on what day;
 *   - one act, "Apply for this role", to /propose-a-role?role=<id>, lit by the
 *     one firefly cluster on the screen.
 *
 * READ-ONLY FOR EVERYONE WITHOUT THE POWER. The only edit control is the
 * editor's own door (EditRoleButton), which draws nothing for a visitor, an
 * applicant or a member without the power to decide the structure; the server
 * asks the same question again on every write.
 *
 * Two registers (phase A brief). `founding` is the quiet one for a paid
 * founding role: larger display type, more space, gold rules. `game` is the
 * directory's. Both use the night world's semantic tokens only.
 *
 * Phone and desktop: one column on a phone with the act at the end of the
 * card; from lg, the role's words on the left and a sticky column on the right
 * holding the pay shape, the details and the act, so the act stays beside what
 * a reader is reading.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Bird, Cat, Dog, Feather, Fish, PawPrint, Rabbit, Snail, Squirrel, Turtle } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { HeldByAgentLine, StateNote } from "@/components/ComingSoon";
import { CARD_WORDS as W } from "@shared/playerCardWords";
import { cardPay, NO_VILLAGE_PAY, SECTION_WORDS, type PayShare, type RoleCardSections, type VillagePay } from "@shared/roleCardSections";
import { roleCardView } from "@shared/roleCardView";
import { heldButRecruiting } from "@shared/roleListing";
import { commitmentRowWords, perPeriod, rewardWords, splitNotRestated } from "./rewardWords";
import { moneyWords } from "@shared/roleRewardWords";
import { goalOf, nextDeliverables } from "@shared/roleOneMinute";
import { CardTipsProvider, TipText, useCardTips } from "./CardTips";
import RoleOneMinute from "./RoleOneMinute";
import { bandWords } from "./payBandWords";
import { paidRoleLine } from "./cardWordsT";
import { civilDayWords } from "@shared/seasonPlans";
import { BTN_PRIMARY, EYEBROW, HINT } from "@/components/journey/look";
import { Fireflies } from "@/components/journey/nature";
import RoleCardParams from "@/components/power/RoleCardParams";
import EditRoleButton from "@/components/roleEdit/EditRoleButton";
import FoundingRoleCard from "./FoundingRoleCard";
import RootsSlot from "./RootsSlot";
import { useWide } from "./useWide";
import { readRoleCard, type RoleCardAnswer } from "./roleCardApi";
import { overlaySeat, overlaySections } from "@shared/contentTranslationOverlay";
import { useLocale } from "@/i18n/LocaleProvider";
import { MachineTranslationMark } from "@/i18n/machineTranslation";
import { withFocusLine } from "./focusLine";
import { shownCommitment } from "@shared/focusLine";
import { rangeMin } from "@shared/commitmentRange";
import { MoonText } from "@/components/MoonWord";
import { ShareLabel, TokenText, shareLabelFor, useShareNames } from "@/components/ContributionWord";
import { useVillageName } from "@/hooks/useVillageName";
import { NO_SHARED, onboardingFor } from "@shared/roleCardShared";
import { LabelledBullets, VillageGoalBanner } from "./FoundingRoleCard";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// The directory card's deliverables, shared rhythm and onboarding steps load with the card's lists, off the first view.
// The waitlist form on a coming-soon card, loaded on open.
const WaitlistForm = lazy(() => import("./WaitlistForm"));
const GameCardExtras = lazy(() => import("./CardLists").then((m) => ({ default: m.GameCardExtras })));

// The slider and the split load when a card draws them, off the first view of /roles and /propose-a-role (route-first-view.json).
const CardCommitment = lazy(() => import("./CardCommitment"));
// The share link in the footer, loaded with a card that offers one.
const SeatLinkCopy = lazy(() => import("./SeatLinkCopy"));

export type CardRegister = "founding" | "game";

/** Where the Apply act goes: the application, with this one role already chosen (ruling 1), and the card's choice (applyChoice.ts). */
export function applyHrefForRole(roleId: string, choice = ""): string {
  return `/propose-a-role?role=${encodeURIComponent(roleId)}${choice ? `&${choice}` : ""}`;
}

// The value callout and its explainer (lead, 17 Nov 2026), loaded when a card draws its pay, so neither rides the first
// view of a route that shows a card (guard-route-first-views, scripts/route-first-view.json).
const ValueCallout = lazy(() => import("./ValueCallout"));

/** Whether this reader may apply for the seat: a live, open, complete card. */
export function mayApply(seat: Record<string, any>): boolean {
  if (!seat || seat.isExample) return false;
  // Held, with the door still open (the lead, 17 Nov 2026): more players welcome, so Apply stays.
  if (seat.state === "filled" && !heldButRecruiting(seat)) return false;
  return roleCardView(seat).applyAllowed;
}

const ANIMALS: Array<[RegExp, typeof Bird]> = [
  [/turtle|tortoise/i, Turtle],
  [/rabbit|hare/i, Rabbit],
  [/squirrel/i, Squirrel],
  [/fish|salmon|whale|dolphin/i, Fish],
  [/snail/i, Snail],
  [/cat|jaguar|ocelot|puma/i, Cat],
  [/dog|wolf|fox/i, Dog],
  [/owl|heron|hummingbird|toucan|bird|parrot|macaw|eagle|hawk/i, Bird],
  [/feather/i, Feather],
];

/** The companion's animal as a drawing: the named animal where there is one, a paw print otherwise. */
function AnimalIcon({ name }: { name: string }) {
  const Icon = ANIMALS.find(([re]) => re.test(name))?.[1] ?? PawPrint;
  return <Icon className="size-6 text-notice" aria-hidden="true" />;
}

const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asLines = (v: unknown): string[] => {
  let x = v;
  if (typeof x === "string") {
    try {
      x = JSON.parse(x);
    } catch {
      return x ? [String(x)] : [];
    }
  }
  return Array.isArray(x) ? x.map((s) => String(s).trim()).filter(Boolean) : [];
};

function Block({ heading, register, children, testId, lifted = false }: { heading: string; register: CardRegister; children: ReactNode; testId?: string; lifted?: boolean }) {
  const H = lifted ? "h3" : "h4";
  return (
    <section className={register === "founding" ? "border-t border-notice/30 pt-5" : "border-t border-border pt-4"} data-testid={testId}>
      <H className={register === "founding" ? "font-display text-xl text-card-foreground" : "font-display text-lg font-bold text-card-foreground"}>{heading}</H>
      <div className="mt-2 text-card-foreground">{children}</div>
    </section>
  );
}

function Lines({ lines }: { lines: string[] }) {
  if (lines.length === 1 && !/^[^:]{1,60}: \S/.test(lines[0])) return <p className="leading-relaxed">{lines[0]}</p>;
  return <LabelledBullets lines={lines} />;
}

export interface FullRoleCardProps {
  /** The role as `/api/org` sent it. */
  seat: Record<string, any>;
  /** The circle it sits in, by name. */
  circleName?: string | null;
  register?: CardRegister;
  /** The founding sections when the host already holds them; read here otherwise. */
  sections?: RoleCardSections | null;
  /** The id of the heading that names the card, when the host draws it. */
  labelledBy?: string;
  /** Whether the card draws its own title (the founding section does; the directory row header names it). */
  showTitle?: boolean;
  /** The village's pay shape when the host already holds it; read here otherwise. */
  villagePay?: VillagePay | null;
  /**
   * One heading level up: the title is an h2 and its sections h3. For a host whose own heading is the
   * page's h1 (the founding team leading /roles), so the outline never skips a level (axe heading-order).
   */
  lifted?: boolean;
  /** Something under each piece of the founding card (the applicant's suggestions). */
  after?: (pieceKey: string) => ReactNode;
  /** No Apply act: the card is read inside an application or by the people deciding one. */
  noAct?: boolean;
  /** Open every piece at once (a decider reads the suggestions beside all of them). */
  allPieces?: boolean;
  /** How many suggestions each piece carries, for the dot on its rail chip. */
  marks?: (pieceKey: string) => number;
  /** The share the applicant chose, while they apply: the focus line follows it (shared/focusLine.ts). */
  commitmentChosen?: number | null;
  /** The role's own page, `/roles/<slug>`: the card offers "Copy link" to it in its footer (the lead, 20 Nov 2026). */
  sharePath?: string;
}

export default function FullRoleCard({ seat: givenSeat, circleName = null, register = "game", sections: given, labelledBy, showTitle = true, villagePay: givenPay = null, lifted = false, after, noAct = false, allPieces = false, marks, commitmentChosen = null, sharePath }: FullRoleCardProps) {
  const H3 = lifted ? "h2" : "h3";
  const H4 = lifted ? "h3" : "h4";
  const { t, i18n } = useLingui();
  const id = String(givenSeat?.id ?? "");
  const { locale } = useLocale();
  const [answer, setAnswer] = useState<RoleCardAnswer | null>(null);
  useEffect(() => {
    let live = true;
    if (!id) return;
    void readRoleCard(id, locale).then((a) => live && setAnswer(a));
    return () => {
      live = false;
    };
  }, [id, locale]);

  const village = useVillageName("The village");
  // Mid-sentence, before the config lands: "What the village needs from you".
  const villageInSentence = useVillageName();
  // The card in the reader's language where it has been translated (Rye, 15 Nov 2026), English elsewhere.
  const translation = answer?.translation && answer.translation.locale === locale ? answer.translation : null;
  const seat = overlaySeat(givenSeat, translation);
  const machine = (translation?.machine.length ?? 0) > 0;
  const read = overlaySections(answer?.sections ?? given ?? null, translation);
  // How rewards work: the village's shape on every card, the card's own where it wrote one (lead, 11 Nov).
  // Shown with the village's token names on its shares (the lead, 19 Nov 2026: never "equity"); `rawShape` is the
  // shape as stored, which the split control sends and the server checks a proposal against.
  const villagePay = answer?.villagePay ?? givenPay ?? NO_VILLAGE_PAY;
  const shareNames = useShareNames();
  const shownShape = (shape: readonly PayShare[]): PayShare[] => shape.map((sh) => ({ ...sh, label: shareLabelFor(sh.label, shareNames) }));
  const pay = cardPay(read ? { ...read, payShape: shownShape(read.payShape) } : read, { ...villagePay, shape: shownShape(villagePay.shape) });
  const rawShape = cardPay(read, villagePay)?.shape ?? [];
  // RANGES STAY HIDDEN whatever the role data holds: the server leaves the range out while the village
  // keeps it hidden, and the card drops it again here so an older payload can never draw one.
  const showsRange = answer?.showPayRanges === true;
  const ranged = showsRange || !seat?.card?.publicPay ? seat : { ...seat, card: { ...seat.card, publicPay: undefined } };
  // Where, in the card's own words (sections.where), in place of the listing's land or remote label.
  const params = read?.where ? { ...ranged, card: { ...(ranged.card ?? {}), whereText: read.where } } : ranged;
  const founding = register === "founding";
  // The role's own lines under "What {village} needs from you", and its goal line lifted into the one-minute summary.
  // The village's shared lines stand apart above them, as a banner (the lead, 20 Nov 2026).
  const ownNeeds = asLines(seat.whyItMatters).flatMap((l) => l.split(/\r?\n/)).map((l) => l.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s+/, "").trim()).filter(Boolean);
  const { goal, rest: needsLines } = goalOf(ownNeeds);
  const words: Array<{ key: string; heading: string; lines: string[] }> = [
    // "What {village} needs from you" (the lead, 19 Nov 2026): goals and deadlines, one bullet per line.
    { key: "whyItMatters", heading: t({ message: `What ${villageInSentence} needs from you`, context: "full role card heading" }), lines: needsLines },
    { key: "domain", heading: W.decide, lines: asLines(seat.domain) },
    { key: "authorities", heading: W.authorities, lines: asLines(seat.authorities) },
    { key: "accountabilities", heading: W.countOnMe, lines: asLines(seat.accountabilities) },
    { key: "responsibilities", heading: W.responsibilities, lines: asLines(seat.responsibilities) },
  ].filter((w) => w.lines.length > 0);
  const bringMe = asLines(seat.bringMe);
  // Bring me beside what the role decides and delivers (the lead, 19 Nov 2026): after the accountabilities, or last.
  const bringBlock = bringMe.length ? [{ key: "bringMe", heading: W.bringMe, lines: bringMe }] : [];
  const gameWords = words.some((w) => w.key === "accountabilities") ? words.flatMap((w) => (w.key === "accountabilities" ? [w, ...bringBlock] : [w])) : [...words, ...bringBlock];
  const notMine = asLines(seat.notMine);
  const holding = [
    { key: "signsStretched", heading: W.signsStretched, text: asText(seat.signsStretched) },
    { key: "flowsBack", heading: W.flowsBack, text: asText(seat.flowsBack) },
    { key: "stepBack", heading: W.stepBack, text: asText(seat.stepBack) },
  ].filter((h) => h.text);
  const aim = asText(seat.aim);
  const existsWhile = asText(seat.existsWhile);
  // One commitment line (QA2-16): the role's terms say it as a percent in the details below, so the
  // free text is drawn only on a card whose terms name none.
  const commitmentPct: number | null = Number.isInteger(seat?.card?.commitmentPct) ? (seat.card.commitmentPct as number) : null;
  const commitment = commitmentPct !== null ? null : asText(seat.timeCommitment);
  // The focus line (Rye, 15 Nov 2026): the qualities' token drawn for the commitment this card shows.
  // The card's own slider (CardCommitment.tsx), when the reader has one: the words below follow it.
  const [sliderPct, setSliderPct] = useState<number | null>(null);
  const focusPct = shownCommitment(sliderPct ?? commitmentChosen, seat?.card?.commitmentMin ?? null, commitmentPct);
  const sections = read ? { ...read, qualities: withFocusLine(i18n, read.qualities, village, focusPct) } : null;
  const roots = Array.isArray(seat.archetypes) ? seat.archetypes.map(String) : [];
  const apply = !noAct && mayApply(seat);
  // The commitment slider and the split (the lead, 17 Nov 2026): what the reader chooses rides the Apply link.
  const [choiceLink, setChoiceLink] = useState("");
  const [waitOpen, setWaitOpen] = useState(false);
  const last = answer?.lastEdited ?? null;
  const wide = useWide();

  // A coming-soon role leads to its waitlist (the lead, 19 Nov 2026): the notice and "Notify me", never Apply.
  const soon = !noAct && seat?.comingSoon === true && seat?.futureVenture !== true && seat?.state !== "filled";
  const act = soon ? (
    <div className="flex flex-col gap-3" data-card-waitlist={id}>
      <StateNote role={seat} />
      {waitOpen ? (
        <Suspense fallback={null}>
          <WaitlistForm roles={[{ id, name: String(seat?.name ?? "") }]} chosen={id} />
        </Suspense>
      ) : (
        <button type="button" className={`w-full ${BTN_PRIMARY}`} onClick={() => setWaitOpen(true)}>
          {t({ message: "Notify me", context: "coming-soon waitlist: the button" })}
        </button>
      )}
    </div>
  ) : apply ? (
    <>
      {/* Coming soon or a future venture (16 Nov 2026): applied for now, with the state's note. */}
      <StateNote role={seat} className="mb-3" />
      <Fireflies block>
        <Link href={applyHrefForRole(id, choiceLink)} className={`w-full ${BTN_PRIMARY}`} data-apply-role={id}>
          <Trans context="full role card: the one act">Apply for this role</Trans>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Fireflies>
    </>
  ) : !noAct ? (
    // Held by an agent alone: said, with no Apply and no name (Rye, 16 Nov 2026).
    <HeldByAgentLine role={seat} />
  ) : null;

  // THE POINT OF PAY, drawn once: in the founding card it is the "How rewards work" piece, whose
  // heading is the piece's own, so the block carries none. Only what the card holds is drawn: no
  // ceiling written, no ceiling line.
  // A role that can be shared (Rye, 14 Nov 2026, shared/roleRewardWords.ts): the full band, the range one person may
  // propose, and the proposal setting the pay. The figure is still the card's own ceiling.
  // Each share as its own amount when the card, or the village for a card that follows it, says so (`cardPay` reads which).
  // The callout says "Value in equals value out." beside the price, so a note that says it too drops that sentence (said once).
  const noteOnce = (pay?.note ?? "").replace(/(^|\s)value in equals value out\.?/i, " ").trim();
  const reward = sections?.payCeiling ? rewardWords(i18n, sections.payCeiling, seat?.card?.commitmentMin ?? null, noteOnce, pay?.shape ?? [], pay?.shares ?? [], sliderPct ?? commitmentChosen, shareNames) : null;
  // The band under the listed price, only while the village shows pay ranges (`showsRange`, as above).
  // Said once (the lead, 19 Nov 2026): where the card offers its commitment slider, the slider says the band at the
  // reader's own share (CommitmentPicker), so the band line under the listed price is drawn only where there is none.
  const slider = !noAct && rangeMin(seat?.card?.commitmentMin ?? null) < 100;
  const band = slider ? null : bandWords(i18n, seat?.card?.publicPay, showsRange);
  const shared = answer?.shared ?? NO_SHARED;
  const tips = useCardTips(shared.tips);
  // THE ROLE IN ONE MINUTE (the lead, 20 Nov 2026): the goal, the next three deliverables, commitment, price, where.
  const ceiling = sections?.payCeiling ?? null;
  const oneMinute = {
    goal: goal || aim,
    next: nextDeliverables(sections?.deliverables ?? [], todayIso()),
    // A role that can be shared says its range (Rye, 14 Nov 2026); a whole role says what it says today.
    commitment: typeof seat?.card?.commitmentMin === "number" ? commitmentRowWords(i18n, seat.card.commitmentMin) : commitmentPct !== null ? `${commitmentPct}%` : (commitment ?? ""),
    // The full role's figure, once; the Rewards tab works it out at the reader's own share.
    price: founding && ceiling ? (
      <>
        <MoonText text={perPeriod(i18n, moneyWords(ceiling.amount, ceiling.currency, i18n.locale), ceiling.per)} />{" "}
        <span className="font-normal text-muted-foreground">{t({ message: "for the full role", context: "role in one minute: after the price" })}</span>
      </>
    ) : null,
    where: roleCardView(params).rows.find((r) => r.id === "where")?.lines.join(", ") ?? "",
  };
  const payBlock = pay ? (
    <div className="flex flex-col gap-3" data-testid="pay-shape">
      {reward ? (
        <>
          <p className="font-display text-3xl leading-snug text-notice" data-testid="pay-ceiling"><TokenText text={reward.headline} plain={(x: string) => <MoonText text={x} />} /></p>
          {band && <p className="leading-relaxed text-card-foreground" data-testid="pay-band"><MoonText text={band} /></p>}
          <Suspense fallback={null}>
            <ValueCallout />
          </Suspense>
          {reward.range && <p className="leading-relaxed text-card-foreground" data-testid="pay-range-words">{reward.range}</p>}
          <p className="leading-relaxed text-card-foreground" data-testid="pay-proposal-words"><MoonText text={reward.proposal} /></p>
        </>
      ) : (
        <>
          {pay.ceiling && <p className="font-display text-3xl leading-snug text-notice" data-testid="pay-ceiling"><TokenText text={pay.ceiling} /></p>}
          {band && <p className="leading-relaxed text-card-foreground" data-testid="pay-band"><MoonText text={band} /></p>}
          <Suspense fallback={null}>
            <ValueCallout />
          </Suspense>
        </>
      )}
      {/* The village's shares as tiles only where the card offers no editable split (the lead, 18 Nov 2026): inside an
          application and for the people deciding. Elsewhere the split control below is the one place to read it. */}
      {pay.shape.length > 0 && noAct && (
        // Not aria-hidden since 19 Nov 2026: the contribution share's label carries its at-risk tip, which must be reachable.
        <ul className="grid grid-cols-3 gap-2" data-testid="pay-tiles">
          {pay.shape.map((sh) => (
            <li key={sh.label} className="min-w-0 rounded-xl border border-border bg-muted px-3 py-2">
              <span className="block break-words text-xs capitalize text-muted-foreground" data-testid="pay-tile-label"><ShareLabel label={sh.label} /></span>
              <span className="block font-display text-2xl text-card-foreground">{sh.pct}%</span>
            </li>
          ))}
        </ul>
      )}
      {pay.split && (() => {
        // The tiles already show the split, so its "Default split: ..." words are for screen readers only (the tiles
        // are aria-hidden); the card's own words after them stay in view (copy sweep, 15 Nov 2026: said once).
        // The card's own words, without a sentence that restates the split just said (production check of 1.3.24).
        const raw = sections?.paySplitNote ?? "";
        const own = splitNotRestated(raw);
        const said = raw && pay.split.endsWith(` ${raw}`) ? pay.split.slice(0, -(raw.length + 1)) : pay.split;
        const lead = pay.shape.length > 0 && own ? said : null;
        return (
          <p className="leading-relaxed text-card-foreground" data-testid="pay-split">
            {lead !== null ? (
              <>
                <span className="sr-only">{lead} </span>
                {own}
              </>
            ) : pay.shape.length > 0 && !own ? (
              <span className="sr-only">{said}</span>
            ) : (
              <TokenText text={own ? `${said} ${own}` : said} />
            )}
          </p>
        );
      })()}
      {!noAct && (
        <Suspense fallback={null}>
          <CardCommitment idPrefix={`card-${id}`} min={seat?.card?.commitmentMin ?? null} ceiling={sections?.payCeiling ?? null} shape={rawShape} publicPay={seat?.card?.publicPay} showsRange={showsRange} onChoice={setChoiceLink} onPct={setSliderPct} />
        </Suspense>
      )}
      {pay.atRisk && <p className="text-sm leading-relaxed text-card-foreground" data-testid="pay-at-risk"><TokenText text={pay.atRisk} /></p>}
      {reward && <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground" data-testid="pay-footnote"><TokenText text={reward.footnote} plain={(x: string) => <MoonText text={x} />} /></p>}
      {/* One footnote (copy sweep, 15 Nov 2026; steelman, 15 Nov): with a listed price, the note (the card's own, else
          the village's) is the footnote's fine print, so it is not drawn again here. */}
      {noteOnce && !reward && <p className={`${reward ? "" : "border-t border-border pt-3 "}text-xs leading-relaxed text-muted-foreground`} data-testid="pay-note"><TokenText text={noteOnce} /></p>}
    </div>
  ) : null;

  // On the founding card the companion sits under a piece's heading, one level further down.
  const CompanionH = founding ? (lifted ? "h4" : "h5") : H4;
  const companion =
    sections && (sections.aiSupport || sections.aiCompanion) ? (
      <section data-testid="ai-support">
        <CompanionH className={founding ? "mb-2 text-xs font-semibold uppercase tracking-widest text-notice" : "font-display text-lg font-bold text-card-foreground"}><TipText text={SECTION_WORDS.aiSupport} /></CompanionH>
        <div className="mt-2 flex items-start gap-3 text-card-foreground">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-notice/50">
            <AnimalIcon name={sections.aiCompanion} />
          </span>
          <div>
            {sections.aiCompanion && <p className="font-semibold">{sections.aiCompanion}</p>}
            {sections.aiSupport && <p className="leading-relaxed">{sections.aiSupport}</p>}
          </div>
        </div>
      </section>
    ) : null;

  const footer = (
    <footer className={`flex flex-wrap items-center justify-between gap-3 border-t border-border ${founding ? "px-5 py-4 sm:px-7" : "mt-6 pt-4"}`}>
      <p className={HINT} data-testid="last-edited">
        {last ? SECTION_WORDS.lastEdited(last.by, civilDayWords(last.on)) : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {sharePath && !seat.isExample && (
          <Suspense fallback={null}>
            <SeatLinkCopy path={sharePath} seatName={String(seat?.name ?? "")} bare />
          </Suspense>
        )}
        {!seat.isExample && <EditRoleButton roleId={id} onSaved={() => window.location.reload()} />}
      </div>
    </footer>
  );

  // A PHONE'S THUMB (the lead, 20 Nov 2026; the roles lane's idea 11): the one act rides the bottom of the screen in a
  // bar while the card is read. It is the card's last child, so it is reached last by the keyboard, after everything it
  // sits over, and its own slot at the end of the card means the last lines scroll clear of it. On a desktop the act
  // sits in the summary (founding) or the side column (directory).
  const phoneBar = !wide && act && (
    <div
      className={`sticky bottom-[var(--tabbar-h,0px)] z-20 border-t border-notice/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 ${founding ? "px-5 py-3" : "-mx-4 mt-6 px-4 py-3 sm:-mx-6 sm:px-6"}`}
      data-phone-apply-bar=""
    >
      {act}
    </div>
  );

  // THE FOUNDING CARD, PIECE BY PIECE (Rye, 14 Nov 2026; FoundingRoleCard.tsx): the role as a seat on
  // the left, the role in one minute and its words in five tabs on the right.
  if (founding) {
    // The founding card's own heading is one level below the title, so its companion heading is too.
    return (
      <CardTipsProvider tips={tips}>
      <article
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : String(seat?.name ?? "")}
        className="sheet-night overflow-clip rounded-2xl border border-notice/40 bg-card shadow-sm"
        data-full-role-card={id}
        data-register={register}
      >
        {machine && (
          <div className="px-5 pt-4 sm:px-7">
            <MachineTranslationMark />
          </div>
        )}
        <FoundingRoleCard
          seat={seat}
          circleName={circleName}
          sections={sections}
          params={params}
          lifted={lifted}
          aim={aim}
          existsWhile={existsWhile}
          words={words}
          bringMe={bringMe}
          notMine={notMine}
          holding={holding}
          commitmentPct={commitmentPct}
          commitment={commitment}
          pay={payBlock}
          companion={companion}
          act={act}
          wide={wide}
          after={after}
          allPieces={allPieces}
          marks={marks}
          shared={shared}
          oneMinute={oneMinute}
        />
        {footer}
        {phoneBar}
      </article>
      </CardTipsProvider>
    );
  }

  const side = (
    <div className="flex flex-col gap-5">
      {pay && (
        <section className="rounded-xl border border-border bg-card p-4" data-testid="pay-shape">
          <H4 className="font-display text-lg text-card-foreground">{SECTION_WORDS.payShape}</H4>
          {pay.ceiling && <p className="mt-2 font-display text-xl leading-snug text-notice" data-testid="pay-ceiling"><TokenText text={pay.ceiling} /></p>}
          {pay.split && <p className="mt-2 leading-relaxed text-card-foreground" data-testid="pay-split"><TokenText text={pay.split} /></p>}
          {pay.atRisk && <p className="mt-3 text-sm leading-relaxed text-card-foreground" data-testid="pay-at-risk"><TokenText text={pay.atRisk} /></p>}
          {pay.note && <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground" data-testid="pay-note"><TokenText text={pay.note} /></p>}
        </section>
      )}
      {commitment && (
        <p className="text-card-foreground">
          <span className={EYEBROW}>{W.timeCommitment}</span>
          <span className="mt-1 block">{commitment}</span>
        </p>
      )}
      <RoleCardParams seat={params} />
      {wide && act}
    </div>
  );

  return (
    <CardTipsProvider tips={tips}>
    <article
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : String(seat?.name ?? "")}
      className={founding ? "sheet-night rounded-2xl border border-notice/40 bg-card p-5 shadow-sm sm:p-8" : "sheet-night rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"}
      data-full-role-card={id}
      data-register={register}
    >
      <header className="flex flex-col gap-2">
        {/* "Paid" is said once, by "This role is rewarded" under the title (QA2-16). */}
        {circleName && <p className={EYEBROW}>{circleName}</p>}
        {showTitle && <H3 className={founding ? "font-display text-3xl leading-tight text-card-foreground sm:text-4xl" : "font-display text-2xl text-card-foreground"}>{String(seat?.name ?? "")}</H3>}
        {machine && <MachineTranslationMark />}
        {/* The roots it grows from, drawn by RootTags (RootsSlot.tsx). */}
        <RootsSlot roots={roots} />
        {sections?.paid && (
          <p className="font-semibold text-notice" data-testid="paid-role-line">{paidRoleLine(i18n)}</p>
        )}
      </header>

      <div className={`mt-5 grid gap-6 ${founding ? "lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10" : "lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8"}`}>
        <div className="flex min-w-0 flex-col gap-5 break-words">
          {/* The role in one minute (the lead, 20 Nov 2026). The price and the act stay in the side column here. */}
          <RoleOneMinute {...oneMinute} as={H4} act={null} />
          {aim && (
            <section className="rounded-xl border-l-4 border-notice bg-muted px-4 py-3" data-testid="purpose">
              <H4 className={EYEBROW}>{W.purpose}</H4>
              <p className={founding ? "mt-1 font-display text-xl leading-snug text-card-foreground sm:text-2xl" : "mt-1 text-lg text-card-foreground"}>{aim}</p>
              {existsWhile && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {W.existsWhile} {existsWhile}
                </p>
              )}
            </section>
          )}
          {/* The village's goal as a banner, above what the village needs from this role (the lead, 20 Nov 2026). */}
          <VillageGoalBanner lines={shared.lines} as={H4} />
          {gameWords.map((w) => (
            <Block key={w.key} heading={w.heading} register={register} lifted={lifted} testId={`words-${w.key}`}>
              <Lines lines={w.lines} />
            </Block>
          ))}
          {((sections?.deliverables?.length ?? 0) > 0 || shared.rhythm.length > 0) && (
            <Suspense fallback={null}>
              <GameCardExtras part="top" deliverables={sections?.deliverables ?? []} rhythm={shared.rhythm} onboarding={[]} block={(heading, testId, body) => <Block heading={heading} register={register} lifted={lifted} testId={testId}>{body}</Block>} />
            </Suspense>
          )}
          {sections && sections.idealBackground.length > 0 && (
            <Block heading={SECTION_WORDS.idealBackground} register={register} lifted={lifted} testId="ideal-background">
              <Lines lines={sections.idealBackground} />
            </Block>
          )}
          {sections && sections.qualities.length > 0 && (
            <Block heading={SECTION_WORDS.qualities} register={register} lifted={lifted} testId="qualities">
              <Lines lines={sections.qualities} />
            </Block>
          )}
          {sections && (sections.aiSupport || sections.aiCompanion) && (
            <Block heading={SECTION_WORDS.aiSupport} register={register} lifted={lifted} testId="ai-support">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-notice/50">
                  <AnimalIcon name={sections.aiCompanion} />
                </span>
                <div>
                  {sections.aiCompanion && <p className="font-semibold">{sections.aiCompanion}</p>}
                  {sections.aiSupport && <p className="leading-relaxed">{sections.aiSupport}</p>}
                </div>
              </div>
            </Block>
          )}
          {holding.length > 0 && (
            <Block heading={W.holdingWell} register={register} lifted={lifted} testId="holding-well">
              <dl className="grid gap-3 sm:grid-cols-3">
                {holding.map((h) => (
                  <div key={h.key}>
                    <dt className="text-sm font-semibold text-muted-foreground">{h.heading}</dt>
                    <dd className="mt-0.5 leading-relaxed">{h.text}</dd>
                  </div>
                ))}
              </dl>
            </Block>
          )}
          {notMine.length > 0 && (
            <Block heading={circleName ? t({ message: `Goes to the ${circleName}`, context: "role card: what goes to the circle for consent" }) : t({ message: "Goes to the circle", context: "role card: what goes to the circle for consent" })} register={register} lifted={lifted} testId="words-notMine">
              <Lines lines={notMine} />
            </Block>
          )}
          {onboardingFor(sections?.onboarding, shared).length > 0 && (
            <Suspense fallback={null}>
              <GameCardExtras part="end" deliverables={[]} rhythm={[]} onboarding={onboardingFor(sections?.onboarding, shared)} block={(heading, testId, body) => <Block heading={heading} register={register} lifted={lifted} testId={testId}>{body}</Block>} />
            </Suspense>
          )}
        </div>
        <div className="lg:sticky lg:top-28 lg:self-start">{side}</div>
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className={HINT} data-testid="last-edited">
          {last ? SECTION_WORDS.lastEdited(last.by, civilDayWords(last.on)) : ""}
        </p>
        {!seat.isExample && <EditRoleButton roleId={id} onSaved={() => window.location.reload()} />}
      </footer>
      {phoneBar}
    </article>
    </CardTipsProvider>
  );
}
