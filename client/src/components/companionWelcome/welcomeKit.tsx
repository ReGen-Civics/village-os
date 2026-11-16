/**
 * The welcome's shared pieces (CompanionWelcome.tsx): the spoken voice, the
 * speech bubble, the egg, the pet, the bursts and the class strings.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Trans } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { PetDrawing } from "@/components/profileDash/CompanionPet";
import { prefersReducedMotion } from "@/components/natural/useReducedMotion";
import type { PetKind, PetTint } from "@shared/companionItems";
import type { Character } from "@shared/companionPersona";
import { msg } from "@lingui/core/macro";
import { pickBrowserVoice } from "@/lib/voice/pickBrowserVoice";

/**
 * WHERE THE SPOKEN WORDS GO (coordinator, 15 Nov 2026). The voice picker
 * (lib/voice/pickBrowserVoice.ts) prefers Edge's Natural voices and Chrome's
 * Google voices, which are online voices: the browser sends the words to be
 * spoken to its own service. Said wherever speaking aloud is offered, beside
 * MIC_LINE, which says the same of the mic.
 */
export const SPEAK_LINE = msg({ message: "Speaking aloud may use your browser's online voice (Google or Microsoft), which sends the words I say to that service. Quiet keeps them on your screen only.", context: "companion welcome, the spoken voice" });

export const MIC_LINE = msg({ message: "The mic uses your browser's speech service (Google, Apple or Microsoft) to turn speech into text. Typing always works.", context: "companion welcome, the mic" });

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

// ── speaking aloud: the best voice the device has ──────────────────────────

/** How long to wait for a browser that loads its voice list late (Chrome) before speaking with its default. */
export const VOICES_WAIT_MS = 800;

/** A steady, unhurried pace. Character shows in the words; the voice stays natural, at pitch 1. */
const RATE: Record<Character, number> = { sidekick: 1, trickster: 1, plain: 1, coach: 1, elder: 0.95, poet: 0.97 };

function voicesNow(synth: SpeechSynthesis): SpeechSynthesisVoice[] {
  try {
    return typeof synth.getVoices === "function" ? synth.getVoices() ?? [] : [];
  } catch {
    return [];
  }
}

/**
 * Calls `go` once the voice list is ready, or after VOICES_WAIT_MS, whichever is
 * first. A browser that cannot report its voices (or a test stub) goes at once.
 * Returns a cancel.
 */
function whenVoicesReady(synth: SpeechSynthesis, go: () => void): () => void {
  if (typeof synth.getVoices !== "function" || voicesNow(synth).length > 0 || typeof synth.addEventListener !== "function") {
    go();
    return () => {};
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    synth.removeEventListener?.("voiceschanged", finish);
    go();
  };
  const timer = window.setTimeout(finish, VOICES_WAIT_MS);
  synth.addEventListener("voiceschanged", finish);
  return () => {
    done = true;
    window.clearTimeout(timer);
    synth.removeEventListener?.("voiceschanged", finish);
  };
}

export function useSpeech(on: boolean, character: Character) {
  const can = typeof window !== "undefined" && "speechSynthesis" in window && !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined";
  const pending = useRef<() => void>(() => {});
  const cancel = useCallback(() => {
    pending.current();
    pending.current = () => {};
    if (can) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* nothing to stop */
      }
    }
  }, [can]);
  const speak = useCallback(
    (text: string, onStart?: () => void, onEnd?: () => void) => {
      if (!on || !can) return;
      const synth = window.speechSynthesis;
      try {
        pending.current();
        synth.cancel();
      } catch {
        /* nothing to stop */
      }
      pending.current = whenVoicesReady(synth, () => {
        pending.current = () => {};
        try {
          const u = new SpeechSynthesisUtterance(text);
          // The voice speaks the language the page is in, so a Spanish line is never read by an English voice (Spanish phone QA, 15 Nov 2026).
          const lang = document.documentElement.lang;
          if (lang) u.lang = lang;
          // The kindest installed voice for that language (Edge "Natural", Apple "Premium", Google), never Windows David or Zira when anything else exists.
          const voice = pickBrowserVoice(voicesNow(synth), lang || "en");
          if (voice) {
            u.voice = voice;
            if (!lang) u.lang = voice.lang;
          }
          u.rate = RATE[character] ?? 1;
          u.pitch = 1;
          u.onstart = () => onStart?.();
          u.onend = () => onEnd?.();
          synth.speak(u);
        } catch {
          /* a browser with no voice still shows every word */
        }
      });
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
