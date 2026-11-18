/**
 * The doors for a task handed to a role (server/routes/roleTaskHandoffs.ts),
 * one function each. Every save waits for the server's answer.
 */
import { gameFetch } from "@/lib/gameApi";
import {
  HANDOFFS_SENT_URL, HANDOFFS_URL, HANDOFFS_WAITING_URL, handoffRespondUrl, handoffWithdrawUrl,
  readSentHandoffs, readWaitingHandoffs, type HandoffAction, type SentHandoff, type WaitingHandoff,
} from "@shared/roleTaskHandoff";

export type HandoffResult = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string | null };

/** The server's own sentence when it sent one; null for a code word, so the caller says it plainly. */
const said = (body: unknown): string | null => {
  const e = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
  return typeof e === "string" && /\s/.test(e.trim()) ? e.trim() : null;
};

async function post(path: string, body: unknown): Promise<HandoffResult> {
  try {
    const res = await gameFetch(path, { method: "POST", body: JSON.stringify(body ?? {}) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, body: data ?? {} } : { ok: false, status: res.status, error: said(data) };
  } catch {
    return { ok: false, status: 0, error: null };
  }
}

export interface HandoffDraft {
  roleId: string;
  title: string;
  note: string;
  dueOn: string;
}

export const sendHandoff = (d: HandoffDraft) =>
  post(HANDOFFS_URL, { roleId: d.roleId, title: d.title, note: d.note || null, dueOn: d.dueOn || null });

export const respondHandoff = (id: string, action: HandoffAction, extra: Record<string, unknown> = {}) =>
  post(handoffRespondUrl(id), { action, ...extra });

export const withdrawHandoff = (id: string) => post(handoffWithdrawUrl(id), {});

/** What you sent, or null when it could not be read. */
export async function readSent(): Promise<SentHandoff[] | null> {
  try {
    const res = await gameFetch(HANDOFFS_SENT_URL, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) return [];
    return res.ok ? readSentHandoffs(await res.json().catch(() => null)) : null;
  } catch {
    return null;
  }
}

/** What waits on you, or null when it could not be read. A closed door reads as nothing waiting. */
export async function readWaitingHandoffsNow(): Promise<WaitingHandoff[] | null> {
  try {
    const res = await gameFetch(HANDOFFS_WAITING_URL, { cache: "no-store" });
    if (res.status === 401 || res.status === 403 || res.status === 404) return [];
    return res.ok ? readWaitingHandoffs(await res.json().catch(() => null)) : null;
  } catch {
    return null;
  }
}
