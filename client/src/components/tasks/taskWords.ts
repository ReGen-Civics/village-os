/**
 * THE TASK BOARD'S WORDS IN THE READER'S LANGUAGE: the mirror of `TASK_COPY` (shared/sessionTasks.ts).
 *
 * The shared table stays English for the server, which writes the task emails from it. Everything the board,
 * the bell's task buttons, the answer sheet, the profile card and Live Sessions' task lines draw comes from here
 * instead, through `useTaskWords()` in a component and `taskWords()` in a helper. Typed off the shared table, so
 * a key added there and not here fails the compiler; taskWords.test.ts holds the English equal.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import { roleWithHolders } from "@shared/roleHolderLabel";
import type { TASK_COPY } from "@shared/sessionTasks";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

export type TaskWords = Drawn<typeof TASK_COPY>;

export const TASK_MIRROR: WordMirror<typeof TASK_COPY> = {
  heading: msg({ message: "Your task board", context: "task board: heading" }),
  lede: msg({ message: "What you took on in your circles' calls, and what your roles hold.", context: "task board: lede" }),
  groups: {
    holding: msg({ message: "Holding", context: "task board: groups.holding" }),
    seatsHold: msg({ message: "Your roles hold", context: "task board: groups.seatsHold" }),
    circleBack: msg({ message: "Back with your circles", context: "task board: groups.circleBack" }),
    finished: msg({ message: "Finished", context: "task board: groups.finished" }),
    earlier: msg({ message: "Earlier", context: "task board: groups.earlier" }),
  },
  circleBackHint: msg({ message: "Nobody holds these yet. Anyone in the circle can take one.", context: "task board: circleBackHint" }),
  empty: msg({ message: "Nothing in your hands right now. Tasks you take on in a live session land here.", context: "task board: empty" }),
  loadFailed: msg({ message: "The task board did not load.", context: "task board: loadFailed" }),
  retry: msg({ message: "Try again", context: "task board: retry" }),
  from: (circle, date) => {
    const name = circle.trim();
    return /\bcircle$/i.test(name)
      ? msg({ message: `From the ${name} · ${date}`, context: "task board: from, a circle named with its own word" })
      : msg({ message: `From the ${name} circle · ${date}`, context: "task board: from" });
  },
  fromNoCircle: (sessionTitle, date) => msg({ message: `From ${sessionTitle} · ${date}`, context: "task board: fromNoCircle" }),
  heldYou: msg({ message: "Held by you", context: "task board: heldYou" }),
  heldPerson: (name) => msg({ message: `Held by ${name}`, context: "task board: heldPerson" }),
  heldSeat: (seat, names) => {
    const role = roleWithHolders(seat, names);
    return msg({ message: `Held by ${role}`, context: "task board: heldSeat, the role then its holders' first names" });
  },
  heldSeatVacant: (seat) => msg({ message: `Held by ${seat} · nobody sits there yet`, context: "task board: heldSeatVacant" }),
  heldCircle: msg({ message: "Back with the circle", context: "task board: heldCircle" }),
  seatUnnamed: msg({ message: "A role", context: "task board: seatUnnamed" }),
  due: (date) => msg({ message: `By ${date}`, context: "task board: due" }),
  noDate: msg({ message: "No date", context: "task board: noDate" }),
  duePassed: (date) => msg({ message: `The date was ${date}. Done, not yet, or let go?`, context: "task board: duePassed" }),
  duePast: (date) => msg({ message: `The date was ${date}`, context: "task board: duePast" }),
  latest: (note) => msg({ message: `Latest: "${note}"`, context: "task board: latest" }),
  latestByFacilitator: (note) => msg({ message: `Latest: "${note}" (noted by the facilitator)`, context: "task board: latestByFacilitator" }),
  statusLabels: {
    open: msg({ message: "Holding", context: "task board: statusLabels.open" }),
    done: msg({ message: "Done", context: "task board: statusLabels.done" }),
    let_go: msg({ message: "Let go", context: "task board: statusLabels.let_go" }),
    circle: msg({ message: "Back with the circle", context: "task board: statusLabels.circle" }),
    newDate: msg({ message: "Holding, new date", context: "task board: statusLabels.newDate" }),
    accepted: msg({ message: "Accomplished", context: "task board: statusLabels.accepted" }),
  },
  acceptedOn: (date) => msg({ message: `Accepted on ${date}`, context: "task board: acceptedOn" }),
  waitingToBeAccepted: msg({ message: "Waiting to be accepted", context: "task board: waitingToBeAccepted" }),
  newDate: (date) => msg({ message: `New date: ${date}`, context: "task board: newDate" }),
  inSessionNow: msg({ message: "In a session now. Answer it in the room.", context: "task board: inSessionNow" }),
  buttons: {
    done: msg({ message: "It's done", context: "task board: buttons.done" }),
    not_yet: msg({ message: "Not yet", context: "task board: buttons.not_yet" }),
    let_go: msg({ message: "Let go", context: "task board: buttons.let_go" }),
    handed_back: msg({ message: "Hand it back", context: "task board: buttons.handed_back" }),
    reopened: msg({ message: "Open it again", context: "task board: buttons.reopened" }),
    taken: msg({ message: "I'll take it", context: "task board: buttons.taken" }),
    accepted: msg({ message: "Accept as accomplished", context: "task board: buttons.accepted" }),
    record: msg({ message: "Open the record", context: "task board: buttons.record" }),
  },
  sheets: {
    done: {
      lede: null,
      notePrompt: msg({ message: "What came of it? One line the circle will hear.", context: "task board: sheets.done.notePrompt" }),
      noteRequired: false,
      hint: null,
      datePrompt: null,
      confirm: msg({ message: "Mark it done", context: "task board: sheets.done.confirm" }),
      toast: msg({ message: "Beautiful work. The circle sees it at the next action check.", context: "task board: sheets.done.toast" }),
    },
    not_yet: {
      lede: null,
      notePrompt: msg({ message: "Anything the circle should know?", context: "task board: sheets.not_yet.notePrompt" }),
      noteRequired: false,
      hint: null,
      datePrompt: msg({ message: "When, then?", context: "task board: sheets.not_yet.datePrompt" }),
      confirm: msg({ message: "Move the date", context: "task board: sheets.not_yet.confirm" }),
      toast: msg({ message: "New date set. Nobody needs a reason.", context: "task board: sheets.not_yet.toast" }),
    },
    let_go: {
      lede: null,
      notePrompt: msg({ message: "Say why, in one sentence.", context: "task board: sheets.let_go.notePrompt" }),
      noteRequired: true,
      hint: msg({ message: "Letting go is a real answer. It frees the circle to choose again.", context: "task board: sheets.let_go.hint" }),
      datePrompt: null,
      confirm: msg({ message: "Let it go", context: "task board: sheets.let_go.confirm" }),
      toast: msg({ message: "Let go. The circle hears your sentence at the next action check.", context: "task board: sheets.let_go.toast" }),
    },
    handed_back: {
      lede: msg({ message: "It goes back to the circle and shows in the next action check as needing someone.", context: "task board: sheets.handed_back.lede" }),
      notePrompt: msg({ message: "Anything the circle should know?", context: "task board: sheets.handed_back.notePrompt" }),
      noteRequired: false,
      hint: null,
      datePrompt: null,
      confirm: msg({ message: "Hand it back", context: "task board: sheets.handed_back.confirm" }),
      toast: msg({ message: "Handed back. Thank you for holding it this far.", context: "task board: sheets.handed_back.toast" }),
    },
    taken: {
      lede: null,
      notePrompt: null,
      noteRequired: false,
      hint: null,
      datePrompt: null,
      confirm: msg({ message: "I'll take it", context: "task board: sheets.taken.confirm" }),
      toast: msg({ message: "It's yours now.", context: "task board: sheets.taken.toast" }),
    },
    reopened: {
      lede: null,
      notePrompt: null,
      noteRequired: false,
      hint: null,
      datePrompt: null,
      confirm: msg({ message: "Open it again", context: "task board: sheets.reopened.confirm" }),
      toast: msg({ message: "Open again.", context: "task board: sheets.reopened.toast" }),
    },
    accepted: {
      lede: msg({ message: "It moves to Accomplished on the player card of whoever did it.", context: "task board: sheets.accepted.lede" }),
      notePrompt: msg({ message: "A word about the work, if you like.", context: "task board: sheets.accepted.notePrompt" }),
      noteRequired: false,
      hint: msg({ message: "Leave out bank and card numbers.", context: "task board: sheets.accepted.hint" }),
      datePrompt: null,
      confirm: msg({ message: "Accept as accomplished", context: "task board: sheets.accepted.confirm" }),
      toast: msg({ message: "Accepted as accomplished.", context: "task board: sheets.accepted.toast" }),
    },
  },
  dateChips: {
    thisFriday: msg({ message: "This Friday", context: "task board: dateChips.thisFriday" }),
    nextWeek: msg({ message: "Next week", context: "task board: dateChips.nextWeek" }),
    nextNewMoon: msg({ message: "Next new moon", context: "task board: dateChips.nextNewMoon" }),
    nextFullMoon: msg({ message: "Next full moon", context: "task board: dateChips.nextFullMoon" }),
  },
  datePick: msg({ message: "Or pick a date", context: "task board: datePick" }),
  cancel: msg({ message: "Not now", context: "task board: cancel" }),
  checkCue: msg({ message: "Read what got done first. Then the tasks back with the circle.", context: "task board: checkCue" }),
  checkGroups: {
    doneSince: msg({ message: "Done since last time", context: "task board: checkGroups.doneSince" }),
    backWithCircle: msg({ message: "Back with the circle", context: "task board: checkGroups.backWithCircle" }),
    newDates: msg({ message: "New dates", context: "task board: checkGroups.newDates" }),
    letGo: msg({ message: "Let go", context: "task board: checkGroups.letGo" }),
    stillHolding: msg({ message: "Still holding", context: "task board: checkGroups.stillHolding" }),
  },
  doneSince: (n) => msg({ message: `${n} done since last time`, context: "task board: doneSince" }),
  mail: {
    button: msg({ message: "Send the task emails", context: "task board: mail.button" }),
    sending: msg({ message: "Sending", context: "task board: mail.sending" }),
    confirm: msg({ message: "Everyone holding an open task from this session gets an email with their tasks. Send now?", context: "task board: mail.confirm" }),
    confirmButton: msg({ message: "Send them", context: "task board: mail.confirmButton" }),
    cancel: msg({ message: "Not now", context: "task board: mail.cancel" }),
    result: (queued, people, skips) => [
      msg({ message: `Sent to ${queued} of ${people} people.`, context: "task board: mail.result" }),
      skips.setup > 0 && msg({ message: ` The village's email is not set up yet, so ${skips.setup} could not go out.`, context: "task board: mail.result, setup" }),
      skips.members > 0 && msg({ message: ` ${skips.members} have task emails turned off or have no email on file.`, context: "task board: mail.result, members" }),
      skips.other > 0 && msg({ message: ` ${skips.other} did not go out.`, context: "task board: mail.result, other" }),
    ],
    lastSent: (when, name) => msg({ message: `Last sent ${when} by ${name}`, context: "task board: mail.lastSent" }),
    sentAtClose: msg({ message: "Sent when the session closed", context: "task board: mail.sentAtClose" }),
    lastTried: (when, name) => msg({ message: `Tried ${when} by ${name}. No email went out.`, context: "task board: mail.lastTried" }),
    triedAtClose: msg({ message: "Tried when the session closed. No email went out.", context: "task board: mail.triedAtClose" }),
  },
  menu: {
    label: msg({ message: "My tasks", context: "task board: menu.label" }),
    waiting: (n) => msg({ message: plural(n, { one: "# task waits on you", other: "# tasks wait on you" }), context: "task board: menu.waiting" }),
  },
  waitingCard: {
    heading: msg({ message: "Your tasks", context: "task board: waitingCard.heading" }),
    count: (n) => msg({ message: plural(n, { one: "One task waits on you.", other: "# tasks wait on you." }), context: "task board: waitingCard.count" }),
    nextDue: (date) => msg({ message: `The nearest date is ${date}.`, context: "task board: waitingCard.nextDue" }),
    nextDuePassed: (date) => msg({ message: `The earliest date was ${date}.`, context: "task board: waitingCard.nextDuePassed" }),
    noDate: msg({ message: "None of them has a date yet.", context: "task board: waitingCard.noDate" }),
    button: msg({ message: "Open my task board", context: "task board: waitingCard.button" }),
  },
  bell: {
    done: msg({ message: "It's done", context: "task board: bell.done" }),
    open: msg({ message: "Open", context: "task board: bell.open" }),
    doneLabel: (what) => msg({ message: `It's done: ${what}`, context: "task board: bell.doneLabel" }),
    openLabel: (what) => msg({ message: `Open it on your task board: ${what}`, context: "task board: bell.openLabel" }),
    working: msg({ message: "Saving", context: "task board: bell.working" }),
    marked: msg({ message: "Beautiful work. The circle sees it at the next action check.", context: "task board: bell.marked" }),
    undo: msg({ message: "Open it again", context: "task board: bell.undo" }),
    undoLabel: (what) => msg({ message: `Open it again: ${what}`, context: "task board: bell.undoLabel" }),
    reopened: msg({ message: "Open again. It is back on your task board.", context: "task board: bell.reopened" }),
    failed: msg({ message: "That did not save. Try again.", context: "task board: bell.failed" }),
  },
  pref: {
    label: msg({ message: "Task emails", context: "task board: pref.label" }),
    options: {
      immediate: msg({ message: "As they happen: tasks handed to your role and the answers to ones you sent, a call's list when it closes, and a gentle note near the date", context: "task board: pref.options.immediate" }),
      daily: msg({ message: "Only in my daily digest", context: "task board: pref.options.daily" }),
      off: msg({ message: "Off", context: "task board: pref.options.off" }),
    },
  },
}
;

let last: { i18n: I18n; locale: string; messages: unknown; words: TaskWords } | null = null;

/** The task words in `i18n`'s language, for a helper outside a component. Drawn once per language. */
export function taskWords(i18n: I18n = appI18n): TaskWords {
  if (last && last.i18n === i18n && last.locale === i18n.locale && last.messages === i18n.messages) return last.words;
  const words = drawWords(TASK_MIRROR, i18n);
  last = { i18n, locale: i18n.locale, messages: i18n.messages, words };
  return words;
}

/** The task words in the reader's language. */
export function useTaskWords(): TaskWords {
  return useWords(TASK_MIRROR);
}
