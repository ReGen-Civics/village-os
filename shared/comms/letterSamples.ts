/**
 * THE LETTERS WITH SAMPLE VALUES, for a preview: what an applicant reads when
 * our review says no, when a proposal is declined, when a join request is
 * answered no, when our review says yes, and a member email carrying the
 * come-and-play block as its footer.
 *
 * Read by `scripts/preview-letters.ts` (static files to look at) and by the
 * admin preview door (`GET /api/admin/comms/letter-previews`), which passes
 * the village's real look and modules. The person, the roles and the note are
 * made up; the sample village, when no real one is passed, is a made-up one.
 *
 * Pure and isomorphic.
 */
import type { ApplicantLanguage } from "../applicantWords";
import type { ModuleLifecycle } from "../modules";
import { declineLetter } from "../joinAnswers";
import { declinedLetter, invitedLetter, notInvitedLetter } from "../openProposalDecide";
import { comeAndPlayWords, renderComeAndPlay, type PlayAudience } from "./comeAndPlay";
import { bodyFromText, letterPalette, renderLetterFrame } from "./letterFrame";
import { composeEmail, type EmailVillage } from "./letterHtml";

export const LETTER_SAMPLE_IDS = ["not-invited", "not-invited-es", "declined", "join-declined", "invited", "member-footer"] as const;
export type LetterSampleId = (typeof LETTER_SAMPLE_IDS)[number];

export interface LetterSample {
  id: LetterSampleId;
  label: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export interface SampleInput {
  village?: EmailVillage;
  seed?: string | null;
  character?: string | null;
  lifecycleOf?: (moduleId: string) => ModuleLifecycle;
  newsletter?: string | null;
  stayClose?: { name: string; href: string } | null;
  team?: string | null;
  hero?: { url: string; alt: string } | null;
}

/** A made-up village for a preview with no real one. */
export const SAMPLE_VILLAGE: EmailVillage = {
  name: "Willow Creek",
  url: "https://willow-creek.example",
  logoUrl: null,
  seed: null,
  character: null,
  postalAddress: "",
};

const LABELS: Record<LetterSampleId, string> = {
  "not-invited": "Our review's no (the not-invited letter)",
  "not-invited-es": "The not-invited letter, in Spanish",
  declined: "A proposal declined",
  "join-declined": "A request to join, answered no",
  invited: "Our review's yes (the invitation)",
  "member-footer": "A member email with the come-and-play footer",
};

export function renderSampleLetters(i: SampleInput = {}): LetterSample[] {
  const village: EmailVillage = { ...(i.village ?? SAMPLE_VILLAGE), ...(i.seed !== undefined && !i.village ? { seed: i.seed, character: i.character ?? null } : {}) };
  const palette = letterPalette(village.seed, village.character);
  const site = village.url;
  const lifecycleOf = i.lifecycleOf ?? (() => "public" as ModuleLifecycle);
  const newsletter = i.newsletter === undefined ? "/village-email" : i.newsletter;
  const stayClose = i.stayClose === undefined ? { name: "Friends of the Village", href: "/resident" } : i.stayClose;
  const roles = ["Garden Steward"];
  const block = (lang: ApplicantLanguage, audience: PlayAudience = "public") =>
    renderComeAndPlay({ site, audience, lifecycleOf, newsletter, stayClose, lang, palette, hero: i.hero ?? null });
  const frame = (id: LetterSampleId, words: { subject: string; text: string; button?: { label: string; url: string } | null }, lang: ApplicantLanguage, withBlock: boolean): LetterSample => {
    const w = comeAndPlayWords(lang);
    const extra = withBlock ? block(lang) : null;
    const f = renderLetterFrame({
      village,
      lang,
      subject: words.subject,
      body: bodyFromText(palette, words.text, words.button ?? null),
      signature: { signOff: w.signOff, team: (i.team ?? "").trim() || w.team(village.name) },
      extra: extra && extra.html ? extra : null,
      why: w.why(village.name),
      palette,
    });
    return { id, label: LABELS[id], ...f };
  };

  const stay = { program: stayClose, quests: true, events: true };
  const member = composeEmail({
    words: {
      subject: "Your thank-you was received",
      preheader: null,
      bodyMd: "Hi {{person.firstName}},\n\nYour thank-you reached the village. It's on the wall now for everyone to see.\n\n[See it]({{village.url}}/gratitude)",
    },
    values: { "person.firstName": "Sam", "links.preferences": `${site}/email/preferences` },
    village,
    kind: "essential",
    templateKey: null,
    comeAndPlay: block("en", "members"),
  });

  return [
    frame("not-invited", notInvitedLetter({ firstName: "Sam", village: village.name, roleNames: roles, site, stayClose: stay, lang: "en", doorsInBlock: true }), "en", true),
    frame("not-invited-es", notInvitedLetter({ firstName: "Sam", village: village.name, roleNames: roles, site, stayClose: stay, lang: "es", doorsInBlock: true }), "es", true),
    frame("declined", declinedLetter({ firstName: "Sam", village: village.name, roleNames: roles, site, lang: "en", doorsInBlock: true }), "en", true),
    frame("join-declined", declineLetter({ firstName: "Sam", village: village.name }), "en", true),
    frame(
      "invited",
      invitedLetter({
        firstName: "Sam",
        village: village.name,
        roleNames: roles,
        conversations: [
          { role: "Human Operations", minutes: 30, bookingUrl: `${site}/book/first` },
          { role: "Garden Circle", minutes: 45 },
        ],
        statusLink: `${site}/application-status/sample`,
        lang: "en",
      }),
      "en",
      false,
    ),
    { id: "member-footer", label: LABELS["member-footer"], subject: member.subject, preheader: member.preheader, html: member.html, text: member.text },
  ];
}
