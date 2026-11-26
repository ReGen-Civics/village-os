/**
 * THE SAME APPLICATION SENT AGAIN (hostile-edges QA, 15 Nov 2026).
 *
 * On a local 1.3.9 boot one address sent the same application for the same
 * role three times (a double tap, then a resend) and the desk held three
 * copies, each confirmed and each asking the circle again. So while an
 * application from an address is waiting for the village, another one for the
 * same role is not kept.
 *
 * WHAT THE SENDER IS TOLD is what any send is told, because the form is public
 * and a different answer would let anybody learn whether an address has
 * applied for a role. The person behind the address learns it from their own
 * inbox: this short email, to that address alone, says the application is
 * already in and nothing more needs sending.
 *
 * Pure words, so the server and a test read the same ones.
 */
import { wordsIn, type ApplicantLanguage } from "./applicantWords";

export const AGAIN_WORDS: Record<ApplicantLanguage, { subject: string; body(roles: string): string }> = {
  en: {
    subject: "We already have your application",
    body: (roles) =>
      `We already have your application for ${roles}, and it's waiting for the village. You don't need to send it again. ` +
      "The email we sent when it came in has the link to see where it is. If you didn't send it again, you can ignore this email.",
  },
  es: {
    subject: "Ya tenemos su solicitud",
    body: (roles) =>
      `Ya tenemos su solicitud para ${roles}, y está esperando a la aldea. No necesita enviarla otra vez. ` +
      "El correo que le enviamos cuando llegó tiene el enlace para ver dónde está. Si no la envió otra vez, puede ignorar este correo.",
  },
};

/** The email's subject and text, in the applicant's language. */
export function againLetter(i: { firstName: string | null; roleNames: readonly string[]; lang: ApplicantLanguage | null | undefined }): { subject: string; text: string } {
  const lang: ApplicantLanguage = i.lang === "es" ? "es" : "en";
  const w = wordsIn(lang);
  const words = AGAIN_WORDS[lang];
  return { subject: words.subject, text: [w.hello(i.firstName), "", words.body(w.list(i.roleNames) || w.aRole), ""].join("\n") };
}
