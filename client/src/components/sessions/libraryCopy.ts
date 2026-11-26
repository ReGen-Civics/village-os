/**
 * THE AGENDA LIBRARY'S WORDS, AND THE THREE AIMS, IN THE READER'S LANGUAGE (the Spanish crawl, 26 Nov 2026).
 *
 * shared/sessionLibrary.ts (LIBRARY_COPY, broughtFor) and shared/sessions.ts (AIM_DEFS) keep their English for
 * the server and the tests that read it. The pages draw THESE: the same names and the same shape, every word
 * read through Lingui when it is read, so a page changes only its import. A key borrowed from another table
 * (ROOM_COPY, SESSION_COPY) passes through as that table gives it.
 *
 * client/src/components/sessions/libraryCopy.test.ts holds every English line here to the shared tables, so the
 * two cannot drift.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it.
import { i18n as appI18n, setupI18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { LIBRARY_COPY as SHARED, } from "@shared/sessionLibrary";
import { AIM_DEFS as SHARED_AIMS, type ItemAim } from "@shared/sessions";
import { circleWords } from "@shared/sessionTasks";

/** Reads a descriptor's own English when no language has been started (a test, or a read before the app starts one). */
const ENGLISH = setupI18n({ locale: "en", messages: { en: {} } });
const say = (d: MessageDescriptor, values?: Record<string, unknown>): string => (appI18n.locale ? appI18n : ENGLISH)._({ ...d, values });

export const LIBRARY_MSG = {
  sectionTitle: msg({ message: "Agenda items", context: "the agenda library" }),
  sectionLede: msg({ message: "Add agenda items for future sessions. You can add anything: each session decides which topics to explore.", context: "the agenda library" }),
  bringButton: msg({ message: "Add an agenda item", context: "the agenda library: the button" }),
  formTitle: msg({ message: "Add an agenda item", context: "the agenda library: the form's heading" }),
  aimNotSure: msg({ message: "Not sure yet", context: "the agenda library: an item's aim" }),
  aimNotSureHint: msg({ message: "The room chooses the aim when it takes it up.", context: "the agenda library" }),
  noteLabel: msg({ message: "Anything the circle should know first?", context: "the agenda library" }),
  notePlaceholder: msg({ message: "Optional", context: "the agenda library: a note's placeholder" }),
  circleLabel: msg({ message: "Which circle is it for?", context: "the agenda library" }),
  circleChoose: msg({ message: "Choose a circle", context: "the agenda library" }),
  circleNeeded: msg({ message: "Choose a circle, or {noCircle}.", context: "the agenda library: {noCircle} is the words for no particular circle" }),
  seenHint: msg({ message: "Once a session takes it up, anyone who looks into that session can read it.", context: "the agenda library" }),
  adding: msg({ message: "Adding...", context: "the agenda library" }),
  saving: msg({ message: "Saving...", context: "the agenda library" }),
  savedFor: msg({ message: "Thanks. It's added for the {circle}.", context: "the agenda library: {circle} is the circle's name" }),
  savedAny: msg({ message: "Thanks. It's added for any circle.", context: "the agenda library" }),
  empty: msg({ message: "Nothing added yet.", context: "the agenda library" }),
  broughtBy: msg({ message: "Added by {name} · {date}", context: "the agenda library: who added an item, and when" }),
  broughtByName: msg({ message: "Added by {name}", context: "the agenda library: who added an item" }),
  broughtByYou: msg({ message: "Added by you · {date}", context: "the agenda library: the reader added this item, and when" }),
  changedBy: msg({ message: "Words changed by {name}", context: "the agenda library" }),
  takenUpLately: msg({ message: "Taken up lately", context: "the agenda library" }),
  withdraw: msg({ message: "Remove it", context: "the agenda library: take an item off" }),
  withdrawConfirm: msg({ message: "Remove this item? The circle won't see it anymore.", context: "the agenda library" }),
  withdrawOnAgenda: msg({ message: "Remove this item? It stays on the agenda it's on, and the circle won't see it here anymore.", context: "the agenda library" }),
  keep: msg({ message: "Keep it", context: "the agenda library: keep an item" }),
  withdrawYes: msg({ message: "Remove", context: "the agenda library: confirm taking an item off" }),
  withdrawing: msg({ message: "Removing...", context: "the agenda library" }),
  bringAgain: msg({ message: "Add it again", context: "the agenda library" }),
  startHint: msg({ message: "Choose what this session takes up. You can add more and reorder them in the room.", context: "the agenda library" }),
  startWithOne: msg({ message: "Open the room with 1 item", context: "the agenda library" }),
  startWithMany: msg({ message: "Open the room with {n} items", context: "the agenda library: {n} is 2 or more" }),
  showAll: msg({ message: "Show all", context: "the agenda library: open a long note" }),
  showLess: msg({ message: "Show less", context: "the agenda library: close a long note" }),
  loadFailed: msg({ message: "The agenda items didn't load. Try again in a moment.", context: "the agenda library" }),
  failed: msg({ message: "That did not go through. Try again in a moment.", context: "the agenda library" }),
  forCircle: msg({ message: "Agenda items for the {circle}", context: "the agenda library: {circle} is the circle's name" }),
  forAnyCircle: msg({ message: "Agenda items for any circle", context: "the agenda library" }),
} as const;

/** LIBRARY_COPY with the same keys, each word in the reader's language when it is read. */
export const LIBRARY_COPY = {
  get sectionTitle() { return say(LIBRARY_MSG.sectionTitle); },
  get sectionLede() { return say(LIBRARY_MSG.sectionLede); },
  get bringButton() { return say(LIBRARY_MSG.bringButton); },
  get formTitle() { return say(LIBRARY_MSG.formTitle); },
  titleLabel: SHARED.titleLabel,
  titlePlaceholder: SHARED.titlePlaceholder,
  aimLabel: SHARED.aimLabel,
  get aimNotSure() { return say(LIBRARY_MSG.aimNotSure); },
  get aimNotSureHint() { return say(LIBRARY_MSG.aimNotSureHint); },
  get noteLabel() { return say(LIBRARY_MSG.noteLabel); },
  get notePlaceholder() { return say(LIBRARY_MSG.notePlaceholder); },
  get circleLabel() { return say(LIBRARY_MSG.circleLabel); },
  get circleChoose() { return say(LIBRARY_MSG.circleChoose); },
  get circleNeeded() { return say(LIBRARY_MSG.circleNeeded, { noCircle: SHARED.noCircle }); },
  noCircle: SHARED.noCircle,
  get seenHint() { return say(LIBRARY_MSG.seenHint); },
  addButton: SHARED.addButton,
  get adding() { return say(LIBRARY_MSG.adding); },
  cancel: SHARED.cancel,
  edit: SHARED.edit,
  save: SHARED.save,
  get saving() { return say(LIBRARY_MSG.saving); },
  saved: (circleName: string | null): string => (circleName ? say(LIBRARY_MSG.savedFor, { circle: circleWords(circleName) }) : say(LIBRARY_MSG.savedAny)),
  get empty() { return say(LIBRARY_MSG.empty); },
  broughtBy: (name: string, date: string): string => say(LIBRARY_MSG.broughtBy, { name, date }),
  broughtByName: (name: string): string => say(LIBRARY_MSG.broughtByName, { name }),
  broughtByYou: (date: string): string => say(LIBRARY_MSG.broughtByYou, { date }),
  changedBy: (name: string): string => say(LIBRARY_MSG.changedBy, { name }),
  get takenUpLately() { return say(LIBRARY_MSG.takenUpLately); },
  get withdraw() { return say(LIBRARY_MSG.withdraw); },
  get withdrawConfirm() { return say(LIBRARY_MSG.withdrawConfirm); },
  get withdrawOnAgenda() { return say(LIBRARY_MSG.withdrawOnAgenda); },
  get keep() { return say(LIBRARY_MSG.keep); },
  get withdrawYes() { return say(LIBRARY_MSG.withdrawYes); },
  get withdrawing() { return say(LIBRARY_MSG.withdrawing); },
  get bringAgain() { return say(LIBRARY_MSG.bringAgain); },
  get startHint() { return say(LIBRARY_MSG.startHint); },
  startWith: (n: number): string => (n === 1 ? say(LIBRARY_MSG.startWithOne) : say(LIBRARY_MSG.startWithMany, { n })),
  roomNoCircle: SHARED.roomNoCircle,
  addToAgenda: SHARED.addToAgenda,
  get showAll() { return say(LIBRARY_MSG.showAll); },
  get showLess() { return say(LIBRARY_MSG.showLess); },
  get loadFailed() { return say(LIBRARY_MSG.loadFailed); },
  get failed() { return say(LIBRARY_MSG.failed); },
};

/** "Agenda items for the Garden circle", or "Agenda items for any circle", in the reader's language. */
export function broughtFor(circleName: string | null): string {
  return circleName ? say(LIBRARY_MSG.forCircle, { circle: circleWords(circleName) }) : say(LIBRARY_MSG.forAnyCircle);
}

export const AIM_MSG: Record<ItemAim, { label: MessageDescriptor; hint: MessageDescriptor }> = {
  report: {
    label: msg({ message: "Report", context: "an agenda item's aim" }),
    hint: msg({ message: "Share what is happening so everyone knows.", context: "an agenda item's aim: Report" }),
  },
  explore: {
    label: msg({ message: "Explore", context: "an agenda item's aim" }),
    hint: msg({ message: "Gather ideas and understanding, usually in a round.", context: "an agenda item's aim: Explore" }),
  },
  decide: {
    label: msg({ message: "Decide", context: "an agenda item's aim" }),
    hint: msg({ message: "Shape a proposal and decide it by consent.", context: "an agenda item's aim: Decide" }),
  },
};

/** AIM_DEFS with the same keys, each label and hint in the reader's language when it is read. */
export const AIM_DEFS = Object.fromEntries(
  (Object.keys(SHARED_AIMS) as ItemAim[]).map((aim) => [
    aim,
    {
      get label() { return say(AIM_MSG[aim].label); },
      get hint() { return say(AIM_MSG[aim].hint); },
    },
  ]),
) as Record<ItemAim, { label: string; hint: string }>;
