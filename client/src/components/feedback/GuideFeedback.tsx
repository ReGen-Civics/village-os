/**
 * SHARE FEEDBACK, IN THE GUIDE'S PANEL (the fold of /feedback, 26 Nov 2026). The lead: "the report a
 * bug or request a feature could also be backed into this and have scarlet help and can add
 * screenshots easily ... share with scarlet and that goes into our own queue."
 *
 * One form, on the page the member means:
 *
 *   1. What kind: something broke, an idea, or how something felt.
 *   2. What happened, in their words (the mic, and "Talk it out" with their guide for a member).
 *   3. A screenshot, if they want one: this screen captured on a computer, or one picked from the
 *      phone's photos, then marked with an arrow or a pen (ShotEditor, loaded only now).
 *   4. What the guide heard: the kind and the page said back, and a title from their own first line
 *      that they can change. The guide repeats and suggests. It never ranks, sorts or weighs a report,
 *      and it never judges who sent it; the village's team decides what happens next.
 *   5. Send, into the village's own queue (server/lib/feedback.ts): captured here always, and only
 *      the words relayed, only while the relay is on. The screenshot and the name stay home.
 *
 * The two honesty rules of the old page hold: the disclosure is real and comes before Send, and the
 * name stays in the village.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Bug, ImagePlus, Monitor } from "lucide-react";
import VoiceArea from "@/components/voice/VoiceArea";
import BreathingLoader from "@/components/natural/BreathingLoader";
import { Seed } from "@/components/sacred/living";
import { Lotus } from "@/components/sacred/glyphs";
import Sprout from "@/components/motion/Sprout";
import { Face } from "@/components/profileDash/companionStanding";
import { authToken } from "@/lib/gameApi";
import { failureWords } from "@/lib/failureWords";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, FIELD, HINT, LABEL, NOTE, TILE } from "@/components/journey/look";
import type { CompanionLook } from "@shared/companionItems";
import {
  FEEDBACK_DETAIL_MAX,
  FEEDBACK_DETAIL_MIN,
  FEEDBACK_TITLE_MAX,
  FEEDBACK_TITLE_MIN,
  pageForHeard,
  suggestTitle,
  type FeedbackKind,
} from "@shared/feedbackItems";

const ShotEditor = lazy(() => import("./ShotEditor"));

/** A computer whose browser offers its own "share this tab" picker. iOS Safari has none, nor does a phone's Chrome. */
function canCaptureScreen(): boolean {
  try {
    return typeof navigator.mediaDevices?.getDisplayMedia === "function" && !!window.matchMedia?.("(pointer: fine)").matches;
  } catch {
    return false;
  }
}

export default function GuideFeedback({
  guide,
  face,
  onAside,
  onClose,
}: {
  guide: string;
  face: { look: CompanionLook; url: string | null };
  /** Step the panel aside: "pill" while the member takes a phone screenshot, "hidden" while the browser captures. */
  onAside: (mode: false | "pill" | "hidden") => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [cfg, setCfg] = useState<{ relayOn: boolean; villageName: string } | null>(null);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [detail, setDetail] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [shot, setShot] = useState<Blob | null>(null);
  const [marks, setMarks] = useState(0);
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<null | { shared: boolean }>(null);
  const exportShot = useRef<(() => Promise<File | null>) | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const received = useRef<HTMLDivElement>(null);
  const capture = canCaptureScreen();
  // The page the panel stands over is the page the report is about.
  const [here] = useState(() => `${window.location.origin}${window.location.pathname}`);

  useEffect(() => {
    fetch("/api/feedback/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setCfg(c))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (sent) received.current?.focus();
  }, [sent]);

  const suggested = suggestTitle(detail);
  const shownTitle = titleTouched ? title : suggested;
  const page = pageForHeard(here);
  const village = cfg?.villageName || t({ message: "your village", context: "feedback page: where it goes, before the village name loads" });
  const detailShort = detail.trim().length < FEEDBACK_DETAIL_MIN;
  // An emptied title is fine (the server takes the guide's suggestion); one to three letters is not a title yet.
  const titleShort = shownTitle.trim().length > 0 && shownTitle.trim().length < FEEDBACK_TITLE_MIN;
  const onMarks = useCallback((n: number) => setMarks(n), []);

  const takeScreen = async () => {
    setError("");
    onAside("hidden");
    // Two frames, so the panel is gone from the screen before the browser reads it.
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    try {
      const { captureScreen } = await import("./ShotEditor");
      const blob = await captureScreen();
      if (blob) setShot(blob);
    } catch {
      setError(t({ message: "The screen was not shared. Choose a picture instead, or send it without one.", context: "guide feedback: when capturing the screen fails or is cancelled" }));
    } finally {
      onAside(false);
    }
  };

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const fields: Record<string, string> = { kind, title: shownTitle.trim(), detail, hp, pageUrl: here };
      const file = shot && exportShot.current ? await exportShot.current() : null;
      const token = authToken();
      const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      let body: BodyInit;
      let headers: Record<string, string> = auth;
      if (file) {
        const form = new FormData();
        for (const [k, v] of Object.entries(fields)) form.append(k, v);
        form.append("screenshot", file, file.name);
        body = form;
      } else {
        body = JSON.stringify(fields);
        headers = { ...auth, "Content-Type": "application/json" };
      }
      const r = await fetch("/api/feedback", { method: "POST", headers, body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message ?? d.error ?? t({ message: "Could not send that", context: "feedback page: when it fails" }));
      setSent({ shared: !!d.shared });
    } catch (e) {
      setError(failureWords(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSent(null);
    setDetail("");
    setTitle("");
    setTitleTouched(false);
    setShot(null);
    setMarks(0);
  };

  if (sent) {
    return (
      <div ref={received} tabIndex={-1} className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm outline-none" data-feedback-received="">
        <Sprout size={56} className="mx-auto mb-3 text-open" />
        <p className="font-display text-2xl text-card-foreground">{t({ message: "Received, thank you.", context: "feedback page: after sending" })}</p>
        <p className={`${NOTE} mt-2`}>
          {sent.shared
            ? t({ message: "Your village's team has it. A copy of your words reaches the platform team so a fix can land for every village. Your name and your screenshot stay here.", context: "guide feedback: after sending, shared" })
            : t({ message: "Your village's team has it and will take it from here.", context: "feedback page: after sending" })}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className={BTN_SECONDARY}>
            {t({ message: "Send another", context: "feedback page: after sending" })}
          </button>
          <button type="button" onClick={onClose} className={BTN_PRIMARY}>
            {t({ message: "Done", context: "guide feedback: closes the panel after sending" })}
          </button>
        </div>
      </div>
    );
  }

  const kinds: Array<{ k: FeedbackKind; label: string; icon: ReactNode }> = [
    { k: "bug", label: t({ message: "Something broke", context: "feedback page: the kind" }), icon: <Bug className="size-5" aria-hidden="true" /> },
    { k: "idea", label: t({ message: "An idea", context: "feedback page: the kind" }), icon: <Seed className="size-5" aria-hidden="true" /> },
    { k: "feedback", label: t({ message: "How it felt", context: "guide feedback: the kind, how something felt" }), icon: <Lotus className="size-5" aria-hidden="true" /> },
  ];
  const detailLabel =
    kind === "bug"
      ? t({ message: "What happened, and what did you expect?", context: "guide feedback: the words, for a bug" })
      : kind === "idea"
        ? t({ message: "What would help, and who would it serve?", context: "guide feedback: the words, for an idea" })
        : t({ message: "What did you notice, and how did it feel?", context: "guide feedback: the words, for how something felt" });
  const heardLine =
    kind === "bug"
      ? t({ message: `Something broke on ${page}.`, context: "guide feedback: what the guide heard, a bug and its page" })
      : kind === "idea"
        ? t({ message: `An idea, sent from ${page}.`, context: "guide feedback: what the guide heard, an idea and its page" })
        : t({ message: `How ${page} felt to you.`, context: "guide feedback: what the guide heard, feedback and its page" });

  return (
    <div className="space-y-5" data-guide-feedback="">
      {/* The guide, in its circle, asking. */}
      <div className="flex items-center gap-3">
        <Face look={face.look} url={face.url} size="lg" />
        <div className="min-w-0">
          <p className={EYEBROW}>{t({ message: "Share feedback", context: "the guide's panel: the door to the feedback form" })}</p>
          <h2 className="font-display text-2xl leading-tight text-foreground">{t({ message: `Tell ${guide} what you found`, context: "guide feedback: the heading, with the guide's name" })}</h2>
          <p className={`${HINT} mt-0.5`}>{t({ message: `${guide} passes it to ${village}'s team, in your words.`, context: "guide feedback: under the heading" })}</p>
        </div>
      </div>

      {/* 1. What kind. */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t({ message: "What kind of feedback", context: "feedback page: the kind" })}>
        {kinds.map(({ k, label, icon }) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            data-on={kind === k}
            onClick={() => setKind(k)}
            className={`jw-btn jw-pick flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center text-sm font-medium ${
              kind === k ? "border-notice bg-notice/10 text-notice" : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* 2. In their words. */}
      <div>
        <label htmlFor="guide-feedback-detail" className={`${LABEL} mb-1.5 block`}>
          {detailLabel}
        </label>
        <VoiceArea
          value={detail}
          onValue={setDetail}
          talk={{
            label: t({ message: "The details", context: "voice field label: feedback detail" }),
            purpose: t({ message: "For a bug: what you did, what you expected and what happened. For an idea: how it would work and who it serves.", context: "voice field purpose: feedback detail" }),
          }}
        >
          <textarea id="guide-feedback-detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} maxLength={FEEDBACK_DETAIL_MAX} className={`${FIELD} text-base`} />
        </VoiceArea>
      </div>

      {/* 3. A screenshot, if they want one. */}
      <div className={`${TILE} space-y-3`}>
        <p className={LABEL}>{t({ message: "A screenshot, if it helps", context: "guide feedback: the screenshot's heading" })}</p>
        {shot ? (
          <Suspense fallback={<BreathingLoader />}>
            <ShotEditor source={shot} exportRef={exportShot} onMarks={onMarks} onRemove={() => { setShot(null); setMarks(0); }} />
            <p className={HINT}>{t({ message: "Draw an arrow to the spot, or circle it with the pen.", context: "guide feedback: how to mark the screenshot" })}</p>
          </Suspense>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {capture ? (
                <button type="button" onClick={takeScreen} className={BTN_SECONDARY}>
                  <Monitor className="size-4" aria-hidden="true" /> {t({ message: "Capture this screen", context: "guide feedback: capture the screen on a computer" })}
                </button>
              ) : (
                <button type="button" onClick={() => onAside("pill")} className={BTN_SECONDARY}>
                  {t({ message: "Step aside to take one", context: "guide feedback: hide the panel so the member can take a phone screenshot" })}
                </button>
              )}
              <button type="button" onClick={() => picker.current?.click()} className={BTN_SECONDARY}>
                <ImagePlus className="size-4" aria-hidden="true" /> {t({ message: "Choose a picture", context: "guide feedback: pick a screenshot from the device" })}
              </button>
            </div>
            {!capture ? (
              <p className={HINT}>{t({ message: "Step aside, take a screenshot with your phone, tap the way back, then choose it from your photos.", context: "guide feedback: how a phone screenshot works" })}</p>
            ) : null}
            <input
              ref={picker}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setShot(f);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {/* 4. What the guide heard, once there is something to hear. */}
      {!detailShort ? (
        <div className="rounded-xl border border-notice/50 bg-card p-4" data-guide-heard="">
          <div className="mb-3 flex items-center gap-2.5">
            <Face look={face.look} url={face.url} size="sm" />
            <p className={EYEBROW}>{t({ message: `What ${guide} heard`, context: "guide feedback: the read-back's heading, with the guide's name" })}</p>
          </div>
          <ul className="mb-3 list-none space-y-1 p-0 text-sm text-card-foreground">
            <li>{heardLine}</li>
            {shot ? (
              <li>
                {marks > 1
                  ? t({ message: `With your screenshot, and ${marks} marks on it.`, context: "guide feedback: what the guide heard, a marked screenshot" })
                  : marks === 1
                    ? t({ message: "With your screenshot, and one mark on it.", context: "guide feedback: what the guide heard, a screenshot with one mark" })
                    : t({ message: "With your screenshot.", context: "guide feedback: what the guide heard, a screenshot" })}
              </li>
            ) : null}
          </ul>
          <label htmlFor="guide-feedback-title" className={`${LABEL} mb-1.5 block`}>
            {t({ message: "Title", context: "guide feedback: the title field" })}
          </label>
          <input
            id="guide-feedback-title"
            value={shownTitle}
            onChange={(e) => {
              setTitleTouched(true);
              setTitle(e.target.value);
            }}
            maxLength={FEEDBACK_TITLE_MAX}
            className={`${FIELD} text-base`}
          />
          <p className={`${HINT} mt-1.5`}>
            {titleTouched
              ? t({ message: `${guide} passes this on in your words. The team decides what happens next.`, context: "guide feedback: what the guide does with it" })
              : t({ message: `${guide} suggested this from your first line. Change it if you like.`, context: "guide feedback: under the suggested title" })}
          </p>
        </div>
      ) : null}

      {/* Honeypot: people never see it, bots cannot resist it. */}
      <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="pointer-events-none absolute h-0 w-0 opacity-0" />

      {/* 5. Where it goes, before the button, in plain words. */}
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        {cfg?.relayOn
          ? t({ message: `Where this goes: ${village}'s team, and a copy of the words to the platform team, so a bug fixed once is fixed for every village. Your name and your screenshot stay here.`, context: "guide feedback: where it goes, shared" })
          : t({ message: `Where this goes: ${village}'s team, and nowhere else.`, context: "feedback page: where it goes" })}
      </p>
      {detailShort ? (
        <p className={HINT}>{t({ message: "Add a little more detail, at least ten characters, so somebody can act on it.", context: "feedback page: why Send waits" })}</p>
      ) : titleShort ? (
        <p className={HINT}>{t({ message: "Give it a short title first, at least four characters.", context: "feedback page: why Send waits" })}</p>
      ) : null}
      {/* A failure is a sentence beside the act it stopped, and Send stays to try again. */}
      {error ? (
        <p role="alert" className="rounded-xl border border-destructive bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={send} disabled={busy || detailShort || titleShort} aria-disabled={busy || detailShort || titleShort} className={`${BTN_PRIMARY} w-full`}>
        {busy ? <BreathingLoader decorative size={16} /> : null} {t({ message: `Send to ${village}'s team`, context: "guide feedback: the button" })}
      </button>
    </div>
  );
}
