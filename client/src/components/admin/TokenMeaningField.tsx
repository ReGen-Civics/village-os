/**
 * WHAT A TOKEN MEANS, IN THE VILLAGE'S OWN WORDS (0283).
 *
 * Rye, 2026-10-23: "Village Tokens is the umbrella word, which should be able
 * to be set in admin to name each type of token and for what categories it's
 * issued and what it means." The name is the rename box beside this; the
 * categories are the token jobs above the table; this is the meaning.
 *
 * It replaces the sentence the platform used to write for each token
 * (`describeToken`, once in tokenCatalog.ts). The 2026-10-22 ruling says
 * shipped copy never says what a token does, because every community sets its
 * own rules, so the only text here is the village's, and the empty state asks
 * for it without suggesting what it should say. Members read it on their
 * wallet. Light-only, like the rest of this folder.
 */
import { useState } from "react";
import { API_BASE, authHeaders, refusal } from "@/components/admin/adminApi";
import { Trans, useLingui } from "@lingui/react/macro";
import SaveBar, { type SaveResult } from "@/components/SaveBar";

/** The column's width (varchar 600). The server judges it again. */
const MAX = 600;

interface MeaningToken {
  slug: string;
  name?: string;
  description?: string | null;
  isExample?: boolean;
}

export default function TokenMeaningField({
  token,
  password,
  onSaved,
}: {
  token: MeaningToken;
  password: string;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const [draft, setDraft] = useState<string | null>(null);
  const stored = String(token.description ?? "").trim();
  const name = token.name || token.slug;

  /** Saved from the page's one save bar (components/SaveBar.tsx), never a button of its own. */
  const save = async (): Promise<SaveResult> => {
    if (draft === null) return { ok: true };
    if (draft.trim().length > MAX) return { ok: false, reason: t({ message: `What ${name} means is longer than ${MAX} characters.`, context: "TokenMeaningField, too long" }) };
    try {
      const res = await fetch(`${API_BASE}/admin/tokens/${encodeURIComponent(token.slug)}`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ description: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, reason: refusal(data, t({ message: "Could not save that", context: "TokenMeaningField, refused" })) };
      setDraft(null);
      onSaved();
      return { ok: true };
    } catch {
      return { ok: false, reason: t({ message: "Could not save that", context: "TokenMeaningField, refused" }) };
    }
  };

  if (draft !== null) {
    const length = draft.trim().length;
    return (
      <div className="mt-1 max-w-md">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setDraft(null); }}
          rows={3}
          autoFocus
          aria-label={t({ message: `What ${name} means`, context: "TokenMeaningField, aria-label" })}
          placeholder={t({ message: "Say in your own words what this token means here", context: "TokenMeaningField, placeholder" })}
          className="w-full text-sm border border-border rounded-lg px-2 py-1.5"
        />
        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={() => setDraft(null)} className="text-xs text-muted-foreground">
            <Trans context="TokenMeaningField, button">Cancel
          </Trans></button>
          <span className={`ml-auto text-[11px] ${length > MAX ? "text-red-600" : "text-muted-foreground"}`}>
            {length}/{MAX}
          </span>
        </div>
        <SaveBar
          count={draft.trim() !== stored ? 1 : 0}
          onSave={save}
          onDiscard={() => setDraft(null)}
          what={t({ message: `what ${name} means`, context: "TokenMeaningField, what the save bar saves" })}
        />
      </div>
    );
  }

  return (
    <div className="mt-0.5 max-w-md">
      {stored ? (
        <p className="text-xs text-muted-foreground whitespace-pre-line">{stored}</p>
      ) : (
        <p className="text-xs text-muted-foreground italic"><Trans context="TokenMeaningField, p">Nothing written yet about what this token means here.</Trans></p>
      )}
      {!token.isExample && (
        <button type="button" onClick={() => setDraft(stored)} className="text-xs text-teal-deep underline">
          {stored ? "edit what it means" : "write what it means"}
        </button>
      )}
    </div>
  );
}
