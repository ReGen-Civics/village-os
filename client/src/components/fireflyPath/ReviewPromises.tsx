/**
 * WHAT WE PROMISE, on Review & submit (the lead, 20 Nov 2026, idea 16): the paragraphs that sat under the agreements,
 * as four short lines, with the full wording behind "More". Nothing is dropped: the retention and the reply lines are
 * said whole under "More", and the AI line is shown whole, in the same words as OPEN_AI_DRAFTS, which the
 * confirmation email carries (Rye, 9 Nov 2026).
 */
import { useLingui } from "@lingui/react/macro";
import { OPEN_ANONYMISE_DAYS, OPEN_CONFIRM_HOURS } from "@shared/openProposals";

export function ReviewPromises() {
  const { t } = useLingui();
  return (
    <div className="grid gap-2 text-sm text-muted-foreground" data-review-promises="">
      <ul className="grid list-disc gap-1 pl-5">
        <li>{t({ message: "We write to this address with every reply.", context: "founding application review, in short" })}</li>
        <li>{t({ message: `If you don't confirm within ${OPEN_CONFIRM_HOURS} hours, we delete what you sent.`, context: "founding application review, in short" })}</li>
        <li>{t({ message: `After a no, or a yes with no account made, your name and email go after ${OPEN_ANONYMISE_DAYS} days.`, context: "founding application review, in short" })}</li>
        <li data-ai-drafts="">{t`An AI may help draft our replies to you; a person always reads and sends them, and no AI takes part in choosing.`}</li>
      </ul>
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-notice">{t({ message: "More", context: "founding application review, the full wording" })}</summary>
        <div className="grid gap-1 pb-1">
          <p data-after-approval="">{t({ message: "We'll write to this address with every reply. If we invite you to join, you'll get an email with a button to create your profile.", context: "founding application review" })}</p>
          <p data-kept-for="">{t({ message: `If you don't confirm within ${OPEN_CONFIRM_HOURS} hours, we delete what you sent. If we say no, or say yes and you never make your account, we remove your name and email ${OPEN_ANONYMISE_DAYS} days later.`, context: "founding application review" })}</p>
        </div>
      </details>
    </div>
  );
}
