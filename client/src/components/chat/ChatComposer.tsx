/**
 * THE BOX YOU TALK TO A COMPANION IN, shared by every companion and guide chat
 * (the lead, 27 Nov 2026: "This dialogue box should grow as I'm filling it out
 * so I can see it until it takes up 2/3 the screen").
 *
 * - It starts at one line, at least 44px, and grows with each line until it
 *   holds about two thirds of what is still visible (the visual viewport, so a
 *   phone's keyboard and the tab bar count), or half its panel where it sits in one (0.4 on a phone).
 *   Past that it scrolls inside itself and keeps the caret in view.
 * - On a desk Enter sends and Shift+Enter adds a line. On a phone Return adds a
 *   line and the Send button sends.
 * - Send waits while the box is empty, over its limit, or a reply is coming.
 *   After a send the box is one line again.
 * - The voice button (MicButton) sits beside it wherever the browser can
 *   listen. Each finished phrase lands in the box and nothing sends by itself.
 *   The browser's speech service does the listening; MicButton says where the
 *   sound goes.
 * - Near the limit a quiet count shows under it.
 *
 * The draft itself is the call site's (useChatDraft in ./chatDraft keeps it
 * per conversation), so a closed panel opens on the same words.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Send } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import MicButton from "@/components/MicButton";
import { appendSpoken } from "@/components/journal/GrowingTextarea";
import { growHeight } from "@/components/form/GrowingField";
import { useFieldName } from "@/components/form/fieldName";
import { useKeyboardInset } from "./keyboardInset";

/** One line, never under a finger's 44px. */
export const MIN_HEIGHT = 44;
/** How much of the visible screen the box may take before it scrolls. */
export const SHARE = 2 / 3;
/** With a phone keyboard up, Send moves beside the box only when the box keeps this much of the row. */
const BESIDE_SHARE = 0.6;
/** The count shows from here on (80% of the limit). */
const NEAR = 0.8;

/**
 * Inside a corner panel the box takes at most half the panel: the panel also holds its title and the conversation,
 * and two thirds of a panel that is itself 70% of the screen left the last reply one line tall (screenshots, 27 Nov 2026).
 */
export const PANEL_SHARE = 1 / 2;
/** On a phone a corner panel is narrower and taller per line: 0.4 keeps the last reply readable (QA round 1, 27 Nov 2026). */
export const PANEL_SHARE_NARROW = 0.4;

/** The tallest the box may grow: two thirds of what is visible, or a share of its panel when that is less. */
export function composerCap(visible: number, panel?: number, share = SHARE, panelShare = PANEL_SHARE): number {
  const room = panel && panel > 0 ? Math.min(visible * share, panel * panelShare) : visible * share;
  return Math.max(MIN_HEIGHT, Math.floor(room));
}

/** The height to draw for a box whose text needs `natural` pixels, and whether it must scroll inside. */
export function fitTo(natural: number, cap: number): { height: number; scrolls: boolean } {
  const height = Math.min(Math.max(natural, MIN_HEIGHT), cap);
  return { height, scrolls: natural > cap };
}

/**
 * Whether this key press sends. Return on a phone adds a line; so does Shift+Enter anywhere, and a key
 * mid-composition. Where Enter is kept for new lines everywhere (`plain`, the journal), Ctrl or Cmd+Enter sends.
 */
export function enterSends(
  e: { key: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; isComposing?: boolean },
  phone: boolean,
  plain = false,
): boolean {
  if (e.key !== "Enter" || e.isComposing || e.shiftKey) return false;
  if (phone || plain) return Boolean(e.ctrlKey || e.metaKey);
  return true;
}

/** A touch screen with no mouse: the keyboard on screen has a Return key and no Shift habit. */
export function isPhoneKeyboard(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/** The phone's tab bar, measured from its own height (`--tabbar-h` in index.css, 0 from md up). */
function tabBarHeight(): number {
  try {
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.setAttribute("data-tabbar-probe", "");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--tabbar-h, 0px)";
    document.body.appendChild(probe);
    const h = probe.offsetHeight || 0;
    probe.remove();
    return h;
  } catch {
    return 0;
  }
}

/** The nearest box that scrolls the composer (a sheet, a panel's body), or null where the page itself scrolls. */
function scrollBox(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if (y === "auto" || y === "scroll") return p;
  }
  return null;
}

/**
 * The part of the screen the composer can be seen in, top and bottom in viewport pixels: the visual viewport (so a
 * phone's keyboard is taken off), above the tab bar, and inside the box that scrolls it.
 */
export function visibleRoom(el: HTMLElement): { top: number; bottom: number } {
  const vv = window.visualViewport;
  let top = vv?.offsetTop || 0;
  // The visual viewport's foot, or the tab bar's top when that is higher. With a keyboard up the bar is under it.
  let bottom = Math.min(top + (vv?.height || window.innerHeight || 0), (window.innerHeight || 0) - tabBarHeight());
  const box = scrollBox(el);
  if (box) {
    const r = box.getBoundingClientRect();
    if (r.height > 0) {
      top = Math.max(top, r.top);
      bottom = Math.min(bottom, r.bottom);
    }
  }
  return { top, bottom: Math.max(top, bottom) };
}

/** The panel's own ceiling: its max-height when it has one, else its height. */
function panelHeight(el: HTMLElement | null | undefined): number | undefined {
  if (!el) return undefined;
  const max = parseFloat(getComputedStyle(el).maxHeight);
  if (Number.isFinite(max) && max > 0) return max;
  return el.getBoundingClientRect().height || undefined;
}

/** Room left under Send, so it never sits flush on the tab bar or the keyboard (0.5rem). */
const SEND_MARGIN = 8;

/** Whether the composer sits in a panel pinned to the screen, where scrolling the page behind could only move the page. */
function insideFixed(el: HTMLElement): boolean {
  for (let p: HTMLElement | null = el; p && p !== document.body; p = p.parentElement) {
    if (getComputedStyle(p).position === "fixed") return true;
  }
  return false;
}

/**
 * Bring the box's row, Send included, into sight above the keyboard and the tab bar, by exactly as much as it is
 * hidden. The nearest box that scrolls moves (a sheet, a panel's body); the page moves only where the page itself is
 * what scrolls the composer, and never behind a pinned panel (QA round 1 on #1885: the page behind the companions
 * sheet jumped 527px, and Send landed under the tab bar).
 */
export function keepSendInView(row: HTMLElement): void {
  const over = row.getBoundingClientRect().bottom - (visibleRoom(row).bottom - SEND_MARGIN);
  if (over <= 0) return;
  const box = scrollBox(row);
  if (box) box.scrollTop += over;
  else if (!insideFixed(row)) window.scrollBy?.(0, over);
}

export const FIELD_CLASS =
  "rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 pointer-fine:text-sm";
export const SEND_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-notice text-background hover:bg-notice/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function ChatComposer({
  id,
  value,
  onChange,
  onSend,
  label,
  labelClassName = "sr-only",
  placeholder,
  maxLength,
  busy = false,
  disabled = false,
  sendLabel,
  sendText,
  sendClassName = SEND_CLASS,
  fieldClassName = FIELD_CLASS,
  within,
  mic = true,
  inputRef,
  className = "",
  enterSends: enterSendsHere = true,
  minRows = 1,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  /** Called by Enter on a desk and by the Send button. The call site clears the draft when it has sent. */
  onSend: () => void;
  /** The box's name, shown or read (`labelClassName`, sr-only unless the page shows it). */
  label: ReactNode;
  labelClassName?: string;
  placeholder?: string;
  maxLength?: number;
  /** A reply is on its way: Send waits. */
  busy?: boolean;
  /** The chat cannot take words yet (no consent, no key): the box and its buttons wait. */
  disabled?: boolean;
  /** Send's accessible name. */
  sendLabel: string;
  /** Words on the Send button; without them it shows the paper-plane icon. */
  sendText?: ReactNode;
  sendClassName?: string;
  fieldClassName?: string;
  /** The panel the box sits in, so it grows to two thirds of the panel rather than the screen. */
  within?: RefObject<HTMLElement | null>;
  mic?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  className?: string;
  /** False keeps Enter for a new line on every device (the journal); Ctrl or Cmd+Enter and the Send button send. */
  enterSends?: boolean;
  /** The rows the box starts at. */
  minRows?: number;
}) {
  const { t } = useLingui();
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? own;
  const row = useRef<HTMLDivElement>(null);
  const fieldName = useFieldName(ref);
  // A phone's keyboard is up: the docked panels lift above it (keyboardInset.ts), and the browser shows the box being
  // written in, so Send rides on the box's row too (QA round 2 on #1885). Only where the box keeps most of the width:
  // a worded Send beside it left the role companion's box 137px wide, and the lead asked to see what he writes.
  const keyboardUp = useKeyboardInset() > 0 && isPhoneKeyboard();
  const tools = useRef<HTMLDivElement>(null);
  const [roomBeside, setRoomBeside] = useState(true);
  useLayoutEffect(() => {
    if (!keyboardUp) return;
    const width = row.current?.clientWidth ?? 0;
    const used = (tools.current?.offsetWidth ?? 0) + 8;
    setRoomBeside(width === 0 || width - used >= width * BESIDE_SHARE);
  }, [keyboardUp]);
  const beside = keyboardUp && roomBeside;
  // The latest words, so two phrases finished in one breath both land.
  const latest = useRef(value);
  latest.current = value;

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Hold the row's height while the box is measured, so the page under it never jumps.
    const hold = row.current;
    const was = el.offsetHeight;
    // Where the buttons sit under the box (a narrow panel), their row comes out of the box's share too.
    const below = hold ? Math.max(0, hold.offsetHeight - was) : 0;
    if (hold) hold.style.minHeight = `${hold.offsetHeight}px`;
    el.style.overflowY = "hidden";
    el.style.height = "auto";
    if (el.scrollHeight > 0) {
      const natural = growHeight(el.scrollHeight, el.offsetHeight, el.clientHeight);
      const panel = panelHeight(within?.current);
      const room = visibleRoom(hold ?? el);
      const panelShare = window.innerWidth < 640 ? PANEL_SHARE_NARROW : PANEL_SHARE;
      const { height, scrolls } = fitTo(natural, composerCap(room.bottom - room.top - below, panel ? panel - below : undefined, SHARE, panelShare));
      el.style.height = `${height}px`;
      el.style.overflowY = scrolls ? "auto" : "hidden";
      // Writing at the end: the newest line stays in sight inside the box.
      if (scrolls && el.selectionEnd === el.value.length) el.scrollTop = el.scrollHeight;
    }
    if (hold) hold.style.minHeight = "";
    // Grown while being written in or spoken into: Send stays above the keyboard and the tab bar. The nearest box
    // that scrolls moves (a sheet, never the page behind it), and only as far as it must (QA round 1 on #1885).
    if (hold && el.offsetHeight > was && hold.contains(document.activeElement)) keepSendInView(hold);
  }, [ref, within]);

  useLayoutEffect(fit, [value, fit]);

  // The keyboard rising, a turned phone, or a new width: fit again, and while somebody is writing, Send stays in sight.
  useEffect(() => {
    const vv = window.visualViewport;
    const refit = () => {
      fit();
      const hold = row.current;
      if (hold?.contains(document.activeElement)) keepSendInView(hold);
    };
    vv?.addEventListener("resize", refit);
    window.addEventListener("resize", refit);
    const el = ref.current;
    let width = el?.clientWidth ?? 0;
    const watch =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (el.clientWidth === width) return;
            width = el.clientWidth;
            fit();
          })
        : null;
    if (el) watch?.observe(el);
    return () => {
      vv?.removeEventListener("resize", refit);
      window.removeEventListener("resize", refit);
      watch?.disconnect();
    };
  }, [fit, ref]);

  const over = maxLength ? Math.max(0, value.length - maxLength) : 0;
  const canSend = !busy && !disabled && value.trim().length > 0 && over === 0;
  const send = () => {
    if (canSend) onSend();
  };
  const heard = (chunk: string) => {
    const next = appendSpoken(latest.current, chunk);
    latest.current = next;
    onChange(next);
  };

  const near = maxLength ? value.length >= Math.floor(maxLength * NEAR) : false;
  const countId = `${id}-count`;
  const used = value.length.toLocaleString();
  const max = (maxLength ?? 0).toLocaleString();
  const trim = over.toLocaleString();
  const count = near ? (
    <p id={countId} className={`m-0 mt-1 text-right text-xs tabular-nums ${over ? "font-semibold text-foreground" : "text-muted-foreground"}`} data-composer-count="">
      {over
        ? t({ message: `${used} / ${max} characters. Trim ${trim} to send.`, context: "chat composer, the count over the limit" })
        : t({ message: `${used} / ${max} characters`, context: "chat composer, the count near the limit" })}
    </p>
  ) : null;

  return (
    <div className={`@container ${className}`}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      {/* Beside the box where there is room; under it, at the right, in a narrow panel or on a phone, so the box keeps the width. */}
      <div
        ref={row}
        data-composer-row={beside ? "beside" : undefined}
        className={beside ? "flex flex-row items-end gap-2" : "flex flex-col gap-2 @min-[22rem]:flex-row @min-[22rem]:items-end"}
      >
        <textarea
          ref={ref}
          id={id}
          rows={minRows}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          enterKeyHint={isPhoneKeyboard() || !enterSendsHere ? "enter" : "send"}
          aria-describedby={near ? countId : undefined}
          aria-invalid={over ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          // A tapped box brings itself into view, and Send under it on a phone stays out of sight: bring the row.
          onFocus={() => {
            if (row.current) keepSendInView(row.current);
          }}
          onKeyDown={(e) => {
            const keys = { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, isComposing: e.nativeEvent.isComposing };
            if (!enterSends(keys, isPhoneKeyboard(), !enterSendsHere)) return;
            e.preventDefault();
            send();
          }}
          data-chat-composer=""
          className={`min-h-11 w-full min-w-0 resize-none whitespace-pre-wrap break-words ${beside ? "flex-1" : "@min-[22rem]:flex-1"} ${fieldClassName}`}
        />
        <div ref={tools} className="flex shrink-0 items-end justify-end gap-2">
          {mic ? <MicButton onText={heard} disabled={disabled} fieldName={fieldName} /> : null}
          <button type="button" onClick={send} disabled={!canSend} aria-label={sendText ? undefined : sendLabel} className={sendClassName}>
            {sendText ?? <Send className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {count}
    </div>
  );
}
