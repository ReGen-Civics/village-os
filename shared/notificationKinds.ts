/**
 * WHAT EVERY KIND OF NOTICE IS ABOUT, in one place.
 *
 * The notification spine (server/lib/notify.ts) carries a `type` on every row
 * and never says what one means. That was fine while the bell was a flat list
 * of titles; it is not fine once the bell groups, batches and rations
 * celebration, because all three of those are decisions about the KIND and
 * not about the row.
 *
 * So each type declares four things (the two that are words, `blurb` and
 * `many`, live in shared/notificationKindWords.ts, keyed by the same ids; see
 * WHY THE WORDS LIVE APART below):
 *
 *  - `group`     which part of village life it belongs to, so twenty rows read
 *                as five sections instead of one scroll;
 *  - `blurb`     one line saying why a notice of this kind matters. Shown
 *                under a row that carries no body of its own, which is where
 *                the reader most needs it. NN/g's rule for notification copy
 *                is self-sufficiency: a notice is not about something the
 *                reader just did, so it must carry its own context
 *                (docs/NOTIFICATION_RESEARCH.md, part 1 section 3);
 *  - `many`      the batched line, with `{n}` standing in for the count, so a
 *                burst of the same kind reads as ONE line;
 *  - `celebrate` whether this kind is rare enough to earn a moment. FOUR are.
 *
 * And one kind declares a fifth, `wordsInAppOnly`: its body is a member's own
 * words, which never leave by email, so the bell shows them whole.
 *
 * Some kinds declare `waits`: the notice asks something of its reader (a vote
 * owed, a consent round, an applicant waiting for a conversation, a task held,
 * a person asking). While one of those is unread, a firefly rests on the bell
 * (sitewide grammar: fireflies mean "something here waits on you"). Every
 * other kind is news, and news gets a still dot until the panel is opened.
 * Errors, monitoring and money alerts are deliberately not `waits`: fireflies
 * never sit on an error state or beside money.
 *
 * THE CELEBRATION RATION IS THE POINT OF THIS FILE. A stage crossed, a ballot
 * carried, a cycle settled, a quest consented. Everything else gets a quiet
 * line. The natural kit's contract says the same in its own words
 * (docs/modules/natural-interface.md): celebration on every action becomes
 * wallpaper, and then the rare event has nothing left to say with.
 *
 * WHY THE WORDS LIVE APART. The bell, its light and the toasts ride every
 * page's first view, and they need a kind's group and flags only. The blurbs
 * and batched lines are most of this catalogue's weight and are read only
 * when a member opens the bell, so they load then (client/src/lib/noticeKindWords.ts).
 * The server and the admin panel import them directly. Every id here has its
 * words there and nothing more (shared/notificationKinds.test.ts).
 *
 * An unknown type degrades to the village group with a generic line, so a
 * type added by a future module renders correctly before anyone edits this.
 */

export const NOTIFICATION_GROUPS = [
  {
    id: "decisions",
    title: "Decisions",
    blurb: "What the village is deciding, and what it decided.",
  },
  {
    id: "economy",
    title: "Economy",
    blurb: "Value that moved, and value that is owed.",
  },
  {
    id: "work",
    title: "Work",
    blurb: "Quests claimed, finished, and consented.",
  },
  {
    id: "people",
    title: "People",
    blurb: "Somebody reached for you by name.",
  },
  {
    id: "village",
    title: "The village",
    blurb: "Everything the village is keeping for you.",
  },
] as const;

export type NotificationGroupId = (typeof NOTIFICATION_GROUPS)[number]["id"];

export interface NotificationKind {
  group: NotificationGroupId;
  /** Rare enough to earn a celebration. Four kinds are; the rest are quiet. */
  celebrate: boolean;
  /**
   * The body is a member's own words, and they are read in the app alone.
   * The email for such a kind carries the title and never the body
   * (`emailCarriesBody` in server/lib/notify.ts), so the bell is the one place
   * its recipient can read them: the bell never batches such a row, since a
   * batched row shows titles only, and never cuts its body short. One kind
   * is: a restorative intake.
   */
  wordsInAppOnly?: true;
  /**
   * The notice asks something of its reader, and it keeps asking until they
   * read it: an answer, a consent, a conversation to book, a task to do. The
   * bell lights a firefly while one is unread. Absent means news.
   */
  waits?: true;
}

export const NOTIFICATION_KINDS: Record<string, NotificationKind> = {
  // ── Decisions ─────────────────────────────────────────────────────────────
  ballot_opened: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  /*
   * Village Comms 5.10: a host asked you to pick the times you can make for
   * a gathering. Decisions, because the time with the most picks becomes the
   * gathering's time.
   */
  time_poll_open: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  /*
   * Change requests (Rye, 2026-11-06). `change_request_review` asks a holder
   * of a power the changes touch to look, like a code owner;
   * `change_request` tells a member about a note, an answer or an edit on a
   * change request they wrote or wrote in.
   */
  change_request_review: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  change_request: {
    group: "decisions",
    celebrate: false,
  },
  ballot_closing: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  ballot_carried: {
    group: "decisions",
    celebrate: true,
  },
  // A carried vote whose decision did not take effect at the close
  // (server/lib/atCloseLanding.ts). Its own kind, because `ballot_carried` says
  // what was voted on now applies and celebrates, and neither is true yet. The
  // roll hears `ballot_carried` from the landing job once it is.
  ballot_not_yet_in_effect: {
    group: "decisions",
    celebrate: false,
  },
  ballot_failed: {
    group: "decisions",
    celebrate: false,
  },
  // Its own kind, and this is not a nicety. Too few answering is a different
  // fact from the village saying no, and while a missed quorum fired
  // `ballot_failed` the line under it read "The village said no" about a vote
  // that had settled nothing.
  ballot_no_quorum: {
    group: "decisions",
    celebrate: false,
  },
  // The quorum fallback (0334): too few answered, so the same question is open
  // again on a linked ballot. Its own kind, because nothing was decided and the
  // member is being asked to vote, which `ballot_no_quorum` does not ask.
  ballot_rerun_opened: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  ballot_withdrawn: {
    group: "decisions",
    celebrate: false,
  },
  // An advisory vote reaches a real verdict and executes nothing, so it takes
  // its own kind and stays out of `ballot_carried`, which is one of the four
  // that earn a celebration.
  ballot_advisory_closed: {
    group: "decisions",
    celebrate: false,
  },
  // The steward's one act. It does not celebrate: a village that carried
  // something already had its moment, and this is the last word on it rather
  // than a second one. There is no approval kind beside it, because nothing
  // waits for a steward: a carried decision lands on its own, and the seat can
  // only stop it inside the window before it does.
  ballot_vetoed: {
    group: "decisions",
    celebrate: false,
  },
  /*
   * THE THREE WINDOW NOTICES, and they are three types rather than one for a
   * reason that is entirely about the mail.
   *
   * Every governance type resolves to the governance email preference, which
   * defaults to DAILY. A daily digest is right for a ballot opening: its
   * window is measured in days. It is wrong for these: the last one is sent
   * two hours before a change the village carried takes effect, so a digest
   * tomorrow arrives after the door it names has shut. Their own types let
   * `emailCadenceFor` pin all three to "immediate" without making every other
   * governance notice immediate with them.
   *
   * They go to the seated stewards and to nobody else, and none of them
   * celebrates: a countdown is not a moment.
   */
  veto_window_opened: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  veto_window_halfway: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  veto_window_closing: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  ballot_expired: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  governance: {
    group: "decisions",
    celebrate: false,
  },
  // In the bell only (no case in emailCadenceFor): one reminder, two days on,
  // to a seat holder an application still waits on (shared/waitingOnYou.ts).
  seat_application_reminder: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  // One member asked another to do something, or the one asked answered it
  // (shared/memberAsks.ts). Quiet: an ask is a small thing between two people.
  ask: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  // How much your vote weighs is power, and the weight routes moved it for a
  // year while telling the person it belonged to nothing at all. The trail was
  // readable the whole time, which is a different thing from being told: a
  // member has to already suspect something changed before a trail helps them.
  // The reason was required at the point of the change and now reaches the one
  // person it was written for. Quiet, per R52: this is a fact somebody needs,
  // and no part of it is a celebration.
  weight_changed: {
    group: "decisions",
    celebrate: false,
  },
  role_appointed: {
    group: "decisions",
    celebrate: false,
  },
  season: {
    group: "decisions",
    celebrate: false,
  },
  season_ending: {
    group: "decisions",
    celebrate: false,
  },
  // Season plans (2026-10-09). Quiet, both: planning is an ask, never a moment.
  season_plan_open: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  season_plan_reminder: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  // Role proposals (2026-10-22). In the bell only (no case in emailCadenceFor):
  // the feedback is read on the draft, which only its owner opens.
  role_proposal_feedback: {
    group: "people",
    celebrate: false,
  },
  // The circle's 2 business days to consent or object (role proposals PR B),
  // and an objection reaching the candidate. Bell only, like the tension pair:
  // neither has a case in emailCadenceFor.
  role_proposal_consent_ask: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  role_proposal_objection: {
    group: "decisions",
    celebrate: false,
  },
  // A role proposal from somebody with no account yet (open proposals part
  // B), once its address confirmed it. Bell only, like the member pair above.
  open_role_proposal_consent_ask: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  // The answer on an agent's proposal, to the member who keeps the agent
  // (0374, server/routes/openProposalDecide.ts). Bell only: an agent's proposal
  // has no address to email.
  open_role_proposal_decided: {
    group: "decisions",
    celebrate: false,
  },
  // An update about a role proposal, for the person who made it, once they
  // have an account. Bell only (no case in emailCadenceFor): the same words
  // already went to their address as an email, so a digest would be a third.
  applicant_update: {
    group: "decisions",
    celebrate: false,
  },
  open_role_proposal_waiting: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  // Review, conversations and selection (role journey L5). Bell only. None of
  // these carries a score, a name or an address; they say a role is waiting.
  application_interview_turn: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  application_arrived: {
    group: "decisions",
    celebrate: false,
  },
  application_first_reply_due: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  application_stale: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  // The applicant's invitation expired and they asked for a new one (their
  // status page's door). Nothing is reissued by itself: a holder makes it.
  application_new_invitation_asked: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  // The three nudges to propose roles for next season. Bell only; the
  // profile banner says the same thing for as long as it is true.
  role_proposal_window_open: {
    group: "decisions",
    celebrate: false,
  },
  role_proposal_review_due: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  role_proposal_window_closing: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  role_access: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  term_expiring: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  submission: {
    group: "decisions",
    celebrate: false,
    waits: true,
  },
  submission_status: {
    group: "decisions",
    celebrate: false,
  },

  // ── Economy ───────────────────────────────────────────────────────────────
  cycle_settled: {
    group: "economy",
    celebrate: true,
  },
  /**
   * 0092: one member sent another member credits. Never celebrated: at a
   * farmers market this is dozens of small notices a week, and celebration
   * that arrives every time is the wallpaper the ration exists to prevent.
   */
  wallet: {
    group: "economy",
    celebrate: false,
  },
  /**
   * The two ends of a redemption (`server/routes/redemption.ts`). A member
   * asked for tokens to become something off the platform, and a steward has
   * now said whether it happened.
   *
   * NEITHER IS CELEBRATED, and the confirmation least of all. A confirmation
   * is a steward saying the off-platform half took place; the platform is the
   * witness and never the guarantor, and a celebration would read as the
   * platform vouching for a payment it cannot see. The refusal is not
   * celebrated for the obvious reason, and it carries the steward's own note
   * as its body, so the member is told why by the person who decided.
   */
  redemption_confirmed: {
    group: "economy",
    celebrate: false,
  },
  redemption_refused: {
    group: "economy",
    celebrate: false,
  },
  /**
   * The village marked cash it owed you as paid (0285, server/routes/cashOwed.ts).
   * The body is the treasurer's own note on how it was paid. Not celebrated,
   * for redemption's reason: the platform records the payment and never sees it.
   */
  /**
   * The end-of-moon review (module moon-review, server/lib/moonReview.ts): a
   * recap returned, approved, a range changed, a self-approval to review, and
   * "Your pay is sent". The title carries the contract's own words.
   */
  moon_review: {
    group: "work",
    celebrate: false,
  },
  /**
   * Once a day, what Sera's agent did since the last summary (B7,
   * server/lib/seraAgent.ts). Sent to the live holders of moon.approve and
   * moon.approve_alone, never to an agent account. Each action can be undone
   * for 30 days from the Sera bridge panel.
   */
  sera_agent_digest: {
    group: "work",
    celebrate: false,
  },
  cash_paid: {
    group: "economy",
    celebrate: false,
  },
  exchange: {
    group: "economy",
    celebrate: false,
  },
  payment: {
    group: "economy",
    celebrate: false,
  },
  payments_alert: {
    group: "economy",
    celebrate: false,
  },
  // The failed-actions report, at most once a day. Never celebrated: a list of
  // what is broken is a chore to get through, not a moment.
  failed_action: {
    group: "village",
    celebrate: false,
  },
  stays: {
    group: "economy",
    celebrate: false,
  },
  library: {
    group: "economy",
    celebrate: false,
  },

  // ── Work ──────────────────────────────────────────────────────────────────
  quest_claimed: {
    group: "work",
    celebrate: false,
  },
  quest_submitted: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  quest_consented: {
    group: "work",
    celebrate: true,
  },
  quest_declined: {
    group: "work",
    celebrate: false,
  },
  quest_idea_on_board: {
    group: "work",
    celebrate: false,
  },
  quest_idea_declined: {
    group: "work",
    celebrate: false,
  },
  quest_help: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  call_task_suggested: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  // Live Sessions (server/lib/liveSessions.ts): a session closed, and an action
  // it left with is held by you, or by a seat you sit in.
  session_action_held: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  // The task layer (server/lib/sessionTaskMail.ts, server/lib/sessionTasks.ts):
  // a gentle note near a task's date, a task handed back to its circle, and a
  // task sitting with a seat nobody holds. None of them celebrate: each one
  // asks somebody to look at work, and none happened TO the reader.
  // Your own list (server/lib/memberTaskNudges.ts): a task near its date, and
  // a task somebody asked you for. In-app only; nothing celebrates.
  my_task_due: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  my_task_asked: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  session_action_due: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  session_task_back: {
    group: "work",
    celebrate: false,
  },
  session_task_unheld: {
    group: "work",
    celebrate: false,
  },
  // A tension raised with a role you hold (server/lib/roleTensions.ts), and
  // the one reminder after two business days. In the bell only: neither has
  // a case in emailCadenceFor, because the words are private to the role's
  // holders and whoever raised it, and neither notice carries them anyway.
  role_tension_raised: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  role_tension_reminder: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  // A task handed to a role (server/lib/roleTaskHandoffs.ts): it waits on the
  // role's holders, and the sender hears each answer and when it is done. By
  // email on the member's tasks preference (emailCadenceFor): the hand-on and
  // the answers that wait on somebody at its pace, an accept and a done in the
  // digest. Nothing celebrates: each is one person's answer to another.
  role_task_handed: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  role_task_accepted: {
    group: "work",
    celebrate: false,
  },
  role_task_edited: {
    group: "work",
    celebrate: false,
  },
  role_task_declined: {
    group: "work",
    celebrate: false,
  },
  role_task_done: {
    group: "work",
    celebrate: false,
  },
  // The agenda library (server/lib/sessionLibrary.ts): an item a member
  // brought for a circle went onto a session's agenda, and how it left that
  // session. Neither celebrates: each is an answer to somebody who raised
  // something, and it reads as one.
  session_item_taken: {
    group: "work",
    celebrate: false,
  },
  // A circle's rhythm (server/lib/sessionRhythm.ts): the day before a circle
  // meets, its members hear when, with what is on the agenda.
  session_coming_up: {
    group: "work",
    celebrate: false,
  },
  // The advice process (shared/sessionAdvice.ts): somebody asks a circle you
  // are part of for advice, the asker hears each new piece of advice, and the
  // people asked hear what was decided.
  session_advice_asked: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  session_advice_given: {
    group: "work",
    celebrate: false,
  },
  session_advice_decided: {
    group: "work",
    celebrate: false,
  },
  // A facilitator filled in for a member (0288, shared/sessionOnBehalf.ts):
  // the person hears what went in under their name, and can undo it.
  session_filled_in: {
    group: "work",
    celebrate: false,
  },
  // A night on a proposal (0281): whoever asked for one hears where to answer
  // once the call has closed, and the facilitator hears when no night lasts.
  session_night_open: {
    group: "work",
    celebrate: false,
    waits: true,
  },
  session_night_settled: {
    group: "work",
    celebrate: false,
  },
  session_item_settled: {
    group: "work",
    celebrate: false,
  },

  // ── People ────────────────────────────────────────────────────────────────
  // Rites (module `rites`, server/routes/rites.ts): the steps of passage a village names.
  rite_witness_asked: {
    group: "people",
    celebrate: false,
    waits: true,
  },
  rite_stamped: {
    group: "people",
    celebrate: false,
  },
  rite_buddy_paired: {
    group: "people",
    celebrate: false,
  },
  rite_door_request: {
    group: "people",
    celebrate: false,
    waits: true,
  },
  arrival: {
    group: "people",
    /*
     * NOT CELEBRATED, and I had this wrong on the first pass.
     *
     * A new person joining is rare and it matters, so `celebrate: true` felt
     * obviously right. The ration is four kinds and a test holds it there, and
     * this file's own header says why: celebration on every action becomes
     * wallpaper, and then the rare event has nothing left to say with. The four
     * are things that happened TO THE READER. An arrival is somebody else's
     * moment, and the greeter's job is to go and make it one in person.
     *
     * It reaches whoever holds the greeter seat (`arrival.greeter_role`), and
     * the founders when no seat is named or the seat sits vacant, so it is
     * never sent to everybody at once.
     */
    celebrate: false,
  },
  gratitude: {
    group: "people",
    celebrate: false,
  },
  /*
   * Village Comms, day 21 of a path (the comms build spec 5.11). The
   * emails have done what emails can do, and the path's contact person is
   * asked to write to somebody by name. People, because it is a person the
   * reader is asked to reach.
   */
  comms_path_handoff: {
    group: "people",
    celebrate: false,
    waits: true,
  },
  message: {
    group: "people",
    celebrate: false,
  },
  mention: {
    group: "people",
    celebrate: false,
  },
  forum_reply: {
    group: "people",
    celebrate: false,
  },
  thread_activity: {
    group: "people",
    celebrate: false,
  },
  introduction: {
    group: "people",
    celebrate: false,
    waits: true,
  },
  contact_request: {
    group: "people",
    celebrate: false,
    waits: true,
  },

  // ── The village ───────────────────────────────────────────────────────────
  stage_advanced: {
    group: "village",
    celebrate: true,
  },
  // The hidden map (0392): a member's map has opened. Said once, by its dedupe
  // key, with no place in it.
  hidden_map_opened: {
    group: "village",
    celebrate: false,
  },
  badge: {
    group: "village",
    celebrate: false,
  },
  // 0098. A badge's DEFINITION changed under the people holding it, so what
  // they can do changed with it. Every award left a trail and the definition
  // the awards answer to did not, which meant somebody gained or lost real
  // access and found out by trying. Not a celebration: an edit to a badge is
  // somebody else's housekeeping, and the holder needs the fact rather than
  // confetti.
  badge_definition_changed: {
    group: "village",
    celebrate: false,
  },
  // 0098. Somebody with an admin account acted on a power this village has
  // taken on, and you are one of the people holding it. The public record
  // carries the same fact; this is the tap on the shoulder, because a power
  // being reached past without its holder noticing is the failure the
  // witness exists to prevent.
  capability_override: {
    group: "decisions",
    celebrate: false,
  },
  waitlist_promoted: {
    group: "village",
    celebrate: false,
  },
  weekly_brief: {
    group: "village",
    celebrate: false,
  },
  feedback: {
    group: "village",
    celebrate: false,
  },
  // Live Sessions: to every admin, when a session closes and its record is kept.
  session_record_ready: {
    group: "village",
    celebrate: false,
  },
  moderation: {
    group: "village",
    celebrate: false,
  },
  /*
   * Village Comms (5.9): a gathering you hosted has ended and the people who
   * came are waiting to hear back. The village group, because the recap is
   * the village keeping its own record of what it did together.
   */
  comms_host_recap: {
    group: "village",
    celebrate: false,
    waits: true,
  },
  restorative_intake: {
    group: "village",
    celebrate: false,
    waits: true,
    wordsInAppOnly: true,
  },
  /*
   * One of the canvas's four key moments came round (shared/canvasRevisit.ts):
   * something new started, a partner arrived, the conflict pathway was used,
   * or the village is about to raise money. The notice names a block and asks
   * whether its answer still holds. It carries nobody's words, no name and no
   * count, and it goes out in the daily digest and never at once.
   */
  canvas_revisit: {
    group: "village",
    celebrate: false,
    waits: true,
  },
  exit_opened: {
    group: "village",
    celebrate: false,
  },
  health: {
    group: "village",
    celebrate: false,
  },
  tools: {
    group: "village",
    celebrate: false,
  },
  agent_inbox: {
    group: "village",
    celebrate: false,
  },
};

/** The fallback, so a type this file has never heard of still renders. */
export const UNKNOWN_KIND: NotificationKind = {
  group: "village",
  celebrate: false,
};

/**
 * The words for a kind with none of its own: an unheard-of type, and every
 * kind while the bell has not loaded its words yet (shared/notificationKindWords.ts).
 */
export const PLAIN_WORDS = {
  blurb: "Something the village keeps for you moved.",
  many: "{n} more notices.",
} as const;

export function kindOf(type: string): NotificationKind {
  return NOTIFICATION_KINDS[type] ?? UNKNOWN_KIND;
}

/**
 * True for a kind whose body is read in the app alone: its email is the title
 * and nothing more, and the bell shows each such row whole and on its own.
 * Read through `kindOf`, so an unknown type emails its body as before.
 */
export function wordsInAppOnly(type: string): boolean {
  return kindOf(type).wordsInAppOnly === true;
}

/**
 * True for a kind that asks something of its reader (`waits`). Read through
 * `kindOf`, so an unknown type is news by default: a new producer has to ask
 * for the bell's light by adding a line here.
 */
export function waitsOnYou(type: string): boolean {
  return kindOf(type).waits === true;
}

/**
 * Rare enough to earn a moment. Read through `kindOf`, so an unknown type is
 * quiet by default: a new producer has to ASK for a celebration by adding a
 * line here, and adding one is a decision somebody makes on purpose.
 */
export function celebrates(type: string): boolean {
  return kindOf(type).celebrate;
}

/** Which celebration the natural kit draws for a kind. Four kinds, four scenes. */
export function celebrationFor(type: string): "seeds" | "blossom" | "fireflies" | "dawn" | "ripples" {
  switch (type) {
    case "stage_advanced":
      return "dawn";
    case "ballot_carried":
      return "ripples";
    case "cycle_settled":
      return "fireflies";
    default:
      return "blossom";
  }
}
