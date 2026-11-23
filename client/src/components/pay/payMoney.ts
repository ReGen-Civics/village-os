/**
 * WHAT THE SEND AND RECEIVE PAGE SAYS ABOUT AMOUNTS, as pure functions.
 *
 * The lead, 23 Nov 2026: the amount pad works in credits, and a member reads
 * beside every credit amount the same value in their own currency. One credit
 * is worth what the village set (`face`, from `GET /api/pay`, the same answer a
 * venture is quoted when it redeems), and that value is converted into the
 * member's chosen display currency through the day's rates.
 *
 * Never a made-up figure: no face value means credits alone, and no rate into
 * the member's currency means the face currency itself.
 */
import { convertMinor, crossRate, formatMoney } from "@shared/money";
import { amountToMinor, parseAmount, PAY_AMOUNT_MAX } from "@shared/payLink";
import type { Payee } from "@shared/payLink";

/** One sendable token as `GET /api/pay` hands it. */
export interface PayToken {
  slug: string;
  name: string;
  decimals: number;
  /** Minor units held. */
  balance: number;
  /** What one whole token is worth, or null when the village has set nothing. */
  face: { currency: string; minorPerToken: number } | null;
}

/** `GET /api/pay`. */
export interface PaySummary {
  me: Payee;
  tokens: PayToken[];
  displayCurrency: string | null;
  villageCurrency: string | null;
}

/**
 * The currency a member reads money in: the one they chose on this device,
 * else the one saved to their account, else the village's own, else the
 * currency a credit is valued in.
 */
export function primaryCurrency(input: {
  chosenHere: string;
  saved: string | null;
  village: string | null;
  face: string | null;
}): string | null {
  for (const c of [input.chosenHere, input.saved, input.village, input.face]) {
    const code = String(c ?? "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) return code;
  }
  return null;
}

/** Minor units of a token, as a member reads them: "25", "12.5", "1,250". */
export function creditsWords(minor: number, decimals: number, locale = "en"): string {
  const d = Math.max(0, Math.trunc(decimals));
  const major = (Number(minor) || 0) / 10 ** d;
  return new Intl.NumberFormat(`${locale}-u-nu-latn`, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(major);
}

/**
 * The same amount in money, or null when the village has given credits no
 * value. `converted` says whether it went through a rate, so the page can say
 * "about" for a converted figure and nothing for the face value itself.
 */
export function moneyBeside(
  minor: number,
  token: Pick<PayToken, "decimals" | "face">,
  target: string | null,
  rates: Record<string, number> | null | undefined,
  locale = "en",
): { text: string; converted: boolean } | null {
  const face = token.face;
  if (!face || !(face.minorPerToken > 0) || !(minor > 0)) return null;
  const faceMinor = Math.round(((Number(minor) || 0) * face.minorPerToken) / 10 ** Math.max(0, token.decimals));
  const loc = `${locale}-u-nu-latn`;
  const own = { text: formatMoney(faceMinor, face.currency, undefined, loc), converted: false };
  if (!target || target === face.currency) return own;
  const rate = rates ? crossRate(rates, face.currency, target) : null;
  if (rate === null) return own;
  const minorThere = convertMinor(faceMinor, face.currency, target, rate);
  // A figure under one whole unit of the target says nothing worth reading.
  if (minorThere <= 0 && faceMinor > 0) return own;
  return { text: formatMoney(minorThere, target, undefined, loc), converted: true };
}

/** What the member has typed on the pad, as the pad's own rules allow it. */
export function padPress(current: string, key: string, decimals: number): string {
  const places = Math.min(2, Math.max(0, Math.trunc(decimals)));
  if (key === "back") return current.slice(0, -1);
  if (key === "clear") return "";
  if (key === ".") {
    if (places === 0 || current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (!/^\d$/.test(key)) return current;
  const [whole, frac] = current.split(".");
  if (frac !== undefined && frac.length >= places) return current;
  if (frac === undefined && whole === "0") return key;
  if (frac === undefined && whole.length >= 7) return current;
  const next = `${current}${key}`;
  return Number(next) > PAY_AMOUNT_MAX ? current : next;
}

/** The typed amount in minor units, or 0 when nothing payable is typed. */
export function typedMinor(typed: string, decimals: number): number {
  const amount = parseAmount(typed);
  return amount ? amountToMinor(amount, decimals) : 0;
}

/** Why the amount cannot be sent yet, or null when it can. */
export type AmountProblem = "empty" | "too_much";

export function amountProblem(minor: number, balance: number): AmountProblem | null {
  if (!(minor > 0)) return "empty";
  if (minor > balance) return "too_much";
  return null;
}

/** A member's initials for the round tile that stands in for a photo. */
export function initialsOf(name: string): string {
  const parts = String(name ?? "").replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}
