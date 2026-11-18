/**
 * HAND A TASK TO A ROLE, on Your list (shared/roleTaskHandoff.ts holds the
 * contract): a short form to send a new task to one of the village's live
 * roles, and "Sent", what you handed on and where each one stands.
 *
 * The form names roles only, read live from the server. What you send waits
 * on the role's holder under their Waiting on you until somebody there
 * accepts it, suggests a change, or declines it. Nothing accepts on its own.
 *
 * `refresh` changes whenever the list around it changed (a task handed on
 * from a row), so Sent reads again.
 */
import { useCallback, useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { toast } from "sonner";
import { HANDOFF_LIMITS, type SentHandoff } from "@shared/roleTaskHandoff";
import { civilDayWords } from "@shared/seasonPlans";
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, HINT, LABEL_CAPS } from "@/components/sessions/roomUi";
import { readSent, sendHandoff, withdrawHandoff } from "./handoffApi";
import { readTargets } from "./yourListApi";

const FIELD = "mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground";

/** One line of where a sent task stands. */
function useStatusLine() {
  const { t } = useLingui();
  return (h: SentHandoff): string => {
    const role = h.role;
    switch (h.status) {
      case "waiting":
        return h.edited ? t({ message: `${role} suggested a change. Still waiting.`, context: "task handed to a role" }) : t({ message: `Waiting for ${role}`, context: "task handed to a role" });
      case "accepted":
        return t({ message: `Accepted by ${role}`, context: "task handed to a role" });
      case "done":
        return t({ message: `Done by ${role}`, context: "task handed to a role" });
      case "declined":
        return t({ message: `Declined by ${role}`, context: "task handed to a role" });
      case "withdrawn":
        return t({ message: `You took it back`, context: "task handed to a role" });
    }
  };
}

export function SentRow({ h, onChanged }: { h: SentHandoff; onChanged: () => void }) {
  const { t } = useLingui();
  const line = useStatusLine();
  const [busy, setBusy] = useState(false);
  const takeBack = async () => {
    setBusy(true);
    const r = await withdrawHandoff(h.id);
    setBusy(false);
    if (!r.ok) toast.error(r.error ?? t({ message: `That did not save. Try again.`, context: "task handed to a role" }));
    onChanged();
  };
  const by = h.dueOn ? civilDayWords(h.dueOn) : "";
  return (
    <li className="rounded-xl border border-border bg-muted px-3.5 py-3 text-foreground" data-sent-handoff={h.status}>
      <p className="break-words text-base">{h.title}</p>
      <p className={`${HINT} mt-1`}>
        {line(h)}
        {by ? ` · ${t({ message: `By ${by}`, context: "task handed to a role" })}` : ""}
      </p>
      {h.status === "declined" && h.reason && <p className={`${HINT} mt-1 whitespace-pre-line`}>{t({ message: `Why: ${h.reason}`, context: "task handed to a role" })}</p>}
      {h.status === "waiting" && h.note && <p className={`${HINT} mt-1 whitespace-pre-line`}>{h.note}</p>}
      {h.status === "waiting" && (
        <button type="button" className={`${BTN_QUIET} mt-1`} disabled={busy} onClick={() => void takeBack()}>
          {t({ message: `Take it back`, context: "task handed to a role" })}
        </button>
      )}
    </li>
  );
}

export default function RoleHandoffs({ refresh = 0 }: { refresh?: number }) {
  const { t } = useLingui();
  const ids = useId();
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [sent, setSent] = useState<SentHandoff[] | null>(null);
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => setSent(await readSent()), []);
  useEffect(() => {
    void load();
  }, [load, refresh]);
  useEffect(() => {
    if (open && !roles.length) void readTargets().then((x) => setRoles(x.roles));
  }, [open, roles.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleId || !title.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    const r = await sendHandoff({ roleId, title: title.trim(), note: note.trim(), dueOn });
    setBusy(false);
    if (!r.ok) return setProblem(r.error ?? t({ message: `That did not save. Try again.`, context: "task handed to a role" }));
    toast.success(t({ message: `Sent. It waits for the role to accept it.`, context: "task handed to a role" }));
    setTitle("");
    setNote("");
    setDueOn("");
    setRoleId("");
    setOpen(false);
    await load();
  };

  return (
    <div className="mt-5" data-role-handoffs>
      {!open ? (
        <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(true)}>
          {t({ message: `Hand a task to a role`, context: "task handed to a role" })}
        </button>
      ) : (
        <form className="rounded-xl border border-border bg-background p-3" onSubmit={send} aria-labelledby={`${ids}-h`}>
          <h3 id={`${ids}-h`} className={LABEL_CAPS}>
            {t({ message: `Hand a task to a role`, context: "task handed to a role" })}
          </h3>
          <label className="mt-2 block">
            <span className={LABEL_CAPS}>{t({ message: `Role`, context: "task handed to a role" })}</span>
            <select className={FIELD} value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
              <option value="">{t({ message: `Choose a role`, context: "task handed to a role" })}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block">
            <span className={LABEL_CAPS}>{t({ message: `Task`, context: "task handed to a role" })}</span>
            <input className={FIELD} value={title} maxLength={HANDOFF_LIMITS.title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="mt-2 block">
            <span className={LABEL_CAPS}>{t({ message: `A note (optional)`, context: "task handed to a role" })}</span>
            <textarea className={`${FIELD} min-h-20 py-2`} maxLength={HANDOFF_LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="mt-2 block">
            <span className={LABEL_CAPS}>{t({ message: `By when (optional)`, context: "task handed to a role" })}</span>
            <input type="date" className={FIELD} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </label>
          <p className={`${HINT} mt-2`}>{t({ message: `Whoever holds the role sees it under Waiting on you and accepts it, suggests a change, or declines it.`, context: "task handed to a role" })}</p>
          {problem && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {problem}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" className={BTN_PRIMARY} disabled={busy || !roleId || !title.trim()}>
              {t({ message: `Send`, context: "task handed to a role" })}
            </button>
            <button type="button" className={BTN_QUIET} onClick={() => setOpen(false)}>
              {t({ message: `Cancel`, context: "task handed to a role" })}
            </button>
          </div>
        </form>
      )}
      {sent === null ? (
        <p className={`${HINT} mt-3`}>{t({ message: `What you sent did not load.`, context: "task handed to a role" })}</p>
      ) : sent.length > 0 ? (
        <div className="mt-4">
          <h3 className={LABEL_CAPS}>{t({ message: `Sent`, context: "task handed to a role" })}</h3>
          <ul className="mt-1 space-y-2">
            {sent.map((h) => (
              <SentRow key={h.id} h={h} onChanged={() => void load()} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
