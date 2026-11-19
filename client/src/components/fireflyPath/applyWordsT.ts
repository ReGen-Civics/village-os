/**
 * THE APPLICATION'S WORDS THAT LIVE IN SHARED CODE, IN THE READER'S LANGUAGE (Spanish phone QA, 15 Nov 2026).
 *
 * Lingui extracts client/src only, so a refusal or a voice line written in shared/ reached a Spanish applicant in
 * English: "Give an email address or a phone number we can reach that reference on.", "Record", "Skip, I'll type".
 * The English in shared/ stays the source the server and the tests read. Each line is said again here as a message,
 * keyed by the shared constant itself (the same value the server sends back as `error`), never matched on words.
 * A line this file does not know is shown as it came.
 */
// A value import of the runtime, as roleCard/cardWordsT.ts has: precompileEnglish compiles the messages of a file
// that imports it and skips one that only uses `msg`.
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { VOICE_WORDS } from "@shared/voiceNotes";
import { OPEN_WORDS } from "@shared/openProposals";
import { ABOUT_WORDS } from "@shared/proposalAbout";
import { ATTACHMENT_WORDS } from "@shared/proposalAttachments";

type StaticKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];

/** The voice lines an applicant reads, by their key in VOICE_WORDS. */
export type VoiceKey = Extract<
  StaticKeys<typeof VOICE_WORDS>,
  "inviteTitle" | "inviteBody" | "record" | "recordAnother" | "stop" | "skip" | "reopen" | "heardLabel" | "heardHint" | "consent" | "kept" | "notKept" | "clipRecord" | "clipStop" | "clipAgain" | "clipRemove" | "clipLabel" | "noTranscribe" | "micBlocked" | "noMic" | "nearEnd" | "noEngine" | "reachedLimit" | "cutShort" | "emptyTake" | "cantPlay" | "saveCopy" | "heardNothing"
>;

const VOICE: Record<VoiceKey, MessageDescriptor> = {
  inviteTitle: msg({ message: "We love hearing your voice.", context: "voice invite" }),
  inviteBody: msg({ message: "We learn so much from how you say things, and we read every word too. If you like, talk to us for a few minutes: who you are, why this role, and what you would bring. We'll help turn what you say into your answers, and you edit every one.", context: "voice invite" }),
  record: msg({ message: "Record", context: "voice invite: start a recording" }),
  recordAnother: msg({ message: "Record another", context: "voice invite" }),
  stop: msg({ message: "Stop recording", context: "voice invite" }),
  skip: msg({ message: "Skip, I'll type", context: "voice invite" }),
  reopen: msg({ message: "Talk to us instead", context: "voice invite" }),
  heardLabel: msg({ message: "What we heard, in your words", context: "voice invite" }),
  heardHint: msg({ message: "Your browser's speech service turns what you say into text as you talk: Google's in Chrome, Apple's in Safari. Fix anything it got wrong.", context: "voice invite" }),
  consent: msg({ message: "Keep my voice recordings with my application. The people who decide it and the village's admins will listen to them.", context: "voice invite" }),
  kept: msg({ message: "Only the people who decide your application and the village's admins hear them. We delete them with your application, and at the latest 90 days after we decide.", context: "voice invite" }),
  notKept: msg({ message: "Without the tick, your recordings stay on this device and are not sent.", context: "voice invite" }),
  clipRecord: msg({ message: "Record this answer", context: "voice clip beside an answer" }),
  clipStop: msg({ message: "Stop", context: "voice clip beside an answer" }),
  clipAgain: msg({ message: "Record again", context: "voice clip beside an answer" }),
  clipRemove: msg({ message: "Remove clip", context: "voice clip beside an answer" }),
  clipLabel: msg({ message: "Your voice for this answer", context: "voice clip beside an answer" }),
  noTranscribe: msg({ message: "This phone can't write down your words while it records. Your recording is fine; use the mic on each answer for the text.", context: "voice invite" }),
  micBlocked: msg({ message: "The microphone is blocked for this site. Allow it in your browser settings, or type your answers.", context: "voice invite" }),
  noMic: msg({ message: "No microphone was found on this device. Typing works just as well.", context: "voice invite" }),
  nearEnd: msg({ message: "About 30 seconds left in this recording.", context: "voice invite" }),
  noEngine: msg({ message: "This browser doesn't write down your words as you speak. Your recording is kept, and you can type what you said in the box under it.", context: "voice invite" }),
  reachedLimit: msg({ message: "That's 7 minutes, the most for one recording. Your words are kept. Record again to add more.", context: "voice invite" }),
  cutShort: msg({ message: "The recording stopped before you pressed Stop, perhaps because another app needed the microphone. What you said until then is kept below: play it back, and record another if anything is missing.", context: "voice invite" }),
  emptyTake: msg({ message: "No sound reached the recording, so there is nothing to keep. Check that your microphone is on, then record again.", context: "voice invite" }),
  cantPlay: msg({ message: "This browser can't play the recording back here. It is still kept, and it goes with your application when you tick below. You can save a copy to this device.", context: "voice invite" }),
  saveCopy: msg({ message: "Save a copy", context: "voice invite: download the recording" }),
  heardNothing: msg({ message: "Your browser didn't write any words down this time. Type a few lines about what you said, or leave this empty: your recording is enough.", context: "voice invite" }),
};

/** One voice line in the reader's language. */
export const voiceWord = (key: VoiceKey, i18n: I18n = appI18n): string => i18n._(VOICE[key]);

/** "You've recorded 12 clips, the most one application holds…" (VOICE_WORDS.clipsFull). */
export const clipsFullWords = (max: number, i18n: I18n = appI18n): string =>
  i18n._(msg({ message: `You've recorded ${max} clips, the most one application holds. Remove one to record another.`, context: "voice clip beside an answer" }));

/**
 * The send failed before any answer came back: no connection, or the connection dropped. The shared
 * OPEN_WORDS.notSent speaks of the confirmation email, which is not what happened here (Spanish phone QA, 15 Nov 2026).
 */
export const notSentWords = (i18n: I18n = appI18n): string =>
  i18n._(msg({ message: "We couldn't send your application. Check your connection and send again: everything you wrote is still here on the page.", context: "founding application, the send failed" }));

/** Every refusal the form or the server may hand the applicant, by its shared constant. */
const PROBLEMS: ReadonlyArray<readonly [string, MessageDescriptor]> = [
  [OPEN_WORDS.closed, msg({ message: "This page isn't taking proposals right now.", context: "founding application refusal" })],
  [OPEN_WORDS.needName, msg({ message: "Add your name.", context: "founding application refusal" })],
  [OPEN_WORDS.needEmail, msg({ message: "Add an email address we can reach you at.", context: "founding application refusal" })],
  [OPEN_WORDS.badEmail, msg({ message: "That doesn't look like an email address. Check it, like name@example.com, and try again.", context: "founding application refusal" })],
  [OPEN_WORDS.needRole, msg({ message: "Choose the role you are applying for.", context: "founding application refusal" })],
  [OPEN_WORDS.tooManyRoles, msg({ message: "One application takes up to 3 roles. Remove one, and apply for it separately.", context: "founding application refusal" })],
  [OPEN_WORDS.needRoleCommitment, msg({ message: "Choose your commitment for each role you added.", context: "founding application refusal" })],
  [OPEN_WORDS.unknownRole, msg({ message: "One of those roles isn't open any more. Reload the page and pick again.", context: "founding application refusal" })],
  [OPEN_WORDS.addedRoleNotOpen, msg({ message: "A role you added isn't open yet, so it can't be part of this application. Remove it, and join its waitlist on the roles page.", context: "founding application refusal" })],
  [OPEN_WORDS.sameRoleTwice, msg({ message: "You picked the same role twice.", context: "founding application refusal" })],
  [OPEN_WORDS.needWhy, msg({ message: "Say why you, and why now.", context: "founding application refusal" })],
  [OPEN_WORDS.needAim, msg({ message: "Say your aim in this role, in a line.", context: "founding application refusal" })],
  [OPEN_WORDS.notSent, msg({ message: "We couldn't send the confirmation email just now. Try again later.", context: "founding application refusal" })],
  [OPEN_WORDS.confirmGone, msg({ message: "That link has run out or was already used. Send your application again, and open the new link within 48 hours.", context: "founding application refusal" })],
  [OPEN_WORDS.tooMany, msg({ message: "We've already received five proposals from this connection in the last hour, so we can't take another one yet. Nothing you wrote is lost on this page. Please try again in about an hour, or send from a different connection.", context: "founding application refusal" })],
  [OPEN_WORDS.tooManyTries, msg({ message: "That's a lot of tries from this connection in a short while. Please wait about an hour and try again.", context: "founding application refusal" })],
  [OPEN_WORDS.tooManyForAddress, msg({ message: "This email address already has three proposals waiting today. Check your inbox for the confirmation links, or try again tomorrow.", context: "founding application refusal" })],
  [OPEN_WORDS.tooBusy, msg({ message: "We're receiving a lot of proposals right now and can't send another confirmation email yet. Please try again in about an hour.", context: "founding application refusal" })],
  [OPEN_WORDS.tooManyOpens, msg({ message: "That link has been opened many times from this connection. Please wait about an hour and try again.", context: "founding application refusal" })],
  [ABOUT_WORDS.referenceNeedsAll, msg({ message: "Give each reference a name, how you know them, and an email or a phone number. Or clear the row.", context: "founding application refusal" })],
  [ABOUT_WORDS.referenceContact, msg({ message: "Give an email address or a phone number we can reach that reference on.", context: "founding application refusal" })],
  [ABOUT_WORDS.tooManyReferences, msg({ message: "Add up to 6 references.", context: "founding application refusal" })],
  [ABOUT_WORDS.sameReferenceTwice, msg({ message: "You added the same reference twice.", context: "founding application refusal" })],
  [ABOUT_WORDS.needConsent, msg({ message: "Tick the box to say you agree to the background check, or give at least one reference.", context: "founding application refusal" })],
  [ABOUT_WORDS.consentChanged, msg({ message: "The words about the background check changed while you read them. Read them again and tick.", context: "founding application refusal" })],
  [VOICE_WORDS.tooMany, msg({ message: "Send up to 3 recordings.", context: "founding application refusal" })],
  [VOICE_WORDS.tooBig, msg({ message: "One recording is too large. Record a shorter one.", context: "founding application refusal" })],
  [VOICE_WORDS.tooLong, msg({ message: "Keep each recording under 7 minutes.", context: "founding application refusal" })],
  [VOICE_WORDS.wrongType, msg({ message: "We couldn't read one of your recordings. Record it again.", context: "founding application refusal" })],
  [VOICE_WORDS.needConsent, msg({ message: "Tick that we may keep your voice note, or remove the recordings.", context: "founding application refusal" })],
  [VOICE_WORDS.transcriptTooLong, msg({ message: "Keep what we heard under 24000 characters.", context: "founding application refusal" })],
  [VOICE_WORDS.clipWordsTooLong, msg({ message: "Keep the words with each clip under 12000 characters.", context: "founding application refusal" })],
  [VOICE_WORDS.micBlocked, VOICE.micBlocked],
  [VOICE_WORDS.noMic, VOICE.noMic],
  [VOICE_WORDS.noTranscribe, VOICE.noTranscribe],
  [ATTACHMENT_WORDS.uploadTooBig, msg({ message: "Your files and recordings together are too large to send. Send fewer files, or record shorter answers.", context: "founding application refusal" })],
  [ATTACHMENT_WORDS.uploadBusy, msg({ message: "We're receiving a lot of uploads right now. Please try again in a minute.", context: "founding application refusal" })],
];
const BY_TEXT = new Map(PROBLEMS);

/** A refusal in the reader's language when this file knows it; otherwise exactly as it came. */
export function applyWordT(text: string, i18n: I18n = appI18n): string {
  const d = BY_TEXT.get(text);
  return d ? i18n._(d) : text;
}
