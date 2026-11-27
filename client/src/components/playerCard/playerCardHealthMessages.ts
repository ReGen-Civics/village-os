/**
 * THE ROLE HEALTH AND HANDOVER MESSAGES, as the extractor reads them (the coordinator, 26 Nov 2026: the player card
 * follow-ups). The server says these lines from the plain copy in shared/playerCardHealthMessages.ts, because its
 * build runs no macro; this file is the same messages as `msg()` calls, so `lingui extract` puts them in the
 * catalogs and their Spanish lives in client/src/locales/es.d/esb-card-health.po. No page imports it: it costs the
 * bundle nothing. playerCardHealthMessages.test.ts holds the two copies to the same ids.
 */
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const CARD_HEALTH_MESSAGES = {
  withinTerm: msg({ message: "Within term, to {day}", context: "player card health, within term" }),
  termEnded: msg({ message: "Term ended {day}", context: "player card health, term ended" }),
  noTerm: msg({ message: "No term set", context: "player card health, no term" }),
  reviewDue: msg({ message: "Review due {day}", context: "player card health, review due" }),
  reviewPassed: msg({ message: "Review date passed {day}", context: "player card health, review date passed" }),
  noReview: msg({ message: "No review date set", context: "player card health, no review date" }),
  signsOnTrack: msg({ message: "Signs on track", context: "player card health, signs on track" }),
  someOnTrack: msg({ message: "{n} of {of} signs on track", context: "player card health, some signs on track" }),
  noTarget: msg({ message: "No target set", context: "player card health, no target" }),
  notCountedYet: msg({ message: "Not counted yet", context: "player card health, not counted yet" }),
  dotSteady: msg({ message: "Steady", context: "player card health, dot steady" }),
  dotLook: msg({ message: "Worth a look", context: "player card health, dot worth a look" }),
  dotAct: msg({ message: "Needs attention", context: "player card health, dot needs attention" }),
  handover: msg({ message: "Ready to hand over", context: "player card health, ready to hand over" }),
  readyOf: msg({ message: "{n} of {of} ready", context: "player card health, n of m ready" }),
  card: msg({ message: "Card complete", context: "player card health, card complete" }),
  partsWritten: msg({ message: "{n} of {of} parts written: {missing} missing", context: "player card health, parts written, some missing" }),
  partsAll: msg({ message: "All {of} parts written", context: "player card health, all parts written" }),
  runbook: msg({ message: "Runbook", context: "player card health, runbook" }),
  decisions: msg({ message: "Decisions recorded in the circle, last 3 moons", context: "player card health, decisions recorded" }),
  decisionsN: msg({ message: "{n, plural, one {# decision recorded} other {# decisions recorded}}", context: "player card health, n decisions recorded" }),
  noCircle: msg({ message: "The role sits in no circle", context: "player card health, no circle" }),
  stepIn: msg({ message: "Someone ready to step in", context: "player card health, someone ready to step in" }),
  secondHolder: msg({ message: "A second holder holds it too", context: "player card health, a second holder" }),
  covered: msg({ message: "A deputy or successor is written down", context: "player card health, deputy or successor written" }),
  nobodyYet: msg({ message: "Nobody named yet", context: "player card health, nobody named yet" }),
  purposeLabel: msg({ message: "Purpose", context: "player card health, handover check purpose" }),
  purposeDone: msg({ message: "Purpose written", context: "player card health, handover check purpose written" }),
  purposeMissing: msg({ message: "No purpose written yet", context: "player card health, handover check no purpose" }),
  decideLabel: msg({ message: "What it looks after", context: "player card health, handover check what it looks after" }),
  decideDone: msg({ message: "What it looks after is written", context: "player card health, handover check what it looks after written" }),
  decideMissing: msg({ message: "What it looks after is not written yet", context: "player card health, handover check what it looks after missing" }),
  countOnMeLabel: msg({ message: "What people can count on it for", context: "player card health, handover check count on it" }),
  countOnMeDone: msg({ message: "What people can count on it for is written", context: "player card health, handover check count on it written" }),
  countOnMeMissing: msg({ message: "What people can count on it for is not written yet", context: "player card health, handover check count on it missing" }),
  bringMeLabel: msg({ message: "Bring me", context: "player card health, handover check bring me" }),
  bringMeDone: msg({ message: "Bring me is written", context: "player card health, handover check bring me written" }),
  bringMeMissing: msg({ message: "Bring me is not written yet", context: "player card health, handover check bring me missing" }),
  notMineLabel: msg({ message: "Not mine to hold", context: "player card health, handover check not mine" }),
  notMineDone: msg({ message: "Not mine to hold is written", context: "player card health, handover check not mine written" }),
  notMineMissing: msg({ message: "Not mine to hold is not written yet", context: "player card health, handover check not mine missing" }),
  runbookLabel: msg({ message: "Runbook", context: "player card health, handover check runbook" }),
  runbookDone: msg({ message: "Runbook written", context: "player card health, handover check runbook written" }),
  runbookMissing: msg({ message: "No runbook written yet", context: "player card health, handover check no runbook" }),
} satisfies Record<string, MessageDescriptor>;
