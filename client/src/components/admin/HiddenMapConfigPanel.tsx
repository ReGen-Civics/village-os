/**
 * The hidden map's words and quests, on its module card (QA pass 5, P5-19):
 * the map's name, each layer's name, the question above its kinds and the
 * kinds themselves, which layers every member sees, and the two quests that
 * pay for a vouched planting and for a return visit.
 *
 * Everything a member reads about the village's map comes from here, which is
 * how the platform carries no village's words. It writes through the one
 * config route, re-reading the live document first (`useModuleConfig`), and the
 * module's own validator (`validateConfig` in shared/hiddenMap.ts) is the
 * authority: its refusal is shown as it is.
 *
 * Colours are the admin palette's tokens (card, border, foreground, muted), so a
 * village's own palette draws it.
 */
import { useState } from "react";
import { MapPin } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { LAYERS, VOUCH_WAYS, readConfig, type Layer, type VouchWay } from "@shared/hiddenMap";
import { WAY_WORDS } from "@/components/hiddenMap/PinPanel";
import { ConfigSaveBar, useModuleConfig } from "./ModuleConfigPanels";

const inputCls =
  "border border-border rounded-lg px-2 py-1.5 text-sm min-h-[44px] w-full focus:outline-none focus:ring-2 focus:ring-teal-deep";

interface Draft {
  title: string;
  labels: Record<Layer, string>;
  kindPrompts: Record<Layer, string>;
  kinds: Record<Layer, string>;
  openLayers: Layer[];
  plantingQuestId: string;
  returnVisitQuestId: string;
  vouchWays: VouchWay[];
  vouchRule: string;
}

function draftOf(raw: unknown): Draft {
  const c = readConfig(raw);
  const each = <T,>(f: (l: Layer) => T) => Object.fromEntries(LAYERS.map((l) => [l, f(l)])) as Record<Layer, T>;
  return {
    title: c.title,
    labels: each((l) => c.labels[l]),
    kindPrompts: each((l) => c.kindPrompts[l]),
    kinds: each((l) => c.kinds[l].join("\n")),
    openLayers: [...c.openLayers],
    plantingQuestId: c.plantingQuestId ?? "",
    returnVisitQuestId: c.returnVisitQuestId ?? "",
    vouchWays: [...c.vouchWays],
    vouchRule: c.vouchRule,
  };
}

/** The draft as the module's config: blank lines dropped, blank quests sent as none. */
export function configFromDraft(d: Draft): Record<string, unknown> {
  const each = <T,>(f: (l: Layer) => T) => Object.fromEntries(LAYERS.map((l) => [l, f(l)]));
  return {
    title: d.title.trim(),
    labels: each((l) => d.labels[l].trim()),
    kindPrompts: each((l) => d.kindPrompts[l].trim()),
    kinds: each((l) => d.kinds[l].split("\n").map((k) => k.trim()).filter(Boolean)),
    openLayers: d.openLayers,
    plantingQuestId: d.plantingQuestId.trim() || null,
    returnVisitQuestId: d.returnVisitQuestId.trim() || null,
    vouchWays: d.vouchWays,
    vouchRule: d.vouchRule.trim(),
  };
}

export default function HiddenMapConfigPanel({ password }: { password: string }) {
  const { t, i18n } = useLingui();
  const { config, loading, write } = useModuleConfig("hidden-map", password);
  const [draft, setDraft] = useState<Draft>(() => draftOf(config));
  // The draft follows the loaded config IN THE SAME RENDER, never in an effect after it: an
  // effect left a window where the form was on screen with the defaults, and a word typed in
  // that window was overwritten when the effect ran (a red CI shard, 16 Nov 2026).
  const [draftFor, setDraftFor] = useState<unknown>(config);
  if (draftFor !== config) {
    setDraftFor(config);
    setDraft(draftOf(config));
  }

  if (loading) return <p className="text-sm text-muted-foreground"><Trans context="hidden map settings">Loading</Trans></p>;

  const setLayer = (field: "labels" | "kindPrompts" | "kinds", l: Layer, v: string) =>
    setDraft((d) => ({ ...d, [field]: { ...d[field], [l]: v } }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
        <MapPin className="size-4 text-teal-deep" aria-hidden="true" /> <Trans>The map's words and quests</Trans>
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        <Trans>Everything a member reads about this map comes from here. Saved now, it shows the moment the module is on.</Trans>
      </p>

      <label className="block text-xs text-foreground">
        <Trans context="hidden map settings">The map's name</Trans>
        <input className={`${inputCls} mt-1`} maxLength={40} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {LAYERS.map((l) => (
          <fieldset key={l} className="rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold text-foreground">{draft.labels[l] || l}</legend>
            <label className="block text-xs text-foreground">
              <Trans context="hidden map settings">Layer name</Trans>
              <input className={`${inputCls} mt-1`} maxLength={40} value={draft.labels[l]} onChange={(e) => setLayer("labels", l, e.target.value)} />
            </label>
            <label className="mt-2 block text-xs text-foreground">
              <Trans>Question above its kinds</Trans>
              <input className={`${inputCls} mt-1`} maxLength={80} value={draft.kindPrompts[l]} onChange={(e) => setLayer("kindPrompts", l, e.target.value)} />
            </label>
            <label className="mt-2 block text-xs text-foreground">
              <Trans>Kinds, one a line</Trans>
              <textarea className={`${inputCls} mt-1`} rows={5} value={draft.kinds[l]} onChange={(e) => setLayer("kinds", l, e.target.value)} />
            </label>
            <label className="mt-2 flex min-h-[44px] items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={draft.openLayers.includes(l)}
                onChange={(e) =>
                  setDraft({ ...draft, openLayers: e.target.checked ? [...draft.openLayers, l] : draft.openLayers.filter((x) => x !== l) })
                }
              />
              <Trans>Every member sees this layer, before their map opens</Trans>
            </label>
          </fieldset>
        ))}
      </div>

      <fieldset className="mt-4 rounded-lg border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-foreground"><Trans context="hidden map settings">Vouching</Trans></legend>
        <label className="block text-xs text-foreground">
          <Trans>The rule a voucher reads</Trans>
          <textarea className={`${inputCls} mt-1`} rows={2} maxLength={300} value={draft.vouchRule} onChange={(e) => setDraft({ ...draft, vouchRule: e.target.value })} />
        </label>
        <p className="mt-2 text-xs text-foreground"><Trans>Ways of seeing it that count</Trans></p>
        <div className="mt-1 flex flex-wrap gap-3">
          {VOUCH_WAYS.map((w) => (
            <label key={w} className="flex min-h-[44px] items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={draft.vouchWays.includes(w)}
                onChange={(e) =>
                  setDraft({ ...draft, vouchWays: e.target.checked ? [...draft.vouchWays, w] : draft.vouchWays.filter((x) => x !== w) })
                }
              />
              {i18n._(WAY_WORDS[w])}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-xs text-foreground">
          <Trans>Quest that pays when a planting is vouched (its id)</Trans>
          <input className={`${inputCls} mt-1`} maxLength={64} value={draft.plantingQuestId} onChange={(e) => setDraft({ ...draft, plantingQuestId: e.target.value })} placeholder={t({ message: `None`, context: "hidden map settings" })} />
        </label>
        <label className="block text-xs text-foreground">
          <Trans>Quest that pays for a return visit (its id)</Trans>
          <input className={`${inputCls} mt-1`} maxLength={64} value={draft.returnVisitQuestId} onChange={(e) => setDraft({ ...draft, returnVisitQuestId: e.target.value })} placeholder={t({ message: `None`, context: "hidden map settings" })} />
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <Trans>Each claim it opens is completed by the usual consent on the quest board, and the quest's own reward pays it.</Trans>
      </p>

      <ConfigSaveBar
        draft={configFromDraft(draft)}
        stored={configFromDraft(draftOf(config))}
        write={() => write(configFromDraft(draft))}
        onDiscard={() => setDraft(draftOf(config))}
        what={t({ message: "the map's words and quests", context: "hidden map settings, save bar" })}
      />
    </div>
  );
}
