/**
 * YOUR ANSWERS, DRAFTED FROM WHAT YOU SAID (Rye, 14 Nov 2026: "AI auto
 * summarise the voice note in their proposal fields and they can edit them
 * before moving on").
 *
 * On the public application, after talking to us, the applicant may press one
 * button. It sends the words the browser heard (never the recording) and the
 * role they are applying for to an AI, which writes first drafts of their own
 * answers: why you, the aim, the story line and up to three value items.
 *
 * EVERY DRAFT IS SEEN BEFORE IT IS USED. The drafts come back to the voice card
 * (client/src/components/voice/VoiceDrafts.tsx), each in its own box to edit,
 * and go into the form only when the applicant presses "Use this". Only empty
 * answers are offered a draft: their own words are never replaced.
 *
 * THE AI WRITES FOR THE APPLICANT. It never selects, ranks, scores or describes
 * them for anyone who decides, and nothing it writes is kept by the village
 * unless the applicant uses it as their own answer.
 *
 * The notice names who reads the words (AI_DRAFT_SERVICE, the same name the
 * machine translation notice reads), so an applicant knows before pressing.
 *
 * Pure, so the page and the server import it alike.
 */
import { AI_DRAFT_SERVICE } from "./aiDraftService";

/** The most of what was heard that goes to the AI. */
export const VOICE_DRAFT_INPUT_MAX = 8000;
/** Too little to draft from: a sentence or two at least. */
export const VOICE_DRAFT_INPUT_MIN = 60;
export const VOICE_DRAFT_ITEMS = 3;

export interface VoiceDraftItem {
  title: string;
  doneWhen: string;
}

/** What comes back: any part may be missing when nothing they said fits it. */
export interface VoiceDraft {
  why?: string;
  aim?: string;
  story?: string;
  items?: VoiceDraftItem[];
}

export const VOICE_DRAFT_WORDS = {
  button: "Draft my answers from what I said",
  sends: `This sends the words above (never your recording) and the role you are applying for to ${AI_DRAFT_SERVICE}, an AI, which writes a first draft of your answers for you to edit. Nothing else goes: not your name, email, references, links or files. No AI takes part in choosing.`,
  working: "Writing your first drafts. You can keep going while you wait.",
  heading: "Your answers, drafted from what you said",
  hint: "Edit anything, then press Use this to put it in your application. Only empty answers get a draft; your own words stay as they are.",
  use: "Use this",
  used: "In your application",
  useAll: "Use all of these",
  labels: { why: "Why you, and why now", aim: "Your aim in this role", story: "Your story with us", items: "What you would bring" },
  itemTitle: "What you will bring",
  itemDone: "How we will know it is done",
  // Refusals and the quiet failures, each with what to do.
  tooLittle: "There isn't enough yet to draft from. Talk a little longer, or type your answers.",
  nothing: "We couldn't draft anything from that. Your words are kept above; type your answers, or record a little more.",
  unavailable: "Drafting isn't available right now. Your words are kept above, and you can type your answers.",
  tooMany: "That's a lot of drafting for one hour. Type your answers, or try again later.",
  tryShortly: "Drafting can't start just now. Your words are kept above. Try again shortly, or type your answers.",
  closed: "Applications aren't open right now.",
  pickRole: "Choose the role you are applying for first.",
} as const;
