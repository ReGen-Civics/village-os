/**
 * EACH CONVERSATION'S NOTES on the team's walkthrough (shared/conversationNotes.ts; the lead, 27 Nov 2026: "this
 * section is where the conversation notes are held ... where we can have whatever notes we want, or upload the whole
 * transcript and more for the conversation").
 *
 * One block per conversation the reader may read: the written notes and files, oldest first, a box to write a note,
 * and a file picker for a transcript, a recording or a document. Never shown to the applicant: the walkthrough door
 * answers them 404, so this panel never draws. Notes only. Nothing here is scored, ranked or read by an AI.
 *
 * A file opens through its own door, which asks who the reader is again, so the bytes are fetched with the reader's
 * sign-in and handed over as a download. No address that works without signing in ever reaches the page.
 */
import { useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { authToken, gameFetch } from "@/lib/gameApi";
import { BTN_SECONDARY, FIELD, HINT, LABEL, TILE } from "@/components/journey/look";
import { CONVERSATION_NOTE_MAX, type ConversationNoteKind, type ConversationNotesView, type ServedNote } from "@shared/conversationNotes";

type FileKind = Exclude<ConversationNoteKind, "text">;
const FILE_KINDS: readonly FileKind[] = ["transcript", "recording", "file"];

export default function ConversationNotes({ base, conversations, onSaved }: { base: string; conversations: ConversationNotesView[]; onSaved: () => void }) {
  const { t } = useLingui();
  if (!conversations.length) return null;
  return (
    <section className="mt-6" data-walk-conversation-notes="">
      <h3 className="font-display text-xl font-bold text-foreground">{t({ message: "Conversation notes", context: "conversation notes: the heading" })}</h3>
      <p className={`mt-1 ${HINT}`}>
        {t({
          message: "Private to the people who hold each conversation, the role that makes the final call, and the people who place roles. Never shown to the applicant. No AI reads them.",
          context: "conversation notes: who reads them",
        })}
      </p>
      <ul className="mt-3 grid gap-3">
        {conversations.map((c) => (
          <Conversation key={c.interviewId} base={base} c={c} onSaved={onSaved} />
        ))}
      </ul>
    </section>
  );
}

function Conversation({ base, c, onSaved }: { base: string; c: ConversationNotesView; onSaved: () => void }) {
  const { t } = useLingui();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<FileKind>("transcript");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const kindWords: Record<ConversationNoteKind, string> = {
    text: t({ message: "Note", context: "conversation notes: a written note" }),
    transcript: t({ message: "Transcript", context: "conversation notes: a file kind" }),
    recording: t({ message: "Recording", context: "conversation notes: a file kind" }),
    file: t({ message: "File", context: "conversation notes: a file kind" }),
  };
  const failed = t({ message: "That did not go through. Try again.", context: "conversation notes: a save failed" });
  const textId = `conv-note-${c.interviewId}`;
  const fileId = `conv-file-${c.interviewId}`;

  const saveText = async () => {
    setBusy(true);
    setSaid(null);
    const res = await gameFetch(`${base}/interviews/${c.interviewId}/notes`, { method: "POST", body: JSON.stringify({ body: text }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    setSaid({ ok: !!res?.ok, text: String(data?.message ?? (res?.ok ? "" : failed)) });
    if (res?.ok) {
      setText("");
      onSaved();
    }
  };

  const sendFile = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setBusy(true);
    setSaid(null);
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", f);
    const token = authToken();
    const res = await fetch(`${base}/interviews/${c.interviewId}/notes`, { method: "POST", body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    setSaid({ ok: !!res?.ok, text: String(data?.message ?? (res?.ok ? "" : failed)) });
    if (res?.ok) {
      if (fileRef.current) fileRef.current.value = "";
      onSaved();
    }
  };

  const remove = async (n: ServedNote) => {
    setBusy(true);
    const res = await gameFetch(`${base}/conversation-notes/${n.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) onSaved();
    else setSaid({ ok: false, text: failed });
  };

  return (
    <li className={TILE} data-conversation={c.interviewId}>
      <p className="font-semibold text-foreground">{c.label}</p>
      {c.notes.length === 0 ? (
        <p className={`mt-1 ${HINT}`}>{t({ message: "No notes yet.", context: "conversation notes: empty" })}</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {c.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border p-3" data-conversation-note={n.kind}>
              <p className={LABEL}>
                {kindWords[n.kind]} · {n.author} · {n.on}
              </p>
              {n.body !== null ? <p className="mt-1 whitespace-pre-wrap text-foreground">{n.body}</p> : null}
              {n.fileHref ? <FileOpen href={n.fileHref} name={n.fileName ?? kindWords[n.kind]} /> : null}
              {n.mine ? (
                <button type="button" className={`mt-2 ${BTN_SECONDARY}`} disabled={busy} onClick={() => void remove(n)}>
                  {t({ message: "Take it off", context: "conversation notes: the author removes their note" })}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <label htmlFor={textId} className={`mt-3 block ${LABEL}`}>
        {t({ message: "Write a note", context: "conversation notes: the note box" })}
      </label>
      <textarea id={textId} className={`mt-1 min-h-24 w-full ${FIELD}`} maxLength={CONVERSATION_NOTE_MAX} value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className={`mt-2 ${BTN_SECONDARY}`} disabled={busy || !text.trim()} onClick={() => void saveText()}>
        {t({ message: "Save the note", context: "conversation notes: save a written note" })}
      </button>

      <fieldset className="mt-4 grid gap-2">
        <legend className={LABEL}>{t({ message: "Add a file", context: "conversation notes: the file picker" })}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {FILE_KINDS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input type="radio" name={`conv-kind-${c.interviewId}`} value={k} checked={kind === k} onChange={() => setKind(k)} />
              {kindWords[k]}
            </label>
          ))}
        </div>
        <input id={fileId} ref={fileRef} type="file" className="text-sm text-foreground" aria-label={t({ message: "Choose the file", context: "conversation notes: the file input" })} />
        <button type="button" className={`justify-self-start ${BTN_SECONDARY}`} disabled={busy} onClick={() => void sendFile()}>
          {t({ message: "Add the file", context: "conversation notes: send the chosen file" })}
        </button>
      </fieldset>
      {said?.text && <p role={said.ok ? "status" : "alert"} className={`mt-2 text-sm ${said.ok ? "text-foreground" : "text-destructive"}`}>{said.text}</p>}
    </li>
  );
}

/** A file is fetched with the reader's own sign-in, then handed over as a download. */
function FileOpen({ href, name }: { href: string; name: string }) {
  const { t } = useLingui();
  const [failed, setFailed] = useState(false);
  const open = async () => {
    setFailed(false);
    const token = authToken();
    const res = await fetch(href, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setFailed(true);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  return (
    <p className="mt-1">
      <button type="button" className="text-left font-medium text-foreground underline underline-offset-4" onClick={() => void open()} data-conversation-file="">
        {name}
      </button>
      {failed ? <span role="alert" className="ml-2 text-sm text-destructive">{t({ message: "That file did not open.", context: "conversation notes: a file failed to open" })}</span> : null}
    </p>
  );
}
