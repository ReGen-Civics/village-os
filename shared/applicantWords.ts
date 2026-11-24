/**
 * EVERY WORD AN APPLICANT READS FROM US, BY LANGUAGE.
 *
 * The emails, the profile notices and the status page for a role proposal come
 * from here. English is the source. A language is one entry of `LANGUAGES`
 * typed as `ApplicantMessages`, so a line added to the English table and left
 * out of another language fails the TYPECHECK, and `applicantWords.test.ts`
 * checks the same thing at run time (and that the two tables agree on the
 * shape of every line).
 *
 * WHICH LANGUAGE is decided in shared/applicantLanguage.ts. A language here
 * must also be one the site offers (shared/i18nLocales.ts), which the test pins.
 *
 * Voice: plain, warm, first person plural. Spanish uses "tú".
 * NEEDS A NATIVE EAR: the Spanish below is written carefully and has not been
 * read by a native speaker yet. The lines most worth a second look are marked
 * `// check:` and listed in the lane's report.
 */

import { STEP_WORDS } from "./applicationReview";

export const APPLICANT_LANGUAGES = ["en", "es"] as const;
export type ApplicantLanguage = (typeof APPLICANT_LANGUAGES)[number];
export const DEFAULT_APPLICANT_LANGUAGE: ApplicantLanguage = "en";

export const isApplicantLanguage = (v: unknown): v is ApplicantLanguage => (APPLICANT_LANGUAGES as readonly string[]).includes(String(v));

export interface ApplicantMessages {
  hello(firstName: string | null): string;
  /** "A, B and C". */
  list(items: readonly string[]): string;
  aRole: string;
  /** The line that points to the status link in the first email. Also how a notice drops it. */
  keepStatusLink: string;
  /** The same pointer with the link itself in it, for a letter sent by a door that can mint one. */
  statusLinkLine(link: string): string;
  /**
   * The village's reply promise, in moon cycles (`effectiveReplyMoons`, shared/contributorRoutes.ts). `null`: the
   * application is for a role that opens after the founding team (shared/foundingTeam.ts).
   */
  replyPromise(moons: number | null): string;
  /** Introduces a decider's note in an email or a notice. */
  noteIntro: string;
  day(iso: string): string;

  confirm: {
    subject(village: string): string;
    proposed(roles: string, village: string, when: string | null): string;
    nextSeason: string;
    thisMoon(from: string, to: string): string;
    ask: string;
    validFor(hours: number): string;
    aiDrafts: string;
  };
  statusEmail: { subject: string; text(link: string, replyPromise: string): string };

  update: {
    confirmedTitle(village: string): string;
    confirmed(roles: string, promise: string): string;
    firstReplyTitle: string;
    firstReply(roles: string): string;
    conversationTitle: string;
    /** The next conversation has opened: book it through the role's link, or we write with times. */
    conversation(roles: string, withRole: string | null, minutes: number | null, bookingUrl: string | null): string;
    consentTitle: string;
    consent(roles: string): string;
    termsTitle: string;
    terms(roles: string): string;
    adoptedTitle(village: string): string;
    adopted(village: string, roles: string, next: string): string;
    declinedTitle(village: string): string;
    declined(roles: string): string;
    invitedTitle: string;
    invited(roles: string): string;
    notInvitedTitle(village: string): string;
    notInvited(roles: string): string;
    /** A shortlisted applicant is asked for references (shared/applicantOnboarding.ts). The form is on their status page. */
    referencesTitle: string;
    references(roles: string): string;
  };

  /** THE INVITATION (our review said yes): the conversations in order, from the role's own list. */
  invite: {
    subject(village: string): string;
    headline(roles: string): string;
    conversationsIntro: string;
    conversation(role: string, minutes: number): string;
    total(minutes: number): string;
    booking: string;
    /** The first conversation's own way in: the interviewing role's booking link, or our letter with times. */
    bookFirst(role: string, url: string): string;
    writeFirst(role: string): string;
    /** Only when there is more than one: the later ones open in order. */
    laterOpen: string;
    after: string;
  };

  /** THE NOT-INVITED LETTER (build list 6.6): warm, clear, never personal, with open ways to stay close. */
  notInvited: {
    subject(village: string): string;
    thanks(roles: string, village: string): string;
    matched: string;
    stayClose: string;
    program(name: string, url: string): string;
    quest(url: string): string;
    events(url: string): string;
    closing: string;
  };

  /**
   * THE CLOSED LETTER: an application nobody answered in time is closed by the
   * tidy job, and this goes once. Short and kind, points to quests, and is
   * signed by a role team. No date and no count of days in its words.
   */
  closed: {
    subject(village: string): string;
    thanks(roles: string, village: string): string;
    closed: string;
    quest(url: string): string;
    page(link: string): string;
    /** The signature: a role's name, or the village's when no role welcomes people. */
    signed(team: string): string;
  };


  adopt: {
    subject(village: string): string;
    headline(village: string, roles: string, forWhen: string): string;
    forThisMoon: string;
    forNextSeason: string;
    inviteIntro: string;
    inviteWorks(days: number, whenRolesStart: string): string;
    signIn(whenRolesStart: string): string;
    moonRuns(from: string, to: string): string;
    seasonStarts(season: string | null, startsOn: string): string;
    firstDay: string;
    nextSeasonName: string;
    nextAfterProfile: string;
    button: string;
    signFirst(): string;
    /** A reviewed application's yes: the circle consented, said as a welcome. */
    headlineReviewed(village: string, roles: string): string;
    firstCycle: string;
  };

  declined: {
    subject(village: string): string;
    thanks(roles: string, village: string): string;
    stayClose: string;
    quest(url: string): string;
    roles(url: string): string;
    again: string;
    /** The same invitation to propose again, standing on its own: the letter whose ways in are the come-and-play block (shared/comms/comeAndPlay.ts). */
    againOwn: string;
  };

  page: {
    declinedHeading: string;
    declinedLine: string;
    quests: string;
    roles: string;
    again: string;
    noteHeading: string;
  };

  /** The status page itself (`/application-status/:ref`): every word the page draws, so it reads in one language. */
  status: {
    heading: string;
    /** The heading for an application our review reads first. */
    headingApplication: string;
    missing: string;
    nextLabel: string;
    by(day: string): string;
    /** The eyebrow over the card: the step the proposal is on. */
    step: Record<"confirmed" | "first_reply" | "review" | "invited" | "not_invited" | "interview" | "scores_in" | "consent" | "decided" | "first_cycle" | "cleared", string>;
    /** The path, line by line. */
    received: string;
    firstReply: string;
    review: string;
    invitation: string;
    firstCycle: string;
    conversationWith(role: string, minutes: number): string;
    consent: string;
    decision: string;
    stateDone: string;
    stateNow: string;
    stateLater: string;
    /** What happens next, one line each. */
    move: {
      firstReply: string;
      interview(role: string, minutes: number): string;
      interviewWaiting: string;
      consent: string;
      adopted: string;
      withdrawn: string;
      declined: string;
      review: string;
      decision: string;
      notInvited: string;
      /** The application was closed because nobody answered it in time. */
      closed: string;
    };
    notInvited: { heading: string; line: string; program(name: string): string; quests: string; events: string };
    /** The eyebrow and the card for an application closed because nobody answered it in time. */
    closed: { step: string; heading: string; line: string; quests: string; roles: string };
    /** The applicant's own door when their invitation expired: it asks the team, and never makes a new one by itself. */
    newInvitation: { heading: string; line: string; ask: string; asked: string; failed: string };
    booking: {
      label: string;
      /**
       * The one booking story (lead, 12 Nov 2026: "we invite you to book conversation times"):
       * after the invitation the applicant books each conversation at times they choose, in the
       * role's order. Each opens once the one before it is written up (the in-order gating), so
       * "back to back" is not offered. Told the same whatever the role's `conversationMode` holds,
       * which old cards may still carry.
       */
      order(roles: readonly string[]): string;
      /** The conversation open now: its role's booking link, or our letter with times. */
      bookNow(role: string): string;
      writeNow(role: string): string;
    };
    references: {
      none: string;
      some(n: number): string;
    };
    /** The references a shortlisted applicant is asked for: the step on the path and the form on this page (shared/applicantOnboarding.ts). */
    referenceForm: {
      step: string;
      heading: string;
      line: string;
      /** The line for a member taking on their first long-term role, who was never on a shortlist (shared/applicantOnboarding.ts `asksReferences`). */
      lineFirstRole: string;
      privacy: string;
      name: string;
      contact: string;
      contactHint: string;
      how: string;
      ally: string;
      allyHint: string;
      add: string;
      remove(n: number): string;
      row(n: number): string;
      send: string;
      sent: string;
      given(n: number): string;
      failed: string;
      errors: Record<"none" | "too_few" | "too_many" | "needs_all" | "contact" | "twice" | "too_long", string>;
      /** The fewest and the preferred number, said under the form's line (the lead, 19 Nov 2026). */
      howMany: string;
    };
    private: string;
    wait: { heading: string; line: string; quests: string; map: string; events: string };
  };
}

const enList = (items: readonly string[]): string => {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
};

const esList = (items: readonly string[]): string => {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  const last = clean[clean.length - 1];
  // "e" before a word that starts with the sound i (Spanish spelling rule); role names are the village's own words.
  const y = /^(i|hi)(?![aeou])/i.test(last) ? "e" : "y"; // check: role names starting with i or hi
  return `${clean.slice(0, -1).join(", ")} ${y} ${last}`;
};

const dayIn = (locale: string) => (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "").trim());
  if (!m) return String(iso ?? "");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

export const OPEN_AI_DRAFTS_EN = "An AI may help draft our replies to you; a person always reads and sends them, and no AI takes part in choosing.";

const en: ApplicantMessages = {
  hello: (n) => (n ? `Hi ${n},` : "Hi,"),
  list: enList,
  aRole: "a role",
  keepStatusLink: "Your status page link is in the first email we sent you, so you can follow it any time.",
  statusLinkLine: (link) => `Your status page, to follow it any time: ${link}`,
  replyPromise: (moons) =>
    moons === null ? "We're filling our founding team first, so it may be a while before we reply. We'll write to you as soon as we're ready to talk." : moons === 1 ? "You'll hear from us within one moon cycle." : `You'll hear from us within ${moons} moon cycles.`,
  noteIntro: "A note from us:",
  day: dayIn("en-GB"),

  confirm: {
    subject: (v) => `Confirm your proposal to ${v}`,
    proposed: (roles, v, when) => `You proposed to hold ${roles} in ${v} ${when ? `for ${when}` : "next season"}.`,
    nextSeason: "next season",
    thisMoon: (from, to) => `this moon, from ${from} to ${to}`,
    ask: "Confirm it's you, and your proposal goes to the village:",
    validFor: (h) => `The link works for ${h} hours. If this wasn't you, leave it, and nothing happens.`,
    aiDrafts: OPEN_AI_DRAFTS_EN,
  },
  statusEmail: {
    subject: "Where your proposal is",
    text: (link, promise) => `Your proposal is with the village. Follow where it is, who acts next and by when:\n\n${link}\n\n${promise} Keep this link to yourself: it is how we know it is you.`,
  },

  update: {
    confirmedTitle: (v) => `Your proposal is with ${v}`,
    confirmed: (roles, promise) => `Your proposal to hold ${roles} is with us. ${promise}`,
    firstReplyTitle: "We have taken up your proposal",
    firstReply: (roles) => `The role that welcomes people has taken up your proposal to hold ${roles} and will write to you so you can book a time that suits you.`,
    conversationTitle: "We would love to talk with you",
    conversation: (roles, withRole, minutes, bookingUrl) => `The next step on your proposal to hold ${roles} is a conversation${withRole ? ` with ${withRole}` : ""}${minutes ? `, about ${minutes} minutes` : ""}. ${bookingUrl ? `Book a time with ${withRole ?? "them"}: ${bookingUrl}` : "We'll write to you with times."}`,
    consentTitle: "The circle is weighing your proposal",
    consent: (roles) => `The conversations are written up, and the circle is now doing its process for your proposal to hold ${roles}. Watch your email or status page for next steps.`,
    termsTitle: "The terms for your proposal changed",
    terms: (roles) => `We changed the terms we suggest for your proposal to hold ${roles}. Open your status page to read them, and tell us what you think.`,
    adoptedTitle: (v) => `${v} said yes to your proposal`,
    adopted: (v, roles, next) => `${v} said yes to your proposal to hold ${roles}. ${next}`,
    declinedTitle: (v) => `Your proposal to ${v}`,
    declined: (roles) => `Thank you for proposing to hold ${roles}. We can't say yes this time. We encourage you to explore quests, look at other open roles, or propose again next season.`,
    invitedTitle: "We would love to talk with you",
    invited: (roles) => `We read your application to hold ${roles} with care, and we would love to invite you for the next step to meet the team. The details are in your email.`,
    notInvitedTitle: (v) => `Thank you for applying to ${v}`,
    notInvited: (roles) => `Thank you for applying to hold ${roles}. We have found someone more closely matched to this role. We encourage you to explore quests, and we'd love to stay in touch.`,
    referencesTitle: "You are on our shortlist: may we hear from your references?",
    references: (roles) => `Thank you for your application to hold ${roles}. You are on our shortlist, and the next step is your references: people connected with this work, ideally people who could also become allies or partners of the village. Open your status page to add them, with how to reach each one, how they know you and why they might be an ally.`,
  },

  invite: {
    subject: (v) => `An invitation to talk with ${v}`,
    headline: (roles) => `Thank you for applying to hold ${roles}. We have read your application with care, and we would love to invite you to book conversation times.`,
    conversationsIntro: "The conversations, in order:",
    conversation: (role, minutes) => `${role}, ${minutes} minutes`,
    total: (minutes) => `About ${minutes} minutes in all.`,
    booking: "You book each conversation at times you choose, in the order above.",
    bookFirst: (role, url) => `Book a time with ${role} for your first conversation: ${url}`,
    writeFirst: (role) => `We'll write to you with times for your first conversation, with ${role}.`,
    laterOpen: "Each later conversation opens once the one before it is written up, and you book it the same way.",
    after: "After the last conversation, the circle decides by consent, and we write to you with its answer.",
  },

  notInvited: {
    subject: (v) => `Thank you for applying to ${v}`,
    thanks: (roles, v) => `Thank you for applying to hold ${roles} in ${v}, and for the care you put into it.`,
    matched: "We have found someone more closely matched to this role. Thank you for your time and interest.",
    stayClose: "We would love to stay in touch, and there are open ways to be part of the village:",
    program: (name, url) => `${name}: ${url}`,
    quest: (url) => `Take a quest: ${url}`,
    events: (url) => `Come to an event: ${url}`,
    closing: "We hope to meet you soon.",
  },

  closed: {
    subject: (v) => `Your application to ${v}`,
    thanks: (roles, v) => `Thank you for applying to hold ${roles} in ${v}.`,
    closed: "We weren't able to answer your application in time, so we've closed it. Thank you for your time and interest.",
    quest: (url) => `We encourage you to explore quests: ${url}`,
    page: (link) => `Your application's page: ${link}`,
    signed: (team) => `With care,\nThe ${team} team`,
  },


  adopt: {
    subject: (v) => `${v} said yes to your proposal`,
    headline: (v, roles, forWhen) => `${v} said yes to your proposal to hold ${roles} ${forWhen}.`,
    forThisMoon: "this moon",
    forNextSeason: "next season",
    inviteIntro: "Here is your invitation. Use the button to create your profile, or open this link:",
    inviteWorks: (days, when) => `It works once and lasts ${days} days. ${when}`,
    signIn: (when) => `Sign in with this address to see your roles. ${when}`,
    moonRuns: (from, to) => `Your roles run from ${from} to the next new moon, ${to}.`,
    seasonStarts: (season, startsOn) => `Your roles start when ${season || "next season"} begins, on ${startsOn}.`,
    firstDay: "the season's first day",
    nextSeasonName: "next season",
    nextAfterProfile: "Then check your profile. Your tasks appear there once your role starts, and it is where we run our sessions and track our work together.",
    button: "Create your profile",
    signFirst: () => "Before you take the role, align with the Love Letter, the village's membership agreement. Aligning with it makes you a member, with a voice in the village's decisions:",
    headlineReviewed: (v, roles) => `The circle has consented: we would love you to hold ${roles} in ${v}. Welcome.`,
    firstCycle: "We begin with a first cycle together, and at its end either side may choose to end it there.",
  },

  declined: {
    subject: (v) => `Your proposal to ${v}`,
    thanks: (roles, v) => `Thank you for proposing to hold ${roles} in ${v}. We can't say yes this time.`,
    stayClose: "We're glad you found us. If you'd like to stay close, here are three ways in:",
    quest: (url) => `Take a quest: ${url}`,
    roles: (url) => `Look at other open roles: ${url}`,
    again: "Or propose again next season. We would be glad to read it.",
    againOwn: "You're welcome to propose again next season. We would be glad to read it.",
  },

  page: {
    declinedHeading: "Thank you for proposing",
    declinedLine: "We can't say yes this time, and we're glad you found us. If you'd like to stay close:",
    quests: "Take a quest",
    roles: "Look at other open roles",
    again: "Or propose again next season.",
    noteHeading: "A note for you",
  },

  status: {
    heading: "Where your proposal is",
    headingApplication: "Where your application is",
    missing: "That link does not match a proposal. Check the link in your email.",
    nextLabel: "What happens next",
    by: (day) => `By ${day}`,
    step: {
      confirmed: "Received",
      first_reply: "First reply",
      review: "Our review",
      invited: "Invitation",
      not_invited: "Our answer",
      interview: "Conversation",
      scores_in: "Conversations done",
      consent: "The circle's consent",
      decided: "Decision",
      first_cycle: "First cycle",
      cleared: "Cleared",
    },
    received: "Received",
    firstReply: "First reply",
    review: "Our review",
    invitation: "Invitation",
    firstCycle: "First cycle",
    conversationWith: (role, minutes) => `Conversation with ${role} (${minutes} minutes)`,
    consent: "The circle's consent",
    decision: "Decision",
    stateDone: "done",
    stateNow: "now",
    stateLater: "later",
    move: {
      firstReply: "Our move: the role that welcomes people writes to you so you can book a time to talk.",
      interview: (role, minutes) => `Our move: ${role} talks with you for ${minutes} minutes, then adds a note.`,
      interviewWaiting: "Our move: the next conversation opens once the last one is written up. You book it at a time you choose.",
      consent: "Our move: the circle weighs your proposal and consents, or says what is missing.",
      adopted: "Your move: make your account. The link to make it is in your email.",
      withdrawn: "Nothing more is needed. You withdrew this proposal.",
      declined: "Nothing more is needed from you. We have answered.",
      review: "Our move: we read your application with care, then invite you to the conversations or write to thank you.",
      decision: "Our move: the circle weighs everything and decides by consent. We write to you with its answer.",
      notInvited: "Nothing more is needed from you. We have written to you.",
      closed: "Nothing more is needed from you. This application is closed.",
    },
    closed: {
      step: "Closed",
      heading: "This application is closed",
      line: "We weren't able to answer it in time. Thank you for your time and interest. You're welcome to explore:",
      quests: "Explore quests",
      roles: "See the open roles",
    },
    newInvitation: {
      heading: "Need a new invitation?",
      line: "Your invitation to join the team has expired. Ask for a new one, and the team that sends invitations will write to you.",
      ask: "Send me a new invitation",
      asked: "Thank you. We've let the team know, and they'll write to you.",
      failed: "That didn't go through. Please try again.",
    },
    notInvited: {
      heading: "Thank you for applying",
      line: "We have found someone more closely matched to this role. Thank you for your time and interest. We'd love you to stay close:",
      program: (name) => name,
      quests: "Take a quest",
      events: "Come to an event",
    },
    booking: {
      label: "How the conversations are booked",
      order: (roles) =>
        roles.length <= 1
          ? `After the invitation, you book the conversation${roles[0] ? ` with ${roles[0]}` : ""} at a time you choose.`
          : `After the invitation, you book each conversation at times you choose, in this order: ${roles[0]} first, then ${roles.slice(1).join(", then ")}. Each one opens once the one before it is written up.`,
      bookNow: (role) => `Book a time with ${role}`,
      writeNow: (role) => `We'll write to you with times for your conversation with ${role}.`,
    },
    references: {
      none: "You gave no references, so we run a background check. You agreed to it when you proposed. We cover its cost, and we contact no one before our first conversation with you.",
      some: (n) => `You gave ${n} ${n === 1 ? "reference" : "references"}. We contact references only after our first conversation, and only with your OK.`,
    },
    referenceForm: {
      step: "References",
      heading: "Your references",
      line: "You are on our shortlist. Add the people connected with this work who know you, ideally people who could also become allies or partners of the village.",
      lineFirstRole: "This is your first long-term role with us, so we ask for references. Add the people connected with this work who know you, ideally people who could also become allies or partners of the village.",
      privacy: "Only the people who review your application, and the person who follows up with each reference, read these details. No AI reads them. They are deleted with your application.",
      name: "Their name",
      contact: "How to reach them",
      contactHint: "An email address or a phone number.",
      how: "How they know you",
      ally: "Why they might be an ally or partner (optional)",
      allyHint: "What they might bring to the village, or how they might work with us.",
      howMany: "Give at least two references. We prefer three.",
      add: "Add another reference",
      remove: (n) => `Remove reference ${n}`,
      row: (n) => `Reference ${n}`,
      send: "Send my references",
      sent: "Thank you. We have your references.",
      given: (n) => `You gave ${n} ${n === 1 ? "reference" : "references"}. Thank you. If something changes, write to us.`,
      failed: "That did not send. Try again.",
      errors: {
        none: "Give at least two references.",
        too_few: "Give at least two references. We prefer three.",
        too_many: "Add up to ten references.",
        needs_all: "Give each reference a name, how to reach them and how they know you. Or clear the row.",
        contact: "Give an email address or a phone number we can reach that reference on.",
        twice: "You added the same reference twice.",
        too_long: "One of the answers is too long. Keep it shorter.",
      },
    },
    private: "This page shows steps only. What the people who talk with you write down stays with them.",
    wait: {
      heading: "While you wait",
      line: "The village is open to you. Here are three ways to look around:",
      quests: "Take a quest",
      map: "See the living map",
      events: "Come to an event",
    },
  },
};

const es: ApplicantMessages = {
  hello: (n) => (n ? `Hola ${n},` : "Hola,"),
  list: esList,
  aRole: "un rol",
  keepStatusLink: "El enlace a la página del estado de tu propuesta está en el primer correo que te enviamos, para que puedas seguirla cuando quieras.",
  statusLinkLine: (link) => `La página del estado de tu propuesta, para seguirla cuando quieras: ${link}`, // needs-native-review
  replyPromise: (moons) =>
    moons === null
      ? "Primero estamos completando nuestro equipo fundador, así que puede pasar un tiempo antes de que respondamos. Te escribiremos en cuanto estemos listos para conversar." // needs-native-review: new words, 14 Nov 2026
      : moons === 1 ? "Tendrás noticias nuestras dentro de un ciclo lunar." : `Tendrás noticias nuestras dentro de ${moons} ciclos lunares.`, // needs-native-review: new words, 24 Nov 2026
  noteIntro: "Una nota de parte nuestra:",
  day: dayIn("es"),

  confirm: {
    subject: (v) => `Confirma tu propuesta a ${v}`,
    proposed: (roles, v, when) => `Propusiste ocupar ${roles} en ${v} ${when ? `para ${when}` : "la próxima temporada"}.`, // check: "ocupar" for "hold a role"
    nextSeason: "la próxima temporada",
    thisMoon: (from, to) => `esta luna, del ${from} al ${to}`,
    ask: "Confirma que eres tú, y tu propuesta llega a la aldea:", // check: "aldea" for village
    validFor: (h) => `El enlace funciona durante ${h} horas. Si no fuiste tú, ignóralo y no pasará nada.`,
    aiDrafts: "Una IA puede ayudarnos a redactar nuestras respuestas; siempre las lee y las envía una persona, y ninguna IA participa en la elección.", // check
  },
  statusEmail: {
    subject: "Dónde está tu propuesta",
    text: (link, promise) => `Tu propuesta está con la aldea. Sigue dónde está, quién actúa ahora y para cuándo:\n\n${link}\n\n${promise} Guarda este enlace para ti: es la forma en que sabemos que eres tú.`,
  },

  update: {
    confirmedTitle: (v) => `Tu propuesta está con ${v}`,
    confirmed: (roles, promise) => `Tu propuesta para ocupar ${roles} ya está con nosotros. ${promise}`,
    firstReplyTitle: "Hemos recibido tu propuesta",
    firstReply: (roles) => `El rol que da la bienvenida a las personas ha recibido tu propuesta para ocupar ${roles} y te escribirá para que reserves un momento que te convenga.`, // needs-native-review: new words, 12 Nov 2026
    conversationTitle: "Nos encantaría conversar contigo",
    conversation: (roles, withRole, minutes, bookingUrl) => `El siguiente paso de tu propuesta para ocupar ${roles} es una conversación${withRole ? ` con ${withRole}` : ""}${minutes ? `, de unos ${minutes} minutos` : ""}. ${bookingUrl ? `Reserva un horario con ${withRole ?? "esa persona"}: ${bookingUrl}` : "Te escribiremos con horarios."}`, // needs-native-review: new words, 16 Nov 2026
    consentTitle: "El círculo está considerando tu propuesta", // check: "círculo" is the village's term for circle
    consent: (roles) => `Las conversaciones ya están escritas, y ahora el círculo sigue su proceso para tu propuesta de ocupar ${roles}. Revisa tu correo o la página de tu estado para los siguientes pasos.`, // needs-native-review: new words, 12 Nov 2026
    termsTitle: "Cambiaron las condiciones de tu propuesta",
    terms: (roles) => `Cambiamos las condiciones que sugerimos para tu propuesta de ocupar ${roles}. Abre la página del estado de tu propuesta para leerlas y cuéntanos qué piensas.`,
    adoptedTitle: (v) => `${v} aceptó tu propuesta`, // needs-native-review: new words, 16 Nov 2026
    adopted: (v, roles, next) => `${v} aceptó tu propuesta para ocupar ${roles}. ${next}`, // needs-native-review: new words, 16 Nov 2026
    declinedTitle: (v) => `Tu propuesta a ${v}`,
    declined: (roles) => `Gracias por proponerte para ocupar ${roles}. Esta vez no podemos decir que sí. Te animamos a explorar misiones, ver otros roles abiertos o volver a proponer la próxima temporada.`, // check: "misión" for quest; needs-native-review: new words, 12 Nov 2026
    invitedTitle: "Nos encantaría conversar contigo",
    invited: (roles) => `Leímos con cuidado tu postulación para ocupar ${roles}, y nos encantaría invitarte al siguiente paso para conocer al equipo. Los detalles están en tu correo.`, // check: "postulación" for application; needs-native-review: new words, 12 Nov 2026
    notInvitedTitle: (v) => `Gracias por postularte a ${v}`,
    notInvited: (roles) => `Gracias por postularte para ocupar ${roles}. Encontramos a alguien que encaja más de cerca con este rol. Te animamos a explorar misiones, y nos encantaría seguir en contacto.`, // needs-native-review: new words, 16 Nov 2026
    referencesTitle: "Estás en nuestra lista corta: ¿podemos escuchar a tus referencias?", // needs-native-review: new words, 19 Nov 2026
    references: (roles) => `Gracias por tu postulación para ocupar ${roles}. Estás en nuestra lista corta, y el siguiente paso son tus referencias: personas vinculadas con este trabajo, idealmente personas que también podrían ser aliadas o socias de la aldea. Abre la página de tu estado para agregarlas, con cómo contactar a cada una, cómo te conocen y por qué podrían ser aliadas.`, // needs-native-review: new words, 19 Nov 2026
  },

  // needs-native-review: the invitation and the not-invited letter
  invite: {
    subject: (v) => `Una invitación a conversar con ${v}`,
    headline: (roles) => `Gracias por postularte para ocupar ${roles}. Leímos tu postulación con cuidado, y nos encantaría invitarte a reservar horarios para las conversaciones.`, // needs-native-review: new words, 12 Nov 2026
    conversationsIntro: "Las conversaciones, en orden:",
    conversation: (role, minutes) => `${role}, ${minutes} minutos`,
    total: (minutes) => `Unos ${minutes} minutos en total.`,
    booking: "Reservas cada conversación en los horarios que elijas, en el orden de arriba.", // needs-native-review: new words, 12 Nov 2026
    bookFirst: (role, url) => `Reserva un horario con ${role} para tu primera conversación: ${url}`, // needs-native-review: new words, 16 Nov 2026
    writeFirst: (role) => `Te escribiremos con horarios para tu primera conversación, con ${role}.`, // needs-native-review: new words, 12 Nov 2026
    laterOpen: "Cada conversación siguiente se abre cuando la anterior esté escrita, y la reservas de la misma manera.", // needs-native-review: new words, 12 Nov 2026
    after: "Después de la última conversación, el círculo decide por consentimiento, y te escribimos con su respuesta.",
  },

  notInvited: {
    subject: (v) => `Gracias por postularte a ${v}`,
    thanks: (roles, v) => `Gracias por postularte para ocupar ${roles} en ${v}, y por el cuidado que pusiste en ello.`,
    matched: "Encontramos a alguien que encaja más de cerca con este rol. Gracias por tu tiempo y tu interés.", // needs-native-review: new words, 12 Nov 2026
    stayClose: "Nos encantaría seguir en contacto, y hay caminos abiertos para ser parte de la aldea:",
    program: (name, url) => `${name}: ${url}`,
    quest: (url) => `Toma una misión: ${url}`,
    events: (url) => `Ven a un evento: ${url}`,
    closing: "Esperamos conocerte pronto.",
  },

  // needs-native-review: the closed letter, new words, 15 Nov 2026
  closed: {
    subject: (v) => `Tu postulación a ${v}`,
    thanks: (roles, v) => `Gracias por postularte para ocupar ${roles} en ${v}.`,
    closed: "No pudimos responder a tu postulación a tiempo, así que la cerramos. Gracias por tu tiempo y tu interés.",
    quest: (url) => `Te animamos a explorar misiones: ${url}`,
    page: (link) => `La página de tu postulación: ${link}`,
    signed: (team) => `Con cariño,\nEl equipo de ${team}`,
  },


  adopt: {
    subject: (v) => `${v} aceptó tu propuesta`, // needs-native-review: new words, 16 Nov 2026
    headline: (v, roles, forWhen) => `${v} aceptó tu propuesta para ocupar ${roles} ${forWhen}.`, // needs-native-review: new words, 16 Nov 2026
    forThisMoon: "esta luna",
    forNextSeason: "la próxima temporada",
    inviteIntro: "Aquí está tu invitación. Usa el botón para crear tu perfil, o abre este enlace:",
    inviteWorks: (days, when) => `Funciona una sola vez y dura ${days} días. ${when}`,
    signIn: (when) => `Inicia sesión con este correo para ver tus roles. ${when}`,
    moonRuns: (from, to) => `Tus roles van del ${from} hasta la próxima luna nueva, el ${to}.`,
    seasonStarts: (season, startsOn) => `Tus roles comienzan cuando empieza ${season || "la próxima temporada"}, el ${startsOn}.`,
    firstDay: "el primer día de la temporada",
    nextSeasonName: "la próxima temporada",
    nextAfterProfile: "Después revisa tu perfil. Allí aparecen tus tareas cuando empiece tu rol, y es donde hacemos nuestras sesiones y seguimos nuestro trabajo juntos.",
    button: "Crea tu perfil",
    signFirst: () => "Antes de ocupar tu rol, alinéate con la Carta de Amor, el acuerdo de membresía de la aldea. Alinearte con ella te hace miembro, con voz en las decisiones de la aldea:", // check: "Love Letter" name, "alinearte", "membresía"; needs-native-review: new words, 16 Nov 2026
    headlineReviewed: (v, roles) => `El círculo dio su consentimiento: nos encantaría que ocupes ${roles} en ${v}. Bienvenida, bienvenido.`, // check: the welcome, said to anyone
    firstCycle: "Empezamos con un primer ciclo juntos, y al terminar, cualquiera de las dos partes puede decidir cerrarlo ahí.",
  },

  declined: {
    subject: (v) => `Tu propuesta a ${v}`,
    thanks: (roles, v) => `Gracias por proponerte para ocupar ${roles} en ${v}. Esta vez no podemos decir que sí.`,
    stayClose: "Nos alegra que nos hayas encontrado. Si quieres seguir cerca, aquí hay tres maneras de entrar:",
    quest: (url) => `Toma una misión: ${url}`,
    roles: (url) => `Mira otros roles abiertos: ${url}`,
    again: "O vuelve a proponer la próxima temporada. Nos dará gusto leerte.",
    againOwn: "Puedes volver a proponer la próxima temporada. Nos dará gusto leerte.", // needs-native-review: new words, 16 Nov 2026
  },

  page: {
    declinedHeading: "Gracias por proponerte",
    declinedLine: "Esta vez no podemos decir que sí, y nos alegra que nos hayas encontrado. Si quieres seguir cerca:",
    quests: "Toma una misión",
    roles: "Mira otros roles abiertos",
    again: "O vuelve a proponer la próxima temporada.",
    noteHeading: "Una nota para ti",
  },

  // needs-native-review: the whole status block below
  status: {
    heading: "Dónde está tu propuesta",
    headingApplication: "Dónde está tu postulación",
    missing: "Ese enlace no corresponde a ninguna propuesta. Revisa el enlace de tu correo.",
    nextLabel: "Lo que sigue",
    by: (day) => `Para el ${day}`,
    step: {
      confirmed: "Recibida",
      first_reply: "Primera respuesta",
      review: "Nuestra revisión",
      invited: "Invitación",
      not_invited: "Nuestra respuesta",
      interview: "Conversación",
      scores_in: "Conversaciones terminadas",
      consent: "El consentimiento del círculo",
      decided: "Decisión",
      first_cycle: "Primer ciclo",
      cleared: "Resuelta",
    },
    received: "Recibida",
    firstReply: "Primera respuesta",
    review: "Nuestra revisión",
    invitation: "Invitación",
    firstCycle: "Primer ciclo",
    conversationWith: (role, minutes) => `Conversación con ${role} (${minutes} minutos)`,
    consent: "El consentimiento del círculo",
    decision: "Decisión",
    stateDone: "hecho",
    stateNow: "ahora",
    stateLater: "después",
    move: {
      firstReply: "Nos toca a nosotros: el rol que da la bienvenida a las personas te escribe para que reserves un momento para conversar.", // needs-native-review: new words, 12 Nov 2026
      interview: (role, minutes) => `Nos toca a nosotros: ${role} conversa contigo unos ${minutes} minutos y luego deja una nota.`,
      interviewWaiting: "Nos toca a nosotros: la siguiente conversación se abre cuando la anterior esté escrita. Tú la reservas en el horario que elijas.", // needs-native-review: new words, 12 Nov 2026
      consent: "Nos toca a nosotros: el círculo valora tu propuesta y da su consentimiento, o dice qué falta.",
      adopted: "Te toca a ti: crear tu cuenta. El enlace para hacerlo está en tu correo.",
      withdrawn: "No hace falta nada más. Retiraste esta propuesta.",
      declined: "No hace falta nada más de tu parte. Ya respondimos.",
      review: "Nos toca a nosotros: leemos tu postulación con cuidado, y luego te invitamos a las conversaciones o te escribimos para darte las gracias.",
      decision: "Nos toca a nosotros: el círculo lo considera todo y decide por consentimiento. Te escribimos con su respuesta.",
      notInvited: "No hace falta nada más de tu parte. Ya te escribimos.",
      closed: "No hace falta nada más de tu parte. Esta postulación está cerrada.", // needs-native-review: new words, 15 Nov 2026
    },
    // needs-native-review: the closed card and the new-invitation door, new words, 15 Nov 2026
    closed: {
      step: "Cerrada",
      heading: "Esta postulación está cerrada",
      line: "No pudimos responderla a tiempo. Gracias por tu tiempo y tu interés. Te invitamos a explorar:",
      quests: "Explorar misiones",
      roles: "Ver los roles abiertos",
    },
    newInvitation: {
      heading: "¿Necesitas una nueva invitación?",
      line: "Tu invitación para unirte al equipo venció. Pide una nueva, y el equipo que envía las invitaciones te escribirá.",
      ask: "Envíame una nueva invitación",
      asked: "Gracias. Ya avisamos al equipo, y te escribirán.",
      failed: "No se pudo enviar. Inténtalo de nuevo.",
    },
    notInvited: {
      heading: "Gracias por postularte",
      line: "Encontramos a alguien que encaja más de cerca con este rol. Gracias por tu tiempo y tu interés. Nos encantaría que sigas cerca:", // needs-native-review: new words, 16 Nov 2026
      program: (name) => name,
      quests: "Toma una misión",
      events: "Ven a un evento",
    },
    booking: {
      label: "Cómo se agendan las conversaciones",
      // needs-native-review: new words, 12 Nov 2026
      order: (roles) =>
        roles.length <= 1
          ? `Después de la invitación, reservas la conversación${roles[0] ? ` con ${roles[0]}` : ""} en el horario que elijas.`
          : `Después de la invitación, reservas cada conversación en los horarios que elijas, en este orden: primero ${roles[0]}, luego ${roles.slice(1).join(", luego ")}. Cada una se abre cuando la anterior esté escrita.`,
      bookNow: (role) => `Reserva un horario con ${role}`, // needs-native-review: new words, 16 Nov 2026
      writeNow: (role) => `Te escribiremos con horarios para tu conversación con ${role}.`,
    },
    references: {
      none: "No diste referencias, así que haremos una verificación de antecedentes. Aceptaste cuando enviaste tu propuesta. Nosotros cubrimos su costo y no contactamos a nadie antes de nuestra primera conversación contigo.",
      some: (n) => `Diste ${n} ${n === 1 ? "referencia" : "referencias"}. Contactamos a las referencias solo después de nuestra primera conversación, y solo con tu visto bueno.`,
    },
    // needs-native-review: the reference form, new words, 19 Nov 2026
    referenceForm: {
      step: "Referencias",
      heading: "Tus referencias",
      line: "Estás en nuestra lista corta. Agrega a las personas vinculadas con este trabajo que te conocen, idealmente personas que también podrían ser aliadas o socias de la aldea.",
      lineFirstRole: "Este es tu primer rol de largo plazo con nosotros, así que pedimos referencias. Agrega a las personas vinculadas con este trabajo que te conocen, idealmente personas que también podrían ser aliadas o socias de la aldea.",
      privacy: "Solo las personas que revisan tu postulación, y quien da seguimiento a cada referencia, leen estos datos. Ninguna IA los lee. Se borran con tu postulación.",
      name: "Su nombre",
      contact: "Cómo contactarla",
      contactHint: "Un correo electrónico o un número de teléfono.",
      how: "Cómo te conoce",
      ally: "Por qué podría ser aliada o socia (opcional)",
      allyHint: "Lo que podría aportar a la aldea, o cómo podría trabajar con nosotros.",
      howMany: "Da al menos dos referencias. Preferimos tres.",
      add: "Agregar otra referencia",
      remove: (n) => `Quitar la referencia ${n}`,
      row: (n) => `Referencia ${n}`,
      send: "Enviar mis referencias",
      sent: "Gracias. Ya tenemos tus referencias.",
      given: (n) => `Diste ${n} ${n === 1 ? "referencia" : "referencias"}. Gracias. Si algo cambia, escríbenos.`,
      failed: "No se envió. Inténtalo de nuevo.",
      errors: {
        none: "Da al menos dos referencias.",
        too_few: "Da al menos dos referencias. Preferimos tres.",
        too_many: "Agrega hasta diez referencias.",
        needs_all: "Da a cada referencia un nombre, cómo contactarla y cómo te conoce. O vacía la fila.",
        contact: "Da un correo electrónico o un número de teléfono donde podamos contactar a esa referencia.",
        twice: "Agregaste la misma referencia dos veces.",
        too_long: "Una de las respuestas es demasiado larga. Hazla más corta.",
      },
    },
    private: "Esta página muestra solo los pasos. Lo que anotan las personas que conversan contigo se queda con ellas.",
    wait: {
      heading: "Mientras esperas",
      line: "La aldea está abierta para ti. Aquí hay tres formas de conocerla:",
      quests: "Toma una misión",
      map: "Mira el mapa vivo",
      events: "Ven a un evento",
    },
  },
};

// ── The applicant's steps: ONE list (Phase A, coordinator 11 Nov 2026) ──────

/**
 * THE APPLICANT'S STEPS, in order, the single source the form (lane A1), the
 * confirmation, the status page's Seed of Life and the letters read. Each has
 * its name and one line of what happens and roughly when, in every applicant
 * language. Timing words that depend on the village (the reply days) take the
 * number as an argument, so nothing here is one village's promise.
 */
export const APPLICANT_STEP_KEYS = ["received", "review", "invitation", "conversations", "decision", "first_cycle"] as const;
export type ApplicantStepKey = (typeof APPLICANT_STEP_KEYS)[number];

export interface ApplicantStepWords {
  name: string;
  /** What happens at this step and roughly when. `moons` is the village's reply window (`effectiveReplyMoons`, shared/contributorRoutes.ts). */
  when(moons: number | null): string;
}

export const APPLICANT_STEPS: Record<ApplicantLanguage, Record<ApplicantStepKey, ApplicantStepWords>> = {
  en: {
    received: { name: "Received", when: () => "Your application reaches us the moment you confirm your address." },
    review: { name: "Our review", when: (moons) => moons === null ? "Once our founding team is in place, we invite you to book conversation times or write to thank you." : `Within ${moons === 1 ? "one moon cycle" : `${moons} moon cycles`}, we invite you to book conversation times or write to thank you.` },
    invitation: { name: "Invitation", when: () => "An invitation by email lists the conversations in order, with how long each one is." },
    conversations: { name: "Conversations", when: () => "One after another with the roles you would work beside, usually within two weeks of the invitation." },
    decision: { name: "Decision", when: () => "The circle decides by consent, usually within a week of the last conversation." },
    first_cycle: { name: "First cycle", when: () => "We begin with a first cycle together, and at its end either side may choose to end it there." },
  },
  // needs-native-review
  es: {
    received: { name: "Recibida", when: () => "Tu postulación nos llega en cuanto confirmas tu correo." },
    review: { name: "Nuestra revisión", when: (moons) => moons === null ? "Cuando nuestro equipo fundador esté completo, te invitamos a reservar horarios para las conversaciones o te escribimos para darte las gracias." : `Dentro de ${moons === 1 ? "un ciclo lunar" : `${moons} ciclos lunares`}, te invitamos a reservar horarios para las conversaciones o te escribimos para darte las gracias.` }, // needs-native-review: new words, 24 Nov 2026
    invitation: { name: "Invitación", when: () => "Una invitación por correo enumera las conversaciones en orden, con la duración de cada una." },
    conversations: { name: "Conversaciones", when: () => "Una tras otra con los roles con los que trabajarías, por lo general dentro de las dos semanas siguientes a la invitación." },
    decision: { name: "Decisión", when: () => "El círculo decide por consentimiento, por lo general dentro de la semana siguiente a la última conversación." },
    first_cycle: { name: "Primer ciclo", when: () => "Empezamos con un primer ciclo juntos, y al terminar, cualquiera de las dos partes puede decidir cerrarlo ahí." },
  },
};

/** The steps in order, in one language, with the timing line filled in. */
export function applicantSteps(lang: ApplicantLanguage | null | undefined, replyMoons: number | null): Array<{ key: ApplicantStepKey; name: string; when: string }> {
  const table = APPLICANT_STEPS[lang && isApplicantLanguage(lang) ? lang : DEFAULT_APPLICANT_LANGUAGE];
  return APPLICANT_STEP_KEYS.map((key) => ({ key, name: table[key].name, when: table[key].when(replyMoons) }));
}

/** The tables. `Record<ApplicantLanguage, ...>` makes a language without a table, or a table with a missing line, a compile error. */
export const LANGUAGES: Record<ApplicantLanguage, ApplicantMessages> = { en, es };

export const wordsIn = (lang: ApplicantLanguage | null | undefined): ApplicantMessages => LANGUAGES[lang && isApplicantLanguage(lang) ? lang : DEFAULT_APPLICANT_LANGUAGE];

/** How every language's "your status page link" line begins, so a notice can drop it whichever language wrote it. */
export const STATUS_LINK_STARTS: readonly string[] = APPLICANT_LANGUAGES.flatMap((l) => [LANGUAGES[l].keepStatusLink.slice(0, 21), LANGUAGES[l].statusLinkLine("").slice(0, 21)]);

/** A decider's note for an applicant: plain text, trimmed, one blank line at most, capped. Null when empty. */
export const APPLICANT_NOTE_MAX = 600;
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const lines = raw.replace(/\r/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").split("\n").map((l) => l.trim());
  const out: string[] = [];
  for (const l of lines) {
    if (l === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(l);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  const s = out.join("\n").slice(0, APPLICANT_NOTE_MAX).trim();
  return s ? s : null;
}

// ── The status page, read in the applicant's language ───────────────────────

/** What `/api/application-status` serves that the view reads (shared/applicationReview.ts `statusFor`, plus the route's own fields). */
export interface StatusServedForView {
  step: string;
  actsNext: string;
  path: Array<{ label: string; state: "done" | "now" | "later" }>;
  booking: string | null;
  mode: "block" | "split";
  /**
   * The conversation open now and how to book it, null when none is open (server/lib/applicationReview.ts statusOf).
   * `label` is the role with the people holding it, "Role (First, First)" (shared/roleHolderLabel.ts).
   * `links` is every way in: one link, or one per person holding the role, by first name. `url` is the first, for an older reader.
   */
  bookNow?: { role: string; label?: string; url: string | null; links?: ReadonlyArray<{ who: string | null; url: string }> } | null;
  outcome?: "adopted" | "declined" | "withdrawn" | null;
  referencesGiven?: number | null;
  /** Our review comes before the conversations on this application. */
  reviewFirst?: boolean;
  /** Our review ended it with the not-invited letter. */
  notInvited?: boolean;
  /** Closed by the tidy job because nobody answered it in time (server/lib/applicantFollowups.ts). */
  closed?: boolean;
}

export interface StatusView {
  heading: string;
  /** The not-invited answer is shown, in place of the older declined one. */
  notInvited: boolean;
  /** Closed because nobody answered it in time: the closed card is shown, never "you withdrew". */
  closed: boolean;
  stepWords: string;
  move: string;
  path: Array<{ label: string; state: "done" | "now" | "later" }>;
  /**
   * `book.label` is "Book a time with Role (First, First)". One way in: one door with that label.
   * Several: the label stands above one door per person, named by first name.
   */
  booking: { text: string; book: { label: string; links: Array<{ label: string; url: string }> } | { text: string } | null } | null;
  references: string | null;
}

/** The status page's booking doors: "Book a time with Role (First, First)", and each person's link under it when there are several. */
function bookDoors(w: ApplicantMessages["status"], b: NonNullable<StatusServedForView["bookNow"]>): { label: string; links: Array<{ label: string; url: string }> } | { text: string } {
  const who = b.label || b.role;
  const links = b.links?.length ? b.links : b.url ? [{ who: null, url: b.url }] : [];
  if (!links.length) return { text: w.booking.writeNow(who) };
  const label = w.booking.bookNow(who);
  return { label, links: links.map((l) => ({ label: links.length > 1 && l.who ? l.who : label, url: l.url })) };
}

const CONVERSATION_LABEL = /^Conversation with (.+) \((\d+) minutes\)$/;
const INTERVIEW_MOVE = /^(.+) talks with you for (\d+) minutes, then adds a note\.$/;

/**
 * The status page's words, from the steps the server sends. The server writes
 * the path and the "next" line in English (shared/applicationReview.ts), so this
 * reads them by shape and says them again in the applicant's language, and it
 * shapes three things the raw path got wrong:
 *   - only ONE step reads "now": the first, so the page never points two ways;
 *   - after a decline or a withdrawal the steps that never happened leave the
 *     path, and "The circle's consent" with them, because nobody consented;
 *   - the references line never follows a decision, so "you gave no references"
 *     does not sit under a thank-you.
 * The background check is stated only as far as the server tells us: how many
 * references were given. Whether a role always needs a check is not on this page.
 */
export function statusView(lang: ApplicantLanguage | null | undefined, s: StatusServedForView): StatusView {
  const w = wordsIn(lang).status;
  const decided = s.outcome === "declined" || s.outcome === "withdrawn" || s.outcome === "adopted";
  const closed = s.outcome === "declined" || s.outcome === "withdrawn";

  const say = (label: string): string => {
    if (label === STEP_WORDS.confirmed) return w.received;
    if (label === STEP_WORDS.first_reply) return w.firstReply;
    if (label === STEP_WORDS.consent) return w.consent;
    if (label === STEP_WORDS.decided) return w.decision;
    if (label === STEP_WORDS.review) return w.review;
    if (label === STEP_WORDS.invited) return w.invitation;
    if (label === STEP_WORDS.first_cycle) return w.firstCycle;
    if (label === STEP_WORDS.refs_asked) return w.referenceForm.step;
    const m = CONVERSATION_LABEL.exec(label);
    if (m) return w.conversationWith(m[1], Number(m[2]));
    return label;
  };

  let seenNow = false;
  const path: StatusView["path"] = [];
  for (const p of s.path) {
    if (closed && (p.label === STEP_WORDS.consent || p.state !== "done")) continue;
    // An adopted application's first cycle is where they stand now, so it keeps its place.
    if (decided && p.state === "now" && !(s.outcome === "adopted" && p.label === STEP_WORDS.first_cycle)) continue;
    let state = p.state;
    if (state === "now") {
      if (seenNow) state = "later";
      seenNow = true;
    }
    path.push({ label: say(p.label), state });
  }

  const notInvited = !!s.notInvited && s.outcome === "declined";
  const quietlyClosed = !!s.closed && s.outcome === "withdrawn";
  let move: string;
  if (s.outcome === "adopted") move = w.move.adopted;
  else if (quietlyClosed) move = w.move.closed;
  else if (s.outcome === "withdrawn") move = w.move.withdrawn;
  else if (notInvited) move = w.move.notInvited;
  else if (s.outcome === "declined") move = w.move.declined;
  else if (s.step === "first_reply") move = w.move.firstReply;
  else if (s.step === "review") move = w.move.review;
  else if (s.step === "consent") move = s.reviewFirst ? w.move.decision : w.move.consent;
  else {
    const m = INTERVIEW_MOVE.exec(s.actsNext);
    move = m ? w.move.interview(m[1], Number(m[2])) : w.move.interviewWaiting;
  }

  const talks = s.path.map((p) => CONVERSATION_LABEL.exec(p.label)).filter((m): m is RegExpExecArray => !!m);
  const booking =
    s.booking && !decided && talks.length > 0
      ? {
          text: w.booking.order(talks.map((m) => m[1])),
          // Only the conversation open now offers its way to book: the later ones open in order.
          book: s.bookNow ? bookDoors(w, s.bookNow) : null,
        }
      : null;

  const references = closed || typeof s.referencesGiven !== "number" ? null : s.referencesGiven === 0 ? w.references.none : w.references.some(s.referencesGiven);

  const stepKey = s.reviewFirst && s.step === "consent" ? "decided" : notInvited ? "not_invited" : s.step;
  return {
    heading: s.reviewFirst ? w.headingApplication : w.heading,
    notInvited,
    closed: quietlyClosed,
    stepWords: quietlyClosed ? w.closed.step : ((w.step as Record<string, string>)[stepKey] ?? s.step),
    move,
    path,
    booking,
    references,
  };
}
