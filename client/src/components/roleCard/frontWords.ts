/**
 * THE CLOSED CARD'S FRONT (the lead, 23 Nov 2026): what a reader sees of a role before "Read the card".
 *
 *   - the role's kind, said by its status pill: "Open paid role" for a paid track, "Open role" otherwise (`pillKind`).
 *   - its pay mix, never an amount, drawn as a thin split bar with a one-line legend ("60% cash · 40% Amora tokens",
 *     PaySplitMini.tsx), each share above zero only. A volunteer role says "Volunteer role" in its place.
 *   - the last day to apply, when the card names one (`sections.applyBy`): "Apply by Mon 30 Nov".
 *   - an upcoming role is a paid role unless its track says otherwise: every upcoming role will be paid.
 *
 * The mix names only the shares above zero, read from the card's own shape or the village's default (`cardPay`),
 * with the village's own token names (useShareNames). A shape whose labels read as no share is said as written.
 */
// A value import of the runtime, as cardWordsT.ts has, so precompileEnglish compiles these messages.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import { PAID_TRACKS, readTrack } from "@shared/roleTracks";
import { partsOfShape } from "@shared/rewardShare";
import type { ShareNames } from "@shared/contributionToken";
import type { PayShare } from "@shared/roleCardSections";
import { shareLabelFor } from "@/components/ContributionWord";

export type FrontKind = "paid" | "volunteer";

/**
 * The role's kind for its front: its track when it has one (the server reads the village's default track in,
 * `card.track`), else paid when the card says it is paid or names its pay. A venture and an AI role have none.
 */
export function frontKind(seat: Record<string, any> | null | undefined, sections: { paid?: boolean; payCeiling?: unknown } | null | undefined): FrontKind | null {
  if (!seat || seat.futureVenture === true) return null;
  const track = readTrack(seat.card?.track);
  if (track === "volunteer") return "volunteer";
  if (track) return PAID_TRACKS.includes(track) ? "paid" : null;
  return sections?.paid === true || !!sections?.payCeiling || !!seat.card?.publicPay ? "paid" : null;
}

/** An upcoming role reads as paid unless its track says it is not: every upcoming role will be paid (the lead, 23 Nov 2026). */
export function soonIsPaid(seat: Record<string, any> | null | undefined): boolean {
  const track = readTrack(seat?.card?.track);
  return !track || PAID_TRACKS.includes(track);
}

/** One share of the mix above zero: which part it is (cash, the contribution token, credits, or as the card names it). */
export interface MixPart {
  part: "cash" | "equity" | "credits" | "named";
  pct: number;
  words: string;
}

/**
 * The shares above zero, each in words ("60% cash"), in the order cash, tokens, credits; [] with no shape to read.
 * `withCredits`: the credits share always, even at 0% (the lead, 23 Nov 2026: the split points to the future), as the
 * opened card's tiles show a 0% share.
 */
export function payMixParts(i18n: I18n, shape: readonly PayShare[], names: ShareNames, { withCredits = false }: { withCredits?: boolean } = {}): MixPart[] {
  const parts = partsOfShape(shape, { equity: [names.equity, names.equityShort], credits: names.credits });
  const said: MixPart[] = [];
  if (parts) {
    const { cash, equity, credits } = parts;
    if (cash > 0) said.push({ part: "cash", pct: cash, words: i18n._(msg({ message: `${cash}% cash`, context: "role card front: the cash share of the pay mix" })) });
    const token = names.equityShort;
    if (equity > 0) said.push({ part: "equity", pct: equity, words: i18n._(msg({ message: `${equity}% ${token}`, context: "role card front: a token share of the pay mix" })) });
    const usage = names.credits;
    if (credits > 0 || withCredits) said.push({ part: "credits", pct: credits, words: i18n._(msg({ message: `${credits}% ${usage}`, context: "role card front: a token share of the pay mix" })) });
  } else {
    for (const s of shape) {
      if (s.pct <= 0) continue;
      const pct = s.pct;
      const label = shareLabelFor(s.label, names);
      said.push({ part: "named", pct, words: i18n._(msg({ message: `${pct}% ${label}`, context: "role card front: a share of the pay mix as the card names it" })) });
    }
  }
  return said;
}

/** The mix with no shape to read: "Compensation in cash and tokens". */
export const noMixWords = (i18n: I18n): string => i18n._(msg({ message: "Compensation in cash and tokens", context: "role card front: the pay mix when the card names no shares" }));

/** "60% cash, 40% Amora tokens": the shares above zero, or "Compensation in cash and tokens" with no shape to read. */
export function payMixWords(i18n: I18n, shape: readonly PayShare[], names: ShareNames): string {
  const said = payMixParts(i18n, shape, names).map((p) => p.words);
  return said.length ? said.join(", ") : noMixWords(i18n);
}

/** "Volunteer role", said where a paid role draws its split; null for any other kind. */
export function volunteerLine(i18n: I18n, kind: FrontKind | null): string | null {
  return kind === "volunteer" ? i18n._(msg({ message: "Volunteer role", context: "role card front: the role's kind" })) : null;
}

/** The status pill's kind: "Open paid role" for a paid track, "Open role" for every other (the lead, 23 Nov 2026). */
export type PillKind = "open" | "openPaid" | "upcomingPaid";
export const pillKind = (kind: FrontKind | null): PillKind => (kind === "paid" ? "openPaid" : "open");

/** Today as a civil day on this device, YYYY-MM-DD. */
export function todayDay(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** "Apply by Mon 30 Nov", while the day has not passed; null for no day, a day that does not read, or one gone by. */
export function applyByWords(i18n: I18n = appI18n, day: string | null | undefined, today: string = todayDay()): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today) return null;
  let when: string;
  try {
    const parts = new Intl.DateTimeFormat(i18n.locale || "en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(new Date(`${day}T00:00:00Z`));
    const part = (type: string) => parts.find((p) => p.type === type)?.value.replace(/\.$/, "") ?? "";
    when = [part("weekday"), part("day"), part("month")].filter(Boolean).join(" ");
  } catch {
    when = day;
  }
  return i18n._(msg({ message: `Apply by ${when}`, context: "role card front: the last day to apply" }));
}

/**
 * THE APPLY-BY STAMP AND RIBBON (the lead, 24 Nov 2026: "really obvious the cut off date to apply"): the last day to
 * apply in the pieces a seal draws ("APPLY BY", "30", "NOV", "MONDAY"), the ribbon's line ("Applications close Mon 30
 * Nov"), the whole sentence a screen reader hears ("Applications close Monday 30 November"), and, inside the last
 * seven days, how many are left ("6 days left", "Closes today"). Null for no day, a day that does not read, or one
 * gone by, as applyByWords.
 */
export interface ApplyByParts {
  /** "Apply by", the seal's top line. */
  eyebrow: string;
  /** "30" */
  day: string;
  /** "Nov", the short month. */
  month: string;
  /** "Monday", the whole weekday. */
  weekday: string;
  /** "Applications close Mon 30 Nov", the ribbon's line. */
  line: string;
  /** "Applications close Monday 30 November", the sentence a screen reader hears. */
  label: string;
  /** Whole days from today to the last day: 0 on the day itself. */
  daysLeft: number;
  /** "6 days left" inside the last seven days, "Closes today" on the day; null before. */
  soon: string | null;
}

/** The days that count as closing soon: the last week. */
export const CLOSING_SOON_DAYS = 7;

export function applyByParts(i18n: I18n = appI18n, day: string | null | undefined, today: string = todayDay()): ApplyByParts | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today) return null;
  const at = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return null;
  const locale = i18n.locale || "en";
  const pick = (opts: Intl.DateTimeFormatOptions) => {
    try {
      const parts = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).formatToParts(at);
      return (type: string) => parts.find((p) => p.type === type)?.value.replace(/\.$/, "") ?? "";
    } catch {
      return () => "";
    }
  };
  const short = pick({ weekday: "short", day: "numeric", month: "short" });
  const long = pick({ weekday: "long", day: "numeric", month: "long" });
  const dayNum = short("day") || day.slice(8).replace(/^0/, "");
  const when = [short("weekday"), dayNum, short("month")].filter(Boolean).join(" ") || day;
  // English reads "Monday 30 November", as the short form; other languages take their own whole date ("lunes, 30 de noviembre").
  let whenLong: string;
  try {
    whenLong = locale.startsWith("en") ? [long("weekday"), dayNum, long("month")].filter(Boolean).join(" ") : new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(at);
  } catch {
    whenLong = when;
  }
  const whenKept = when.replace(/ /g, "\u00a0");
  const daysLeft = Math.round((at.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000);
  const soon =
    daysLeft > CLOSING_SOON_DAYS
      ? null
      : daysLeft === 0
        ? i18n._(msg({ message: "Closes today", context: "role card front: applications close today" }))
        : i18n._(msg({ message: plural(daysLeft, { one: "# day left", other: "# days left" }), context: "role card front: days left to apply" }));
  return {
    eyebrow: i18n._(msg({ message: "Apply by", context: "role card front: the apply-by stamp's top line, over the day and month" })),
    day: dayNum,
    month: short("month"),
    weekday: long("weekday"),
    // The short date never splits across lines: "Mon 30 Nov" is one piece on a narrow ribbon.
    line: i18n._(msg({ message: `Applications close ${whenKept}`, context: "role card front: the apply-by ribbon, a short date" })),
    label: i18n._(msg({ message: `Applications close ${whenLong}`, context: "role card front: the apply-by date said whole, for a screen reader" })),
    daysLeft,
    soon,
  };
}
