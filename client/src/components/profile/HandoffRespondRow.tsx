/**
 * One task handed to a role the reader holds, in Waiting on you
 * (shared/roleTaskHandoff.ts). The row carries the task's words, the note,
 * the by-when and the sender's first name, and three answers:
 *
 *   Accept            it joins the reader's own list, where they edit it
 *   Suggest a change  new words, note or by-when; it keeps waiting and the
 *                     sender hears
 *   Decline           with a reason, which the sender reads
 *
 * One holder accepting takes it for the role, so a row somebody else answered
 * first says so and leaves. Nothing here accepts on its own.
 */
import { useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { toast } from "sonner";
import { HANDOFF_LIMITS, type WaitingHandoff } from "@shared/roleTaskHandoff";
import { civilDayWords } from "@shared/seasonPlans";
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, HINT, INPUT, LABEL } from "@/components/sessions/roomUi";
import { respondHandoff } from "@/components/yourList/handoffApi";

type Mode = null | "suggest" | "decline";

export default function HandoffRespondRow({ h, onAnswered }: { h: WaitingHandoff; onAnswered: (id: string, keep: WaitingHandoff | null) => void }) {
  const { t } = useLingui();
  const ids = useId();
  const [mode, setMode] = useState<Mode>(null);
  const [title, setTitle] = useState(h.title);
  const [note, setNote] = useState(h.note ?? "");
  const [dueOn, setDueOn] = useState(h.dueOn ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const failed = t({ message: `That did not save. Try again.`, context: "task handed to a role" });
  const role = h.role;
  const from = h.from;

  const answer = async (action: "accept" | "suggest" | "decline") => {
    if (busy) return;
    setBusy(true);
    setError("");
    const extra =
      action === "suggest" ? { title: title.trim(), note: note.trim() || null, dueOn: dueOn || null } : action === "decline" ? { reason: reason.trim() } : {};
    const r = await respondHandoff(h.id, action, extra);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? failed);
      // Answered by somebody else, or no longer the reader's: it leaves the board.
      if (r.status === 409 && action !== "accept") onAnswered(h.id, null);
      return;
    }
    if (action === "accept") toast.success(t({ message: `It's on your list now.`, context: "task handed to a role" }));
    else if (action === "decline") toast.success(t({ message: `Declined. They'll see why.`, context: "task handed to a role" }));
    else toast.success(t({ message: `Change sent. It still waits for the role.`, context: "task handed to a role" }));
    onAnswered(h.id, action === "suggest" ? { ...h, title: title.trim(), note: note.trim() || null, dueOn: dueOn || null, edited: true } : null);
    setMode(null);
  };

  const meta = [
    from ? t({ message: `From ${from}`, context: "task handed to a role" }) : "",
    h.dueOn ? t({ message: `By ${civilDayWords(h.dueOn)}`, context: "task handed to a role" }) : "",
    h.via === "lead" ? t({ message: `Nobody holds ${role}, so it came to the circle's lead`, context: "task handed to a role" }) : "",
    h.via === "steward" ? t({ message: `Nobody holds ${role}, so it came to the stewards`, context: "task handed to a role" }) : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="rounded-2xl border border-border bg-muted px-4 py-3.5 text-foreground" data-handoff-row={h.id}>
      <p id={`${ids}-words`} className="font-semibold leading-snug">
        {t({ message: `For ${role}: ${h.title}`, context: "task handed to a role" })}
      </p>
      {meta && <p className={`${HINT} mt-0.5`}>{meta}</p>}
      {h.note && <p className="mt-1 whitespace-pre-line text-sm text-foreground">{h.note}</p>}
      {h.edited && <p className={`${HINT} mt-1`}>{t({ message: `A change was suggested since it was sent.`, context: "task handed to a role" })}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {mode === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={BTN_PRIMARY} disabled={busy} aria-describedby={`${ids}-words`} onClick={() => void answer("accept")}>
            {t({ message: `Accept`, context: "task handed to a role" })}
          </button>
          <button type="button" className={BTN_SECONDARY} disabled={busy} aria-describedby={`${ids}-words`} onClick={() => setMode("suggest")}>
            {t({ message: `Suggest a change`, context: "task handed to a role" })}
          </button>
          <button type="button" className={BTN_QUIET} disabled={busy} aria-describedby={`${ids}-words`} onClick={() => setMode("decline")}>
            {t({ message: `Decline`, context: "task handed to a role" })}
          </button>
        </div>
      )}
      {mode === "suggest" && (
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor={`${ids}-title`} className={LABEL}>{t({ message: `Task`, context: "task handed to a role" })}</label>
            <input id={`${ids}-title`} className={`${INPUT} mt-1`} value={title} maxLength={HANDOFF_LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${ids}-note`} className={LABEL}>{t({ message: `Note`, context: "task handed to a role" })}</label>
            <textarea id={`${ids}-note`} className={`${INPUT} mt-1 min-h-20 py-2`} value={note} maxLength={HANDOFF_LIMITS.note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${ids}-due`} className={LABEL}>{t({ message: `By when`, context: "task handed to a role" })}</label>
            <input id={`${ids}-due`} type="date" className={`${INPUT} mt-1`} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy || !title.trim()} onClick={() => void answer("suggest")}>
              {t({ message: `Send the change`, context: "task handed to a role" })}
            </button>
            <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => setMode(null)}>
              {t({ message: `Cancel`, context: "task handed to a role" })}
            </button>
          </div>
        </div>
      )}
      {mode === "decline" && (
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor={`${ids}-why`} className={LABEL}>{t({ message: `Why? They'll read this.`, context: "task handed to a role" })}</label>
            <input id={`${ids}-why`} className={`${INPUT} mt-1`} value={reason} maxLength={HANDOFF_LIMITS.reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy || !reason.trim()} onClick={() => void answer("decline")}>
              {t({ message: `Decline`, context: "task handed to a role" })}
            </button>
            <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => setMode(null)}>
              {t({ message: `Cancel`, context: "task handed to a role" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
