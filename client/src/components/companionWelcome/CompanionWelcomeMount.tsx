/**
 * WHERE THE WELCOME LIVES ON THE PROFILE (approved design, 14 Nov 2026).
 *
 * The profile loads this lazily, and this loads the welcome itself lazily, so
 * neither rides the first page (the guard-boot-set build plugin).
 *
 *   never opened   the welcome opens by itself, once
 *   skipped, open  a "Pick up your welcome" card on Today, resuming at the beat they left
 *   done           nothing here; "Replay the tour" is on the last screen, and
 *                  /profile#meet-your-companion opens it again
 *
 * A guest without companions sees nothing: the routes answer 403 and this renders null.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { PetDrawing } from "@/components/profileDash/CompanionPet";
import { BTN_GOLD } from "@/components/profileDash/dashUi";
import type { ProfileTab } from "@/components/profileDash/ProfileTabs";
import type { CompanionsPayload, CompanionView } from "@shared/companionItems";
import { WELCOME_BEATS, type WelcomePayload, type WelcomeState, type WelcomeStatus } from "@shared/companionPersona";

const CompanionWelcome = lazy(() => import("./CompanionWelcome"));

const HASH = "#meet-your-companion";

/** Focus back where it was, if it is still on the page (kept here so the welcome's kit stays in the welcome's own chunk). */
function refocus(el: Element | null): boolean {
  if (el instanceof HTMLElement && el.isConnected && el !== document.body) {
    el.focus();
    return true;
  }
  return false;
}

async function read<T>(path: string): Promise<T | null> {
  try {
    const r = await gameFetch(path);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Opens the welcome only once no other modal is on screen for a moment. A
 * member admitted today also gets the level-up moment on this same visit, and
 * it claims its moment after the page loads, so this waits it out rather
 * than racing it.
 */
function whenNoModal(go: () => void): () => void {
  let clear = 0;
  const id = window.setInterval(() => {
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) clear = 0;
    else if (++clear >= 3) {
      window.clearInterval(id);
      go();
    }
  }, 500);
  return () => window.clearInterval(id);
}

export default function CompanionWelcomeMount({ firstName, onTab }: { firstName: string; onTab: (t: ProfileTab) => void }) {
  const { t } = useLingui();
  const [welcome, setWelcome] = useState<WelcomePayload | null>(null);
  const [companions, setCompanions] = useState<CompanionView[] | null>(null);
  const [state, setState] = useState<WelcomeState | null>(null);
  const [open, setOpen] = useState(false);
  const [startBeat, setStartBeat] = useState(0);
  // Where focus was when the welcome opened, so closing it puts focus back there.
  // Opened by itself, it had none: the "Pick up your welcome" card's Resume takes it.
  const returnTo = useRef<Element | null>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const [refocusDue, setRefocusDue] = useState(false);
  const openNow = useCallback(() => {
    returnTo.current = document.activeElement;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!refocusDue || open) return;
    setRefocusDue(false);
    if (!refocus(returnTo.current)) resumeRef.current?.focus();
    returnTo.current = null;
  }, [refocusDue, open]);

  useEffect(() => {
    let alive = true;
    let stopWaiting = () => {};
    void Promise.all([read<WelcomePayload>("/api/me/companion-welcome"), read<CompanionsPayload>("/api/me/companions")]).then(([w, c]) => {
      if (!alive || !w || !c) return;
      setWelcome(w);
      setCompanions(c.companions);
      setState(w.state);
      const replay = window.location.hash === HASH;
      if (!w.state || replay) {
        setStartBeat(replay && w.state?.status === "done" ? 5 : (w.state?.beat ?? 0));
        stopWaiting = whenNoModal(() => alive && openNow());
      }
    });
    return () => {
      alive = false;
      stopWaiting();
    };
  }, []);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === HASH && welcome) {
        setStartBeat(state?.status === "done" ? 5 : (state?.beat ?? 0));
        openNow();
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [welcome, state, openNow]);

  // Finished in another tab: the server refused this tab's step back, so close and
  // read the saved state again, which is the finished one.
  const finishedElsewhere = useCallback(() => {
    setOpen(false);
    setRefocusDue(true);
    void Promise.all([read<WelcomePayload>("/api/me/companion-welcome"), read<CompanionsPayload>("/api/me/companions")]).then(([w, c]) => {
      if (w) {
        setWelcome(w);
        setState(w.state);
      }
      if (c) setCompanions(c.companions);
    });
  }, []);

  const close = useCallback((status: WelcomeStatus, beat: number, companionName: string) => {
    setOpen(false);
    setRefocusDue(true);
    // A finished welcome stays finished, here as on the server: skipping a replay changes nothing.
    const next: WelcomeState = { beat: status === "done" ? WELCOME_BEATS.length - 1 : beat, status, at: new Date().toISOString() };
    setState((prev) => (prev?.status === "done" ? prev : next));
    setWelcome((w) => (w && w.state?.status !== "done" ? { ...w, state: next } : w));
    setCompanions((cs) => cs?.map((c) => (c.scope === "personal" ? { ...c, name: companionName === "your companion" ? c.name : companionName } : c)) ?? cs);
    if (window.location.hash === HASH) history.replaceState(null, "", window.location.pathname + window.location.search);
    if (status === "done") window.scrollTo({ top: 0 });
  }, []);

  if (!welcome || !companions) return null;

  if (open) {
    return (
      <Suspense fallback={null}>
        <CompanionWelcome firstName={firstName} companions={companions} payload={welcome} startBeat={startBeat} onTab={onTab} onClose={close} onFinishedElsewhere={finishedElsewhere} />
      </Suspense>
    );
  }

  if (!state || state.status === "done") return null;

  const personal = companions.find((c) => c.scope === "personal");
  const pct = Math.round((state.beat / (WELCOME_BEATS.length - 1)) * 100);
  const who = personal?.name ?? t({ message: `Your companion`, context: "companion welcome" });
  return (
    <section aria-label={t({ message: `Pick up your welcome`, context: "companion welcome" })} className="flex items-center gap-2.5 rounded-[14px] border border-dash-gold-edge bg-dash-raised p-3">
      <PetDrawing kind={personal?.look.pet ?? "ears"} tint={personal?.look.tint ?? "gold"} size={40} />
      <div className="min-w-0">
        <b className="text-[13px] text-foreground">
          <Trans context="companion welcome">Pick up your welcome</Trans>
        </b>
        <p className="m-0 text-xs leading-snug text-muted-foreground">
          <Trans context="companion welcome">
            {who} is {pct}% hatched · about 2 minutes left
          </Trans>
        </p>
      </div>
      <button
        ref={resumeRef}
        type="button"
        className={`${BTN_GOLD} ml-auto !min-h-9 !px-3 !py-1.5 !text-[13px]`}
        onClick={() => {
          setStartBeat(state.beat);
          openNow();
        }}
      >
        <Trans context="companion welcome">Resume</Trans>
      </button>
    </section>
  );
}
