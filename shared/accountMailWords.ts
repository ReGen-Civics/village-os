/**
 * THE WORDS OF THE ACCOUNT LETTERS, BY LANGUAGE: the entrance's sign-in code (server/lib/entranceCode.ts), the
 * address proof and the Google sign-in notice (server/lib/emailVerification.ts). The coordinator, 26 Nov 2026:
 * the platform's own mail in the reader's language (shared/mailLanguage.ts says which).
 *
 * English is the source and is exactly what these letters said before. A language is one entry typed as
 * `AccountMailWords`, so a line added to English and left out of another language fails the typecheck, and
 * accountMailWords.test.ts checks the same at run time. Every value that reaches HTML arrives already escaped:
 * the village's name, a link, an anchor the letter built. The words themselves hold no markup.
 *
 * Spanish uses usted, and "aldea" for village. NEEDS A NATIVE EAR: written carefully, not yet read by a native
 * speaker.
 */
import type { MailLanguage } from "./mailLanguage";

export interface AccountMailWords {
  code: {
    /** `spaced` is the code as "123 456"; `village` is the village's name, plain text. */
    subject(spaced: string, village: string): string;
    /** `village` arrives escaped. */
    signIn(village: string): string;
    explore(village: string): string;
    typeIt: string;
    ignore: string;
  };
  verify: {
    subject: string;
    /** `village` arrives escaped. */
    made(village: string): string;
    /** `link` is the whole anchor, built and escaped by the letter; `linkWords` is what it says. */
    ifYouMadeIt(link: string): string;
    linkWords: string;
    /** `url` arrives escaped. */
    paste(url: string): string;
    notYou: string;
  };
  googleEnded: {
    subject: string;
    /** `village` arrives escaped. */
    signedIn(village: string): string;
    removed: string;
    /** `link` is the whole anchor, escaped. */
    newOne(link: string): string;
  };
}

const en: AccountMailWords = {
  code: {
    subject: (spaced, village) => `${spaced} is your code for ${village}`,
    signIn: (village) => `Here is your code to sign in to ${village}.`,
    explore: (village) => `Here is your code to keep exploring ${village}.`,
    typeIt: "Type it on the page that asked for it. It works for 15 minutes, once.",
    ignore: "If you did not ask for this, you can ignore this message. Nothing happens without the code.",
  },
  verify: {
    subject: "Confirm your email address",
    made: (village) => `An account on ${village} was made with this address.`,
    ifYouMadeIt: (link) =>
      `If you made it, ${link} (the link works for a day). You will be asked to sign in, or for the account's password, so a link opened by somebody else confirms nothing.`,
    linkWords: "confirm this address",
    paste: (url) => `If the button does nothing, paste this into your browser:<br>${url}`,
    notYou: "If you did not make this account, do not use the link. Nothing has changed, and you can ignore this message.",
  },
  googleEnded: {
    subject: "You signed in with Google",
    signedIn: (village) => `You signed in to ${village} with Google.`,
    removed:
      "This account also had a password, and nobody had ever confirmed this email address for it. So that password has been removed and every other device signed out, because whoever set it might not have been you.",
    newOne: (link) => `If you set that password yourself, you can choose a new one here: ${link}`,
  },
};

// needs-native-review: the account letters, 26 Nov 2026
const es: AccountMailWords = {
  code: {
    subject: (spaced, village) => `${spaced} es su código para ${village}`,
    signIn: (village) => `Este es su código para iniciar sesión en ${village}.`,
    explore: (village) => `Este es su código para seguir explorando ${village}.`,
    typeIt: "Escríbalo en la página que se lo pidió. Funciona durante 15 minutos, una sola vez.",
    ignore: "Si usted no lo pidió, puede ignorar este mensaje. Nada sucede sin el código.",
  },
  verify: {
    subject: "Confirme su dirección de correo",
    made: (village) => `Se creó una cuenta en ${village} con esta dirección.`,
    ifYouMadeIt: (link) =>
      `Si usted la creó, ${link} (el enlace funciona durante un día). Se le pedirá iniciar sesión, o la contraseña de la cuenta, así que un enlace abierto por otra persona no confirma nada.`,
    linkWords: "confirme esta dirección",
    paste: (url) => `Si el botón no hace nada, pegue esto en su navegador:<br>${url}`,
    notYou: "Si usted no creó esta cuenta, no use el enlace. Nada ha cambiado, y puede ignorar este mensaje.",
  },
  googleEnded: {
    subject: "Usted inició sesión con Google",
    signedIn: (village) => `Usted inició sesión en ${village} con Google.`,
    removed:
      "Esta cuenta también tenía una contraseña, y nadie había confirmado nunca esta dirección de correo para ella. Por eso se eliminó esa contraseña y se cerró la sesión en todos los demás dispositivos, porque quien la definió podría no haber sido usted.",
    newOne: (link) => `Si usted definió esa contraseña, puede elegir una nueva aquí: ${link}`,
  },
};

/** The tables. `Record<MailLanguage, ...>` makes a language without a table a compile error. */
export const ACCOUNT_MAIL_WORDS: Record<MailLanguage, AccountMailWords> = { en, es };

export const accountMailWords = (lang: MailLanguage | null | undefined): AccountMailWords => ACCOUNT_MAIL_WORDS[lang ?? "en"] ?? en;
