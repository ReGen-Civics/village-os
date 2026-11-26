/**
 * THE BELL'S WORDS IN THE READER'S LANGUAGE (the lead, 26 Nov 2026: a site wide Spanish audit).
 *
 * shared/notificationKindWords.ts holds each kind's blurb and batched line in English, and the server and the
 * admin panel read it there. The bell reads THESE: the same English as msg() descriptors, so the catalog carries
 * them and a reader in Spanish sees Spanish. client/src/lib/noticeKindWordsI18n.test.ts fails the moment one
 * English line here stops matching the shared table, or a kind is missing, so the two cannot drift.
 *
 * Loaded with the rest of the bell's words, when the bell first opens (client/src/lib/noticeKindWords.ts).
 * A village's own blurb for a kind (Admin, noticeBlurbs) is its own content and still wins over these.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it.
import { i18n as appI18n, setupI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/** Reads a descriptor's own English when no language has been started (a test, or a read before the app starts one). */
const ENGLISH = setupI18n({ locale: "en", messages: { en: {} } });

type Pair = { blurb: MessageDescriptor; many: MessageDescriptor };

export const KIND_WORDS_MSG: Readonly<Record<string, Pair>> = {
  "ballot_opened": {
    blurb: msg({ message: "The village opened a vote and you are on the roll for it. Your answer counts toward the outcome.", context: "the bell: why a notice of this kind matters, kind ballot_opened" }),
    many: msg({ message: "{n} votes opened, and you are on the roll for each one.", context: "the bell: several notices of one kind batched into a line, kind ballot_opened" }),
  },
  "agent_full_access": {
    blurb: msg({ message: "Full access for one role's agent was turned on or off. With it on, that role's agent can make admin changes and accept proposals for the role holder, each one carrying their approval.", context: "the bell: why a notice of this kind matters, kind agent_full_access" }),
    many: msg({ message: "{n} changes to the full access an agent holds.", context: "the bell: several notices of one kind batched into a line, kind agent_full_access" }),
  },
  "time_poll_open": {
    blurb: msg({ message: "Pick the times you can make. The time with the most picks becomes the gathering's time.", context: "the bell: why a notice of this kind matters, kind time_poll_open" }),
    many: msg({ message: "{n} gatherings are choosing a time.", context: "the bell: several notices of one kind batched into a line, kind time_poll_open" }),
  },
  "change_request_review": {
    blurb: msg({ message: "A change request touches what your role looks after. Ask, raise a concern or an objection, suggest an edit, or say you can live with it.", context: "the bell: why a notice of this kind matters, kind change_request_review" }),
    many: msg({ message: "{n} change requests are asking for your review.", context: "the bell: several notices of one kind batched into a line, kind change_request_review" }),
  },
  "change_request": {
    blurb: msg({ message: "Something new on a change request you are part of. Open it to read and answer.", context: "the bell: why a notice of this kind matters, kind change_request" }),
    many: msg({ message: "{n} updates on change requests you are part of.", context: "the bell: several notices of one kind batched into a line, kind change_request" }),
  },
  "ballot_closing": {
    blurb: msg({ message: "The window is closing and your vote is still owed. Quorum is measured against everyone on the roll.", context: "the bell: why a notice of this kind matters, kind ballot_closing" }),
    many: msg({ message: "{n} votes close soon and are still waiting on your answer.", context: "the bell: several notices of one kind batched into a line, kind ballot_closing" }),
  },
  "ballot_carried": {
    blurb: msg({ message: "The village said yes. What was voted on now applies, and the closer wrote down why.", context: "the bell: why a notice of this kind matters, kind ballot_carried" }),
    many: msg({ message: "{n} votes carried.", context: "the bell: several notices of one kind batched into a line, kind ballot_carried" }),
  },
  "ballot_not_yet_in_effect": {
    blurb: msg({ message: "The village said yes and the decision has not taken effect yet. The decision page says what happens next.", context: "the bell: why a notice of this kind matters, kind ballot_not_yet_in_effect" }),
    many: msg({ message: "{n} carried votes have not taken effect yet.", context: "the bell: several notices of one kind batched into a line, kind ballot_not_yet_in_effect" }),
  },
  "ballot_failed": {
    blurb: msg({ message: "The village said no. The closer wrote down the reasoning, and it stands on the record.", context: "the bell: why a notice of this kind matters, kind ballot_failed" }),
    many: msg({ message: "{n} votes closed without passing.", context: "the bell: several notices of one kind batched into a line, kind ballot_failed" }),
  },
  "ballot_no_quorum": {
    blurb: msg({ message: "Too few of the roll answered for this to settle anything. The question stands, and it can be asked again.", context: "the bell: why a notice of this kind matters, kind ballot_no_quorum" }),
    many: msg({ message: "{n} votes closed with too few answering to settle them.", context: "the bell: several notices of one kind batched into a line, kind ballot_no_quorum" }),
  },
  "ballot_rerun_opened": {
    blurb: msg({ message: "Too few answered a vote you are on the roll for, so it is open again for as long as before, and half as many voices are enough this time.", context: "the bell: why a notice of this kind matters, kind ballot_rerun_opened" }),
    many: msg({ message: "{n} votes are open again with too few having answered.", context: "the bell: several notices of one kind batched into a line, kind ballot_rerun_opened" }),
  },
  "ballot_withdrawn": {
    blurb: msg({ message: "A vote you were on the roll for was called off before it closed. Nothing was decided, and the reason is on the record.", context: "the bell: why a notice of this kind matters, kind ballot_withdrawn" }),
    many: msg({ message: "{n} votes were called off.", context: "the bell: several notices of one kind batched into a line, kind ballot_withdrawn" }),
  },
  "ballot_advisory_closed": {
    blurb: msg({ message: "An advisory vote closed. It records what the village would decide, and nothing changed on its own.", context: "the bell: why a notice of this kind matters, kind ballot_advisory_closed" }),
    many: msg({ message: "{n} advisory votes closed.", context: "the bell: several notices of one kind batched into a line, kind ballot_advisory_closed" }),
  },
  "ballot_vetoed": {
    blurb: msg({ message: "A steward stopped a decision the village carried, inside its window, and said why.", context: "the bell: why a notice of this kind matters, kind ballot_vetoed" }),
    many: msg({ message: "{n} decisions were stopped, each with a reason.", context: "the bell: several notices of one kind batched into a line, kind ballot_vetoed" }),
  },
  "veto_window_opened": {
    blurb: msg({ message: "The village carried a decision and your window to stop it is open. The page names the instant it lands.", context: "the bell: why a notice of this kind matters, kind veto_window_opened" }),
    many: msg({ message: "{n} carried decisions are inside their window.", context: "the bell: several notices of one kind batched into a line, kind veto_window_opened" }),
  },
  "veto_window_halfway": {
    blurb: msg({ message: "Half of your window to stop a carried decision has gone. It lands at its instant unless somebody stops it.", context: "the bell: why a notice of this kind matters, kind veto_window_halfway" }),
    many: msg({ message: "{n} windows are half gone.", context: "the bell: several notices of one kind batched into a line, kind veto_window_halfway" }),
  },
  "veto_window_closing": {
    blurb: msg({ message: "Two hours left to stop a carried decision. After that it lands and the door is closed.", context: "the bell: why a notice of this kind matters, kind veto_window_closing" }),
    many: msg({ message: "{n} windows close within two hours.", context: "the bell: several notices of one kind batched into a line, kind veto_window_closing" }),
  },
  "ballot_expired": {
    blurb: msg({ message: "A voting window ran out with nobody closing it. Closing is a human act, so the ballot waits for one.", context: "the bell: why a notice of this kind matters, kind ballot_expired" }),
    many: msg({ message: "{n} votes are past their window and waiting for someone to close them.", context: "the bell: several notices of one kind batched into a line, kind ballot_expired" }),
  },
  "governance": {
    blurb: msg({ message: "A proposal you raised, or one the village is carrying, moved a step.", context: "the bell: why a notice of this kind matters, kind governance" }),
    many: msg({ message: "{n} proposals moved.", context: "the bell: several notices of one kind batched into a line, kind governance" }),
  },
  "seat_application_reminder": {
    blurb: msg({ message: "An application for a role still waits on a role holder, and you hold that power.", context: "the bell: why a notice of this kind matters, kind seat_application_reminder" }),
    many: msg({ message: "{n} applications still wait on a role holder.", context: "the bell: several notices of one kind batched into a line, kind seat_application_reminder" }),
  },
  "ask": {
    blurb: msg({ message: "Someone asked you to do something, or answered something you asked.", context: "the bell: why a notice of this kind matters, kind ask" }),
    many: msg({ message: "{n} asks moved.", context: "the bell: several notices of one kind batched into a line, kind ask" }),
  },
  "weight_changed": {
    blurb: msg({ message: "How much your vote weighs was changed, and whoever changed it said why.", context: "the bell: why a notice of this kind matters, kind weight_changed" }),
    many: msg({ message: "{n} changes to how much your vote weighs.", context: "the bell: several notices of one kind batched into a line, kind weight_changed" }),
  },
  "role_appointed": {
    blurb: msg({ message: "A role is yours to hold. The role page says what it is accountable for.", context: "the bell: why a notice of this kind matters, kind role_appointed" }),
    many: msg({ message: "{n} roles came to you.", context: "the bell: several notices of one kind batched into a line, kind role_appointed" }),
  },
  "season": {
    blurb: msg({ message: "No season is running, so the calendar every term is measured against has stopped. Every mandate in the village hangs on it, the steward role included, so it says so until somebody starts the next one.", context: "the bell: why a notice of this kind matters, kind season" }),
    many: msg({ message: "The calendar has been stopped for {n} sweeps.", context: "the bell: several notices of one kind batched into a line, kind season" }),
  },
  "season_ending": {
    blurb: msg({ message: "The season turns soon. Before it does, the village records what this season did and seats people for the next one, so the reminders start two weeks out.", context: "the bell: why a notice of this kind matters, kind season_ending" }),
    many: msg({ message: "{n} reminders that the season is turning.", context: "the bell: several notices of one kind batched into a line, kind season_ending" }),
  },
  "season_plan_open": {
    blurb: msg({ message: "Planning is open for the season. Choose the roles you keep, hand back or apply for, and what you will do.", context: "the bell: why a notice of this kind matters, kind season_plan_open" }),
    many: msg({ message: "{n} notices that planning is open.", context: "the bell: several notices of one kind batched into a line, kind season_plan_open" }),
  },
  "season_plan_reminder": {
    blurb: msg({ message: "Your season plan is not filed yet. Filing takes a few minutes, and the village sees it by name.", context: "the bell: why a notice of this kind matters, kind season_plan_reminder" }),
    many: msg({ message: "{n} reminders to file your season.", context: "the bell: several notices of one kind batched into a line, kind season_plan_reminder" }),
  },
  "role_proposal_feedback": {
    blurb: msg({ message: "A member who has the link to your role proposal left feedback on it. Open the draft to read it.", context: "the bell: why a notice of this kind matters, kind role_proposal_feedback" }),
    many: msg({ message: "{n} pieces of feedback on your role proposal.", context: "the bell: several notices of one kind batched into a line, kind role_proposal_feedback" }),
  },
  "role_proposal_consent_ask": {
    blurb: msg({ message: "A member proposes roles in a circle you hold a role in. Consent or object within 2 business days.", context: "the bell: why a notice of this kind matters, kind role_proposal_consent_ask" }),
    many: msg({ message: "{n} role proposals ask your circle to consent.", context: "the bell: several notices of one kind batched into a line, kind role_proposal_consent_ask" }),
  },
  "role_proposal_objection": {
    blurb: msg({ message: "A member of the circle objected to your role proposal, so it goes to the circle's next meeting.", context: "the bell: why a notice of this kind matters, kind role_proposal_objection" }),
    many: msg({ message: "{n} objections to your role proposals.", context: "the bell: several notices of one kind batched into a line, kind role_proposal_objection" }),
  },
  "open_role_proposal_consent_ask": {
    blurb: msg({ message: "Somebody from outside the village proposes to hold roles in a circle you hold a role in. Consent or object within 2 business days.", context: "the bell: why a notice of this kind matters, kind open_role_proposal_consent_ask" }),
    many: msg({ message: "{n} role proposals from outside the village ask your circle to consent.", context: "the bell: several notices of one kind batched into a line, kind open_role_proposal_consent_ask" }),
  },
  "open_role_proposal_decided": {
    blurb: msg({ message: "The village answered a proposal for an agent you keep: seated on its roles, or declined.", context: "the bell: why a notice of this kind matters, kind open_role_proposal_decided" }),
    many: msg({ message: "{n} answers on proposals for agents you keep.", context: "the bell: several notices of one kind batched into a line, kind open_role_proposal_decided" }),
  },
  "applicant_update": {
    blurb: msg({ message: "An update about a role you proposed to hold: a reply, a conversation, the circle weighing it, or the answer.", context: "the bell: why a notice of this kind matters, kind applicant_update" }),
    many: msg({ message: "{n} updates about your role proposals.", context: "the bell: several notices of one kind batched into a line, kind applicant_update" }),
  },
  "open_role_proposal_waiting": {
    blurb: msg({ message: "Somebody from outside the village proposes to hold roles. You hold the power to place people in roles, so it is yours to adopt or decline.", context: "the bell: why a notice of this kind matters, kind open_role_proposal_waiting" }),
    many: msg({ message: "{n} role proposals from outside the village wait on you.", context: "the bell: several notices of one kind batched into a line, kind open_role_proposal_waiting" }),
  },
  "application_interview_turn": {
    blurb: msg({ message: "An applicant is waiting to talk with a role you hold. Book the conversation, then write your scorecard alone.", context: "the bell: why a notice of this kind matters, kind application_interview_turn" }),
    many: msg({ message: "{n} applicants wait to talk with you.", context: "the bell: several notices of one kind batched into a line, kind application_interview_turn" }),
  },
  "application_arrived": {
    blurb: msg({ message: "An application arrived for a role in a circle you hold a role in. You are asked to consent after the conversations.", context: "the bell: why a notice of this kind matters, kind application_arrived" }),
    many: msg({ message: "{n} applications arrived in your circles.", context: "the bell: several notices of one kind batched into a line, kind application_arrived" }),
  },
  "application_first_reply_due": {
    blurb: msg({ message: "An applicant is owed a first reply within 3 business days.", context: "the bell: why a notice of this kind matters, kind application_first_reply_due" }),
    many: msg({ message: "{n} applicants are owed a first reply.", context: "the bell: several notices of one kind batched into a line, kind application_first_reply_due" }),
  },
  "application_stale": {
    blurb: msg({ message: "An application has not moved for ten days. A person decides what happens next.", context: "the bell: why a notice of this kind matters, kind application_stale" }),
    many: msg({ message: "{n} applications have not moved for ten days.", context: "the bell: several notices of one kind batched into a line, kind application_stale" }),
  },
  "application_references_in": {
    blurb: msg({ message: "An applicant sent their references. Pick who follows up with each one.", context: "the bell: why a notice of this kind matters, kind application_references_in" }),
    many: msg({ message: "{n} applications have references waiting for follow-up owners.", context: "the bell: several notices of one kind batched into a line, kind application_references_in" }),
  },
  "application_reference_owner": {
    blurb: msg({ message: "You follow up with a reference for an applicant. Read how to reach them on the application, then write your notes.", context: "the bell: why a notice of this kind matters, kind application_reference_owner" }),
    many: msg({ message: "{n} references wait for your follow-up.", context: "the bell: several notices of one kind batched into a line, kind application_reference_owner" }),
  },
  "application_references_asked": {
    blurb: msg({ message: "Your application is for your first long-term role, so references are asked. Add them on your application's page.", context: "the bell: why a notice of this kind matters, kind application_references_asked" }),
    many: msg({ message: "{n} of your applications ask for references.", context: "the bell: several notices of one kind batched into a line, kind application_references_asked" }),
  },
  "application_new_invitation_asked": {
    blurb: msg({ message: "An applicant's invitation to join the team expired, and they asked for a new one. You can make it on their proposal's page.", context: "the bell: why a notice of this kind matters, kind application_new_invitation_asked" }),
    many: msg({ message: "{n} applicants asked for a new invitation.", context: "the bell: several notices of one kind batched into a line, kind application_new_invitation_asked" }),
  },
  "role_proposal_window_open": {
    blurb: msg({ message: "Planning for next season is open. Propose the roles you will hold.", context: "the bell: why a notice of this kind matters, kind role_proposal_window_open" }),
    many: msg({ message: "{n} notices that you can propose your roles.", context: "the bell: several notices of one kind batched into a line, kind role_proposal_window_open" }),
  },
  "role_proposal_review_due": {
    blurb: msg({ message: "One of your roles is due its review. Propose how you will hold it next season.", context: "the bell: why a notice of this kind matters, kind role_proposal_review_due" }),
    many: msg({ message: "{n} roles due their review.", context: "the bell: several notices of one kind batched into a line, kind role_proposal_review_due" }),
  },
  "role_proposal_window_closing": {
    blurb: msg({ message: "Your role proposal is still a draft, and the window closes in 2 business days.", context: "the bell: why a notice of this kind matters, kind role_proposal_window_closing" }),
    many: msg({ message: "{n} reminders that the window closes soon.", context: "the bell: several notices of one kind batched into a line, kind role_proposal_window_closing" }),
  },
  "role_access": {
    blurb: msg({ message: "Access to give or take back for a role: a shared drive, a portal, a list. Open the task and mark it done once you have done it in the tool itself.", context: "the bell: why a notice of this kind matters, kind role_access" }),
    many: msg({ message: "{n} access tasks are waiting for you.", context: "the bell: several notices of one kind batched into a line, kind role_access" }),
  },
  "term_expiring": {
    blurb: msg({ message: "The agreement to keep holding your role is running out. In a role that carries permissions those end with the term (0171), so it is the moment to renew or hand it on.", context: "the bell: why a notice of this kind matters, kind term_expiring" }),
    many: msg({ message: "{n} of your terms are running out.", context: "the bell: several notices of one kind batched into a line, kind term_expiring" }),
  },
  "submission": {
    blurb: msg({ message: "Somebody raised a hand for a role or a power, and the village owes them an answer.", context: "the bell: why a notice of this kind matters, kind submission" }),
    many: msg({ message: "{n} people raised a hand for a role or a power.", context: "the bell: several notices of one kind batched into a line, kind submission" }),
  },
  "submission_status": {
    blurb: msg({ message: "An answer came back on something you applied for, offered, or raised a hand for.", context: "the bell: why a notice of this kind matters, kind submission_status" }),
    many: msg({ message: "{n} answers came back on things you put forward.", context: "the bell: several notices of one kind batched into a line, kind submission_status" }),
  },
  "cycle_settled": {
    blurb: msg({ message: "A lunation closed, and its pool was split by the recognition people sent you inside it.", context: "the bell: why a notice of this kind matters, kind cycle_settled" }),
    many: msg({ message: "{n} cycles settled with a share for you.", context: "the bell: several notices of one kind batched into a line, kind cycle_settled" }),
  },
  "wallet": {
    blurb: msg({ message: "Somebody sent you credits, and they are in your balance now.", context: "the bell: why a notice of this kind matters, kind wallet" }),
    many: msg({ message: "{n} people sent you credits.", context: "the bell: several notices of one kind batched into a line, kind wallet" }),
  },
  "redemption_confirmed": {
    blurb: msg({ message: "A steward confirmed your redemption, and those tokens are gone from your balance.", context: "the bell: why a notice of this kind matters, kind redemption_confirmed" }),
    many: msg({ message: "{n} of your redemptions were confirmed.", context: "the bell: several notices of one kind batched into a line, kind redemption_confirmed" }),
  },
  "redemption_refused": {
    blurb: msg({ message: "A redemption was not confirmed, and the tokens it held are back in your wallet.", context: "the bell: why a notice of this kind matters, kind redemption_refused" }),
    many: msg({ message: "{n} of your redemptions were not confirmed.", context: "the bell: several notices of one kind batched into a line, kind redemption_refused" }),
  },
  "venture_redemption": {
    blurb: msg({ message: "A venture asked to redeem credits, or the Treasury answered a venture's request.", context: "the bell: why a notice of this kind matters, kind venture_redemption" }),
    many: msg({ message: "{n} updates on venture redemptions.", context: "the bell: several notices of one kind batched into a line, kind venture_redemption" }),
  },
  "moon_review": {
    blurb: msg({ message: "Your moon recap moved: returned, approved, or paid.", context: "the bell: why a notice of this kind matters, kind moon_review" }),
    many: msg({ message: "{n} updates on moon recaps.", context: "the bell: several notices of one kind batched into a line, kind moon_review" }),
  },
  "sera_agent_digest": {
    blurb: msg({ message: "What Sera's agent changed since the last summary, each one undoable for 30 days.", context: "the bell: why a notice of this kind matters, kind sera_agent_digest" }),
    many: msg({ message: "{n} summaries of what Sera's agent did.", context: "the bell: several notices of one kind batched into a line, kind sera_agent_digest" }),
  },
  "cash_paid": {
    blurb: msg({ message: "The village marked cash it owed you as paid.", context: "the bell: why a notice of this kind matters, kind cash_paid" }),
    many: msg({ message: "{n} cash payments were marked paid.", context: "the bell: several notices of one kind batched into a line, kind cash_paid" }),
  },
  "exchange": {
    blurb: msg({ message: "An exchange order settled, and what you bought is in your wallet.", context: "the bell: why a notice of this kind matters, kind exchange" }),
    many: msg({ message: "{n} exchange orders settled.", context: "the bell: several notices of one kind batched into a line, kind exchange" }),
  },
  "payment": {
    blurb: msg({ message: "A receipt for something bought, renewed, or reversed.", context: "the bell: why a notice of this kind matters, kind payment" }),
    many: msg({ message: "{n} receipts landed.", context: "the bell: several notices of one kind batched into a line, kind payment" }),
  },
  "payments_alert": {
    blurb: msg({ message: "Something about money needs a person: a hold lifted, a signature refused, a charge disputed.", context: "the bell: why a notice of this kind matters, kind payments_alert" }),
    many: msg({ message: "{n} money matters need a look.", context: "the bell: several notices of one kind batched into a line, kind payments_alert" }),
  },
  "crash_alert": {
    blurb: msg({ message: "Something broke in the village's software, and the people who look after it are told.", context: "the bell: why a notice of this kind matters, kind crash_alert" }),
    many: msg({ message: "{n} things broke in the village's software.", context: "the bell: several notices of one kind batched into a line, kind crash_alert" }),
  },
  "failed_action": {
    blurb: msg({ message: "Something in the village keeps failing, and the report says what to do about it.", context: "the bell: why a notice of this kind matters, kind failed_action" }),
    many: msg({ message: "{n} reports of things failing in the village.", context: "the bell: several notices of one kind batched into a line, kind failed_action" }),
  },
  "stays": {
    blurb: msg({ message: "Your stay: nights posting, credits arriving, or a balance running low.", context: "the bell: why a notice of this kind matters, kind stays" }),
    many: msg({ message: "{n} things moved on your stay.", context: "the bell: several notices of one kind batched into a line, kind stays" }),
  },
  "library": {
    blurb: msg({ message: "A borrowed thing: due back, settled, or credits released for what you gave.", context: "the bell: why a notice of this kind matters, kind library" }),
    many: msg({ message: "{n} library items moved.", context: "the bell: several notices of one kind batched into a line, kind library" }),
  },
  "quest_claimed": {
    blurb: msg({ message: "You took on a quest. The quest shows who to talk to, your first task, your crew link and the date.", context: "the bell: why a notice of this kind matters, kind quest_claimed" }),
    many: msg({ message: "You took on {n} quests.", context: "the bell: several notices of one kind batched into a line, kind quest_claimed" }),
  },
  "quest_submitted": {
    blurb: msg({ message: "Somebody finished work and it is waiting to be read. Value moves when a steward says so.", context: "the bell: why a notice of this kind matters, kind quest_submitted" }),
    many: msg({ message: "{n} pieces of finished work are waiting to be read.", context: "the bell: several notices of one kind batched into a line, kind quest_submitted" }),
  },
  "quest_consented": {
    blurb: msg({ message: "A steward read your work and released what it was worth.", context: "the bell: why a notice of this kind matters, kind quest_consented" }),
    many: msg({ message: "{n} of your quests were consented.", context: "the bell: several notices of one kind batched into a line, kind quest_consented" }),
  },
  "quest_declined": {
    blurb: msg({ message: "A claim was released, and the quest is open again for whoever wants it next.", context: "the bell: why a notice of this kind matters, kind quest_declined" }),
    many: msg({ message: "{n} claims were released.", context: "the bell: several notices of one kind batched into a line, kind quest_declined" }),
  },
  "quest_idea_on_board": {
    blurb: msg({ message: "A steward put the quest you proposed on the board, where anyone can take it on.", context: "the bell: why a notice of this kind matters, kind quest_idea_on_board" }),
    many: msg({ message: "{n} of your quest ideas went on the board.", context: "the bell: several notices of one kind batched into a line, kind quest_idea_on_board" }),
  },
  "quest_idea_declined": {
    blurb: msg({ message: "A steward read the quest you proposed and left it off the board. You are welcome to propose another.", context: "the bell: why a notice of this kind matters, kind quest_idea_declined" }),
    many: msg({ message: "{n} of your quest ideas were left off the board.", context: "the bell: several notices of one kind batched into a line, kind quest_idea_declined" }),
  },
  "quest_help": {
    blurb: msg({ message: "Somebody flagged that they are stuck or wobbling on work they took on.", context: "the bell: why a notice of this kind matters, kind quest_help" }),
    many: msg({ message: "{n} people asked for a hand on work they took on.", context: "the bell: several notices of one kind batched into a line, kind quest_help" }),
  },
  "call_task_suggested": {
    blurb: msg({ message: "A call turned into a suggested task with your name on it. Accept or decline on the thread; nothing happens on its own.", context: "the bell: why a notice of this kind matters, kind call_task_suggested" }),
    many: msg({ message: "{n} tasks were suggested to you from calls.", context: "the bell: several notices of one kind batched into a line, kind call_task_suggested" }),
  },
  "session_action_held": {
    blurb: msg({ message: "A live session closed with an action held by you or by a role you sit in. The notice says what it is and by when.", context: "the bell: why a notice of this kind matters, kind session_action_held" }),
    many: msg({ message: "{n} actions from live sessions are held by you or your roles.", context: "the bell: several notices of one kind batched into a line, kind session_action_held" }),
  },
  "my_task_due": {
    blurb: msg({ message: "A task on your own list is due soon. Open your list to see it.", context: "the bell: why a notice of this kind matters, kind my_task_due" }),
    many: msg({ message: "{n} tasks on your list are due soon.", context: "the bell: several notices of one kind batched into a line, kind my_task_due" }),
  },
  "my_task_asked": {
    blurb: msg({ message: "Someone asked you for a task on your own list. Open your list to see who.", context: "the bell: why a notice of this kind matters, kind my_task_asked" }),
    many: msg({ message: "{n} tasks on your list are waiting on you.", context: "the bell: several notices of one kind batched into a line, kind my_task_asked" }),
  },
  "session_action_due": {
    blurb: msg({ message: "A task you hold from a live session is near its date, or its date just passed. Answer it on your task board.", context: "the bell: why a notice of this kind matters, kind session_action_due" }),
    many: msg({ message: "{n} tasks you hold are near their dates.", context: "the bell: several notices of one kind batched into a line, kind session_action_due" }),
  },
  "session_task_back": {
    blurb: msg({ message: "A task from a session you facilitated was handed back. It comes up at the circle's next action check.", context: "the bell: why a notice of this kind matters, kind session_task_back" }),
    many: msg({ message: "{n} tasks came back to their circles.", context: "the bell: several notices of one kind batched into a line, kind session_task_back" }),
  },
  "session_task_unheld": {
    blurb: msg({ message: "A task from a live session sits with a role nobody holds now. Give it to someone at the next call.", context: "the bell: why a notice of this kind matters, kind session_task_unheld" }),
    many: msg({ message: "{n} tasks sit with roles nobody holds.", context: "the bell: several notices of one kind batched into a line, kind session_task_unheld" }),
  },
  "role_tension_raised": {
    blurb: msg({ message: "A member raised a tension with a role you hold. Only the role's holders and whoever raised it can read it.", context: "the bell: why a notice of this kind matters, kind role_tension_raised" }),
    many: msg({ message: "{n} tensions were raised with roles you hold.", context: "the bell: several notices of one kind batched into a line, kind role_tension_raised" }),
  },
  "role_tension_reminder": {
    blurb: msg({ message: "A tension raised with a role you hold has waited 2 business days. Take it, answer it, or bring it to the circle.", context: "the bell: why a notice of this kind matters, kind role_tension_reminder" }),
    many: msg({ message: "{n} tensions with your roles have waited 2 business days.", context: "the bell: several notices of one kind batched into a line, kind role_tension_reminder" }),
  },
  "role_task_handed": {
    blurb: msg({ message: "A task was handed to a role you hold. Accept it, suggest a change, or decline it under Waiting on you.", context: "the bell: why a notice of this kind matters, kind role_task_handed" }),
    many: msg({ message: "{n} tasks were handed to roles you hold.", context: "the bell: several notices of one kind batched into a line, kind role_task_handed" }),
  },
  "role_task_accepted": {
    blurb: msg({ message: "A role accepted a task you handed it. It sits on their list now.", context: "the bell: why a notice of this kind matters, kind role_task_accepted" }),
    many: msg({ message: "{n} tasks you handed on were accepted.", context: "the bell: several notices of one kind batched into a line, kind role_task_accepted" }),
  },
  "role_task_edited": {
    blurb: msg({ message: "A role suggested a change to a task you handed it. See it under Sent on your list.", context: "the bell: why a notice of this kind matters, kind role_task_edited" }),
    many: msg({ message: "{n} tasks you handed on have a suggested change.", context: "the bell: several notices of one kind batched into a line, kind role_task_edited" }),
  },
  "role_task_declined": {
    blurb: msg({ message: "A role declined a task you handed it. The reason is under Sent on your list.", context: "the bell: why a notice of this kind matters, kind role_task_declined" }),
    many: msg({ message: "{n} tasks you handed on were declined.", context: "the bell: several notices of one kind batched into a line, kind role_task_declined" }),
  },
  "role_task_done": {
    blurb: msg({ message: "A task you handed to a role is done.", context: "the bell: why a notice of this kind matters, kind role_task_done" }),
    many: msg({ message: "{n} tasks you handed on are done.", context: "the bell: several notices of one kind batched into a line, kind role_task_done" }),
  },
  "session_item_taken": {
    blurb: msg({ message: "An agenda item you added is on a session's agenda now.", context: "the bell: why a notice of this kind matters, kind session_item_taken" }),
    many: msg({ message: "{n} agenda items you added are on an agenda.", context: "the bell: several notices of one kind batched into a line, kind session_item_taken" }),
  },
  "session_coming_up": {
    blurb: msg({ message: "A circle you are part of meets soon. The notice says when, and what is on the agenda.", context: "the bell: why a notice of this kind matters, kind session_coming_up" }),
    many: msg({ message: "{n} of your circles meet soon.", context: "the bell: several notices of one kind batched into a line, kind session_coming_up" }),
  },
  "session_advice_asked": {
    blurb: msg({ message: "Somebody asks a circle you are part of for advice before they decide. The notice says what they mean to decide.", context: "the bell: why a notice of this kind matters, kind session_advice_asked" }),
    many: msg({ message: "{n} requests for your advice.", context: "the bell: several notices of one kind batched into a line, kind session_advice_asked" }),
  },
  "session_advice_given": {
    blurb: msg({ message: "Somebody you asked for advice gave it.", context: "the bell: why a notice of this kind matters, kind session_advice_given" }),
    many: msg({ message: "{n} people gave advice on what you mean to decide.", context: "the bell: several notices of one kind batched into a line, kind session_advice_given" }),
  },
  "session_advice_decided": {
    blurb: msg({ message: "Somebody who asked for your advice decided. The notice says what they decided.", context: "the bell: why a notice of this kind matters, kind session_advice_decided" }),
    many: msg({ message: "{n} decisions made after asking for your advice.", context: "the bell: several notices of one kind batched into a line, kind session_advice_decided" }),
  },
  "session_filled_in": {
    blurb: msg({ message: "The Facilitator filled something in for you during a session. You can change it or undo it there.", context: "the bell: why a notice of this kind matters, kind session_filled_in" }),
    many: msg({ message: "{n} things the Facilitator filled in for you.", context: "the bell: several notices of one kind batched into a line, kind session_filled_in" }),
  },
  "session_night_open": {
    blurb: msg({ message: "You asked for a night on a proposal and the call has closed. The notice says where to answer, and by when.", context: "the bell: why a notice of this kind matters, kind session_night_open" }),
    many: msg({ message: "{n} proposals wait for your answer after a night.", context: "the bell: several notices of one kind batched into a line, kind session_night_open" }),
  },
  "session_night_settled": {
    blurb: msg({ message: "A proposal from a session you facilitated waited for a night, and the night is over. The notice says how the round went.", context: "the bell: why a notice of this kind matters, kind session_night_settled" }),
    many: msg({ message: "{n} rounds you facilitated are settled after a night.", context: "the bell: several notices of one kind batched into a line, kind session_night_settled" }),
  },
  "session_item_settled": {
    blurb: msg({ message: "A session that took up an agenda item you added has closed. The item says whether it was taken up or waits for next time.", context: "the bell: why a notice of this kind matters, kind session_item_settled" }),
    many: msg({ message: "{n} sessions closed with agenda items you added.", context: "the bell: several notices of one kind batched into a line, kind session_item_settled" }),
  },
  "rite_witness_asked": {
    blurb: msg({ message: "A newcomer is ready for a rite, and you're asked to witness it from your phone.", context: "the bell: why a notice of this kind matters, kind rite_witness_asked" }),
    many: msg({ message: "{n} rites are waiting for a witness.", context: "the bell: several notices of one kind batched into a line, kind rite_witness_asked" }),
  },
  "rite_stamped": {
    blurb: msg({ message: "A rite was stamped on a member's card.", context: "the bell: why a notice of this kind matters, kind rite_stamped" }),
    many: msg({ message: "{n} rites were stamped.", context: "the bell: several notices of one kind batched into a line, kind rite_stamped" }),
  },
  "rite_buddy_paired": {
    blurb: msg({ message: "You were paired with a newcomer, to walk beside them through their first moon and their rites.", context: "the bell: why a notice of this kind matters, kind rite_buddy_paired" }),
    many: msg({ message: "{n} newcomers were paired with you.", context: "the bell: several notices of one kind batched into a line, kind rite_buddy_paired" }),
  },
  "rite_door_request": {
    blurb: msg({ message: "Somebody asked to join through your printed code, and waits for your answer.", context: "the bell: why a notice of this kind matters, kind rite_door_request" }),
    many: msg({ message: "{n} people asked to join through your code.", context: "the bell: several notices of one kind batched into a line, kind rite_door_request" }),
  },
  "arrival": {
    blurb: msg({ message: "Somebody joined the village. Greeting a new arrival is the first thing anybody here does for them.", context: "the bell: why a notice of this kind matters, kind arrival" }),
    many: msg({ message: "{n} people joined the village.", context: "the bell: several notices of one kind batched into a line, kind arrival" }),
  },
  "gratitude": {
    blurb: msg({ message: "Somebody said thank you, and put their name to it.", context: "the bell: why a notice of this kind matters, kind gratitude" }), // village-ok: the notice kind id in a translator context, not copy
    many: msg({ message: "{n} people sent you appreciation.", context: "the bell: several notices of one kind batched into a line, kind gratitude" }), // village-ok: the notice kind id in a translator context, not copy
  },
  "comms_path_handoff": {
    blurb: msg({ message: "Somebody has been on a path for three weeks. A note from a person is the next step.", context: "the bell: why a notice of this kind matters, kind comms_path_handoff" }),
    many: msg({ message: "{n} people on a path are ready to hear from a person.", context: "the bell: several notices of one kind batched into a line, kind comms_path_handoff" }),
  },
  "message": {
    blurb: msg({ message: "Somebody wrote to you.", context: "the bell: why a notice of this kind matters, kind message" }),
    many: msg({ message: "{n} conversations have something new in them.", context: "the bell: several notices of one kind batched into a line, kind message" }),
  },
  "mention": {
    blurb: msg({ message: "Somebody used your name in a thread and meant you to see it.", context: "the bell: why a notice of this kind matters, kind mention" }),
    many: msg({ message: "{n} threads name you.", context: "the bell: several notices of one kind batched into a line, kind mention" }),
  },
  "forum_reply": {
    blurb: msg({ message: "Somebody answered you in a thread you are part of.", context: "the bell: why a notice of this kind matters, kind forum_reply" }),
    many: msg({ message: "{n} replies landed in threads you are part of.", context: "the bell: several notices of one kind batched into a line, kind forum_reply" }),
  },
  "thread_activity": {
    blurb: msg({ message: "A thread you follow moved. Nothing in it needs you.", context: "the bell: why a notice of this kind matters, kind thread_activity" }),
    many: msg({ message: "{n} threads you follow moved.", context: "the bell: several notices of one kind batched into a line, kind thread_activity" }),
  },
  "introduction": {
    blurb: msg({ message: "The village thinks two of you may be worth knowing. Yes or not now, both are whole answers.", context: "the bell: why a notice of this kind matters, kind introduction" }),
    many: msg({ message: "{n} introductions are waiting on you.", context: "the bell: several notices of one kind batched into a line, kind introduction" }),
  },
  "contact_request": {
    blurb: msg({ message: "Somebody wants to reach you about a role you hold. They see a relay, never your address.", context: "the bell: why a notice of this kind matters, kind contact_request" }),
    many: msg({ message: "{n} people want to reach you.", context: "the bell: several notices of one kind batched into a line, kind contact_request" }),
  },
  "stage_advanced": {
    blurb: msg({ message: "A door opened for you, and the notice names what you can now do.", context: "the bell: why a notice of this kind matters, kind stage_advanced" }),
    many: msg({ message: "{n} doors opened.", context: "the bell: several notices of one kind batched into a line, kind stage_advanced" }),
  },
  "hidden_map_opened": {
    blurb: msg({ message: "Enough of your places are vouched for, and the whole map is open to you.", context: "the bell: why a notice of this kind matters, kind hidden_map_opened" }),
    many: msg({ message: "{n} maps opened.", context: "the bell: several notices of one kind batched into a line, kind hidden_map_opened" }),
  },
  "badge": {
    blurb: msg({ message: "A mark on your profile, earned or placed, with what it means beside it.", context: "the bell: why a notice of this kind matters, kind badge" }),
    many: msg({ message: "{n} marks on your profile changed.", context: "the bell: several notices of one kind batched into a line, kind badge" }),
  },
  "badge_definition_changed": {
    blurb: msg({ message: "A badge you hold carries something different now, and the line says what changed.", context: "the bell: why a notice of this kind matters, kind badge_definition_changed" }),
    many: msg({ message: "{n} badges you hold were changed.", context: "the bell: several notices of one kind batched into a line, kind badge_definition_changed" }),
  },
  "capability_override": {
    blurb: msg({ message: "An admin acted on a power you hold. It is on the village's own record, with their name on it.", context: "the bell: why a notice of this kind matters, kind capability_override" }),
    many: msg({ message: "{n} powers you hold were acted on from the admin panel.", context: "the bell: several notices of one kind batched into a line, kind capability_override" }),
  },
  "season_place_waiting": {
    blurb: msg({ message: "A circle proposes to take part in a season, and you hold the power that says yes or puts it to the village.", context: "the bell: why a notice of this kind matters, kind season_place_waiting" }),
    many: msg({ message: "{n} season proposals wait on you.", context: "the bell: several notices of one kind batched into a line, kind season_place_waiting" }),
  },
  "season_crew_applied": {
    blurb: msg({ message: "Somebody applied to take part this season with a circle you pick for.", context: "the bell: why a notice of this kind matters, kind season_crew_applied" }),
    many: msg({ message: "{n} people applied to take part with a circle you pick for.", context: "the bell: several notices of one kind batched into a line, kind season_crew_applied" }),
  },
  "season_crew_picked": {
    blurb: msg({ message: "A circle picked you for its team this season.", context: "the bell: why a notice of this kind matters, kind season_crew_picked" }),
    many: msg({ message: "{n} circles picked you this season.", context: "the bell: several notices of one kind batched into a line, kind season_crew_picked" }),
  },
  "season_crew_released": {
    blurb: msg({ message: "A circle released your place this season. Your application stands for any circle to pick.", context: "the bell: why a notice of this kind matters, kind season_crew_released" }),
    many: msg({ message: "{n} circles released your place.", context: "the bell: several notices of one kind batched into a line, kind season_crew_released" }),
  },
  "season_place_placed": {
    blurb: msg({ message: "A circle you are in has a place in a season.", context: "the bell: why a notice of this kind matters, kind season_place_placed" }),
    many: msg({ message: "{n} season places were confirmed.", context: "the bell: several notices of one kind batched into a line, kind season_place_placed" }),
  },
  "season_place_waitlisted": {
    blurb: msg({ message: "The season is full, so a circle you are in waits in line, and you will hear the moment a place opens.", context: "the bell: why a notice of this kind matters, kind season_place_waitlisted" }),
    many: msg({ message: "{n} circles you are in are on a season's waitlist.", context: "the bell: several notices of one kind batched into a line, kind season_place_waitlisted" }),
  },
  "season_place_opened": {
    blurb: msg({ message: "A place opened in a season, and the line reached a circle you are in.", context: "the bell: why a notice of this kind matters, kind season_place_opened" }),
    many: msg({ message: "{n} season places opened for circles you are in.", context: "the bell: several notices of one kind batched into a line, kind season_place_opened" }),
  },
  "season_place_declined": {
    blurb: msg({ message: "A circle you are in does not take part in a season it proposed for.", context: "the bell: why a notice of this kind matters, kind season_place_declined" }),
    many: msg({ message: "{n} season proposals were not adopted.", context: "the bell: several notices of one kind batched into a line, kind season_place_declined" }),
  },
  "circle_place_going": {
    blurb: msg({ message: "A circle you are in is going to a gathering.", context: "the bell: why a notice of this kind matters, kind circle_place_going" }),
    many: msg({ message: "{n} gatherings have a circle you are in going.", context: "the bell: several notices of one kind batched into a line, kind circle_place_going" }),
  },
  "circle_place_waiting": {
    blurb: msg({ message: "A gathering is full for circles, so a circle you are in waits in line, and you will hear the moment a place opens.", context: "the bell: why a notice of this kind matters, kind circle_place_waiting" }),
    many: msg({ message: "{n} gatherings have a circle you are in on the waitlist.", context: "the bell: several notices of one kind batched into a line, kind circle_place_waiting" }),
  },
  "circle_place_opened": {
    blurb: msg({ message: "A place opened at a gathering, and the line reached a circle you are in.", context: "the bell: why a notice of this kind matters, kind circle_place_opened" }),
    many: msg({ message: "{n} gatherings found a place for a circle you are in.", context: "the bell: several notices of one kind batched into a line, kind circle_place_opened" }),
  },
  "waitlist_promoted": {
    blurb: msg({ message: "A seat opened at a gathering you queued for, and the line reached you.", context: "the bell: why a notice of this kind matters, kind waitlist_promoted" }),
    many: msg({ message: "{n} gatherings found you a seat.", context: "the bell: several notices of one kind batched into a line, kind waitlist_promoted" }),
  },
  "weekly_brief": {
    blurb: msg({ message: "What the week ahead holds, gathered once.", context: "the bell: why a notice of this kind matters, kind weekly_brief" }),
    many: msg({ message: "{n} weekly briefs are waiting.", context: "the bell: several notices of one kind batched into a line, kind weekly_brief" }),
  },
  "feedback": {
    blurb: msg({ message: "A bug or an idea you sent in was triaged, and this is where it landed.", context: "the bell: why a notice of this kind matters, kind feedback" }),
    many: msg({ message: "{n} things you sent in were triaged.", context: "the bell: several notices of one kind batched into a line, kind feedback" }),
  },
  "session_record_ready": {
    blurb: msg({ message: "A live session closed and its record is kept: the agenda, what was decided, who holds each action, and the backlog.", context: "the bell: why a notice of this kind matters, kind session_record_ready" }),
    many: msg({ message: "{n} live session records are ready to read.", context: "the bell: several notices of one kind batched into a line, kind session_record_ready" }),
  },
  "moderation": {
    blurb: msg({ message: "Something was flagged for a steward to read, or a report you filed was closed.", context: "the bell: why a notice of this kind matters, kind moderation" }),
    many: msg({ message: "{n} reports moved.", context: "the bell: several notices of one kind batched into a line, kind moderation" }),
  },
  "comms_host_recap": {
    blurb: msg({ message: "A gathering you hosted has ended. The people who came will hear from you once you write the recap.", context: "the bell: why a notice of this kind matters, kind comms_host_recap" }),
    many: msg({ message: "{n} gatherings you hosted are waiting for a recap.", context: "the bell: several notices of one kind batched into a line, kind comms_host_recap" }),
  },
  "restorative_intake": {
    blurb: msg({ message: "Somebody reached out privately about a rupture. Same day matters for these.", context: "the bell: why a notice of this kind matters, kind restorative_intake" }),
    many: msg({ message: "{n} private intakes are waiting.", context: "the bell: several notices of one kind batched into a line, kind restorative_intake" }),
  },
  "canvas_revisit": {
    blurb: msg({ message: "A key moment came round, and the canvas asks whether one of the village's answers still holds.", context: "the bell: why a notice of this kind matters, kind canvas_revisit" }),
    many: msg({ message: "{n} canvas answers are worth another look.", context: "the bell: several notices of one kind batched into a line, kind canvas_revisit" }),
  },
  "exit_opened": {
    blurb: msg({ message: "A departure process opened. The published exit policy describes every step of it.", context: "the bell: why a notice of this kind matters, kind exit_opened" }),
    many: msg({ message: "{n} departure processes opened.", context: "the bell: several notices of one kind batched into a line, kind exit_opened" }),
  },
  "health": {
    blurb: msg({ message: "A number the village watches moved further than the stewards asked to be told about.", context: "the bell: why a notice of this kind matters, kind health" }),
    many: msg({ message: "{n} health readings moved.", context: "the bell: several notices of one kind batched into a line, kind health" }),
  },
  "tools": {
    blurb: msg({ message: "Links the village depends on stopped answering.", context: "the bell: why a notice of this kind matters, kind tools" }),
    many: msg({ message: "{n} link sweeps found something broken.", context: "the bell: several notices of one kind batched into a line, kind tools" }),
  },
  "agent_inbox": {
    blurb: msg({ message: "Your agent inbox stopped answering, so deliveries to it were switched off.", context: "the bell: why a notice of this kind matters, kind agent_inbox" }),
    many: msg({ message: "{n} notices about your agent inbox.", context: "the bell: several notices of one kind batched into a line, kind agent_inbox" }),
  },
};

const PLAIN: Pair = {
  blurb: msg({ message: "Something the village keeps for you moved.", context: "the bell: why a notice of an unknown kind matters" }),
  many: msg({ message: "{n} more notices.", context: "the bell: several notices of an unknown kind batched into a line" }),
};

/**
 * A kind's words in the reader's language, the same shape the bell already reads. The batched line keeps its
 * literal `{n}`, because the feed puts the count in after (client/src/lib/notificationFeed.ts).
 */
export function kindWordsIn(i18n: I18n = appI18n) {
  return (type: string): { blurb: string; many: string } => {
    const w = KIND_WORDS_MSG[type] ?? PLAIN;
    // No language yet (a test, or a read before the app has started one): the English, as written.
    const by = i18n.locale ? i18n : ENGLISH;
    return { blurb: by._(w.blurb), many: by._({ ...w.many, values: { n: "{n}" } }) };
  };
}
