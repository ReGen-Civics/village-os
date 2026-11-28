/**
 * The Admin helper's calls (server/routes/adminHelper.ts).
 *
 * Status and ask go to the helper's own routes. Apply goes to the dial's OWN
 * route, `PUT /api/admin/variables/:key`, exactly as the Game Mechanics tab
 * calls it, so a change the guide proposed meets every guard a change typed
 * by hand meets. Nothing here knows or carries the Anthropic key: the browser
 * only ever learns whether the helper is on.
 *
 * The guide's dock (dock/GuideDock.tsx) adds two: sending a change the guide
 * drafted to the review page, by the ticket the server signed and nothing
 * else, and asking the launch and organizing guides, on the two routes and
 * with the payload the launch guide's own panel always used.
 */
import type { HelperAnswer, HelperFiled, HelperProposal, HelperProvider, HelperStatus, HelperTab } from "@shared/adminHelper";
import type { NavGroup } from "./adminNavGroups";
import { whatIsThis } from "./adminWords";
import { API_BASE, authHeaders, refusal } from "./adminApi";

export interface HelperLine {
  role: "user" | "assistant";
  content: string;
}

export async function fetchHelperStatus(password: string, signal?: AbortSignal): Promise<HelperStatus> {
  const r = await fetch(`${API_BASE}/admin/helper`, { headers: authHeaders(password), signal });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(refusal(d, "The helper could not be reached."));
  const off = d?.off === "switch" || d?.off === "key" ? d.off : null;
  const isProvider = (v: unknown): v is HelperProvider => v === "anthropic" || v === "sera";
  const provider: HelperProvider | null = isProvider(d?.provider) ? d.provider : null;
  const available: HelperProvider[] = Array.isArray(d?.available) ? (d.available as unknown[]).filter(isProvider) : provider ? [provider] : [];
  const names: Partial<Record<HelperProvider, string>> = {};
  for (const p of available) if (typeof d?.names?.[p] === "string") names[p] = d.names[p];
  return {
    on: d?.on === true,
    guide: typeof d?.guide === "string" ? d.guide : "",
    off: d?.on === true ? null : off ?? "key",
    provider,
    available,
    names,
    // Only a village that turned the guide's dock on sends these two.
    ...(d?.dock === true ? { dock: true, ...(d?.lent === true ? { lent: true } : {}) } : {}),
  };
}

/** The pages this admin can open, as the nav shows them, for the guide's map of Admin. */
export function tabsFromGroups(groups: readonly NavGroup[]): HelperTab[] {
  return groups.flatMap((g) => g.items.map((i) => ({ key: i.key, label: i.label, group: g.title, help: whatIsThis(i.key).help })));
}

export type AskOutcome = { ok: true; answer: HelperAnswer } | { ok: false; off: "switch" | "key" | null; error: string };

export async function askHelper(
  password: string,
  input: { messages: HelperLine[]; tabs: HelperTab[]; tab: string; provider?: HelperProvider | null },
): Promise<AskOutcome> {
  try {
    const r = await fetch(`${API_BASE}/admin/helper/ask`, {
      method: "POST",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 503 && d?.error === "helper-off") return { ok: false, off: d?.off === "switch" ? "switch" : "key", error: "" };
    if (!r.ok) return { ok: false, off: null, error: refusal(d, "The helper could not answer just now. Try again in a moment.") };
    return { ok: true, answer: d as HelperAnswer };
  } catch {
    return { ok: false, off: null, error: "The helper could not be reached. Check your connection and try again." };
  }
}

/** Apply one proposed change through the dial's own admin route. */
export async function applyProposal(password: string, p: HelperProposal): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${API_BASE}/admin/variables/${encodeURIComponent(p.key)}`, {
      method: "PUT",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify({ value: p.to }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: refusal(d, "That change was not saved.") };
    return { ok: true, message: typeof d?.message === "string" && d.message ? d.message : "" };
  } catch {
    return { ok: false, error: "That change was not saved. Check your connection and try again." };
  }
}

/** Send one change the guide drafted to the review page, by the server's own ticket. Nothing is applied. */
export async function fileForReview(password: string, ticket: string): Promise<{ ok: true; filed: HelperFiled } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${API_BASE}/admin/helper/file`, {
      method: "POST",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify({ ticket }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: refusal(d, "That change was not sent to review.") };
    const state = d?.state === "waiting" || d?.state === "held" ? d.state : "filed";
    return {
      ok: true,
      filed: {
        state,
        code: typeof d?.code === "string" ? d.code : null,
        words: typeof d?.words === "string" ? d.words : "",
        reviewAt: typeof d?.reviewAt === "string" && d.reviewAt.startsWith("/") ? d.reviewAt : "/admin/proposals",
      },
    };
  } catch {
    return { ok: false, error: "That change was not sent to review. Check your connection and try again." };
  }
}

/** What the launch and organizing guides say they read, as their routes send it. */
export interface GuideConsulted {
  brief?: string[];
  ownRecord?: string[];
  readers?: string[];
  references?: string[];
}

/** The two routes, each written whole: this file asks no other assistant route. */
const GUIDE_ROUTES = {
  launch: `${API_BASE}/admin/assistant/launch`,
  organize: `${API_BASE}/admin/assistant/organize`,
} as const;

export type GuideAskOutcome = { ok: true; reply: string; consulted?: GuideConsulted } | { ok: false; gone: boolean; error: string };

/**
 * The launch guide or the organizing guide: `POST /api/admin/assistant/launch`
 * or `/organize` with `{messages}`, exactly what the launch guide's own panel
 * sends (components/journey/LaunchGuide.tsx). A 503 means no key can answer.
 */
export async function askGuide(password: string, mode: "launch" | "organize", messages: HelperLine[]): Promise<GuideAskOutcome> {
  try {
    const r = await fetch(GUIDE_ROUTES[mode], {
      method: "POST",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify({ messages }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 503) return { ok: false, gone: true, error: "" };
    if (!r.ok) return { ok: false, gone: false, error: refusal(d, "") };
    return { ok: true, reply: typeof d?.reply === "string" ? d.reply : "", consulted: d?.consulted && typeof d.consulted === "object" ? (d.consulted as GuideConsulted) : undefined };
  } catch {
    return { ok: false, gone: false, error: "" };
  }
}
