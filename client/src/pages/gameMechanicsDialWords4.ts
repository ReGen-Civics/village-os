/**
 * Part 4 of the dials' words (gameMechanicsDialWords.ts explains them): the applicant flow's dials, written from
 * shared/gameVariables.ts. gameMechanicsDialWords.test.ts holds every entry to the server's English.
 */
import { msg } from "@lingui/core/macro";
// The runtime as a value the build keeps (gameMechanicsDialWords3.ts says why).
export { i18n as dialWordsRuntime4 } from "@lingui/core";
import type { DialWords } from "./gameMechanicsDialWords";

export const DIAL_WORDS_4: Readonly<Record<string, DialWords>> = {
  "org.role_short_labels": {
    label: msg({ message: "Short role names on an applicant's booking buttons", context: "game variable org.role_short_labels, label" }),
    description: msg({ message: "What an applicant's booking button calls each role, one role per line as role-id = Label (for example ops-role = Ops). The button then reads Book with Ops, and never names a person. A role with no line here reads its full name. Paste each role id from the org chart.", context: "game variable org.role_short_labels, description" }),
  },
  "org.application_close_days": {
    label: msg({ message: "Days before an undecided application closes", context: "game variable org.application_close_days, label" }),
    description: msg({ message: "An application nobody has decided this many days after it arrived is closed, and the applicant gets one letter saying so (the lead, 27 Nov 2026: yes close in 90 days). When a role it applies for sets the day applications close, the days count from when its review window opens, a week after that day. It is the only step in an application that happens without a person. An application that was adopted, declined or withdrawn is never touched.", context: "game variable org.application_close_days, description" }),
  },
  "org.all_hands_day": {
    label: msg({ message: "The all-hands meeting's day", context: "game variable org.all_hands_day, label" }),
    description: msg({ message: "The weekday of the village's all-hands meeting, in English (Monday, Tuesday and so on). A newly accepted applicant starts on this day: the first one after their proposal is accepted that falls on or after the next season begins, unless Ops directed a start now. The start letter invites them to the meeting that day.", context: "game variable org.all_hands_day, description" }),
  },
  "org.all_hands_time": {
    label: msg({ message: "The all-hands meeting's time", context: "game variable org.all_hands_time, label" }),
    description: msg({ message: "The meeting's start time, as 24-hour clock time in the zone below (for example 12:00). The start letter says it with the zone.", context: "game variable org.all_hands_time, description" }),
  },
  "org.all_hands_timezone": {
    label: msg({ message: "The all-hands meeting's time zone", context: "game variable org.all_hands_timezone, label" }),
    description: msg({ message: "The time zone the meeting's time is in, as its standard name (for example America/Costa_Rica). The letter says it as Costa Rica time.", context: "game variable org.all_hands_timezone, description" }),
  },
  "org.all_hands_link": {
    label: msg({ message: "The all-hands meeting's video link", context: "game variable org.all_hands_link, label" }),
    description: msg({ message: "The video call a new member joins for the all-hands. Leave it empty and the start letter names the meeting without a link.", context: "game variable org.all_hands_link, description" }),
  },
  "org.nudge_book_days": {
    label: msg({ message: "Days before an applicant is reminded to book a conversation", context: "game variable org.nudge_book_days, label" }),
    description: msg({ message: "A conversation still open this many days after it opened sends the applicant one gentle reminder to book it, with its link. Once per conversation. A reminder never moves the application.", context: "game variable org.nudge_book_days, description" }),
  },
  "org.nudge_step_days": {
    label: msg({ message: "Days before the team is reminded of a step that waits", context: "game variable org.nudge_step_days, label" }),
    description: msg({ message: "A conversation not yet written up, or a reference not yet followed up, this many days on gives the role up next one heads-up on the bell. Once per step. It never moves the application.", context: "game variable org.nudge_step_days, description" }),
  },
  "org.close_warning_days": {
    label: msg({ message: "Days after arrival when the team is warned an application will close", context: "game variable org.close_warning_days, label" }),
    description: msg({ message: "An application nobody has decided this many days after it arrived warns the people who place roles, once, before it closes on its own at the days set below. With a role's application deadline, the days count from when its review window opens. It never moves the application.", context: "game variable org.close_warning_days, description" }),
  },
  "org.reference_questions": {
    label: msg({ message: "The standard questions for a reference's follow-up", context: "game variable org.reference_questions, label" }),
    description: msg({ message: "The questions that open in the notes box of whoever follows a reference up, the same for everyone, one per line. The notes stay with the team; the applicant only ever sees whether each reference was reached.", context: "game variable org.reference_questions, description" }),
  },
};
