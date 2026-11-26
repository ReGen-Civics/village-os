/**
 * THE GOVERNANCE PAGE'S "NOW" (the Governance brief v3, build step 2; the lead approved it on 26 Nov 2026).
 *
 * What a member reads first on the Governance page: what waits for their voice, what closes soon, what they brought,
 * and their voice itself (how their vote is weighed, and what they can and cannot do yet). Built ONLY from allowlisted
 * projections: the items are the community projection's (shared/communityReview.ts, exactly `COMMUNITY_ITEM_FIELDS`),
 * and the voice carries exactly `NOW_VOICE_FIELDS` and, per right, `NOW_RIGHT_FIELDS`. Nothing of a source row is
 * spread in, so a field a queue adds later never reaches a member by accident.
 *
 * Presentation lives in the client and reads only this shape, so a later visual layer can restyle the page without
 * touching data or gates (the coordinator, 26 Nov 2026).
 */
import type { CommunityAnswer, CommunityItem } from "./communityReview";

/** Closing soon: the same 48 hours as the ballot reminder (`ballot-watch`). */
export const CLOSING_SOON_MS = 48 * 3_600_000;

/** The rights the voice panel names, each read from the one gate's catalogue as the person. */
export const NOW_RIGHTS = ["ballot.vote", "mechanics.propose", "proposal.open"] as const;
export type NowRight = (typeof NOW_RIGHTS)[number];

export const NOW_VOICE_FIELDS = ["mode", "weighedBy", "rights"] as const;
export const NOW_RIGHT_FIELDS = ["right", "held", "opensAt"] as const;

export interface NowVoice {
  /** How the village weighs a vote: one person one vote, by a token's balance, or by a set table. */
  mode: "equal" | "token" | "custom";
  /** The token a vote is weighed by, only when the village weighs by one (the lead, 26 Nov 2026: answer 1). */
  weighedBy: string | null;
  rights: { right: NowRight; held: boolean; opensAt: string | null }[];
}

export interface NowAnswer {
  /** Open for your voice, and what waits on a role you hold, soonest to close first. */
  waiting: CommunityItem[];
  /** The part of `waiting` that closes within 48 hours. */
  closingSoon: CommunityItem[];
  /** What you brought, and where each stands. */
  yours: CommunityItem[];
  voice: NowVoice;
  reads: CommunityAnswer["reads"];
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
/** A stage id the page names: lowercase letters, digits and hyphens, bounded. Anything else is dropped. */
const stageId = (v: unknown): string | null => (typeof v === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(v) ? v : null);

/** The voice, from the weight mode and the person's own capability catalogue (`GET /api/game/progression`). */
export function nowVoice(weight: { mode: string; token: string | null }, catalogue: unknown): NowVoice {
  const mode: NowVoice["mode"] = weight.mode === "token" || weight.mode === "custom" ? weight.mode : "equal";
  const rows = new Map<string, Record<string, unknown>>();
  for (const x of Array.isArray(catalogue) ? catalogue : []) {
    const r = obj(x);
    if (r && typeof r.key === "string") rows.set(r.key, r);
  }
  return {
    mode,
    weighedBy: mode === "token" && typeof weight.token === "string" && /^[a-z0-9_-]{1,40}$/.test(weight.token) ? weight.token : null,
    rights: NOW_RIGHTS.map((right) => {
      const r = rows.get(right);
      const opens = obj(r?.opens);
      return { right, held: r?.held === true, opensAt: r?.held === true ? null : opens?.via === "stage" ? stageId(opens.stage) : null };
    }),
  };
}

const closes = (it: CommunityItem) => (it.closesAt ? Date.parse(it.closesAt) : Number.POSITIVE_INFINITY);

/** Now, from the community answer and the voice. Waiting is ordered soonest to close first; undated ones last. */
export function governanceNow(community: CommunityAnswer, voice: NowVoice, now: Date): NowAnswer {
  const waiting = [...community.open, ...community.waiting].sort((a, b) => closes(a) - closes(b));
  const until = now.getTime() + CLOSING_SOON_MS;
  return {
    waiting,
    closingSoon: waiting.filter((it) => it.closesAt && Date.parse(it.closesAt) >= now.getTime() && Date.parse(it.closesAt) <= until),
    yours: community.yours,
    voice,
    reads: community.reads,
  };
}
