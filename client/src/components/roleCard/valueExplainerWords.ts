/**
 * THE VALUE EXPLAINER'S WORDS (lead, 17 Nov 2026), drawn only by ValueCallout.tsx, which the role card loads
 * lazily so these words stay off the first view of the routes that show a card.
 */
// A value import of the runtime, as rewardWords.ts has: precompileEnglish compiles the messages of a file that
// imports it and skips one that only uses `msg`.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { ROLE_PAY_CAP_PCT } from "@shared/commitmentRange";
import { CONTRIBUTION_TOKEN_DEFAULT, tokensNoun } from "@shared/contributionToken";

/**
 * THE PAY BAND THE EXPLAINER NAMES, as a percent of a role's price: 80% to 100%. HARDCODED for now (lead,
 * 17 Nov 2026). The village's own band lives in `valuation.band_below_pct` and `valuation.band_above_pct`
 * (shared/gameVariables.ts), laid over the valuation model on the server (server/lib/valuationStore.ts);
 * neither reaches the public role card's read today, so the figures here are the band the lead named.
 * The cap the explainer names (120%) is ROLE_PAY_CAP_PCT itself, as a percent only: no cap amount is ever shown
 * to a member or an applicant (lead, 17 Nov 2026).
 */
export const EXPLAINER_BAND = { lowPct: 80, highPct: 100 } as const;

export interface ValueExplainerWords {
  callout: string;
  open: string;
  parts: Array<{ key: "price" | "agreement" | "aim"; heading: string; text: string }>;
}

/** "Value in equals value out.", the control that opens its explainer, and the explainer's three parts. */
export function valueExplainerWords(
  i18n: I18n = appI18n,
  band: { lowPct: number; highPct: number } = EXPLAINER_BAND,
  capPct: number = ROLE_PAY_CAP_PCT,
  tokenName: string = CONTRIBUTION_TOKEN_DEFAULT,
): ValueExplainerWords {
  const { lowPct, highPct } = band;
  // The contribution token, never equity or ownership (the lead, 19 Nov 2026): its name is the village's own.
  const tokens = tokensNoun(tokenName);
  return {
    callout: i18n._(msg({ message: "Value in equals value out.", context: "role card rewards: the callout beside the price" })),
    open: i18n._(msg({ message: "How rewards are set", context: "role card rewards: the control that opens the value explainer" })),
    parts: [
      {
        key: "price",
        heading: i18n._(msg({ message: "How compensation is set", context: "role card rewards explainer: heading" })),
        text: i18n._(
          msg({
            message: `Each role's compensation comes from a regenerative valuation engine we're beta testing and improving with the team. It weighs the role's scope and what it asks of a person. Pay sits in a band from ${lowPct}% to ${highPct}% of that figure, in total comp. Proposals can go up to ${capPct}%, and the figure for that will show once the team agrees it.`,
            context: "role card rewards explainer: how the price is set",
          }),
        ),
      },
      {
        key: "agreement",
        heading: i18n._(msg({ message: "Your agreement", context: "role card rewards explainer: heading" })),
        text: i18n._(
          msg({
            message: "You work as a contractor. Your proposal says what you'll deliver each moon and how much of yourself it takes, and that becomes your agreement. Each moon you recap what you delivered, and pay follows what you deliver.",
            context: "role card rewards explainer: your agreement",
          }),
        ),
      },
      {
        key: "aim",
        heading: i18n._(msg({ message: "What we're aiming for", context: "role card rewards explainer: heading" })),
        text: i18n._(
          msg({
            message: `What you put in comes back to you fairly, in cash and in ${tokens}, which track what you contribute. We track value out as carefully as value in, and we shape this together each season.`,
            context: "role card rewards explainer: what we're aiming for",
          }),
        ),
      },
    ],
  };
}
