/**
 * The admin surfaces for module config that shipped with no door.
 *
 * `module_settings.config` is a validated JSON document per module and the ONE
 * write route is `PUT /api/admin/modules/:id/config`. Several modules shipped
 * with config a founder is expected to own and no way to reach it: crowdpool's
 * linked campaigns (so the module could be enabled and the server would report
 * "no campaigns linked" with nothing a founder could do), and the forum and
 * tools category lists (validated on every write, read on every request, and
 * editable by nobody).
 *
 * TWO RULES HOLD EVERY PANEL HERE.
 *
 * 1. `setModuleConfig` REPLACES the whole document. It does not merge. So every
 *    save here re-reads the live config first and writes it back whole with one
 *    key changed. A bare partial write would drop `imageUrl` off a module's
 *    store card, and for forum and tools it would fail the module's own
 *    validator, which requires `categories` to be present.
 *
 * 2. The server's validator is the authority and its refusal is shown verbatim.
 *    These panels do light shaping (trim, drop blanks) and no second copy of
 *    the rules, because two validators are two answers waiting to disagree.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, MessageSquare, Wrench } from "lucide-react";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import SaveBar, { type SaveResult } from "@/components/SaveBar";
import { Trans, useLingui } from "@lingui/react/macro";

const inputCls =
  "border border-gray-200 rounded-lg px-2 py-1.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-deep";
const btnCls =
  "min-h-[44px] px-3 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-deep disabled:opacity-40";

/**
 * Read the live config for one module, hand it to a caller, and write back the
 * WHOLE document with the caller's change folded in.
 *
 * Re-reading at save time rather than trusting what was loaded when the tab
 * opened: a founder who leaves this page open while another admin edits the
 * same module would otherwise write a config document back from memory and
 * silently undo them.
 *
 * Exported so a panel kept in its own file (`SaberraConfigPanel.tsx`) saves
 * through this same re-read-then-write path instead of a second one.
 */
/**
 * Fill a panel's boxes from the stored config in the SAME render that first
 * shows them, and again whenever the stored config changes (a load, a save).
 *
 * This was an effect, `useEffect(reset, [config])`, and an effect runs after
 * the paint: for one frame the boxes showed their defaults, and an edit made
 * in that frame was overwritten when the effect landed, so the save bar never
 * rose for it. A loaded runner made that frame long enough for a test to type
 * into (ModuleConfigPanels.saveBar.test.tsx, 1.3.74 batch). Setting state
 * while rendering, keyed on what was last seen, is React's documented way to
 * adjust state when an input changes, and it leaves no frame in between.
 */
export function useSeedFrom(config: unknown, seed: () => void) {
  const [seen, setSeen] = useState<unknown>(undefined);
  if (seen !== config) {
    setSeen(config);
    seed();
  }
}

export function useModuleConfig(moduleId: string, password: string) {
  const [config, setConfig] = useState<any>(null);
  const [lifecycle, setLifecycle] = useState<string>("off");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/modules`, { headers: authHeaders(password) });
      const d = await res.json();
      const m = (d?.modules ?? []).find((x: any) => x.id === moduleId);
      setConfig(m?.config ?? null);
      setLifecycle(String(m?.served ?? m?.lifecycle ?? "off"));
    } catch {
      setConfig(null);
    }
    setLoading(false);
  }, [moduleId, password]);

  useEffect(() => { void load(); }, [load]);

  /**
   * The write, answering the save bar's shape: ok, or the server's refusal in
   * its own words. Nothing is said here; the bar says "Saved" or the reason.
   */
  const write = async (patch: Record<string, unknown>): Promise<SaveResult> => {
    let live: any = config ?? {};
    try {
      const res = await fetch(`${API_BASE}/admin/modules`, { headers: authHeaders(password) });
      const d = await res.json();
      live = (d?.modules ?? []).find((x: any) => x.id === moduleId)?.config ?? {};
    } catch { /* fall back to what this tab loaded */ }
    const res = await fetch(`${API_BASE}/admin/modules/${moduleId}/config`, {
      method: "PUT",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify({ config: { ...live, ...patch } }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: refusal(d, "That did not save") };
    setConfig(d.config ?? { ...live, ...patch });
    return { ok: true };
  };

  /** The same write for a panel with its own button: a refusal is a toast, the answer a boolean. */
  const save = async (patch: Record<string, unknown>): Promise<boolean> => {
    const r = await write(patch);
    if (!r.ok) toast.error(r.reason ?? "That did not save");
    return r.ok;
  };

  return { config, lifecycle, loading, save, write, reload: load };
}

/**
 * ONE WAY TO SAVE (Admin evolution, the lead's ask of 25 Nov 2026: "whenever
 * I'm changing a setting, have it pop up ... so I can immediately save it").
 *
 * A panel here keeps its draft as it always did and hands this the payload it
 * would write and the payload the stored config already holds. When they
 * differ, the one save bar at the foot of the screen counts the change
 * (components/SaveBar.tsx; several panels on one page share one bar), and its
 * Save writes through `write` above, its Discard puts the draft back.
 */
export function ConfigSaveBar({
  draft,
  stored,
  write,
  onDiscard,
  onSaved,
  what,
}: {
  draft: unknown;
  stored: unknown;
  write: () => Promise<SaveResult>;
  onDiscard: () => void;
  onSaved?: () => void;
  what: string;
}) {
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  return (
    <SaveBar
      count={dirty ? 1 : 0}
      what={what}
      onDiscard={onDiscard}
      onSave={async () => {
        const r = await write();
        if (r.ok) onSaved?.();
        return r;
      }}
    />
  );
}

/**
 * The shared "this module is off" board, so an empty editor is never a mystery.
 *
 * It used to send a founder away to turn the module on first. Setting a module
 * up happens BEFORE it is switched on (Rye, 2026-09-15), and this editor has
 * always written to the stored config whatever the lifecycle says, so the
 * board now states what is true: the work is kept and it starts counting when
 * the module does.
 */
function ModuleOff({ name }: { name: string }) {
  return (
    <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
      <Trans context="ModuleConfigPanels, p">The {name} module is off. What you set here is saved now and takes effect
      the moment you turn it on.
    </Trans></p>
  );
}

// ── Crowdpool: which campaigns this village has linked ───────────────────────

interface CampaignRow {
  slug: string;
  id: string;
  hubBaseUrl: string;
}

const toRows = (list: any): CampaignRow[] =>
  (Array.isArray(list) ? list : []).map((c: any) => ({
    slug: String(c?.slug ?? ""),
    id: c?.id === undefined || c?.id === null ? "" : String(c.id),
    hubBaseUrl: String(c?.hubBaseUrl ?? ""),
  }));

/**
 * Shape rows back into what the module's validator expects: a slug OR a
 * positive integer id, and an optional https hub override. Blank fields are
 * dropped rather than sent as empty strings, because `slug: ""` fails the
 * lowercase-slug test and would read as a typo the founder never made.
 */
const toRefs = (rows: CampaignRow[]) =>
  rows
    .filter((r) => r.slug.trim() || r.id.trim())
    .map((r) => {
      const ref: Record<string, unknown> = {};
      if (r.slug.trim()) ref.slug = r.slug.trim().toLowerCase();
      if (r.id.trim()) ref.id = Number(r.id.trim());
      if (r.hubBaseUrl.trim()) ref.hubBaseUrl = r.hubBaseUrl.trim();
      return ref;
    });

/**
 * The linked campaigns, as a panel the module card can mount.
 *
 * SPLIT OUT OF `CrowdpoolAdminTab` rather than copied, so the Crowdpool card in
 * the Module Library and the Crowdpool tab are the same editor writing through
 * the same route. `onSaved` is how the tab's hub-status card below it learns
 * that the links moved.
 */
export function CrowdpoolCampaignsEditor({ password, onSaved }: { password: string; onSaved?: () => void }) {
  const { t } = useLingui();
  const { config, lifecycle, loading, write } = useModuleConfig("crowdpool", password);
  const [rows, setRows] = useState<CampaignRow[]>([]);

  useSeedFrom(config, () => setRows(toRows(config?.villageCampaigns)));

  if (loading) return <p className="text-sm text-gray-500"><Trans context="ModuleConfigPanels, p">Loading…</Trans></p>;

  const set = (i: number, patch: Partial<CampaignRow>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-4">
      {lifecycle === "off" && <ModuleOff name="Crowdpool" />}

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-1"><Trans context="ModuleConfigPanels, h3">Linked campaigns</Trans></h3>
        <p className="text-xs text-gray-500 mb-3">
          <Trans context="ModuleConfigPanels, p">A slug is the campaign's address on the hub and is what /campaign/:slug
          uses. A numeric hub id works too and is what the hub itself calls the
          campaign. One of the two is enough; both together are the surest match.
        </Trans></p>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid sm:grid-cols-12 gap-2 items-end border border-gray-100 rounded-lg p-3">
              <label className="text-xs text-gray-500 sm:col-span-4">
                Slug
                <input value={r.slug} onChange={(e) => set(i, { slug: e.target.value })}
                  placeholder={t({ message: "second-raising", context: "ModuleConfigPanels, placeholder" })} className={`${inputCls} w-full mt-1`} />
              </label>
              <label className="text-xs text-gray-500 sm:col-span-2">
                Hub id
                <input value={r.id} onChange={(e) => set(i, { id: e.target.value })}
                  inputMode="numeric" placeholder="79" className={`${inputCls} w-full mt-1`} />
              </label>
              <label className="text-xs text-gray-500 sm:col-span-4">
                Hub address, if this one lives somewhere else
                <input value={r.hubBaseUrl} onChange={(e) => set(i, { hubBaseUrl: e.target.value })}
                  placeholder={t({ message: "https://hub.example", context: "ModuleConfigPanels, placeholder" })} className={`${inputCls} w-full mt-1`} />
              </label>
              <div className="sm:col-span-2">
                <button type="button" className={`${btnCls} text-red-600 border-red-200 w-full`}
                  aria-label={`Unlink campaign ${r.slug || r.id || i + 1}`}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trans context="ModuleConfigPanels, button">Unlink</Trans></button>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-gray-400">
              <Trans context="ModuleConfigPanels, p">No campaigns linked. /campaigns shows its empty board until one is.
            </Trans></p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className={btnCls}
            onClick={() => setRows([...rows, { slug: "", id: "", hubBaseUrl: "" }])}><Trans context="ModuleConfigPanels, button">Link a campaign</Trans></button>
        </div>
        <ConfigSaveBar
          draft={toRefs(rows)}
          stored={toRefs(toRows(config?.villageCampaigns))}
          write={() => write({ villageCampaigns: toRefs(rows) })}
          onDiscard={() => setRows(toRows(config?.villageCampaigns))}
          onSaved={onSaved}
          what={t({ message: "the linked campaigns", context: "ModuleConfigPanels, save bar" })}
        />
      </div>
    </div>
  );
}

export function CrowdpoolAdminTab({ password }: { password: string }) {
  const [status, setStatus] = useState<any>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/crowdpool/status`, { headers: authHeaders(password) });
      setStatus(res.ok ? await res.json() : null);
    } catch { setStatus(null); }
  }, [password]);
  useEffect(() => { void loadStatus(); }, [loadStatus]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Trans context="ModuleConfigPanels, h2"><Coins className="w-5 h-5 text-teal-deep" /> Crowdpool
        </Trans></h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          <Trans context="ModuleConfigPanels, p">Which raisings on the hub belong to this village. Each one linked here
          gets a ring on /campaigns and a page at /campaign/its-slug. The numbers
          come from the hub every ten minutes; nothing is pledged or held here.
        </Trans></p>
      </div>

      <CrowdpoolCampaignsEditor password={password} onSaved={loadStatus} />

      {/*
        What the hub actually answered. A linked slug the hub has never served
        is the one failure a founder cannot see from the config alone, so it is
        named here rather than left to the empty ring on /campaigns.
      */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-1"><Trans context="ModuleConfigPanels, h3">What the hub answered</Trans></h3>
        <p className="text-xs text-gray-500 mb-3"><Trans context="ModuleConfigPanels, p">Hub: {status?.hubBaseUrl || "not set"}</Trans></p>
        {(status?.campaigns ?? []).length === 0 && (
          <p className="text-sm text-gray-400"><Trans context="ModuleConfigPanels, p">Nothing synced yet. The sync runs every ten minutes.</Trans></p>
        )}
        <ul className="space-y-1">
          {(status?.campaigns ?? []).map((c: any) => (
            <li key={c.key} className="text-sm text-gray-700">
              <span className="font-medium">{c.key}</span>
              {c.title ? <span className="text-gray-500"> · {c.title}</span> : null}
              <span className="text-gray-400"> · {c.lastSyncAt ? `last read ${new Date(c.lastSyncAt).toLocaleString()}` : "never read"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Forum and tools: the category lists ──────────────────────────────────────

interface CategoryRow {
  id: string;
  label: string;
  sortOrder: number;
  /**
   * True for a row that was already saved when this editor loaded.
   *
   * The lock has to travel ON THE ROW rather than be recomputed from the
   * stored ids each render. Comparing a row's id against the stored set froze
   * a NEW row's id field the instant somebody typed a word that matched an
   * existing category, mid-keystroke, with a "threads already point at it"
   * note under a category that did not exist yet.
   */
  locked: boolean;
}

const toCategories = (list: any): CategoryRow[] =>
  (Array.isArray(list) ? list : []).map((c: any, i: number) => ({
    id: String(c?.id ?? ""),
    label: String(c?.label ?? ""),
    sortOrder: Number.isFinite(Number(c?.sortOrder)) ? Number(c.sortOrder) : i + 1,
    locked: true,
  }));

/** What the category editor writes: blank rows dropped, words trimmed. */
const categoryPayload = (rows: CategoryRow[]) =>
  rows
    .filter((r) => r.id.trim() && r.label.trim())
    .map((r) => ({ id: r.id.trim(), label: r.label.trim(), sortOrder: Number(r.sortOrder) || 0 }));

/**
 * The category editor both the forum and the tools hub were missing.
 *
 * Ids are the stored key on every thread and every tool, so an id is typed once
 * and then locked: renaming it in place would orphan every row that already
 * points at it, quietly, with no error anywhere. The label is what people read
 * and is free to change any time.
 */
export function CategoryListEditor({
  moduleId, moduleName, password, title, blurb, icon,
}: {
  moduleId: string;
  moduleName: string;
  password: string;
  title: string;
  blurb: string;
  icon: React.ReactNode;
}) {
  const { t } = useLingui();
  const { config, lifecycle, loading, write } = useModuleConfig(moduleId, password);
  const [rows, setRows] = useState<CategoryRow[]>([]);

  useSeedFrom(config, () => setRows(toCategories(config?.categories)));

  if (loading) return <p className="text-sm text-gray-500"><Trans context="ModuleConfigPanels, p">Loading…</Trans></p>;

  const set = (i: number, patch: Partial<CategoryRow>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">{icon} {title}</h3>
      <p className="text-xs text-gray-500 mb-3">{blurb}</p>
      {lifecycle === "off" && <div className="mb-3"><ModuleOff name={moduleName} /></div>}

      <div className="space-y-2">
        {rows.map((r, i) => {
          const locked = r.locked;
          return (
            <div key={i} className="grid sm:grid-cols-12 gap-2 items-end">
              <label className="text-xs text-gray-500 sm:col-span-4">
                Id
                {/* The locked note is a description. Inside the <label> it
                    became part of this field's name, and only on the rows
                    where it appears, so the same field announced two
                    different names depending on the row. */}
                <input value={r.id} disabled={locked}
                  aria-label={t({ message: "Id", context: "ModuleConfigPanels, aria-label" })}
                  aria-describedby={locked ? `category-${i}-locked` : undefined}
                  onChange={(e) => set(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  placeholder={t({ message: "village-life", context: "ModuleConfigPanels, placeholder" })} className={`${inputCls} w-full mt-1 disabled:bg-gray-50 disabled:text-gray-500`} />
                {locked && <span id={`category-${i}-locked`} className="block text-[11px] text-gray-400 mt-0.5"><Trans context="ModuleConfigPanels, span">Fixed. Threads and tools already point at it.</Trans></span>}
              </label>
              <label className="text-xs text-gray-500 sm:col-span-5">
                What people read
                <input value={r.label} onChange={(e) => set(i, { label: e.target.value })}
                  className={`${inputCls} w-full mt-1`} />
              </label>
              <label className="text-xs text-gray-500 sm:col-span-1">
                Order
                <input type="number" value={r.sortOrder} onChange={(e) => set(i, { sortOrder: Number(e.target.value) })}
                  className={`${inputCls} w-full mt-1`} />
              </label>
              <div className="sm:col-span-2">
                <button type="button" className={`${btnCls} text-red-600 border-red-200 w-full`}
                  aria-label={`Remove category ${r.label || r.id}`}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trans context="ModuleConfigPanels, button">Remove</Trans></button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" className={btnCls}
          onClick={() => setRows([...rows, { id: "", label: "", sortOrder: rows.length + 1, locked: false }])}><Trans context="ModuleConfigPanels, button">Add a category</Trans></button>
      </div>
      <ConfigSaveBar
        draft={categoryPayload(rows)}
        stored={categoryPayload(toCategories(config?.categories))}
        write={() => write({ categories: categoryPayload(rows) })}
        onDiscard={() => setRows(toCategories(config?.categories))}
        what={t({ message: `the ${moduleName} categories`, context: "ModuleConfigPanels, save bar" })}
      />
      <p className="text-[11px] text-gray-400 mt-2">
        <Trans context="ModuleConfigPanels, p">Removing a category leaves anything already filed under it pointing at a
        name nobody can pick again. Rename the label instead when what you want
        is different words for the same shelf.
      </Trans></p>
    </div>
  );
}

// ── Resources: where a spending approval lands, and who sees the measured flows ──

/**
 * Two keys read on every `/api/resources` request that no form could reach.
 *
 * `requestCategory` names the forum category a spending-approval request is
 * prefilled into. It is stored as a bare slug and cross-checked at USE time
 * rather than at write time: a category that no longer exists falls back to
 * whichever forum category happens to sort first, silently, so a typo routes
 * every approval request to the wrong shelf and nothing anywhere says so. The
 * picker offers the live list for that reason.
 *
 * `measuredVisibleTo` decides whether members see the measured inflows or only
 * admins do. It fails OPEN in the reader (anything that is not the literal
 * "admins" reads as "members"), which is the right default and the wrong thing
 * to leave un-editable.
 */
export function ResourcesRoutingEditor({ password }: { password: string }) {
  const { t } = useLingui();
  const { config, loading, write } = useModuleConfig("resources", password);
  const forum = useModuleConfig("forum", password);
  const [category, setCategory] = useState("");
  const [visibleTo, setVisibleTo] = useState("members");

  const storedRouting = () => ({
    requestCategory: String(config?.requestCategory ?? "governance"),
    measuredVisibleTo: config?.measuredVisibleTo === "admins" ? "admins" : "members",
  });
  const reset = () => {
    const r = storedRouting();
    setCategory(r.requestCategory);
    setVisibleTo(r.measuredVisibleTo);
  };
  useSeedFrom(config, reset);

  if (loading) return <p className="text-sm text-gray-500"><Trans context="ModuleConfigPanels, p">Loading…</Trans></p>;

  const categories = toCategories(forum.config?.categories);
  const known = categories.some((c) => c.id === category);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-1"><Trans context="ModuleConfigPanels, h3">Where requests go, and who sees the flows</Trans></h3>
      <p className="text-xs text-gray-500 mb-3">
        <Trans context="ModuleConfigPanels, p">Both of these are read every time somebody opens /resources. Neither had
        a control until now.
      </Trans></p>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-gray-500">
          Forum category a spending request is filed under
          {/* The warning is a description, and a conditional one: inside the
              <label> it appeared in this control's name only when a category
              had gone missing, which is the moment the name most needed to
              stay recognisable. */}
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            aria-label={t({ message: "Forum category a spending request is filed under", context: "ModuleConfigPanels, aria-label" })}
            aria-describedby={known ? undefined : "spend-category-warning"}
            className={`${inputCls} w-full mt-1`}>
            {!known && <option value={category}>{category} (no forum category by that name)</option>}
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.id})</option>)}
          </select>
          {!known && (
            <span id="spend-category-warning" className="block text-[11px] text-amber-800 mt-1">
              <Trans context="ModuleConfigPanels, span">Nothing on the forum answers to this name, so every approval request
              lands in whichever category sorts first. Pick one from the list.
            </Trans></span>
          )}
        </label>

        <fieldset className="text-xs text-gray-500 border-0 p-0 m-0">
          <legend><Trans context="ModuleConfigPanels, legend">Who sees the measured inflows</Trans></legend>
          <div className="mt-1 space-y-1">
            {[["members", "Everyone signed in"], ["admins", "Admins only"]].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 min-h-[44px] text-sm text-gray-700">
                <input type="radio" name="measuredVisibleTo" value={value} checked={visibleTo === value}
                  onChange={() => setVisibleTo(value)} className="w-5 h-5 focus:outline-none focus:ring-2 focus:ring-teal-deep" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <ConfigSaveBar
        draft={{ requestCategory: category, measuredVisibleTo: visibleTo }}
        stored={storedRouting()}
        write={() => write({ requestCategory: category, measuredVisibleTo: visibleTo })}
        onDiscard={reset}
        what={t({ message: "the resources routing", context: "ModuleConfigPanels, save bar" })}
      />
    </div>
  );
}

/**
 * Call Automation's structural config, which had NO editor anywhere.
 *
 * Three keys are read on every recording sync and every synthesis
 * (`server/index.ts`): the channel recordings are pulled from, how many ready
 * syntheses may queue before the job stops adding to the pile, and the forum
 * category a published synthesis lands in. A founder could enable the module
 * and had no way to name their own channel, so the sync read an empty string
 * and found nothing, with nothing on any screen saying why.
 *
 * `maxReadyQueue` is bounded 1 to 100 by the module's own validator, and that
 * validator is the authority: the number input carries the same bounds so the
 * browser can say so early, and the server's refusal is what decides.
 */
export function AutomationConfigEditor({ password }: { password: string }) {
  const { t } = useLingui();
  const { config, lifecycle, loading, write } = useModuleConfig("automation", password);
  const [channel, setChannel] = useState("");
  const [queue, setQueue] = useState("15");
  const [category, setCategory] = useState("");

  const reset = () => {
    setChannel(String(config?.youtubeChannelId ?? ""));
    setQueue(String(config?.maxReadyQueue ?? 15));
    setCategory(String(config?.forumCategory ?? ""));
  };
  useSeedFrom(config, reset);
  const automationPayload = (c: string, q: string, f: string) => ({ youtubeChannelId: c.trim(), maxReadyQueue: Number(q), forumCategory: f.trim() });

  if (loading) return <p className="text-sm text-gray-500"><Trans context="ModuleConfigPanels, p">Loading…</Trans></p>;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <Trans context="ModuleConfigPanels, h3"><Wrench className="w-4 h-4 text-teal-deep" /> Where recordings come from, and where syntheses go
      </Trans></h3>
      <p className="text-xs text-gray-500 mb-3">
        <Trans context="ModuleConfigPanels, p">Read on every sync and every publish. Without a channel id nothing is ever pulled in.
      </Trans></p>
      {lifecycle === "off" && <div className="mb-3"><ModuleOff name="Call Automation" /></div>}

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-xs text-gray-600">
          Channel id the recordings are pulled from
          <input value={channel} onChange={(e) => setChannel(e.target.value)}
            placeholder={t({ message: "UC...", context: "ModuleConfigPanels, placeholder" })} className={`${inputCls} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-600">
          Ready syntheses allowed to wait for a human
          <input type="number" min={1} max={100} value={queue} onChange={(e) => setQueue(e.target.value)}
            className={`${inputCls} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-600">
          Forum category a published synthesis is filed under
          <input value={category} onChange={(e) => setCategory(e.target.value)}
            placeholder={t({ message: "village-life", context: "ModuleConfigPanels, placeholder" })} className={`${inputCls} w-full mt-1`} />
        </label>
      </div>

      <ConfigSaveBar
        draft={automationPayload(channel, queue, category)}
        stored={automationPayload(String(config?.youtubeChannelId ?? ""), String(config?.maxReadyQueue ?? 15), String(config?.forumCategory ?? ""))}
        write={() => write(automationPayload(channel, queue, category))}
        onDiscard={reset}
        what={t({ message: "the call automation settings", context: "ModuleConfigPanels, save bar" })}
      />
    </div>
  );
}

export function ForumCategoriesEditor({ password }: { password: string }) {
  const { t } = useLingui();
  return (
    <CategoryListEditor
      moduleId="forum"
      moduleName="Forum"
      password={password}
      title={t({ message: "Forum categories", context: "ModuleConfigPanels, title" })}
      blurb="The shelves every thread is filed under. Read on every request, shown on /forum, and offered when somebody starts a thread."
      icon={<MessageSquare className="w-4 h-4 text-teal-deep" />}
    />
  );
}

export function ToolsCategoriesEditor({ password }: { password: string }) {
  const { t } = useLingui();
  return (
    <CategoryListEditor
      moduleId="tools"
      moduleName="Tools"
      password={password}
      title={t({ message: "Tool categories", context: "ModuleConfigPanels, title" })}
      blurb="How the tools hub groups what the village uses. A tool can only be filed under a category listed here."
      icon={<Wrench className="w-4 h-4 text-teal-deep" />}
    />
  );
}
