/**
 * A ROLE'S LIMIT IS ITS COMMITMENT (the lead, 20 Nov 2026): "The seating limit follows the role's total commitment,
 * not only its headcount." A role that needs 100% can hold three people at 30% each; a role of two places can hold
 * one person at 100% and nobody more.
 *
 * THE RULE THIS FILE HOLDS (`limitFor`)
 *   - The limit is the role's `commitmentTarget` (100 unless the role says otherwise, shared/commitmentRange.ts).
 *   - What is used is the sum of the commitments already given to it: the people holding it, and the people adopted
 *     for it who are not seated yet. Somebody whose commitment was never written down counts as one place's share,
 *     the target divided by the role's places, so a role whose holders gave no commitment fills exactly as it did
 *     when it was counted by places.
 *   - A newcomer who gave a commitment is held to the commitment limit, and the number of places no longer refuses
 *     them: it only got in the way (three people at 30% on a one-place role). A newcomer who gave none is counted by
 *     places, as before, because there is nothing else to count.
 *   - Going ABOVE the limit is a person's choice, never a silent one (the lead's addition). Whoever may already adopt
 *     on the proposal's page is asked "This is above the limit set for this role, continue anyway?", the server takes
 *     it only with the explicit flag, and the choice is stamped on the application (`OverLimitStamp`) and written to
 *     the audit through recordEvent. A stamp lets that one person be seated over the limit for that one role.
 *
 * Pure: no Node builtins, no clock.
 */
import { COMMITMENT_TARGET_DEFAULT } from "./commitmentRange";

export const OVER_LIMIT_WORDS = {
  /** The lead's exact words, 20 Nov 2026. */
  ask: "This is above the limit set for this role, continue anyway?",
  /** One role's numbers, beside the question. */
  role: (name: string, used: number, adding: number, target: number) =>
    `${name}: ${used}% is given already, this adds ${adding}%, and the role's limit is ${target}%.`,
  confirm: "Yes, continue above the limit",
} as const;

/** What the limit reads from a role. */
export interface RoleLimit {
  commitmentTarget?: number | null;
  seats: number;
}

export interface LimitRead {
  /** True when the newcomer is counted by places (they gave no commitment). */
  byPlaces: boolean;
  target: number;
  used: number;
  adding: number;
  after: number;
  over: boolean;
}

/** The role's limit in percent. */
export const targetOf = (r: RoleLimit): number => (typeof r.commitmentTarget === "number" && r.commitmentTarget > 0 ? r.commitmentTarget : COMMITMENT_TARGET_DEFAULT);

/** One place's share of the limit, for a commitment nobody wrote down. Whole, at least 1. */
export const placeShare = (r: RoleLimit): number => Math.max(1, Math.round(targetOf(r) / Math.max(1, r.seats)));

const known = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/**
 * Whether one more person fits the role. `holders` is the commitment of everyone already counted (null when they gave
 * none); `adding` is the newcomer's.
 */
export function limitFor(role: RoleLimit, holders: ReadonlyArray<number | null>, adding: number | null): LimitRead {
  const target = targetOf(role);
  if (!known(adding)) {
    const places = Math.max(0, role.seats);
    return { byPlaces: true, target: places, used: holders.length, adding: 1, after: holders.length + 1, over: holders.length + 1 > places };
  }
  const share = placeShare(role);
  const used = holders.reduce<number>((sum, h) => sum + (known(h) ? h : share), 0);
  const after = used + adding;
  return { byPlaces: false, target, used, adding, after, over: after > target };
}

/** A person's choice to go above one role's limit, kept on the application or proposal it was made for. */
export interface OverLimitStamp {
  roleId: string;
  by: string;
  at: string;
  used: number;
  adding: number;
  target: number;
}

/** The stamps as stored, read tolerantly: anything unreadable is left out. */
export function overLimitOf(raw: unknown): OverLimitStamp[] {
  if (!Array.isArray(raw)) return [];
  const out: OverLimitStamp[] = [];
  for (const s of raw.slice(0, 12)) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (typeof o.roleId !== "string" || !o.roleId || typeof o.by !== "string" || typeof o.at !== "string") continue;
    if (![o.used, o.adding, o.target].every(known)) continue;
    out.push({ roleId: o.roleId.slice(0, 64), by: o.by.slice(0, 64), at: o.at.slice(0, 40), used: o.used as number, adding: o.adding as number, target: o.target as number });
  }
  return out;
}

/** Whether a person chose to go above this role's limit. */
export const overridden = (stamps: readonly OverLimitStamp[], roleId: string): boolean => stamps.some((s) => s.roleId === roleId);

/** One role over its limit, as a decider's page and a refusal name it. */
export interface OverLimitRole {
  roleId: string;
  name: string;
  used: number;
  adding: number;
  target: number;
}

/** The audit line for one choice. Names the role and the numbers, never the person proposed. */
export const overLimitAudit = (ref: string, r: OverLimitRole): string =>
  `role-limit:over:${ref}:${r.roleId}: ${r.name} adopted above its limit (${r.used}% given, adding ${r.adding}%, limit ${r.target}%)`;
