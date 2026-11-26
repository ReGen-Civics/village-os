/**
 * THE WORDS OF THE WELCOME AND THE RESERVATION LETTERS, BY LANGUAGE (the coordinator, 26 Nov 2026: the platform's
 * own mail in the reader's language; shared/mailLanguage.ts says which).
 *
 * The welcome goes to a visitor who has just been made a member (server/routes/visitorProfile.ts). The reservation
 * letter goes to the person who asked for a home (server/routes/housing.ts). The team's own alert about that request
 * stays in English: its reader is the team.
 *
 * English is the source and is exactly what these letters said before. A language is one entry typed as
 * `WelcomeMailWords`, so a line left out fails the typecheck. Values reaching HTML arrive escaped. Spanish uses
 * usted. NEEDS A NATIVE EAR.
 */
import type { MailLanguage } from "./mailLanguage";

/** The platform's home types (server/lib/housing.ts HOME_TYPES), named. English names a type by its key, as before. */
export type HomeTypeKey = "tiny-home" | "casita" | "family-home" | "villa";

export interface WelcomeMailWords {
  welcome: {
    subject(village: string): string;
    hi(first: string): string;
    /** The name to greet when there is none; empty where the greeting needs none. */
    friend: string;
    /** `village` arrives escaped in the HTML and plain in the text. */
    member(village: string): string;
    /** `setLink` and `profileLink` are whole anchors, escaped. */
    nextHtml(setLink: string, profileLink: string): string;
    setWords: string;
    profileWords: string;
    /** The text letter's two lines, with the bare links. */
    nextText(setUrl: string, profileUrl: string): string;
    ranOut: string;
  };
  reservation: {
    subject: string;
    heading: string;
    hi(name: string): string;
    /** `homeType` and `hamlet` arrive escaped. */
    asked(homeType: string, hamlet: string | null): string;
    noPayment: string;
    team: string;
    homeType(key: HomeTypeKey): string;
  };
}

const en: WelcomeMailWords = {
  welcome: {
    subject: (village) => `Welcome to ${village}: you are a member now`,
    hi: (first) => `Hi ${first},`,
    friend: "friend",
    member: (village) => `You asked for an invitation, and you are now a member of ${village}. Your member account is ready.`,
    nextHtml: (setLink, profileLink) => `${setLink}, then go to ${profileLink} and fill it out, so the village can get to know you.`,
    setWords: "Set your password",
    profileWords: "your profile",
    nextText: (setUrl, profileUrl) => `Set your password: ${setUrl}\nThen fill out your profile: ${profileUrl}`,
    ranOut: "If the link has run out, ask for a new one on the sign-in page with this address.",
  },
  reservation: {
    subject: "We have your reservation request",
    heading: "Your reservation request is in",
    hi: (name) => `Hi ${name},`,
    asked: (homeType, hamlet) =>
      `We have your request for a ${homeType}${hamlet ? ` in ${hamlet}` : ""}. Someone from the founding team will read it and get in touch about the deposit and what happens next.`,
    noPayment: "No payment has been taken, and nothing is held against your name yet.",
    team: "The team",
    homeType: (key) => key,
  },
};

// needs-native-review: the welcome and the reservation letters, 26 Nov 2026
const ES_HOME: Record<HomeTypeKey, string> = { "tiny-home": "minicasa", casita: "casita", "family-home": "casa familiar", villa: "villa" };
const es: WelcomeMailWords = {
  welcome: {
    subject: (village) => `Le damos la bienvenida a ${village}: ahora usted es miembro`,
    hi: (first) => (first ? `Hola ${first}:` : "Hola:"),
    friend: "",
    member: (village) => `Usted pidió una invitación, y ahora es miembro de ${village}. Su cuenta de miembro está lista.`,
    nextHtml: (setLink, profileLink) => `${setLink}, y luego vaya a ${profileLink} y complételo, para que la aldea pueda conocerle.`,
    setWords: "Defina su contraseña",
    profileWords: "su perfil",
    nextText: (setUrl, profileUrl) => `Defina su contraseña: ${setUrl}\nLuego complete su perfil: ${profileUrl}`,
    ranOut: "Si el enlace venció, pida uno nuevo en la página de inicio de sesión con esta dirección.",
  },
  reservation: {
    subject: "Tenemos su solicitud de reserva",
    heading: "Su solicitud de reserva llegó",
    hi: (name) => `Hola ${name}:`,
    asked: (homeType, hamlet) =>
      `Tenemos su solicitud de ${homeType}${hamlet ? ` en ${hamlet}` : ""}. Alguien del equipo fundador la leerá y se pondrá en contacto sobre el depósito y lo que sigue.`,
    noPayment: "No se ha cobrado nada, y todavía no hay nada apartado a su nombre.",
    team: "El equipo",
    homeType: (key) => ES_HOME[key] ?? key,
  },
};

/** The tables. `Record<MailLanguage, ...>` makes a language without a table a compile error. */
export const WELCOME_MAIL_WORDS: Record<MailLanguage, WelcomeMailWords> = { en, es };

export const welcomeMailWords = (lang: MailLanguage | null | undefined): WelcomeMailWords => WELCOME_MAIL_WORDS[lang ?? "en"] ?? en;
