/**
 * THE LIVE SESSIONS PAGES IN THE READER'S LANGUAGE: the mirror of `SESSION_COPY` (shared/sessions.ts), drawn through `useSessionWords()`
 * in a component and `sessionWords()` outside one. Typed off the shared table, so a key added there and not here
 * fails the compiler; the test beside it holds the English equal and every entry to the catalog.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { SESSION_COPY } from "@shared/sessions";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

export const SESSION_COPY_MIRROR: WordMirror<typeof SESSION_COPY> = {
  listTitle: msg({ message: "Live sessions", context: "live sessions: listTitle" }),
  listLede: msg({ message: "Hold a working call together: arrive, set the agenda, decide by consent, and leave with every action in someone's hands.", context: "live sessions: listLede" }),
  startTitle: msg({ message: "Start a session", context: "live sessions: startTitle" }),
  startButton: msg({ message: "Open the room", context: "live sessions: startButton" }),
  titlePlaceholder: msg({ message: "What is this session?", context: "live sessions: titlePlaceholder" }),
  circleLabel: msg({ message: "Which circle is meeting?", context: "live sessions: circleLabel" }),
  noCircle: msg({ message: "No circle in particular", context: "live sessions: noCircle" }),
  durationLabel: msg({ message: "How long, in minutes", context: "live sessions: durationLabel" }),
  openNow: msg({ message: "Happening now", context: "live sessions: openNow" }),
  recent: msg({ message: "Recent sessions", context: "live sessions: recent" }),
  nothingOpen: msg({ message: "All quiet for now. Open the room when your circle is ready.", context: "live sessions: nothingOpen" }),
  joinButton: msg({ message: "Join the room", context: "live sessions: joinButton" }),
  joinedLabel: msg({ message: "You're in", context: "live sessions: joinedLabel" }),
  placeLineFallback: msg({ message: "Take a moment to feel where you are.", context: "live sessions: placeLineFallback" }),
  arrivalPrompt: msg({ message: "How are you arriving, from 1 to 11?", context: "live sessions: arrivalPrompt" }),
  wishPrompt: msg({ message: "What would make it an 11+?", context: "live sessions: wishPrompt" }),
  wishPlaceholder: msg({ message: "Optional, in a few words", context: "live sessions: wishPlaceholder" }),
  arrivalSaved: msg({ message: "Thanks. You're checked in.", context: "live sessions: arrivalSaved" }),
  arrivalLow: msg({ message: "The room is arriving low. The facilitator may offer a lighter agenda.", context: "live sessions: arrivalLow" }),
  agendaAdd: msg({ message: "Add an item", context: "live sessions: agendaAdd" }),
  agendaAimLabel: msg({ message: "Aim", context: "live sessions: agendaAimLabel" }),
  agendaMinutesLabel: msg({ message: "Minutes", context: "live sessions: agendaMinutesLabel" }),
  agendaConsentAsk: msg({ message: "Do you consent to this agenda?", context: "live sessions: agendaConsentAsk" }),
  agendaOver: msg({ message: "The agenda asks for more time than the session has left.", context: "live sessions: agendaOver" }),
  carriedTitle: msg({ message: "From last time", context: "live sessions: carriedTitle" }),
  carriedActions: msg({ message: "Actions to check in on", context: "live sessions: carriedActions" }),
  carriedBacklog: msg({ message: "Waiting in the backlog", context: "live sessions: carriedBacklog" }),
  itemNone: msg({ message: "Choose an item to start.", context: "live sessions: itemNone" }),
  itemSeedPrompt: msg({ message: "What did this item teach us?", context: "live sessions: itemSeedPrompt" }),
  overChoices: msg({ message: "Time is up for this item. Add five minutes with the room's consent, park it, or wrap it up.", context: "live sessions: overChoices" }),
  addNote: msg({ message: "Add a note", context: "live sessions: addNote" }),
  addIdea: msg({ message: "Add an idea", context: "live sessions: addIdea" }),
  addWin: msg({ message: "Share a win", context: "live sessions: addWin" }),
  addAction: msg({ message: "Add an action", context: "live sessions: addAction" }),
  addTension: msg({ message: "Name a tension", context: "live sessions: addTension" }),
  addDecision: msg({ message: "Write the proposal", context: "live sessions: addDecision" }),
  claim: msg({ message: "I'll take it", context: "live sessions: claim" }),
  release: msg({ message: "Hand it back", context: "live sessions: release" }),
  nameSeat: msg({ message: "Name a role", context: "live sessions: nameSeat" }),
  park: msg({ message: "Park it", context: "live sessions: park" }),
  unownedLeft: msg({ message: "still need someone", context: "live sessions: unownedLeft" }),
  everyoneHolds: msg({ message: "Every action has someone holding it.", context: "live sessions: everyoneHolds" }),
  closeButton: msg({ message: "Close the session", context: "live sessions: closeButton" }),
  closeDone: msg({ message: "Beautiful work, circle. The session is closed, and the notes are saved for everyone who was here.", context: "live sessions: closeDone" }),
  wordPrompt: msg({ message: "One word as you leave", context: "live sessions: wordPrompt" }),
  facilitationPrompt: msg({ message: "How did the facilitation feel?", context: "live sessions: facilitationPrompt" }),
  facilitationMore: msg({ message: "What would you keep, or try next time? The facilitator reads this unsigned.", context: "live sessions: facilitationMore" }),
  toolPrompt: msg({ message: "How could this tool flow better?", context: "live sessions: toolPrompt" }),
  toolPlaceholder: msg({ message: "Your idea goes to the village's feedback inbox.", context: "live sessions: toolPlaceholder" }),
  toolSent: msg({ message: "Thanks. Your idea was sent.", context: "live sessions: toolSent" }),
  gratitudeTitle: msg({ message: "Gratitude", context: "live sessions: gratitudeTitle" }), // village-ok: mirrors SESSION_COPY word for word; the shared table is the source
  gratitudeLede: msg({ message: "Thank someone for what they brought today.", context: "live sessions: gratitudeLede" }),
  recordTitle: msg({ message: "The record", context: "live sessions: recordTitle" }),
  shareableTitle: msg({ message: "Shareable minutes", context: "live sessions: shareableTitle" }),
  shareableLede: msg({ message: "These name no one. Read them through before you copy them anywhere.", context: "live sessions: shareableLede" }),
  copyMinutes: msg({ message: "Copy", context: "live sessions: copyMinutes" }),
  closedNoAccess: msg({ message: "This record is kept for the people who were in the session and the village's admins.", context: "live sessions: closedNoAccess" }),
}
;

export type SessionWords = Drawn<typeof SESSION_COPY>;

let last: { i18n: I18n; locale: string; messages: unknown; words: SessionWords } | null = null;

/** The sessions words in `i18n`'s language, for a helper outside a component. Drawn once per language. */
export function sessionWords(i18n: I18n = appI18n): SessionWords {
  if (last && last.i18n === i18n && last.locale === i18n.locale && last.messages === i18n.messages) return last.words;
  const words = drawWords(SESSION_COPY_MIRROR, i18n);
  last = { i18n, locale: i18n.locale, messages: i18n.messages, words };
  return words;
}

/** The sessions words in the reader's language. */
export function useSessionWords(): SessionWords {
  return useWords(SESSION_COPY_MIRROR);
}
