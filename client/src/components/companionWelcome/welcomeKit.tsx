/**
 * The welcome's shared pieces (CompanionWelcome.tsx): the browser voice, the
 * speech bubble, the egg, the pet, the bursts and the class strings.
 */
import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";
import { Trans } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { PetDrawing } from "@/components/profileDash/CompanionPet";
import { prefersReducedMotion } from "@/components/natural/useReducedMotion";
import type { PetKind, PetTint } from "@shared/companionItems";
import type { Character } from "@shared/companionPersona";

export const MIC_LINE = "The mic uses your browser's speech service (Google, Apple or Microsoft) to turn speech into text. Typing always works.";

/** The egg's colour and the hatched pet's body follow the character (the Hatchery mockup). */
export const TINT_OF: Record<Character, PetTint> = { sidekick: "gold", elder: "lilac", plain: "leaf", poet: "lilac", coach: "leaf", trickster: "rose" };
export const TINT_VAR: Record<PetTint, string> = {
  gold: "var(--color-dash-gold)",
  leaf: "var(--color-dash-voice)",
  rose: "var(--color-dash-thanks)",
  lilac: "var(--color-dash-session)",
};

export async function send(path: string, method: string, body?: unknown): Promise<{ ok: boolean; json: any }> {
  try {
    const r = await gameFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    let json: any = null;
    try {
      json = await r.json();
    } catch {
      json = null;
    }
    return { ok: r.ok, json };
  } catch {
    return { ok: false, json: null };
  }
}

// ── speaking aloud: the browser's own voice ─────────────────────────────────

export function useSpeech(on: boolean, character: Character) {
  const can = typeof window !== "undefined" && "speechSynthesis" in window;
  const cancel = useCallback(() => {
    if (can) window.speechSynthesis.cancel();
  }, [can]);
  const speak = useCallback(
    (text: string, onStart?: () => void, onEnd?: () => void) => {
      if (!on || !can) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = ({ plain: 1.1, coach: 1.08, elder: 0.9, poet: 0.92 } as Partial<Record<Character, number>>)[character] ?? 1;
        u.pitch = character === "sidekick" || character === "trickster" ? 1.25 : 1;
        u.onstart = () => onStart?.();
        u.onend = () => onEnd?.();
        window.speechSynthesis.speak(u);
      } catch {
        /* a browser with no voice still shows every word */
      }
    },
    [on, can, character],
  );
  useEffect(() => cancel, [cancel]);
  return { speak, cancel, can };
}

// ── a modal that is modal ───────────────────────────────────────────────────

/**
 * While `on`, every other child of <body> is inert: a keyboard or screen reader
 * cannot leave the welcome for the page behind it, which is what aria-modal
 * promises. Siblings that were inert already are left as they were.
 */
export function useInertOutside(root: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const me = root.current;
    if (!on || !me) return;
    const held: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === me || el.contains(me) || el.hasAttribute("inert")) continue;
      el.setAttribute("inert", "");
      held.push(el);
    }
    return () => held.forEach((el) => el.removeAttribute("inert"));
  }, [root, on]);
}

/** Focus back where it was, if it is still on the page. */
export function refocus(el: Element | null | undefined): boolean {
  if (el instanceof HTMLElement && el.isConnected && el !== document.body) {
    el.focus();
    return true;
  }
  return false;
}

// ── small pieces ────────────────────────────────────────────────────────────

/**
 * The keyboard ring every welcome control shows, the same one the sheet's
 * gold and outlined buttons carry (dashUi).
 */
export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * A new `text` replays the fade on the words alone, so a control passed in as
 * children (the tour's Next) is never remounted and keeps its focus. `live`
 * reads the new words out to a screen reader whose focus stayed on that control.
 */
export function Bubble({ who, text, speak, quiet, live, children }: { who: string; text: string; speak: ReturnType<typeof useSpeech>["speak"]; quiet: boolean; live?: boolean; children?: ReactNode }) {
  const [talking, setTalking] = useState(false);
  const say = useCallback(() => speak(text, () => setTalking(true), () => setTalking(false)), [speak, text]);
  useEffect(() => {
    const t = window.setTimeout(say, 250);
    return () => window.clearTimeout(t);
  }, [say]);
  return (
    <div className={`cw-fade rounded-[18px] rounded-bl-md border border-dash-edge bg-dash-raised px-3.5 py-3 text-[15px] leading-normal text-foreground ${talking ? "cw-speaking" : ""}`}>
      <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-dash-gold">
        <span>{who}</span>
        <span className="cw-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {!quiet ? (
          <button type="button" onClick={say} className={`ml-auto min-h-7 rounded-full border border-dash-edge px-2 py-0.5 text-xs normal-case tracking-normal text-dash-voice ${FOCUS}`}>
            <Trans context="companion welcome">Hear again</Trans>
          </button>
        ) : null}
      </div>
      <div aria-live={live ? "polite" : undefined}>
        <p key={text} className="cw-fade m-0">
          {text}
        </p>
      </div>
      {children}
    </div>
  );
}

export function Egg({ tint, small }: { tint: PetTint; small?: boolean }) {
  return <div className={`cw-egg ${small ? "cw-small" : ""}`} style={{ ["--cw-egg" as string]: TINT_VAR[tint] }} aria-hidden="true" />;
}

export function Pet({ kind, tint, size, motion }: { kind: PetKind; tint: PetTint; size: number; motion: string }) {
  return (
    <span className={`inline-block ${motion}`}>
      <PetDrawing kind={kind} tint={tint} size={size} />
    </span>
  );
}

export const CHIP_BASE = `min-h-10 rounded-full border px-3 py-2 text-[13px] ${FOCUS}`;
export const chip = (on: boolean) => `${CHIP_BASE} ${on ? "border-dash-gold bg-dash-gold font-semibold text-dash-gold-ink" : "border-dash-edge bg-card text-foreground"}`;
export const INPUT = "min-h-11 w-full min-w-0 rounded-[14px] border border-dash-edge bg-background px-3 text-[15px] text-foreground";
export const MIC_CLASS = "!size-11 !rounded-full border border-dash-edge !bg-card !text-dash-voice";

export function confetti(n: number) {
  if (prefersReducedMotion()) return;
  const box = document.createElement("div");
  box.className = "cw-confetti";
  box.setAttribute("aria-hidden", "true");
  const cols = ["--color-dash-gold", "--color-dash-gold-lit", "--color-dash-voice", "--color-dash-thanks", "--color-dash-session"];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = `var(${cols[i % cols.length]})`;
    p.style.animationDelay = `${Math.random() * 0.8}s`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  window.setTimeout(() => box.remove(), 3400);
}

export function burst(x: number, y: number) {
  if (prefersReducedMotion()) return;
  const cols = ["--color-dash-gold-lit", "--color-dash-voice", "--color-dash-thanks"];
  for (let i = 0; i < 14; i++) {
    const b = document.createElement("span");
    const a = (i / 14) * Math.PI * 2;
    b.className = "cw-burst";
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    b.style.background = `var(${cols[i % 3]})`;
    b.style.setProperty("--dx", `${Math.cos(a) * 70}px`);
    b.style.setProperty("--dy", `${Math.sin(a) * 70}px`);
    document.body.appendChild(b);
    window.setTimeout(() => b.remove(), 950);
  }
}
