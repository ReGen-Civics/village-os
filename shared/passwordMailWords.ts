/**
 * THE WORDS OF THE PASSWORD LETTERS AND THE ADDRESS CODE, BY LANGUAGE (the coordinator, 26 Nov 2026: the
 * platform's own mail in the reader's language; shared/mailLanguage.ts says which).
 *
 * One builder for every letter that carries a set-password link (`passwordLetter` in server/routes/authRecovery.ts):
 * the member's own reset, a first password, the founder's claim at bootstrap, a founder account just made, and the
 * link an administrator sends. And the code that adds a second address (server/lib/memberEmails.ts).
 *
 * English is the source and is exactly what these letters said before. A language is one entry typed as
 * `PasswordMailWords`, so a line left out fails the typecheck. Values reaching HTML arrive escaped: the village's
 * name, a link, an anchor the letter built. Spanish uses usted. NEEDS A NATIVE EAR.
 */
import type { MailLanguage } from "./mailLanguage";

export interface PasswordMailWords {
  /** The link's own words, per letter. */
  setNew: string;
  setYours: string;
  /** "(link expires in 60 minutes, and works once)". */
  expiresOnce: string;
  /** "(link expires in 60 minutes)": the founder's letters say no more. */
  expires: string;
  /** `url` arrives escaped. */
  paste(url: string): string;
  notYou: string;
  reset: { subject: string; asked(village: string): string };
  first: { subject: string; none(village: string): string };
  founderClaim: { subject: string };
  founderMade: { subject: string; made(village: string): string };
  adminLink: { subject: string; sent(village: string): string };
  addressCode: {
    subject(code: string): string;
    asked(village: string): string;
    /** The text letter's line before the code. */
    yourCode(code: string): string;
    ifYou(minutes: number): string;
    notYouHtml: string;
    notYouText: string;
  };
}

const en: PasswordMailWords = {
  setNew: "Set a new password",
  setYours: "Set your password",
  expiresOnce: "(link expires in 60 minutes, and works once)",
  expires: "(link expires in 60 minutes)",
  paste: (url) => `If the button does nothing, paste this into your browser:<br>${url}`,
  notYou: "If this wasn't you, nothing has changed. You can ignore this message.",
  reset: { subject: "Set a new password", asked: (village) => `Someone asked to set a new password for your account on ${village}.` },
  first: {
    subject: "Set your password",
    none: (village) => `Your account on ${village} does not have a password yet, so there is nothing to reset. This link sets your first one.`,
  },
  founderClaim: { subject: "Set your password" },
  founderMade: { subject: "You are the founder admin. Set your password", made: (village) => `Your founder admin account was just created on ${village}.` },
  adminLink: { subject: "Set a new password", sent: (village) => `An administrator of ${village} sent you a link to set a new password.` },
  addressCode: {
    subject: (code) => `Your code to add this address: ${code}`,
    asked: (village) => `Somebody signed in to ${village} asked to add this email address to their account.`,
    yourCode: (code) => `Your code: ${code}`,
    ifYou: (minutes) => `If it was you, enter this code on your profile. It works for ${minutes} minutes.`,
    notYouHtml: "If it was not you, do nothing. The address is attached only when this code is entered, and nobody else can see it.",
    notYouText: "If it was not you, do nothing. The address is attached only when this code is entered.",
  },
};

// needs-native-review: the password letters and the address code, 26 Nov 2026
const es: PasswordMailWords = {
  setNew: "Definir una contraseña nueva",
  setYours: "Definir su contraseña",
  expiresOnce: "(el enlace vence en 60 minutos y funciona una sola vez)",
  expires: "(el enlace vence en 60 minutos)",
  paste: (url) => `Si el botón no hace nada, pegue esto en su navegador:<br>${url}`,
  notYou: "Si no fue usted, nada ha cambiado. Puede ignorar este mensaje.",
  reset: { subject: "Defina una contraseña nueva", asked: (village) => `Alguien pidió definir una contraseña nueva para su cuenta en ${village}.` },
  first: {
    subject: "Defina su contraseña",
    none: (village) => `Su cuenta en ${village} aún no tiene contraseña, así que no hay nada que restablecer. Este enlace define la primera.`,
  },
  founderClaim: { subject: "Defina su contraseña" },
  founderMade: { subject: "Usted es la persona administradora fundadora. Defina su contraseña", made: (village) => `Se acaba de crear su cuenta de administración fundadora en ${village}.` },
  adminLink: { subject: "Defina una contraseña nueva", sent: (village) => `Una persona administradora de ${village} le envió un enlace para definir una contraseña nueva.` },
  addressCode: {
    subject: (code) => `Su código para agregar esta dirección: ${code}`,
    asked: (village) => `Alguien que inició sesión en ${village} pidió agregar esta dirección de correo a su cuenta.`,
    yourCode: (code) => `Su código: ${code}`,
    ifYou: (minutes) => `Si fue usted, escriba este código en su perfil. Funciona durante ${minutes} minutos.`,
    notYouHtml: "Si no fue usted, no haga nada. La dirección se agrega solo cuando se escribe este código, y nadie más puede verla.",
    notYouText: "Si no fue usted, no haga nada. La dirección se agrega solo cuando se escribe este código.",
  },
};

/** The tables. `Record<MailLanguage, ...>` makes a language without a table a compile error. */
export const PASSWORD_MAIL_WORDS: Record<MailLanguage, PasswordMailWords> = { en, es };

export const passwordMailWords = (lang: MailLanguage | null | undefined): PasswordMailWords => PASSWORD_MAIL_WORDS[lang ?? "en"] ?? en;
