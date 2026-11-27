/**
 * The feedback spine (S66): bugs and ideas from any village, captured
 * locally ALWAYS, relayed to the platform hub only while the village keeps
 * the relay on.
 *
 * The design honors two people at once. The village admin always has the
 * full local queue — turning the relay off changes nothing about their own
 * view, it only stops the copy flowing upstream. And the platform team,
 * when the relay is on, sees CONTENT and not people: the payload carries
 * the instance's identity (which village, which build) and the item's text,
 * never who submitted it. A member's name stays inside their village.
 *
 * Relay mechanics are queue-and-forget: items relay on a scheduler sweep,
 * `relayed_at` is set only on a 2xx, and any failure just leaves the rows
 * for the next sweep. A fork must never break — or even slow down — because
 * the hub is down; the hub is a listener, not a dependency.
 *
 * The fingerprint (sha256 prefix over kind + normalized text) lets the hub
 * collapse forty villages hitting one crash into one item with a count,
 * without needing any identity to do it.
 */
import { createHash, randomUUID } from "crypto";
import path from "node:path";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { guardedFetchJson } from "./toolcheck";
import { boolVar } from "./variables";
import type { FeedbackKind } from "../../shared/feedbackItems";

/**
 * Where this village's feedback relay sends, if anywhere.
 *
 * Empty means nowhere. See the relay job for why the platform's own hub is no
 * longer a default: the setting that turns the relay on ships ON, so a
 * hardcoded destination made every fork post its members' words to one
 * specific organisation without ever choosing to.
 */
export function feedbackHubUrl(): string {
  return String(process.env.FEEDBACK_HUB_URL ?? "").trim();
}

/**
 * Who receives the relayed copy, as the form names it: the host the relay sends to. Read from the
 * deployment's own `FEEDBACK_HUB_URL`, so the platform's name is never typed into this code and a
 * fork that points elsewhere names where it points. Null with no hub, or an address that does not parse.
 */
export function feedbackHubName(): string | null {
  const url = feedbackHubUrl();
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Whether feedback submitted right now would actually leave this village.
 *
 * Two things have to be true: the village left the dial on, and somebody told
 * this deployment where the hub is. Every sentence the product says about
 * sharing reads this, so the form, the receipt and the admin list can never
 * promise a journey that has no destination.
 */
export function feedbackIsShared(): boolean {
  return boolVar("platform.feedback_relay") && feedbackHubUrl().length > 0;
}

export interface FeedbackInput {
  kind: FeedbackKind;
  title: string;
  detail: string;
  pageUrl?: string | null;
  submittedBy?: string | null;
  /**
   * The stamped name of the screenshot in the private folder (routes/feedback.ts), or null. Stored
   * for the village's own queue only: `relayFeedback` never selects it, so a picture of a page,
   * which can show other members' names, never leaves the village.
   */
  screenshotFile?: string | null;
}

/**
 * THE SCREENSHOT'S FOLDER, beside the uploads volume and never inside it (the guide's panel,
 * 26 Nov 2026). `/api/uploads/:filename` answers anybody holding a name, and a picture of a page
 * can show a member's own dashboard or other people's names, so it lives where a form's
 * attachment lives (server/lib/submissionAttachments.ts): written through the strip, served to an
 * admin alone, `private, no-store`, and taken off when its sender is erased (server/lib/erasure.ts).
 */
export const FEEDBACK_SHOT_DIRNAME = "private-feedback-shots";
/** The prefix every stored screenshot carries, so the admin door reads only names the route minted. */
export const FEEDBACK_SHOT_PREFIX = "feedbackshot";

export function feedbackShotsDir(uploadsDir: string): string {
  return path.join(path.dirname(uploadsDir), FEEDBACK_SHOT_DIRNAME);
}

/** A stored name the route minted, basenamed, or null. Pure. */
export function feedbackShotName(raw: unknown): string | null {
  const name = path.basename(String(raw ?? "").trim());
  return /^feedbackshot-\d+-[a-z0-9]{1,8}\.(jpg|png|webp|avif|gif)$/.test(name) ? name : null;
}

export function feedbackFingerprint(kind: string, title: string, detail: string): string {
  const normalized = `${kind}\n${title}\n${detail}`.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 40);
}

/**
 * WHAT A MEMBER HEARS WHEN THEIR BUG OR IDEA IS TRIAGED.
 *
 * Pure, so the judgement is testable without a database. Null means say
 * nothing, which is what `new` means: it is where every item starts, and
 * moving one back to it is a founder correcting their own filing.
 *
 * `seen`, `planned`, `done` and `declined` are the queue's labels, and none
 * of the four words below is one of them. A member reported a broken thing;
 * they are owed a sentence in their own language about their own report,
 * never a status code from somebody's admin panel.
 *
 * `declined` is written plainly and kindly. A village that quietly drops
 * ideas teaches members to stop sending them, and a soft non-answer costs
 * more trust than a clear no.
 */
export function feedbackStatusNotice(
  status: string,
  kind: string,
): { headline: string; line: string } | null {
  const thing = kind === "idea" ? "idea" : kind === "feedback" ? "feedback" : "report";
  switch (status) {
    case "seen":
      return {
        headline: `Someone read your ${thing}`,
        line: `A steward has your ${thing} in hand. Nothing is promised yet, and it is no longer sitting unopened.`,
      };
    case "planned":
      return {
        headline: kind === "idea" ? "Your idea is on the list to build" : kind === "feedback" ? "Your feedback is on the list to act on" : "Your report is on the list to fix",
        line: "It has a place in the work now. There is no date on it yet.",
      };
    case "done":
      return {
        headline: kind === "idea" ? "Your idea has been built" : kind === "feedback" ? "The team acted on your feedback" : "What you reported has been fixed",
        line: "Have a look, and send it back in if it is still wrong.",
      };
    case "declined":
      return {
        headline: `We are leaving your ${thing} where it is`,
        line: "A steward read it and decided against taking it forward for now. Thank you for sending it, and please keep sending them.",
      };
    default:
      return null;
  }
}

/**
 * The page a piece of feedback came from, as it is stored and relayed (R051).
 * The client sends `document.referrer`, and a referrer can be the set-password
 * page with its token in the query string, so the record keeps the origin and
 * path and drops the query and the fragment.
 */
export function pageUrlForRecord(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const cut = text.split(/[?#]/)[0];
  return cut ? cut.slice(0, 500) : null;
}

export async function recordFeedback(
  pool: Pool,
  input: FeedbackInput,
  /** The relay state AT CAPTURE — the promise the form made to this person. */
  mayRelay: boolean,
): Promise<{ id: string }> {
  const id = `fb-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await pool.query(
    "INSERT INTO feedback_items (id, kind, title, detail, page_url, submitted_by, fingerprint, may_relay, screenshot_file) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      id,
      input.kind,
      input.title.slice(0, 200),
      input.detail.slice(0, 8000),
      pageUrlForRecord(input.pageUrl),
      input.submittedBy ?? null,
      feedbackFingerprint(input.kind, input.title, input.detail),
      mayRelay ? 1 : 0,
      input.screenshotFile ?? null,
    ],
  );
  return { id };
}

export interface RelayIdentity {
  instanceId: string;
  version: string;
  build: string;
  /** The village's public name — brand overlay, so the hub can say who. */
  name: string;
}

/**
 * One sweep: send every unrelayed item, oldest first, in one batch. Returns
 * how many were acknowledged. Throws nothing outward — a relay problem is a
 * log line and a retry, never a village's problem.
 */
export async function relayFeedback(
  pool: Pool,
  hubUrl: string,
  identity: RelayIdentity,
): Promise<{ sent: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    // screenshot_file is NOT selected, on purpose: the hub gets the words, never the picture.
    // may_relay = 1 is the consent recorded when the item was CAPTURED.
    // Anything submitted while the relay was off stays home forever, even
    // if the relay is switched on later — the form promised that, and a
    // setting changing afterwards does not un-promise it.
    "SELECT id, kind, title, detail, page_url, fingerprint, created_at FROM feedback_items " +
      "WHERE relayed_at IS NULL AND may_relay = 1 ORDER BY created_at ASC LIMIT 50",
  );
  if (rows.length === 0) return { sent: 0 };

  const payload = {
    instance: identity,
    items: rows.map((r) => ({
      // The village-local id lets a future hub answer "this one is fixed in
      // build X" back to the right row. No member field exists to leak.
      localId: String(r.id),
      kind: String(r.kind),
      title: String(r.title),
      detail: String(r.detail),
      pageUrl: pageUrlForRecord(r.page_url), // rows stored before R051 carry their query string
      fingerprint: String(r.fingerprint),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    })),
  };

  try {
    // Through the PINNED dialer, not bare fetch. FEEDBACK_HUB_URL is read
    // straight from the environment with no scheme or range validation, and
    // this payload carries up to 8000 characters of member-written detail
    // per item — the one outbound call in the tree that both trusts an
    // operator-set address and ships village content to it. guardedFetchJson
    // is https-only, refuses private/loopback/CGNAT ranges, and re-guards
    // every redirect hop against the address actually dialled.
    await guardedFetchJson(hubUrl, 10_000, { method: "POST", body: payload });
    await pool.query(
      `UPDATE feedback_items SET relayed_at = NOW() WHERE id IN (${rows.map(() => "?").join(",")})`,
      rows.map((r) => r.id),
    );
    return { sent: rows.length };
  } catch (e: any) {
    // Unreachable hub is EXPECTED sometimes, and so is a refused URL. Either
    // way: quiet log, rows stay queued, natural retry. The hub is a listener,
    // never a dependency — nothing here may escape into the caller.
    console.error(`[feedback] relay skipped: ${String(e?.message ?? e).slice(0, 120)}; ${rows.length} item(s) stay queued`);
    return { sent: 0 };
  }
}
