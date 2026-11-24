/**
 * Feedback (S66): the door where a bug report or an idea walks in.
 *
 * Two honesty rules shape this page. First, the disclosure is REAL: the form
 * says where the words go — to this village's team, and (while the relay is
 * on) a copy to the platform team so a fix can reach every village — before
 * anyone types. Second, names stay home: whoever is signed in is attached
 * for the LOCAL queue so their own admins can follow up, but the relay
 * never carries it.
 */
import Layout from "@/components/Layout";
import VoiceArea from "@/components/voice/VoiceArea";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { authToken } from "@/lib/gameApi";
import { Bug, Check, Lightbulb } from "lucide-react";
import BreathingLoader from "@/components/natural/BreathingLoader";
import { failureWords } from "@/lib/failureWords";
import { BTN_PRIMARY, CARD, EYEBROW, FIELD, H1, LEDE, WORLD } from "@/components/journey/look";

const headers = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};

export default function Feedback() {
  const { t } = useLingui();
  const [cfg, setCfg] = useState<{ relayOn: boolean; villageName: string } | null>(null);
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | { shared: boolean }>(null);
  // The panel replaces the form and its button, so focus would fall to
  // <body> and nothing would be read. Focus goes to the panel, which reads it.
  const received = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sent) received.current?.focus();
  }, [sent]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/feedback/config").then((r) => r.json()).then(setCfg).catch(() => {});
  }, []);

  const submit = () => {
    setBusy(true);
    setError("");
    fetch("/api/feedback", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ kind, title, detail, hp, pageUrl: document.referrer || null }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? d.error ?? t({ message: "Could not send that", context: "feedback page: when it fails" }));
        setSent({ shared: !!d.shared });
      })
      .catch((e) => setError(failureWords(e)))
      .finally(() => setBusy(false));
  };

  const village = cfg?.villageName ?? t({ message: "your village", context: "feedback page: where it goes, before the village name loads" });
  return (
    <Layout>
      {/* The night world (public launch QA, 24 Nov 2026): the sheet's look, same words. */}
      <div className={WORLD}>
      <section className="pt-12 pb-4 sm:pt-16">
        <div className="container max-w-xl">
          <p className={EYEBROW}>{t({ message: "Feedback", context: "feedback page eyebrow" })}</p>
          <h1 className={`${H1} mt-2 mb-3`}>{t({ message: "Something broken? Something missing?", context: "feedback page: the heading" })}</h1>
          <p className={LEDE}>
            {t({ message: "Both are gifts. A bug named is a bug on its way out; an idea written down is one the village can actually weigh.", context: "feedback page: under the heading" })}
          </p>
        </div>
      </section>

      <section className="pt-4 pb-16">
        <div className="container max-w-xl">
          {sent ? (
            <div ref={received} tabIndex={-1} className={`${CARD} text-center outline-none`}>
              <div className="w-12 h-12 bg-open/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-open" aria-hidden="true" />
              </div>
              <p className="font-semibold text-foreground mb-1">{t({ message: "Received, thank you.", context: "feedback page: after sending" })}</p>
              <p className="text-sm text-muted-foreground">
                {sent.shared
                  ? t({ message: "Your village's team has it, and a copy reaches the platform team so a fix can land for every village. Your name travels to neither the platform nor anywhere else. It stays here.", context: "feedback page: after sending, shared" })
                  : t({ message: "Your village's team has it and will take it from here.", context: "feedback page: after sending" })}
              </p>
              <button
                onClick={() => { setSent(null); setTitle(""); setDetail(""); }}
                className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground"
              >
                {t({ message: "Send another", context: "feedback page: after sending" })}
              </button>
            </div>
          ) : (
            <div className={`${CARD} space-y-4`}>
              {error && <p role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive rounded-lg px-4 py-2.5">{error}</p>}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setKind("bug")}
                  className={`jw-btn flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
                    kind === "bug" ? "border-notice bg-notice/10 text-notice" : "border-border text-muted-foreground"
                  }`}
                >
                  <Bug className="w-4 h-4" /> {t({ message: "Something broke", context: "feedback page: the kind" })}
                </button>
                <button
                  onClick={() => setKind("idea")}
                  className={`jw-btn flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
                    kind === "idea" ? "border-notice bg-notice/10 text-notice" : "border-border text-muted-foreground"
                  }`}
                >
                  <Lightbulb className="w-4 h-4" /> {t({ message: "An idea", context: "feedback page: the kind" })}
                </button>
              </div>

              <div>
                {/* htmlFor + id. The label text was already right; it just
                    was not tied to the field, so both controls reached a
                    screen reader unnamed. */}
                <label htmlFor="feedback-title" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {kind === "bug" ? t({ message: "What went wrong, in one line", context: "feedback page: title label" }) : t({ message: "The idea, in one line", context: "feedback page: title label" })}
                </label>
                <input
                  id="feedback-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className={`${FIELD} w-full text-base px-3 py-2.5`}
                  placeholder={kind === "bug" ? t({ message: "The quest page shows a blank box when…", context: "feedback page: title example" }) : t({ message: "It would help if…", context: "feedback page: title example" })}
                />
              </div>

              <div>
                <label htmlFor="feedback-detail" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {kind === "bug" ? t({ message: "What did you do, what did you expect, what happened instead?", context: "feedback page: detail label" }) : t({ message: "How would it work, and who does it serve?", context: "feedback page: detail label" })}
                </label>
                <VoiceArea
                  value={detail}
                  onValue={setDetail}
                  talk={{
                    label: t({ message: "The details", context: "voice field label: feedback detail" }),
                    purpose: t({ message: "For a bug: what you did, what you expected and what happened. For an idea: how it would work and who it serves.", context: "voice field purpose: feedback detail" }),
                  }}
                >
                <textarea
                  id="feedback-detail"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={6}
                  maxLength={8000}
                  className={`${FIELD} w-full text-base px-3 py-2.5`}
                />
                </VoiceArea>
              </div>

              {/* Honeypot — humans never see it, bots can't resist it. */}
              <input
                type="text"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute opacity-0 pointer-events-none h-0 w-0"
              />

              {/* The disclosure, before the button, in plain words. */}
              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                {cfg?.relayOn
                  ? t({ message: `Where this goes: ${village}'s team, plus a copy to the ReGen Civics platform team, so a bug fixed once is fixed for every village. What you write travels; who you are does not.`, context: "feedback page: where it goes, shared" })
                  : t({ message: `Where this goes: ${village}'s team, and nowhere else.`, context: "feedback page: where it goes" })}
              </p>

              {/* The thresholds used to be silent: the button was disabled with no title,
                  no aria-disabled and no helper text, so clicking it changed nothing on
                  the page and said nothing about why. This is the channel members use to
                  report every other bug, so it is the last surface that should make
                  somebody guess. */}
              {(title.trim().length < 4 || detail.trim().length < 10) && (
                <p className="text-xs text-muted-foreground">
                  {title.trim().length < 4
                    ? t({ message: "Give it a short title first, at least four characters.", context: "feedback page: why Send waits" })
                    : t({ message: "Add a little more detail, at least ten characters, so somebody can act on it.", context: "feedback page: why Send waits" })}
                </p>
              )}
              <button
                onClick={submit}
                aria-disabled={busy || title.trim().length < 4 || detail.trim().length < 10}
                disabled={busy || title.trim().length < 4 || detail.trim().length < 10}
                className={`${BTN_PRIMARY} w-full py-3 text-sm`}
              >
                {busy && <BreathingLoader decorative size={16} />} {t({ message: "Send it", context: "feedback page: the button" })}
              </button>
            </div>
          )}
        </div>
      </section>
      </div>
    </Layout>
  );
}
