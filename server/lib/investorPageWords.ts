/**
 * THE INVESTOR PAGE'S OWN WORDS, ON THE SERVER ONLY (the lead, 27 Nov 2026: "Yes I want to hide the generic text right
 * now and going forward it should be screened to show investment details").
 *
 * The labels, buttons and messages the investor page draws around the village's words: the pack and call forms, the
 * step tiles, the summary's heading. They were `<Trans>` strings in client/src/pages/InvestorJourney.tsx and
 * client/src/components/InvestorSummary.tsx, so they rode in every reader's script. They now reach a browser only
 * through `GET /api/investor/page`, with the page's spec (server/lib/investorJourney.ts), for the readers the team
 * let in.
 *
 * TRANSLATED HERE, the way other words the server sends are: one table per language, read by the reader's locale
 * (`readerLocale`). The Spanish is es.po's reviewed Spanish for the same words, carried over when they left the
 * client; the five lines that were never in the catalog are new and marked below for native review.
 * `{name}` placeholders are filled by the page.
 */
import type { InvestorWordKey } from "../../shared/investorInterest";

export const INVESTOR_WORDS_EN: Record<InvestorWordKey, string> = {
  stepsDone: "{walkedCount} of {stepCount} steps completed",
  packPreparing: "The investor pack is being prepared.",
  retry: "Something went wrong. Please try again.",
  retryWithEmail: "Something went wrong. Please try again or email {email}.",
  packSent: "Check your email - we've sent you the full investor packet.",
  heroAlt: "The land and the buildings on it",
  stage: "Stage: {stage}",
  accomplish: "What you'll accomplish:",
  packTitle: "Request Investor Pack",
  packDescription: "Request the full investor pack with financials and development timeline.",
  name: "Name",
  email: "Email",
  range: "Investment Range",
  message: "Message (optional)",
  sendRequest: "Send Request",
  callTitle: "Schedule a Call",
  callDescription: "Schedule a one-on-one investment call with our team.",
  preferredTime: "Preferred Time",
  requestCall: "Request Call",
  summaryEyebrow: "Investment Summary",
};

export const INVESTOR_WORDS_ES: Record<InvestorWordKey, string> = {
  stepsDone: "{walkedCount} de {stepCount} pasos completados",
  packPreparing: "Estamos preparando el paquete para inversionistas.",
  // needs-native-review: new on 27 Nov 2026 (retry, retryWithEmail, packSent, heroAlt)
  retry: "Algo salió mal. Por favor, inténtelo de nuevo.",
  retryWithEmail: "Algo salió mal. Por favor, inténtelo de nuevo o escriba a {email}.",
  packSent: "Revise su correo: le enviamos el paquete completo para inversionistas.",
  heroAlt: "La tierra y los edificios sobre ella",
  stage: "Etapa: {stage}",
  accomplish: "Lo que usted logrará:",
  packTitle: "Pedir el paquete para inversionistas",
  packDescription: "Solicite el paquete completo para inversionistas, con finanzas y cronograma de construcción.",
  name: "Nombre",
  email: "Correo electrónico",
  range: "Rango de inversión",
  message: "Mensaje (opcional)",
  sendRequest: "Enviar solicitud",
  callTitle: "Agendar una llamada",
  callDescription: "Agende una llamada individual sobre inversión con nuestro equipo.",
  preferredTime: "Hora preferida",
  requestCall: "Pedir una llamada",
  summaryEyebrow: "Resumen de inversión",
};

/** The table for a reader's locale: Spanish for `es`, English otherwise. */
export function investorWordsFor(locale: string | null): Record<InvestorWordKey, string> {
  return locale && locale.toLowerCase().startsWith("es") ? INVESTOR_WORDS_ES : INVESTOR_WORDS_EN;
}
