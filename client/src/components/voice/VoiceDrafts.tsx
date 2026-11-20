/**
 * YOUR ANSWERS, DRAFTED FROM WHAT YOU SAID (Rye, 14 Nov 2026; the contract is
 * shared/voiceDrafts.ts). Inside the voice card, under the words heard.
 *
 * One button sends the words heard (never the recording) and the role to the
 * one door, server/routes/openProposalVoiceDraft.ts; the sentence under it says
 * exactly what goes. The drafts come back here, each in its own box to edit,
 * and reach the form only when the applicant presses "Use this". Only answers
 * still empty are offered a draft, so their own words are never replaced.
 * Typing works whatever happens here.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Check, Sparkles } from "lucide-react";
import GrowingField from "@/components/form/GrowingField";
import { BTN_SECONDARY, FIELD, HINT, LABEL } from "@/components/journey/look";
import { OPEN_AIM_MAX, OPEN_WHY_MAX } from "@shared/openProposals";
import { ABOUT_STORY_MAX } from "@shared/proposalAbout";
import { GOAL_LIMITS } from "@shared/proposalGoals";
import { VOICE_DRAFT_INPUT_MIN, VOICE_DRAFT_WORDS, type VoiceDraft, type VoiceDraftItem } from "@shared/voiceDrafts";

type Part = "why" | "aim" | "story" | "items";

export interface VoiceDrafting {
  roleId: string;
  /** The link made for one person, when the form was opened through one. */
  link?: string;
  /** Which answers are still empty: only those are offered a draft. */
  empty: Record<Part, boolean>;
  /** Put one confirmed draft into the form. */
  onUse: (part: VoiceDraft) => void;
}

/** What came back, kept to the answers still empty. */
export function offeredParts(draft: VoiceDraft, empty: Record<Part, boolean>): VoiceDraft {
  return {
    ...(draft.why && empty.why ? { why: draft.why } : {}),
    ...(draft.aim && empty.aim ? { aim: draft.aim } : {}),
    ...(draft.story && empty.story ? { story: draft.story } : {}),
    ...(draft.items?.length && empty.items ? { items: draft.items } : {}),
  };
}

const BTN = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-notice px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50";

export function VoiceDrafts({ heard, drafting }: { heard: string; drafting: VoiceDrafting }) {
  const { t } = useLingui();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [used, setUsed] = useState<Part[]>([]);
  if (heard.trim().length < VOICE_DRAFT_INPUT_MIN) return null;

  const press = async () => {
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/open-proposals/voice-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: drafting.roleId, heard, ...(drafting.link ? { link: drafting.link } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setSaid(typeof data?.error === "string" ? data.error : VOICE_DRAFT_WORDS.unavailable);
      const offered = offeredParts((data?.draft ?? {}) as VoiceDraft, drafting.empty);
      if (!Object.keys(offered).length) return setSaid(VOICE_DRAFT_WORDS.nothing);
      setDraft(offered);
      setUsed([]);
    } catch {
      setSaid(VOICE_DRAFT_WORDS.unavailable);
    } finally {
      setBusy(false);
    }
  };

  const use = (part: Part) => {
    if (!draft || used.includes(part)) return;
    const value = part === "items" ? (draft.items ?? []).filter((g) => g.title.trim() && g.doneWhen.trim()) : String(draft[part] ?? "").trim();
    if (!value.length) return;
    drafting.onUse({ [part]: value } as VoiceDraft);
    setUsed((u) => [...u, part]);
  };
  const parts = draft ? (["why", "aim", "story", "items"] as const).filter((p) => (p === "items" ? !!draft.items?.length : !!draft[p])) : [];
  const setItem = (i: number, next: Partial<VoiceDraftItem>) => setDraft((d) => (d ? { ...d, items: (d.items ?? []).map((g, k) => (k === i ? { ...g, ...next } : g)) } : d));
  const usedMark = (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
      <Check className="size-4" aria-hidden="true" />
      {VOICE_DRAFT_WORDS.used}
    </span>
  );

  return (
    <div className="grid gap-3" data-voice-drafts="">
      <div className="grid gap-1.5">
        <button type="button" onClick={() => void press()} disabled={busy} className={`${BTN_SECONDARY} min-h-12 justify-center`} aria-describedby="voice-draft-sends" data-voice-draft="">
          <Sparkles className="size-4" aria-hidden="true" />
          {VOICE_DRAFT_WORDS.button}
        </button>
        <p id="voice-draft-sends" className="text-xs text-muted-foreground">
          {VOICE_DRAFT_WORDS.sends}
        </p>
        {busy && (
          <p role="status" className="text-sm text-muted-foreground">
            {VOICE_DRAFT_WORDS.working}
          </p>
        )}
        {said && (
          <p role="alert" className="border-l-4 border-notice pl-3 text-sm text-foreground" data-voice-draft-said="">
            {said}
          </p>
        )}
      </div>

      {draft && parts.length > 0 && (
        <section aria-labelledby="voice-drafts-h" className="grid gap-4 rounded-xl border border-border bg-muted p-4" data-voice-draft-review="">
          <div className="grid gap-1">
            <h4 id="voice-drafts-h" className="font-semibold text-foreground">
              {VOICE_DRAFT_WORDS.heading}
            </h4>
            <p className={HINT}>{VOICE_DRAFT_WORDS.hint}</p>
          </div>
          {parts.map((p) => {
            const done = used.includes(p);
            const id = `voice-draft-${p}`;
            return (
              <div key={p} className="grid gap-2" data-voice-draft-part={p}>
                {p !== "items" && (
                  <label htmlFor={id} className={LABEL}>
                    {VOICE_DRAFT_WORDS.labels[p]}
                  </label>
                )}
                {p === "why" && <GrowingField id={id} minRows={4} limit={OPEN_WHY_MAX} disabled={done} value={draft.why ?? ""} onChange={(why) => setDraft({ ...draft, why })} className={FIELD} />}
                {(p === "aim" || p === "story") && (
                  <GrowingField id={id} mic={false} minRows={1} disabled={done} limit={p === "aim" ? OPEN_AIM_MAX : ABOUT_STORY_MAX} value={draft[p] ?? ""} onChange={(v) => setDraft({ ...draft, [p]: v })} className={`${FIELD} py-3`} />
                )}
                {p === "items" && (
                  <fieldset className="grid gap-3" disabled={done}>
                    <legend className={`mb-1 ${LABEL}`}>{VOICE_DRAFT_WORDS.labels.items}</legend>
                    {(draft.items ?? []).map((g, i) => (
                      <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
                        <GrowingField aria-label={`${VOICE_DRAFT_WORDS.itemTitle} ${i + 1}`} mic={false} minRows={1} limit={GOAL_LIMITS.title} value={g.title} onChange={(title) => setItem(i, { title })} className={`${FIELD} py-2 font-semibold`} />
                        <GrowingField aria-label={`${VOICE_DRAFT_WORDS.itemDone} ${i + 1}`} mic={false} minRows={1} limit={GOAL_LIMITS.doneWhen} value={g.doneWhen} onChange={(doneWhen) => setItem(i, { doneWhen })} className={`${FIELD} py-2`} />
                      </div>
                    ))}
                  </fieldset>
                )}
                <div>
                  {done ? (
                    usedMark
                  ) : (
                    <button type="button" onClick={() => use(p)} className={BTN} data-voice-draft-use={p}>
                      {t({ message: "Use this", context: "voice drafts" })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {parts.some((p) => !used.includes(p)) && parts.length > 1 && (
            <button type="button" onClick={() => parts.forEach(use)} className={`${BTN} justify-self-start`} data-voice-draft-use-all="">
              {VOICE_DRAFT_WORDS.useAll}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
