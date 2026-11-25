/**
 * Admin → Make This Yours → Identity → Your words for things (gap G4).
 *
 * The village's own nouns (shared/vocabulary.ts): one box for the word and one
 * for its plural, per slot. Blank keeps the platform's word, and a blank
 * plural is worked out from the word. Saved as the content section
 * `app-vocabulary`, apart from the identity boxes above it, so saving one
 * never writes over the other.
 */
import { useCallback, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { NOUN_MAX, NOUN_SLOTS, NOUN_SLOT_IDS, VOCAB_SECTION, type NounSlot } from "@shared/vocabulary";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import GlossaryPanel from "./GlossaryPanel";
import SaveBar, { type SaveResult } from "@/components/SaveBar";
import { useDraftDoc } from "@/lib/unsavedChanges";

type Draft = Partial<Record<NounSlot, { one?: string; many?: string }>>;

export default function VocabularyPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [loaded, setLoaded] = useState<Draft | null>(null);
  // One save bar for the whole of Make this yours (components/SaveBar.tsx):
  // an edit here waits beside every other unsaved edit on the page.
  const doc = useDraftDoc<Draft>(loaded);
  const draft = doc.draft;
  const setDraft = doc.setDraft;

  const load = useCallback(async () => {
    const res = await fetch(`/api/content/${VOCAB_SECTION}`, { cache: "no-cache" }).catch(() => null);
    const d = res?.ok ? await res.json().catch(() => null) : null;
    setLoaded(d && typeof d === "object" ? (d as Draft) : {});
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!draft) return null;
  const set = (slot: NounSlot, part: "one" | "many", v: string) =>
    setDraft({ ...draft, [slot]: { ...(draft[slot] ?? {}), [part]: v.slice(0, NOUN_MAX) } });

  const save = async (): Promise<SaveResult> => {
    const res = await fetch(`${API_BASE}/admin/content/${VOCAB_SECTION}`, {
      method: "PUT",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify(draft),
    }).catch(() => null);
    if (!res?.ok) return { ok: false, reason: refusal(await res?.json().catch(() => null), t`Your words did not save.`) };
    doc.accept(draft);
    return { ok: true };
  };

  // The words the village explains sit right under its words for things (GlossaryPanel.tsx).
  return (
    <>
    <div className="md:col-span-2 rounded-lg border border-border px-3 py-3">
      <p className="text-sm font-medium text-foreground mb-0.5">
        <Trans context="admin identity: the village's own nouns">Your words for things</Trans>
      </p>
      <p className="text-xs text-muted-foreground mb-3 max-w-prose">
        <Trans>
          What your village calls each of these. Blank keeps the platform's word, and a blank plural is worked out from the word.
          Page words can use them as {"{circle}"}, {"{circles}"} and so on.
        </Trans>
      </p>
      <div className="grid gap-2">
        {NOUN_SLOT_IDS.map((slot) => (
          <div key={slot} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr] items-center">
            <input
              value={draft[slot]?.one ?? ""}
              onChange={(e) => set(slot, "one", e.target.value)}
              placeholder={NOUN_SLOTS[slot].one}
              aria-label={t({ message: `Your word for ${NOUN_SLOTS[slot].one}`, context: "admin identity: a noun field" })}
              className="text-sm border border-border rounded-lg px-2.5 py-1.5"
            />
            <input
              value={draft[slot]?.many ?? ""}
              onChange={(e) => set(slot, "many", e.target.value)}
              placeholder={NOUN_SLOTS[slot].many}
              aria-label={t({ message: `More than one: ${NOUN_SLOTS[slot].many}`, context: "admin identity: a noun's plural field" })}
              className="text-sm border border-border rounded-lg px-2.5 py-1.5"
            />
            <span className="text-xs text-muted-foreground">{NOUN_SLOTS[slot].what}</span>
          </div>
        ))}
      </div>
      <SaveBar count={doc.count} onSave={save} onDiscard={doc.discard} what={t({ message: "your words for things", context: "admin identity: what the save bar saves" })} />
    </div>
    <GlossaryPanel password={password} />
    </>
  );
}
