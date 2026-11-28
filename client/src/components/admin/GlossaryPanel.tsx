/**
 * Admin → Make This Yours → Identity → Words you explain (the lead, 25 Nov 2026).
 *
 * One plain sentence per word the village uses for itself (shared/glossary.ts), opened from the word itself, which
 * wears a thin dotted underline (the lead, 27 Nov 2026: tooltips on the word). Blank leaves the word plain. Saved as the content section `app-glossary`, apart from the boxes
 * above it, so saving one never writes over the other.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { GLOSSARY_SECTION, GLOSSARY_SLOTS, GLOSSARY_SLOT_IDS, MEANING_MAX, glossaryOf, type Glossary, type GlossarySlot } from "@shared/glossary";
import { API_BASE, authHeaders, refusal } from "./adminApi";

export default function GlossaryPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [draft, setDraft] = useState<Glossary | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/content/${GLOSSARY_SECTION}`, { cache: "no-cache" }).catch(() => null);
    setDraft(glossaryOf(res?.ok ? await res.json().catch(() => null) : null));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!draft) return null;
  const set = (slot: GlossarySlot, v: string) => setDraft({ ...draft, [slot]: v.slice(0, MEANING_MAX) });

  const save = async () => {
    setSaving(true);
    const res = await fetch(`${API_BASE}/admin/content/${GLOSSARY_SECTION}`, {
      method: "PUT",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify(glossaryOf(draft)),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error(refusal(await res?.json().catch(() => null), t`Your explanations did not save.`));
    toast.success(t`Your explanations are saved. Pages show them from the next page a visitor opens.`);
  };

  return (
    <div className="md:col-span-2 rounded-lg border border-border px-3 py-3" data-glossary-panel="">
      <p className="text-sm font-medium text-foreground mb-0.5">
        <Trans context="admin identity: the words the village explains">Words you explain</Trans>
      </p>
      <p className="text-xs text-muted-foreground mb-3 max-w-prose">
        <Trans>
          One plain sentence for each word a visitor may not know. The word wears a thin dotted underline, and a tap or a hover on it opens the sentence. Blank leaves the word plain.
        </Trans>
      </p>
      <div className="grid gap-3">
        {GLOSSARY_SLOT_IDS.map((slot) => (
          <label key={slot} className="grid gap-1">
            <span className="text-xs text-muted-foreground">{GLOSSARY_SLOTS[slot].what}</span>
            <textarea
              value={draft[slot] ?? ""}
              onChange={(e) => set(slot, e.target.value)}
              rows={2}
              maxLength={MEANING_MAX}
              className="text-sm border border-border rounded-lg px-2.5 py-1.5"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-3 min-h-[44px] px-4 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40"
      >
        {saving ? <Trans context="admin identity: while the explanations save">Saving…</Trans> : <Trans context="admin identity: save the explanations">Save your explanations</Trans>}
      </button>
    </div>
  );
}
