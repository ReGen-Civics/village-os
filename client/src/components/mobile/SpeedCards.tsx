/**
 * YOUR SPEED CARDS: the six quick cards at the top of the phone's More sheet, the member's own to choose (the lead,
 * 27 Nov 2026: "make these top 6 cards customizable ... by holding down on a card ... it can open up the edit
 * function (just like on iPhone) to add or remove a card and remake their 6 speed cards").
 *
 *   A card      a door to a page the menu offers this member (lib/speedCards/registry.ts), or a registered card
 *               (lib/speedCards/registered.ts). Messages and My tasks carry the member's own counts.
 *   "+"         an open slot. A tap opens the picker (SpeedCardPicker.tsx): search, or browse by the menu's groups.
 *   Edit        three ways in, so nobody depends on a long press: hold a card about half a second (a ring fills
 *               while you hold), right-click it, or press Edit beside the heading. In edit mode each card shows a
 *               remove badge and move left and right buttons, cards drag to a new place, "+" slots stay, and Done
 *               saves. Escape leaves without saving. Reset puts the defaults back.
 *   Motion      entering edit mode gives the cards one short wiggle that settles inside 600ms (docs/DESIGN_RULE.md,
 *               rule 10: motion never loops beside text). With reduced motion there is no wiggle; each card wears a
 *               dashed gold outline instead.
 *   Kept        on the server in the member's own prefs, so the cards follow them (useSpeedCards.ts), and in this
 *               browser for an instant first paint.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChevronLeft, ChevronRight, ListChecks, MessagesSquare, NotebookPen, Plus, UserRound, X } from "lucide-react";
import MenuIcon from "@/components/nav/MenuIcon";
import { navWord, type NavEntry, type NavGroup, type NavLink } from "@/config/nav";
import { TASK_BOARD_PATH } from "@shared/taskMenu";
import type { SpeedCardSlots } from "@shared/speedCards";
import { buildRegistry, defaultSlots, moveSlot, placeAt, removeAt, resolveSlots, sixSlots, type SpeedCard, type SpeedCardDef } from "@/lib/speedCards/registry";
import { cardLabel, REGISTERED_CARDS, type RegisteredCard } from "@/lib/speedCards/registered";
import { useSpeedCards } from "@/lib/speedCards/useSpeedCards";

const TaskCountBadge = lazy(() => import("@/components/tasks/TaskCountBadge"));
const MessageCountBadge = lazy(() => import("@/components/messages/MessageCountBadge"));
const SpeedCardPicker = lazy(() => import("./SpeedCardPicker"));

/** A card's glyph where the page icons (config/routeIcons.ts) have none for its address. */
const FALLBACK: Record<string, ComponentType<{ className?: string }>> = {
  "/profile": UserRound,
  "/messages": MessagesSquare,
  [TASK_BOARD_PATH]: ListChecks,
  "/journal": NotebookPen,
};

/** How long a press must hold to open edit mode. */
export const HOLD_MS = 500;
/** A press that moves further than this is a scroll or a drag, never a hold. */
const SLOP_PX = 10;

const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Asks one registered card's rule, and reports the answer. One per card, in a fixed order, so the hooks stay in order. */
function Probe({ card, onAnswer }: { card: RegisteredCard; onAnswer: (id: string, shown: boolean) => void }) {
  const shown = card.useShown ? card.useShown() : true;
  useEffect(() => onAnswer(card.id, shown), [card.id, shown, onAnswer]);
  return null;
}

export interface SpeedCardsProps {
  who: string;
  entries: readonly NavEntry[];
  itemsOf: (group: NavGroup) => NavLink[];
  account: readonly (NavLink & { count?: "tasks" | "messages" })[];
  /** The page being read, so its card is marked. */
  here?: string | null;
  onClose: () => void;
  /** The addresses on the cards now, so the sheet's list below leaves them out. */
  onShown?: (hrefs: string[]) => void;
}

export default function SpeedCards({ who, entries, itemsOf, account, here, onClose, onShown }: SpeedCardsProps) {
  const { t, i18n } = useLingui();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const onAnswer = useMemo(() => (id: string, shown: boolean) => setAnswers((a) => (a[id] === shown ? a : { ...a, [id]: shown })), []);
  const registered: SpeedCardDef[] = REGISTERED_CARDS.filter((c) => answers[c.id]).map((c) => ({ ...c, label: cardLabel(c, i18n) }));
  const words = {
    yours: t({ message: "Yours", context: "the phone's More sheet: heading" }),
    more: t({ message: "More", context: "the speed-card picker: a group for menu entries outside every group" }),
    sub: (folder: string) => navWord(folder, i18n),
  };
  const short = { "/profile": t({ message: "Profile", context: "the phone's More sheet: tile" }) };
  const reg = buildRegistry({ entries, itemsOf, account, registered, words, short });

  const kept = useSpeedCards(who);
  const base = kept.slots ?? defaultSlots(reg, registered);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SpeedCardSlots>(base);
  const current = editing ? draft : sixSlots(base);
  const cards = resolveSlots(current, reg);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [still] = useState(reducedMotion);
  const grid = useRef<HTMLUListElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const pickOpener = useRef<HTMLElement | null>(null);
  // Where focus goes after a change redraws the grid: the moved card's same arrow, or the slot a card left.
  const refocus = useRef<{ id: string; dir: "left" | "right" } | { open: number } | null>(null);
  useEffect(() => {
    const r = refocus.current;
    refocus.current = null;
    if (!r || !grid.current) return;
    if ("open" in r) {
      grid.current.querySelector<HTMLElement>(`[data-speed-open="${r.open}"]`)?.focus();
      return;
    }
    const box = Array.from(grid.current.querySelectorAll<HTMLElement>("[data-speed-card]")).find((el) => el.dataset.speedCard === r.id);
    const same = box?.querySelector<HTMLButtonElement>(`button[data-dir="${r.dir}"]`);
    (same && !same.disabled ? same : box?.querySelector<HTMLButtonElement>("button[data-dir]:not(:disabled)"))?.focus();
  });
  // Edit mode moves focus to Done as it opens and back to Edit as it closes, so the keyboard never falls to the page.
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing && !wasEditing.current) doneButton.current?.focus();
    if (!editing && wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const shownKey = cards.map((c) => c?.href ?? "").join("|");
  useEffect(() => {
    onShown?.(cards.flatMap((c) => (c?.href ? [c.href] : [])));
    // Read through its key: the same cards are the same answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  const enterEdit = () => {
    if (editing) return;
    setDraft(sixSlots(base));
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
    void kept.save(sixSlots(draft));
  };
  const cancel = () => {
    setEditing(false);
    setSaid("");
  };
  const reset = () => {
    setDraft(defaultSlots(reg, registered));
    setSaid(t({ message: "Your cards are back to the defaults. Press Done to keep them.", context: "the phone's More sheet: read aloud after Reset" }));
  };

  const total = current.length;
  const sayMoved = (card: string, place: number) =>
    setSaid(t({ message: `${card} moved to place ${place} of ${total}.`, context: "the phone's More sheet: read aloud after a card moves" }));
  const move = (from: number, to: number, dir: "left" | "right") => {
    if (to < 0 || to >= total) return;
    const card = cards[from];
    setDraft(moveSlot(current, from, to));
    if (card) {
      refocus.current = { id: card.id, dir };
      sayMoved(card.label, to + 1);
    }
  };
  const remove = (at: number) => {
    const card = cards[at]?.label ?? "";
    setSaid(t({ message: `${card} removed.`, context: "the phone's More sheet: read aloud after a card is removed" }));
    setDraft(removeAt(current, at));
    // The open slot takes the card's place; focus lands on it, so the next tab is never lost.
    refocus.current = { open: at };
  };
  const pick = (id: string) => {
    if (pickFor === null) return;
    const next = placeAt(current, pickFor, id);
    const card = reg.byId.get(id)?.label ?? "";
    setPickFor(null);
    setSaid(t({ message: `${card} added.`, context: "the phone's More sheet: read aloud after a card is added" }));
    if (editing) setDraft(next);
    else void kept.save(next);
    pickOpener.current?.focus();
  };

  // Drag to reorder, in edit mode: the card follows the finger from slot to slot.
  const drag = useRef<{ id: number; from: number; x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const onDragStart = (e: ReactPointerEvent<HTMLElement>, at: number) => {
    if (!editing || !cards[at] || (e.target as HTMLElement).closest("button")) return;
    drag.current = { id: e.pointerId, from: at, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < SLOP_PX) return;
    d.moved = true;
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

  const eyebrow = "text-xs font-semibold uppercase tracking-widest text-notice";
  const quietBtn = "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";
  return (
    <div
      data-speed-cards=""
      data-editing={editing ? "" : undefined}
      data-motion={still ? "still" : "moves"}
      onKeyDown={(e) => {
        // Escape leaves edit mode without saving, and leaves the sheet open; the sheet's own Escape waits for the next one.
        if (e.key === "Escape" && editing && pickFor === null) {
          e.stopPropagation();
          cancel();
        }
      }}
    >
      {REGISTERED_CARDS.map((c) => <Probe key={c.id} card={c} onAnswer={onAnswer} />)}
      {/* Clear of the sheet's close button, which hangs over this row's right end. */}
      <div className="flex items-center justify-between gap-2 pr-11">
        <h2 id="more-yours" className={eyebrow}><Trans context="the phone's More sheet: heading">Yours</Trans></h2>
        {editing ? (
          <span className="flex items-center gap-1">
            <button type="button" onClick={reset} className={quietBtn}><Trans context="the phone's More sheet: put the default cards back">Reset</Trans></button>
            <button ref={doneButton} type="button" onClick={done} className="inline-flex min-h-11 items-center rounded-lg bg-notice px-4 text-sm font-semibold text-background hover:bg-notice/90 focus-visible:outline-2 focus-visible:outline-ring">
              <Trans context="the phone's More sheet: save the cards and leave edit mode">Done</Trans>
            </button>
          </span>
        ) : (
          <button ref={editButton} type="button" onClick={enterEdit} aria-label={t({ message: "Edit your cards", context: "the phone's More sheet: the Edit button, read aloud" })} className={quietBtn}>
            <Trans context="the phone's More sheet: open edit mode for the cards">Edit</Trans>
          </button>
        )}
      </div>
      <ul ref={grid} className="mt-2 grid grid-cols-3 gap-2" aria-label={t({ message: "Your cards", context: "the phone's More sheet: the six cards, read aloud" })}>
        {cards.map((card, at) => (
          <li key={card ? card.id : `open-${at}`} data-slot={at} className="relative">
            {card ? (
              editing ? (
                <EditCard
                  card={card}
                  at={at}
                  last={current.length - 1}
                  still={still}
                  lifted={dragging === at}
                  onMove={move}
                  onRemove={remove}
                  onPointerDown={(e) => onDragStart(e, at)}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onPointerCancel={onDragEnd}
                />
              ) : (
                <Card card={card} who={who} current={!!here && here === card.href} onGo={onClose} onHold={enterEdit} />
              )
            ) : (
              <button
                type="button"
                data-speed-open={at}
                onClick={(e) => {
                  pickOpener.current = e.currentTarget;
                  setPickFor(at);
                }}
                aria-label={t({ message: "Add a card", context: "the phone's More sheet: an open slot, read aloud" })}
                className="flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border px-1.5 py-2.5 text-sm font-medium text-muted-foreground hover:border-notice hover:text-notice focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Plus aria-hidden="true" className="size-6" />
                <span className="leading-tight"><Trans context="the phone's More sheet: an open slot's word">Add</Trans></span>
              </button>
            )}
          </li>
        ))}
      </ul>
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
  const Icon = card.icon;
  return (
    <>
      {card.href ? <MenuIcon href={card.href} fallback={Icon ?? FALLBACK[card.href]} className="size-6 shrink-0" /> : Icon ? <Icon aria-hidden="true" className="size-6 shrink-0" /> : null}
      <span className="leading-tight">{card.label}</span>
      {who && card.count === "tasks" ? <Suspense fallback={null}><span className="absolute right-2 top-1.5"><TaskCountBadge who={who} /></span></Suspense> : null}
      {who && card.count === "messages" ? <Suspense fallback={null}><span className="absolute right-2 top-1.5"><MessageCountBadge who={who} /></span></Suspense> : null}
    </>
  );
}

const CARD = "relative flex min-h-[4.5rem] w-full select-none flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted px-1.5 py-2.5 text-center text-sm font-medium text-foreground [-webkit-touch-callout:none]";

/** A card at rest: a door, and a hold opens edit mode. */
function Card({ card, who, current, onGo, onHold }: { card: SpeedCard; who: string; current: boolean; onGo: () => void; onHold: () => void }) {
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

/** A card in edit mode: a remove badge, move left and right, and a drag handle (the whole card). */
function EditCard({
  card,
  at,
  last,
  still,
  lifted,
  onMove,
  onRemove,
  ...pointer
}: {
  card: SpeedCard;
  at: number;
  last: number;
  still: boolean;
  lifted: boolean;
  onMove: (from: number, to: number, dir: "left" | "right") => void;
  onRemove: (at: number) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const { t } = useLingui();
  const label = card.label;
  const arrow = "inline-flex h-11 flex-1 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30";
  return (
    <div
      data-speed-card={card.id}
      data-edit-card=""
      className={`${CARD} touch-none cursor-grab pb-0 ${still ? "outline-dashed outline-2 outline-offset-2 outline-notice/70" : ""} ${lifted ? "z-10 scale-105 shadow-sm" : ""}`}
      {...pointer}
    >
      <button
        type="button"
        onClick={() => onRemove(at)}
        aria-label={t({ message: `Remove ${label}`, context: "the phone's More sheet: a card's remove badge in edit mode, read aloud" })}
        className="absolute -left-2.5 -top-2.5 z-10 inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm">
          <X className="size-3.5" />
        </span>
      </button>
      <Face card={card} />
      <span className="mt-0.5 flex w-full">
        <button type="button" data-dir="left" onClick={() => onMove(at, at - 1, "left")} disabled={at === 0} aria-label={t({ message: `Move ${label} left`, context: "the phone's More sheet: move a card one place back, read aloud" })} className={arrow}>
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <button type="button" data-dir="right" onClick={() => onMove(at, at + 1, "right")} disabled={at === last} aria-label={t({ message: `Move ${label} right`, context: "the phone's More sheet: move a card one place on, read aloud" })} className={arrow}>
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </span>
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
 * A press held HOLD_MS without moving, or a right-click (a desktop's long press), calls `onHold`. The click that
 * ends a hold is swallowed (`consumed`), so holding a card never also opens its page.
 */
export function useHold(onHold: () => void) {
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
    fired.current = true;
    stop();
    onHold();
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
