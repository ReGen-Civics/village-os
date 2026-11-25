/**
 * THE RULES FOR A MEMBER'S EXTRA ADDRESSES: the code mailed to a new address,
 * what may be attached, and the letter that carries the code. Pure where it
 * can be; the routes are server/routes/memberEmails.ts, the SQL is
 * server/repos/memberEmails.ts, the contract is shared/memberEmails.ts.
 *
 * ── NEVER AN ADDRESS NOBODY PROVED ──────────────────────────────────────────
 *
 * Attaching an address hands its mailbox a way into the account: a password
 * reset typed at it reaches the account, and a Google sign-in at it signs in.
 * So an address is attached only when a code mailed to that address comes back
 * from the signed-in owner of the account. The person reading the mailbox and
 * the person holding the session are then shown to be one person, which is
 * exactly what the main address's proof means (server/lib/emailVerification.ts).
 * An admin can read the addresses and can never attach one: there is no route
 * that writes a row from anything but a returned code.
 *
 * ── AND NEVER FROM AN ACCOUNT NOBODY PROVED ─────────────────────────────────
 *
 * An account whose main address was never proved may be a planted one (R104:
 * somebody signs up at an address they do not read). If it could attach a
 * mailbox of its own, the planter would gain a reset path and a Google door
 * that survive the real owner arriving. So the main address is proved first,
 * which also means making an extra address the main one never turns an
 * unproved address into an attached one.
 *
 * ── THE CODE ────────────────────────────────────────────────────────────────
 *
 * Six digits, kept in the member's own `prefs.pendingEmail` as an HMAC under
 * the session secret bound to the account and the address, with an expiry and
 * a count of wrong tries. The code itself is never stored and never returned
 * to the caller. Five wrong tries spend it, so guessing one in a million costs
 * a fresh letter every five guesses, and asking for letters is throttled.
 */
import crypto from "node:crypto";
import { signTokenPayload } from "./memberTokens";
import { sameAddress } from "./emailVerification";
import { isPlainAddress } from "./comms/mailer";
import {
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_TRIES,
  EMAIL_CODE_TTL_MS,
  MAX_EXTRA_ADDRESSES,
  normalizeAddress,
  type ExtraAddress,
} from "../../shared/memberEmails";

const PURPOSE = "member-email-1";

/** A pending code, as it rests in `prefs.pendingEmail`. */
export interface PendingAddress {
  email: string;
  digest: string;
  expiresAt: number;
  tries: number;
}

/** Six random digits from the crypto source, zero-padded. */
export function makeAddressCode(): string {
  return String(crypto.randomInt(0, 10 ** EMAIL_CODE_LENGTH)).padStart(EMAIL_CODE_LENGTH, "0");
}

/** The keyed digest kept in place of the code: bound to the account and the address. */
export function addressCodeDigest(secret: string, userId: string, email: string, code: string): string {
  return signTokenPayload(secret, `${PURPOSE}|${userId}|${normalizeAddress(email)}|${String(code).trim()}`);
}

/** What the member reads when an address cannot be attached. Each names what to do next. */
export const ADDRESS_REFUSAL = {
  invalid: "That does not look like an email address. Check it and try again.",
  tooLong: "That address is too long to use here.",
  mainUnproved: "Confirm your main address first. Open the confirmation email we sent it, or ask for a new one, then add another address.",
  alreadyMain: "That is already your main address.",
  alreadyYours: "That address is already attached to your account.",
  takenElsewhere:
    "That address already has its own account here. Sign in with it to use that account. Two accounts are never joined from this page, so if both are yours, ask a steward.",
  full: `An account can hold ${MAX_EXTRA_ADDRESSES} extra addresses. Remove one first.`,
  noCode: "There is no code waiting. Add the address again and we will send a new one.",
  expired: "That code has expired. Add the address again and we will send a new one.",
  spent: "Too many wrong codes. Add the address again and we will send a new one.",
  wrong: "That code does not match. Check the newest email and try again.",
} as const;

/**
 * Null when this address may be sent a code for this account now, or the
 * sentence that says why not. `ownerElsewhere` is the id of whatever account
 * already holds the address as its main or an extra one, or null.
 */
export function addressRefusal(input: {
  address: string;
  account: { id: string; email: string; emailVerifiedAt?: string | null };
  extras: readonly Pick<ExtraAddress, "email">[];
  ownerElsewhere: string | null;
}): string | null {
  const address = normalizeAddress(input.address);
  if (!address || !isPlainAddress(address, "<>,;\"'")) return ADDRESS_REFUSAL.invalid;
  if (address.length > 254) return ADDRESS_REFUSAL.tooLong;
  if (sameAddress(address, input.account.email)) return ADDRESS_REFUSAL.alreadyMain;
  // Before anything that reads another account: an unproved account learns nothing about anybody.
  if (!input.account.emailVerifiedAt) return ADDRESS_REFUSAL.mainUnproved;
  if (input.extras.some((e) => sameAddress(e.email, address))) return ADDRESS_REFUSAL.alreadyYours;
  if (input.ownerElsewhere === input.account.id) return ADDRESS_REFUSAL.alreadyYours;
  if (input.ownerElsewhere) return ADDRESS_REFUSAL.takenElsewhere;
  if (input.extras.length >= MAX_EXTRA_ADDRESSES) return ADDRESS_REFUSAL.full;
  return null;
}

/** The pending code a mutator writes, replacing any earlier one: only the newest letter works. */
export function pendingFor(secret: string, userId: string, email: string, code: string, now: number = Date.now()): PendingAddress {
  return { email: normalizeAddress(email), digest: addressCodeDigest(secret, userId, email, code), expiresAt: now + EMAIL_CODE_TTL_MS, tries: 0 };
}

/** The pending code on a member record, or null when there is none or it is malformed. */
export function readPending(member: { prefs?: any }): PendingAddress | null {
  const p = member?.prefs?.pendingEmail;
  if (!p || typeof p !== "object") return null;
  if (typeof p.email !== "string" || typeof p.digest !== "string" || typeof p.expiresAt !== "number") return null;
  return { email: p.email, digest: p.digest, expiresAt: p.expiresAt, tries: Number(p.tries) || 0 };
}

export type CodeCheck = "ok" | "none" | "expired" | "spent" | "wrong";

/**
 * Does this code prove the pending address. A mutator's question, asked under
 * the row lock so two guesses at once each spend a try. The comparison is
 * constant-time over the digests.
 */
export function checkAddressCode(
  secret: string,
  userId: string,
  pending: PendingAddress | null,
  code: unknown,
  now: number = Date.now(),
): CodeCheck {
  if (!pending) return "none";
  if (now > pending.expiresAt) return "expired";
  if (pending.tries >= EMAIL_CODE_TRIES) return "spent";
  const typed = String(code ?? "").replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${EMAIL_CODE_LENGTH}}$`).test(typed)) return "wrong";
  const a = Buffer.from(addressCodeDigest(secret, userId, pending.email, typed));
  const b = Buffer.from(pending.digest);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? "ok" : "wrong";
}

/** The sentence for a check that did not pass. */
export function codeRefusal(check: Exclude<CodeCheck, "ok">): string {
  return { none: ADDRESS_REFUSAL.noCode, expired: ADDRESS_REFUSAL.expired, spent: ADDRESS_REFUSAL.spent, wrong: ADDRESS_REFUSAL.wrong }[check];
}

/** The letter that carries the code. Essential mail: it goes to the address that asked, whatever the account's delivery choice. */
export function addressCodeLetter(
  escapeHtml: (s: string) => string,
  village: string,
  code: string,
): { subject: string; html: string; text: string } {
  const v = escapeHtml(village);
  const minutes = Math.round(EMAIL_CODE_TTL_MS / 60000);
  return {
    subject: `Your code to add this address: ${code}`,
    html: `<p>Somebody signed in to ${v} asked to add this email address to their account.</p>
<p style="font-size:24px;letter-spacing:4px;font-weight:bold">${escapeHtml(code)}</p>
<p>If it was you, enter this code on your profile. It works for ${minutes} minutes.</p>
<p>If it was not you, do nothing. The address is attached only when this code is entered, and nobody else can see it.</p>`,
    text: `Somebody signed in to ${village} asked to add this email address to their account.\n\nYour code: ${code}\n\nIf it was you, enter this code on your profile. It works for ${minutes} minutes.\nIf it was not you, do nothing. The address is attached only when this code is entered.`,
  };
}
