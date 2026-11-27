/**
 * THE APPLICANT'S NEXT-STEP LETTERS, one per stage (the lead, 27 Nov 2026: "each step should come with an email for
 * next steps as well as show them clearly their next step in their profile").
 *
 * WHICH LETTER SAYS EACH STAGE. Some stages already had their letter, sent by the act that begins them, and those stay
 * the stage's one email: Received is the confirmation letter (server/routes/openProposals.ts, key `:status`), Our
 * review is the invitation letter (shared/openProposalDecide.ts `invitedLetter`, key `:invited`), Start is the
 * adoption letter, and the 90-day close is the closed letter (`closedLetter`, key `:closed`). This file writes the
 * rest: References and proposal, Final conversation and Agreement, plus the one letter after the applicant first
 * refines their proposal. Each goes once per application and stage (`stageLetterKey`).
 *
 * WHAT A LETTER CARRIES, and nothing else: the stage, the next step (a "- " list when there are several, the lead:
 * "make these bullet points when there are multiple steps"), who acts next BY ROLE, a link to the applicant's own page
 * where each step has its button, and the booking link of the conversation open NOW at this stage (a later stage's
 * link is never in it). No note, score, reference, reference's contact or private team text ever reaches these words:
 * the builder takes none of them.
 *
 * THE VOICE (the lead's, 27 Nov 2026): warm, direct, plain, short sentences.
 *
 * PURE: words only. The server decides which stage, which link and which roles (server/lib/applicantStageLetters.ts).
 * No village or person is named here; the village's name, the circle's name and the roles' names come in from the caller.
 */
import { wordsIn, type ApplicantLanguage } from "./applicantWords";

/** The stages that have a letter of their own here, and the refined-proposal letter. */
export const STAGE_LETTER_STAGES = ["references", "final_interview", "agreement"] as const;
export type StageLetterStage = (typeof STAGE_LETTER_STAGES)[number];
export type StageLetterKind = StageLetterStage | "refined";

/** One letter per application and stage, whatever sends it again (the post office drops a repeated key). */
export const stageLetterKey = (ref: string, kind: StageLetterKind): string => `open-proposal:${ref}:stage:${kind}`;

export interface StageLetterInput {
  kind: StageLetterKind;
  firstName: string | null;
  roleNames: readonly string[];
  /** The conversation open now at this stage, said by its role ("Ops"), with its booking links; null when none is open. */
  booking: { role: string; links: readonly string[] } | null;
  /** The role that follows up references, by name, or null. */
  followupRole: string | null;
  /** The role that makes the final call, by name, or null. */
  finalCallRole: string | null;
  /** The village's anchor circle, by name, which reviews the proposal at Agreement; null says "the circle". */
  anchorCircle?: string | null;
  /** The references form is open on the applicant's page now. */
  referencesOpen: boolean;
  /** The references are in already: we never ask again (the lead, 27 Nov 2026). */
  referencesIn?: boolean;
  /** They may still replace the list, since nobody has reached out yet. */
  referencesEditable?: boolean;
  /** The proposal can still be refined. */
  refineOpen: boolean;
  statusLink: string | null;
  /** The applicant's profile, when they have an account: the same buttons live there. */
  profileLink?: string | null;
  lang?: ApplicantLanguage | null;
}

interface StageWords {
  subject: Record<StageLetterKind, (role: string | null, circle: string) => string>;
  onYourPage(link: string): string;
  onYourProfile(link: string): string;
  references: {
    where: string;
    refs: string;
    refsSoon: string;
    refsIn(followup: string | null): string;
    refsEdit: string;
    refine(circle: string): string;
    book(role: string, link: string): string;
    bookLater: string;
    who(followup: string | null): string;
  };
  final: { where: string; why(circle: string): string; book(role: string, link: string): string; write(role: string | null): string; who(role: string | null): string };
  agreement: { where(circle: string): string; next(circle: string): string; who(circle: string): string };
  refined: { thanks: string; again(circle: string): string };
  nextStep: string;
  whoActs: string;
  links(links: readonly string[]): string;
  circle: string;
}

const theCircle = (anchor: string | null | undefined, plain: string): string => (!anchor ? plain : /^(the|el|la)\s/i.test(anchor) ? anchor : anchor);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const EN: StageWords = {
  subject: {
    references: () => "Next up: your references and your proposal",
    final_interview: (role) => (role ? `Next up: your final conversation with ${role}` : "Next up: your final conversation"),
    agreement: (_role, circle) => `Your proposal is with ${circle}`,
    refined: () => "Got it: your updated proposal",
  },
  onYourPage: (link) => `Everything for this step is on your page, one button each: ${link}`,
  onYourProfile: (link) => `It's on your profile too: ${link}`,
  references: {
    where: "Thanks for your conversation. You're now at References and proposal.",
    refs: "- Add your references. For each one we need their email, plus a WhatsApp number, a US phone number or a Signal number. Please let them know we'll be in touch.",
    refsSoon: "- Add your references when we ask. The form opens on your page.",
    refsIn: (followup) => `- Your references are in. ${followup ?? "The team"} is about to reach out to them.`,
    refsEdit: "- Want to change one? You can edit them on your page until we reach out.",
    refine: (circle) => `- Keep refining your proposal. You can update it until it goes to ${circle} for review.`,
    book: (role, link) => `- Book your conversation with ${role}: ${link}`,
    bookLater: "- Your next conversation opens on your page when it's ready.",
    who: (followup) => (followup ? `You, then ${followup}, who reaches out to your references.` : "You, then the team, who reaches out to your references."),
  },
  final: {
    where: "Your conversations and references are done. Next is your final conversation.",
    why: (circle) => `It's a chance to connect with the source of this village. Bring your proposal as best you can. You won't be presenting it. You can keep refining it after the conversation too, until it goes to ${circle} for review.`,
    book: (role, link) => `Book your final conversation with ${role}: ${link}`,
    write: (role) => (role ? `We'll write to you with times for your final conversation with ${role}.` : "We'll write to you with times for your final conversation."),
    who: (role) => (role ? `You book the time. Then ${role} meets with you.` : "You book the time. Then the team meets with you."),
  },
  agreement: {
    where: (circle) => `Your final conversation is done, and your proposal is now with ${circle} for review. It's fixed from here.`,
    next: (circle) => `${cap(circle)} accepts your proposal or sends a counter-offer. If they counter, you answer each change on your page, and we go back and forth until we agree. Then you get an email with your start date.`,
    who: (circle) => `${cap(circle)}.`,
  },
  refined: {
    thanks: "Got it. Your updated proposal is saved, and the team will read it.",
    again: (circle) => `You can keep refining it on your page until it goes to ${circle} for review.`,
  },
  nextStep: "Next step:",
  whoActs: "Who acts next:",
  links: (links) => (links.length === 1 ? links[0] : `\n${links.map((l, n) => `  ${n + 1}. ${l}`).join("\n")}`),
  circle: "the circle",
};

const ES: StageWords = {
  subject: {
    references: () => "Lo que sigue: sus referencias y su propuesta",
    final_interview: (role) => (role ? `Lo que sigue: su conversación final con ${role}` : "Lo que sigue: su conversación final"),
    agreement: (_role, circle) => `Su propuesta está con ${circle}`,
    refined: () => "Recibido: su propuesta actualizada",
  },
  onYourPage: (link) => `Todo lo de este paso está en su página, con un botón para cada cosa: ${link}`,
  onYourProfile: (link) => `También está en su perfil: ${link}`,
  references: {
    where: "Gracias por su conversación. Ahora está en Referencias y propuesta.",
    refs: "- Agregue sus referencias. De cada una necesitamos su correo, y además un número de WhatsApp, un teléfono de EE. UU. o un número de Signal. Por favor, avíseles que nos pondremos en contacto.",
    refsSoon: "- Agregue sus referencias cuando se las pidamos. El formulario se abre en su página.",
    refsIn: (followup) => `- Sus referencias ya llegaron. ${followup ?? "El equipo"} está por contactarlas.`,
    refsEdit: "- ¿Quiere cambiar alguna? Puede editarlas en su página hasta que las contactemos.",
    refine: (circle) => `- Siga mejorando su propuesta. Puede actualizarla hasta que pase a ${circle} para su revisión.`,
    book: (role, link) => `- Reserve su conversación con ${role}: ${link}`,
    bookLater: "- Su siguiente conversación se abre en su página cuando esté lista.",
    who: (followup) => (followup ? `Usted, y luego ${followup}, que contacta a sus referencias.` : "Usted, y luego el equipo, que contacta a sus referencias."),
  },
  final: {
    where: "Sus conversaciones y referencias están listas. Ahora sigue su conversación final.",
    why: (circle) => `Es una oportunidad para conectar con la fuente de esta aldea. Traiga su propuesta lo mejor que pueda. No tiene que presentarla. Puede seguir mejorándola también después de la conversación, hasta que pase a ${circle} para su revisión.`,
    book: (role, link) => `Reserve su conversación final con ${role}: ${link}`,
    write: (role) => (role ? `Le escribiremos con horarios para su conversación final con ${role}.` : "Le escribiremos con horarios para su conversación final."),
    who: (role) => (role ? `Usted reserva el horario. Luego ${role} se reúne con usted.` : "Usted reserva el horario. Luego el equipo se reúne con usted."),
  },
  agreement: {
    where: (circle) => `Su conversación final está lista, y su propuesta ahora está con ${circle} para su revisión. Desde aquí queda fija.`,
    next: (circle) => `${cap(circle)} acepta su propuesta o le envía una contraoferta. Si hay contraoferta, usted responde cada cambio en su página, y seguimos hasta llegar a un acuerdo. Luego le llega un correo con su fecha de inicio.`,
    who: (circle) => `${cap(circle)}.`,
  },
  refined: {
    thanks: "Recibido. Su propuesta actualizada está guardada, y el equipo la leerá.",
    again: (circle) => `Puede seguir mejorándola en su página hasta que pase a ${circle} para su revisión.`,
  },
  nextStep: "Siguiente paso:",
  whoActs: "Quién actúa ahora:",
  links: (links) => (links.length === 1 ? links[0] : `\n${links.map((l, n) => `  ${n + 1}. ${l}`).join("\n")}`),
  circle: "el círculo",
};

const TABLES: Record<ApplicantLanguage, StageWords> = { en: EN, es: ES };

/** The one gentle reminder to book a conversation still open (server/lib/applicantNudges.ts): once per conversation. */
export const bookingNudgeKey = (ref: string, interviewId: number): string => `open-proposal:${ref}:nudge:book:${interviewId}`;

const NUDGE: Record<ApplicantLanguage, { subject(role: string): string; line(role: string): string; book(link: string): string; write: string }> = {
  en: {
    subject: (role) => `A gentle reminder: your conversation with ${role}`,
    line: (role) => `Just a gentle reminder: your conversation with ${role} is open to book. If you've booked it already, thank you, and please ignore this.`,
    book: (link) => `Book it here: ${link}`,
    write: "We'll write to you with times.",
  },
  es: {
    subject: (role) => `Un recordatorio amable: su conversación con ${role}`,
    line: (role) => `Solo un recordatorio amable: su conversación con ${role} está abierta para reservar. Si ya la reservó, gracias, y puede ignorar este correo.`,
    book: (link) => `Resérvela aquí: ${link}`,
    write: "Le escribiremos con horarios.",
  },
};

/** The reminder's words: the role, its booking link, the status page. Nothing private. PURE. */
export function bookingNudgeLetter(i: { firstName: string | null; role: string; links: readonly string[]; statusLink: string | null; lang?: ApplicantLanguage | null }): { subject: string; text: string } {
  const lang: ApplicantLanguage = i.lang === "es" ? "es" : "en";
  const base = wordsIn(lang);
  const n = NUDGE[lang];
  const s = TABLES[lang];
  return {
    subject: n.subject(i.role),
    text: [base.hello(i.firstName), "", n.line(i.role), "", i.links.length ? n.book(s.links(i.links)) : n.write, "", i.statusLink ? base.statusLinkLine(i.statusLink) : base.keepStatusLink, ""].join("\n"),
  };
}

/** The letter for one stage, in the applicant's language: subject and plain text. PURE. */
export function stageLetter(i: StageLetterInput): { subject: string; text: string } {
  const lang: ApplicantLanguage = i.lang === "es" ? "es" : "en";
  const base = wordsIn(lang);
  const s = TABLES[lang];
  const roles = base.list(i.roleNames) || base.aRole;
  const circle = theCircle(i.anchorCircle, s.circle);
  const booking = i.booking && i.booking.links.length ? i.booking : null;
  const page = [...(i.statusLink ? [s.onYourPage(i.statusLink)] : []), ...(i.profileLink ? [s.onYourProfile(i.profileLink)] : [])];
  let lines: string[];
  switch (i.kind) {
    case "references":
      lines = [
        s.references.where,
        "",
        s.nextStep,
        ...page,
        // Never asked twice (the lead, 27 Nov 2026): once they are in, we say we are about to reach out.
        ...(i.referencesIn ? [s.references.refsIn(i.followupRole), ...(i.referencesEditable ? [s.references.refsEdit] : [])] : [i.referencesOpen ? s.references.refs : s.references.refsSoon]),
        ...(i.refineOpen ? [s.references.refine(circle)] : []),
        booking ? s.references.book(booking.role, s.links(booking.links)) : s.references.bookLater,
        "",
        s.whoActs,
        s.references.who(i.followupRole),
      ];
      break;
    case "final_interview": {
      const role = i.booking?.role ?? i.finalCallRole;
      lines = [
        s.final.where,
        "",
        s.final.why(circle),
        "",
        s.nextStep,
        booking ? s.final.book(booking.role, s.links(booking.links)) : s.final.write(role),
        "",
        s.whoActs,
        s.final.who(role),
      ];
      break;
    }
    case "agreement":
      lines = [s.agreement.where(circle), "", s.nextStep, s.agreement.next(circle), "", s.whoActs, s.agreement.who(circle)];
      break;
    case "refined":
      lines = [s.refined.thanks, ...(i.refineOpen ? [s.refined.again(circle)] : [])];
      break;
  }
  const subjectRole = i.kind === "final_interview" ? (i.booking?.role ?? i.finalCallRole) : null;
  // The stage letters already point to the page in their own lines; the refined letter and Agreement close with it.
  const tail = i.kind === "references" ? [] : ["", i.statusLink ? base.statusLinkLine(i.statusLink) : base.keepStatusLink];
  return {
    subject: s.subject[i.kind](subjectRole, circle),
    text: [base.hello(i.firstName), "", ...lines, ...tail, ""].join("\n"),
  };
}
