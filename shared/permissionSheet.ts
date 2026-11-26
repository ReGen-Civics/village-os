/**
 * THE PERMISSION FACE: a role from `/api/roles`, the kind a vote seats somebody
 * into, drawn with the seat card's parts.
 *
 * A permission role has no aim and no domain. What it has is real: the powers
 * it carries (named by `CAPABILITY_LABELS`, never by their keys), the rung it
 * asks for (which the vote enforces at open and again at close), its places
 * and who sits in them. So this face prints those and nothing a role-seat
 * ballot cannot back up. The roster is the seat card's own, and an open place
 * here is filled by a vote.
 *
 * Pure and node-tested, beside `shared/roleSheet.ts`.
 */
import { CAPABILITY_LABELS } from "./capabilities";
import { nameScaleFor, rosterFor, textOrNull, type SheetFigure, type Spot } from "./roleSheet";
import { ROLE_SHEET_WORDS, type RoleSheetWords } from "./roleSheetWords";

/** A permission role as `/api/roles` serves it. */
export interface RoleInput {
  id: string;
  name: string;
  description: string | null;
  capabilities: string[];
  minStage: string | null;
  isExample: boolean;
  seats: number;
  holderCount: number;
  holders: Array<{ name: string | null; userId?: string | null }>;
  namesServed: boolean;
  signedIn: boolean;
}

export type RungLook = "plain" | "inverted" | "lit";

export interface Rung {
  id: string;
  name: string;
  look: RungLook;
  current: boolean;
  srWords: string;
}

export interface PermissionSheetView {
  id: string;
  name: string;
  nameScale: "lg" | "md" | "sm";
  isExample: boolean;
  eyebrow: string;
  whatItDoes: string;
  whatItDoesWritten: boolean;
  figures: SheetFigure[];
  spots: Spot[];
  moreOpen: number;
  moreOpenLine: string | null;
  rosterNote: string | null;
  powers: string[];
  /** Null when there is no ladder to draw: no rung asked, an unknown rung, or stages unread. */
  rungs: Rung[] | null;
  rungLine: string;
}

/** A power's label, never its raw key. */
export function powerLabel(key: string, w: RoleSheetWords = ROLE_SHEET_WORDS): string {
  return Object.prototype.hasOwnProperty.call(CAPABILITY_LABELS, key)
    ? CAPABILITY_LABELS[key as keyof typeof CAPABILITY_LABELS]
    : w.words.unknownPower;
}

export function permissionSheet(
  input: RoleInput,
  ctx: {
    stages: Array<{ id: string; name: string }> | null;
    roleWord: string;
    now: Date;
    /** The card's words in the reader's language; absent = the English original. */
    words?: RoleSheetWords;
  },
): PermissionSheetView {
  const w = ctx.words ?? ROLE_SHEET_WORDS;
  const W = w.words;
  const l = w.lines;
  const hc = input.holderCount;
  const open = Math.max(0, input.seats - hc);
  const roster = rosterFor(
    input.holders.map((h) => ({ name: h.name, userId: h.userId ?? null })),
    hc,
    input.seats,
    { now: ctx.now, forming: false, openSub: () => W.aVoteFillsThis, words: w },
  );
  const figures: SheetFigure[] = [
    { key: "places", label: l.places(input.seats), value: input.seats, tone: null, source: "seats" },
    // `holderCount` here counts rows whose term has passed, so it is never "Held now".
    { key: "seated", label: l.taken, value: hc, tone: hc > 0 ? "gold" : null, source: "holderCount" },
    { key: "open", label: l.openPlaces(open), value: open, tone: open > 0 ? "living" : null, source: "seats - holderCount" },
    { key: "powers", label: l.powers(input.capabilities.length), value: input.capabilities.length, tone: null, source: "capabilities.length" },
  ];

  let rungs: Rung[] | null = null;
  let line: string;
  if (!input.minStage) {
    line = W.noRung;
  } else if (!ctx.stages) {
    line = w.rungLine(input.minStage);
  } else {
    const at = ctx.stages.findIndex((s) => s.id === input.minStage);
    if (at < 0) {
      line = W.unknownRung;
    } else {
      line = w.rungLine(ctx.stages[at].name);
      rungs = ctx.stages.map((s, i) =>
        i < at
          ? { id: s.id, name: s.name, look: "plain" as const, current: false, srWords: l.srBelowRung }
          : i === at
            ? { id: s.id, name: s.name, look: "inverted" as const, current: true, srWords: l.srAtRung }
            : { id: s.id, name: s.name, look: "lit" as const, current: false, srWords: l.srAlsoQualifies },
      );
    }
  }

  const word = ctx.roleWord.trim().toLowerCase() || "role";
  const description = textOrNull(input.description);
  return {
    id: input.id,
    name: input.name,
    nameScale: nameScaleFor(input.name),
    isExample: input.isExample,
    eyebrow: l.withPowers(word),
    whatItDoes: description ?? W.roleUnwritten,
    whatItDoesWritten: !!description,
    figures,
    spots: roster.spots,
    moreOpen: roster.moreOpen,
    moreOpenLine: roster.moreOpen > 0 ? w.moreOpenLine(roster.moreOpen) : null,
    rosterNote:
      !input.namesServed && hc > 0 ? (input.signedIn ? W.namesNotShared : W.signInToSeeNames) : null,
    powers: input.capabilities.map((k) => powerLabel(k, w)),
    rungs,
    rungLine: line,
  };
}
