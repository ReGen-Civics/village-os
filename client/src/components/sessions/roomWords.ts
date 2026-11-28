/**
 * THE LIVE SESSION ROOM'S WORDS IN THE READER'S LANGUAGE: the mirror of `ROOM_COPY` (shared/sessions.ts), every
 * fixed word the room draws: the arrival round, the shared breath, the sit, rounds, consent, the agenda, the
 * timer and the close.
 *
 * The shared table stays English. The room draws this mirror through `useRoomWords()` (or `roomWords()`
 * outside a component). Typed off the shared table, so a key added there and not here fails the compiler;
 * roomWords.test.ts holds the English equal and every entry to the catalog.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import { roomClock, type ROOM_COPY } from "@shared/sessions";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

export type RoomWords = Drawn<typeof ROOM_COPY>;

export const ROOM_MIRROR: WordMirror<typeof ROOM_COPY> = {
  opening: msg({ message: "Opening the room", context: "live session room: opening" }),
  missing: msg({ message: "This session is not here. The link may be old, or the session was removed.", context: "live session room: missing" }),
  failed: msg({ message: "The room is not answering just now. It keeps trying.", context: "live session room: failed" }),
  signedOut: msg({ message: "Your sign-in ended. Sign in again to carry on in the room.", context: "live session room: signedOut" }),
  allSessions: msg({ message: "All sessions", context: "live session room: allSessions" }),
  writeFailed: msg({ message: "That did not go through. Try again.", context: "live session room: writeFailed" }),
  offline: msg({ message: "Could not reach the village. Try again.", context: "live session room: offline" }),
  here: msg({ message: "Here now", context: "live session room: here" }),
  away: msg({ message: "Away", context: "live session room: away" }),
  facilitating: msg({ message: "Facilitating", context: "live session room: facilitating" }),
  takingNotes: msg({ message: "Taking notes", context: "live session room: takingNotes" }),
  youFacilitate: msg({ message: "You are facilitating.", context: "live session room: youFacilitate" }),
  joinLede: msg({ message: "You can look around. Join to give your number, add to the agenda and take actions.", context: "live session room: joinLede" }),
  moonOrdinal: (n) => msg({ message: `Moon ${n}`, context: "live session room: moonOrdinal" }),
  clockWaiting: msg({ message: "The clock starts when the facilitator begins the session or moves the room on.", context: "live session room: clockWaiting" }),
  clockWaitingYou: msg({ message: "The clock starts when you begin, or when you first move the room on.", context: "live session room: clockWaitingYou" }),
  facilitatedBy: (name) => msg({ message: `Facilitated by ${name}`, context: "live session room: facilitatedBy" }),
  clockLine: (elapsedMin, durationMin) => msg({ message: `${elapsedMin} of ${durationMin} min`, context: "live session room: clockLine" }),
  beginSession: msg({ message: "Begin the session", context: "live session room: beginSession" }),
  sessionBegun: msg({ message: "The session has begun. The clock is running.", context: "live session room: sessionBegun" }),
  nextStage: msg({ message: "Next stage", context: "live session room: nextStage" }),
  moveHere: msg({ message: "Move the room here", context: "live session room: moveHere" }),
  liveBadge: msg({ message: "Now", context: "live session room: liveBadge" }),
  browsing: (yours, room) => msg({ message: `You are looking at ${yours}. The room is on ${room}.`, context: "live session room: browsing" }),
  backToRoom: msg({ message: "Back to the room", context: "live session room: backToRoom" }),
  showCues: msg({ message: "Cues for you", context: "live session room: showCues" }),
  hideCues: msg({ message: "Hide the cues", context: "live session room: hideCues" }),
  handTo: msg({ message: "Hand facilitation to", context: "live session room: handTo" }),
  handOver: msg({ message: "Hand over", context: "live session room: handOver" }),
  secretaryLabel: msg({ message: "Who takes notes", context: "live session room: secretaryLabel" }),
  nobodyYet: msg({ message: "Nobody yet", context: "live session room: nobodyYet" }),
  stagesLabel: msg({ message: "The stages of this session", context: "live session room: stagesLabel" }),
  hostsTitle: msg({ message: "Hosting", context: "live session room: hostsTitle" }),
  takeOver: msg({ message: "Take over facilitating", context: "live session room: takeOver" }),
  takeOverHint: msg({ message: "If the facilitator has stepped away, an admin can hold the room from here.", context: "live session room: takeOverHint" }),
  whoIsHere: msg({ message: "Who is here", context: "live session room: whoIsHere" }),
  nobodyHere: msg({ message: "Nobody has arrived yet.", context: "live session room: nobodyHere" }),
  breathTitle: msg({ message: "Breathe together", context: "live session room: breathTitle" }),
  breathIdle: msg({ message: "When the facilitator starts it, every screen breathes at the same pace.", context: "live session room: breathIdle" }),
  breathDone: msg({ message: "Let the quiet sit for a moment.", context: "live session room: breathDone" }),
  breathPattern: msg({ message: "Pattern", context: "live session room: breathPattern" }),
  breathRounds: msg({ message: "Rounds", context: "live session room: breathRounds" }),
  breathStart: msg({ message: "Start the breath", context: "live session room: breathStart" }),
  breathStop: msg({ message: "Stop the breath", context: "live session room: breathStop" }),
  breathAgain: msg({ message: "Breathe again", context: "live session room: breathAgain" }),
  breathRound: (n, of) => msg({ message: `Round ${n} of ${of}`, context: "live session room: breathRound" }),
  breathStepLine: (secondsLeft, round, of) =>
    msg({ message: plural(secondsLeft, { one: `# second · Round ${round} of ${of}`, other: `# seconds · Round ${round} of ${of}` }), context: "live session room: breathStepLine" }),
  breathCounts: (secs) => [secs.join(" · ")],
  breathStartedSay: (rounds) => msg({ message: `The shared breath has started, ${rounds} rounds.`, context: "live session room: breathStartedSay" }),
  sitTitle: msg({ message: "Sit together", context: "live session room: sitTitle" }),
  sitIdle: msg({ message: "A few minutes of quiet for the whole room. A singing bowl rings on every screen when it ends.", context: "live session room: sitIdle" }),
  sitMinutes: msg({ message: "Minutes", context: "live session room: sitMinutes" }),
  sitStart: msg({ message: "Start the sit", context: "live session room: sitStart" }),
  sitStop: msg({ message: "End the sit early", context: "live session room: sitStop" }),
  sitAgain: msg({ message: "Sit again", context: "live session room: sitAgain" }),
  sitMinutesWord: (n) => msg({ message: plural(n, { one: "# minute", other: "# minutes" }), context: "live session room: sitMinutesWord" }),
  sitLeft: (secondsLeft) => [`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`],
  sitLeftHint: msg({ message: "left in the quiet", context: "live session room: sitLeftHint" }),
  sitSitting: msg({ message: "Rest your eyes. The bowl will call you back.", context: "live session room: sitSitting" }),
  sitDone: msg({ message: "The bowl has rung. Come back slowly.", context: "live session room: sitDone" }),
  sitStartedSay: (minutes) =>
    msg({ message: plural(minutes, { one: "The sit has started, # minute.", other: "The sit has started, # minutes." }), context: "live session room: sitStartedSay" }),
  sitEndedSay: msg({ message: "The sit has ended.", context: "live session room: sitEndedSay" }),
  bellOn: msg({ message: "Bell on this screen", context: "live session room: bellOn" }),
  bellOff: msg({ message: "Turn the bell on", context: "live session room: bellOff" }),
  bellHint: msg({ message: "Browsers stay silent until you tap once. Tap here so the bowl can ring for you.", context: "live session room: bellHint" }),
  bellMuted: msg({ message: "Sound is muted on this device, so the bowl will not ring.", context: "live session room: bellMuted" }),
  giveNumber: msg({ message: "Give my number", context: "live session room: giveNumber" }),
  changeNumber: msg({ message: "Change my number", context: "live session room: changeNumber" }),
  theRoom: msg({ message: "The room", context: "live session room: theRoom" }),
  notYet: msg({ message: "Not yet", context: "live session room: notYet" }),
  arrivalHeardInRoom: msg({ message: "The numbers are shared with the people who joined the room.", context: "live session room: arrivalHeardInRoom" }),
  answersHeardInRoom: msg({ message: "The answers are shared with the people who joined the room.", context: "live session room: answersHeardInRoom" }),
  roomMovedTo: (title) => msg({ message: `The room moved on to ${title}.`, context: "live session room: roomMovedTo" }),
  openProposalsTitle: msg({ message: "Proposals still open", context: "live session room: openProposalsTitle" }),
  openProposalsHint: msg({ message: "Mark each one decided by consent, or leave it open and it goes in the record as not decided.", context: "live session room: openProposalsHint" }),
  roundStart: msg({ message: "Start a speaking round", context: "live session room: roundStart" }),
  roundNext: msg({ message: "Next speaker", context: "live session room: roundNext" }),
  roundBack: msg({ message: "Back one", context: "live session room: roundBack" }),
  roundEnd: msg({ message: "End the round", context: "live session room: roundEnd" }),
  speakingNow: msg({ message: "Speaking now", context: "live session room: speakingNow" }),
  readyNext: msg({ message: "Ready next", context: "live session room: readyNext" }),
  roundDone: msg({ message: "Everyone has spoken. Thank you all.", context: "live session room: roundDone" }),
  joinFirst: msg({ message: "Join the room to take part here.", context: "live session room: joinFirst" }),
  parkedItems: msg({ message: "Parked last time", context: "live session room: parkedItems" }),
  addToAgenda: msg({ message: "Add to the agenda", context: "live session room: addToAgenda" }),
  actionCheckTitle: msg({ message: "Action check from last time", context: "live session room: actionCheckTitle" }),
  addActionCheck: msg({ message: "Add an action check to the agenda", context: "live session room: addActionCheck" }),
  itemTitleLabel: msg({ message: "Item title", context: "live session room: itemTitleLabel" }),
  itemTitlePlaceholder: msg({ message: "What needs the circle's time?", context: "live session room: itemTitlePlaceholder" }),
  addItemButton: msg({ message: "Add it", context: "live session room: addItemButton" }),
  agendaEmpty: msg({ message: "The agenda is still blank. Anyone in the room can add the first item.", context: "live session room: agendaEmpty" }),
  moveUp: msg({ message: "Move up", context: "live session room: moveUp" }),
  moveDown: msg({ message: "Move down", context: "live session room: moveDown" }),
  edit: msg({ message: "Edit", context: "live session room: edit" }),
  save: msg({ message: "Save", context: "live session room: save" }),
  cancel: msg({ message: "Cancel", context: "live session room: cancel" }),
  takeOff: msg({ message: "Take it off the agenda", context: "live session room: takeOff" }),
  bringBack: msg({ message: "Bring it back", context: "live session room: bringBack" }),
  offAgenda: msg({ message: "Off the agenda", context: "live session room: offAgenda" }),
  agendaFitLine: (planned, left) => msg({ message: `${planned} min planned, ${left} min left`, context: "live session room: agendaFitLine" }),
  minutesShort: msg({ message: "min", context: "live session room: minutesShort" }),
  consentSentence: msg({ message: "Say it in one sentence", context: "live session room: consentSentence" }),
  consentNeedsSentence: msg({ message: "A concern or an objection needs one sentence, so the room can hear it whole.", context: "live session room: consentNeedsSentence" }),
  consentSend: msg({ message: "Give my answer", context: "live session room: consentSend" }),
  consentChange: msg({ message: "Change my answer", context: "live session room: consentChange" }),
  tallyLine: (t) => {
    const { consent, concern, object, sleeping, byDefault } = t;
    return [
      msg({ message: `${consent} consent, ${concern} with a concern, ${object} objecting`, context: "live session room: tallyLine" }),
      !!sleeping && msg({ message: `, ${sleeping} sleeping on it`, context: "live session room: tallyLine, sleeping" }),
      !!byDefault && msg({ message: `, ${byDefault} no objection by default`, context: "live session room: tallyLine, by default" }),
      msg({ message: `, ${t.waiting} still to answer`, context: "live session room: tallyLine, waiting" }),
    ];
  },
  talliedLine: (t) => {
    const { consent, concern, object, sleeping, byDefault } = t;
    return [
      msg({ message: `${consent} consent, ${concern} with a concern, ${object} objecting`, context: "live session room: tallyLine" }),
      !!sleeping && msg({ message: `, ${sleeping} sleeping on it`, context: "live session room: tallyLine, sleeping" }),
      !!byDefault && msg({ message: `, ${byDefault} no objection by default`, context: "live session room: tallyLine, by default" }),
    ];
  },
  sleepingOpen: msg({ message: "Somebody asked for a night. The round stays open until they answer.", context: "live session room: sleepingOpen" }),
  nightAsk: msg({ message: "When will you answer by?", context: "live session room: nightAsk" }),
  nightTomorrow: msg({ message: "Tomorrow, 9:00", context: "live session room: nightTomorrow" }),
  nightTwoDays: msg({ message: "In two days, 9:00", context: "live session room: nightTwoDays" }),
  nightTimeLabel: msg({ message: "Or choose a time", context: "live session room: nightTimeLabel" }),
  nightHint: msg({ message: "If you have not answered by then, your answer counts as no objection.", context: "live session room: nightHint" }),
  nightNeeded: msg({ message: "Say when you will answer by.", context: "live session room: nightNeeded" }),
  nightOpen: (name, when) => msg({ message: `${name} asked for a night. The round stays open until ${when}.`, context: "live session room: nightOpen" }),
  nightOver: (name, when) => msg({ message: `${name}'s night ended at ${when}, so it counts as no objection.`, context: "live session room: nightOver" }),
  recordNightYours: (when) => msg({ message: `You asked for a night. Answer by ${when}, or your answer counts as no objection.`, context: "live session room: recordNightYours" }),
  recordConsented: msg({ message: "The round consented after the call: nobody objects.", context: "live session room: recordConsented" }),
  recordNotConsented: msg({ message: "The night is over, and the round did not consent.", context: "live session room: recordNotConsented" }),
  markDecided: msg({ message: "Mark it decided", context: "live session room: markDecided" }),
  nightAnswerAsk: msg({ message: "Your answer after a night", context: "live session room: nightAnswerAsk" }),
  nightAnswered: msg({ message: "Your answer is in the record.", context: "live session room: nightAnswered" }),
  decidedAfterNight: msg({ message: "Marked decided.", context: "live session room: decidedAfterNight" }),
  consented: msg({ message: "Everyone here consents.", context: "live session room: consented" }),
  waitingFor: (names) => {
    const who = names.join(", ");
    return msg({ message: `Waiting for ${who}`, context: "live session room: waitingFor" });
  },
  proposalConsentAsk: msg({ message: "Do you consent to this proposal?", context: "live session room: proposalConsentAsk" }),
  startItem: msg({ message: "Start this item", context: "live session room: startItem" }),
  itemStatus: {
    waiting: msg({ message: "Waiting", context: "live session room: itemStatus.waiting" }),
    active: msg({ message: "On now", context: "live session room: itemStatus.active" }),
    done: msg({ message: "Done", context: "live session room: itemStatus.done" }),
    parked: msg({ message: "Parked", context: "live session room: itemStatus.parked" }),
  },
  extendFive: msg({ message: "Add five minutes", context: "live session room: extendFive" }),
  wrapNext: msg({ message: "Wrap up and start the next", context: "live session room: wrapNext" }),
  wrapUp: msg({ message: "Wrap it up", context: "live session room: wrapUp" }),
  nextStepLabel: msg({ message: "Next step", context: "live session room: nextStepLabel" }),
  upNext: (title) => msg({ message: `Up next: ${title}`, context: "live session room: upNext" }),
  nowOn: (title) => msg({ message: `Now: ${title}`, context: "live session room: nowOn" }),
  lastItem: msg({ message: "This is the last item on the agenda.", context: "live session room: lastItem" }),
  timeUpFor: (title) => msg({ message: `Time is up for ${title}.`, context: "live session room: timeUpFor" }),
  startFirst: msg({ message: "Start the first item", context: "live session room: startFirst" }),
  startNext: msg({ message: "Start the next item", context: "live session room: startNext" }),
  itemsDone: msg({ message: "Every item on the agenda is done.", context: "live session room: itemsDone" }),
  agendaReady: msg({ message: "When the agenda is ready, start the first item.", context: "live session room: agendaReady" }),
  agendaNone: msg({ message: "Add an item to the agenda, or move on.", context: "live session room: agendaNone" }),
  closeLast: msg({ message: "Last step: one word each, then close the session.", context: "live session room: closeLast" }),
  goToClose: msg({ message: "Go to Close the session", context: "live session room: goToClose" }),
  timeLeft: (seconds) => {
    const clock = roomClock(seconds);
    return msg({ message: `${clock} left`, context: "live session room: timeLeft" });
  },
  timeOver: (seconds) => {
    const clock = roomClock(seconds);
    return msg({ message: `${clock} over`, context: "live session room: timeOver" });
  },
  leftWord: msg({ message: "left", context: "live session room: leftWord" }),
  overWord: msg({ message: "over", context: "live session room: overWord" }),
  notes: msg({ message: "Notes", context: "live session room: notes" }),
  ideas: msg({ message: "Ideas", context: "live session room: ideas" }),
  proposal: msg({ message: "Proposal", context: "live session room: proposal" }),
  seed: msg({ message: "What we learned", context: "live session room: seed" }),
  seedHelp: msg({ message: "One sentence the circle wants to remember from this item. It goes into the record.", context: "live session room: seedHelp" }),
  wins: msg({ message: "Wins and celebrations", context: "live session room: wins" }),
  winsHelp: msg({ message: "Something you won at, finished, or want the circle to celebrate. It goes into the record.", context: "live session room: winsHelp" }),
  actionsHere: msg({ message: "Actions", context: "live session room: actionsHere" }),
  nothingYet: msg({ message: "Nothing here yet.", context: "live session room: nothingYet" }),
  writeHere: msg({ message: "Write it here", context: "live session room: writeHere" }),
  add: msg({ message: "Add", context: "live session room: add" }),
  decide: msg({ message: "Decided by consent", context: "live session room: decide" }),
  decidedBadge: msg({ message: "Decided", context: "live session room: decidedBadge" }),
  seedSave: msg({ message: "Add to the record", context: "live session room: seedSave" }),
  dueLabel: msg({ message: "Due by", context: "live session room: dueLabel" }),
  seatLabel: msg({ message: "A role holds it", context: "live session room: seatLabel" }),
  noSeat: msg({ message: "No role", context: "live session room: noSeat" }),
  remove: msg({ message: "Remove", context: "live session room: remove" }),
  heldBy: msg({ message: "Held by", context: "live session room: heldBy" }),
  nobodyHolds: msg({ message: "Nobody holds this yet", context: "live session room: nobodyHolds" }),
  unownedOne: msg({ message: "1 action still needs someone", context: "live session room: unownedOne" }),
  outsideAgenda: msg({ message: "Outside the agenda", context: "live session room: outsideAgenda" }),
  parkedLabel: msg({ message: "Parked", context: "live session room: parkedLabel" }),
  doneLabel: msg({ message: "Done", context: "live session room: doneLabel" }),
  tensionPlaceholder: msg({ message: "What are you sensing? It goes to the backlog.", context: "live session room: tensionPlaceholder" }),
  tensionSaved: msg({ message: "Thanks. It's in the backlog.", context: "live session room: tensionSaved" }),
  send: msg({ message: "Send", context: "live session room: send" }),
  amountLabel: msg({ message: "Amount", context: "live session room: amountLabel" }),
  thank: (name) => msg({ message: `Thank ${name}`, context: "live session room: thank" }),
  thankPlaceholder: msg({ message: "What did they bring today?", context: "live session room: thankPlaceholder" }),
  thankSent: (name) => msg({ message: `Your thanks reached ${name}.`, context: "live session room: thankSent" }),
  thankOnWall: msg({ message: "Thank them on the gratitude wall", context: "live session room: thankOnWall" }), // village-ok: mirrors ROOM_COPY word for word; the shared table is the source
  noOneToThank: msg({ message: "When others join the room, you can thank them here.", context: "live session room: noOneToThank" }),
  wordPlaceholder: msg({ message: "One word", context: "live session room: wordPlaceholder" }),
  wordSave: msg({ message: "Leave my word", context: "live session room: wordSave" }),
  roomWords: msg({ message: "The room's words", context: "live session room: roomWords" }),
  facilitationSend: msg({ message: "Send it unsigned", context: "live session room: facilitationSend" }),
  facilitationSent: msg({ message: "Thanks. The facilitator reads it unsigned.", context: "live session room: facilitationSent" }),
  facilitationHeading: msg({ message: "What the room said about the facilitation", context: "live session room: facilitationHeading" }),
  facilitationNone: msg({ message: "No feedback yet.", context: "live session room: facilitationNone" }),
  toolSend: msg({ message: "Send the idea", context: "live session room: toolSend" }),
  closeConfirm: msg({ message: "Close the session now? The arrival words are erased, and the notes are saved for everyone who was here.", context: "live session room: closeConfirm" }),
  closeYes: msg({ message: "Yes, close it", context: "live session room: closeYes" }),
  closeNo: msg({ message: "Not yet", context: "live session room: closeNo" }),
  closedOn: (date) => msg({ message: `Closed ${date}`, context: "live session room: closedOn" }),
  arrivalHeading: msg({ message: "How the room arrived", context: "live session room: arrivalHeading" }),
  arrivalNumbers: (a) => {
    const { count, median, low, high } = a;
    return msg({ message: `${count} gave a number. The middle was ${median} of 11, from ${low} to ${high}.`, context: "live session room: arrivalNumbers" });
  },
  noArrival: msg({ message: "Nobody gave a number.", context: "live session room: noArrival" }),
  agendaHeading: msg({ message: "Agenda and outcomes", context: "live session room: agendaHeading" }),
  usedOf: (used, of) => msg({ message: `${used} of ${of} min`, context: "live session room: usedOf" }),
  notReached: msg({ message: "Not reached", context: "live session room: notReached" }),
  parkedNext: msg({ message: "Parked for next time", context: "live session room: parkedNext" }),
  decisionsHeading: msg({ message: "Decisions", context: "live session room: decisionsHeading" }),
  seedsHeading: msg({ message: "What we learned", context: "live session room: seedsHeading" }),
  actionsHeading: msg({ message: "Actions", context: "live session room: actionsHeading" }),
  backlogHeading: msg({ message: "Backlog for next time", context: "live session room: backlogHeading" }),
  proposalOpen: msg({ message: "Proposal, not decided", context: "live session room: proposalOpen" }),
  showMinutes: msg({ message: "Show the shareable minutes", context: "live session room: showMinutes" }),
  minutesLoading: msg({ message: "Reading the minutes", context: "live session room: minutesLoading" }),
  minutesFailed: msg({ message: "The minutes did not load. Try again.", context: "live session room: minutesFailed" }),
  copied: msg({ message: "Copied.", context: "live session room: copied" }),
  copyFailed: msg({ message: "This browser would not copy. Select the text and copy it by hand.", context: "live session room: copyFailed" }),
  editThis: (what) => msg({ message: `Edit ${what}`, context: "live session room: editThis" }),
  saving: msg({ message: "Saving...", context: "live session room: saving" }),
  saved: msg({ message: "Saved.", context: "live session room: saved" }),
  editKeys: msg({ message: "Enter saves. Shift and Enter starts a new line. Escape cancels.", context: "live session room: editKeys" }),
  editKeysOneLine: msg({ message: "Enter saves. Escape cancels.", context: "live session room: editKeysOneLine" }),
  countOf: (n, max) => msg({ message: `${n} of ${max}`, context: "live session room: countOf" }),
  rewordWarn: msg({ message: "Changing the words starts the consent round again.", context: "live session room: rewordWarn" }),
  decidedLock: msg({ message: "Decided by consent. The words stay as the room agreed them.", context: "live session room: decidedLock" }),
  backlogSoFar: msg({ message: "In the backlog so far", context: "live session room: backlogSoFar" }),
  sessionTitleLabel: msg({ message: "Session title", context: "live session room: sessionTitleLabel" }),
  actionPlaceholder: msg({ message: "What needs doing, in a sentence", context: "live session room: actionPlaceholder" }),
  actionHolderLabel: msg({ message: "Who holds it", context: "live session room: actionHolderLabel" }),
  answerAgain: msg({ message: "Answer again to change it.", context: "live session room: answerAgain" }),
  facilitationReplace: msg({ message: "Sending again replaces what you sent before.", context: "live session room: facilitationReplace" }),
  signoff: msg({ message: "With gratitude", context: "live session room: signoff" }), // village-ok: mirrors ROOM_COPY word for word; the shared table is the source
  holding: msg({ message: "Holding", context: "live session room: holding" }),
  noteTaking: msg({ message: "Taking notes", context: "live session room: noteTaking" }),
};

let last: { i18n: I18n; locale: string; messages: unknown; words: RoomWords } | null = null;

/** The room's words in `i18n`'s language, for a helper outside a component. Drawn once per language. */
export function roomWords(i18n: I18n = appI18n): RoomWords {
  if (last && last.i18n === i18n && last.locale === i18n.locale && last.messages === i18n.messages) return last.words;
  const words = drawWords(ROOM_MIRROR, i18n);
  last = { i18n, locale: i18n.locale, messages: i18n.messages, words };
  return words;
}

/** The room's words in the reader's language. */
export function useRoomWords(): RoomWords {
  return useWords(ROOM_MIRROR);
}
