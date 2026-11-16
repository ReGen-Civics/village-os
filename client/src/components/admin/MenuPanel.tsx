/**
 * Admin → Make This Yours → Menu (gap G5).
 *
 * The village's own word for each menu entry, which entries it shows, its
 * group names, and its four phone tabs before More (shared/menuDoc.ts). Saved
 * as the content section `app-menu`. An entry keeps its route and its gates,
 * so renaming one never changes where it goes, and hiding one only takes it
 * out of the menu: its page stays where it was.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { NAV, ACCOUNT_MENU, isGroup } from "@/config/nav";
import { TAB_SLOTS } from "@/config/mobileNav";
import { MENU_LABEL_MAX, MENU_SECTION, MENU_TABS, menuDocOf, type MenuDoc } from "@shared/menuDoc";
import { API_BASE, authHeaders, refusal } from "./adminApi";

const GROUPS = NAV.filter(isGroup);
const ENTRIES = Array.from(
  new Map([...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].map((l) => [l.href, l] as const)).values(),
);

export default function MenuPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [doc, setDoc] = useState<MenuDoc | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/content/${MENU_SECTION}`, { cache: "no-cache" }).catch(() => null);
    setDoc(menuDocOf(res?.ok ? await res.json().catch(() => null) : null));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!doc) return null;
  const setLabel = (href: string, v: string) => {
    const labels = { ...doc.labels };
    if (v) labels[href] = v.slice(0, MENU_LABEL_MAX);
    else delete labels[href];
    setDoc({ ...doc, labels });
  };
  const setGroup = (name: string, v: string) => {
    const groups = { ...doc.groups };
    if (v) groups[name] = v.slice(0, MENU_LABEL_MAX);
    else delete groups[name];
    setDoc({ ...doc, groups });
  };
  const toggleHidden = (href: string, hide: boolean) =>
    setDoc({ ...doc, hidden: hide ? [...doc.hidden, href] : doc.hidden.filter((h) => h !== href) });
  const setTab = (i: number, href: string) => {
    const tabs = Array.from({ length: MENU_TABS }, (_, n) => doc.tabs[n] ?? TAB_SLOTS[n]?.path ?? "/");
    tabs[i] = href;
    setDoc({ ...doc, tabs });
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`${API_BASE}/admin/content/${MENU_SECTION}`, {
      method: "PUT",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify(doc),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error(refusal(await res?.json().catch(() => null), t`The menu did not save.`));
    toast.success(t`The menu is saved. Members see it on their next page.`);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 mt-6">
      <h3 className="font-semibold text-foreground mb-1">
        <Trans context="admin: the village menu editor heading">Menu</Trans>
      </h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-prose">
        <Trans>
          Your own word for each menu entry, which ones show, the names of the groups, and the phone's four tabs. An
          entry keeps its page and who may open it: renaming never moves it, and hiding only takes it out of the menu.
          Blank keeps the platform's word.
        </Trans>
      </p>

      <p className="text-sm font-medium text-foreground mb-1">
        <Trans context="admin menu: the group names">Groups</Trans>
      </p>
      <div className="grid gap-2 sm:grid-cols-3 mb-4">
        {GROUPS.map((g) => (
          <input
            key={g.label}
            value={doc.groups[g.label] ?? ""}
            onChange={(e) => setGroup(g.label, e.target.value)}
            placeholder={g.label}
            aria-label={t`The name for the ${g.label} group`}
            className="text-sm border border-border rounded-lg px-2.5 py-2"
          />
        ))}
      </div>

      <p className="text-sm font-medium text-foreground mb-1">
        <Trans context="admin menu: the phone tabs">Phone tabs</Trans>
      </p>
      <div className="grid gap-2 sm:grid-cols-4 mb-4">
        {Array.from({ length: MENU_TABS }, (_, i) => (
          <select
            key={i}
            value={doc.tabs[i] ?? TAB_SLOTS[i]?.path ?? "/"}
            onChange={(e) => setTab(i, e.target.value)}
            aria-label={t({ message: `Phone tab ${i + 1}`, context: "admin menu: one of the four phone tabs" })}
            className="text-sm border border-border rounded-lg px-2 py-2 bg-card"
          >
            {TAB_SLOTS.filter((s) => s.path && !ENTRIES.some((e) => e.href === s.path)).map((s) => (
              <option key={s.path} value={s.path}>{s.label}</option>
            ))}
            {ENTRIES.map((e) => (
              <option key={e.href} value={e.href}>{doc.labels[e.href] || e.label}</option>
            ))}
          </select>
        ))}
      </div>

      <p className="text-sm font-medium text-foreground mb-1">
        <Trans context="admin menu: the menu entries">Entries</Trans>
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 list-none p-0 m-0 mb-4">
        {ENTRIES.map((e) => (
          <li key={e.href} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!doc.hidden.includes(e.href)}
              onChange={(ev) => toggleHidden(e.href, !ev.target.checked)}
              aria-label={t`Show ${e.label} in the menu`}
            />
            <input
              value={doc.labels[e.href] ?? ""}
              onChange={(ev) => setLabel(e.href, ev.target.value)}
              placeholder={e.label}
              aria-label={t({ message: `Your word for ${e.label}`, context: "admin menu: a menu entry label field" })}
              className="flex-1 min-w-0 text-sm border border-border rounded-lg px-2.5 py-1.5"
            />
            <span className="text-xs text-muted-foreground font-mono shrink-0">{e.href}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="min-h-[44px] px-4 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40"
      >
        {saving ? <Trans context="admin menu: while it saves">Saving…</Trans> : <Trans context="admin menu: the save button">Save the menu</Trans>}
      </button>
    </div>
  );
}
