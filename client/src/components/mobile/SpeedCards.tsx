/**
 * YOUR SPEED CARDS: the six quick cards at the top of the phone's More sheet, the member's own to choose (the lead,
 * 27 Nov 2026: "make these top 6 cards customizable ... by holding down on a card ... it can open up the edit
 * function (just like on iPhone) to add or remove a card and remake their 6 speed cards").
 *
 *   A card      a door to a page the menu offers this member (lib/speedCards/registry.ts), or a registered card
 *               (lib/speedCards/registered.ts). Messages and My tasks carry the member's own counts.
 *   "+"         an open slot. A tap opens the picker (SpeedCardPicker.tsx): search, or browse by the menu's groups.
 *   Edit        three ways in, so nobody depends on a long press: hold a card about half a second (a ring fills
 *               while you hold), right-click it, or press Edit beside the heading. The finger that ends a hold is
 *               swallowed, so lifting it never taps whatever edit mode drew under it.
 *   Edit mode   every card keeps its size and wears a dashed gold edge, with a remove badge in its corner. A tap
 *               picks a card; the strip under the grid moves the picked card left or right, and cards also drag to
 *               a new place. "+" slots stay. Done saves, Reset puts the defaults back, Escape leaves without
 *               saving wherever focus is, and a tap on any link in the sheet saves first.
 *   Motion      entering edit mode gives the cards one short wiggle that settles inside 600ms (docs/DESIGN_RULE.md,
 *               rule 10: motion never loops beside text). With reduced motion there is no wiggle. The dashed edge is
 *               the steady sign of edit mode for everyone.
 *   Waiting     on a device that has never drawn this member's cards, the slots stay quiet for up to 400ms while
 *               the server answers, and a registered card whose rule has not answered yet (Pay's credits check)
 *               holds its slot quietly instead of flashing "+".
 *   Kept        on the server in the member's own prefs, so the cards follow them (useSpeedCards.ts), and in this
 *               browser for an instant first paint.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import MenuIcon from "@/components/nav/MenuIcon";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW } from "@/components/journey/look";
import { navWord, type NavEntry, type NavGroup, type NavLink } from "@/config/nav";
import type { SpeedCardSlots } from "@shared/speedCards";
import { buildRegistry, defaultSlots, moveSlot, placeAt, removeAt, resolveSlots, sixSlots, type SpeedCard, type SpeedCardDef } from "@/lib/speedCards/registry";
import { cardLabel, REGISTERED_CARDS, type RegisteredCard } from "@/lib/speedCards/registered";
import { useSpeedCards } from "@/lib/speedCards/useSpeedCards";
import { fallbackGlyph } from "@/lib/speedCards/glyphs";

const TaskCountBadge = lazy(() => import("@/components/tasks/TaskCountBadge"));
const MessageCountBadge = lazy(() => import("@/components/messages/MessageCountBadge"));
const SpeedCardPicker = lazy(() => import("./SpeedCardPicker"));

/** How long a press must hold to open edit mode. */
export const HOLD_MS = 500;
/** How long a device with no copy of the cards keeps its slots quiet while the server answers. */
export const QUIET_MS = 400;
/** After the finger that ended a hold lifts, clicks are swallowed this much longer (the click follows the lift). */
const LIFT_MS = 50;
/** A press that moves further than this is a scroll or a drag, never a hold. */
const SLOP_PX = 10;

const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Swallow the click that the lifting finger makes after a hold opened edit mode. Edit mode draws other controls where
 * the finger rests, and without this the lift tapped them (QA round 1: a hold on Journal's top third, then lift,
 * swapped Profile and Messages). Capture phase on the document, so it runs before anything in the sheet; it lets go
 * LIFT_MS after the next pointerup, or after three seconds whatever happens.
 */
function swallowLift(): void {
  let until = Number.POSITIVE_INFINITY;
  // Inert after three seconds even if the timer that removes it never runs.
  const cap = Date.now() + 3000;
  const onClick = (e: MouseEvent) => {
    if (Date.now() > Math.min(until, cap)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const off = () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerup", onUp, true);
    document.removeEventListener("pointercancel", onUp, true);
  };
  const onUp = () => {
    until = Date.now() + LIFT_MS;
    window.setTimeout(off, LIFT_MS + 10);
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerup", onUp, true);
  document.addEventListener("pointercancel", onUp, true);
  window.setTimeout(off, 3000);
}

/** Asks one registered card's rule, and reports the answer (null: not known yet). One per card, in a fixed order. */
function Probe({ card, onAnswer }: { card: RegisteredCard; onAnswer: (id: string, shown: boolean | null) => void }) {
  const shown = card.useShown ? card.useShown() : true;
  useEffect(() => onAnswer(card.id, shown), [card.id, shown, onAnswer]);
  return null;
}

export interface SpeedCardsProps {
  who: string;
  entries: readonly NavEntry[];
  itemsOf: (group: NavGroup) => NavLink[];
  account: readonly NavLink[];
  /** The page being read, so its card is marked. */
  here?: string | null;
  onClose: () => void;
  /** The addresses on the cards now, so the sheet's list below leaves them out. */
  onShown?: (hrefs: string[]) => void;
}

type Refocus = { open: number } | { card: string } | { arrow: "left" | "right" };

export default function SpeedCards({ who, entries, itemsOf, account, here, onClose, onShown }: SpeedCardsProps) {
  const { t, i18n } = useLingui();
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const onAnswer = useMemo(() => (id: string, shown: boolean | null) => setAnswers((a) => (a[id] === shown ? a : { ...a, [id]: shown })), []);
  const registered: SpeedCardDef[] = REGISTERED_CARDS.filter((c) => answers[c.id] === true).map((c) => ({ ...c, label: cardLabel(c, i18n) }));
  // A registered card whose rule has not answered yet holds its slot quietly.
  const pending = new Set(REGISTERED_CARDS.filter((c) => answers[c.id] !== true && answers[c.id] !== false).map((c) => c.id));
  const defaultDefs: SpeedCardDef[] = REGISTERED_CARDS.filter((c) => answers[c.id] !== false).map((c) => ({ ...c, label: cardLabel(c, i18n) }));
  const words = {
    yours: t({ message: "Yours", context: "the phone's More sheet: heading" }),
    more: t({ message: "More", context: "the speed-card picker: a group for menu entries outside every group" }),
    sub: (folder: string) => navWord(folder, i18n),
  };
  const short = { "/profile": t({ message: "Profile", context: "the phone's More sheet: tile" }) };
  const reg = buildRegistry({ entries, itemsOf, account, registered, words, short });

  const kept = useSpeedCards(who);
  const base = kept.slots ?? defaultSlots(reg, defaultDefs, pending);
  const [patient, setPatient] = useState(!kept.known);
  useEffect(() => {
    if (!patient) return;
    const id = window.setTimeout(() => setPatient(false), QUIET_MS);
    return () => window.clearTimeout(id);
  }, [patient]);
  const quiet = !kept.known && patient;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SpeedCardSlots>(base);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const current = editing ? draft : sixSlots(base);
  const cards = resolveSlots(current, reg);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedAt = picked ? cards.findIndex((c) => c?.id === picked) : -1;
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [still] = useState(reducedMotion);
  const grid = useRef<HTMLUListElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const pickOpener = useRef<HTMLElement | null>(null);

  // Where focus goes after a change redraws the grid: the slot a card left, a card just added, or the strip's arrow.
  const refocus = useRef<Refocus | null>(null);
  useEffect(() => {
    const r = refocus.current;
    refocus.current = null;
    if (!r) return;
    if ("open" in r) grid.current?.querySelector<HTMLElement>(`[data-speed-open="${r.open}"]`)?.focus();
    else if ("card" in r) {
      const box = Array.from(grid.current?.querySelectorAll<HTMLElement>("[data-speed-card]") ?? []).find((el) => el.dataset.speedCard === r.card);
      (box?.matches("a,button") ? box : box?.querySelector<HTMLElement>("[data-speed-face]"))?.focus();
    } else {
      const same = strip.current?.querySelector<HTMLButtonElement>(`button[data-dir="${r.arrow}"]`);
      (same && !same.disabled ? same : strip.current?.querySelector<HTMLButtonElement>("button[data-dir]:not(:disabled)"))?.focus();
    }
  });
  // Edit mode moves focus to Done as it opens and back to Edit as it closes, so the keyboard never falls to the page.
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing && !wasEditing.current) doneButton.current?.focus();
    if (!editing && wasEditing.current && !refocus.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const shownKey = cards.map((c) => c?.href ?? "").join("|");
  useEffect(() => {
    onShown?.(cards.flatMap((c) => (c?.href ? [c.href] : [])));
    // Read through its key: the same cards are the same answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  const enterEdit = (from?: string, byHold = false) => {
    if (editing) return;
    if (byHold) swallowLift();
    const slots = sixSlots(base);
    setDraft(slots);
    setPicked(from ?? resolveSlots(slots, reg).find((c) => c)?.id ?? null);
    setEditing(true);
    setSaid(t({ message: "Editing your cards. Drag a card, or use its arrows, to move it.", context: "the phone's More sheet: read aloud when edit mode opens" }));
    if (typeof navigator.vibrate === "function") navigator.vibrate(12);
  };
  // One short wiggle as edit mode opens, settled inside 600ms. Nothing moves with reduced motion.
  useEffect(() => {
    if (!editing || still) return;
    grid.current?.querySelectorAll<HTMLElement>("[data-speed-card]").forEach((el, i) => {
      if (typeof el.animate !== "function") return;
      el.animate(
        [{ transform: "rotate(0deg)" }, { transform: "rotate(-2.5deg)" }, { transform: "rotate(2.5deg)" }, { transform: "rotate(-1.5deg)" }, { transform: "rotate(0deg)" }],
        { duration: 520, delay: (i % 3) * 30, easing: "ease-in-out" },
      );
    });
  }, [editing, still]);

  const done = () => {
    setEditing(false);
    setSaid(t({ message: "Your cards are saved.", context: "the phone's More sheet: read aloud when edit mode closes" }));
    void kept.save(sixSlots(draftRef.current));
  };
  const cancel = () => {
    setEditing(false);
    setSaid("");
  };
  const reset = () => {
    setDraft(defaultSlots(reg, defaultDefs, pending));
    setSaid(t({ message: "Your cards are back to the defaults. Press Done to keep them.", context: "the phone's More sheet: read aloud after Reset" }));
  };

  // While editing: Escape leaves without saving wherever focus is (the picker's own Escape closes the picker first),
  // and a tap on any link in the sheet saves before it goes. Capture phase, ahead of the sheet's own Escape.
  const live = useRef({ done, cancel, pickOpen: false });
  live.current = { done, cancel, pickOpen: pickFor !== null };
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || live.current.pickOpen) return;
      e.stopPropagation();
      live.current.cancel();
    };
    const onLink = (e: MouseEvent) => {
      if (e.defaultPrevented || !(e.target instanceof Element) || !e.target.closest("a[href]")) return;
      live.current.done();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onLink, true);
    };
  }, [editing]);

  const total = current.length;
  const sayMoved = (card: string, place: number) =>
    setSaid(t({ message: `${card} moved to place ${place} of ${total}.`, context: "the phone's More sheet: read aloud after a card moves" }));
  const move = (dir: "left" | "right") => {
    const card = cards[pickedAt];
    const to = pickedAt + (dir === "left" ? -1 : 1);
    if (!card || to < 0 || to >= total) return;
    setDraft(moveSlot(current, pickedAt, to));
    refocus.current = { arrow: dir };
    sayMoved(card.label, to + 1);
  };
  const remove = (at: number) => {
    const gone = cards[at];
    const card = gone?.label ?? "";
    setSaid(t({ message: `${card} removed.`, context: "the phone's More sheet: read aloud after a card is removed" }));
    const next = removeAt(current, at);
    setDraft(next);
    if (gone?.id === picked) setPicked(resolveSlots(next, reg).find((c) => c)?.id ?? null);
    // The open slot takes the card's place; focus lands on it, so the next tab is never lost.
    refocus.current = { open: at };
  };
  const pick = (id: string) => {
    if (pickFor === null) return;
    const next = placeAt(current, pickFor, id);
    const card = reg.byId.get(id)?.label ?? "";
    setPickFor(null);
    setSaid(t({ message: `${card} added.`, context: "the phone's More sheet: read aloud after a card is added" }));
    if (editing) {
      setDraft(next);
      setPicked(id);
    } else void kept.save(next);
    // Focus lands on the new card, in the slot it was added to.
    refocus.current = { card: id };
  };

  // Drag to reorder, in edit mode: the card follows the finger from slot to slot.
  const drag = useRef<{ id: number; from: number; x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const onDragStart = (e: ReactPointerEvent<HTMLElement>, at: number) => {
    if (!editing || !cards[at] || (e.target as HTMLElement).closest("[data-remove]")) return;
    drag.current = { id: e.pointerId, from: at, x: e.clientX, y: e.clientY, moved: false };
  };
  const onDragMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < SLOP_PX) return;
      // Captured only once it is a drag, so a plain tap still reaches the card and picks it.
      e.currentTarget.setPointerCapture?.(e.pointerId);
      d.moved = true;
      setPicked(cards[d.from]?.id ?? null);
    }
    setDragging(d.from);
    const over = document.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>("[data-slot]");
    const to = over ? Number(over.dataset.slot) : -1;
    if (to >= 0 && to !== d.from) {
      setDraft((s) => moveSlot(s, d.from, to));
      d.from = to;
      setDragging(to);
    }
  };
  const onDragEnd = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    const card = d?.moved ? cards[d.from] : null;
    if (d && card) sayMoved(card.label, d.from + 1);
  };

  const pickedCard = pickedAt >= 0 ? cards[pickedAt] : null;
  // An open slot names its place, so a screen reader hears which of the six it is.
  const openSlotName = (place: number) => t({ message: `Add a card, place ${place} of ${total}`, context: "the phone's More sheet: an open slot, read aloud" });
  // Plain names, so the catalog reads "{label}, place {place} of {total}" and never "{0}".
  const label = pickedCard?.label ?? "";
  const place = pickedAt + 1;
  const arrow = `${BTN_SECONDARY} !px-3`;
  return (
    <div data-speed-cards="" data-editing={editing ? "" : undefined} data-motion={still ? "still" : "moves"}>
      {REGISTERED_CARDS.map((c) => <Probe key={c.id} card={c} onAnswer={onAnswer} />)}
      {/* Clear of the sheet's close button, which hangs over this row's right end. */}
      <div className="flex items-center justify-between gap-2 pr-11">
        <h2 id="more-yours" className={EYEBROW}><Trans context="the phone's More sheet: heading">Yours</Trans></h2>
        {editing ? (
          <span className="flex items-center gap-2">
            <button type="button" onClick={reset} className={BTN_SECONDARY}><Trans context="the phone's More sheet: put the default cards back">Reset</Trans></button>
            <button ref={doneButton} type="button" onClick={done} className={BTN_PRIMARY}>
              <Trans context="the phone's More sheet: save the cards and leave edit mode">Done</Trans>
            </button>
          </span>
        ) : (
          <button ref={editButton} type="button" onClick={() => enterEdit()} disabled={quiet} aria-label={t({ message: "Edit your cards", context: "the phone's More sheet: the Edit button, read aloud" })} className={BTN_SECONDARY}>
            <Trans context="the phone's More sheet: open edit mode for the cards">Edit</Trans>
          </button>
        )}
      </div>
      <ul ref={grid} className="mt-2 grid grid-cols-3 gap-2" aria-busy={quiet || current.some((s) => !!s && pending.has(s)) || undefined} aria-label={t({ message: "Your cards", context: "the phone's More sheet: the six cards, read aloud" })}>
        {cards.map((card, at) => {
          const id = current[at];
          const waiting = quiet || (!card && !!id && pending.has(id));
          return (
            <li key={card ? card.id : waiting ? `wait-${at}` : `open-${at}`} data-slot={at} className="relative">
              {waiting ? (
                <div data-speed-wait="" aria-hidden="true" className="min-h-[4.5rem] rounded-xl border border-border/50 bg-muted/50" />
              ) : card ? (
                editing ? (
                  <EditCard
                    card={card}
                    at={at}
                    picked={picked === card.id}
                    lifted={dragging === at}
                    onPick={setPicked}
                    onRemove={remove}
                    onPointerDown={(e) => onDragStart(e, at)}
                    onPointerMove={onDragMove}
                    onPointerUp={onDragEnd}
                    onPointerCancel={onDragEnd}
                  />
                ) : (
                  <Card card={card} who={who} current={!!here && here === card.href} onGo={onClose} onHold={(byHold) => enterEdit(card.id, byHold)} />
                )
              ) : (
                <button
                  type="button"
                  data-speed-open={at}
                  onClick={(e) => {
                    pickOpener.current = e.currentTarget;
                    setPickFor(at);
                  }}
                  aria-label={openSlotName(at + 1)}
                  className="flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border px-1.5 py-2.5 text-sm font-medium text-muted-foreground hover:border-notice hover:text-notice focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Plus aria-hidden="true" className="size-6" />
                  <span className="leading-tight"><Trans context="the phone's More sheet: an open slot's word">Add</Trans></span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {editing ? (
        <div ref={strip} data-move-strip="" className="mt-2 flex items-center gap-2">
          <button
            type="button"
            data-dir="left"
            onClick={() => move("left")}
            disabled={!pickedCard || pickedAt === 0}
            aria-label={pickedCard ? t({ message: `Move ${label} left`, context: "the phone's More sheet: move a card one place back, read aloud" }) : t({ message: "Move left", context: "the phone's More sheet: the move strip with no card picked, read aloud" })}
            className={arrow}
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <p className="min-w-0 flex-1 text-center text-xs leading-snug text-muted-foreground">
            {pickedCard ? (
              <span className="block font-semibold text-foreground">
                {t({ message: `${label}, place ${place} of ${total}`, context: "the phone's More sheet: the move strip, the picked card and its place" })}
              </span>
            ) : null}
            <Trans context="the phone's More sheet: the move strip's hint in edit mode">Drag a card, or use its arrows.</Trans>
          </p>
          <button
            type="button"
            data-dir="right"
            onClick={() => move("right")}
            disabled={!pickedCard || pickedAt === total - 1}
            aria-label={pickedCard ? t({ message: `Move ${label} right`, context: "the phone's More sheet: move a card one place on, read aloud" }) : t({ message: "Move right", context: "the phone's More sheet: the move strip with no card picked, read aloud" })}
            className={arrow}
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">{said}</p>
      {kept.failed ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          <Trans context="the phone's More sheet: a save of the cards did not reach the server">Saved on this device only. Your other devices keep your last cards.</Trans>
        </p>
      ) : null}
      {pickFor !== null ? (
        <Suspense fallback={null}>
          <SpeedCardPicker
            reg={reg}
            kept={current.filter((s): s is string => !!s && reg.byId.has(s))}
            onPick={pick}
            onClose={() => {
              setPickFor(null);
              pickOpener.current?.focus();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

/** What a card shows: its glyph, its name, and its count. */
function Face({ card, who }: { card: SpeedCard; who?: string }) {
  const Icon = fallbackGlyph(card);
  return (
    <>
      {card.href ? <MenuIcon href={card.href} fallback={Icon} className="size-6 shrink-0" /> : <Icon aria-hidden="true" className="size-6 shrink-0" />}
      <span className="leading-tight">{card.label}</span>
      {who && card.count === "tasks" ? <Suspense fallback={null}><span className="absolute right-2 top-1.5"><TaskCountBadge who={who} /></span></Suspense> : null}
      {who && card.count === "messages" ? <Suspense fallback={null}><span className="absolute right-2 top-1.5"><MessageCountBadge who={who} /></span></Suspense> : null}
    </>
  );
}

const CARD = "relative flex min-h-[4.5rem] w-full select-none flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted px-1.5 py-2.5 text-center text-sm font-medium text-foreground [-webkit-touch-callout:none]";
/**
 * Edit mode's steady sign, for everyone: a dashed edge in full gold (3:1 or better on the paper, QA round 2), drawn
 * 10px inside the card, clear of the paper skin's torn edge (seaChart.css tears a bordered tile 9px deep). A span of
 * its own, never the button's ::after: on a touch screen index.css owns every button's ::after for the 44px tap
 * overlay (top 50%, full size), which would draw the edge at the very rim, where the paper's tear hides it.
 */
const EDIT_EDGE = "pointer-events-none absolute inset-2.5 rounded-md border-2 border-dashed border-notice";
/**
 * The paper the card stands on. The light sea-chart skin dresses `.bg-muted.border.rounded-xl` and skips buttons
 * (seaChart.css), so an edit card is a skinned box with a transparent button filling it (QA round 2: edit cards went
 * flat beige).
 */
const PAPER = "relative rounded-xl border border-border bg-muted";
// The paper's 1px border above and below is inside the card's 72px, so the button inside is 2px shorter (QA round 3:
// filled cards measured 74px in edit mode against 72px at rest).
const FILL ="relative flex min-h-[calc(4.5rem-2px)] w-full select-none flex-col items-center justify-center gap-1 rounded-xl bg-transparent px-1.5 py-2.5 text-center text-sm font-medium text-foreground [-webkit-touch-callout:none]";

/** A card at rest: a door, and a hold opens edit mode. */
function Card({ card, who, current, onGo, onHold }: { card: SpeedCard; who: string; current: boolean; onGo: () => void; onHold: (byHold: boolean) => void }) {
  const hold = useHold(onHold);
  const cls = `${CARD} hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-ring ${current ? "border-notice" : ""}`;
  const ring = hold.holding ? <HoldRing still={hold.still} /> : null;
  if (card.href) {
    return (
      <Link href={card.href} onClick={(e: React.MouseEvent) => (hold.consumed() ? e.preventDefault() : onGo())} data-more-tile={card.href} data-speed-card={card.id} aria-current={current ? "page" : undefined} className={cls} {...hold.handlers}>
        {ring}
        <Face card={card} who={who} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => (hold.consumed() ? undefined : card.action?.(onGo))} data-more-tile={card.id} data-speed-card={card.id} className={cls} {...hold.handlers}>
      {ring}
      <Face card={card} who={who} />
    </button>
  );
}

/** A card in edit mode: the same size as at rest, a remove badge in its corner, a tap picks it, and it drags. */
function EditCard({
  card,
  at,
  picked,
  lifted,
  onPick,
  onRemove,
  ...pointer
}: {
  card: SpeedCard;
  at: number;
  picked: boolean;
  lifted: boolean;
  onPick: (id: string) => void;
  onRemove: (at: number) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const { t } = useLingui();
  const label = card.label;
  return (
    <div
      data-speed-card={card.id}
      data-edit-card=""
      className={`relative touch-none rounded-xl ${picked ? "outline-2 outline-offset-2 outline-notice" : ""} ${lifted ? "z-10 scale-105" : ""}`}
      {...pointer}
    >
      <div data-speed-paper="" className={PAPER}>
        <button
          type="button"
          data-speed-face=""
          aria-pressed={picked}
          onClick={() => onPick(card.id)}
          className={`${FILL} cursor-grab focus-visible:outline-2 focus-visible:outline-ring`}
        >
          <span aria-hidden="true" data-speed-edge="" className={EDIT_EDGE} />
          <Face card={card} />
        </button>
      </div>
      <button
        type="button"
        data-remove=""
        onClick={() => onRemove(at)}
        aria-label={t({ message: `Remove ${label}`, context: "the phone's More sheet: a card's remove badge in edit mode, read aloud" })}
        className="absolute -left-2.5 -top-2.5 z-10 inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm">
          <X className="size-3.5" />
        </span>
      </button>
    </div>
  );
}

/** The ring that fills while a card is held, so the member sees the hold working. Static with reduced motion. */
function HoldRing({ still }: { still: boolean }) {
  const [full, setFull] = useState(still);
  useEffect(() => {
    if (still) return;
    const id = requestAnimationFrame(() => setFull(true));
    return () => cancelAnimationFrame(id);
  }, [still]);
  return (
    <svg data-hold-ring="" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="14"
        pathLength={100}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeWidth="3"
        strokeDasharray="100"
        strokeDashoffset={full ? 0 : 100}
        className="stroke-notice"
        style={still ? undefined : { transition: `stroke-dashoffset ${HOLD_MS}ms linear` }}
      />
    </svg>
  );
}

/**
 * A press held HOLD_MS without moving, or a right-click (a desktop's long press), calls `onHold(true)`. The click that
 * ends a hold is swallowed (`consumed` here, and swallowLift for whatever edit mode draws under the finger), so
 * holding a card never also opens its page or taps a control.
 */
export function useHold(onHold: (byHold: boolean) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const [holding, setHolding] = useState(false);
  const [still] = useState(reducedMotion);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    setHolding(false);
  };
  useEffect(() => stop, []);
  const fire = () => {
    // A hold, or a contextmenu that arrives while a press is still down (Android's long press): the finger is still
    // on the glass, so its lift is guarded. Windows Chrome fires contextmenu after the right button comes up; nothing
    // is left to lift, and guarding would eat the member's next click (QA round 2).
    const pressed = start.current !== null;
    fired.current = true;
    stop();
    onHold(pressed);
  };
  return {
    holding,
    still,
    consumed: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
    handlers: {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        setHolding(true);
        timer.current = setTimeout(fire, HOLD_MS);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP_PX) stop();
      },
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        if (!fired.current) fire();
      },
    },
  };
}
