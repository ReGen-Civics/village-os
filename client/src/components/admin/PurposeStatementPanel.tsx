/**
 * THE GOVERNING PURPOSE STATEMENT, IN THE SETUP WIZARD (0219).
 *
 * Rye, 2026-09-23: every village writes one, and "all upgrades going forward
 * will be judged against it." It blocks the Birthing, so it belongs on the
 * screen a founder is already walking down before they ask the village to
 * start.
 *
 * ── WHO MAY WRITE IT, AND WHY THIS SCREEN ASKS THE SERVER ─────────────────
 *
 * "Founder keeps the pen until they give over all steward powers to the
 * village." This panel reads `GET /api/governance/purpose`, which answers
 * `founderHoldsPen` from the same handover state the route enforces with. It
 * never works the answer out from a count of its own: a screen that decided
 * for itself would eventually disagree with the route, and the disagreement
 * would show up as a Save button that 409s.
 *
 * Once the handover is complete the box goes read-only and the panel says
 * where the pen went. Nothing here can reach past that, and nothing should.
 *
 * SUPERSEDED ON ONE POINT (Rye, 2026-11-06): Article 0 wins over "founder
 * keeps the pen". The village's change vote is open before the handover too,
 * at its highest tier, so while the founder holds the pen this panel says
 * both doors are open: the founder's Save, and any member's vote.
 *
 * ── ITS OWN FILE, MOUNTED INSIDE AN EXISTING STEP ────────────────────────
 *
 * Admin.tsx is on the monolith ratchet with a few dozen lines of allowance,
 * and the admin lane is building the wider setup step around this. A file
 * they can grow or replace is a smaller thing to hand over than a block in
 * the middle of a ten-thousand-line page. It renders a panel and not a
 * numbered step, the way GoLivePackagePanel does, so `SETUP_STEPS` and the
 * wizard's progress readout are untouched by it.
 */
import { useCallback, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { countWords, PURPOSE_MIN_WORDS } from "@shared/governingPurpose";
import { usePrefill } from "@/lib/profilePrefill";
import SaveBar, { type SaveResult } from "@/components/SaveBar";

export default function PurposeStatementPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [statement, setStatement] = useState("");
  /** As the server holds it. The page's one save bar counts against this. */
  const [saved, setSaved] = useState("");
  const [founderHoldsPen, setFounderHoldsPen] = useState(true);
  /*
   * A STATEMENT HANDED OVER FROM A REGEN CIVICS FILE (ProfileImport.tsx) goes
   * into this box unsaved, and the statement the village saved is kept here so
   * one button puts it back. The founder presses Save, or does not.
   */
  const [handed, setHanded] = useState<{ fromFirstLine: boolean; saved: string } | null>(null);

  const load = useCallback(() => {
    fetch(`${API_BASE}/admin/purpose`, { headers: authHeaders(password) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setStatement(String(d.statement ?? ""));
        setSaved(String(d.statement ?? ""));
        setFounderHoldsPen(d.founderHoldsPen !== false);
      })
      .catch(() => {});
  }, [password]);
  useEffect(() => { load(); }, [load]);
  usePrefill("purpose", (p) => {
    if (!founderHoldsPen) return;
    setHanded({ fromFirstLine: p.fromFirstLine, saved });
    setStatement(p.text);
  });

  const save = async (): Promise<SaveResult> => {
    try {
      const res = await fetch(`${API_BASE}/admin/purpose`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ statement }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, reason: refusal(d, t({ message: "The statement was not saved", context: "PurposeStatementPanel, refused" })) };
      setSaved(statement);
      setHanded(null);
      load();
      return { ok: true };
    } catch {
      return { ok: false, reason: t({ message: "The statement was not saved", context: "PurposeStatementPanel, refused" }) };
    }
  };

  const words = countWords(statement);
  return (
    <div className="bg-background text-foreground rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold mb-1"><Trans context="PurposeStatementPanel, h4">What this village is for, in one statement</Trans></h4>
      <p className="text-xs text-gray-500 mb-3">
        <Trans context="PurposeStatementPanel, p">The sentence every later change is judged against. Your village cannot start its Game
        without one.
      </Trans></p>
      <div>
        <p className="text-sm mb-3">
          <Trans context="PurposeStatementPanel, p">Say who this village serves, what they are up against, the move it is making, by what
          means, and what becomes true if it works. One statement, written the way you would say
          it out loud.
        </Trans></p>
        {handed && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 mb-3 text-sm text-gray-900">
            <p>
              <Trans context="PurposeStatementPanel, p">{handed.fromFirstLine
                ? "This box now holds your first line from ReGen Civics. A purpose statement says more: who it serves, what they are up against, the move, the means, and what becomes true."
                : "This box now holds the purpose statement from your ReGen Civics profile."}{" "}
              Nothing is saved until you press Save.
            </Trans></p>
            <button
              type="button"
              className="mt-1 text-xs font-medium text-teal-deep underline"
              onClick={() => {
                setStatement(handed.saved);
                setHanded(null);
              }}
            >
              <Trans context="PurposeStatementPanel, button">Put back what was saved
            </Trans></button>
          </div>
        )}
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          readOnly={!founderHoldsPen}
          rows={10}
          maxLength={20000}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
          placeholder={t({ message: "This village exists for the people who...", context: "PurposeStatementPanel, placeholder" })}
        />
        <p className="text-xs text-gray-500 mt-2">
          <Trans context="PurposeStatementPanel, p">{words} word{words === 1 ? "" : "s"}. It takes at least {PURPOSE_MIN_WORDS} to answer all
          five parts.
        </Trans></p>
        {/* THE ORDINARY PATH READS AS ORDINARY. `capability_holding` is empty
            at birth on every deployment, so a founder holding the pen is the
            normal state of every village and not a village waiting for
            something. This sentence says what happens next as a fact, with no
            suggestion that anything here is unfinished. */}
        {founderHoldsPen && (
          <p className="text-xs text-gray-500 mt-1">
            <Trans>
              You write this. Any member who can open a proposal can also put a new statement to
              a vote of the whole village, at its highest bar. Once the village holds every one of
              its powers, that vote is the only way to change it.
            </Trans>
          </p>
        )}
        {founderHoldsPen ? (
          <SaveBar
            count={statement !== saved ? 1 : 0}
            onSave={save}
            onDiscard={() => { setStatement(saved); setHanded(null); }}
            what={t({ message: "the purpose statement", context: "PurposeStatementPanel, what the save bar saves" })}
          />
        ) : (
          <p className="mt-3 text-sm text-gray-700">
            <Trans context="PurposeStatementPanel, p">This village looks after all of its powers now, so the statement is the village's to
            change. Anybody who can open a proposal can take a change of purpose to the whole roll.
          </Trans></p>
        )}
      </div>
    </div>
  );
}
