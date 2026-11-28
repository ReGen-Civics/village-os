/**
 * THE TOWER: messages. The village's mail (journeys, words, people, letters, sent mail and its settings) and the
 * calendar with its events. The controls Mail settings already lands on are in shared/adminSearch.ts and join the
 * registry by derivation (shared/adminActs/derived.ts).
 *
 * Each row's power is what its own handler asks (read on 27 Nov 2026). Sending mail is a person's act: the class of
 * each row is computed from the person-only lists.
 */
import { DELETE, POST, PUT, date, long, text, inPlace } from "./types";

export const TOWER_ACTS = inPlace("tower", [
  // ── Mail: overview and journeys ──────────────────────────────────────────
  {
    id: "tower.mail.run-now", tab: "comms-overview", power: "comms.manage",
    title: "Run the mail now",
    help: "Run one of the mail jobs now, without waiting for its next turn.",
    synonyms: ["run now", "send queue", "mail job", "process mail"],
    route: POST("/api/admin/comms/run"),
    fields: [text("job", "Which job")],
  },
  {
    id: "tower.journeys.set-state", tab: "comms-journeys", power: "comms.manage",
    title: "Turn a mail journey on or off",
    help: "Change whether a journey is running.",
    synonyms: ["journey", "automation", "turn on journey", "welcome emails", "drip"],
    route: POST("/api/admin/comms/journeys/:key/state"),
    fields: [text("state", "Where it stands")],
  },
  {
    id: "tower.journeys.edit-step", tab: "comms-journeys", power: "comms.manage",
    title: "Change a step of a mail journey",
    help: "Change when one step of a journey goes and what it says.",
    synonyms: ["journey step", "edit step", "delay", "reminder timing"],
    route: PUT("/api/admin/comms/journeys/:key/steps/:step"),
    partial: true,
  },
  {
    id: "tower.journeys.test-step", tab: "comms-journeys", power: "comms.manage",
    title: "Send yourself one step of a journey",
    help: "Send a test of one journey step to your own address.",
    synonyms: ["test step", "preview email", "send test"],
    route: POST("/api/admin/comms/journeys/:key/steps/:step/test"),
  },
  {
    id: "tower.journeys.stop-one", tab: "comms-journeys", power: "comms.manage",
    title: "Take one person off a journey",
    help: "Stop a journey for one person. Others on it carry on.",
    synonyms: ["stop journey", "remove from journey", "unenroll"],
    route: POST("/api/admin/comms/journeys/enrollments/:id/stop"),
  },
  {
    id: "tower.journeys.path-options", tab: "comms-journeys", power: "comms.manage",
    title: "Change a path's journey options",
    help: "The choices that shape the journey of one path.",
    synonyms: ["path options", "path journey", "path emails"],
    route: PUT("/api/admin/comms/paths/:key"),
    partial: true,
  },

  // ── Mail: words ──────────────────────────────────────────────────────────
  {
    id: "tower.words.save", tab: "comms-words", power: "comms.manage",
    title: "Change the words of an email",
    help: "Change the subject and the words of one of the village's emails.",
    synonyms: ["email words", "template", "subject line", "edit email"],
    route: PUT("/api/admin/comms/words/:key"),
    partial: true,
  },
  {
    id: "tower.words.restore", tab: "comms-words", power: "comms.manage",
    title: "Go back to an earlier version of an email",
    help: "Restore the words an email had before.",
    synonyms: ["restore words", "earlier version", "undo email edit"],
    route: POST("/api/admin/comms/words/:key/restore"),
    fields: [text("version", "Which version")],
  },
  {
    id: "tower.words.test", tab: "comms-words", power: "comms.manage",
    title: "Send yourself an email's words",
    help: "Send a test of one email to your own address.",
    synonyms: ["test email words", "preview"],
    route: POST("/api/admin/comms/words/:key/test"),
  },

  // ── Mail: people ─────────────────────────────────────────────────────────
  {
    id: "tower.people.suppress", tab: "comms-people", power: "comms.manage",
    title: "Stop emailing a person",
    help: "Stop the village's bulk email to one address, with what was asked.",
    synonyms: ["unsubscribe", "stop email", "suppress", "do not email"],
    route: POST("/api/admin/comms/people/:id/suppress"),
    fields: [long("detail", "What was asked")],
  },
  {
    id: "tower.people.restore", tab: "comms-people", power: "comms.manage",
    title: "Start emailing a person again",
    help: "Let the village's email reach an address again, with the reason.",
    synonyms: ["resubscribe", "restore email", "email again"],
    route: POST("/api/admin/comms/people/:id/restore"),
    fields: [long("reason", "Reason")],
  },
  {
    id: "tower.people.stop-journey", tab: "comms-people", power: "comms.manage",
    title: "Stop one journey for a person",
    help: "End one journey a person is on, from their row.",
    synonyms: ["stop journey for person"],
    route: POST("/api/admin/comms/people/:id/journeys/:enrollmentId/stop"),
  },
  {
    id: "tower.people.export", tab: "comms-people", power: "comms.manage",
    title: "Download the address book",
    help: "A spreadsheet of the people the village may email.",
    synonyms: ["export contacts", "address book", "mailing list csv"],
    route: { method: "GET", path: "/api/admin/comms/people-export" },
  },

  // ── Mail: letters and sent mail ──────────────────────────────────────────
  {
    id: "tower.letters.write", tab: "comms-letters", power: "comms.manage",
    title: "Write a letter",
    help: "Start a letter to the people who agreed to hear from the village.",
    synonyms: ["letter", "newsletter", "announcement", "write to everyone", "broadcast"],
    route: POST("/api/admin/comms/letters"),
    partial: true,
  },
  {
    id: "tower.letters.edit", tab: "comms-letters", power: "comms.manage",
    title: "Change a letter",
    help: "Change a letter's words and who it goes to before it is sent.",
    synonyms: ["edit letter", "letter audience"],
    route: PUT("/api/admin/comms/letters/:id"),
    partial: true,
  },
  {
    id: "tower.letters.test", tab: "comms-letters", power: "comms.manage",
    title: "Send yourself a letter",
    help: "Send a test of a letter to your own address.",
    synonyms: ["test letter", "preview letter"],
    route: POST("/api/admin/comms/letters/:id/test"),
  },
  {
    id: "tower.letters.send", tab: "comms-letters", power: "comms.manage",
    title: "Send a letter",
    help: "Send a letter to everyone it is addressed to, now or at the time it is set for.",
    synonyms: ["send letter", "send newsletter", "send to everyone"],
    route: POST("/api/admin/comms/letters/:id/send"),
    partial: true,
  },
  {
    id: "tower.letters.cancel", tab: "comms-letters", power: "comms.manage",
    title: "Cancel a letter that is waiting to go",
    help: "Stop a scheduled letter before it is sent.",
    synonyms: ["cancel letter", "stop letter"],
    route: POST("/api/admin/comms/letters/:id/cancel"),
  },
  {
    id: "tower.letters.reschedule", tab: "comms-letters", power: "comms.manage",
    title: "Move when a letter goes",
    help: "Change the time a scheduled letter is sent.",
    synonyms: ["reschedule letter", "send later"],
    route: POST("/api/admin/comms/letters/:id/reschedule"),
    fields: [date("scheduledFor", "When it goes")],
  },
  {
    id: "tower.sent.retry", tab: "comms-sent", power: "comms.manage",
    title: "Try a failed email again",
    help: "Send again an email that did not go through.",
    synonyms: ["retry email", "resend", "bounced", "failed email"],
    route: POST("/api/admin/comms/messages/:id/retry"),
  },
  {
    id: "tower.sent.cancel", tab: "comms-sent", power: "comms.manage",
    title: "Cancel an email that is waiting",
    help: "Stop an email that is queued and has not gone yet.",
    synonyms: ["cancel email", "stop queued email"],
    route: POST("/api/admin/comms/messages/:id/cancel"),
  },

  // ── Mail settings, beside the controls the page already lands on ─────────
  {
    id: "tower.mail.verify-domain", tab: "comms-settings", power: "comms.manage",
    title: "Check the sending domain's records",
    help: "Ask the mail service whether the domain's records are in place.",
    synonyms: ["verify domain", "dns check", "domain records"],
    route: POST("/api/admin/comms/settings/domain/verify"),
  },
  {
    id: "tower.mail.key-rights", parity: ["A70", "D12"], tab: "comms-settings", power: "comms.manage",
    title: "Check that the mail key may only send",
    help: "Confirm the sending key can send and can do nothing else.",
    synonyms: ["key rights", "send only", "mail key check", "restricted key"],
    route: POST("/api/admin/comms/settings/key-rights"),
  },

  // ── The calendar ─────────────────────────────────────────────────────────
  {
    id: "tower.calendar.add-event", tab: "events-admin", power: "event.manage",
    title: "Put an event on the calendar",
    help: "Add a gathering with its time, its place and who it is for.",
    synonyms: ["new event", "add event", "gathering", "schedule", "calendar"],
    route: POST("/api/admin/events"),
    partial: true,
  },
  {
    id: "tower.calendar.edit-event", tab: "events-admin", power: "event.manage",
    title: "Change an event",
    help: "Change an event's time, place and words.",
    synonyms: ["edit event", "move event", "reschedule event"],
    route: PUT("/api/admin/events/:id"),
    partial: true,
  },
  {
    id: "tower.calendar.remove-event", tab: "events-admin", power: "event.manage",
    title: "Cancel an event",
    help: "Take an event off the calendar.",
    synonyms: ["cancel event", "delete event", "remove gathering"],
    route: DELETE("/api/admin/events/:id"),
  },
  {
    id: "tower.calendar.add-slot", tab: "events-admin", power: "event.manage",
    title: "Add a part to an event",
    help: "Add a named part to an event.",
    synonyms: ["slot", "session", "event part", "time slot"],
    route: POST("/api/admin/events/:id/slots"),
    fields: [text("label", "Name")],
  },
  {
    id: "tower.calendar.remove-slot", tab: "events-admin", power: "event.manage",
    title: "Remove a part of an event",
    help: "Take one part off an event.",
    synonyms: ["remove slot", "delete session"],
    route: DELETE("/api/admin/events/:id/slots/:slotId"),
  },
  {
    id: "tower.calendar.month-name", tab: "events-admin", power: "event.manage",
    title: "Name a month of the village's year",
    help: "Give one month of the calendar the village's own name.",
    synonyms: ["month names", "moon names", "calendar names"],
    route: PUT("/api/admin/events/month-names/:index"),
    fields: [text("name", "Name")],
  },
  {
    id: "tower.calendar.add-feed", tab: "events-admin", power: "admin", holder: "event.manage",
    title: "Follow an outside calendar",
    help: "Show the events of another calendar on the village's own, by its address.",
    synonyms: ["calendar feed", "ical", "google calendar", "import calendar", "subscribe"],
    route: POST("/api/admin/events/calendars"),
    fields: [text("name", "Name"), text("url", "Address"), text("layer", "Layer"), text("colour", "Colour")],
  },
  {
    id: "tower.calendar.remove-feed", tab: "events-admin", power: "admin", holder: "event.manage",
    title: "Stop following an outside calendar",
    help: "Take another calendar's events off the village's own.",
    synonyms: ["remove feed", "unsubscribe calendar"],
    route: DELETE("/api/admin/events/calendars/:id"),
  },
  {
    id: "tower.calendar.refresh-feed", tab: "events-admin", power: "admin", holder: "event.manage",
    title: "Read an outside calendar again now",
    help: "Fetch another calendar's events now, without waiting.",
    synonyms: ["refresh feed", "sync calendar", "poll calendar"],
    route: POST("/api/admin/events/calendars/:id/poll"),
  },
  {
    id: "tower.calendar.event-email", tab: "events-admin", power: "event.manage",
    title: "Change an event's emails",
    help: "Which emails an event sends: the invitation, the reminders and the recap.",
    synonyms: ["event emails", "reminders", "recap email", "gathering email"],
    route: PUT("/api/events/:id/comms"),
    partial: true,
  },
]);
