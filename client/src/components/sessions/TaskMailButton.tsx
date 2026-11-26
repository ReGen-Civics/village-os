/**
 * SEND THE TASK EMAILS, on a closed record, for the facilitator and admins
 * (the server decides who: `mail.canSend` on the task record).
 *
 * Every person holding an open task from this session gets one email listing
 * their tasks. The close already sent it once; this sends it again with where
 * the tasks stand now. So the button asks first, and says plainly what it
 * will do. While the request is out the button is disabled, so a double tap
 * cannot send twice (the server's idempotency key would collapse it anyway).
 * The result line is read off the server's answer and nothing else: a refusal
 * shows the server's own sentence, and only a 200 says how many were sent.
 * What did not go out is split by whose it is (`splitMailSkips`), so a member
 * is never told to change a setting when the village's email is not set up.
 *
 * Under the button sits the last send: who pressed it and when, or that the
 * close sent it, and plainly when that send put no email on its way. No
 * address and no per-person number is ever shown.
 */
import { useState } from "react";
import { SESSION_SOMEONE } from "@shared/sessions";
import { splitMailSkips, taskDateWords, taskEmailsUrl, type TaskMailResult, type TaskRecordPayload } from "@shared/sessionTasks";
import { gameFetch } from "@/lib/gameApi";
import { roomDay } from "./FromLastTime";
import { BTN_QUIET, BTN_SECONDARY, HINT } from "./roomUi";
import { useRoomWords } from "@/components/sessions/roomWords";
import { taskWords, useTaskWords } from "@/components/tasks/taskWords";

type LastSend = TaskRecordPayload["mail"]["lastSend"];

/**
 * "Last sent Friday 16 October by Ada", or "Sent when the session closed".
 * A send that put no email on its way says so instead. One still going out
 * (`queued` null) reads as sent.
 */
export function lastSendLine(last: LastSend, today: string): string | null {
  if (!last) return null;
  const nothing = last.queued === 0;
  if (last.sendNo === 1 && !last.byName) return nothing ? taskWords().mail.triedAtClose : taskWords().mail.sentAtClose;
  const at = Date.parse(last.at);
  const when = Number.isFinite(at) ? taskDateWords(roomDay(at), today) : "";
  const name = last.byName ?? SESSION_SOMEONE;
  return nothing ? taskWords().mail.lastTried(when, name) : taskWords().mail.lastSent(when, name);
}

export default function TaskMailButton({
  sessionId,
  today,
  lastSend,
  onSent,
}: {
  sessionId: number;
  today: string;
  lastSend: LastSend;
  /** The send landed: the record reads its tasks and its last send again. */
  onSent?: (result: TaskMailResult) => void;
}) {
  const RC = useRoomWords();
  const TW = useTaskWords();
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await gameFetch(taskEmailsUrl(sessionId), { method: "POST", body: "{}" });
      const body = (await res.json().catch(() => null)) as (TaskMailResult & { error?: string }) | null;
      if (!res.ok || !body || typeof body.queued !== "number") {
        setError(typeof body?.error === "string" ? body.error : RC.writeFailed);
        return;
      }
      setResult(TW.mail.result(body.queued, body.people, splitMailSkips(body.skipped ?? {})));
      setAsking(false);
      onSent?.(body);
    } catch {
      setError(RC.offline);
    } finally {
      setSending(false);
    }
  };

  const last = lastSendLine(lastSend, today);

  return (
    <div className="space-y-2" data-task-mail="">
      {asking ? (
        <div className="space-y-2">
          <p className="text-sm text-foreground">{TW.mail.confirm}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BTN_SECONDARY} disabled={sending} aria-busy={sending} onClick={() => void send()}>
              {sending ? TW.mail.sending : TW.mail.confirmButton}
            </button>
            <button type="button" className={BTN_QUIET} disabled={sending} onClick={() => setAsking(false)}>
              {TW.mail.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={BTN_SECONDARY}
          onClick={() => {
            setResult(null);
            setError(null);
            setAsking(true);
          }}
        >
          {TW.mail.button}
        </button>
      )}
      {result && (
        <p role="status" className="text-sm text-foreground">
          {result}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {last && <p className={HINT}>{last}</p>}
    </div>
  );
}
