/**
 * The rites module's card setting: the village's whole `village-rites/1`
 * document (shared/rites.ts), pasted or edited as text, read by the same rules
 * the server reads it with before anything saves. Every problem is named; a
 * document with any is not sent. Saving replaces the document whole through
 * `PUT /api/admin/modules/rites/config`, so a removed rite is really gone.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { parseRitesConfig, RITES_FORMAT } from "@shared/rites";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { useModuleConfig } from "./ModuleConfigPanels";

const btnCls =
  "min-h-[44px] px-3 text-sm rounded-lg border border-border text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-teal-deep disabled:opacity-40";
const saveCls =
  "min-h-[44px] px-4 text-sm rounded-lg bg-teal-deep text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-deep disabled:opacity-40";

export default function RitesConfigPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const { config, loading, reload } = useModuleConfig("rites", password);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) setText(JSON.stringify(config && Object.keys(config).length ? config : { format: RITES_FORMAT, rites: [] }, null, 2));
  }, [config, loading]);

  const read = useMemo(() => {
    try {
      return { parsed: JSON.parse(text) as unknown, error: "" };
    } catch (e) {
      return { parsed: null, error: (e as Error).message };
    }
  }, [text]);
  const problems = read.error ? [t({ message: `This is not JSON yet: ${read.error}`, context: "rites admin" })] : parseRitesConfig(read.parsed).problems;
  const rites = read.error ? [] : parseRitesConfig(read.parsed).config.rites;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/modules/rites/config`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ config: read.parsed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(refusal(d, t({ message: "That did not save", context: "rites admin" })));
      else {
        toast.success(t({ message: "The rites document is saved", context: "rites admin" }));
        await reload();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground"><Trans context="rites admin">Reading the document...</Trans></p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        <Trans context="rites admin">
          The village's rites, their spoken lines, every word on the joining screens, the photos and the colours, in one document. Paste a village-rites/1 file or edit it here.
        </Trans>
      </p>
      <textarea
        className="w-full min-h-[320px] font-mono text-xs border border-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-deep"
        value={text}
        spellCheck={false}
        aria-label={t({ message: "The rites document", context: "rites admin" })}
        onChange={(e) => setText(e.target.value)}
      />
      {problems.length ? (
        <ul className="text-sm text-foreground bg-muted border border-border rounded-lg p-3 list-disc pl-6">
          {problems.slice(0, 20).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground">
          <Trans context="rites admin">Reads clean: {rites.length} rites, in this order: {rites.map((r) => r.todo).join(", ")}.</Trans>
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className={saveCls} disabled={saving || problems.length > 0} onClick={() => void save()}>
          <Trans context="rites admin">Save the document</Trans>
        </button>
        <button type="button" className={btnCls} disabled={saving} onClick={() => void reload()}>
          <Trans context="rites admin">Undo my edits</Trans>
        </button>
      </div>
    </div>
  );
}
