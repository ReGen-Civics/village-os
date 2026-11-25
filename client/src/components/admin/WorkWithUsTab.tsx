/**
 * The Work With Us tab, moved out of client/src/pages/Admin.tsx.
 *
 * IT MOVED RATHER THAN BEING PATCHED IN PLACE. The one-line fix below would
 * have added a line to a file already standing exactly on its monolith-ratchet
 * baseline, so the smallest correct change to Admin.tsx was to make it
 * smaller. scripts/check-file-lines.mjs names this directory as where an admin
 * tab belongs.
 *
 * THE BUG IT CARRIED. `useGameConfig()` was called inline in the JSX below the
 * `if (!cfg) return <Loading/>` early return, so the loading render ran three
 * hooks and the loaded render ran five, and React threw "Rendered more hooks
 * than during the previous render" (minified: #310). The tab crashed to the
 * error screen every time it was opened, for every village, because the fetch
 * always resolves after the first paint. An AST sweep of all 320 non-test
 * source files under client/src found it was the only rules-of-hooks
 * violation in the client, and there is no ESLint in this repo to have caught
 * it.
 *
 * THE FIELD THAT HOOK LABELLED IS GONE, and the hook with it. It set the
 * Gratitude an accepted proposal minted, and Rye ruled on 2026-10-23 that
 * "GRATITUDE is only sent from player to player using the send gratitude
 * function, gratitude is not distributed in any other way!" An accepted
 * proposal pays work tokens from the Mint panel's `proposal.accepted` rules
 * (server/lib/proposalAward.ts), and this tab says where to set them.
 */
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, authHeaders } from "./adminApi";
import { Trans, useLingui } from "@lingui/react/macro";

/** The token the guide's words use for its name, shown literally inside a translated sentence. */
const nameToken = "{name}";

export default function WorkWithUsTab({ password }: { password: string }) {
  const { t } = useLingui();
  const [cfg, setCfg] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/admin/work-with-us-config`, { headers: authHeaders(password) })
      .then((r) => r.json()).then(setCfg).catch(() => toast.error(t({ message: "Failed to load", context: "WorkWithUsTab, toast" })));
  }, [password]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/work-with-us-config`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error();
      toast.success(t({ message: "Saved", context: "WorkWithUsTab, toast" }));
    } catch { toast.error(t({ message: "Save failed", context: "WorkWithUsTab, toast" })); }
    setSaving(false);
  };

  if (!cfg) return <div className="text-center py-12 text-gray-400"><Trans context="WorkWithUsTab, div">Loading...</Trans></div>;

  const opts = cfg.reciprocityOptions ?? [];
  const setOpt = (i: number, patch: any) =>
    setCfg({ ...cfg, reciprocityOptions: opts.map((o: any, j: number) => (j === i ? { ...o, ...patch } : o)) });
  const addOpt = () => setCfg({ ...cfg, reciprocityOptions: [...opts, { value: "", title: "", desc: "" }] });
  const removeOpt = (i: number) => setCfg({ ...cfg, reciprocityOptions: opts.filter((_: any, j: number) => j !== i) });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900"><Trans context="WorkWithUsTab, h2">Work With Us</Trans></h2>
          <p className="text-sm text-gray-500 mt-1"><Trans context="WorkWithUsTab, p">The intro, the reciprocity (exchange) options, and your AI guide's name and greeting.</Trans></p>
        </div>
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-deep text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="space-y-5 max-w-2xl">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1"><Trans context="WorkWithUsTab, label">Intro paragraph</Trans></label>
          <textarea value={cfg.intro ?? ""} onChange={(e) => setCfg({ ...cfg, intro: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1"><Trans context="WorkWithUsTab, label">AI guide's name</Trans></label>
            <input type="text" value={cfg.assistantName ?? ""} onChange={(e) => setCfg({ ...cfg, assistantName: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1"><Trans context="WorkWithUsTab, p">What an accepted proposal pays</Trans></p>
            <p className="text-xs text-gray-500">
              <Trans context="WorkWithUsTab, p">The village&apos;s work tokens, set on the Mint panel under &quot;The village accepts a member&apos;s proposal to work with it&quot;.
            </Trans></p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1"><Trans context="WorkWithUsTab, label">Guide's opening greeting</Trans></label>
          <textarea value={cfg.assistantGreeting ?? ""} onChange={(e) => setCfg({ ...cfg, assistantGreeting: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y" />
          <p className="text-[11px] text-gray-400 mt-0.5"><Trans context="WorkWithUsTab, p">Use {nameToken} where the guide's name should appear.</Trans></p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700"><Trans context="WorkWithUsTab, label">Reciprocity (exchange) options</Trans></label>
            <button onClick={addOpt} className="text-xs text-teal-deep font-medium hover:underline"><Trans context="WorkWithUsTab, button">+ Add option</Trans></button>
          </div>
          <div className="space-y-3">
            {opts.map((o: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input type="text" value={o.title} onChange={(e) => setOpt(i, { title: e.target.value })} placeholder={t({ message: "Title (shown)", context: "WorkWithUsTab, placeholder" })} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                  <input type="text" value={o.value} onChange={(e) => setOpt(i, { value: e.target.value })} placeholder={t({ message: "Value (stored)", context: "WorkWithUsTab, placeholder" })} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                  <button onClick={() => removeOpt(i)} aria-label={t({ message: "Remove this option", context: "WorkWithUsTab, aria-label" })} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <textarea value={o.desc} onChange={(e) => setOpt(i, { desc: e.target.value })} rows={2} placeholder={t({ message: "Description", context: "WorkWithUsTab, placeholder" })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
