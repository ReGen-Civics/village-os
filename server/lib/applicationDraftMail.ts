/**
 * THE RESUME LINK, BY EMAIL (Save and finish later, the lead, 24 Nov 2026; shared/applicationDrafts.ts).
 *
 * Posted through the same door as the application's confirmation email (server/routes/openProposals.ts
 * `postEmail`, the comms post office): written to the comms ledger first, refused for a suppressed address,
 * and kept once per draft and address by its idempotency key. Essential: it answers a press of a button.
 */
import type { OutgoingEmail } from "../../shared/comms/contracts";
import type { ApplicantLanguage } from "../../shared/applicantWords";
import { emailKeyOf } from "../../shared/comms/address";
import { safeGreeting } from "../../shared/openProposals";

const WORDS: Record<ApplicantLanguage, { subject: (role: string) => string; hello: (name: string | null) => string; body: (role: string, village: string) => string; link: string; days: (n: number) => string; private: string }> = {
  en: {
    subject: (role) => (role ? `Your saved application: ${role}` : "Your saved application"),
    hello: (name) => (name ? `Hello ${name},` : "Hello,"),
    body: (role, village) => `Your application${role ? ` for ${role}` : ""}${village ? ` at ${village}` : ""} is saved. Open this link to pick up where you left off, with your answers and files as you left them:`,
    link: "Finish your application",
    days: (n) => `We keep it for ${n} days after your last save. Nothing reaches the team until you send it.`,
    private: "Keep this link to yourself: anyone with it can open your saved answers.",
  },
  es: {
    subject: (role) => (role ? `Tu solicitud guardada: ${role}` : "Tu solicitud guardada"),
    hello: (name) => (name ? `Hola ${name}:` : "Hola:"),
    body: (role, village) => `Tu solicitud${role ? ` para ${role}` : ""}${village ? ` en ${village}` : ""} está guardada. Abre este enlace para seguir donde lo dejaste, con tus respuestas y archivos tal como estaban:`,
    link: "Termina tu solicitud",
    days: (n) => `La guardamos ${n} días después de la última vez que guardes. Nada llega al equipo hasta que la envíes.`,
    private: "Guarda este enlace solo para ti: quien lo tenga puede abrir tus respuestas guardadas.",
  },
};

export function draftLinkEmail(
  deps: { escapeHtml(s: string): string },
  p: { draftId: string; email: string; name: string; roleName: string; village: string; url: string; lang: ApplicantLanguage; keepDays: number },
): OutgoingEmail {
  const w = WORDS[p.lang] ?? WORDS.en;
  const first = safeGreeting(p.name);
  const paras = [w.hello(first), w.body(p.roleName, p.village), p.url, w.days(p.keepDays), w.private];
  const e = deps.escapeHtml;
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937"><p>${e(paras[0])}</p><p>${e(paras[1])}</p><p><a href="${e(p.url)}">${e(w.link)}</a></p><p>${e(paras[3])}</p><p>${e(paras[4])}</p></body></html>`;
  return {
    // One letter per draft and address: saving again to the same address is the ledger's duplicate, never a second email.
    idempotencyKey: `application-draft:${p.draftId}:${emailKeyOf(p.email)}`,
    kind: "essential",
    origin: "open_proposal.draft",
    to: { email: p.email, ...(first ? { name: first } : {}) },
    subject: w.subject(p.roleName),
    html,
    text: paras.join("\n\n"),
  };
}
