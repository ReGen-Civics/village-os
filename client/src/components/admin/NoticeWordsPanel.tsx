/**
 * Admin → Make This Yours → Notices (gap G6).
 *
 * The village's own title and description for any notice kind
 * (shared/noticeWords.ts). `{default}` keeps the platform's title, with the
 * person or the thing it names; `{village}` and the village's nouns fill in
 * too. Saved as the content section `app-notices`. A kind left blank reads as
 * before.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { NOTIFICATION_GROUPS, NOTIFICATION_KINDS } from "@shared/notificationKinds";
import { kindWordsOf } from "@shared/notificationKindWords";
import { NOTICE_BLURB_MAX, NOTICE_SECTION, NOTICE_TITLE_MAX, type NoticeWords } from "@shared/noticeWords";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import SaveBar, { type SaveResult } from "@/components/SaveBar";
import { useDraftDoc } from "@/lib/unsavedChanges";

export default function NoticeWordsPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [loaded, setLoaded] = useState<NoticeWords | null>(null);
  const doc = useDraftDoc<NoticeWords>(loaded);
  const draft = doc.draft;
  const setDraft = doc.setDraft;
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/content/${NOTICE_SECTION}`, { cache: "no-cache" }).catch(() => null);
    const d = res?.ok ? await res.json().catch(() => null) : null;
    setLoaded(d && typeof d === "object" ? (d as NoticeWords) : {});
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const kinds = useMemo(
    () => Object.entries(NOTIFICATION_KINDS).filter(([k]) => !filter || `${k} ${kindWordsOf(k).blurb}`.toLowerCase().includes(filter.toLowerCase())),
    [filter],
  );
  if (!draft) return null;
  const set = (kind: string, part: "title" | "blurb", v: string) => {
    const next = { ...draft, [kind]: { ...(draft[kind] ?? {}), [part]: v } };
    if (!next[kind].title && !next[kind].blurb) delete next[kind];
    setDraft(next);
  };
  const groupTitle = (id: string) => NOTIFICATION_GROUPS.find((g) => g.id === id)?.title ?? id;

  const save = async (): Promise<SaveResult> => {
    const res = await fetch(`${API_BASE}/admin/content/${NOTICE_SECTION}`, {
      method: "PUT",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify(draft),
    }).catch(() => null);
    if (!res?.ok) return { ok: false, reason: refusal(await res?.json().catch(() => null), t`The notice words did not save.`) };
    doc.accept(draft);
    return { ok: true };
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 mt-6">
      <h3 className="font-semibold text-foreground mb-1">
        <Trans context="admin: the notice words editor heading">Notices</Trans>
      </h3>
      <p className="text-xs text-muted-foreground mb-3 max-w-prose">
        <Trans>
          Your own title and description for any notice a member gets. Write {"{default}"} to keep the platform's title,
          with the person or the thing it names. {"{village}"} and your words for things fill in too. Blank keeps the
          platform's words.
        </Trans>
      </p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t({ message: "Find a notice", context: "admin notices: the search box" })}
        aria-label={t({ message: "Find a notice", context: "admin notices: the search box" })}
        className="w-full sm:w-72 text-sm border border-border rounded-lg px-2.5 py-2 mb-3"
      />
      <ul className="grid gap-3 list-none p-0 m-0 max-h-[32rem] overflow-y-auto">
        {kinds.map(([kind, def]) => (
          <li key={kind} className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground m-0 mb-1">
              {groupTitle(def.group)} · <span className="font-mono">{kind}</span>
            </p>
            <p className="text-xs text-muted-foreground m-0 mb-2">{kindWordsOf(kind).blurb}</p>
            <input
              value={draft[kind]?.title ?? ""}
              onChange={(e) => set(kind, "title", e.target.value.slice(0, NOTICE_TITLE_MAX))}
              placeholder={t({ message: "Title", context: "admin notices: a notice title field" })}
              aria-label={t({ message: `Title for ${kind}`, context: "admin notices: a notice title field" })}
              className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 mb-1.5"
            />
            <textarea
              value={draft[kind]?.blurb ?? ""}
              onChange={(e) => set(kind, "blurb", e.target.value.slice(0, NOTICE_BLURB_MAX))}
              rows={2}
              placeholder={t({ message: "Description", context: "admin notices: a notice description field" })}
              aria-label={t({ message: `Description for ${kind}`, context: "admin notices: a notice description field" })}
              className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5"
            />
          </li>
        ))}
      </ul>
      <SaveBar count={doc.count} onSave={save} onDiscard={doc.discard} what={t({ message: "the notice words", context: "admin notices: what the save bar saves" })} />
    </div>
  );
}
