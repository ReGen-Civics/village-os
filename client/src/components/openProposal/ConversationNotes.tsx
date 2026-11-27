/**
 * EACH CONVERSATION'S NOTES on the team's walkthrough (shared/conversationNotes.ts; the lead, 27 Nov 2026: "this
 * section is where the conversation notes are held ... where we can have whatever notes we want, or upload the whole
 * transcript and more for the conversation").
 *
 * ONE PLACE FOR NOTES (QA round 1): the conversation guide's questions, drawn ONCE above the list (QA round 2: one
 * copy per conversation repeated its boxes, and a stale copy could overwrite a note), then each conversation the
 * reader may read with its notes and files and, behind one "Add a note or file" button, the box to write a note and
 * the picker for a transcript, a recording or a document. Quiet rows, never a box inside a box. Never shown to the applicant: the
 * walkthrough door answers them 404, so this panel never draws. Nothing here is scored, ranked or read by an AI.
 *
 * A file opens through its own door, which asks who the reader is again, so the bytes are fetched with the reader's
 * sign-in and handed over as a download. No address that works without signing in ever reaches the page.
 */
import { useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { authToken, gameFetch } from "@/lib/gameApi";
import { BTN_NOTICE, BTN_SECONDARY, EYEBROW, FIELD, H2, HINT, LABEL } from "@/components/journey/look";
import { CONVERSATION_NOTE_MAX, type ConversationNoteKind, type ConversationNotesView, type ServedNote } from "@shared/conversationNotes";
import type { GuideView } from "@shared/conversationGuide";
import { GuideLine, useGuideQuestion } from "@/components/openProposal/ConversationGuide";

type FileKind = Exclude<ConversationNoteKind, "text">;
const FILE_KINDS: readonly FileKind[] = ["transcript", "recording", "file"];

/** The anchor the interviewers' bell notice lands on (server/lib/applicantOnboarding.ts `notesHref`). */
export const CONVERSATION_NOTES_ID = "conversation-notes";

/** A served day (YYYY-MM-DD) said in the reader's language, as a long date. */
export function useDayWords(): (day: string) => string {
  const { i18n } = useLingui();
  return (day: string) => {
    const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? day : i18n.date(d, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  };
}

export default function ConversationNotes({
  base,
  conversations,
  guide = null,
  onSaved,
}: {
  base: string;
  conversations: ConversationNotesView[];
  /** The conversation guide's questions, drawn once above the conversations. */
  guide?: GuideView | null;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const question = useGuideQuestion();
  if (!conversations.length) return null;
  return (
    <section id={CONVERSATION_NOTES_ID} aria-labelledby="conversation-notes-heading" className="mt-6 min-w-0 scroll-mt-24" data-walk-conversation-notes="">
      <p className={EYEBROW}>{t({ message: "Private to the team", context: "conversation notes: the kicker" })}</p>
      <h3 id="conversation-notes-heading" className={`mt-1 ${H2}`}>
        {t({ message: "Conversation notes", context: "conversation notes: the heading" })}
      </h3>
      <p className={`mt-1 ${HINT}`}>
        {t({
          message: "Private to the people who hold each conversation, the role that makes the final call, and the people who place roles. Never shown to the applicant. No AI reads them.",
          context: "conversation notes: who reads them",
        })}
      </p>
      {guide && guide.items.length > 0 && (
        <details className="mt-3 min-w-0" data-conversation-guide="">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-foreground">
            {t({ message: "Questions to talk through", context: "conversation notes: the guide's questions, folded in" })}
          </summary>
          <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-border/60">
            {guide.items.map((i) => (
              <GuideLine key={i.key} item={i} q={question(i)} base={base} notes={guide.notes.filter((x) => x.key === i.key)} onSaved={onSaved} quiet />
            ))}
          </ul>
        </details>
      )}
      <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] divide-y divide-border">
        {conversations.map((c) => (
          <Conversation key={c.interviewId} base={base} c={c} onSaved={onSaved} />
        ))}
      </ul>
    </section>
  );
}

function Conversation({ base, c, onSaved }: { base: string; c: ConversationNotesView; onSaved: () => void }) {
  const { t } = useLingui();
  const day = useDayWords();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<FileKind>("transcript");
  const [chosen, setChosen] = useState<string>("");
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
      setChosen("");
      onSaved();
    }
  };

  const remove = async (n: ServedNote): Promise<boolean> => {
    setBusy(true);
    const res = await gameFetch(`${base}/conversation-notes/${n.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) onSaved();
    else setSaid({ ok: false, text: failed });
    return !!res?.ok;
  };

  return (
    <li className="min-w-0 py-4" data-conversation={c.interviewId}>
      <p className="font-display text-lg font-semibold text-foreground">{c.label}</p>
      {c.notes.length === 0 ? (
        <p className={`mt-1 ${HINT}`}>{t({ message: "No notes yet.", context: "conversation notes: empty" })}</p>
      ) : (
        <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] divide-y divide-border/60">
          {c.notes.map((n) => (
            <NoteRow key={n.id} n={n} kind={kindWords[n.kind]} on={day(n.on)} busy={busy} onRemove={remove} />
          ))}
        </ul>
      )}

      {!adding ? (
        <button type="button" className={`mt-3 ${BTN_NOTICE}`} onClick={() => setAdding(true)} data-conversation-add="">
          {t({ message: "Add a note or file", context: "conversation notes: opens the note box and the file picker" })}
        </button>
      ) : (
        <div className="mt-3 grid min-w-0 gap-3" data-conversation-form="">
          <div className="grid min-w-0 gap-1">
            <label htmlFor={textId} className={LABEL}>
              {t({ message: "Write a note", context: "conversation notes: the note box" })}
            </label>
            <textarea id={textId} className={`min-h-24 w-full min-w-0 ${FIELD}`} maxLength={CONVERSATION_NOTE_MAX} value={text} onChange={(e) => setText(e.target.value)} data-note-field="" />
            <button type="button" className={`justify-self-start ${BTN_SECONDARY}`} disabled={busy || !text.trim()} onClick={() => void saveText()}>
              {t({ message: "Save the note", context: "conversation notes: save a written note" })}
            </button>
          </div>

          <fieldset className="grid min-w-0 gap-2">
            <legend className={LABEL}>{t({ message: "Add a file", context: "conversation notes: the file picker" })}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1" role="radiogroup">
              {FILE_KINDS.map((k) => (
                <label key={k} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                  <input type="radio" name={`conv-kind-${c.interviewId}`} value={k} checked={kind === k} onChange={() => setKind(k)} />
                  {kindWords[k]}
                </label>
              ))}
            </div>
            {/* The picker drawn as a button; the input itself is visually hidden but kept for keyboards and screen readers.
                The input comes first so its label can show the keyboard's focus ring (QA round 2: peer-focus-visible). */}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <input id={fileId} ref={fileRef} type="file" className="peer sr-only w-full min-w-0" onChange={(e) => setChosen(e.target.files?.[0]?.name ?? "")} />
              <label htmlFor={fileId} className={`${BTN_SECONDARY} cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-notice peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background`} data-file-choose="">
                {t({ message: "Choose the file", context: "conversation notes: the file input" })}
              </label>
              {chosen ? <span className="min-w-0 break-all text-sm text-foreground">{chosen}</span> : null}
            </div>
            <button type="button" className={`justify-self-start ${BTN_SECONDARY}`} disabled={busy || !chosen} onClick={() => void sendFile()}>
              {t({ message: "Add the file", context: "conversation notes: send the chosen file" })}
            </button>
          </fieldset>
          <button type="button" className={`justify-self-start ${BTN_SECONDARY}`} onClick={() => setAdding(false)}>
            {t({ message: "Done", context: "conversation notes: closes the note box" })}
          </button>
        </div>
      )}
      {said?.text && <p role={said.ok ? "status" : "alert"} className={`mt-2 text-sm ${said.ok ? "text-foreground" : "text-destructive"}`}>{said.text}</p>}
    </li>
  );
}

/** One note or file as a quiet row, with "Take it off" asking once before it goes. */
function NoteRow({ n, kind, on, busy, onRemove }: { n: ServedNote; kind: string; on: string; busy: boolean; onRemove: (n: ServedNote) => Promise<boolean> }) {
  const { t } = useLingui();
  const [asking, setAsking] = useState(false);
  return (
    <li className="min-w-0 py-3" data-conversation-note={n.kind}>
      <p className={LABEL}>
        {kind} · {n.author} · {on}
      </p>
      {n.body !== null ? <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{n.body}</p> : null}
      {n.fileHref ? <FileOpen href={n.fileHref} name={n.fileName ?? kind} /> : null}
      {n.mine ? (
        asking ? (
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" data-note-confirm="">
            <span className="text-sm text-foreground">{t({ message: "Take this off for good?", context: "conversation notes: confirm before deleting" })}</span>
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void onRemove(n).then(() => setAsking(false))}>
              {t({ message: "Yes, take it off", context: "conversation notes: confirm the delete" })}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setAsking(false)}>
              {t({ message: "Keep it", context: "conversation notes: cancel the delete" })}
            </button>
          </div>
        ) : (
          <button type="button" className={`mt-2 ${BTN_SECONDARY}`} disabled={busy} onClick={() => setAsking(true)}>
            {t({ message: "Take it off", context: "conversation notes: the author removes their note" })}
          </button>
        )
      ) : null}
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
    <p className="mt-1 min-w-0">
      <button type="button" className="inline-flex min-h-11 max-w-full items-center break-all text-left font-medium text-foreground underline underline-offset-4" onClick={() => void open()} data-conversation-file="">
        {name}
      </button>
      {failed ? <span role="alert" className="ml-2 text-sm text-destructive">{t({ message: "That file did not open.", context: "conversation notes: a file failed to open" })}</span> : null}
    </p>
  );
}
