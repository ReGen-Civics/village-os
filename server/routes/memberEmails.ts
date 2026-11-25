/**
 * A member's addresses: attach one by a mailed code, remove one, choose the
 * main one, and choose where the village's mail goes (the lead, 24 Nov 2026).
 * An admin reads them and changes nothing.
 *
 * The rules are server/lib/memberEmails.ts, the SQL server/repos/memberEmails.ts,
 * the contract shared/memberEmails.ts. Where the delivery choice takes effect
 * is `post()` in server/lib/comms/postOffice.ts, the one place every email
 * passes through.
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import {
  deliveryAddresses,
  deliveryExtra,
  isEmailDelivery,
  normalizeAddress,
  type AccountEmails,
  type ExtraAddress,
} from "../../shared/memberEmails";
import {
  ADDRESS_REFUSAL,
  addressCodeLetter,
  addressRefusal,
  checkAddressCode,
  codeRefusal,
  makeAddressCode,
  pendingFor,
  readPending,
  type CodeCheck,
} from "../lib/memberEmails";
import { isUnclaimable } from "../lib/oauthAccounts";
import {
  attachAddress,
  deliveryChoiceOf,
  detachAddress,
  extrasFor,
  mainAddressOwner,
  makeMainAddress,
  ownerOfAddress,
  setDelivery,
} from "../repos/memberEmails";

/** What this module reaches. The complete list. */
export interface MemberEmailsDeps {
  authSecret: string;
  getPool(): Pool;
  members: {
    byId(id: string): Promise<any | null>;
    update(id: string, mutate: (m: any) => void): Promise<any | null>;
  };
  authedUser(req: Request): Promise<any | null>;
  isAdmin(req: Request): Promise<boolean>;
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  clientIp(req: Request): string;
  /** The one mail door, as essential mail: the post office, urgent, to exactly the address named. */
  sendEmail(opts: { to: string[]; subject: string; html: string; text?: string; origin?: string }): Promise<{ sent: boolean; reason?: string }>;
  escapeHtml(s: string): string;
  projectName(): string;
  recordAudit(text: string, userId: string): void;
}

const HOUR = 60 * 60 * 1000;

/** The account's addresses as its owner or an admin reads them. */
export async function accountEmails(pool: Pool, member: any, opts: { withPending: boolean }): Promise<AccountEmails> {
  const extras = await extrasFor(pool, member.id);
  const raw = await deliveryChoiceOf(pool, member.id);
  const delivery = isEmailDelivery(raw) ? raw : "main";
  const out: AccountEmails = {
    main: String(member.email ?? ""),
    mainVerified: !!member.emailVerifiedAt,
    extras,
    delivery,
    deliversTo: deliveryAddresses({ main: String(member.email ?? ""), delivery, extras }),
  };
  if (opts.withPending) {
    const p = readPending(member);
    out.pending = p && p.expiresAt > Date.now() ? { email: p.email, expiresAt: new Date(p.expiresAt).toISOString() } : null;
  }
  return out;
}

export function register(app: Express, deps: MemberEmailsDeps): void {
  const signedIn = async (req: Request, res: Response): Promise<any | null> => {
    const me = await deps.authedUser(req);
    if (!me) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    if (isUnclaimable(me)) {
      res.status(409).json({ error: "This account cannot hold addresses." });
      return null;
    }
    return me;
  };

  app.get("/api/me/email-addresses", async (req, res) => {
    const me = await signedIn(req, res);
    if (!me) return;
    res.json(await accountEmails(deps.getPool(), me, { withPending: true }));
  });

  /** Mail a code to a new address. Nothing is attached until the code comes back. */
  app.post("/api/me/email-addresses", async (req, res) => {
    const me = await signedIn(req, res);
    if (!me) return;
    const address = normalizeAddress(req.body?.email);
    if (
      (await deps.overLimit(`member-email-send:${deps.clientIp(req)}`, 10, HOUR)) ||
      (await deps.overLimit(`member-email-send-acct:${me.id}`, 5, HOUR))
    ) {
      return res.status(429).json({ error: "Too many codes asked for. Try again in an hour." });
    }
    const pool = deps.getPool();
    const extras = await extrasFor(pool, me.id);
    const owner = address ? ((await mainAddressOwner(pool, address)) ?? (await ownerOfAddress(pool, address))?.userId ?? null) : null;
    const refusal = addressRefusal({ address, account: me, extras, ownerElsewhere: owner });
    if (refusal) return res.status(refusal === ADDRESS_REFUSAL.takenElsewhere ? 409 : 400).json({ error: refusal });

    const code = makeAddressCode();
    const pending = pendingFor(deps.authSecret, me.id, address, code);
    const saved = await deps.members.update(me.id, (u: any) => {
      u.prefs = { ...(u.prefs ?? {}), pendingEmail: pending };
    });
    if (!saved) return res.status(404).json({ error: "No such account." });
    const letter = addressCodeLetter(deps.escapeHtml, deps.projectName(), code);
    let sent = false;
    try {
      const mail = await deps.sendEmail({ to: [address], origin: "auth.add_email", ...letter });
      sent = mail.sent;
      if (!mail.sent) console.error(`[auth] add-address code NOT SENT for ${me.id}: reason=${mail.reason ?? "unknown"}`);
    } catch (e) {
      console.error(`[auth] add-address code FAILED to send for ${me.id}`, e);
    }
    deps.recordAudit("auth:email-code-sent", me.id);
    res.json({ success: true, emailed: sent, pending: { email: address, expiresAt: new Date(pending.expiresAt).toISOString() } });
  });

  /** The code back from the mailbox: the one write that attaches an address. */
  app.post("/api/me/email-addresses/confirm", async (req, res) => {
    const me = await signedIn(req, res);
    if (!me) return;
    if (await deps.overLimit(`member-email-confirm-acct:${me.id}`, 20, HOUR)) {
      return res.status(429).json({ error: "Too many attempts. Try again in an hour." });
    }
    // Under the row lock, so two guesses at once each spend a try, and a right
    // code clears the pending one in the same write.
    const seen: { check: CodeCheck; address: string } = { check: "none", address: "" };
    const saved = await deps.members.update(me.id, (u: any) => {
      const pending = readPending(u);
      const check = (seen.check = checkAddressCode(deps.authSecret, u.id, pending, req.body?.code));
      if (!pending) return;
      seen.address = pending.email;
      const prefs = { ...(u.prefs ?? {}) };
      if (check === "ok" || check === "expired" || check === "spent") delete prefs.pendingEmail;
      else prefs.pendingEmail = { ...pending, tries: pending.tries + 1 };
      u.prefs = prefs;
    });
    if (!saved) return res.status(404).json({ error: "No such account." });
    const { check, address } = seen;
    if (check !== "ok") return res.status(400).json({ error: codeRefusal(check), code: check });

    // The world may have moved since the code was mailed: asked again, then the
    // table's primary key refuses a second account for the same address.
    const pool = deps.getPool();
    const owner = (await mainAddressOwner(pool, address)) ?? (await ownerOfAddress(pool, address))?.userId ?? null;
    const refusal = addressRefusal({ address, account: saved, extras: await extrasFor(pool, me.id), ownerElsewhere: owner });
    if (refusal) return res.status(409).json({ error: refusal });
    const attached = await attachAddress(pool, { userId: me.id, email: address, verifiedAt: new Date() });
    if (!attached.ok) return res.status(409).json({ error: ADDRESS_REFUSAL.takenElsewhere });
    deps.recordAudit("auth:email-attached", me.id);
    res.json({ success: true, emails: await accountEmails(pool, saved, { withPending: true }) });
  });

  /** Remove an extra address. The main address is never one of them, so the last address can never go. */
  app.delete("/api/me/email-addresses/:email", async (req, res) => {
    const me = await signedIn(req, res);
    if (!me) return;
    const pool = deps.getPool();
    const address = normalizeAddress(req.params.email);
    if (address === normalizeAddress(me.email)) {
      return res.status(400).json({ error: "Your main address cannot be removed. Make another address the main one first." });
    }
    const before = await extrasFor(pool, me.id);
    const wasTarget = deliveryExtra(before) === address;
    if (!(await detachAddress(pool, me.id, address))) return res.status(404).json({ error: "That address is not attached to your account." });
    // Mail that went to the removed address comes home to the main one. The
    // pure rule already falls back when no extra is left; this makes the stored
    // choice say so too, so the page never shows a choice that cannot happen.
    const raw = await deliveryChoiceOf(pool, me.id);
    if (wasTarget && (raw === "other" || raw === "both")) await setDelivery(pool, me.id, "main", null);
    deps.recordAudit("auth:email-removed", me.id);
    res.json({ success: true, emails: await accountEmails(pool, me, { withPending: true }) });
  });

  /** Make an extra address the main one. The old main address stays attached. */
  app.post("/api/me/email-addresses/main", async (req, res) => {
    const me = await signedIn(req, res);
    if (!me) return;
    const pool = deps.getPool();
    const result = await makeMainAddress(pool, me.id, String(req.body?.email ?? ""));
    if (!result.ok) {
      const error =
        result.reason === "main_unproved"
          ? ADDRESS_REFUSAL.mainUnproved
          : result.reason === "too_long"
            ? ADDRESS_REFUSAL.tooLong
            : "That address is not attached to your account.";
      return res.status(400).json({ error });
    }
    deps.recordAudit("auth:email-main-changed", me.id);
    const fresh = await deps.members.byId(me.id);
    res.json({ success: true, emails: await accountEmails(pool, fresh ?? me, { withPending: true }) });
  });

  /** Where the mail goes: the main address, the other one, or both. */
  app.put("/api/me/email-addresses/delivery", async (req, res) => {
    const me = await signedIn(req, res);
    if (!me) return;
    const delivery = req.body?.delivery;
    if (!isEmailDelivery(delivery)) return res.status(400).json({ error: "Choose main, other or both." });
    const pool = deps.getPool();
    const extras: ExtraAddress[] = await extrasFor(pool, me.id);
    let to: string | null = null;
    if (delivery !== "main") {
      if (!extras.length) return res.status(400).json({ error: "Add and confirm another address first." });
      const asked = normalizeAddress(req.body?.to);
      to = asked ? (extras.find((e) => e.email === asked)?.email ?? null) : deliveryExtra(extras);
      if (!to) return res.status(400).json({ error: "That address is not attached to your account." });
    }
    await setDelivery(pool, me.id, delivery, to);
    deps.recordAudit(`auth:email-delivery:${delivery}`, me.id);
    res.json({ success: true, emails: await accountEmails(pool, me, { withPending: true }) });
  });

  /** An admin reads a member's addresses and delivery choice. There is no admin write. */
  app.get("/api/admin/members/:id/email-addresses", async (req, res) => {
    if (!(await deps.isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const target = await deps.members.byId(String(req.params.id));
    if (!target) return res.status(404).json({ error: "No such member" });
    res.json(await accountEmails(deps.getPool(), target, { withPending: false }));
  });
}
