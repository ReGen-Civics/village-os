/**
 * THE FRAME OF A NOTICE EMAIL, BY LANGUAGE: the words around a notice in the immediate email and the daily digest
 * (server/lib/notify.ts). The notice itself is said from its key (shared/noticeKeyMessages.ts); these are the lines
 * the platform writes around it. The coordinator, 26 Nov 2026: mail PR 3.
 *
 * English is the source and is exactly what these emails said before. A language is one entry typed as
 * `NoticeMailWords`, so a line left out fails the typecheck. Spanish uses usted. NEEDS A NATIVE EAR.
 */
import type { MailLanguage } from "./mailLanguage";

export interface NoticeMailWords {
  seeIt: string;
  choose: string;
  readInBell: string;
  digest: {
    heading: string;
    subjectMany(n: number): string;
    more(n: number): string;
    seeEverything: string;
  };
}

const en: NoticeMailWords = {
  seeIt: "See it on your profile",
  choose: "Choose which emails you get on your profile page.",
  readInBell: "Sign in and open the bell at the top of any page to read it.",
  digest: {
    heading: "While you were away",
    subjectMany: (n) => `${n} things happened while you were away`,
    more: (n) => `…and ${n} more.`,
    seeEverything: "See everything",
  },
};

// needs-native-review: the notice email's frame, 26 Nov 2026
const es: NoticeMailWords = {
  seeIt: "Verlo en su perfil",
  choose: "Elija qué correos recibe en la página de su perfil.",
  readInBell: "Inicie sesión y abra la campana en la parte superior de cualquier página para leerlo.",
  digest: {
    heading: "Mientras usted no estaba",
    subjectMany: (n) => `Pasaron ${n} cosas mientras usted no estaba`,
    more: (n) => `…y ${n} más.`,
    seeEverything: "Ver todo",
  },
};

/** The tables. `Record<MailLanguage, ...>` makes a language without a table a compile error. */
export const NOTICE_MAIL_WORDS: Record<MailLanguage, NoticeMailWords> = { en, es };

export const noticeMailWords = (lang: MailLanguage | null | undefined): NoticeMailWords => NOTICE_MAIL_WORDS[lang ?? "en"] ?? en;
