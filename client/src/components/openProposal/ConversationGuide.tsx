/**
 * THE CONVERSATION GUIDE on a reviewer's walkthrough (shared/conversationGuide.ts): the role card's
 * selection criteria and qualities, worded as questions, with a notes box under each. Notes only.
 * There is no score, level, rank or rating here, and nothing is totalled or compared. Read by the
 * reviewers and the final-call role; the notes go when the application's review does.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { BTN_SECONDARY, FIELD, HINT, LABEL, TILE } from "@/components/journey/look";
import { GUIDE_LIMITS, type GuideItem, type GuideView } from "@shared/conversationGuide";

/** A guide line said as a question, in the reader's language. Shared with each conversation's notes (QA round 1). */
export function useGuideQuestion(): (i: GuideItem) => string {
  const { t } = useLingui();
  return (i: GuideItem): string =>
    i.kind === "criterion"
      ? t({ message: `What have you heard or seen that speaks to this: ${i.text}?`, context: "conversation guide: a question made from a selection criterion" })
      : t({ message: `How did this quality show in the conversation: ${i.text}?`, context: "conversation guide: a question made from a quality the card hopes for" });
}

export default function ConversationGuide({ base, guide, onSaved }: { base: string; guide: GuideView; onSaved: () => void }) {
  const { t } = useLingui();
  const question = useGuideQuestion();
  return (
    <section className="mt-6" data-walk-guide="">
      <h3 className="font-display text-xl font-bold text-foreground">{t({ message: "Conversation guide", context: "conversation guide: the heading" })}</h3>
      <p className={`mt-1 ${HINT}`}>
        {t({
          message: "Questions from the role card to talk through. Write notes for yourself and the other reviewers. Nothing here is scored or ranked, and the notes are deleted with the application.",
          context: "conversation guide: what it is",
        })}
      </p>
      <ul className="mt-3 grid gap-3">
        {guide.items.map((i) => (
          <GuideLine key={i.key} item={i} q={question(i)} base={base} notes={guide.notes.filter((n) => n.key === i.key)} onSaved={onSaved} />
        ))}
      </ul>
    </section>
  );
}

/** One guide question with the reader's note and the others'. `quiet` draws it as a row inside a conversation, not a box. */
export function GuideLine({ item, q, base, notes, onSaved, quiet = false }: { item: GuideItem; q: string; base: string; notes: GuideView["notes"]; onSaved: () => void; quiet?: boolean }) {
  const { t } = useLingui();
  const mine = notes.find((n) => n.mine);
  const others = notes.filter((n) => !n.mine);
  const [text, setText] = useState(mine?.note ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const save = async () => {
    setState("saving");
    try {
      const r = await gameFetch(`${base}/guide-notes`, { method: "POST", body: JSON.stringify({ key: item.key, note: text }) });
      setState(r.ok ? "saved" : "failed");
      if (r.ok) onSaved();
    } catch {
      setState("failed");
    }
  };
  const id = `guide-${item.key.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <li className={quiet ? "min-w-0 py-3" : TILE} data-walk-guide-line={item.key}>
      <label htmlFor={id} className={LABEL}>
        {q}
      </label>
      <textarea id={id} className={`${FIELD} mt-2 min-h-20`} value={text} maxLength={GUIDE_LIMITS.note} onChange={(e) => { setText(e.target.value); setState("idle"); }} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_SECONDARY} disabled={state === "saving"} onClick={() => void save()}>
          {t({ message: "Save my note", context: "conversation guide: save" })}
        </button>
        {state === "saved" && <span className={HINT}>{t({ message: "Saved.", context: "conversation guide: saved" })}</span>}
        {state === "failed" && (
          <span role="alert" className="text-sm text-destructive">
            {t({ message: "That did not save. Try again.", context: "conversation guide: failed" })}
          </span>
        )}
      </div>
      {others.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm">
          {others.map((n, k) => (
            <li key={`${n.by}-${k}`} className="whitespace-pre-wrap break-words text-foreground">
              <span className="font-semibold">{n.by}</span>: {n.note}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
