/**
 * AN EARLY APPLICATION (the lead, 20 Nov 2026): a coming-soon role keeps its waitlist first, and a person who feels
 * a strong fit may still apply. The lead's own words, said once wherever the early way is offered: the role's
 * not-open page, the add-another-role picker, the role card and the roles page.
 */
import { useLingui } from "@lingui/react/macro";

export function EarlyWords() {
  const { t } = useLingui();
  return <>{t({ message: "You can apply early if you feel you're a particularly strong fit. We may not get back to you, and the card details may change, but if you're feeling inspired, go ahead.", context: "coming-soon role: the early application" })}</>;
}
