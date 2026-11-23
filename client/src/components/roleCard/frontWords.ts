/**
 * THE CLOSED CARD'S FRONT LINES (the lead, 23 Nov 2026): what a reader sees of a role before "Read the card".
 *
 *   - the role's kind and its pay mix, never an amount: "Open paid role · 60% cash, 40% Amora tokens", or
 *     "Volunteer role". A venture says nothing new here.
 *   - the last day to apply, when the card names one (`sections.applyBy`): "Apply by Mon 30 Nov".
 *   - an upcoming role is a paid role unless its track says otherwise: every upcoming role will be paid.
 *
 * The mix names only the shares above zero, read from the card's own shape or the village's default (`cardPay`),
 * with the village's own token names (useShareNames). A shape whose labels read as no share is said as written.
 */
// A value import of the runtime, as cardWordsT.ts has, so precompileEnglish compiles these messages.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
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

/** "60% cash, 40% Amora tokens": the shares above zero, or "Compensation in cash and tokens" with no shape to read. */
export function payMixWords(i18n: I18n, shape: readonly PayShare[], names: ShareNames): string {
  const parts = partsOfShape(shape, { equity: [names.equity, names.equityShort], credits: names.credits });
  const said: string[] = [];
  if (parts) {
    const { cash, equity, credits } = parts;
    if (cash > 0) said.push(i18n._(msg({ message: `${cash}% cash`, context: "role card front: the cash share of the pay mix" })));
    const token = names.equityShort;
    if (equity > 0) said.push(i18n._(msg({ message: `${equity}% ${token}`, context: "role card front: a token share of the pay mix" })));
    const usage = names.credits;
    if (credits > 0) said.push(i18n._(msg({ message: `${credits}% ${usage}`, context: "role card front: a token share of the pay mix" })));
  } else {
    for (const s of shape) {
      if (s.pct <= 0) continue;
      const pct = s.pct;
      const label = shareLabelFor(s.label, names);
      said.push(i18n._(msg({ message: `${pct}% ${label}`, context: "role card front: a share of the pay mix as the card names it" })));
    }
  }
  return said.length ? said.join(", ") : i18n._(msg({ message: "Compensation in cash and tokens", context: "role card front: the pay mix when the card names no shares" }));
}

/** The front's kind line: "Open paid role · 60% cash, 40% Amora tokens", "Volunteer role", or null. */
export function frontKindLine(i18n: I18n, kind: FrontKind | null, shape: readonly PayShare[], names: ShareNames): string | null {
  if (kind === "volunteer") return i18n._(msg({ message: "Volunteer role", context: "role card front: the role's kind" }));
  if (kind !== "paid") return null;
  const mix = payMixWords(i18n, shape, names);
  return i18n._(msg({ message: `Open paid role · ${mix}`, context: "role card front: the role's kind, then its pay mix" }));
}

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
