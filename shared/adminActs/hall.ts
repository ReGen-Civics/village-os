/**
 * THE HALL: review. Everything waiting for somebody to decide it: the review list, what a connector or an agent
 * proposed, forms and requests to join, reports, drafts, and second signatures.
 *
 * Each row's power is what its own handler asks (read on 27 Nov 2026). The class of each is computed, never typed.
 */
import { DELETE, POST, PUT, choice, list, long, num, text, inPlace } from "./types";

const REVIEW = "/admin/review";
const CHANGES = "/admin/proposals";

export const HALL_ACTS = inPlace("hall", [
  // ── The review list ──────────────────────────────────────────────────────
  {
    id: "hall.review.waiting", parity: ["B2"], path: REVIEW, power: "signed-in",
    title: "Review: what is waiting",
    help: "Every queue as one list: what waits on you to decide, oldest first.",
    synonyms: ["review", "waiting", "queue", "inbox", "decide", "to review"],
  },
  {
    id: "hall.review.held", parity: ["B5"], path: REVIEW, power: "admin",
    title: "Review: what is held",
    help: "Changes held back from going live until somebody releases or clears them.",
    synonyms: ["held", "on hold", "held changes", "paused changes"],
  },
  {
    id: "hall.review.decided", parity: ["B6", "B8"], path: REVIEW, power: "admin",
    title: "Review: what was decided",
    help: "What was accepted or put aside, and by whom.",
    synonyms: ["decided", "history", "accepted", "put aside", "past decisions"],
  },
  {
    id: "hall.review.find", parity: ["B1"], path: REVIEW, power: "signed-in",
    title: "Find a review item by its code",
    help: "Type a code such as B-71 or B-71.2 to open that batch or that one change.",
    synonyms: ["find by code", "code", "batch code", "change code", "look up"],
  },

  // ── What a connector or an agent proposed ────────────────────────────────
  {
    id: "hall.changes.accept", parity: ["B3", "B7"], path: CHANGES, power: "admin",
    title: "Accept proposed changes",
    help: "Accept the changes you selected. Each one runs through its own page's door as you.",
    synonyms: ["accept", "approve changes", "bulk accept", "agent proposals", "connector changes"],
    route: POST("/api/admin/proposals/accept"),
    fields: [list("items", "The changes to accept")],
  },
  {
    id: "hall.changes.discard", parity: ["B3", "B7"], path: CHANGES, power: "admin",
    title: "Put proposed changes aside",
    help: "Put aside the changes you selected. Nothing live moves.",
    synonyms: ["discard", "reject changes", "put aside", "dismiss"],
    route: POST("/api/admin/proposals/discard"),
    fields: [list("ids", "The changes to put aside")],
  },
  {
    id: "hall.changes.edit", parity: ["B3", "B7"], path: CHANGES, power: "admin",
    title: "Edit a proposed change before accepting it",
    help: "Change the proposed words in place. The difference is kept so the next proposal learns from it.",
    synonyms: ["edit proposal", "tweak", "change the text", "draft"],
    route: PUT("/api/admin/proposals/:id/draft"),
    fields: [long("body", "The change as you want it")],
  },
  {
    id: "hall.changes.put-back", parity: ["B3", "B7"], path: CHANGES, power: "admin",
    title: "Put a decided change back to waiting",
    help: "Return a change that was put aside or failed to the waiting list.",
    synonyms: ["put back", "reopen", "undo discard", "restore proposal"],
    route: POST("/api/admin/proposals/:id/put-back"),
  },
  {
    id: "hall.changes.release-held", parity: ["B5"], path: REVIEW, power: "admin",
    title: "Release a held change",
    help: "Let a held change go ahead.",
    synonyms: ["release", "unhold", "let through"],
    route: POST("/api/admin/proposals/held/:id/release"),
  },
  {
    id: "hall.changes.clear-held", parity: ["B5"], path: REVIEW, power: "admin",
    title: "Clear a held change",
    help: "Drop a held change without applying it.",
    synonyms: ["clear held", "drop held", "remove held"],
    route: POST("/api/admin/proposals/held/:id/clear"),
  },

  // ── Org chart drafts ─────────────────────────────────────────────────────
  {
    id: "hall.org-drafts.publish", parity: ["B4"], path: REVIEW, power: "admin", holder: "org.decide",
    title: "Publish an org chart draft",
    help: "Put a drafted change to circles and roles straight onto the chart.",
    synonyms: ["publish draft", "org draft", "chart draft", "apply draft"],
    route: POST("/api/admin/org/drafts/:id/publish"),
  },
  {
    id: "hall.org-drafts.withdraw", parity: ["B4"], path: REVIEW, power: "admin", holder: "org.decide",
    title: "Withdraw an org chart draft",
    help: "Take a draft off the review list without publishing it.",
    synonyms: ["withdraw draft", "cancel draft", "drop draft"],
    route: POST("/api/admin/org/drafts/:id/withdraw"),
  },
  {
    id: "hall.org-drafts.revert", parity: ["B4"], path: REVIEW, power: "admin", holder: "org.decide",
    title: "Revert a published org chart draft",
    help: "Undo a draft that was published, putting the chart back as it was.",
    synonyms: ["revert draft", "undo publish", "roll back chart"],
    route: POST("/api/admin/org/drafts/:id/revert"),
  },

  // ── Forms and requests to join ───────────────────────────────────────────
  {
    id: "hall.forms.set-status", tab: "submissions", power: "intake.moderate",
    title: "Answer a form",
    help: "Mark a form as handled, accepted or declined. An accepted proposal can carry the cash it was agreed at.",
    synonyms: ["forms", "submission", "accept", "decline", "mark handled", "accept cash", "application"],
    route: PUT("/api/admin/submissions/:id/status"),
    fields: [text("status", "Status"), num("cashMinor", "Cash agreed, in cents")],
  },
  {
    id: "hall.forms.handle", parity: ["A2", "G23"], tab: "submissions", power: "admin", holder: "intake.moderate",
    title: "Snooze a form or hand it to somebody",
    help: "Set a form aside until a date, or hand it to a role or a person to answer.",
    synonyms: ["snooze", "hand over", "assign", "later", "remind me"],
    route: POST("/api/admin/submissions/:id/handling"),
    partial: true,
  },
  {
    id: "hall.forms.delete", tab: "submissions", power: "admin", holder: "intake.moderate",
    title: "Delete a form",
    help: "Remove one form from the list.",
    synonyms: ["delete form", "remove submission", "spam"],
    route: DELETE("/api/admin/submissions/:id"),
  },
  {
    id: "hall.forms.undo", parity: ["A2", "G22"], tab: "submissions", power: "admin",
    title: "Undo the last form action",
    help: "Take back the answer you just gave a form, while Undo is still showing.",
    synonyms: ["undo", "take back", "oops"],
  },
  {
    id: "hall.join.accept", tab: "submissions", power: "intake.moderate",
    title: "Accept a request to join",
    help: "Say yes to somebody who asked to join.",
    synonyms: ["join request", "wish to join", "accept member", "let in", "membership request"],
    route: POST("/api/admin/join-requests/:id/accept"),
  },
  {
    id: "hall.join.decline", tab: "submissions", power: "intake.moderate",
    title: "Decline a request to join",
    help: "Say no to somebody who asked to join.",
    synonyms: ["decline join", "refuse", "turn down"],
    route: POST("/api/admin/join-requests/:id/decline"),
  },

  // ── Open proposals ───────────────────────────────────────────────────────
  {
    id: "hall.open-proposals.settings", tab: "submissions", power: "intake.moderate",
    title: "Open proposals: the public link and the term",
    help: "Whether anyone with the link may propose a role or a quest, and the term a proposal is offered for.",
    synonyms: ["open proposals", "public proposals", "proposal link", "term"],
    route: PUT("/api/admin/open-proposals/settings"),
    fields: [text("publicLink", "Public link"), text("term", "Term")],
    partial: true,
  },
  {
    id: "hall.open-proposals.new-link", tab: "submissions", power: "intake.moderate",
    title: "Make a private proposal link",
    help: "Make a link you hand to one person or one group so they can propose.",
    synonyms: ["proposal link", "private link", "invite to propose"],
    route: POST("/api/admin/open-proposals/links"),
    fields: [text("label", "Who the link is for")],
  },
  {
    id: "hall.open-proposals.revoke-link", tab: "submissions", power: "intake.moderate",
    title: "Withdraw a proposal link",
    help: "Stop a private proposal link from working.",
    synonyms: ["revoke link", "withdraw link", "turn off link"],
    route: POST("/api/admin/open-proposals/links/:id/revoke"),
  },
  {
    id: "hall.open-proposals.transcribe", tab: "submissions", power: "intake.moderate",
    title: "Write down the voice notes that are waiting",
    help: "Have every waiting voice note on an open proposal written down as text.",
    synonyms: ["transcribe", "voice notes", "recordings", "write down"],
    route: POST("/api/admin/open-proposals/voice/transcribe-waiting"),
  },

  // ── Feedback, claims and reports ─────────────────────────────────────────
  {
    id: "hall.feedback.set-status", tab: "feedback", power: "admin", holder: "intake.moderate",
    title: "Mark feedback as read or done",
    help: "Set where a note of feedback stands.",
    synonyms: ["feedback", "bug report", "suggestion", "mark done", "triage"],
    route: PUT("/api/admin/feedback/:id"),
    fields: [text("status", "Status")],
  },
  {
    id: "hall.reports.forum", tab: "reports", module: "forum", parity: ["A6"], power: "intake.moderate",
    title: "Answer a reported forum post",
    help: "Mark a reported post as resolved or dismissed. The person who reported it is told it was looked at.",
    synonyms: ["reported post", "flagged post", "moderation", "forum report", "reports"],
    route: PUT("/api/admin/forum/reports/:id"),
    fields: [choice("status", "Outcome", ["resolved", "dismissed"])],
  },
  {
    id: "hall.reports.message", tab: "reports", module: "messaging", parity: ["A7"], power: "intake.moderate",
    title: "Answer a reported message",
    help: "Mark a reported message as resolved or dismissed.",
    synonyms: ["reported message", "flagged message", "message report", "reports"],
    route: PUT("/api/admin/messages/reports/:id"),
    fields: [text("status", "Outcome")],
  },

  // ── The guide's drafts ───────────────────────────────────────────────────
  {
    id: "hall.drafts.accept", tab: "drafts", power: "admin", holder: "operator.config",
    title: "Accept one of the guide's drafts",
    help: "Accept a draft the guide wrote, such as a role or a circle. You can edit it first.",
    synonyms: ["her drafts", "guide drafts", "accept draft", "role draft", "circle draft"],
    route: POST("/api/admin/drafts/:id/accept"),
    partial: true,
  },
  {
    id: "hall.drafts.reject", tab: "drafts", power: "admin", holder: "operator.config",
    title: "Drop one of the guide's drafts",
    help: "Drop a draft the guide wrote, with a note saying why.",
    synonyms: ["reject draft", "drop draft", "decline draft"],
    route: POST("/api/admin/drafts/:id/reject"),
    fields: [long("note", "Why")],
  },

  // ── Structure review and second signatures ───────────────────────────────
  {
    id: "hall.structure.accept", parity: ["H4"], path: "/review", power: "intake.moderate",
    title: "Accept structure changes from a sync",
    help: "Accept the circles and roles a sync proposed, one batch at a time, after a dry run.",
    synonyms: ["structure review", "sync", "batch", "circles and roles", "dry run"],
    route: POST("/api/review/batches/:batchId/structure/accept"),
    fields: [list("ids", "The changes to accept")],
    partial: true,
  },
  {
    id: "hall.keys.cosign", parity: ["D14"], path: "/setup-game", power: "admin",
    title: "Co-sign a production key",
    help: "Give the second signature a production key waits for. It takes a second admin, signed in as themselves.",
    synonyms: ["co-sign", "second signature", "production key", "waiting keys", "sign key"],
    route: POST("/api/admin/planting-requests/:id/cosign"),
  },
  {
    id: "hall.keys.decline", parity: ["D15"], path: "/setup-game", power: "admin",
    title: "Decline a production key",
    help: "Refuse a production key that waits for a second signature.",
    synonyms: ["decline key", "refuse key", "object to key"],
    route: POST("/api/admin/planting-requests/:id/decline"),
  },
]);
