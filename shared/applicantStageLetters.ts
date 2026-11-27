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
 * WHAT A LETTER CARRIES, and nothing else: the stage, the next step, who acts next BY ROLE, and the booking link of
 * the conversation open NOW at this stage (a later stage's link is never in it), and the applicant's status link. No
 * note, score, reference, transcript or private team text ever reaches these words: the builder takes none of them.
 *
 * PURE: words only. The server decides which stage, which link and which roles (server/lib/applicantStageLetters.ts).
 * No village or person is named here; the village's name and the roles' names come in from the caller.
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
  /** The role that makes the final call, by name, or null (then the people who place roles decide). */
  finalCallRole: string | null;
  /** The references form is open on the status page now. */
  referencesOpen: boolean;
  /** The proposal can still be refined. */
  refineOpen: boolean;
  statusLink: string | null;
  lang?: ApplicantLanguage | null;
}

interface StageWords {
  subject: Record<StageLetterKind, (role: string | null) => string>;
  references: {
    where(roles: string): string;
    refs: string;
    refsSoon: string;
    refine: string;
    book(role: string, link: string): string;
    bookLater: string;
    who(followup: string | null): string;
  };
  final: { where: string; book(role: string, link: string): string; write(role: string | null): string; fixed: string; who(role: string | null): string };
  agreement: { where: string; next: string; who(role: string | null): string };
  refined: { thanks(roles: string): string; again: string };
  nextStep: string;
  whoActs: string;
  links(links: readonly string[]): string;
}

const EN: StageWords = {
  subject: {
    references: () => "Your next step: your references and your proposal",
    final_interview: (role) => (role ? `Your next step: your final conversation with ${role}` : "Your next step: your final conversation"),
    agreement: () => "Your next step: our answer to your proposal",
    refined: () => "We have your refined proposal",
  },
  references: {
    where: (roles) => `Your application to hold ${roles} is through our review, and now at References and proposal.`,
    refs: "Add your references on your status page: people who know your work, how to reach them and how they know you.",
    refsSoon: "We will ask for your references next. The form opens on your status page when we do.",
    refine: "You can refine your proposal on your status page until your final conversation opens. After that it is fixed.",
    book: (role, link) => `Book your conversation with ${role}: ${link}`,
    bookLater: "Your next conversation opens on your status page when it is ready.",
    who: (followup) => (followup ? `You, then ${followup}, who follows up with your references.` : "You, then the team, who follows up with your references."),
  },
  final: {
    where: "Your conversations and references are in. Your application is at its final conversation.",
    book: (role, link) => `Book your final conversation with ${role}: ${link}`,
    write: (role) => (role ? `We'll write to you with times for your final conversation with ${role}.` : "We'll write to you with times for your final conversation."),
    fixed: "Bring your proposal: you present it there. It is now fixed, so any change from here goes through our answer to it.",
    who: (role) => (role ? `You book the time, then ${role} holds the conversation.` : "You book the time, then the team holds the conversation."),
  },
  agreement: {
    where: "Your final conversation is written up. Your application is at Agreement.",
    next: "We answer your proposal: we accept it, or we suggest changes to its terms. You answer each change on your status page, and we go back and forth until we agree.",
    who: (role) => (role ? `${role}, who makes the final call.` : "The people who place roles in the village."),
  },
  refined: {
    thanks: (roles) => `Thank you: your refined proposal to hold ${roles} is saved, and the team reads it before your final conversation.`,
    again: "You can refine it again on your status page until your final conversation opens.",
  },
  nextStep: "Next step:",
  whoActs: "Who acts next:",
  links: (links) => (links.length === 1 ? links[0] : `\n${links.map((l, n) => `${n + 1}. ${l}`).join("\n")}`),
};

const ES: StageWords = {
  subject: {
    references: () => "Su siguiente paso: sus referencias y su propuesta",
    final_interview: (role) => (role ? `Su siguiente paso: su conversación final con ${role}` : "Su siguiente paso: su conversación final"),
    agreement: () => "Su siguiente paso: nuestra respuesta a su propuesta",
    refined: () => "Tenemos su propuesta mejorada",
  },
  references: {
    where: (roles) => `Su postulación para sostener ${roles} pasó nuestra revisión y ahora está en Referencias y propuesta.`,
    refs: "Agregue sus referencias en su página de estado: personas que conocen su trabajo, cómo contactarlas y cómo la conocen.",
    refsSoon: "Le pediremos sus referencias a continuación. El formulario se abre en su página de estado cuando lo hagamos.",
    refine: "Puede mejorar su propuesta en su página de estado hasta que se abra su conversación final. Después queda fija.",
    book: (role, link) => `Reserve su conversación con ${role}: ${link}`,
    bookLater: "Su siguiente conversación se abre en su página de estado cuando esté lista.",
    who: (followup) => (followup ? `Usted, y luego ${followup}, que contacta a sus referencias.` : "Usted, y luego el equipo, que contacta a sus referencias."),
  },
  final: {
    where: "Sus conversaciones y referencias están completas. Su postulación está en su conversación final.",
    book: (role, link) => `Reserve su conversación final con ${role}: ${link}`,
    write: (role) => (role ? `Le escribiremos con horarios para su conversación final con ${role}.` : "Le escribiremos con horarios para su conversación final."),
    fixed: "Traiga su propuesta: usted la presenta allí. Ahora queda fija, así que cualquier cambio desde aquí pasa por nuestra respuesta.",
    who: (role) => (role ? `Usted reserva el horario y luego ${role} sostiene la conversación.` : "Usted reserva el horario y luego el equipo sostiene la conversación."),
  },
  agreement: {
    where: "Su conversación final está escrita. Su postulación está en Acuerdo.",
    next: "Respondemos a su propuesta: la aceptamos o sugerimos cambios en sus términos. Usted responde cada cambio en su página de estado, y seguimos hasta llegar a un acuerdo.",
    who: (role) => (role ? `${role}, que toma la decisión final.` : "Las personas que asignan los roles en la aldea."),
  },
  refined: {
    thanks: (roles) => `Gracias: su propuesta mejorada para sostener ${roles} está guardada, y el equipo la lee antes de su conversación final.`,
    again: "Puede mejorarla de nuevo en su página de estado hasta que se abra su conversación final.",
  },
  nextStep: "Siguiente paso:",
  whoActs: "Quién actúa ahora:",
  links: (links) => (links.length === 1 ? links[0] : `\n${links.map((l, n) => `${n + 1}. ${l}`).join("\n")}`),
};

const TABLES: Record<ApplicantLanguage, StageWords> = { en: EN, es: ES };

/** The letter for one stage, in the applicant's language: subject and plain text. PURE. */
export function stageLetter(i: StageLetterInput): { subject: string; text: string } {
  const lang: ApplicantLanguage = i.lang === "es" ? "es" : "en";
  const base = wordsIn(lang);
  const s = TABLES[lang];
  const roles = base.list(i.roleNames) || base.aRole;
  const booking = i.booking && i.booking.links.length ? i.booking : null;
  let lines: string[];
  switch (i.kind) {
    case "references":
      lines = [
        s.references.where(roles),
        "",
        s.nextStep,
        i.referencesOpen ? s.references.refs : s.references.refsSoon,
        ...(i.refineOpen ? [s.references.refine] : []),
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
        s.nextStep,
        booking ? s.final.book(booking.role, s.links(booking.links)) : s.final.write(role),
        s.final.fixed,
        "",
        s.whoActs,
        s.final.who(role),
      ];
      break;
    }
    case "agreement":
      lines = [s.agreement.where, "", s.nextStep, s.agreement.next, "", s.whoActs, s.agreement.who(i.finalCallRole)];
      break;
    case "refined":
      lines = [s.refined.thanks(roles), ...(i.refineOpen ? [s.refined.again] : [])];
      break;
  }
  const subjectRole = i.kind === "final_interview" ? (i.booking?.role ?? i.finalCallRole) : null;
  return {
    subject: s.subject[i.kind](subjectRole),
    text: [base.hello(i.firstName), "", ...lines, "", i.statusLink ? base.statusLinkLine(i.statusLink) : base.keepStatusLink, ""].join("\n"),
  };
}
