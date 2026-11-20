/**
 * WHAT EACH KIND OF NOTICE SAYS: its blurb and its batched line.
 *
 * The kinds themselves, their groups and their flags, are declared in
 * shared/notificationKinds.ts, which the bell carries on every page. These
 * words are read only when somebody opens the bell (client/src/lib/noticeKindWords.ts
 * loads this file then), by the server, and by the admin panel, so they stay
 * off every page's first view. Every kind has its words here, keyed by the
 * same id, and nothing else is here (shared/notificationKinds.test.ts).
 *
 *  - `blurb`  one line saying why a notice of this kind matters, shown under
 *             a row that carries no body of its own;
 *  - `many`   the batched line, with `{n}` standing in for the count.
 */
import { PLAIN_WORDS } from "./notificationKinds";

export interface NotificationKindWords {
  /** Why a notice of this kind matters. One line, the object named. */
  blurb: string;
  /** The batched line. `{n}` is replaced with the count. */
  many: string;
}

export const NOTIFICATION_KIND_WORDS: Record<string, NotificationKindWords> = {
  ballot_opened: {
    blurb: "The village opened a vote and you are on the roll for it. Your answer counts toward the outcome.",
    many: "{n} votes opened, and you are on the roll for each one.",
  },
  agent_full_access: {
    blurb: "Full access for one role's agent was turned on or off. With it on, that role's agent can make admin changes and accept proposals for the role holder, each one carrying their approval.",
    many: "{n} changes to the full access an agent holds.",
  },
  time_poll_open: {
    blurb: "Pick the times you can make. The time with the most picks becomes the gathering's time.",
    many: "{n} gatherings are choosing a time.",
  },
  change_request_review: {
    blurb: "A change request touches what your role looks after. Ask, raise a concern or an objection, suggest an edit, or say you can live with it.",
    many: "{n} change requests are asking for your review.",
  },
  change_request: {
    blurb: "Something new on a change request you are part of. Open it to read and answer.",
    many: "{n} updates on change requests you are part of.",
  },
  ballot_closing: {
    blurb: "The window is closing and your vote is still owed. Quorum is measured against everyone on the roll.",
    many: "{n} votes close soon and are still waiting on your answer.",
  },
  ballot_carried: {
    blurb: "The village said yes. What was voted on now applies, and the closer wrote down why.",
    many: "{n} votes carried.",
  },
  ballot_not_yet_in_effect: {
    blurb: "The village said yes and the decision has not taken effect yet. The decision page says what happens next.",
    many: "{n} carried votes have not taken effect yet.",
  },
  ballot_failed: {
    blurb: "The village said no. The closer wrote down the reasoning, and it stands on the record.",
    many: "{n} votes closed without passing.",
  },
  ballot_no_quorum: {
    blurb: "Too few of the roll answered for this to settle anything. The question stands, and it can be asked again.",
    many: "{n} votes closed with too few answering to settle them.",
  },
  ballot_rerun_opened: {
    blurb: "Too few answered a vote you are on the roll for, so it is open again for as long as before, and half as many voices are enough this time.",
    many: "{n} votes are open again with too few having answered.",
  },
  ballot_withdrawn: {
    blurb: "A vote you were on the roll for was called off before it closed. Nothing was decided, and the reason is on the record.",
    many: "{n} votes were called off.",
  },
  ballot_advisory_closed: {
    blurb: "An advisory vote closed. It records what the village would decide, and nothing changed on its own.",
    many: "{n} advisory votes closed.",
  },
  ballot_vetoed: {
    blurb: "A steward stopped a decision the village carried, inside its window, and said why.",
    many: "{n} decisions were stopped, each with a reason.",
  },
  veto_window_opened: {
    blurb: "The village carried a decision and your window to stop it is open. The page names the instant it lands.",
    many: "{n} carried decisions are inside their window.",
  },
  veto_window_halfway: {
    blurb: "Half of your window to stop a carried decision has gone. It lands at its instant unless somebody stops it.",
    many: "{n} windows are half gone.",
  },
  veto_window_closing: {
    blurb: "Two hours left to stop a carried decision. After that it lands and the door is closed.",
    many: "{n} windows close within two hours.",
  },
  ballot_expired: {
    blurb: "A voting window ran out with nobody closing it. Closing is a human act, so the ballot waits for one.",
    many: "{n} votes are past their window and waiting for someone to close them.",
  },
  governance: {
    blurb: "A proposal you raised, or one the village is carrying, moved a step.",
    many: "{n} proposals moved.",
  },
  seat_application_reminder: {
    blurb: "An application for a role still waits on a role holder, and you hold that power.",
    many: "{n} applications still wait on a role holder.",
  },
  ask: {
    blurb: "Someone asked you to do something, or answered something you asked.",
    many: "{n} asks moved.",
  },
  weight_changed: {
    blurb: "How much your vote weighs was changed, and whoever changed it said why.",
    many: "{n} changes to how much your vote weighs.",
  },
  role_appointed: {
    blurb: "A role is yours to hold. The role page says what it is accountable for.",
    many: "{n} roles came to you.",
  },
  season: {
    blurb: "No season is running, so the calendar every term is measured against has stopped. Every mandate in the village hangs on it, the steward role included, so it says so until somebody starts the next one.",
    many: "The calendar has been stopped for {n} sweeps.",
  },
  season_ending: {
    blurb: "The season turns soon. Before it does, the village records what this season did and seats people for the next one, so the reminders start two weeks out.",
    many: "{n} reminders that the season is turning.",
  },
  season_plan_open: {
    blurb: "Planning is open for the season. Choose the roles you keep, hand back or apply for, and what you will do.",
    many: "{n} notices that planning is open.",
  },
  season_plan_reminder: {
    blurb: "Your season plan is not filed yet. Filing takes a few minutes, and the village sees it by name.",
    many: "{n} reminders to file your season.",
  },
  role_proposal_feedback: {
    blurb: "A member who has the link to your role proposal left feedback on it. Open the draft to read it.",
    many: "{n} pieces of feedback on your role proposal.",
  },
  role_proposal_consent_ask: {
    blurb: "A member proposes roles in a circle you hold a role in. Consent or object within 2 business days.",
    many: "{n} role proposals ask your circle to consent.",
  },
  role_proposal_objection: {
    blurb: "A member of the circle objected to your role proposal, so it goes to the circle's next meeting.",
    many: "{n} objections to your role proposals.",
  },
  open_role_proposal_consent_ask: {
    blurb: "Somebody from outside the village proposes to hold roles in a circle you hold a role in. Consent or object within 2 business days.",
    many: "{n} role proposals from outside the village ask your circle to consent.",
  },
  open_role_proposal_decided: {
    blurb: "The village answered a proposal for an agent you keep: seated on its roles, or declined.",
    many: "{n} answers on proposals for agents you keep.",
  },
  applicant_update: {
    blurb: "An update about a role you proposed to hold: a reply, a conversation, the circle weighing it, or the answer.",
    many: "{n} updates about your role proposals.",
  },
  open_role_proposal_waiting: {
    blurb: "Somebody from outside the village proposes to hold roles. You hold the power to place people in roles, so it is yours to adopt or decline.",
    many: "{n} role proposals from outside the village wait on you.",
  },
  application_interview_turn: {
    blurb: "An applicant is waiting to talk with a role you hold. Book the conversation, then write your scorecard alone.",
    many: "{n} applicants wait to talk with you.",
  },
  application_arrived: {
    blurb: "An application arrived for a role in a circle you hold a role in. You are asked to consent after the conversations.",
    many: "{n} applications arrived in your circles.",
  },
  application_first_reply_due: {
    blurb: "An applicant is owed a first reply within 3 business days.",
    many: "{n} applicants are owed a first reply.",
  },
  application_stale: {
    blurb: "An application has not moved for ten days. A person decides what happens next.",
    many: "{n} applications have not moved for ten days.",
  },
  application_references_in: {
    blurb: "An applicant sent their references. Pick who follows up with each one.",
    many: "{n} applications have references waiting for follow-up owners.",
  },
  application_reference_owner: {
    blurb: "You follow up with a reference for an applicant. Read how to reach them on the application, then write your notes.",
    many: "{n} references wait for your follow-up.",
  },
  application_references_asked: {
    blurb: "Your application is for your first long-term role, so references are asked. Add them on your application's page.",
    many: "{n} of your applications ask for references.",
  },
  application_new_invitation_asked: {
    blurb: "An applicant's invitation to join the team expired, and they asked for a new one. You can make it on their proposal's page.",
    many: "{n} applicants asked for a new invitation.",
  },
  role_proposal_window_open: {
    blurb: "Planning for next season is open. Propose the roles you will hold.",
    many: "{n} notices that you can propose your roles.",
  },
  role_proposal_review_due: {
    blurb: "One of your roles is due its review. Propose how you will hold it next season.",
    many: "{n} roles due their review.",
  },
  role_proposal_window_closing: {
    blurb: "Your role proposal is still a draft, and the window closes in 2 business days.",
    many: "{n} reminders that the window closes soon.",
  },
  role_access: {
    blurb: "Access to give or take back for a role: a shared drive, a portal, a list. Open the task and mark it done once you have done it in the tool itself.",
    many: "{n} access tasks are waiting for you.",
  },
  term_expiring: {
    blurb: "The agreement to keep holding your role is running out. In a role that carries permissions those end with the term (0171), so it is the moment to renew or hand it on.",
    many: "{n} of your terms are running out.",
  },
  submission: {
    blurb: "Somebody raised a hand for a role or a power, and the village owes them an answer.",
    many: "{n} people raised a hand for a role or a power.",
  },
  submission_status: {
    blurb: "An answer came back on something you applied for, offered, or raised a hand for.",
    many: "{n} answers came back on things you put forward.",
  },
  cycle_settled: {
    blurb: "A lunation closed, and its pool was split by the recognition people sent you inside it.",
    many: "{n} cycles settled with a share for you.",
  },
  wallet: {
    blurb: "Somebody sent you credits, and they are in your balance now.",
    many: "{n} people sent you credits.",
  },
  redemption_confirmed: {
    blurb: "A steward confirmed your redemption, and those tokens are gone from your balance.",
    many: "{n} of your redemptions were confirmed.",
  },
  redemption_refused: {
    blurb: "A redemption was not confirmed, and the tokens it held are back in your wallet.",
    many: "{n} of your redemptions were not confirmed.",
  },
  moon_review: {
    blurb: "Your moon recap moved: returned, approved, or paid.",
    many: "{n} updates on moon recaps.",
  },
  sera_agent_digest: {
    blurb: "What Sera's agent changed since the last summary, each one undoable for 30 days.",
    many: "{n} summaries of what Sera's agent did.",
  },
  cash_paid: {
    blurb: "The village marked cash it owed you as paid.",
    many: "{n} cash payments were marked paid.",
  },
  exchange: {
    blurb: "An exchange order settled, and what you bought is in your wallet.",
    many: "{n} exchange orders settled.",
  },
  payment: {
    blurb: "A receipt for something bought, renewed, or reversed.",
    many: "{n} receipts landed.",
  },
  payments_alert: {
    blurb: "Something about money needs a person: a hold lifted, a signature refused, a charge disputed.",
    many: "{n} money matters need a look.",
  },
  failed_action: {
    blurb: "Something in the village keeps failing, and the report says what to do about it.",
    many: "{n} reports of things failing in the village.",
  },
  stays: {
    blurb: "Your stay: nights posting, credits arriving, or a balance running low.",
    many: "{n} things moved on your stay.",
  },
  library: {
    blurb: "A borrowed thing: due back, settled, or credits released for what you gave.",
    many: "{n} library items moved.",
  },
  quest_claimed: {
    blurb: "You took on a quest. The quest shows who to talk to, your first task, your crew link and the date.",
    many: "You took on {n} quests.",
  },
  quest_submitted: {
    blurb: "Somebody finished work and it is waiting to be read. Value moves when a steward says so.",
    many: "{n} pieces of finished work are waiting to be read.",
  },
  quest_consented: {
    blurb: "A steward read your work and released what it was worth.",
    many: "{n} of your quests were consented.",
  },
  quest_declined: {
    blurb: "A claim was released, and the quest is open again for whoever wants it next.",
    many: "{n} claims were released.",
  },
  quest_idea_on_board: {
    blurb: "A steward put the quest you proposed on the board, where anyone can take it on.",
    many: "{n} of your quest ideas went on the board.",
  },
  quest_idea_declined: {
    blurb: "A steward read the quest you proposed and left it off the board. You are welcome to propose another.",
    many: "{n} of your quest ideas were left off the board.",
  },
  quest_help: {
    blurb: "Somebody flagged that they are stuck or wobbling on work they took on.",
    many: "{n} people asked for a hand on work they took on.",
  },
  call_task_suggested: {
    blurb: "A call turned into a suggested task with your name on it. Accept or decline on the thread; nothing happens on its own.",
    many: "{n} tasks were suggested to you from calls.",
  },
  session_action_held: {
    blurb: "A live session closed with an action held by you or by a role you sit in. The notice says what it is and by when.",
    many: "{n} actions from live sessions are held by you or your roles.",
  },
  my_task_due: {
    blurb: "A task on your own list is due soon. Open your list to see it.",
    many: "{n} tasks on your list are due soon.",
  },
  my_task_asked: {
    blurb: "Someone asked you for a task on your own list. Open your list to see who.",
    many: "{n} tasks on your list are waiting on you.",
  },
  session_action_due: {
    blurb: "A task you hold from a live session is near its date, or its date just passed. Answer it on your task board.",
    many: "{n} tasks you hold are near their dates.",
  },
  session_task_back: {
    blurb: "A task from a session you facilitated was handed back. It comes up at the circle's next action check.",
    many: "{n} tasks came back to their circles.",
  },
  session_task_unheld: {
    blurb: "A task from a live session sits with a role nobody holds now. Give it to someone at the next call.",
    many: "{n} tasks sit with roles nobody holds.",
  },
  role_tension_raised: {
    blurb: "A member raised a tension with a role you hold. Only the role's holders and whoever raised it can read it.",
    many: "{n} tensions were raised with roles you hold.",
  },
  role_tension_reminder: {
    blurb: "A tension raised with a role you hold has waited 2 business days. Take it, answer it, or bring it to the circle.",
    many: "{n} tensions with your roles have waited 2 business days.",
  },
  role_task_handed: {
    blurb: "A task was handed to a role you hold. Accept it, suggest a change, or decline it under Waiting on you.",
    many: "{n} tasks were handed to roles you hold.",
  },
  role_task_accepted: {
    blurb: "A role accepted a task you handed it. It sits on their list now.",
    many: "{n} tasks you handed on were accepted.",
  },
  role_task_edited: {
    blurb: "A role suggested a change to a task you handed it. See it under Sent on your list.",
    many: "{n} tasks you handed on have a suggested change.",
  },
  role_task_declined: {
    blurb: "A role declined a task you handed it. The reason is under Sent on your list.",
    many: "{n} tasks you handed on were declined.",
  },
  role_task_done: {
    blurb: "A task you handed to a role is done.",
    many: "{n} tasks you handed on are done.",
  },
  session_item_taken: {
    blurb: "An agenda item you added is on a session's agenda now.",
    many: "{n} agenda items you added are on an agenda.",
  },
  session_coming_up: {
    blurb: "A circle you are part of meets soon. The notice says when, and what is on the agenda.",
    many: "{n} of your circles meet soon.",
  },
  session_advice_asked: {
    blurb: "Somebody asks a circle you are part of for advice before they decide. The notice says what they mean to decide.",
    many: "{n} requests for your advice.",
  },
  session_advice_given: {
    blurb: "Somebody you asked for advice gave it.",
    many: "{n} people gave advice on what you mean to decide.",
  },
  session_advice_decided: {
    blurb: "Somebody who asked for your advice decided. The notice says what they decided.",
    many: "{n} decisions made after asking for your advice.",
  },
  session_filled_in: {
    blurb: "The Facilitator filled something in for you during a session. You can change it or undo it there.",
    many: "{n} things the Facilitator filled in for you.",
  },
  session_night_open: {
    blurb: "You asked for a night on a proposal and the call has closed. The notice says where to answer, and by when.",
    many: "{n} proposals wait for your answer after a night.",
  },
  session_night_settled: {
    blurb: "A proposal from a session you facilitated waited for a night, and the night is over. The notice says how the round went.",
    many: "{n} rounds you facilitated are settled after a night.",
  },
  session_item_settled: {
    blurb: "A session that took up an agenda item you added has closed. The item says whether it was taken up or waits for next time.",
    many: "{n} sessions closed with agenda items you added.",
  },
  rite_witness_asked: {
    blurb: "A newcomer is ready for a rite, and you're asked to witness it from your phone.",
    many: "{n} rites are waiting for a witness.",
  },
  rite_stamped: {
    blurb: "A rite was stamped on a member's card.",
    many: "{n} rites were stamped.",
  },
  rite_buddy_paired: {
    blurb: "You were paired with a newcomer, to walk beside them through their first moon and their rites.",
    many: "{n} newcomers were paired with you.",
  },
  rite_door_request: {
    blurb: "Somebody asked to join through your printed code, and waits for your answer.",
    many: "{n} people asked to join through your code.",
  },
  arrival: {
    blurb: "Somebody joined the village. Greeting a new arrival is the first thing anybody here does for them.",
    many: "{n} people joined the village.",
  },
  gratitude: {
    blurb: "Somebody said thank you, and put their name to it.",
    many: "{n} people sent you appreciation.",
  },
  comms_path_handoff: {
    blurb: "Somebody has been on a path for three weeks. A note from a person is the next step.",
    many: "{n} people on a path are ready to hear from a person.",
  },
  message: {
    blurb: "Somebody wrote to you.",
    many: "{n} conversations have something new in them.",
  },
  mention: {
    blurb: "Somebody used your name in a thread and meant you to see it.",
    many: "{n} threads name you.",
  },
  forum_reply: {
    blurb: "Somebody answered you in a thread you are part of.",
    many: "{n} replies landed in threads you are part of.",
  },
  thread_activity: {
    blurb: "A thread you follow moved. Nothing in it needs you.",
    many: "{n} threads you follow moved.",
  },
  introduction: {
    blurb: "The village thinks two of you may be worth knowing. Yes or not now, both are whole answers.",
    many: "{n} introductions are waiting on you.",
  },
  contact_request: {
    blurb: "Somebody wants to reach you about a role you hold. They see a relay, never your address.",
    many: "{n} people want to reach you.",
  },
  stage_advanced: {
    blurb: "A door opened for you, and the notice names what you can now do.",
    many: "{n} doors opened.",
  },
  hidden_map_opened: {
    blurb: "Enough of your places are vouched for, and the whole map is open to you.",
    many: "{n} maps opened.",
  },
  badge: {
    blurb: "A mark on your profile, earned or placed, with what it means beside it.",
    many: "{n} marks on your profile changed.",
  },
  badge_definition_changed: {
    blurb: "A badge you hold carries something different now, and the line says what changed.",
    many: "{n} badges you hold were changed.",
  },
  capability_override: {
    blurb: "An admin acted on a power you hold. It is on the village's own record, with their name on it.",
    many: "{n} powers you hold were acted on from the admin panel.",
  },
  // Season places (shared/seasonPlaces.ts). Each names the circle and the season, never a person.
  season_place_waiting: {
    blurb: "A circle proposes to take part in a season, and you hold the power that says yes or puts it to the village.",
    many: "{n} season proposals wait on you.",
  },
  season_crew_applied: {
    blurb: "Somebody applied to take part this season with a circle you pick for.",
    many: "{n} people applied to take part with a circle you pick for.",
  },
  season_crew_picked: {
    blurb: "A circle picked you for its team this season.",
    many: "{n} circles picked you this season.",
  },
  season_crew_released: {
    blurb: "A circle released your place this season. Your application stands for any circle to pick.",
    many: "{n} circles released your place.",
  },
  season_place_placed: {
    blurb: "A circle you are in has a place in a season.",
    many: "{n} season places were confirmed.",
  },
  season_place_waitlisted: {
    blurb: "The season is full, so a circle you are in waits in line, and you will hear the moment a place opens.",
    many: "{n} circles you are in are on a season's waitlist.",
  },
  season_place_opened: {
    blurb: "A place opened in a season, and the line reached a circle you are in.",
    many: "{n} season places opened for circles you are in.",
  },
  season_place_declined: {
    blurb: "A circle you are in does not take part in a season it proposed for.",
    many: "{n} season proposals were not adopted.",
  },
  // Circle places at a gathering (shared/circlePlaces.ts).
  circle_place_going: {
    blurb: "A circle you are in is going to a gathering.",
    many: "{n} gatherings have a circle you are in going.",
  },
  circle_place_waiting: {
    blurb: "A gathering is full for circles, so a circle you are in waits in line, and you will hear the moment a place opens.",
    many: "{n} gatherings have a circle you are in on the waitlist.",
  },
  circle_place_opened: {
    blurb: "A place opened at a gathering, and the line reached a circle you are in.",
    many: "{n} gatherings found a place for a circle you are in.",
  },
  waitlist_promoted: {
    blurb: "A seat opened at a gathering you queued for, and the line reached you.",
    many: "{n} gatherings found you a seat.",
  },
  weekly_brief: {
    blurb: "What the week ahead holds, gathered once.",
    many: "{n} weekly briefs are waiting.",
  },
  feedback: {
    blurb: "A bug or an idea you sent in was triaged, and this is where it landed.",
    many: "{n} things you sent in were triaged.",
  },
  session_record_ready: {
    blurb: "A live session closed and its record is kept: the agenda, what was decided, who holds each action, and the backlog.",
    many: "{n} live session records are ready to read.",
  },
  moderation: {
    blurb: "Something was flagged for a steward to read, or a report you filed was closed.",
    many: "{n} reports moved.",
  },
  comms_host_recap: {
    blurb: "A gathering you hosted has ended. The people who came will hear from you once you write the recap.",
    many: "{n} gatherings you hosted are waiting for a recap.",
  },
  restorative_intake: {
    blurb: "Somebody reached out privately about a rupture. Same day matters for these.",
    many: "{n} private intakes are waiting.",
  },
  canvas_revisit: {
    blurb: "A key moment came round, and the canvas asks whether one of the village's answers still holds.",
    many: "{n} canvas answers are worth another look.",
  },
  exit_opened: {
    blurb: "A departure process opened. The published exit policy describes every step of it.",
    many: "{n} departure processes opened.",
  },
  health: {
    blurb: "A number the village watches moved further than the stewards asked to be told about.",
    many: "{n} health readings moved.",
  },
  tools: {
    blurb: "Links the village depends on stopped answering.",
    many: "{n} link sweeps found something broken.",
  },
  agent_inbox: {
    blurb: "Your agent inbox stopped answering, so deliveries to it were switched off.",
    many: "{n} notices about your agent inbox.",
  },
};

/** A kind's words, or the plain ones for a type this file has never heard of. */
export function kindWordsOf(type: string): NotificationKindWords {
  return NOTIFICATION_KIND_WORDS[type] ?? PLAIN_WORDS;
}

/** The batched line for `n` rows of one kind. `{n}` carries the count. */
export function manyLine(type: string, n: number): string {
  return kindWordsOf(type).many.replace("{n}", String(n));
}
