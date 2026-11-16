/**
 * The protocols module's card in Admin: write the checklists, import a file of
 * them, archive one, and switch the "add to your phone" card.
 *
 * Every save goes through `PUT /api/admin/protocols/:id`, which checks the draft
 * with the same `checkProtocolDraft` the browser runs here, and saves a NEW
 * version, so a run already started keeps the steps it started with. An import
 * is shown first (what it would create or update, and every problem by name)
 * and saved only when the whole file is clean.
 *
 * Drawn in the palette's semantic tokens, which the admin workspace keeps light.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { checkProtocolDraft, type ProtocolStep, type ProtocolView, type StepWho } from "@shared/protocols";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { useModuleConfig } from "./ModuleConfigPanels";

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ring";
const saveCls =
  "min-h-[44px] rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-40";
const btnCls =
  "min-h-[44px] rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40";
const problemCls = "space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive";

interface Role {
  id: string;
  title: string;
}

interface Draft {
  id: string;
  title: string;
  summary: string;
  image: string;
  steps: ProtocolStep[];
  isNew: boolean;
}

const blankStep = (): ProtocolStep => ({ id: "", text: "", detail: "", required: true, who: { kind: "member" } });

export default function ProtocolsEditor({ password }: { password: string }) {
  const { t } = useLingui();
  const [protocols, setProtocols] = useState<ProtocolView[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const config = useModuleConfig("protocols", password);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/protocols`, { headers: authHeaders(password) });
      const d = await res.json();
      if (!res.ok) throw new Error(refusal(d, t({ message: `The protocols did not load.`, context: "admin protocols editor" })));
      setProtocols(d.protocols ?? []);
      setRoles(d.roles ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t({ message: `The protocols did not load.`, context: "admin protocols editor" }));
    }
    setLoading(false);
  }, [password, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleTitles = new Map(roles.map((r) => [r.id, r.title]));

  const save = async () => {
    if (!draft) return;
    const checked = checkProtocolDraft(draft.isNew ? { ...draft, id: "" } : draft, roleTitles);
    if (!checked.ok) {
      setProblems(checked.problems);
      return;
    }
    const newId = checked.value.id;
    if (draft.isNew && protocols.some((p) => p.id === newId)) {
      setProblems([t({ message: `A protocol with the id "${newId}" already exists. Give this one another name.`, context: "admin protocols editor" })]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/protocols/${encodeURIComponent(newId)}`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify(checked.value),
      });
      const d = await res.json();
      if (!res.ok) {
        setProblems(d.problems ?? [refusal(d, t({ message: `That did not save.`, context: "admin protocols editor" }))]);
      } else {
        setProtocols(d.protocols ?? []);
        setDraft(null);
        setProblems([]);
        const version = Number(d.version);
        toast.success(d.changed ? t({ message: `Saved as version ${version}.`, context: "admin protocols editor" }) : t({ message: `Nothing had changed.`, context: "admin protocols editor" }));
      }
    } catch {
      toast.error(t({ message: `That did not save. Check the connection and try again.`, context: "admin protocols editor" }));
    }
    setBusy(false);
  };

  const setStatus = async (p: ProtocolView, status: "active" | "archived") => {
    const res = await fetch(`${API_BASE}/admin/protocols/${encodeURIComponent(p.id)}/status`, {
      method: "POST",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify({ status }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setProtocols(d.protocols ?? []);
    else toast.error(refusal(d, t({ message: `That did not change.`, context: "admin protocols editor" })));
  };

  const showCard = config.config?.showInstallCard !== false;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          <Trans context="admin protocols editor">Checklists</Trans>
        </h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">
            <Trans context="admin protocols editor">Loading.</Trans>
          </p>
        ) : protocols.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            <Trans context="admin protocols editor">None yet. Write one, or import a file.</Trans>
          </p>
        ) : (
          <ul className="space-y-2">
            {protocols.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">
                    {p.title}{" "}
                    {p.status === "archived" && (
                      <span className="text-sm font-normal text-muted-foreground">
                        <Trans context="admin protocols editor">(archived)</Trans>
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    <Plural context="admin protocols editor" value={p.steps.length} one="# step" other="# steps" />, <Trans context="admin protocols editor">version {p.version}</Trans>
                  </span>
                </span>
                <span className="flex gap-2">
                  <button type="button" className={btnCls} onClick={() => setDraft({ ...p, steps: p.steps.map((s) => ({ ...s })), isNew: false })}>
                    <Trans context="admin protocols editor">Edit</Trans>
                  </button>
                  <button type="button" className={btnCls} onClick={() => void setStatus(p, p.status === "archived" ? "active" : "archived")}>
                    {p.status === "archived" ? <Trans context="admin protocols editor">Restore</Trans> : <Trans context="admin protocols editor">Archive</Trans>}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {!draft && (
          <button type="button" className={btnCls} onClick={() => setDraft({ id: "", title: "", summary: "", image: "", steps: [blankStep()], isNew: true })}>
            <Trans context="admin protocols editor">New protocol</Trans>
          </button>
        )}
      </section>

      {draft && (
        <DraftForm
          draft={draft}
          roles={roles}
          problems={problems}
          busy={busy}
          onChange={setDraft}
          onSave={() => void save()}
          onCancel={() => {
            setDraft(null);
            setProblems([]);
          }}
        />
      )}

      <ImportBox password={password} onSaved={(list) => setProtocols(list)} />

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">
          <Trans context="admin protocols editor">Add to your phone</Trans>
        </h3>
        <label className="flex min-h-[44px] items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={showCard}
            disabled={config.loading}
            onChange={async (e) => {
              // useModuleConfig says so itself when the save is refused.
              await config.save({ showInstallCard: e.target.checked });
            }}
          />
          <Trans context="admin protocols editor">Suggest adding the protocols to a phone's home screen, on the protocols page</Trans>
        </label>
        <p className="text-sm text-muted-foreground">
          <Trans context="admin protocols editor">Once a month at most, and never again after three "not now" answers. A small link stays on the page either way.</Trans>
        </p>
      </section>
    </div>
  );
}

function DraftForm(props: {
  draft: Draft;
  roles: Role[];
  problems: string[];
  busy: boolean;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { draft, roles, problems, busy, onChange, onSave, onCancel } = props;
  const { t } = useLingui();
  const setStep = (i: number, patch: Partial<ProtocolStep>) =>
    onChange({ ...draft, steps: draft.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[i], steps[j]] = [steps[j]!, steps[i]!];
    onChange({ ...draft, steps });
  };
  const title = draft.title;
  return (
    <section className="space-y-4 rounded-xl border border-border p-4" aria-label={draft.isNew ? t({ message: `New protocol`, context: "admin protocols editor" }) : t({ message: `Edit ${title}`, context: "admin protocols editor" })}>
      <label className="block space-y-1 text-sm text-foreground">
        <span className="font-medium">
          <Trans context="admin protocols editor">Name</Trans>
        </span>
        <input className={inputCls} value={draft.title} maxLength={120} onChange={(e) => onChange({ ...draft, title: e.target.value })} />
      </label>
      <label className="block space-y-1 text-sm text-foreground">
        <span className="font-medium">
          <Trans context="admin protocols editor">What it is for</Trans>
        </span>
        <textarea className={inputCls} rows={2} maxLength={600} value={draft.summary} onChange={(e) => onChange({ ...draft, summary: e.target.value })} />
      </label>
      <label className="block space-y-1 text-sm text-foreground">
        <span className="font-medium">
          <Trans context="admin protocols editor">Photo at the top of a run (optional)</Trans>
        </span>
        <input
          className={inputCls}
          value={draft.image}
          maxLength={500}
          placeholder="/api/uploads/..." // i18n-ok: an address shape, not words
          onChange={(e) => onChange({ ...draft, image: e.target.value })}
        />
        <span className="block text-xs text-muted-foreground">
          <Trans context="admin protocols editor">A path on this site, such as an image you uploaded, or an https address.</Trans>
        </span>
      </label>
      <ol className="space-y-3">
        {draft.steps.map((s, i) => {
          const n = i + 1;
          return (
            <li key={i} className="space-y-2 rounded-lg border border-border p-3">
              <label className="block space-y-1 text-sm text-foreground">
                <span className="font-medium">
                  <Trans context="admin protocols editor">Step {n}</Trans>
                </span>
                <input className={inputCls} value={s.text} maxLength={280} onChange={(e) => setStep(i, { text: e.target.value })} />
              </label>
              <label className="block space-y-1 text-sm text-foreground">
                <span>
                  <Trans context="admin protocols editor">Detail (optional)</Trans>
                </span>
                <textarea className={inputCls} rows={2} maxLength={600} value={s.detail} onChange={(e) => setStep(i, { detail: e.target.value })} />
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm text-foreground">
                <label className="flex min-h-[44px] items-center gap-2">
                  <input type="checkbox" checked={s.required} onChange={(e) => setStep(i, { required: e.target.checked })} />
                  <Trans context="admin protocols editor">Required</Trans>
                </label>
                <label className="flex items-center gap-2">
                  <Trans context="admin protocols editor">Who may tick it</Trans>
                  <select
                    className={`${inputCls} w-auto`}
                    value={s.who.kind === "role" ? s.who.roleId : ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const who: StepWho = id ? { kind: "role", roleId: id, roleTitle: roles.find((r) => r.id === id)?.title ?? "" } : { kind: "member" };
                      setStep(i, { who });
                    }}
                  >
                    <option value="">{t({ message: `Any member`, context: "admin protocols editor" })}</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="flex gap-2">
                  <button type="button" className={btnCls} aria-label={t({ message: `Move step ${n} up`, context: "admin protocols editor" })} disabled={i === 0} onClick={() => move(i, -1)}>
                    <Trans context="admin protocols editor">Up</Trans>
                  </button>
                  <button type="button" className={btnCls} aria-label={t({ message: `Move step ${n} down`, context: "admin protocols editor" })} disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)}>
                    <Trans context="admin protocols editor">Down</Trans>
                  </button>
                  <button
                    type="button"
                    className={btnCls}
                    aria-label={t({ message: `Remove step ${n}`, context: "admin protocols editor" })}
                    onClick={() => onChange({ ...draft, steps: draft.steps.filter((_, k) => k !== i) })}
                  >
                    <Trans context="admin protocols editor">Remove</Trans>
                  </button>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className={btnCls} onClick={() => onChange({ ...draft, steps: [...draft.steps, blankStep()] })}>
        <Trans context="admin protocols editor">Add a step</Trans>
      </button>
      {problems.length > 0 && (
        <ul className={problemCls} role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button type="button" className={saveCls} disabled={busy} onClick={onSave}>
          {draft.isNew ? <Trans context="admin protocols editor">Save protocol</Trans> : <Trans context="admin protocols editor">Save as a new version</Trans>}
        </button>
        <button type="button" className={btnCls} onClick={onCancel}>
          <Trans context="admin protocols editor">Cancel</Trans>
        </button>
      </div>
    </section>
  );
}

interface ImportPreview {
  plan: Array<{ id: string; title: string; steps: number; action: string }>;
  problems: string[];
}

function ImportBox({ password, onSaved }: { password: string; onSaved: (list: ProtocolView[]) => void }) {
  const { t } = useLingui();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/protocols/import`, {
        method: "POST",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ file: text, dryRun }),
      });
      const d = await res.json();
      if (d.saved) {
        onSaved(d.protocols ?? []);
        setPreview(null);
        setText("");
        const count = Number(d.results?.length ?? 0);
        toast.success(t({ message: `Imported ${count} protocols.`, context: "admin protocols editor" }));
      } else {
        setPreview({ plan: d.plan ?? [], problems: d.problems ?? (res.ok ? [] : [refusal(d, t({ message: `That file did not read.`, context: "admin protocols editor" }))]) });
      }
    } catch {
      toast.error(t({ message: `The import did not reach the server.`, context: "admin protocols editor" }));
    }
    setBusy(false);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold text-foreground">
        <Trans context="admin protocols editor">Import a file</Trans>
      </h3>
      <p className="text-sm text-muted-foreground">
        <Trans context="admin protocols editor">
          A JSON file of protocols (format village-protocols/1). A step's "who" names a role on the org chart, or "anyone". Importing a protocol that
          already exists saves a new version of it.
        </Trans>
      </p>
      <input
        type="file"
        accept="application/json,.json"
        aria-label={t({ message: `Choose a protocols file`, context: "admin protocols editor" })}
        className="text-sm text-foreground"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setText(await f.text());
          setPreview(null);
        }}
      />
      <textarea
        className={inputCls}
        rows={4}
        aria-label={t({ message: `Or paste the file here`, context: "admin protocols editor" })}
        placeholder={t({ message: `Or paste the file here`, context: "admin protocols editor" })}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
      />
      <div className="flex gap-2">
        <button type="button" className={btnCls} disabled={busy || !text.trim()} onClick={() => void send(true)}>
          <Trans context="admin protocols editor">Check the file</Trans>
        </button>
        <button type="button" className={saveCls} disabled={busy || !preview || preview.problems.length > 0 || preview.plan.length === 0} onClick={() => void send(false)}>
          <Trans context="admin protocols editor">Import</Trans>
        </button>
      </div>
      {preview && (
        <div className="space-y-2 text-sm">
          {preview.plan.length > 0 && (
            <ul className="space-y-1 text-foreground">
              {preview.plan.map((p) => (
                <li key={p.id}>
                  {p.action === "create" ? <Trans context="admin protocols editor">Create {p.title}</Trans> : <Trans context="admin protocols editor">Update {p.title}</Trans>} (<Plural context="admin protocols editor" value={p.steps} one="# step" other="# steps" />)
                </li>
              ))}
            </ul>
          )}
          {preview.problems.length > 0 && (
            <ul className={problemCls} role="alert">
              {preview.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
