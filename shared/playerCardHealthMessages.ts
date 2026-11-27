/**
 * THE ROLE HEALTH AND HANDOVER WORDS AS MESSAGES, for the server to say the player card in the reader's language
 * (the coordinator, 26 Nov 2026: the player card follow-ups, server-side).
 *
 * Each entry is the ICU message and context of one line in shared/playerCardHealth.ts (HEALTH_WORDS) or
 * shared/roleHandover.ts (HANDOVER_CHECK_WORDS). The server says them by the same hashed id the client macro gives
 * each message, from the one catalog every page reads (client/src/locales/es.d/esb-card-health.po). Plain objects,
 * because the server build runs no macro; the extraction source is
 * client/src/components/playerCard/playerCardHealthMessages.ts, and its test holds the two copies to the same ids.
 */
import type { HEALTH_WORDS } from "./playerCardHealth";
import type { HANDOVER_CHECK_WORDS } from "./roleHandover";

export interface HealthMessage {
  message: string;
  context: string;
}

const m = (message: string, context: string): HealthMessage => ({ message, context: `player card health, ${context}` });

export const HEALTH_MESSAGES = {
  withinTerm: m("Within term, to {day}", "within term"),
  termEnded: m("Term ended {day}", "term ended"),
  noTerm: m("No term set", "no term"),
  reviewDue: m("Review due {day}", "review due"),
  reviewPassed: m("Review date passed {day}", "review date passed"),
  noReview: m("No review date set", "no review date"),
  signsOnTrack: m("Signs on track", "signs on track"),
  someOnTrack: m("{n} of {of} signs on track", "some signs on track"),
  noTarget: m("No target set", "no target"),
  notCountedYet: m("Not counted yet", "not counted yet"),
  dotSteady: m("Steady", "dot steady"),
  dotLook: m("Worth a look", "dot worth a look"),
  dotAct: m("Needs attention", "dot needs attention"),
  handover: m("Ready to hand over", "ready to hand over"),
  readyOf: m("{n} of {of} ready", "n of m ready"),
  card: m("Card complete", "card complete"),
  partsWritten: m("{n} of {of} parts written: {missing} missing", "parts written, some missing"),
  partsAll: m("All {of} parts written", "all parts written"),
  runbook: m("Runbook", "runbook"),
  decisions: m("Decisions recorded in the circle, last 3 moons", "decisions recorded"),
  decisionsN: m("{n, plural, one {# decision recorded} other {# decisions recorded}}", "n decisions recorded"),
  noCircle: m("The role sits in no circle", "no circle"),
  stepIn: m("Someone ready to step in", "someone ready to step in"),
  secondHolder: m("A second holder holds it too", "a second holder"),
  covered: m("A deputy or successor is written down", "deputy or successor written"),
  nobodyYet: m("Nobody named yet", "nobody named yet"),
  purposeLabel: m("Purpose", "handover check purpose"),
  purposeDone: m("Purpose written", "handover check purpose written"),
  purposeMissing: m("No purpose written yet", "handover check no purpose"),
  decideLabel: m("What it looks after", "handover check what it looks after"),
  decideDone: m("What it looks after is written", "handover check what it looks after written"),
  decideMissing: m("What it looks after is not written yet", "handover check what it looks after missing"),
  countOnMeLabel: m("What people can count on it for", "handover check count on it"),
  countOnMeDone: m("What people can count on it for is written", "handover check count on it written"),
  countOnMeMissing: m("What people can count on it for is not written yet", "handover check count on it missing"),
  bringMeLabel: m("Bring me", "handover check bring me"),
  bringMeDone: m("Bring me is written", "handover check bring me written"),
  bringMeMissing: m("Bring me is not written yet", "handover check bring me missing"),
  notMineLabel: m("Not mine to hold", "handover check not mine"),
  notMineDone: m("Not mine to hold is written", "handover check not mine written"),
  notMineMissing: m("Not mine to hold is not written yet", "handover check not mine missing"),
  runbookLabel: m("Runbook", "handover check runbook"),
  runbookDone: m("Runbook written", "handover check runbook written"),
  runbookMissing: m("No runbook written yet", "handover check no runbook"),
} as const satisfies Record<string, HealthMessage>;

export type HealthMessageKey = keyof typeof HEALTH_MESSAGES;

/** One message in the reader's language. Throws when the language has none. */
export type HealthSay = (key: HealthMessageKey, values?: Record<string, unknown>) => string;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends (...a: infer A) => unknown ? (...a: A) => string : Widen<T[K]> };

/** The health words in the reader's language, shaped as the English. Each entry is read only when used. */
export interface HealthWordsIn {
  health: Widen<typeof HEALTH_WORDS>;
  handover: Widen<typeof HANDOVER_CHECK_WORDS>;
}

export function healthWordsWith(s: HealthSay): HealthWordsIn {
  const check = (k: "purpose" | "decide" | "countOnMe" | "bringMe" | "notMine" | "runbook") => ({
    get label() {
      return s(`${k}Label` as HealthMessageKey);
    },
    get done() {
      return s(`${k}Done` as HealthMessageKey);
    },
    get missing() {
      return s(`${k}Missing` as HealthMessageKey);
    },
  });
  return {
    health: {
      withinTerm: (day: string) => s("withinTerm", { day }),
      termEnded: (day: string) => s("termEnded", { day }),
      get noTerm() {
        return s("noTerm");
      },
      reviewDue: (day: string) => s("reviewDue", { day }),
      reviewPassed: (day: string) => s("reviewPassed", { day }),
      get noReview() {
        return s("noReview");
      },
      get signsOnTrack() {
        return s("signsOnTrack");
      },
      someOnTrack: (n: number, of: number) => s("someOnTrack", { n, of }),
      get noTarget() {
        return s("noTarget");
      },
      get notCountedYet() {
        return s("notCountedYet");
      },
      dot: {
        get steady() {
          return s("dotSteady");
        },
        get look() {
          return s("dotLook");
        },
        get act() {
          return s("dotAct");
        },
      },
      get handover() {
        return s("handover");
      },
      readyOf: (n: number, of: number) => s("readyOf", { n, of }),
      get card() {
        return s("card");
      },
      partsWritten: (n: number, of: number, missing: string) => (missing ? s("partsWritten", { n, of, missing }) : s("partsAll", { of })),
      get runbook() {
        return s("runbook");
      },
      get decisions() {
        return s("decisions");
      },
      decisionsN: (n: number) => s("decisionsN", { n }),
      get noCircle() {
        return s("noCircle");
      },
      get stepIn() {
        return s("stepIn");
      },
      get secondHolder() {
        return s("secondHolder");
      },
      get covered() {
        return s("covered");
      },
      get nobodyYet() {
        return s("nobodyYet");
      },
    } as HealthWordsIn["health"],
    handover: {
      purpose: check("purpose"),
      decide: check("decide"),
      countOnMe: check("countOnMe"),
      bringMe: check("bringMe"),
      notMine: check("notMine"),
      runbook: check("runbook"),
    },
  };
}
