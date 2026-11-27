/**
 * WHICH STEPS NEED THEIR OWN SUBMISSION (0439; the lead, 27 Nov 2026). The
 * door to `PUT /api/admin/quests/:id/step-needs`, with its own Save so it never
 * rides an unrelated edit, the way the roots editor beside it works.
 *
 * One box per step. A ticked step asks the member for a photo, a document or a
 * few words before the quest can be turned in. Nothing ticked is a quest that
 * behaves as it always did. The boxes follow the saved steps, so a step added
 * in the story editor shows here once that edit is saved.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { toast } from "sonner";
import { API_BASE, authHeaders } from "./adminApi";

export default function QuestStepNeedsEditor({
  questId,
  steps,
  stepNeeds,
  password,
}: {
  questId: string;
  steps: string[];
  stepNeeds: boolean[];
  password: string;
}) {
  const { t } = useLingui();
  const initial = steps.map((_, i) => stepNeeds[i] === true);
  const [value, setValue] = useState<boolean[]>(initial);
  const [start, setStart] = useState<boolean[]>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value.some((v, i) => v !== start[i]);
  const failed = t({ message: "The steps did not save. Try again.", context: "admin quest step needs" });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/quests/${encodeURIComponent(questId)}/step-needs`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ stepNeeds: value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || failed);
      const saved: boolean[] = Array.isArray(body?.stepNeeds) ? body.stepNeeds : value;
      setStart(saved);
      setValue(saved);
      toast.success(t({ message: "Steps saved", context: "admin quest step needs" }));
    } catch (e: any) {
      toast.error(e?.message || failed);
    } finally {
      setSaving(false);
    }
  };

  if (steps.length === 0) {
    return <p className="text-xs text-muted-foreground">{t({ message: "This quest has no steps yet. Add them under Story, effort, steps, and poster, and save.", context: "admin quest step needs" })}</p>;
  }

  return (
    <div className="space-y-2 text-foreground">
      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={i}>
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={value[i] === true}
                onChange={(e) => setValue(value.map((v, j) => (j === i ? e.target.checked : v)))}
                className="mt-1 size-4"
              />
              <span>
                <span className="font-semibold">{i + 1}.</span> {step}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="min-h-11 rounded-lg bg-teal-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {t({ message: "Save steps", context: "admin quest step needs" })}
        </button>
        {!dirty ? <span className="text-xs text-muted-foreground">{t({ message: "Nothing to save. Change a box first.", context: "admin quest step needs" })}</span> : null}
      </div>
    </div>
  );
}
