/**
 * Account recovery: the one route that can put a member back into a village
 * they are locked out of.
 *
 * MOVED OUT OF server/index.ts BY THIS LANE, unchanged in shape and registered
 * at exactly the point it used to sit, because Express matches in registration
 * order. Two things came with the move:
 *
 *  1. The eligibility rule is now `maySendSetPasswordLink` in
 *     server/lib/oauthAccounts.ts, which is a unit test instead of a truthiness
 *     check on a password hash. That check was the bug: an account that never
 *     set a password got the success message and no email, on every attempt,
 *     forever. Read the reasoning there.
 *  2. A send that did not send is now logged. `sendResendEmail` RETURNS a
 *     result and only throws on an unexpected fault, so the try/catch this
 *     route already had could never see the ordinary failure: no provider
 *     configured, no sender address, an address the provider would not take.
 *     Every one of those left a member waiting for a letter that was never
 *     posted, with nothing in the log to find. The response is unchanged.
 *
 * WHAT DID NOT CHANGE, and must not. Every caller gets one identical 200:
 * unknown address, example identity, tombstone, claim-pending account and
 * ordinary reset are indistinguishable from outside. That is the
 * account-enumeration defence, and it survives the fix because the fix changes
 * which letter is SENT and never what is ANSWERED.
 */
import type { Express, Request, Response } from "express";
import { makeSetPasswordToken } from "../lib/memberTokens";
import { maySendSetPasswordLink } from "../lib/oauthAccounts";
import { languageOfMember } from "../lib/mailLanguage";
import type { MailLanguage } from "../../shared/mailLanguage";
import { passwordMailWords } from "../../shared/passwordMailWords";

/** What this module reaches. The complete list. */
export interface RecoveryDeps {
  authSecret: string;
  members: { byEmail(email: string): Promise<any | null>; all(): Promise<any[]> };
  /** True when the caller has already spent its budget. */
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  clientIp(req: Request): string;
  /** The live game variable for the per-IP hourly ceiling. */
  resetPerIpHourly(): number;
  sendEmail(opts: {
    to: string[];
    subject: string;
    html: string;
    /** What made it, for Sent mail: `auth.reset` or `auth.first_password`. */
    origin?: string;
  }): Promise<{ sent: boolean; reason?: string }>;
  escapeHtml(s: string): string;
  /** Where this village lives, for the absolute link in the letter. */
  origin(): string;
  projectName(): string;
  recordAudit(text: string, userId: string): void;
  /**
   * The account an EXTRA address belongs to, and the address as it was proved
   * (0430). Optional: a village before 0430, or a test, has none.
   */
  attachedAddress?(email: string): Promise<{ userId: string; email: string } | null>;
}

/**
 * WHERE A RESET LETTER GOES: the address that asked, as the account holds it.
 *
 * Typed at the main address, the main address. Typed at an extra address the
 * member proved (0430), that extra address, because essential mail goes to the
 * mailbox that asked for it. Never what was typed: `users.email` and
 * `member_emails.email` compare case- and accent-insensitively, so `wrén@`
 * finds the account held at `wren@`, and a letter sent to the typed form would
 * hand a reset link to a different mailbox. Anything unexpected falls back to
 * the main address, which is where the letter always went.
 */
export async function recoveryAddress(
  deps: Pick<RecoveryDeps, "attachedAddress">,
  user: { id: string; email: string },
  typed: string,
): Promise<string> {
  if (String(user.email).trim().toLowerCase() === typed.trim().toLowerCase()) return user.email;
  const extra = deps.attachedAddress ? await deps.attachedAddress(typed).catch(() => null) : null;
  return extra && extra.userId === user.id ? extra.email : user.email;
}

/**
 * WHETHER THIS VILLAGE CAN STILL BE CLAIMED: true while no member holds the
 * founder or admin role, the same test `POST /api/admin/bootstrap` makes
 * before it will spend the bootstrap password. The home page reads it so a
 * founder who has just deployed can find `/claim` at all (the founder-path
 * pass of 2026-11-01 found the front door never pointed there).
 *
 * It says nothing an attacker can use: claiming still needs the bootstrap
 * password and stays throttled, and the answer flips to false for good the
 * moment a founder exists.
 */
export function claimOpen(all: readonly { role?: unknown }[]): boolean {
  return !all.some((u) => u?.role === "admin" || u?.role === "founder");
}

/** Send one recovery letter and log a send that did not send. Never throws. */
export async function sendRecoveryLetter(
  deps: Pick<RecoveryDeps, "sendEmail">,
  user: { id: string; email: string },
  kind: string,
  letter: { origin: string; subject: string; html: string },
): Promise<void> {
  try {
    const mail = await deps.sendEmail({ to: [user.email], subject: letter.subject, html: letter.html, origin: letter.origin });
    if (!mail.sent) {
      // The member has a 200 in their browser and no letter on the way.
      // Somebody has to be able to find that, and the reason names the
      // setting to fix.
      console.error(
        `[auth] recovery email NOT SENT for ${user.id} (${kind}): reason=${mail.reason ?? "unknown"}. ` +
          "The member got a success message and no link.",
      );
    }
  } catch (e) {
    console.error(`[auth] recovery email FAILED for ${user.id}: the member got a 200 and no link`, e);
  }
}

/** Which set-password letter. Each says a different fact, so each has its own first line. */
export type PasswordLetterKind = "reset" | "first_password" | "founder_claim" | "founder_created" | "admin_link";

const PASSWORD_LETTER_ORIGIN: Record<PasswordLetterKind, string> = {
  reset: "auth.reset",
  first_password: "auth.first_password",
  founder_claim: "auth.founder_claim",
  founder_created: "auth.founder_claim",
  admin_link: "auth.admin_password_link",
};

/**
 * EVERY LETTER THAT CARRIES A SET-PASSWORD LINK, built in one place (the coordinator, 26 Nov 2026: "one builder,
 * not four"): the member's reset and first password here, and the founder's claim, a new founder account and an
 * administrator's link in server/index.ts. In the reader's language (shared/passwordMailWords.ts); English is
 * exactly what each letter said before. `village` and `url` arrive as plain text and are escaped here.
 */
export function passwordLetter(
  kind: PasswordLetterKind,
  i: { escapeHtml(s: string): string; village: string; url: string; lang?: MailLanguage },
): { origin: string; subject: string; html: string } {
  const W = passwordMailWords(i.lang);
  const village = i.escapeHtml(i.village);
  const url = i.escapeHtml(i.url);
  const link = (words: string, expiry: string) => `<p><a href="${url}">${words}</a> ${expiry}.</p>`;
  const paste = `<p>${W.paste(url)}</p>`;
  const notYou = `<p>${W.notYou}</p>`;
  const origin = PASSWORD_LETTER_ORIGIN[kind];
  switch (kind) {
    case "reset":
      return { origin, subject: W.reset.subject, html: [`<p>${W.reset.asked(village)}</p>`, link(W.setNew, W.expiresOnce), paste, notYou].join("\n") };
    case "first_password":
      return { origin, subject: W.first.subject, html: [`<p>${W.first.none(village)}</p>`, link(W.setYours, W.expiresOnce), paste, notYou].join("\n") };
    case "founder_claim":
      return { origin, subject: W.founderClaim.subject, html: [link(W.setYours, W.expires), paste].join("\n") };
    case "founder_created":
      return { origin, subject: W.founderMade.subject, html: [`<p>${W.founderMade.made(village)}</p>`, link(W.setYours, W.expires), paste].join("\n") };
    case "admin_link":
      return { origin, subject: W.adminLink.subject, html: [`<p>${W.adminLink.sent(village)}</p>`, link(W.setNew, W.expiresOnce), paste].join("\n") };
  }
}

export function register(app: Express, deps: RecoveryDeps): void {
  app.get("/api/auth/claim-status", async (_req: Request, res: Response) => {
    res.json({ open: claimOpen(await deps.members.all()) });
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const sameAnswer = {
      success: true,
      message: "If an account exists for that address, a link to set a new password is on its way.",
    };
    if (await deps.overLimit(`forgot:${deps.clientIp(req)}`, Math.max(1, deps.resetPerIpHourly()), 60 * 60 * 1000)) {
      return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
    }
    const email = String(req.body?.email ?? "").trim();
    if (!email) return res.status(400).json({ error: "An email address is required" });
    // Per-address bucket too: without it, one address can be mail-bombed
    // from a pool of IPs.
    if (await deps.overLimit(`forgot-acct:${email.toLowerCase()}`, 5, 60 * 60 * 1000)) {
      return res.json(sameAnswer);
    }
    const user = await deps.members.byEmail(email);
    const verdict = maySendSetPasswordLink(user);
    if (verdict.send) {
      // The token is bound to the member's tokenVersion, which setting a
      // password bumps, so it works once, for the claim case as much as the
      // reset. Nothing derived from the password rides in it.
      const claim = makeSetPasswordToken(deps.authSecret, user.id, user.tokenVersion ?? 0);
      const claimUrl = `${deps.origin()}/set-password?token=${encodeURIComponent(claim)}`;
      // Two letters, because the two states are different facts and a member
      // who never had a password should not be told somebody asked to change
      // it. Which one arrives is visible only inside the mailbox, so this
      // says nothing to an anonymous caller. In the member's own language.
      const letter = passwordLetter(verdict.kind === "reset" ? "reset" : "first_password", {
        escapeHtml: deps.escapeHtml,
        village: deps.projectName(),
        url: claimUrl,
        lang: languageOfMember(user),
      });
      // IN THE BACKGROUND, never awaited (R110). Awaiting the provider made a
      // real account's answer slower than an unknown address's by one email
      // round trip, which told a stranger which addresses are members. The
      // answer below now leaves at the same moment for every address.
      void recoveryAddress(deps, user, email).then((to) => sendRecoveryLetter(deps, { id: user.id, email: to }, verdict.kind, letter));
      deps.recordAudit(
        verdict.kind === "reset" ? "auth:password-reset-requested" : "auth:claim-link-requested",
        user.id,
      );
    }
    res.json(sameAnswer);
  });
}
