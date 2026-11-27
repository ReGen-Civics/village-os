/**
 * THE INVESTOR GATE, SERVER SIDE (the lead, 27 Nov 2026; the contract is shared/investorInterest.ts,
 * the SQL server/repos/investorAccess.ts and migration 0440).
 *
 *   GET  /api/investor/access     whether this reader sees the whole investor page, what the village
 *                                 already holds about them for the form, and their newest request
 *   POST /api/investor/interest   { name, email, whatsapp?, link?, ...answers, consent, website? }
 *
 * And two things server/index.ts asks of it:
 *
 *   - `allowed(req)`: the investor summary, the packet request and the investor page's own words in
 *     the content store (`INVESTOR_SECTION`, and its translation) are refused to anybody it says no to.
 *   - `decided(row, status, actor)`: the submissions desk's status route tells it when an interest
 *     answer is accepted or moved on to declined, and access follows the decision.
 *
 * A VILLAGE TURNS IT ON. The dial `investors.gate` (shared/gameVariables.ts) is off by default, and
 * off, every reader is let in and the investor page is the public page it always was.
 *
 * WHO IS LET IN. An administrator always (the page has to be edited). Otherwise a row in
 * `investor_access` for the signed-in account, or for the visitor's address when the entrance proved
 * it (its code, or Google). An address somebody only typed is never let in: matching a typed address
 * to a person is the hole the membership desk closed, and it stays closed here.
 *
 * EMAIL. One: the team's alert for a new answer, to the investor inbox, which is the alert every
 * investor form already sends (`/api/forms/submit`). Nothing is sent to the person who asked.
 */
import type { Express, Request } from "express";
import type { Pool } from "mysql2/promise";
import { cleanLink, cleanWhatsapp, LINK_MAX } from "../../shared/entrance";
import { CONSENT_MAX, cleanAnswers, contactProblem, INVESTOR_INTEREST_FORM, type InvestorAccessState, type InvestorIdentity } from "../../shared/investorInterest";
import { ipBucket } from "../../shared/openProposals";
import { pageSectionKey } from "../../shared/pageContent/types";
import { emailKeyOf } from "../../shared/comms/address";
import { cookieValue, readEntry } from "../lib/entrance";
import { entryLook } from "../repos/portalEntries";
import { latestVerifiedEntry } from "../repos/portalVisitors";
import { grantAccess, hasAccess, revokeAccess, type AccessHolder } from "../repos/investorAccess";

export interface InvestorAccessDeps {
  getPool(): Pool;
  /** The dial `investors.gate`: whether this village keeps the investor page for the readers it accepts. */
  gateOn(): boolean;
  /** The secret the entry cookie is signed under (the entrance's). */
  secret: string;
  now?: () => number;
  authedUser(req: Request): Promise<any | null>;
  isAdmin(req: Request): Promise<boolean>;
  clientIp(req: Request): string;
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  /** The submissions table: one INSERT for a new answer, and the rows to find this reader's newest. */
  submissions: { insert(entry: any): Promise<unknown>; all(): any[] };
  /** The team's alert for a new answer, the one every investor form already sends. Never rejects. */
  alert(entry: any): void;
}

/** The refusal a reader without access gets from the summary and the packet. */
export const INVESTOR_ONLY = { error: "investor_only", message: "This part of the investor page opens once the team has read your interest form." };

/** The investor page's own words in the content store (shared/pageContent/journeys.ts, `INVESTOR_JOURNEY`). */
export const INVESTOR_SECTION = pageSectionKey({ id: "investor" });

/** Answers a visitor may send in an hour from one connection. */
const PER_HOUR = 5;

export interface InvestorAccess {
  allowed(req: Request): Promise<boolean>;
  /** Access after a status change on the desk: true let in, false taken back, null nothing to do or nobody to let in. */
  decided(row: any, status: string, actorId: string | null): Promise<{ letIn: boolean | null; holder: InvestorIdentity | null } | null>;
}

export function register(app: Express, deps: InvestorAccessDeps): InvestorAccess {
  const now = deps.now ?? (() => Date.now());
  const pool = () => deps.getPool();

  /** Who is reading: the account, and the visitor behind this device's entry cookie. */
  async function readerOf(req: Request) {
    const user = await deps.authedUser(req).catch(() => null);
    const id = readEntry(deps.secret, cookieValue(req), now());
    const e = id ? await entryLook(pool(), id).catch(() => null) : null;
    const visitor = e && !e.isTest ? { emailKey: e.emailKey, email: e.email, name: e.name, proven: e.verified } : null;
    return { user, visitor };
  }

  const holdersOf = (r: Awaited<ReturnType<typeof readerOf>>): AccessHolder[] => {
    const out: AccessHolder[] = [];
    if (r.user?.id) out.push({ kind: "account", userId: String(r.user.id) });
    if (r.visitor?.proven) out.push({ kind: "visitor", emailKey: r.visitor.emailKey });
    return out;
  };

  async function allowed(req: Request): Promise<boolean> {
    if (!deps.gateOn()) return true;
    if (await deps.isAdmin(req).catch(() => false)) return true;
    const holders = holdersOf(await readerOf(req));
    return holders.length ? hasAccess(pool(), holders) : false;
  }

  /** The newest answer this reader sent: by account, or by the visitor's proven address. */
  function newestRequest(r: Awaited<ReturnType<typeof readerOf>>) {
    const userId = r.user?.id ? String(r.user.id) : "";
    const proven = r.visitor?.proven ? r.visitor.emailKey : "";
    const mine = deps
      .submissions.all()
      .filter((s) => s.type === INVESTOR_INTEREST_FORM && ((userId && String(s.userId ?? "") === userId) || (proven && s.data?.provenEmail === proven)))
      .sort((a, b) => Date.parse(String(b.submittedAt)) - Date.parse(String(a.submittedAt)));
    return mine[0] ? { sentAt: new Date(mine[0].submittedAt).toISOString(), status: String(mine[0].status ?? "new") } : null;
  }

  app.get("/api/investor/access", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const r = await readerOf(req);
    const access = await allowed(req);
    let prefill: InvestorAccessState["prefill"] = { name: "", email: "", whatsapp: "", link: "", locked: false };
    if (r.user?.email) {
      prefill = { name: String(r.user.name ?? ""), email: String(r.user.email), whatsapp: "", link: "", locked: true };
    } else if (r.visitor?.proven) {
      const v = await latestVerifiedEntry(pool(), r.visitor.emailKey).catch(() => null);
      prefill = { name: v?.name ?? r.visitor.name, email: v?.email ?? r.visitor.email, whatsapp: v?.whatsapp ?? "", link: v?.link ?? "", locked: true };
    } else if (r.visitor) {
      // Typed at the entrance and not proven yet: filled in, still the person's to change.
      prefill = { name: r.visitor.name, email: r.visitor.email, whatsapp: "", link: "", locked: false };
    }
    const state: InvestorAccessState = { access, prefill, request: newestRequest(r) };
    res.json(state);
  });

  app.post("/api/investor/interest", async (req, res) => {
    if (await deps.overLimit(`investor-interest:${ipBucket(deps.clientIp(req))}`, PER_HOUR, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "slow_down", message: "Too many forms from this connection. Please try again in an hour." });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    // A field no person sees: a bot fills it. Thank it, keep nothing.
    if (typeof b.website === "string" && b.website.trim()) return res.json({ ok: true });
    const r = await readerOf(req);
    const identity: InvestorIdentity = r.user?.id ? "account" : r.visitor?.proven ? "visitor" : "unverified";
    // What the village already holds wins over what was typed.
    const name = identity === "account" ? String(r.user.name ?? "") : identity === "visitor" ? r.visitor!.name : typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim() : "";
    const email = identity === "account" ? String(r.user.email ?? "") : identity === "visitor" ? r.visitor!.email : typeof b.email === "string" ? b.email.trim() : "";
    const problem = contactProblem(name, email);
    if (problem) return res.status(400).json({ error: "invalid", field: problem, message: problem === "name" ? "Tell us your name." : "That email address does not look right." });
    const whatsapp = cleanWhatsapp(b.whatsapp);
    if (whatsapp === false) return res.status(400).json({ error: "invalid", field: "whatsapp", message: "That WhatsApp number does not look right. Digits, spaces and a leading + are fine." });
    const link = cleanLink(b.link);
    if (link === false) return res.status(400).json({ error: "invalid", field: "link", message: "That link does not look right. Paste a web address or a handle such as @yourname." });
    const consent = typeof b.consent === "string" ? b.consent.trim().slice(0, CONSENT_MAX) : "";
    const entry: any = {
      id: `${now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: INVESTOR_INTEREST_FORM,
      status: "new",
      rewarded: false,
      submittedAt: new Date(now()).toISOString(),
      data: {
        name,
        email,
        ...(whatsapp ? { whatsapp } : {}),
        ...(link ? { link: link.slice(0, LINK_MAX) } : {}),
        ...cleanAnswers(b),
        // Decided here, never by the form: who accepting this answer would let in.
        identity,
        ...(identity === "visitor" ? { provenEmail: emailKeyOf(r.visitor!.emailKey) } : {}),
        // The words the person read under the form, kept with what they agreed to.
        consentWords: consent,
      },
    };
    if (identity === "account") {
      entry.userId = String(r.user.id);
      entry.userName = String(r.user.name ?? "");
    }
    await deps.submissions.insert(entry);
    deps.alert(entry);
    res.json({ ok: true, id: entry.id });
  });

  async function decided(row: any, status: string, actorId: string | null) {
    if (!row || row.type !== INVESTOR_INTEREST_FORM) return null;
    const holder: AccessHolder | null = row.userId
      ? { kind: "account", userId: String(row.userId) }
      : row.data?.identity === "visitor" && typeof row.data?.provenEmail === "string"
        ? { kind: "visitor", emailKey: row.data.provenEmail }
        : null;
    const named: InvestorIdentity | null = holder ? (holder.kind === "account" ? "account" : "visitor") : null;
    if (!holder) return { letIn: null, holder: null };
    if (status === "accepted") {
      await grantAccess(pool(), holder, String(row.id), actorId, new Date(now()));
      return { letIn: true, holder: named };
    }
    if (status === "declined") return { letIn: (await revokeAccess(pool(), holder)) ? false : null, holder: named };
    return { letIn: null, holder: named };
  }

  return { allowed, decided };
}
