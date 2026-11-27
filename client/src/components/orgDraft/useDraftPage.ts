/**
 * THE DRAFT PAGE'S READS AND ACTS (the draft page, PR B). Data only: the views in this folder draw it, so a later
 * visual layer restyles them without touching what is read or who may act.
 *
 * Two reads: the draft itself (`GET /api/org/drafts/:id/view`, before and after per field, cut to the reader) and how
 * it is decided (`GET /api/org/drafts/:id/decide`, who may publish, vote or withdraw). The acts are the doors the
 * review row already uses, plus the edit (`POST .../revise`). Every publish sends back the change ids this page drew
 * (`expectedChanges`), so a draft that changed since is refused, never published unread.
 */
import { useCallback, useEffect, useState } from "react";
import { authToken } from "@/lib/gameApi";
import type { DraftView } from "@shared/orgDraftView";

export interface DecideAnswer {
  status: string;
  changes: number;
  blocked: number;
  holderCount: number;
  ballotNeeded: boolean;
  youMayPublish: boolean;
  adminMayPublish: boolean;
  youMayPutToVillage: boolean;
  youMayWithdraw?: boolean;
  governanceOn: boolean;
  ballot: { id: string; closesAt: string | null } | null;
}

export type DraftLoad = { phase: "loading" } | { phase: "signedOut" } | { phase: "missing" } | { phase: "failed" } | { phase: "ready"; view: DraftView; decide: DecideAnswer | null };

/** Whether a body has the shape the page draws. Any other shape is a failed read, never an empty draft. */
export function isDraftView(b: unknown): b is DraftView {
  const v = b as DraftView | null;
  return !!v && typeof v.id === "string" && Array.isArray(v.changes) && Array.isArray(v.changeIds) && Array.isArray(v.revisions) && Array.isArray(v.otherOpenDrafts);
}

function headers(): Record<string, string> {
  const t = authToken();
  return { "content-type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export interface Said {
  ok: boolean;
  text: string;
}

export function useDraftPage(draftId: string) {
  const [load, setLoad] = useState<DraftLoad>({ phase: "loading" });
  const enc = encodeURIComponent(draftId);

  const read = useCallback(async () => {
    if (!authToken()) return setLoad({ phase: "signedOut" });
    try {
      const [v, d] = await Promise.all([fetch(`/api/org/drafts/${enc}/view`, { headers: headers() }), fetch(`/api/org/drafts/${enc}/decide`, { headers: headers() }).catch(() => null)]);
      if (v.status === 401) return setLoad({ phase: "signedOut" });
      if (v.status === 404) return setLoad({ phase: "missing" });
      const body: unknown = v.ok ? await v.json() : null;
      if (!isDraftView(body)) return setLoad({ phase: "failed" });
      const decide = d && d.ok ? ((await d.json()) as DecideAnswer) : null;
      setLoad({ phase: "ready", view: body, decide });
    } catch {
      setLoad({ phase: "failed" });
    }
  }, [enc]);

  useEffect(() => {
    void read();
  }, [read]);

  /** One POST; reads the draft again after, so the page always shows what is true now. */
  const post = useCallback(
    async (path: string, body: unknown): Promise<{ ok: boolean; message: string | null }> => {
      try {
        const r = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
        const out = (await r.json().catch(() => null)) as { message?: string; error?: string } | null;
        await read();
        return { ok: r.ok, message: out?.message ?? out?.error ?? null };
      } catch {
        return { ok: false, message: null };
      }
    },
    [read],
  );

  const acts = {
    publish: (byPower: boolean, changeIds: string[]) => post(byPower ? `/api/org/drafts/${enc}/publish-by-power` : `/api/admin/org/drafts/${enc}/publish`, { expectedChanges: changeIds }),
    putToVillage: () => post(`/api/org/drafts/${enc}/put-to-village`, {}),
    withdraw: () => post(`/api/admin/org/drafts/${enc}/withdraw`, {}),
    revise: (changeId: string, words: Record<string, string | string[] | null>, note: string) => post(`/api/org/drafts/${enc}/revise`, { changeId, words, note }),
    leaveOut: (changeId: string, note: string) => post(`/api/org/drafts/${enc}/revise`, { changeId, leaveOut: true, note }),
  };
  return { load, read, acts };
}
