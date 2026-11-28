/**
 * THE LIST SERA'S ROW OPENS (the hall relief, 27 Nov 2026): the list /review draws, unchanged, with its ticks, its bar
 * and its sheet (components/review/SeraDifferences.tsx, SeraBulk.tsx, SeraKeys.tsx). Nothing about what a take does
 * moves here: the bar leaves out pay, anything marked Check first and a new role apart from its circle, by the rule the
 * server holds it to (shared `bulkPlan`), and every take goes into a draft.
 *
 * It makes the two reads /review makes: the differences (`useSeraDifferences`), and the review queue for whether one of
 * its drafts is open, which the list needs before it may say everything is in step. A read that failed is said as a
 * failed read, never as an empty list.
 *
 * A chunk of its own (SeraListRow imports it lazily), so /admin/review carries the list only once a person opens it.
 */
import { useCallback, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import SeraDifferences, { useSeraDifferences, type SeraRead } from "@/components/review/SeraDifferences";
import { HINT } from "@/components/journey/look";
import { authToken } from "@/lib/gameApi";

export default function SeraSheet({ onChanged }: { onChanged: () => void }) {
  const { t } = useLingui();
  const { read, load } = useSeraDifferences();
  const [draft, setDraft] = useState<"reading" | "open" | "none" | "failed">("reading");

  const loadDraft = useCallback(async () => {
    const token = authToken();
    if (!token) return setDraft("failed");
    try {
      const r = await fetch("/api/review/queue", { headers: { Authorization: `Bearer ${token}` } });
      const body = r.ok ? ((await r.json().catch(() => null)) as { openDrafts?: unknown } | null) : null;
      if (!body) return setDraft("failed");
      setDraft(Array.isArray(body.openDrafts) && body.openDrafts.length > 0 ? "open" : "none");
    } catch {
      setDraft("failed");
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([load(), loadDraft()]);
  }, [load, loadDraft]);
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // After an answer the list reads itself again, and the page's numbers follow.
  const reload = useCallback(async () => {
    await loadAll();
    onChanged();
  }, [loadAll, onChanged]);

  if (read.phase === "loading" || draft === "reading") {
    return (
      <p className={HINT}>
        <Trans context="review inbox: Sera's list">Reading the list.</Trans>
      </p>
    );
  }
  const shown: SeraRead =
    draft === "failed" && read.phase === "listed" ? { phase: "failed", error: t({ context: "review inbox: Sera's list", message: "Could not read whether a draft is open" }) } : read;
  return <SeraDifferences read={shown} draftOpen={draft === "open"} onRetry={loadAll} onReload={reload} />;
}
