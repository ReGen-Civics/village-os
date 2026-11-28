/**
 * CONFIRMING ONE OF SERA'S PAY SUGGESTIONS (Rye, 27 Nov 2026: "Sera, can also
 * make suggestions for pay and new roles, but with our confirmation.").
 *
 * NOTHING IN SERA'S LIST WRITES PAY. A pay row opens the role's own pay setter
 * (RolePayWithEngine) under the row, and the person sets pay there, through
 * PUT /api/org/roles/:id/pay, behind that route's own gate and its own rules:
 * the band, the reason, and the second signer when a figure needs somebody
 * other than the proposer. The setter is opened where the row is because the
 * org chart's copy of it sits in Admin, which a pay holder without admin
 * access cannot open: a link there would be a dead end for them.
 *
 * This file is what the row and the setter share:
 *
 *   - what Sera lists for the role, taken from the row itself (her sentence
 *     and her figure), so nothing is read a second time and a reader sees no
 *     more than the row already showed them;
 *   - the effort estimate stored with the role's last pay setting, offered for
 *     reuse and shown before anything is sent;
 *   - whether this reader may set pay at all: the standing the pay settings
 *     read already answers (`holderStanding` for `role.pay`, null whenever the
 *     pay route would refuse them). A row offers no control to a door that is
 *     shut;
 *   - the one way the setter talks to the server from here.
 */
import { authToken } from "@/lib/gameApi";
import type { ListedDifference } from "@/lib/seraReview";

/** How a reader reaches the pay power, as GET /api/valuation/model says it; null when they do not. */
export type PayStanding = "holder" | "admin-before-launch" | "admin-no-steward" | null;

/** What Sera lists for one role's pay, as her list words it. */
export interface SeraPay {
  agent: string;
  sentence: string;
  /** Her figure, US dollars a month for the whole role, or null when she lists none. */
  monthlyUsd: number | null;
}

/** The effort estimate stored with a role's last pay setting. */
export interface StoredEstimate {
  band: string;
  estimatedHours: number;
  estimateLow: number | null;
  estimateHigh: number | null;
  responsibility: string | null;
  setAt: string | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const positive = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** What Sera lists, from her pay row as the list sent it. */
export function seraPayFromRow(d: ListedDifference, agent: string): SeraPay {
  return { agent, sentence: d.words.sentence, monthlyUsd: positive(d.params?.monthlyUsd) };
}

/** The newest setting's estimate, from GET /api/org/roles/:id/pay/settings (newest first); null when none is usable. */
export function storedEstimateOf(body: unknown): StoredEstimate | null {
  if (!isObj(body) || !Array.isArray(body.settings)) return null;
  const latest = body.settings[0];
  if (!isObj(latest) || !isObj(latest.inputs) || !Array.isArray(latest.inputs.lines)) return null;
  const line = latest.inputs.lines[0];
  if (!isObj(line) || typeof line.band !== "string" || !line.band) return null;
  const hours = positive(line.estimatedHours);
  if (hours === null) return null;
  const resp = latest.inputs.responsibility;
  return {
    band: line.band,
    estimatedHours: hours,
    estimateLow: positive(line.estimateLow),
    estimateHigh: positive(line.estimateHigh),
    responsibility: typeof resp === "string" && resp ? resp : null,
    setAt: typeof latest.createdAt === "string" ? latest.createdAt : null,
  };
}

/** The server's own reason for a refusal, or the words given. */
function refusalWords(body: unknown, fallback: string): string {
  if (isObj(body)) {
    for (const value of [body.message, body.error]) {
      const text = value == null ? "" : String(value).trim();
      if (text) return text;
    }
  }
  return fallback;
}

/**
 * The pay setter's one way to the server from Sera's list, in the shape the
 * setter is handed everywhere (`call(path, body, method)`), as the person.
 * A refused WRITE says the server's reason through `say`; a refused READ is
 * quiet, because "nothing to show" is not something that failed to save.
 */
export async function payCall(path: string, body?: unknown, method = "POST", say?: (words: string) => void): Promise<any> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${authToken()}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const answer = await res.json().catch(() => ({}));
    if (res.ok) return answer;
    if (method !== "GET") say?.(refusalWords(answer, "That did not save. Nothing was changed."));
    return null;
  } catch {
    if (method !== "GET") say?.("That did not save. Nothing was changed.");
    return null;
  }
}

export async function readStoredEstimate(roleId: string): Promise<StoredEstimate | null> {
  return storedEstimateOf(await payCall(`/org/roles/${encodeURIComponent(roleId)}/pay/settings`, undefined, "GET"));
}

const STANDINGS: readonly string[] = ["holder", "admin-before-launch", "admin-no-steward"];

// One read however many pay rows ask, and never one person's answer for the next: it is kept beside the token it was
// asked with, and a different token asks again.
let asked: { token: string | null; answer: Promise<PayStanding> } | null = null;

/** This reader's standing on the pay power; null whenever the pay route would refuse them, or the read did not answer. */
export function readPayDoor(): Promise<PayStanding> {
  const token = authToken() ?? null;
  if (asked && asked.token === token) return asked.answer;
  const answer = payCall("/valuation/model", undefined, "GET").then((body) => {
    const door = isObj(body) ? body.payDoor : null;
    return typeof door === "string" && STANDINGS.includes(door) ? (door as PayStanding) : null;
  });
  asked = { token, answer };
  return answer;
}

/** Ask again next time: after a sign-in changes who is reading, and between tests. */
export function forgetPayDoor(): void {
  asked = null;
}
