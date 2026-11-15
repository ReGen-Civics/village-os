/**
 * MEET YOUR COMPANION: the profile's guided welcome (approved design, 14 Nov
 * 2026, https://claude.ai/artifact/XoLYf926jtbpDGXrwr3zDb). Rye picked the mix:
 * the Hatchery egg (direction C) for the first beats, and the Shoulder Guide
 * tour (direction B) on the real profile.
 *
 *   0 arrival      the moon ring fills; "Speak aloud" or "Quiet" (nothing is said until then)
 *   1 name         the egg talks; say, type or pick a name
 *   2 personality  a character, three dials, how I like to be helped, sound
 *   3 lenses       optional private ingredients dropped into the egg
 *   4 family       the hatch, and one companion per role, each nameable
 *   5 tour         the companion hops across the real sections, one spotlight at a time
 *   6 moon         the moon promise: pay follows what you truly got done
 *   7 bonded       the badge, and the first question waiting
 *
 * Loaded only when it opens (CompanionWelcomeMount), so the first page stays light.
 *
 * Everything it keeps goes through the member's own routes (shared/companionPersona.ts):
 * the companion's name, look and persona, the private lenses, and which beat they reached.
 * Birth details for the Vedic Moon are read here and never sent: only the two numbers are.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { PetDrawing } from "@/components/profileDash/CompanionPet";
import { BTN_GOLD, BTN_LINE, KICKER } from "@/components/profileDash/dashUi";
import type { ProfileTab } from "@/components/profileDash/ProfileTabs";
import { prefersReducedMotion } from "@/components/natural/useReducedMotion";
import type { CompanionView, PetKind } from "@shared/companionItems";
import {
  CHARACTERS,
  CHARACTER_INFO,
  DEFAULT_PERSONA,
  DIAL_INFO,
  HELP_INFO,
  HELP_WAYS,
  WELCOME_BEATS,
  type LensId,
  type LensView,
  type Persona,
  type WelcomePayload,
  type WelcomeStatus,
} from "@shared/companionPersona";
import { Bubble, Egg, FOCUS, INPUT, MIC_LINE, Pet, TINT_OF, burst, chip, confetti, refocus, send, useInertOutside, useSpeech } from "./welcomeKit";
import { LensSheet, type SheetId } from "./LensSheet";
import { MoonPromise, NameBox } from "./WelcomeParts";
import "./companionWelcome.css";

const NAME_IDEAS = ["Pip", "Juniper", "Bramble", "Nova"];
/** The approved board's small buttons, for the footers. */
const SMALL = "!min-h-9 !px-3.5 !py-1.5 !text-[13px]";

// ── the tour's stops: real sections, found by their anchors ─────────────────

interface Stop {
  id: string;
  tab: ProfileTab;
  find: () => HTMLElement | null;
  say: (c: { first: string; name: string; mates: string }) => string;
  act: string;
}

const sectionOf = (id: string) => () => {
  const el = document.getElementById(id);
  return (el?.closest("section") as HTMLElement | null) ?? el;
};

const STOPS: Stop[] = [
  { id: "card", tab: "today", find: sectionOf("hero-name"), act: "Tap your ring", say: ({ first }) => `This is you, ${first}. Your portrait, your stage and your XP ring. Watch it fill as you play.` },
  { id: "today", tab: "today", find: sectionOf("today-h"), act: "Mark today's mood", say: () => "Today is your morning page. What's due, who's waiting on you, and one next step, always." },
  { id: "companions", tab: "quests", find: sectionOf("companions"), act: "Wave to us", say: ({ name, mates }) => `Here's where ${mates ? `${name}, ${mates}` : name} live. We ask a few questions a day and draft things for your yes. Nothing moves without you.` },
  { id: "tasks", tab: "quests", find: sectionOf("my-tasks"), act: "Cheer a task on", say: () => "Your tasks. Everything you do for the village lands here, even the surprise ones." },
  { id: "roles", tab: "roles", find: sectionOf("roles"), act: "Peek at your roles", say: () => "Your roles and how much of you each one gets. Change your commitment here whenever life changes." },
  { id: "progress", tab: "roles", find: sectionOf("powers-h"), act: "Unlock a glow", say: () => "Progression shows the powers you've unlocked. New ones glow when you earn them." },
  { id: "treasury", tab: "treasury", find: sectionOf("treasury"), act: "Open the purse", say: () => "The Treasury: cash owed to you and every token you hold. Every number has a story you can open." },
  { id: "moon", tab: "roles", find: sectionOf("my-moon"), act: "Fill the moon", say: () => "And the moon. We work moon to moon. When it's full, we look back at what you got done." },
];

// ── the welcome ─────────────────────────────────────────────────────────────

export interface CompanionWelcomeProps {
  firstName: string;
  companions: CompanionView[];
  payload: WelcomePayload;
  startBeat: number;
  /** Opens a phone tab, so the tour can find a section that lives on it. */
  onTab: (t: ProfileTab) => void;
  onClose: (status: WelcomeStatus, beat: number, companionName: string) => void;
}

/**
 * On document.body, so no parent's stacking context can put another overlay
 * (the profile's level-up moment, say) above the welcome.
 */
export default function CompanionWelcome(props: CompanionWelcomeProps) {
  return createPortal(<Welcome {...props} />, document.body);
}

function Welcome({ firstName, companions, payload, startBeat, onTab, onClose }: CompanionWelcomeProps) {
  const { t } = useLingui();
  /** What a dial's position means in words, for a screen reader (aria-valuetext). */
  const dialText = (v: number, lowWord: string, highWord: string): string => {
    const low = lowWord.toLowerCase();
    const high = highWord.toLowerCase();
    if (v <= 20) return lowWord;
    if (v < 45) return t({ message: `Leaning ${low}`, context: "companion welcome" });
    if (v <= 55) return t({ message: `Halfway between ${low} and ${high}`, context: "companion welcome" });
    if (v < 80) return t({ message: `Leaning ${high}`, context: "companion welcome" });
    return highWord;
  };
  const personal = companions.find((c) => c.scope === "personal") ?? null;
  const engineName = personal?.chatEngine ?? t({ message: `your guide`, context: "companion welcome" });
  const roles = companions.filter((c) => c.scope === "role" && c.status !== "retired");

  const [beat, setBeat] = useState(Math.max(0, Math.min(WELCOME_BEATS.length - 1, startBeat)));
  const [stop, setStop] = useState(0);
  const [name, setName] = useState(personal?.name ?? "");
  const [named, setNamed] = useState(false);
  const [persona, setPersona] = useState<Persona>(personal?.persona ?? DEFAULT_PERSONA);
  const [sample, setSample] = useState<string | null>(null);
  const [lenses, setLenses] = useState<LensView[]>(payload.lenses);
  const [gk, setGk] = useState(payload.geneKeys);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [roleNames, setRoleNames] = useState<Record<string, string>>(() => Object.fromEntries(roles.map((r) => [r.id, r.name])));
  const [roleSame, setRoleSame] = useState<Record<string, boolean>>(() => Object.fromEntries(roles.map((r) => [r.id, true])));
  const [quiet, setQuiet] = useState(false);
  const [wiggle, setWiggle] = useState(0);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const motion = reduced ? "" : "cw-bob";
  const pop = reduced ? "" : "cw-pop";
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Nothing is said aloud until the member has chosen: a screen reader is never
  // talked over by a voice nobody asked for. The arrival asks first (Speak aloud or
  // Quiet), and a welcome resumed before that choice asks again at the top.
  const [voiceChosen, setVoiceChosen] = useState(Boolean(personal?.persona));
  const chooseVoice = (aloud: boolean) => {
    setPersona((p) => ({ ...p, speak: aloud }));
    setQuiet(!aloud);
    setVoiceChosen(true);
  };
  const { speak, cancel } = useSpeech(voiceChosen && persona.speak && !quiet, persona.character);
  const cname = name.trim() || "your companion";
  const tint = TINT_OF[persona.character];
  // The egg stays lilac until a character is picked (the approved Hatchery board).
  const [picked, setPicked] = useState(Boolean(personal?.persona));
  const eggTint = picked ? tint : "lilac";
  const has = (l: LensId) => lenses.some((x) => x.lens === l);
  const kind: PetKind = gk?.guideUses ? "star" : has("vedic") ? "sprout" : "ears";
  const mates = roles.map((r) => roleNames[r.id] || r.name).join(" and ");

  const save = useCallback((b: number, status: WelcomeStatus) => void send("/api/me/companion-welcome", "PUT", { beat: b, status }), []);
  const patch = useCallback((id: string, body: Record<string, unknown>) => void send(`/api/me/companions/${id}`, "PATCH", body), []);

  const go = useCallback(
    (b: number) => {
      cancel();
      setBeat(b);
      setStop(0);
      if (b < WELCOME_BEATS.length - 1) save(b, "open");
    },
    [cancel, save],
  );

  const leave = useCallback(
    (status: WelcomeStatus) => {
      cancel();
      save(status === "done" ? WELCOME_BEATS.length - 1 : beat, status);
      onClose(status, beat, cname);
    },
    [beat, cancel, cname, onClose, save],
  );

  // The egg stage is modal: the page behind it is inert. The tour is not, since
  // it walks the real page.
  useInertOutside(rootRef, beat !== 5);

  // Hold the page still behind the egg; the tour needs it free to scroll.
  useEffect(() => {
    if (beat === 5) return;
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stageRef.current?.focus();
    return () => {
      document.body.style.overflow = was;
    };
  }, [beat]);

  const next = () => {
    if (beat === 2 && personal) patch(personal.id, { persona });
    if (beat === 3 && personal && personal.look.source === "choose") patch(personal.id, { look: { source: "choose", pet: kind, tint } });
    if (beat === 4) {
      for (const r of roles) {
        const n = (roleNames[r.id] ?? "").trim();
        const body: Record<string, unknown> = {};
        if (n && n !== r.name) body.name = n;
        if (roleSame[r.id]) body.persona = persona;
        if (Object.keys(body).length) patch(r.id, body);
      }
    }
    if (beat === 6) {
      save(WELCOME_BEATS.length - 1, "done");
      window.setTimeout(() => confetti(90), 200);
    }
    go(beat + 1);
  };

  const setNameNow = (n: string) => {
    const clean = n.trim().slice(0, 40);
    if (!clean) return;
    setName(clean);
    setNamed(true);
    setWiggle((w) => w + 1);
    if (personal) patch(personal.id, { name: clean });
  };

  // ── the tour ──
  const [spot, setSpot] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [stops, setStops] = useState<Stop[]>(STOPS);
  const spotEl = useRef<HTMLElement | null>(null);

  const measure = useCallback(() => {
    const el = spotEl.current;
    if (!el) return setSpot(null);
    const r = el.getBoundingClientRect();
    const dock = 230;
    const top = Math.max(8, r.top - 8);
    const height = Math.max(60, Math.min(r.bottom + 8, window.innerHeight - dock) - top);
    setSpot({ top, left: Math.max(4, r.left - 8), width: Math.min(window.innerWidth - 8, r.width + 16), height });
  }, []);

  const pruned = useRef(false);
  useEffect(() => {
    if (beat !== 5) return;
    // Sections this member's page never draws are left out before the first stop.
    if (!pruned.current) {
      pruned.current = true;
      const there = STOPS.filter((x) => x.find() !== null);
      if (there.length !== stops.length) {
        setStops(there.length ? there : STOPS);
        return;
      }
    }
    const s = stops[stop];
    if (!s) {
      // Every section dropped (or the last one went): the tour is over.
      if (stop >= stops.length) go(6);
      return;
    }
    onTab(s.tab);
    let alive = true;
    // One frame for the tab to show its sections, then find, scroll and light.
    const t = window.setTimeout(() => {
      if (!alive) return;
      const el = s.find();
      if (!el || el.offsetParent === null) {
        // A section this member's page does not show: drop the stop and carry on.
        setStops((all) => all.filter((x) => x.id !== s.id));
        return;
      }
      spotEl.current = el;
      // Below the site header and, on a phone, the sticky tab strip under it.
      const y = el.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 640 ? 150 : 110);
      window.scrollTo({ top: Math.max(0, y), behavior: reduced ? "auto" : "smooth" });
      window.setTimeout(measure, reduced ? 30 : 450);
    }, 60);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [beat, stop, stops, onTab, measure, reduced, go]);

  useEffect(() => {
    if (beat !== 5) return;
    const on = () => measure();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [beat, measure]);

  const tourNext = () => {
    cancel();
    if (stop < stops.length - 1) setStop(stop + 1);
    else go(6);
  };
  const tourBack = () => {
    cancel();
    if (stop > 0) setStop(stop - 1);
  };
  // Focus lives in the tour: on Next as it starts, and again whenever a stop
  // change took the focused control away (Back is gone on the first stop).
  const tourRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (beat !== 5) return;
    const t = window.setTimeout(() => {
      if (!tourRef.current?.contains(document.activeElement)) nextRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [beat, stop, stops]);

  // A closed lens sheet hands focus back to the lens that opened it.
  const sheetFrom = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (sheet === null && sheetFrom.current) {
      refocus(sheetFrom.current);
      sheetFrom.current = null;
    }
  }, [sheet]);

  const act = () => {
    if (spot) burst(spot.left + spot.width / 2, spot.top + Math.min(spot.height, 120) / 2);
    confetti(14);
    setWiggle((w) => w + 1);
  };

  // Keys: Escape is Skip for now; arrows walk the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches?.("input, select, textarea")) return;
      if (e.key === "Escape") {
        if (sheet) setSheet(null);
        else if (beat < 7) leave("skipped");
      }
      if (beat === 5 && e.key === "ArrowRight") tourNext();
      if (beat === 5 && e.key === "ArrowLeft") tourBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── the frame every egg beat shares ──
  const topbar = (
    <div className="absolute inset-x-3 top-2.5 z-30 flex items-center justify-between gap-2" inert={sheet ? true : undefined}>
      <div className="flex gap-1" aria-label={t({ message: `Step ${beat + 1} of ${WELCOME_BEATS.length}`, context: "companion welcome" })} role="img">
        {WELCOME_BEATS.map((b, i) => (
          <i key={b} className={`block h-1 w-4 rounded-sm ${i <= beat ? "bg-dash-gold" : "bg-white/20"}`} />
        ))}
      </div>
      <div className="flex gap-1.5">
        {/* Until the member has answered "Speak aloud or Quiet", that answer is the toggle. */}
        {voiceChosen ? (
          <button
            type="button"
            aria-pressed={quiet}
            onClick={() => {
              cancel();
              // Leaving quiet brings the voice back with the mic.
              if (quiet) setPersona((p) => ({ ...p, speak: true }));
              setQuiet((q) => !q);
            }}
            className={`min-h-8 whitespace-nowrap rounded-full border border-dash-edge bg-background/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-dash-gold hover:text-foreground ${FOCUS}`}
          >
            {quiet ? t({ message: `Quiet: on`, context: "companion welcome" }) : t({ message: `Quiet`, context: "companion welcome" })}
          </button>
        ) : null}
        {beat < 7 ? (
          <button
            type="button"
            onClick={() => leave("skipped")}
            className={`min-h-8 whitespace-nowrap rounded-full border border-dash-edge bg-background/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-dash-gold hover:text-foreground ${FOCUS}`}
          >
            <Trans context="companion welcome">Skip for now</Trans>
          </button>
        ) : null}
      </div>
    </div>
  );

  const foot = (left: ReactNode, right: ReactNode) => <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">{left}{right}</div>;
  const fine = "m-0 text-xs leading-snug text-muted-foreground";

  // Asked again at the top of a welcome resumed before the arrival's choice.
  const voiceAsk =
    !voiceChosen && beat > 0 ? (
      <div role="group" aria-label={t({ message: `Should I speak aloud?`, context: "companion welcome" })} className="flex flex-wrap items-center gap-2 rounded-xl border border-dash-gold-edge bg-dash-raised p-2.5 text-xs text-foreground">
        <span className="flex-1">
          <Trans context="companion welcome">Should I speak aloud, or stay quiet and only write?</Trans>
        </span>
        <button type="button" className={`${BTN_GOLD} ${SMALL}`} onClick={() => chooseVoice(true)}>
          <Trans context="companion welcome">Speak aloud</Trans>
        </button>
        <button type="button" className={`${BTN_LINE} ${SMALL}`} onClick={() => chooseVoice(false)}>
          <Trans context="companion welcome">Quiet</Trans>
        </button>
      </div>
    ) : null;

  // ── the tour renders over the real page ──
  if (beat === 5) {
    const s = stops[stop];
    return (
      <div className="sheet-night" style={{ background: "transparent" }}>
        {spot ? <div className="cw-spot" style={spot} aria-hidden="true" /> : <div className="fixed inset-0 z-[70] bg-black/70" aria-hidden="true" />}
        <button
          type="button"
          onClick={() => leave("skipped")}
          className={`fixed right-3 top-3 z-[85] min-h-8 rounded-full border border-dash-edge bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-dash-gold hover:text-foreground ${FOCUS}`}
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <Trans context="companion welcome">Skip for now</Trans>
        </button>
        <div ref={tourRef} role="dialog" aria-modal="false" aria-label={t({ message: `Profile tour`, context: "companion welcome" })} className="fixed inset-x-2.5 bottom-2.5 z-[80] mx-auto flex max-w-[460px] items-end gap-2" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}>
          <span key={wiggle} className={reduced ? "" : wiggle ? "cw-wiggle" : ""} style={{ transform: `rotate(${stop % 2 ? -6 : 6}deg)` }}>
            <Pet kind={kind} tint={tint} size={60} motion={motion} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex gap-1" role="img" aria-label={t({ message: `Section ${stop + 1} of ${stops.length}`, context: "companion welcome" })}>
              {stops.map((x, i) => (
                <i key={x.id} className={`block size-2.5 rounded-full ${i <= stop ? "bg-dash-gold" : "bg-white/20"}`} />
              ))}
            </div>
            {s ? (
              <Bubble who={cname} text={s.say({ first: firstName, name: cname, mates })} speak={speak} quiet={quiet} live>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={act} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dash-gold bg-background px-3 py-1.5 text-xs font-semibold text-dash-gold-lit ${FOCUS}`}>
                    ✦ {s.act}
                  </button>
                  <span className="flex-1" />
                  {stop > 0 ? (
                    <button type="button" className={`${BTN_LINE} !min-h-9 !px-3 !py-1.5 !text-[13px]`} onClick={tourBack}>
                      <Trans context="companion welcome">Back</Trans>
                    </button>
                  ) : null}
                  <button ref={nextRef} type="button" className={`${BTN_GOLD} !min-h-9 !px-3 !py-1.5 !text-[13px]`} onClick={tourNext}>
                    {stop < stops.length - 1 ? t({ message: `Next`, context: "companion welcome" }) : t({ message: `Done`, context: "companion welcome" })}
                  </button>
                </div>
              </Bubble>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ── the egg beats, the moon promise and the bond render in one stage ──
  let body: ReactNode = null;

  if (beat === 0) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-dash-track, #2c3d34)" strokeWidth="6" />
          <circle className="cw-ring" cx="60" cy="60" r="52" fill="none" stroke="var(--color-dash-session)" strokeWidth="6" strokeLinecap="round" transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r="34" fill="var(--color-dash-session)" opacity=".18" />
        </svg>
        <p className={`${KICKER} mt-5`}>
          <Trans context="companion welcome">The hatchery</Trans>
        </p>
        <h2 id="cw-title" className="m-0 font-display text-[28px] text-dash-gold-lit">
          <Trans context="companion welcome">Welcome, {firstName}.</Trans>
        </h2>
        <p className="m-0 max-w-[30ch] text-sm text-muted-foreground">
          <Trans context="companion welcome">Every member gets a companion. Yours is still an egg. Let's find out who's inside.</Trans>
        </p>
        <p className="m-0 mt-[18px] max-w-[32ch] text-sm text-foreground">
          <Trans context="companion welcome">Should I talk to you out loud, with your browser's own voice? Or stay quiet and only write?</Trans>
        </p>
        <div role="group" aria-label={t({ message: `How I talk to you`, context: "companion welcome" })} className="mt-3 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            className={BTN_GOLD}
            onClick={() => {
              chooseVoice(true);
              next();
            }}
          >
            <Trans context="companion welcome">Speak aloud</Trans>
          </button>
          <button
            type="button"
            className={BTN_LINE}
            onClick={() => {
              chooseVoice(false);
              next();
            }}
          >
            <Trans context="companion welcome">Quiet</Trans>
          </button>
        </div>
        <p className={`${fine} mt-2 max-w-[32ch]`}>
          <Trans context="companion welcome">Change it any time with Quiet at the top.</Trans>
        </p>
      </div>
    );
  } else if (beat === 1) {
    body = (
      <>
        <div key={wiggle} className={wiggle && !reduced ? "cw-wiggle mt-1.5" : "mt-1.5"}>
          <Egg tint={eggTint} />
        </div>
        {named ? (
          <Bubble key={`n-${name}`} who={cname} text={`${name}? ${name}! Oh, I love it. ${name} it is. You can rename me any time.`} speak={speak} quiet={quiet}>
            <div className="mt-2 flex gap-1.5">
              <button type="button" className={`${BTN_GOLD} !min-h-9 !px-3 !py-1.5 !text-[13px]`} onClick={next}>
                <Trans context="companion welcome">Next: who you'll be</Trans>
              </button>
            </div>
          </Bubble>
        ) : (
          <Bubble key="ask" who="Your companion" text={`Tap tap? Hello in there… I mean, out there! I'm your companion, ${firstName}. I'll hatch once you've told me who to be. First: what's my name?`} speak={speak} quiet={quiet} />
        )}
        <p className={fine}>
          <Trans context="companion welcome">Say it, type it, or pick one:</Trans>
        </p>
        <div className="flex flex-wrap gap-2">
          {NAME_IDEAS.map((n) => (
            <button key={n} type="button" className={chip(named && name === n)} onClick={() => setNameNow(n)}>
              {n}
            </button>
          ))}
        </div>
        <NameBox initial={personal?.name ?? ""} quiet={quiet} onSend={setNameNow} />
        {!quiet ? <p className={fine}>{t(MIC_LINE)}</p> : null}
      </>
    );
  } else if (beat === 2) {
    body = (
      <>
        <div className="flex items-center gap-2.5">
          <Pet kind={kind} tint={tint} size={56} motion={motion} />
          <div className="min-w-0 flex-1">
            <Bubble key={sample ?? "ask"} who={cname} text={sample ? `“${sample}”` : `How should I be with you, ${firstName}? Pick a character and I'll show you how I'd sound.`} speak={speak} quiet={quiet} />
          </div>
        </div>
        <div role="group" aria-label={t({ message: `Character`, context: "companion welcome" })} className="grid grid-cols-2 gap-2">
          {CHARACTERS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={persona.character === c}
              onClick={() => {
                setPersona((p) => ({ ...p, character: c }));
                setSample(CHARACTER_INFO[c].sample);
                setPicked(true);
              }}
              className={`min-h-16 rounded-[14px] border p-2.5 text-left ${FOCUS} ${persona.character === c ? "border-dash-gold bg-dash-raised shadow-[inset_0_0_0_1px_var(--color-dash-gold)]" : "border-dash-edge bg-card"}`}
            >
              <b className="block font-display text-base font-normal text-dash-gold-lit">{CHARACTER_INFO[c].label}</b>
              <span className="block text-xs leading-snug text-muted-foreground">{CHARACTER_INFO[c].blurb}</span>
            </button>
          ))}
        </div>
        {DIAL_INFO.map((d) => (
          <label key={d.key} className="grid grid-cols-[62px_1fr_62px] items-center gap-2 text-xs text-muted-foreground">
            <span>{d.low}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={persona.dials[d.key]}
              aria-label={t({ message: `${d.low} to ${d.high}`, context: "companion welcome" })}
              aria-valuetext={dialText(persona.dials[d.key], d.low, d.high)}
              className="w-full accent-[var(--color-dash-gold)]"
              onChange={(e) => setPersona((p) => ({ ...p, dials: { ...p.dials, [d.key]: Number(e.target.value) } }))}
            />
            <span className="text-right">{d.high}</span>
          </label>
        ))}
        <p className={`${fine} mt-1`}>
          <Trans context="companion welcome">How I like to be helped</Trans>
        </p>
        <div className="flex flex-wrap gap-2">
          {HELP_WAYS.map((h) => {
            const on = persona.help.includes(h);
            return (
              <button key={h} type="button" aria-pressed={on} className={chip(on)} onClick={() => setPersona((p) => ({ ...p, help: on ? p.help.filter((x) => x !== h) : [...p.help, h] }))}>
                {HELP_INFO[h].label}
              </button>
            );
          })}
        </div>
        <div className="rounded-xl border border-dashed border-dash-edge bg-background p-2.5 text-xs text-muted-foreground">
          <b className="text-dash-cash">
            <Trans context="companion welcome">Voice:</Trans>
          </b>{" "}
          {quiet || !persona.speak ? t({ message: `I'll only write.`, context: "companion welcome" }) : t({ message: `I'll speak aloud with your browser's own voice.`, context: "companion welcome" })}{" "}
          <button
            type="button"
            className={`rounded text-dash-gold-lit underline underline-offset-2 ${FOCUS}`}
            onClick={() => {
              setPersona((p) => ({ ...p, speak: !p.speak }));
              setVoiceChosen(true);
            }}
          >
            {persona.speak ? t({ message: `Write only`, context: "companion welcome" }) : t({ message: `Speak aloud`, context: "companion welcome" })}
          </button>
          <Trans context="companion welcome">
            . I speak through <b className="text-dash-cash">{engineName}</b>, the guide you chose (change it on your guide card).
          </Trans>
        </div>
        {foot(
          <span className={fine}>
            <Trans context="companion welcome">Change all of this later</Trans>
          </span>,
          <button type="button" className={`${BTN_GOLD} ${SMALL}`} onClick={next}>
            <Trans context="companion welcome">Next</Trans>
          </button>,
        )}
      </>
    );
  } else if (beat === 3) {
    // Gene Keys and Human Design are two ingredients on the approved board, read from
    // one reading and one "let my guide use my lines" switch, so both open the same card.
    // Human Design rides the Gene Keys switch, so it says so when that is on.
    const items: { key: string; id: SheetId; label: string; color: string; on: boolean; shared?: boolean }[] = [
      ...(gk
        ? [
            { key: "gk", id: "gk" as const, label: "Gene Keys", color: "var(--color-dash-gold)", on: Boolean(gk.guideUses) },
            { key: "hd", id: "gk" as const, label: "Human Design", color: "var(--color-dash-session)", on: Boolean(gk.guideUses), shared: true },
          ]
        : []),
      { key: "vedic", id: "vedic", label: "Vedic chart", color: "var(--color-dash-voice)", on: has("vedic") },
      { key: "type", id: "type", label: "Personality type", color: "var(--color-dash-thanks)", on: has("type") },
      { key: "own", id: "own", label: "In your own words", color: "var(--color-dash-cash)", on: has("own") },
    ];
    const count = new Set(items.filter((i) => i.on).map((i) => i.id)).size;
    body = (
      <>
        <Egg tint={eggTint} small />
        <Bubble key="lenses" who={cname} text="Drop in anything that helps me understand you. Each one changes how I talk to you. All optional, all private, all deletable." speak={speak} quiet={quiet} />
        <div className="grid grid-cols-3 gap-2">
          {items.map((i) => (
            <button
              key={i.key}
              type="button"
              aria-haspopup="dialog"
              aria-label={i.on ? (i.shared ? t({ message: `${i.label}, added, with Gene Keys`, context: "companion welcome" }) : t({ message: `${i.label}, added`, context: "companion welcome" })) : undefined}
              onClick={(e) => {
                sheetFrom.current = e.currentTarget;
                setSheet(i.id);
              }}
              className={`flex min-h-[70px] flex-col items-center gap-1 rounded-[14px] border px-1 py-2 text-xs text-foreground ${FOCUS} ${i.on ? "border-dash-gold bg-dash-raised" : "border-dash-edge bg-card"}`}
            >
              <span className="size-6 rounded-full" style={{ background: i.color }} aria-hidden="true" />
              <span>{i.label}</span>
              {i.on ? (
                <span className="font-semibold text-dash-gold-lit">
                  {i.shared ? t({ message: `added, with Gene Keys`, context: "companion welcome" }) : t({ message: `added`, context: "companion welcome" })}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {foot(
          <button type="button" className={`${BTN_LINE} ${SMALL}`} onClick={next}>
            <Trans context="companion welcome">Not now</Trans>
          </button>,
          <button type="button" className={`${BTN_GOLD} ${SMALL}`} onClick={next}>
            {count ? t({ message: `Next (${count} added)`, context: "companion welcome" }) : t({ message: `Next`, context: "companion welcome" })}
          </button>,
        )}
      </>
    );
  } else if (beat === 4) {
    body = (
      <>
        <Bubble
          key="family"
          who={cname}
          text={roles.length ? `I hatched! And I'm not alone, ${firstName}. You hold ${roles.length === 1 ? "a role" : `${roles.length} roles`}, and each role has its own companion. Meet the family!` : `I hatched! Hello, ${firstName}. When you take on a role, its own companion hatches here to help with that work.`}
          speak={speak}
          quiet={quiet}
        />
        <div className="flex flex-wrap justify-center gap-2.5">
          <div className="flex w-[104px] flex-col items-center gap-1 rounded-2xl border border-dash-edge bg-card p-2.5 text-center">
            <Pet kind={kind} tint={tint} size={58} motion={`${pop} ${motion}`} />
            <b className="font-display text-[15px] font-normal text-dash-gold-lit">{cname}</b>
            <span className="text-xs leading-tight text-muted-foreground">
              <Trans context="companion welcome">Personal companion</Trans>
            </span>
          </div>
          {roles.map((r, i) => (
            <div key={r.id} className="flex w-[104px] flex-col items-center gap-1 rounded-2xl border border-dash-edge bg-card p-2.5 text-center">
              <span className={pop} style={{ animationDelay: `${0.3 + i * 0.3}s` }}>
                <PetDrawing kind={r.look.pet ?? "horns"} tint={r.look.tint ?? "gold"} size={58} />
              </span>
              <b className="font-display text-[15px] font-normal text-dash-gold-lit">{roleNames[r.id] || r.name}</b>
              <span className="text-xs leading-tight text-muted-foreground">{r.scopeLine}</span>
            </div>
          ))}
        </div>
        {roles.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-2xl border border-dash-edge bg-card p-3">
            <p className={fine}>
              <Trans context="companion welcome">
                <b className="text-foreground">{r.scopeLine}.</b> Give it a name.
              </Trans>
            </p>
            <input
              className={INPUT}
              aria-label={t({ message: `Name for the ${r.scopeLine}`, context: "companion welcome" })}
              maxLength={40}
              value={roleNames[r.id] ?? ""}
              onChange={(e) => setRoleNames((m) => ({ ...m, [r.id]: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={roleSame[r.id]} className={chip(Boolean(roleSame[r.id]))} onClick={() => setRoleSame((m) => ({ ...m, [r.id]: true }))}>
                <Trans context="companion welcome">Same personality as {cname}</Trans>
              </button>
              <button type="button" aria-pressed={!roleSame[r.id]} className={chip(!roleSame[r.id])} onClick={() => setRoleSame((m) => ({ ...m, [r.id]: false }))}>
                <Trans context="companion welcome">Its own personality</Trans>
              </button>
            </div>
          </div>
        ))}
        {foot(
          <span className={fine}>
            <Trans context="companion welcome">A new role later brings a new friend</Trans>
          </span>,
          <button type="button" className={`${BTN_GOLD} ${SMALL}`} onClick={next}>
            <Trans context="companion welcome">Start the tour</Trans>
          </button>,
        )}
      </>
    );
  } else if (beat === 6) {
    body = <MoonPromise who={cname} kind={kind} tint={tint} motion={motion} speak={speak} quiet={quiet} onNext={next} />;
  } else {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex flex-wrap items-end justify-center gap-2.5">
          <Pet kind={kind} tint={tint} size={70} motion={motion} />
          {roles.map((r) => (
            <Pet key={r.id} kind={r.look.pet ?? "horns"} tint={r.look.tint ?? "gold"} size={58} motion={motion} />
          ))}
        </div>
        <div className="cw-badge mt-4 font-display text-[13px]">
          <Trans context="companion welcome">
            Companion
            <br />
            bonded
          </Trans>
        </div>
        <h2 id="cw-title" className="m-0 font-display text-[26px] text-dash-gold-lit">
          <Trans context="companion welcome">{cname} is yours.</Trans>
        </h2>
        <Bubble key="bonded" who={cname} text={`That's the whole place, ${firstName}! My first question is waiting for you in Your companions. Call me any time, I'm always on your profile.`} speak={speak} quiet={quiet} />
        <div className="flex flex-wrap justify-center gap-2.5">
          <button type="button" className={BTN_GOLD} onClick={() => leave("done")}>
            <Trans context="companion welcome">Go to my profile</Trans>
          </button>
          <button type="button" className={BTN_LINE} onClick={() => go(5)}>
            <Trans context="companion welcome">Replay the tour</Trans>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="sheet-night fixed inset-0 z-[80] flex items-stretch justify-center bg-black/80 sm:items-center sm:p-6">
      <div
        ref={stageRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t({ message: `Meet your companion`, context: "companion welcome" })}
        className="relative flex h-full w-full max-w-[420px] flex-col overflow-hidden bg-background outline-none sm:h-[min(780px,100%)] sm:rounded-[32px] sm:border sm:border-dash-edge sm:shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      >
        {topbar}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] pb-[18px] pt-[54px] [&>*]:shrink-0" inert={sheet ? true : undefined}>
          {voiceAsk}
          {body}
        </div>
        {sheet ? (
          <LensSheet
            id={sheet}
            companionName={cname}
            gk={gk}
            current={sheet === "gk" ? null : lenses.find((l) => l.lens === sheet) ?? null}
            onClose={() => setSheet(null)}
            onSaved={(ls, gkUses) => {
              if (ls) setLenses(ls);
              if (gkUses !== undefined && gk) setGk({ ...gk, guideUses: gkUses });
              const added = gkUses ?? (ls ?? []).some((l) => l.lens === sheet);
              setSheet(null);
              if (added) confetti(18);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
