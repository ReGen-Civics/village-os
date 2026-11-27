/**
 * HOW TO DO THIS QUEST, step by step, and what you gave for each (0439; the
 * lead, 27 Nov 2026: "Yes to submit data (pictures docs text etc) for each step
 * if needed").
 *
 * Everybody reads the steps, and a step that needs a submission says so. The
 * member holding the quest also sees what they gave for each step and, while
 * the quest is in their hands, adds words, a photo or a document, or takes a
 * piece off. Once turned in the pieces are the steward's to read, so they show
 * without the buttons until the member takes the work back.
 *
 * A photo is shrunk in the browser first (lib/imagePrep.ts) and stripped on the
 * server like every other upload; a document goes as it is (a PDF or a picture
 * of the page).
 */
import { useEffect, useRef, useState } from "react";
import { FileText, ImagePlus, Trash2 } from "lucide-react";
import { authToken, gameFetch, type QuestClaim } from "@/lib/gameApi";
import { prepareImageForUpload } from "@/lib/imagePrep";
import { useLingui } from "@lingui/react/macro";

export interface StepSubmissionView {
  id: string;
  stepIndex: number;
  kind: "text" | "photo" | "document";
  body: string | null;
  fileUrl: string | null;
  originalName: string | null;
  createdAt: string | null;
}

/** Read the member's own pieces on their open claim. Null while signed out or holding nothing. */
export function useStepSubmissions(questId: string, claim: QuestClaim | undefined) {
  const [rows, setRows] = useState<StepSubmissionView[]>([]);
  const holding = claim?.status === "claimed" || claim?.status === "submitted";
  const reload = () => {
    if (!holding) {
      setRows([]);
      return;
    }
    gameFetch(`/api/game/quests/${encodeURIComponent(questId)}/steps`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(Array.isArray(d?.submissions) ? d.submissions : []))
      .catch(() => setRows([]));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [questId, holding, claim?.id, claim?.status]);
  return { rows, reload };
}

function StepAdd({ questId, index, onAdded }: { questId: string; index: number; onAdded: () => void }) {
  const { t } = useLingui();
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const photo = useRef<HTMLInputElement>(null);
  const doc = useRef<HTMLInputElement>(null);
  const failed = t({ message: "That didn't go through. Try again.", context: "quest step: adding to a step failed" });

  const addWords = async () => {
    if (!words.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await gameFetch(`/api/game/quests/${encodeURIComponent(questId)}/steps/${index}`, { method: "POST", body: JSON.stringify({ body: words }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? failed);
      else {
        setWords("");
        onAdded();
      }
    } catch {
      setError(failed);
    }
    setBusy(false);
  };

  const addFile = async (kind: "photo" | "document", picked: File | undefined) => {
    if (!picked) return;
    setBusy(true);
    setError("");
    try {
      const file = kind === "photo" && picked.type.startsWith("image/") ? (await prepareImageForUpload(picked, { maxEdge: 2000 })).file : picked;
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file, file.name);
      const token = authToken();
      const res = await fetch(`/api/game/quests/${encodeURIComponent(questId)}/steps/${index}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? failed);
      else onAdded();
    } catch {
      setError(failed);
    }
    if (photo.current) photo.current.value = "";
    if (doc.current) doc.current.value = "";
    setBusy(false);
  };

  return (
    <div className="mt-3 space-y-2" data-step-add={index}>
      <label className="block text-xs text-muted-foreground">
        {t({ message: "Add a few words for this step", context: "quest step: the words box" })}
        <textarea
          value={words}
          onChange={(e) => setWords(e.target.value)}
          rows={2}
          maxLength={4000}
          className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-teal-deep"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addWords}
          disabled={busy || !words.trim()}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          {t({ message: "Add these words", context: "quest step: save the words" })}
        </button>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">
          <ImagePlus className="size-4" aria-hidden="true" />
          {t({ message: "Add a photo", context: "quest step: upload a photo" })}
          <input ref={photo} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => addFile("photo", e.target.files?.[0])} />
        </label>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">
          <FileText className="size-4" aria-hidden="true" />
          {t({ message: "Add a document", context: "quest step: upload a document" })}
          <input ref={doc} type="file" accept="application/pdf,image/*" className="sr-only" disabled={busy} onChange={(e) => addFile("document", e.target.files?.[0])} />
        </label>
      </div>
      {busy && <p className="text-xs text-muted-foreground">{t({ message: "Saving…", context: "quest step: a piece is being saved" })}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Piece({ s, canRemove, onRemove }: { s: StepSubmissionView; canRemove: boolean; onRemove: (id: string) => void }) {
  const { t } = useLingui();
  return (
    <li className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm" data-step-piece={s.kind}>
      <span className="min-w-0 flex-1">
        {s.kind === "text" ? (
          <span className="whitespace-pre-wrap text-foreground">{s.body}</span>
        ) : s.kind === "photo" && s.fileUrl ? (
          <a href={s.fileUrl} target="_blank" rel="noreferrer" className="inline-block">
            <img src={s.fileUrl} alt={t({ message: "A photo you added for this step", context: "quest step: a photo's alt text" })} className="max-h-40 rounded-lg" loading="lazy" />
          </a>
        ) : s.fileUrl ? (
          <a href={s.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-teal-deep underline underline-offset-2">
            <FileText className="size-4" aria-hidden="true" />
            {s.originalName || t({ message: "A document", context: "quest step: a document with no name" })}
          </a>
        ) : null}
      </span>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(s.id)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={t({ message: "Take this off the step", context: "quest step: remove a piece" })}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export default function QuestSteps({
  questId,
  steps,
  stepNeeds,
  claim,
  rows,
  reload,
}: {
  questId: string;
  steps: string[];
  stepNeeds: boolean[];
  claim: QuestClaim | undefined;
  rows: StepSubmissionView[];
  reload: () => void;
}) {
  const { t } = useLingui();
  const [error, setError] = useState("");
  const inHand = claim?.status === "claimed";
  const holding = inHand || claim?.status === "submitted";

  const remove = async (id: string) => {
    setError("");
    try {
      const res = await gameFetch(`/api/game/quests/${encodeURIComponent(questId)}/steps/submissions/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? t({ message: "That didn't go through. Try again.", context: "quest step: removing a piece failed" }));
      }
    } catch {
      setError(t({ message: "That didn't go through. Try again.", context: "quest step: removing a piece failed" }));
    }
    reload();
  };

  return (
    <>
      <ol className="space-y-3">
        {steps.map((step, i) => {
          const mine = rows.filter((r) => r.stepIndex === i);
          const needed = stepNeeds[i] === true;
          return (
            <li key={i} className="flex gap-3 bg-card border border-border rounded-xl p-4" data-step={i}>
              <span className="shrink-0 w-7 h-7 rounded-full bg-teal-deep text-white text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground/90 leading-relaxed pt-0.5">{step}</p>
                {needed && (
                  <p className="mt-1 text-xs font-semibold text-notice" data-step-needs>
                    {holding && mine.length > 0
                      ? t({ message: "Done: you added something for this step.", context: "quest step: a needed step that has a submission" })
                      : t({ message: "This step needs a photo, a document or a few words from you.", context: "quest step: a step that needs a submission" })}
                  </p>
                )}
                {holding && mine.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {mine.map((s) => (
                      <Piece key={s.id} s={s} canRemove={inHand} onRemove={remove} />
                    ))}
                  </ul>
                )}
                {inHand && <StepAdd questId={questId} index={i} onAdded={reload} />}
              </div>
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </>
  );
}
