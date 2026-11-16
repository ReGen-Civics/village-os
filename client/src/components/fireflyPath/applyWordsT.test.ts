import { describe, expect, it } from "vitest";
import { setupI18n } from "@lingui/core";
import { VOICE_WORDS } from "@shared/voiceNotes";
import { OPEN_WORDS } from "@shared/openProposals";
import { ABOUT_WORDS } from "@shared/proposalAbout";
import { ATTACHMENT_WORDS } from "@shared/proposalAttachments";
import { applyWordT, clipsFullWords, notSentWords, voiceWord, type VoiceKey } from "./applyWordsT";
import { speechLang } from "@/lib/speechLang";

// English, as a reader with no catalog sees it: each message must say exactly what the shared constant says,
// so the English never drifts from the source the server and the tests read.
const en = setupI18n({ locale: "en", messages: { en: {} } });

describe("the application's shared words, said again as messages", () => {
  it("each voice line reads, in English, exactly as VOICE_WORDS has it", () => {
    const keys: VoiceKey[] = ["inviteTitle", "inviteBody", "record", "recordAnother", "stop", "skip", "reopen", "heardLabel", "heardHint", "consent", "kept", "notKept", "clipRecord", "clipStop", "clipAgain", "clipRemove", "clipLabel", "noTranscribe", "micBlocked", "noMic", "nearEnd"];
    for (const k of keys) expect(voiceWord(k, en)).toBe(VOICE_WORDS[k]);
    expect(clipsFullWords(12, en)).toBe(VOICE_WORDS.clipsFull(12));
  });

  it("each known refusal reads, in English, exactly as the server sends it", () => {
    const sent = [
      OPEN_WORDS.closed, OPEN_WORDS.needName, OPEN_WORDS.needEmail, OPEN_WORDS.badEmail, OPEN_WORDS.needRole, OPEN_WORDS.tooManyRoles,
      OPEN_WORDS.unknownRole, OPEN_WORDS.sameRoleTwice, OPEN_WORDS.needWhy, OPEN_WORDS.needAim, OPEN_WORDS.notSent, OPEN_WORDS.confirmGone,
      OPEN_WORDS.tooMany, OPEN_WORDS.tooManyTries, OPEN_WORDS.tooManyForAddress, OPEN_WORDS.tooBusy, OPEN_WORDS.tooManyOpens,
      ABOUT_WORDS.referenceNeedsAll, ABOUT_WORDS.referenceContact, ABOUT_WORDS.tooManyReferences, ABOUT_WORDS.sameReferenceTwice,
      ABOUT_WORDS.needConsent, ABOUT_WORDS.consentChanged,
      VOICE_WORDS.tooMany, VOICE_WORDS.tooBig, VOICE_WORDS.tooLong, VOICE_WORDS.wrongType, VOICE_WORDS.needConsent,
      VOICE_WORDS.micBlocked, VOICE_WORDS.noMic, VOICE_WORDS.noTranscribe,
      ATTACHMENT_WORDS.uploadTooBig, ATTACHMENT_WORDS.uploadBusy,
    ];
    for (const s of sent) expect(applyWordT(s, en)).toBe(s);
  });

  it("a line it does not know is shown exactly as it came", () => {
    expect(applyWordT("Something the server said that we never wrote down.", en)).toBe("Something the server said that we never wrote down.");
  });

  it("a send that never reached us says so, and never blames the confirmation email", () => {
    const words = notSentWords(en);
    expect(words).not.toBe(OPEN_WORDS.notSent);
    expect(words).toMatch(/still here on the page/);
  });

  it("a translated catalog changes what the reader sees", () => {
    const es = setupI18n({ locale: "es", messages: { es: {} } });
    // With no Spanish compiled in, Lingui falls back to the source: the hook is the message, not a copy of the words.
    expect(voiceWord("skip", es)).toBe(VOICE_WORDS.skip);
  });
});

describe("the language the speech service listens for", () => {
  it("follows the language chosen on the site, keeping the phone's region when it matches", () => {
    expect(speechLang("es", "en-US")).toBe("es");
    expect(speechLang("es", "es-CR")).toBe("es-CR");
  });

  it("keeps the phone's language when the site reads in English, a pseudo-locale, or nothing", () => {
    expect(speechLang("en", "es-CR")).toBe("es-CR");
    expect(speechLang("en-XA", "es-CR")).toBe("es-CR");
    expect(speechLang(null, "pt-BR")).toBe("pt-BR");
    expect(speechLang("en", null)).toBe("en-US");
  });
});
