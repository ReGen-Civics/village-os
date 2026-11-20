/**
 * ONE LETTER TO EVERYONE WAITING FOR ONE ROLE (shared/roleWaitlistLetters.ts).
 * The words are drafted here with the role's name and the link to its card filled in, and
 * they are the person's to change. Nothing is sent until the person presses the second
 * button, which says how many people it goes to. Each letter ends with a line and a link
 * that takes the address off the waitlist; the server adds it and it cannot be edited out.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { useVillageName } from "@/hooks/useVillageName";
import { roleAnchor } from "@shared/roleWaitlist";
import { WAITLIST_LETTER_LIMITS } from "@shared/roleWaitlistLetters";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, HINT, LABEL, TILE } from "@/components/journey/look";

export default function WaitlistLetter({ roleId, roleName, count, total, onDone }: { roleId: string; roleName: string; count: number; total: number; onDone: () => void }) {
  const { t, i18n } = useLingui();
  const village = useVillageName();
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/roles#${roleAnchor(roleId)}`;
  const [subject, setSubject] = useState(() => t({ message: `${roleName} is opening at ${village}`, context: "waitlist letter: the drafted subject" }));
  const [body, setBody] = useState(() =>
    t({
      message: `Hello,\n\nYou asked us to tell you when ${roleName} opens at ${village}. Here is where it stands: (write the latest news here).\n\nYou can read the role card here: ${link}\n\nWith care,`,
      context: "waitlist letter: the drafted body",
    }),
  );
  const [step, setStep] = useState<"write" | "review" | "sending" | "sent">("write");
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; skipped: number; failed: number } | null>(null);
  const lang = i18n.locale.startsWith("es") ? "es" : "en";

  const send = async () => {
    setStep("sending");
    setProblem(null);
    try {
      const r = await gameFetch("/api/admin/roles/waitlist-letters/send", { method: "POST", body: JSON.stringify({ roleId, subject, body, expectedCount: count, lang, confirm: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setProblem(typeof d?.message === "string" ? d.message : t({ message: "The letter was not sent. Nothing went out.", context: "waitlist letter: it failed" }));
        setStep("review");
        return;
      }
      setResult({ sent: Number(d.sent) || 0, skipped: Number(d.skipped) || 0, failed: Number(d.failed) || 0 });
      setStep("sent");
      onDone();
    } catch {
      setProblem(t({ message: "The letter was not sent. Nothing went out.", context: "waitlist letter: it failed" }));
      setStep("review");
    }
  };

  if (step === "sent" && result) {
    return (
      <div className={TILE} role="status">
        <p className="font-semibold text-foreground">{t({ message: `Sent to ${result.sent} people.`, context: "waitlist letter: the result" })}</p>
        {(result.skipped > 0 || result.failed > 0) && (
          <p className={HINT}>
            {t({ message: `${result.skipped} skipped because they asked for no mail, ${result.failed} did not go through.`, context: "waitlist letter: the result, the ones that did not go" })}
          </p>
        )}
      </div>
    );
  }

  const locked = step === "sending";
  return (
    <div className={`${TILE} grid gap-3`} data-waitlist-letter={roleId}>
      <h3 className="font-semibold text-foreground">{t({ message: `Write to everyone waiting for ${roleName}`, context: "waitlist letter: the heading" })}</h3>
      <p className={HINT}>
        {t({ message: `${count} of ${total} said yes to letters, so this goes to ${count} people. It is sent only when you press send, and every letter ends with a link that takes the person off the waitlist.`, context: "waitlist letter: what happens" })}
      </p>
      <label className="grid gap-1">
        <span className={LABEL}>{t({ message: "Subject", context: "waitlist letter: field" })}</span>
        <input className={FIELD} value={subject} maxLength={WAITLIST_LETTER_LIMITS.subject} disabled={locked || step === "review"} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className={LABEL}>{t({ message: "Letter", context: "waitlist letter: field" })}</span>
        <textarea className={`${FIELD} min-h-48`} value={body} maxLength={WAITLIST_LETTER_LIMITS.body} disabled={locked || step === "review"} onChange={(e) => setBody(e.target.value)} />
      </label>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {step === "write" ? (
        <div>
          <button type="button" className={BTN_SECONDARY} disabled={!subject.trim() || !body.trim()} onClick={() => setStep("review")}>
            {t({ message: "Read it once more", context: "waitlist letter: go to the review" })}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN_PRIMARY} disabled={locked} onClick={() => void send()}>
            {t({ message: `Send this letter to ${count} people now`, context: "waitlist letter: the send button" })}
          </button>
          <button type="button" className={BTN_SECONDARY} disabled={locked} onClick={() => setStep("write")}>
            {t({ message: "Keep editing", context: "waitlist letter: back to writing" })}
          </button>
        </div>
      )}
    </div>
  );
}
