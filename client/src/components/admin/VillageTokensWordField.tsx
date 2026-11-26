/**
 * THE UMBRELLA WORD: what this village calls all its tokens together.
 *
 * Rye, 2026-10-23: "Village Tokens is the umbrella word, which should be able
 * to be set in admin". His word is the platform default
 * (`GAME_CONFIG.currency.collectiveName`); a village sets its own here, on the
 * one page where tokens are named. It is stored in the brand overlay's
 * `currency` section, served as `currency.collectiveName` on the public
 * config, and pages say it as `{tokens}` (shared/pageContent/vars.ts).
 *
 * Blank means "use the default", the overlay's rule for every word it holds,
 * so the box shows the default as its placeholder and never stores it. The
 * PUT merges one section key, so nothing else in the brand document moves.
 * Light-only, like the rest of this folder.
 */
import { useEffect, useState } from "react";
import { API_BASE, authHeaders, refusal } from "@/components/admin/adminApi";
import { Trans, useLingui } from "@lingui/react/macro";
import SaveBar, { type SaveResult } from "@/components/SaveBar";

export default function VillageTokensWordField({ password }: { password: string }) {
  const { t } = useLingui();
  const [saved, setSaved] = useState<string | null>(null);
  const [fallback, setFallback] = useState("Village Tokens");
  const [value, setValue] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/admin/brand`, { headers: authHeaders(password) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const word = String(d.brand?.currency?.collectiveName ?? "").trim();
        setSaved(word);
        setValue(word);
        const shipped = String(d.defaults?.currency?.collectiveName ?? "").trim();
        if (shipped) setFallback(shipped);
      })
      .catch(() => { /* the box stays empty and says the default; a save still works */ });
    return () => { alive = false; };
  }, [password]);

  const changed = saved !== null && value.trim() !== saved;

  /** Saved from the page's one save bar (components/SaveBar.tsx). */
  const save = async (): Promise<SaveResult> => {
    try {
      const res = await fetch(`${API_BASE}/admin/brand`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ currency: { collectiveName: value.trim().slice(0, 60) } }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, reason: refusal(data, t({ message: "Could not save that", context: "VillageTokensWordField, refused" })) };
      const word = String(data.brand?.currency?.collectiveName ?? "").trim();
      setSaved(word);
      setValue(word);
      return { ok: true };
    } catch {
      return { ok: false, reason: t({ message: "Could not save that", context: "VillageTokensWordField, refused" }) };
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-border px-4 py-3">
      <label htmlFor="village-tokens-word" className="text-sm font-medium text-foreground">
        <Trans context="VillageTokensWordField, label">What your tokens are called together
      </Trans></label>
      <p className="text-xs text-muted-foreground mt-0.5">
        One word for every token below, used wherever a page speaks of them all at once. Pages write it as{" "}
        <code className="font-mono">{"{tokens}"}</code>. Leave it blank to keep {fallback}.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="village-tokens-word"
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          placeholder={fallback}
          className="text-sm border border-border rounded-lg px-2 py-1 w-56"
        />
      </div>
      <SaveBar
        count={changed ? 1 : 0}
        onSave={save}
        onDiscard={() => setValue(saved ?? "")}
        what={t({ message: "what your tokens are called together", context: "VillageTokensWordField, what the save bar saves" })}
      />
    </div>
  );
}
