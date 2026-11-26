/**
 * STEP 1 OF MAKE THIS YOURS: BRING YOUR AGENT OR GUIDE (the lead, 26 Nov 2026).
 *
 * "Make this yours" is one launch path, and its first step connects the
 * village's agent or guide, so every step after it can be walked with the
 * guide beside you. Before this the key lived only under Integrations, and the
 * setup page sent a founder away to find it.
 *
 * What the step holds:
 *   - where the guide stands, read from `GET /api/admin/helper`, the same
 *     answer the guide's own panel reads (`guideObservation` in
 *     setupProgress.ts turns it into the step's row);
 *   - the village's own Anthropic key, written through the same write-only
 *     route Integrations uses (`PUT /api/admin/integrations/assistant_api_key`)
 *     and saved on the page's one save bar, never with a button of its own;
 *   - Sera, which counts on its own (the lead, 26 Nov 2026), with a way to its
 *     settings when it is not connected;
 *   - Open the guide.
 *
 * `useSetupObservations` is the one read both callers in Admin.tsx take: the
 * shell (whether setup is finished) and the wizard (the rows). It folds this
 * step's reading in beside the needs step's, so neither caller grows a line.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { HelperStatus } from "@shared/adminHelper";
import SaveBar, { type SaveResult } from "@/components/SaveBar";
import ConnectorSetupPanel from "@/components/agent/ConnectorSetupPanel";
import SetupSection from "./SetupSection";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { fetchHelperStatus } from "./adminHelperApi";
import { useNeedsSetupObservation } from "./NeedsSetupStep";
import { guideObservation, type SetupObservations, type SetupRow, type SetupStepKey } from "./setupProgress";
import { FIELD, HINT, PRIMARY, QUIET } from "./NeedsPieces";

/** The secret the guide answers on: the same key Integrations calls "Anthropic, the AI guide". */
export const GUIDE_KEY_SECRET = "assistant_api_key";

/** What an Anthropic key starts with: a shape, not words, so it is the same in every language. */
const KEY_SHAPE = "sk-ant-...";

/** Where Sera, the org memory service, is connected. */
export const SERA_SETTINGS_HREF = "/admin?tab=modules&module=saberra";

/** The guide's status, read once and again on demand. A refused read stays null, which reads `unknown`. */
export function useGuideStatus(password: string | null): { status: HelperStatus | null; reread: () => void } {
  const [status, setStatus] = useState<HelperStatus | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!password) return;
    const stop = new AbortController();
    fetchHelperStatus(password, stop.signal).then(setStatus, () => {
      /* Left as it was. A first read that fails stays null: nobody has looked. */
    });
    return () => stop.abort();
  }, [password, tick]);
  const reread = useCallback(() => setTick((n) => n + 1), []);
  return { status, reread };
}

/**
 * Every observed step's reading, for the shell and the wizard alike: the needs
 * scope and the guide. `observations` keeps its identity until a reading
 * changes, because the shell's effect depends on it.
 */
export function useSetupObservations(password: string | null) {
  const needs = useNeedsSetupObservation(password);
  const guide = useGuideStatus(password);
  const observations: SetupObservations = useMemo(
    () => ({ ...needs.observations, ...guideObservation(guide.status) }),
    [needs.observations, guide.status],
  );
  return { observations, summary: needs.summary, guide };
}

export default function GuideSetupStep({
  rows,
  setup,
  onToggleStep,
  password,
  status,
  onRead,
  onOpenHelper,
}: {
  rows: readonly SetupRow[];
  setup: Record<string, unknown> | null | undefined;
  onToggleStep: (key: SetupStepKey) => void;
  password: string;
  status: HelperStatus | null;
  /** Reads the guide's status again, after a key is saved. */
  onRead: () => void;
  onOpenHelper?: () => void;
}) {
  const { t } = useLingui();
  const [key, setKey] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [keySaved, setKeySaved] = useState(false);
  const has = new Set(status?.available ?? []);
  const row = rows.find((r) => r.key === "guide");

  const saveKey = async (): Promise<SaveResult> => {
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/${GUIDE_KEY_SECRET}`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ value: key }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, reason: refusal(d, t({ message: "The key was not saved.", context: "setup guide step, save refused" })) };
      setKey("");
      // `asked`: the change went to the village rather than straight in. Say so, in the server's words.
      if (d?.asked) setNote(String(d.message ?? ""));
      else setKeySaved(true);
      onRead();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  };

  return (
    <SetupSection
      rows={rows}
      setup={setup}
      onToggleStep={onToggleStep}
      id="guide"
      title={t({ message: "Bring your agent or guide", context: "setup guide step, title" })}
      subtitle={t({ message: "Connect the AI that helps you through the rest of these steps.", context: "setup guide step, subtitle" })}
    >
      <div className="bg-background text-foreground rounded-lg p-4 space-y-4">
        {/* Short lines, never a paragraph (the lead, 26 Nov 2026). */}
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          <li><Trans context="setup guide step, line">It finds the right box and explains what a setting does.</Trans></li>
          <li><Trans context="setup guide step, line">It proposes changes. You save them.</Trans></li>
          <li><Trans context="setup guide step, line">Connect it first and it walks the other steps with you.</Trans></li>
        </ul>
        {row?.detail && <p role="status" className="text-sm font-medium text-foreground">{row.detail}</p>}
        {note && <p role="status" className="text-sm text-foreground">{note}</p>}

        <div className="space-y-2">
          <label htmlFor="setup-guide-key" className="block text-sm font-medium text-foreground">
            {has.has("anthropic")
              ? t({ message: "Replace your village's Anthropic key", context: "setup guide step, key label" })
              : t({ message: "Your village's Anthropic key", context: "setup guide step, key label" })}
          </label>
          <input
            id="setup-guide-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={KEY_SHAPE}
            className={`${FIELD} w-full max-w-md`}
          />
          <p className={HINT}>
            <Trans context="setup guide step, key hint">Create one at console.anthropic.com. It is write-only: once saved, Admin shows only its last four characters, under Integrations.</Trans>
          </p>
        </div>

        <p className="text-sm text-foreground">
          {has.has("sera") ? (
            <Trans context="setup guide step, sera">Sera, your org memory, is connected, and it counts for this step on its own.</Trans>
          ) : (
            <>
              <Trans context="setup guide step, sera">Using Sera for your org memory? Connecting it counts for this step on its own.</Trans>{" "}
              <a href={SERA_SETTINGS_HREF} className="font-medium text-primary underline underline-offset-2">
                <Trans context="setup guide step, opens Sera's settings">Connect Sera</Trans>
              </a>
            </>
          )}
        </p>

        {onOpenHelper && (
          <button type="button" onClick={onOpenHelper} className={has.size > 0 ? PRIMARY : QUIET}>
            <Trans context="setup guide step, opens the guide">Open the guide</Trans>
          </button>
        )}

        {keySaved && <ConnectorSetupPanel moment="key" isAdmin password={password} person="admin" />}
      </div>
      <SaveBar
        count={key.trim() ? 1 : 0}
        onSave={saveKey}
        onDiscard={() => setKey("")}
        what={t({ message: "your village's Anthropic key", context: "setup guide step, what the save bar saves" })}
      />
    </SetupSection>
  );
}
