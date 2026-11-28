/**
 * Part 1 of 3 of the dials' words (gameMechanicsDialWords.ts explains them). Written from shared/gameVariables.ts;
 * gameMechanicsDialWords.test.ts holds every entry to the server's English.
 */
import { msg } from "@lingui/core/macro";
// The runtime as a value the build keeps: precompileEnglish compiles the messages of a file that imports it
// (client/src/i18n/precompileEnglish.ts), and a type-only import is erased before it looks.
export { i18n as dialWordsRuntime1 } from "@lingui/core";
import type { DialWords } from "./gameMechanicsDialWords";

export const DIAL_WORDS_1: Readonly<Record<string, DialWords>> = {
  "membership.vouches_required": {
    label: msg({ message: "Vouches that admit a member", context: "game variable membership.vouches_required, label" }),
    description: msg({ message: "How many people have to say they know somebody before that person becomes a member. The default matches how a village starts: it launches when a founder brings two more and all three carry the launch, which leaves exactly the vouchers the fourth member needs, so this number is read from the launch bar itself. A vouch cannot be taken back, so this bar is only ever crossed forwards. 0 turns vouching off: no number of vouches admits anybody, and a steward's super vouch is how people are admitted. Raise it and a young village may not be able to admit anybody at all, which is what the steward override exists for.", context: "game variable membership.vouches_required, description" }),
  },
  "membership.invite_only": {
    label: msg({ message: "Joining is by invitation", context: "game variable membership.invite_only, label" }),
    description: msg({ message: "When on, an account can only be made with an invitation link a member sent, by email sign-up or by Google. Anybody else can still look around, and is asked to send a request to join, which lands in the admin queue. When off, anybody can make an account, and an invitation link still counts as the inviter's vouch.", context: "game variable membership.invite_only, description" }),
  },
  "season_places.who": {
    label: msg({ message: "What takes part each season", context: "game variable season_places.who, label" }),
    description: msg({ message: "Who proposes to take part in a season: each circle, which a live holder of any role in it proposes for, or each member for themselves. Places, the waitlist and seasons served are all counted in this unit.", context: "game variable season_places.who, description" }),
    choices: {
      "circle": {
        label: msg({ message: "Each circle", context: "game variable season_places.who, choice circle, label" }),
        hint: msg({ message: "A circle proposes together, and holds one place.", context: "game variable season_places.who, choice circle, hint" }),
      },
      "member": {
        label: msg({ message: "Each member", context: "game variable season_places.who, choice member, label" }),
        hint: msg({ message: "Every member proposes for themselves.", context: "game variable season_places.who, choice member, hint" }),
      },
    },
  },
  "season_places.free_after": {
    label: msg({ message: "Seasons before no proposal is needed", context: "game variable season_places.free_after, label" }),
    description: msg({ message: "After holding a place in this many seasons, a circle takes part in the next one without a proposal. The season it is in now counts. Leave it blank and every season needs a proposal. 0 means nobody ever needs one.", context: "game variable season_places.free_after, description" }),
  },
  "season_places.cap": {
    label: msg({ message: "Places in a season", context: "game variable season_places.cap, label" }),
    description: msg({ message: "How many circles can take part in one season. Over it, a circle that was adopted, or that has served its seasons, waits in order and takes the first place that frees, and its people are told. Lowering it removes nobody: places already held stand. Leave it blank for no cap. 0 means no places.", context: "game variable season_places.cap, description" }),
  },
  "season_crew.picker_role": {
    label: msg({ message: "The role that picks a circle's team", context: "game variable season_crew.picker_role, label" }),
    description: msg({ message: "Every season starts fresh: each member applies, and each circle's team for the season is picked from everyone who applied. Name the role whose holder in each circle picks it, as your circles call it. Leave it blank, or leave a circle without a live holder of that role, and every role holder in the circle can pick.", context: "game variable season_crew.picker_role, description" }),
  },
  "season_crew.needs_place": {
    label: msg({ message: "A circle needs a season place to pick a team", context: "game variable season_crew.needs_place, label" }),
    description: msg({ message: "When on, a circle picks a team for a season only while it holds a place in that season, so the places in a season cap how many circles take part.", context: "game variable season_crew.needs_place, description" }),
  },
  "roles.prerequisites": {
    label: msg({ message: "What a role asks for before anyone applies", context: "game variable roles.prerequisites, label" }),
    description: msg({ message: "Roles that ask for something completed before a member may apply: a product they paid for, a quest consented to them, or both. One entry per role, joined by semicolons: role-id = product:product-id, quest:quest-id. A reversed payment does not count. Leave it blank and no role asks for anything.", context: "game variable roles.prerequisites, description" }),
  },
  "arrival.greeter_role": {
    label: msg({ message: "The role that greets a new arrival", context: "game variable arrival.greeter_role, label" }),
    description: msg({ message: "The role whose holders are told the moment somebody joins. Greeting belongs to a role, so the village re-seats it each season and the message follows with nobody editing a setting. Leave it empty and the founders hear it, which is also what happens when the role is named and nobody is sitting in it: a village that has not built its org chart yet, and one whose greeter stepped down last week, both still find out that a person arrived. Paste the role id from the org chart.", context: "game variable arrival.greeter_role, description" }),
  },
  "budgets.village_circle_id": {
    label: msg({ message: "The village's own circle, for budget lines about the whole village", context: "game variable budgets.village_circle_id, label" }),
    description: msg({ message: "Every cash budget line belongs to a circle. A line for the whole village, like a sheet row that names no circle, goes on this one. Leave it empty and the budget finds it on the org chart: the active circle set as the link circle, or else the lead circle, or else the one circle with no parent. With none of those, an upload row that names no circle is refused until this is set. Paste the circle id from the org chart.", context: "game variable budgets.village_circle_id, description" }),
  },
  "gratitude.base_budget": {
    label: msg({ message: "Base sending allowance per cycle", context: "game variable gratitude.base_budget, label" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
    description: msg({ message: "THE allowance behind every way of giving in this village: written acknowledgments on the Gratitude page, and taps of appreciation on the feed. A member's own figure is this number times their stage multiplier under Progression, so the stock ladder runs from 105 a cycle at Guest to 525 at Sage. Set it to 0 and nobody gives anything at any stage. Raise it and every stage rises with it, and so does the amount any one person may receive, because that ceiling is this figure divided by 'Full sends per cycle'. The default is 105 because it divides evenly by the default of 7 full sends, which is what makes a full send a whole 15 Gratitude at Guest and 75 at Sage. A figure that does not divide evenly still works: the ceiling rounds down and the remainder is given as a smaller gift. Unused allowance does not roll over. Giving mints fresh Gratitude for the person being thanked and takes nothing from the giver's own balance, so this allowance is what bounds it. Works with: 'Full sends per cycle', 'Gratitude each heart sends', 'Hearts one member can tap for another per cycle', and 'Sending-budget multiplier' under Progression.", context: "game variable gratitude.base_budget, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them // payout-ok: a worked example in the server's own dial description, mirrored to translate it
  },
  "gratitude.pool_per_cycle": {
    label: msg({ message: "Value pool distributed at each cycle close", context: "game variable gratitude.pool_per_cycle, label" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
    description: msg({ message: "How many tokens the village shares out when a lunar cycle closes. The pool is split among everyone in proportion to the recognition they received that cycle, so you decide how much there is and the community's appreciation decides where it goes. Set it to 0 to turn distribution off and let gratitude stay a signal on its own.", context: "game variable gratitude.pool_per_cycle, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "gratitude.pool_token": {
    label: msg({ message: "Which token the pool pays", context: "game variable gratitude.pool_token, label" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
    description: msg({ message: "The token the cycle pool pays out, for example your village's credits. The list holds the tokens this village issues itself, and it leaves out the recognition token on purpose: recognition is the signal, this is the value, and keeping them apart is what stops appreciation from becoming a price. Rename your tokens in the token registry and they change here too.", context: "game variable gratitude.pool_token, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "ledger.admin_mint_cycle_cap": {
    label: msg({ message: "Issuance cap per lunar cycle", context: "game variable ledger.admin_mint_cycle_cap, label" }),
    description: msg({ message: "The most this village can bring into existence of one token in one lunar cycle. It counts what the mint faucet issues: hand-mints, co-signed grants, treasury stocking, stay-credit comps, purchases and adjustments, and the credits a work-exchange quest releases all spend the same number. Pay for quests, roles and accepted proposals, and the gratitude pool, issue from faucets of their own and are not counted. COUNTED IN WHOLE TOKENS, so 100 means a hundred of the token and not a hundred of whatever the ledger stores underneath. It is counted NET, so a credit a member spends back into the faucet inside the same cycle stops counting and can be issued again. Two consequences worth knowing before you set it. A busy month of stays or quests can use the cap up before a steward has minted anything by hand, and the refusal a steward then meets says how much of the lunation's issuance came from those doors. And 0 disables every door of the mint faucet for this token, because a cap of zero means zero.", context: "game variable ledger.admin_mint_cycle_cap, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "ledger.admin_mint_cosign_over": {
    label: msg({ message: "Second steward needed above", context: "game variable ledger.admin_mint_cosign_over, label" }),
    description: msg({ message: "A hand-mint larger than this waits for a SECOND steward to agree before any tokens move. COUNTED IN WHOLE TOKENS, so 100 means a hundred of the token. Set it against what a large grant looks like in your village, and know that it is the only place a second pair of eyes is required. The record keeps who asked, who agreed, when, and the exact amount and token, so nobody can change what was signed for afterwards. 0 turns the second signature off. Minting to your own account is refused at any amount and this dial does not reach that rule.", context: "game variable ledger.admin_mint_cosign_over, description" }),
  },
  "ledger.org_accounts_open": {
    label: msg({ message: "Members can pay a venture's account", context: "game variable ledger.org_accounts_open, label" }),
    description: msg({ message: "When on, a member can send credits to the account of a venture the village has opened one for, and the people seated in that venture's role see what it holds and every payment in and out. Admins can open venture accounts and read them while this is off, so you can set one up before you switch the door on. A member who runs a venture cannot pay that venture with their own credits. Credits in a venture's account never expire.", context: "game variable ledger.org_accounts_open, description" }),
  },
  "ledger.org_service_routing": {
    label: msg({ message: "A venture keeps the seat fees for its own gatherings", context: "game variable ledger.org_service_routing, label" }),
    description: msg({ message: "When on, the seat fee for a gathering you have marked as run by a venture goes to that venture's account once the gathering is held. Off, or for any gathering no venture runs, the fee goes to the village treasury as it always has. A fee paid by somebody who runs that venture still goes to the treasury.", context: "game variable ledger.org_service_routing, description" }),
  },
  "ledger.org_redemption_open": {
    label: msg({ message: "Ventures can redeem their credits", context: "game variable ledger.org_redemption_open, label" }),
    description: msg({ message: "When on, the people seated in a venture's role can ask to turn credits the venture holds into money. The credits are held at once, the Treasury pays the venture outside the platform and then confirms with the payment's reference, and only then are the credits destroyed. Nobody who runs the venture can confirm its redemption. Leave this off until your legal review says the village may pay out. Turning it off stops new requests; anything already waiting can still be confirmed, refused or cancelled.", context: "game variable ledger.org_redemption_open, description" }),
  },
  "ledger.org_redemption_moon_cap": {
    label: msg({ message: "Most credits ventures may redeem per cycle", context: "game variable ledger.org_redemption_moon_cap, label" }),
    description: msg({ message: "Counted across every venture together, in whole credits, for each cycle: requests still waiting and confirmed ones count, refused and cancelled ones give their credits back and count for nothing. The count starts again at the new cycle. 0 means zero: no venture redeems anything. Start low while the village tries this out, and let whoever holds the village's legal and financial structure set the real number.", context: "game variable ledger.org_redemption_moon_cap, description" }),
  },
  "ledger.org_redemption_rate": {
    label: msg({ message: "What one credit is worth when a venture redeems", context: "game variable ledger.org_redemption_rate, label" }),
    description: msg({ message: "In the first currency of the list below. A venture paid in another listed currency is converted at that day's rate, and the rate used is written on the redemption. 0 means there is no rate, and no venture can redeem. Works with: 'Currencies a venture may be paid in'.", context: "game variable ledger.org_redemption_rate, description" }),
  },
  "ledger.org_redemption_currencies": {
    label: msg({ message: "Currencies a venture may be paid in", context: "game variable ledger.org_redemption_currencies, label" }),
    description: msg({ message: "Three-letter codes separated by commas. The venture chooses one when it asks. The first one is the currency the rate above is written in.", context: "game variable ledger.org_redemption_currencies, description" }),
  },
  "resources.circle_cap_bonus_pct": {
    label: msg({ message: "Bonus for a circle that finished under its cap", context: "game variable resources.circle_cap_bonus_pct, label" }),
    description: msg({ message: "The share of a circle's UNMINTED capacity that comes back to the circle as a bonus, once the village has voted that the circle completed its work. It applies only to circles running on a spending cap, because a cap's unused room disappears when the period turns and there is nothing to reward in a treasury, which the circle simply keeps. COUNTED AS A PERCENTAGE of what the circle did not issue, so 10 against 1000 of unused room pays 100. A bonus is newly minted, so it meets this village's issuance cap for the cycle it is paid in and can be refused there. 0 means no bonus is ever paid, and the completion vote still stands on its own as the village's answer about the work.", context: "game variable resources.circle_cap_bonus_pct, description" }),
  },
  "redemption.holds_on_propose": {
    label: msg({ message: "Hold the tokens while a redemption is open", context: "game variable redemption.holds_on_propose, label" }),
    description: msg({ message: "When this is on, asking to redeem moves the tokens into a holding account straight away. They stay the member's, they stop being spendable, and they come back in full if the redemption is refused, withdrawn, or left to expire. Turning it off leaves them spendable until the moment a steward confirms, which means a member can be paid off the platform on Tuesday, spend the same tokens on Wednesday, and leave the confirmation with nothing to destroy on Thursday. The village has then paid for tokens it never received, and no part of this software notices. Founder held for that reason.", context: "game variable redemption.holds_on_propose, description" }),
  },
  "redemption.tokens": {
    label: msg({ message: "Which tokens may be redeemed", context: "game variable redemption.tokens, label" }),
    description: msg({ message: "Leave this empty and every token this village issues as a spendable credit may be redeemed. Type a comma-separated list of token slugs to narrow it to exactly those. This dial can only ever NARROW. Tokens governed on Base, recognition, voice and standing examples are refused whatever is typed here, so nothing set on this dial can make this platform the source of truth for a cap table, and nothing set here turns governance weight into money. Of the credits a module issues against its own service, a stay credit may be redeemed and a library credit may not: a library credit is a deposit against a shelf and it comes back when the item does.", context: "game variable redemption.tokens, description" }),
  },
  "redemption.per_member_per_cycle": {
    label: msg({ message: "Redemptions one member may open per cycle", context: "game variable redemption.per_member_per_cycle, label" }),
    description: msg({ message: "How many redemptions one member may open in one lunar cycle, counting the ones still waiting on a steward. This is deliberately its own number and not the rule-change proposal cap: asking for value back is a different act from asking to change how the village works, and spending one budget on the other would mean a member who redeems twice has three rule changes left for the moon. 0 closes redemption to everybody.", context: "game variable redemption.per_member_per_cycle, description" }),
  },
  "redemption.expires_after_days": {
    label: msg({ message: "A redemption expires after", context: "game variable redemption.expires_after_days, label" }),
    description: msg({ message: "How long a redemption waits for an answer before it expires on its own and the held tokens go back to the member in full. It is here so a request nobody answers ends by itself instead of holding somebody's balance for as long as the village stays busy. Set it to 0 and a redemption waits forever, which is a real choice for a village that would sooner answer late than expire something.", context: "game variable redemption.expires_after_days, description" }),
  },
  "redemption.currencies": {
    label: msg({ message: "Currencies a member may redeem into", context: "game variable redemption.currencies, label" }),
    description: msg({ message: "Leave this empty and redemptions are counted in the currency this project counts in, which you set in Make This Yours. Type a comma-separated list of three-letter codes to offer more than one, and a member chooses which one when they ask. A currency this village cannot convert into still works: what it cannot do is follow the exchange's posted price, and the request then carries what the member asked for and no arithmetic.", context: "game variable redemption.currencies, description" }),
  },
  "redemption.rate_source": {
    label: msg({ message: "Where the rate comes from", context: "game variable redemption.rate_source, label" }),
    description: msg({ message: "Following the exchange means a token is worth what this village currently sells it for, so the two prices can never drift apart while nobody is looking. Setting a rate here is for a village that pays back at a different number from the one it sells at, and it is shown with a warning whenever it pays more than the exchange sells for, because a member could then buy on the exchange and redeem at a profit until the treasury is empty. The warning never blocks anything.", context: "game variable redemption.rate_source, description" }),
    choices: {
      "exchange": {
        label: msg({ message: "Follow the exchange's posted price", context: "game variable redemption.rate_source, choice exchange, label" }),
        hint: msg({ message: "The token is worth what this village sells it for right now. A token with no posted price has no rate, and a request for one carries words instead of a number.", context: "game variable redemption.rate_source, choice exchange, hint" }),
      },
      "set": {
        label: msg({ message: "Set a rate here", context: "game variable redemption.rate_source, choice set, label" }),
        hint: msg({ message: "The village pays back at its own number, whatever it sells at. Set it below.", context: "game variable redemption.rate_source, choice set, hint" }),
      },
    },
  },
  "redemption.rate_per_token": {
    label: msg({ message: "Rate set here, per whole token", context: "game variable redemption.rate_per_token, label" }),
    description: msg({ message: "What one whole token is worth in the first of this village's redemption currencies, read only while the rate above is set here instead of followed. A rate of 0 means there is no rate, so a request carries what the member asked for and no arithmetic, which is the honest state for a village that redeems into services or a share and prices neither. Works with: 'Where the rate comes from' and 'Currencies a member may redeem into'.", context: "game variable redemption.rate_per_token, description" }),
  },
  "redemption.fee_pct": {
    label: msg({ message: "Fee taken from the payment", context: "game variable redemption.fee_pct, label" }),
    description: msg({ message: "A share of what a redemption is worth, kept by the village and taken out of the payment it makes off the platform. The tokens are still destroyed in full: a fee is never a smaller burn, and nothing about it is posted to the ledger, because the money it comes out of never entered this software. The member is shown what they asked for, the fee, and what is left, before they ask.", context: "game variable redemption.fee_pct, description" }),
  },
  "redemption.fee_fixed": {
    label: msg({ message: "Fixed fee taken from the payment", context: "game variable redemption.fee_fixed, label" }),
    description: msg({ message: "A flat amount in the redemption's own currency, kept by the village on top of the share above, for the cost of making a payment at all: a transfer fee, a trip to the bank. Taken out of the payment the same way, and the tokens are still destroyed in full. Works with: 'Fee taken from the payment'.", context: "game variable redemption.fee_fixed, description" }),
  },
  "redemption.min_amount": {
    label: msg({ message: "Smallest redemption, in money", context: "game variable redemption.min_amount, label" }),
    description: msg({ message: "The least a member may ask to redeem at once, counted in the redemption's own currency, so a village is not settling payments worth less than the transfer costs. 0 means there is no floor. A token with no rate cannot be measured against this, so while this is above 0 a request for an unpriced token is refused instead of passing unmeasured.", context: "game variable redemption.min_amount, description" }),
  },
  "redemption.max_per_request": {
    label: msg({ message: "Most in one redemption, in money", context: "game variable redemption.max_per_request, label" }),
    description: msg({ message: "The most a member may ask for at once, counted in the redemption's own currency. Leave it blank for no ceiling. 0 means zero: no redemption may be worth anything. Same rule as the floor: while this holds a number, 0 included, a token with no rate is refused instead of passing unmeasured.", context: "game variable redemption.max_per_request, description" }),
  },
  "redemption.max_per_member_per_cycle": {
    label: msg({ message: "Most one member may redeem per cycle, in money", context: "game variable redemption.max_per_member_per_cycle, label" }),
    description: msg({ message: "Counted across every request one member opens in a lunar cycle, the ones still waiting included, in the redemption's own currency. This is the money twin of 'Redemptions one member may open per cycle', which counts requests and not value: a village that cares how much it pays wants this one, and a village that cares how often it is asked wants that one. Leave it blank for no ceiling. 0 means zero: no member may redeem anything.", context: "game variable redemption.max_per_member_per_cycle, description" }),
  },
  "redemption.process_text": {
    label: msg({ message: "How redemption works here", context: "game variable redemption.process_text, label" }),
    description: msg({ message: "The village's own words for what happens after a member asks: who to speak to, what they will be asked for, how the money actually reaches them. A member reads this before they ask and on every request they have open, and whoever confirms reads it beside the request, so both sides are working from the same instructions. It is shown as plain text with the line breaks you type, and web addresses become links. It is never read as HTML, so nothing typed here can style or script a member's page. Leave it empty and no such card is shown.", context: "game variable redemption.process_text, description" }),
  },
  "redemption.max_village_per_cycle": {
    label: msg({ message: "Most the village will redeem per cycle, in money", context: "game variable redemption.max_village_per_cycle, label" }),
    description: msg({ message: "Counted across every member's requests in a lunar cycle, the ones still waiting included. This is the village's own ability to pay, said as a number, and it is the one cap that two members asking at the same moment could otherwise walk through together. Leave it blank for no ceiling. 0 means zero: the village redeems nothing.", context: "game variable redemption.max_village_per_cycle, description" }),
  },
  "valuation.band_below_pct": {
    label: msg({ message: "How far under the suggestion one person may set pay", context: "game variable valuation.band_below_pct, label" }),
    description: msg({ message: "The valuation engine suggests a figure for a role's pay or a quest's price. A figure from this far under the suggestion up to the top of the band is set by one person's word. A figure lower than that needs a written reason and a second signer, or the village decides. A whole percent of the suggestion: 20 means the band starts at 80% of it, and 0 means nothing under the suggestion is inside. Leave it blank to follow the valuation model, which is 10% unless the village saved its own.", context: "game variable valuation.band_below_pct, description" }),
  },
  "valuation.band_above_pct": {
    label: msg({ message: "How far over the suggestion one person may set pay", context: "game variable valuation.band_above_pct, label" }),
    description: msg({ message: "The other side of the same band. A figure from the bottom of the band up to this far over the suggestion is set by one person's word. A figure higher than that needs a written reason and a second signer, or the village decides. A whole percent of the suggestion: 0 means the suggestion itself is the top of the band, and 10 means up to 110% of it. Leave it blank to follow the valuation model, which is 10% unless the village saved its own.", context: "game variable valuation.band_above_pct, description" }),
  },
  "economy.voice_claim_threshold": {
    label: msg({ message: "Voice needed before a member can claim", context: "game variable economy.voice_claim_threshold, label" }),
    description: msg({ message: "How much voice someone gathers before their chip turns claimable. What this really sets is how much attention your governance spends: every claim becomes a real proposal in your Hypha space, so a low number fills that space with small ones and a high number leaves people waiting a year for a loop that never visibly closes. At the seeded rates, 100 is ten confirmed quests, or two seasons holding a role, or a mix of both. A good way to pick it: decide how many claim proposals your circle can genuinely consider in one Claims Week, then set this so about that many members qualify.", context: "game variable economy.voice_claim_threshold, description" }),
  },
  "economy.equity_claim_threshold": {
    label: msg({ message: "Earned equity needed before a member can claim", context: "game variable economy.equity_claim_threshold, label" }),
    description: msg({ message: "How much earned equity someone gathers before they can carry it across to Hypha. Each claim becomes one proposal in your Hypha space and takes the member's whole balance, and claims open only in Claims Week, so each member raises at most one equity proposal a window. The default of 1 means any equity a member has earned can be claimed. Raise it if your circle would sooner consider fewer, larger claims. Nothing pays earned equity until your village turns on a rule that pays it.", context: "game variable economy.equity_claim_threshold, description" }),
  },
  "economy.claims_week_days": {
    label: msg({ message: "How many days Claims Week stays open", context: "game variable economy.claims_week_days, label" }),
    description: msg({ message: "Claims open for one window each season, so a whole season of contribution formalises in one governance pass instead of a drip of separate proposals. Outside the window a member's chip reads how much they have gathered and when it next opens. Worth lining the window up so it CLOSES just before your governance actually meets: if it shuts six weeks before anyone votes, claims simply sit and wait.", context: "game variable economy.claims_week_days, description" }),
  },
  "economy.claims_week_starts": {
    label: msg({ message: "When each Claims Week begins", context: "game variable economy.claims_week_starts, label" }),
    description: msg({ message: "Four dates a year, one per season, as MM-DD separated by commas. The default follows the solstices and equinoxes, which is the sun's rhythm and a different clock from the cycle the settlement keeps: a season turn and a cycle boundary fall on different days, and the window opens at midnight in the village timezone. Leave it blank to keep claims open all year, which suits a village that would rather not batch.", context: "game variable economy.claims_week_starts, description" }),
  },
  "economy.hypha_space": {
    label: msg({ message: "Your Hypha space", context: "game variable economy.hypha_space, label" }),
    description: msg({ message: "The DHO slug that voice claims are raised into, from app.hypha.earth. Until this is set, voice gathers correctly and cannot be claimed, and members are told exactly that. Nobody is shown a button that would fail. Set it ONLY to a space your village controls: a claim is a proposal to move real value, and an intent aimed somewhere else is value leaving through a door you did not open.", context: "game variable economy.hypha_space, description" }),
  },
  "economy.voice_decay_pct": {
    label: msg({ message: "How much Voice wanes each cycle", context: "game variable economy.voice_decay_pct, label" }),
    description: msg({ message: "How much of each member's Voice wanes at the close of each cycle. Voice that wanes is posted to the village's waning account, so nothing is destroyed and the books still balance. Nobody takes it: it simply does not keep, the way standing does not keep if you stop showing up. Set it to 0 and Voice never wanes. At the default of 1 percent, somebody holding 5 Voice loses 0.05 in a moon and earns it back many times over by holding a role or finishing one quest. An amount too small to reach your token's smallest unit wanes nothing at all, and the settlement counts how many members that was true of. Members who are in the middle of leaving are left alone until their exit is settled. Works with: 'Which Voice wanes' below, and the role and quest payouts under The Mint, because what wanes and what is earned settle against each other over time.", context: "game variable economy.voice_decay_pct, description" }),
  },
  "economy.voice_decay_basis": {
    label: msg({ message: "Which Voice wanes", context: "game variable economy.voice_decay_basis, label" }),
    description: msg({ message: "Which of a member's Voice the waning rate is measured against. One answer is offered today and it is the only honest one: all of it. A member's balance already IS the Voice they have never spent, because the two ways Voice leaves a member here are a claim toward Hypha and the settlement of an exit, and each of those takes it out of the balance the moment it happens. So there is no second pot of unspent Voice for the books to point at, and an option promising one would measure the same number twice and call it a choice. The dial is here so that a village which later gains another way to spend Voice can be given a real second setting without renaming the one it already holds.", context: "game variable economy.voice_decay_basis, description" }),
    choices: {
      "all": {
        label: msg({ message: "All of a member's Voice", context: "game variable economy.voice_decay_basis, choice all, label" }),
        hint: msg({ message: "The whole balance wanes at the rate above. This is the ruling as it stands: waning is uniform, over Voice that was bought and Voice that was earned alike.", context: "game variable economy.voice_decay_basis, choice all, hint" }),
      },
    },
  },
  "gratitude.full_sends_per_cycle": {
    label: msg({ message: "Full sends per cycle", context: "game variable gratitude.full_sends_per_cycle, label" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
    description: msg({ message: "How many people it takes to give a whole allowance away, and so how many full-strength gifts a member has each cycle. At the default of 7 the most any one person can receive is a seventh of the giver's allowance, across as many sends as they like, so thanking seven people spends everything. Set it to 1 and one person can receive somebody's whole allowance. Set it to 100 and it takes a hundred people to spend one. Sending to more people than this is allowed and always was: the ceiling bounds the AMOUNT one person may receive and never the number of sends, so a wider circle simply means smaller gifts. It counts written acknowledgments and feed hearts TOGETHER, so neither channel can carry what the other refuses. The ceiling is the base sending allowance times the giver's stage multiplier, divided by this number, so at the stock ladder 7 means 15 Gratitude to one person at Guest and 75 at Sage. It never falls below 1 Gratitude, so a small allowance and a large count cannot combine into a village where nobody can give anything at all. This is also the dial that bounds concentrated VOICE while Gratitude is the weight token under Governance: it decides how much of one member's standing may come from a single relationship. Works with: 'Base sending allowance per cycle', 'Gratitude each heart sends', 'Hearts one member can tap for another per cycle', and 'Sending-budget multiplier' under Progression.", context: "game variable gratitude.full_sends_per_cycle, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them // payout-ok: a worked example in the server's own dial description, mirrored to translate it
  },
  "gratitude.require_message": {
    label: msg({ message: "Require a message with every acknowledgment", context: "game variable gratitude.require_message, label" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
    description: msg({ message: "When on, Gratitude cannot be sent silently. The message is what makes recognition mean something to the person receiving it.", context: "game variable gratitude.require_message, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "gratitude.nudge_days_before_close": {
    label: msg({ message: "Days before close to nudge unsent gratitude", context: "game variable gratitude.nudge_days_before_close, label" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
    description: msg({ message: "How many days before a cycle closes each member who still has gratitude to send gets one warm note saying how much is left and when the cycle closes, with the people they worked with this cycle one tap away on the send panel. Once per member per cycle, never more. The note sends nothing itself: every gift still goes through the send panel. A member can turn it off in their notification settings. Set it to 0 to switch the nudge off for the whole village.", context: "game variable gratitude.nudge_days_before_close, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "cycle.mode": {
    label: msg({ message: "The rhythm the village keeps time by", context: "game variable cycle.mode, label" }),
    description: msg({ message: "Whether a cycle is a moon or a calendar month. The moon is the default and is what every village has run on: budgets refill, caps reset and the settlement lands at the new moon, so the village keeps its own rhythm instead of the one on an office wall. Calendar months suit a village whose money and reporting already run that way. The switch is a constitutional change and lands only where a cycle ends, with every finished cycle settled first, so no cycle is ever cut in half or settled against a clock it was not played on. Every cycle already closed keeps the name and the dates it closed under, whichever rhythm the village moves to.", context: "game variable cycle.mode, description" }),
    choices: {
      "lunar": {
        label: msg({ message: "The moon", context: "game variable cycle.mode, choice lunar, label" }),
        hint: msg({ message: "New moon to new moon, about 29.5 days. Boundaries come from a checked-in table of true new moons.", context: "game variable cycle.mode, choice lunar, hint" }),
      },
      "calendar": {
        label: msg({ message: "The calendar month", context: "game variable cycle.mode, choice calendar, label" }),
        hint: msg({ message: "First of the month to first of the month, UTC. Cycles carry ids like month-2026-09.", context: "game variable cycle.mode, choice calendar, hint" }),
      },
    },
  },
  "cycle.settlement_mode": {
    label: msg({ message: "How the end of a moon comes to a decision", context: "game variable cycle.settlement_mode, label" }),
    description: msg({ message: "What happens when a moon ends and its value is waiting to be released. On 'The village votes', which is the default, the platform notices the moon ended, works out exactly what each member would receive, writes that split down and opens a ballot on it; the value moves only if the village passes it, and it pays precisely the amounts the ballot showed even if a setting changes while the vote is open. On 'A founder settles by hand', no ballot is opened and the moon waits for somebody to press Close on the Cycles desk, which is how every village worked before this dial existed. Neither setting lets the platform release value on its own. A moon the village votes down stays open and no value moves; a moon nobody votes on is asked once more and then waits for a person. Works with: 'How long the village has to answer a settlement' below, and 'Cycle pool size' under Gratitude, which is the value being decided.", context: "game variable cycle.settlement_mode, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
    choices: {
      "proposal": {
        label: msg({ message: "The village votes", context: "game variable cycle.settlement_mode, choice proposal, label" }),
        hint: msg({ message: "The moon's split is frozen and put to a ballot. Passing it releases exactly the amounts shown.", context: "game variable cycle.settlement_mode, choice proposal, hint" }),
      },
      "manual": {
        label: msg({ message: "A founder settles by hand", context: "game variable cycle.settlement_mode, choice manual, label" }),
        hint: msg({ message: "No ballot is opened. The moon waits for the Close button on the Cycles desk.", context: "game variable cycle.settlement_mode, choice manual, hint" }),
      },
    },
  },
  "cycle.settlement_vote_days": {
    label: msg({ message: "How long the village has to answer a settlement", context: "game variable cycle.settlement_vote_days, label" }),
    description: msg({ message: "How many days a settlement ballot stays open. It is held under a moon on purpose: a window longer than a cycle means each moon's vote is still running when the next moon's opens, and a village would be answering two settlements at once with no way to tell them apart. Only read when 'How the end of a moon comes to a decision' is set to 'The village votes'. Works with: 'How the end of a moon comes to a decision' above.", context: "game variable cycle.settlement_vote_days, description" }),
  },
  "org.reassignment_cadence": {
    label: msg({ message: "How often every role reopens", context: "game variable org.reassignment_cadence, label" }),
    description: msg({ message: "A season can end with every role vacated and offered again. Reopening on a rhythm is how a village keeps roles from calcifying, because correcting a bad fit stops needing a confrontation and becomes a date everyone already knew about. A role can opt out on its own card, and a term can always end sooner.", context: "game variable org.reassignment_cadence, description" }),
    choices: {
      "season_turn": {
        label: msg({ message: "Every season turn", context: "game variable org.reassignment_cadence, choice season_turn, label" }),
        hint: msg({ message: "Recommended while a village is young: three months is short enough to learn fast and change what is not working.", context: "game variable org.reassignment_cadence, choice season_turn, hint" }),
      },
      "pattern_change": {
        label: msg({ message: "When the season's shape changes", context: "game variable org.reassignment_cadence, choice pattern_change, label" }),
        hint: msg({ message: "A founding season can run across several turns without reopening every role each time.", context: "game variable org.reassignment_cadence, choice pattern_change, hint" }),
      },
      "annual": {
        label: msg({ message: "Once a year", context: "game variable org.reassignment_cadence, choice annual, label" }),
        hint: msg({ message: "One reopening a year, whatever the seasons did.", context: "game variable org.reassignment_cadence, choice annual, hint" }),
      },
      "never": {
        label: msg({ message: "Never", context: "game variable org.reassignment_cadence, choice never, label" }),
        hint: msg({ message: "Roles end only on their own term date, or when somebody steps down.", context: "game variable org.reassignment_cadence, choice never, hint" }),
      },
    },
  },
  "org.proposal_change_limit": {
    label: msg({ message: "Most changes one outside batch can propose", context: "game variable org.proposal_change_limit, label" }),
    description: msg({ message: "How many roles one batch from an outside service can put into a single draft. A village's first import is often its whole structure arriving at once, so the limit starts high. Nothing publishes on a batch's say-so: a steward still reads every line and accepts it before any of it becomes the chart. Lower it once the village is built and imports settle into small changes. A draft somebody builds by hand is never held to it.", context: "game variable org.proposal_change_limit, description" }),
  },
  "org.start_after_confidentiality": {
    label: msg({ message: "A role starts only after: confidentiality", context: "game variable org.start_after_confidentiality, label" }),
    description: msg({ message: "When on, an adopted role does not start until its holder has aligned with the village's confidentiality agreement as it reads now. Write the agreement's words first (Admin, content, the confidentiality section): with no words written, nobody can align, and roles wait.", context: "game variable org.start_after_confidentiality, description" }),
  },
  "org.start_after_membership": {
    label: msg({ message: "A role starts only after: membership", context: "game variable org.start_after_membership, label" }),
    description: msg({ message: "When on, an adopted role does not start until its holder has aligned with the village's membership letter. Somebody who aligned when they applied is not asked again. No payment is ever part of it.", context: "game variable org.start_after_membership, description" }),
  },
  "org.start_after_paid_terms": {
    label: msg({ message: "A paid role starts only after its terms", context: "game variable org.start_after_paid_terms, label" }),
    description: msg({ message: "When on, a role whose terms carry pay, an allowance or a bonus does not start until its holder has aligned with those terms, the agreed rate included. Roles with no money in their terms are not asked.", context: "game variable org.start_after_paid_terms, description" }),
  },
  "quest.require_submission_before_consent": {
    label: msg({ message: "Require submitted work before consent", context: "game variable quest.require_submission_before_consent, label" }),
    description: msg({ message: "When on, value can only be released for work that was actually filed. Turning this off lets an admin credit a quest nobody submitted, which breaks the promise that credit follows shown work.", context: "game variable quest.require_submission_before_consent, description" }),
  },
  "quest.minimum_ages": {
    label: msg({ message: "Let quests ask a minimum age", context: "game variable quest.minimum_ages, label" }),
    description: msg({ message: "Off, no quest asks anybody's age, and families are welcome on every one. On, a quest's editor can ask 16 or 18 of everyone who joins it, and a member says their age band once, never a birth date. Turning it off again lifts every minimum at once and keeps each quest's choice for the next time it is on.", context: "game variable quest.minimum_ages, description" }),
  },
  "quest.self_consent_until_members": {
    label: msg({ message: "Founder may self-consent below this many members", context: "game variable quest.self_consent_until_members, label" }),
    description: msg({ message: "Consent normally needs a second person to witness the work: nobody may consent to their own claim. A founder building alone has nobody to ask, so while the village has FEWER than this many members and has not yet started its Game, an admin or founder may consent to their own claims. Once the village reaches this size or its launch vote carries, the witness rule applies to everyone, admins included. 0 means self-consent is never allowed, even for a founder alone.", context: "game variable quest.self_consent_until_members, description" }),
  },
  "governance.voice_weighting": {
    label: msg({ message: "How sensing is weighted", context: "game variable governance.voice_weighting, label" }),
    description: msg({ message: "Sensing gathers support before a ballot opens. Choose whether it gives everyone an equal voice, or mirrors Voice holdings so you can see how a weighted vote would land. Where the binding vote itself happens, here or on your DAO, is decided by the governance module and its own weight setting.", context: "game variable governance.voice_weighting, description" }),
    choices: {
      "equal": {
        label: msg({ message: "One person, one voice", context: "game variable governance.voice_weighting, choice equal, label" }),
        hint: msg({ message: "Everyone's sensing counts the same, regardless of what they hold. Simplest and most equal.", context: "game variable governance.voice_weighting, choice equal, hint" }),
      },
      "hypha-mirror": {
        label: msg({ message: "Mirror Hypha Voice holdings", context: "game variable governance.voice_weighting, choice hypha-mirror, label" }),
        hint: msg({ message: "Sensing is weighted by each member's Voice token balance, so the informal step previews how a formal Hypha decision would land.", context: "game variable governance.voice_weighting, choice hypha-mirror, hint" }),
      },
    },
  },
  "governance.hypha_threshold": {
    label: msg({ message: "The proposer bar: earned recognition to propose", context: "game variable governance.hypha_threshold, label" }),
    description: msg({ message: "Earned recognition a member needs before they can OPEN mechanics proposals and sponsor others' drafts (below it, they can still draft; a qualified member's sponsorship opens a draft). The base posture is 0: any member may propose. Raise it to ask for earned standing first. Admins and founders always qualify.", context: "game variable governance.hypha_threshold, description" }),
  },
  "governance.sensing_days": {
    label: msg({ message: "How long a topic stays open for sensing", context: "game variable governance.sensing_days, label" }),
    description: msg({ message: "Days a proposal collects perspectives before it can move to a decision. Long enough that quiet people get heard, short enough that momentum survives.", context: "game variable governance.sensing_days, description" }),
  },
  "governance.proposals_per_member_per_cycle": {
    label: msg({ message: "Mechanics proposals per member per cycle", context: "game variable governance.proposals_per_member_per_cycle, label" }),
    description: msg({ message: "How many game-rule change proposals one member may open per cycle. A ceiling on flooding, not on participation: supporting and sponsoring other proposals is never limited.", context: "game variable governance.proposals_per_member_per_cycle, description" }),
  },
  "governance.proposal_support_threshold": {
    label: msg({ message: "Supporters before a proposal can go to the vote", context: "game variable governance.proposal_support_threshold, label" }),
    description: msg({ message: "How many members must support a mechanics proposal in-game before it can be taken to the binding vote. The sensing step: proposals gather perspectives here first, and only what the village actually wants reaches a ballot. Where that ballot happens is set by how village-wide ballots decide, on this village's own dials or in your Hypha space. 0 turns the gate off, and any open proposal can go straight to the vote.", context: "game variable governance.proposal_support_threshold, description" }),
  },
  "governance.hub_url": {
    label: msg({ message: "Governance hub URL", context: "game variable governance.hub_url, label" }),
    description: msg({ message: "Base URL of the hub that listens to the chain for this village. When a proposal's Hypha URL is pasted in, the platform registers the on-chain proposal id with this hub (signed with the shared governance secret) so the verified outcome can find its way home. Empty means this village has no hub: nothing is registered and nothing is sent anywhere. Fill it in only if you run a hub or have been given one to point at.", context: "game variable governance.hub_url, description" }),
  },
  "governance.auto_apply_enabled": {
    label: msg({ message: "Apply verified proposals automatically", context: "game variable governance.auto_apply_enabled, label" }),
    description: msg({ message: "When on, a proposal verified as passed on-chain applies itself: instantly for instant dials, at the next cycle close when the set touches any cycle-timed dial (the whole set waits together; a set applies atomically or not at all). Turning this OFF is the founder's emergency brake: verified proposals hold, stewards are notified, and applying becomes a human act until it is turned back on. Founder-held on purpose.", context: "game variable governance.auto_apply_enabled, description" }),
  },
  "governance.steward_subjects": {
    label: msg({ message: "Which decisions a steward can stop", context: "game variable governance.steward_subjects, label" }),
    description: msg({ message: "A steward can stop a decision the village has already carried, inside the window before it lands, and has to say why. This names which kinds of decision are inside that reach. Leave it as all while the village is young; name a shorter list, or none, as it learns to trust its own agreements. A village with no steward and self-executing agreements is a healthy village, not a broken one. Advisory votes are never in reach, because they change nothing. Neither is the ballot that seats or unseats a steward, so the role can never stop its own removal.", context: "game variable governance.steward_subjects, description" }),
  },
  "governance.steward_veto_tiers": {
    label: msg({ message: "Which sizes of decision a steward can stop", context: "game variable governance.steward_veto_tiers, label" }),
    description: msg({ message: "Every decision carries a size: routine, structural, or constitutional. This names the sizes a steward may stop inside the window before a decision lands, and a veto needs the decision to be in reach on both this list and the one above. The default is constitutional on its own, so the role can pause the changes that reshape the village and leaves the smaller ones alone. Write them separated by commas, or write all. Leave it empty and no steward can stop anything, which is a healthy village and not a broken one. Changing this is priced at the top tier and no steward can stop the change, because a role that could veto an edit to its own limits would have none.", context: "game variable governance.steward_veto_tiers, description" }),
  },
  "governance.payout_delay_over": {
    label: msg({ message: "Payouts above this wait three days before they are sent", context: "game variable governance.payout_delay_over, label" }),
    description: msg({ message: "A payout the village votes through is sent the moment it passes. Above this amount it waits the steward window first, so somebody can catch a send that would empty a purse or reward the wrong work. The amount is counted in whole tokens of whatever token is being sent, so a village holding several tokens with very different sizes should set this against the one it actually pays people in. Zero makes every payout wait.", context: "game variable governance.payout_delay_over, description" }),
  },
  "governance.steward_council": {
    label: msg({ message: "A veto needs a majority of the stewards", context: "game variable governance.steward_council, label" }),
    description: msg({ message: "Off by default, and off means any one seated steward can stop a decision on their own. Turn it on and a village with several stewards runs them as a council: stopping a decision then takes a majority of the seated roles, so one role alone cannot hold the village up. Changing this is priced at the top tier, and no steward can stop the change, because a role that could veto an edit to its own limits would have none.", context: "game variable governance.steward_council, description" }),
  },
  "governance.veto_hours": {
    label: msg({ message: "How long a steward has to stop a change", context: "game variable governance.veto_hours, label" }),
    description: msg({ message: "A change to the Game that the village has passed does not take effect straight away. It is stamped with a landing instant and a steward may stop it until then, with a reason that goes on the record. This is the least notice a steward gets, counted from the moment the vote closes. 72 hours is the floor and cannot be lowered; a village may give its stewards longer. A decision that sends tokens is not held by this: a steward stops one of those by voting no while the ballot is still open.", context: "game variable governance.veto_hours, description" }),
  },
  "governance.consent_notice_hours": {
    label: msg({ message: "How long a change waits when every steward already said yes", context: "game variable governance.consent_notice_hours, label" }),
    description: msg({ message: "When every seated steward votes yes on a decision, nobody is left to stop it, so it does not need the whole steward window. It still waits this many hours after the vote closes, because the countdown is the village's notice that a change is coming. It only ever shortens the wait: a number above the steward window counts as the steward window. A village with no seated stewards never gets this, because nobody said yes. Zero lets a change land as soon as the vote closes whenever every steward agrees.", context: "game variable governance.consent_notice_hours, description" }),
  },
  "governance.landing_expiry_cycles": {
    label: msg({ message: "Cycles a passed decision waits before it is written off", context: "game variable governance.landing_expiry_cycles, label" }),
    description: msg({ message: "A decision the village passed is stamped with the instant it takes effect. If it is still sitting there this many cycles after that instant, it is closed and the village is told. The door back is to withdraw and rewrite it, which keeps everybody who backed it. Set it higher for a village that turns the automatic landing off for long stretches.", context: "game variable governance.landing_expiry_cycles, description" }),
  },
  "governance.change_cooldown_days": {
    label: msg({ message: "Cooldown after a governed rule change", context: "game variable governance.change_cooldown_days, label" }),
    description: msg({ message: "After a dial is changed by a passed proposal, this many days must pass before a new proposal may move that same dial again. Prevents rule-thrash and vote fatigue. 0 turns the cooldown off.", context: "game variable governance.change_cooldown_days, description" }),
  },
  "governance.change_set_cap": {
    label: msg({ message: "Changes one proposal may carry", context: "game variable governance.change_set_cap, label" }),
    description: msg({ message: "The most changes a single proposal may gather and put to one vote. Connected changes travel together and pass or fail as one, at the bar of the hardest change among them. A smaller number keeps every proposal short enough to read in one sitting. 1 to 50.", context: "game variable governance.change_set_cap, description" }),
  },
  "governance.change_requests_gathering_per_member": {
    label: msg({ message: "Change requests one member may gather at once", context: "game variable governance.change_requests_gathering_per_member, label" }),
    description: msg({ message: "How many change requests one member may be gathering at the same time, before they open them for review. Reviewing, commenting on and supporting other members' change requests is never limited.", context: "game variable governance.change_requests_gathering_per_member, description" }),
  },
  "governance.change_request_review_days": {
    label: msg({ message: "Days a change request is reviewed before its vote", context: "game variable governance.change_request_review_days, label" }),
    description: msg({ message: "How long the village has to ask questions, raise concerns and objections, and suggest edits before a change request may go to the vote. The clock starts again whenever a change or the why is edited. 0 lets a change request go to the vote as soon as its objections are answered.", context: "game variable governance.change_request_review_days, description" }),
  },
  "governance.window_changeset": {
    label: msg({ message: "When a change to the Game Mechanics can go to the vote", context: "game variable governance.window_changeset, label" }),
    description: msg({ message: "always_open lets anyone take a change set to the vote on any day. last_days_of_cycle:7 opens it in the last seven days before the moon turns, so the village reads its changes together. last_days_of_season:14 opens it in the last two weeks of the season that is running. custom:1-7 names your own days of the cycle, counted from the moon. A window decides when a vote may OPEN: a vote already running is never closed by a window shutting, and a proposal coming back after a veto or an objection opens outside its window for the grace named below.", context: "game variable governance.window_changeset, description" }),
  },
  "governance.window_mint_rule": {
    label: msg({ message: "When a change to what the village mints can go to the vote", context: "game variable governance.window_mint_rule, label" }),
    description: msg({ message: "The window a minting change opens in, in the same words as the change set window above. This one is separate because a village that wants its minting read together can hold minting to a window while everything else stays open. A change set carrying a minting element is held to the stricter of the two.", context: "game variable governance.window_mint_rule, description" }),
  },
  "governance.window_governance_mode": {
    label: msg({ message: "When a change to how votes are counted can go to the vote", context: "game variable governance.window_governance_mode, label" }),
    description: msg({ message: "The window a vote-mode switch opens in, in the same words as the change set window above. A change set carrying a mode switch is held to this window as well as its own, so the biggest change in a bundle cannot ride into an open week under a small one.", context: "game variable governance.window_governance_mode, description" }),
  },
  "governance.window_role_declare": {
    label: msg({ message: "When declaring a role can go to the vote", context: "game variable governance.window_role_declare, label" }),
    description: msg({ message: "The window a proposal that declares a new role opens in, in the same words as the change set window above.", context: "game variable governance.window_role_declare, description" }),
  },
  "governance.window_role_seat": {
    label: msg({ message: "When seating a role can go to the vote", context: "game variable governance.window_role_seat, label" }),
    description: msg({ message: "The window a proposal that asks somebody to sit in a role opens in, in the same words as the change set window above. Hold this one open while a village is young: a role nobody can be asked to fill is a role that stays empty until the calendar allows it.", context: "game variable governance.window_role_seat, description" }),
  },
  "governance.window_role_unseat": {
    label: msg({ message: "When taking a role back can go to the vote", context: "game variable governance.window_role_unseat, label" }),
    description: msg({ message: "The window a proposal that takes a role back opens in, in the same words as the change set window above. A village that windows this one is choosing to wait before it can remove somebody, so leave it always open unless you have a reason you can say out loud.", context: "game variable governance.window_role_unseat, description" }),
  },
  "governance.window_power_transfer": {
    label: msg({ message: "When moving a power to a role can go to the vote", context: "game variable governance.window_power_transfer, label" }),
    description: msg({ message: "The window a proposal that moves a power from the admin panel to a role opens in, in the same words as the change set window above.", context: "game variable governance.window_power_transfer, description" }),
  },
  "governance.window_power_grant": {
    label: msg({ message: "When granting a power can go to the vote", context: "game variable governance.window_power_grant, label" }),
    description: msg({ message: "The window a proposal that grants a power to a role opens in, in the same words as the change set window above.", context: "game variable governance.window_power_grant, description" }),
  },
  "governance.window_power_return": {
    label: msg({ message: "When handing a power back can go to the vote", context: "game variable governance.window_power_return, label" }),
    description: msg({ message: "The window a proposal that hands a power back to the admin panel opens in, in the same words as the change set window above.", context: "game variable governance.window_power_return, description" }),
  },
  "governance.window_gps_change": {
    label: msg({ message: "When changing the governing purpose can go to the vote", context: "game variable governance.window_gps_change, label" }),
    description: msg({ message: "The window a proposal that changes this village's governing purpose statement opens in, in the same words as the change set window above. This is the sentence every other change is judged against, so a village that wants it read together is the village most likely to window it.", context: "game variable governance.window_gps_change, description" }),
  },
  "governance.window_grace_days": {
    label: msg({ message: "How long a proposal coming back may open outside its window", context: "game variable governance.window_grace_days, label" }),
    description: msg({ message: "A resubmission after objections, a veto override and a renewal of a trial are all proposals coming back, and the village has already been asked once. Each of them may open outside its kind's window for this many days after the decision it comes back from closed. Set this to 0 and a single steward's veto becomes unanswerable until the next window opens.", context: "game variable governance.window_grace_days, description" }),
  },
  "governance.weight_mode": {
    label: msg({ message: "How voting weight is assigned", context: "game variable governance.weight_mode, label" }),
    description: msg({ message: "What one member's vote weighs on an on-site ballot. Equal gives every eligible member the same single vote. Token weighs votes by each member's balance of the weight token at the moment a ballot opens. Custom weighs votes by the allocation table you keep under Voting weights, where a member with no allocation weighs zero. Whatever you choose, each ballot freezes the weights when it opens, and every allocation change is on a permanent record any member can read.", context: "game variable governance.weight_mode, description" }),
    choices: {
      "equal": {
        label: msg({ message: "One person, one vote", context: "game variable governance.weight_mode, choice equal, label" }),
        hint: msg({ message: "Every eligible member weighs the same.", context: "game variable governance.weight_mode, choice equal, hint" }),
      },
      "token": {
        label: msg({ message: "Token balance", context: "game variable governance.weight_mode, choice token, label" }),
        hint: msg({ message: "Weight is each member's balance of the weight token when the ballot opens.", context: "game variable governance.weight_mode, choice token, hint" }),
      },
      "custom": {
        label: msg({ message: "Custom allocation", context: "game variable governance.weight_mode, choice custom, label" }),
        hint: msg({ message: "Weight comes from the allocation table. No allocation means no weight.", context: "game variable governance.weight_mode, choice custom, hint" }),
      },
    },
  },
  "governance.weight_token": {
    label: msg({ message: "The weight token", context: "game variable governance.weight_token, label" }),
    description: msg({ message: "Which token weighs votes when the weight mode is token. Only tokens this platform itself governs can be chosen: a token governed on Hypha is a display-only mirror here, and a ballot may never make this platform a second source of truth for it. The default is the recognition token, which nobody can buy, so weight in the default posture is earned appreciation.", context: "game variable governance.weight_token, description" }),
  },
  "governance.weight_cap_on": {
    label: msg({ message: "Cap one member's voting weight", context: "game variable governance.weight_cap_on, label" }),
    description: msg({ message: "Turns on a ceiling on how much of the vote any one member carries. It only matters when the weight mode is token, where a member weighs their balance, so one large holder could meet quorum alone or carry a vote. With this on, when a ballot opens no member carries more than the share below of that ballot's vote, and the rest of the vote is shared among everyone else in proportion to what they hold. What it costs: a large holder's balance past the cap stops counting, and on a small roll balances stop counting at all: with fewer than 5 members holding weight at the default 20 (100 divided by the cap), everyone weighs the same. It is off unless you turn it on.", context: "game variable governance.weight_cap_on, description" }),
  },
  "governance.weight_cap_pct": {
    label: msg({ message: "The most voting weight one member can carry", context: "game variable governance.weight_cap_pct, label" }),
    description: msg({ message: "While the cap above is on, the largest share of a ballot's vote that one member can carry. It only matters in token mode, and only with the cap switched on. At 20, a member holding 90 beside four members holding 2.5 each carries a fifth of the vote, the same as each of them, and members under the cap keep their balance in full. With fewer than 5 members holding weight at 20, everyone weighs the same, because five shares of 20 is the least that makes a whole vote. Lower spreads power wider and needs more holders before balances count at all. To have no cap, turn the switch off. This number never does that.", context: "game variable governance.weight_cap_pct, description" }),
  },
  "governance.weight_cap_cash_on": {
    label: msg({ message: "Cap the weight one member counts from cash", context: "game variable governance.weight_cap_cash_on, label" }),
    description: msg({ message: "Turns on a ceiling on how much of one member's weight token balance a ballot counts from cash they put in: Voice from donations, investment, dues, and hand-mints a steward marked as cash. It only matters when the weight mode is token. Nothing is taken from anybody: the balance stays exactly as minted, and only the ballot's count stops at the number below. Raising or lowering it applies from the next ballot that opens. Works with: 'The most weight one member counts from cash'. It is off unless you turn it on.", context: "game variable governance.weight_cap_cash_on, description" }),
  },
  "governance.weight_cap_cash": {
    label: msg({ message: "The most weight one member counts from cash", context: "game variable governance.weight_cap_cash, label" }),
    description: msg({ message: "While the cash cap above is on, the most of one member's balance, in whole tokens, that a ballot counts from cash. A member's balance is split into its cash part and its other part by the share of everything minted to them that came from each, so waning takes from both alike. At 1000, a member holding 3000 that came from cash counts 1000 of it on every ballot, and any part from work or other contributions counts under its own cap. At 0, with the switch on, nothing from cash counts at all, because a cap of zero means zero. To have no cash cap, turn the switch off.", context: "game variable governance.weight_cap_cash, description" }),
  },
  "governance.weight_cap_other_on": {
    label: msg({ message: "Cap the weight one member counts from other contributions", context: "game variable governance.weight_cap_other_on, label" }),
    description: msg({ message: "Turns on a ceiling on how much of one member's weight token balance a ballot counts from everything that is not cash: quests, roles, accepted proposals, and hand-mints marked as something other than cash. A source nobody has classified counts here. It only matters when the weight mode is token. The balance stays exactly as minted, and only the ballot's count stops at the number below. Raising or lowering it applies from the next ballot that opens. Works with: 'The most weight one member counts from other contributions'. It is off unless you turn it on.", context: "game variable governance.weight_cap_other_on, description" }),
  },
  "governance.weight_cap_other": {
    label: msg({ message: "The most weight one member counts from other contributions", context: "game variable governance.weight_cap_other, label" }),
    description: msg({ message: "While the cap above is on, the most of one member's balance, in whole tokens, that a ballot counts from contributions other than cash. With both caps on, the most any one member counts is the two numbers added together. At 0, with the switch on, nothing from other contributions counts, because a cap of zero means zero. To have no cap on other contributions, turn the switch off.", context: "game variable governance.weight_cap_other, description" }),
  },
  "governance.unity_pct": {
    label: msg({ message: "Unity needed to pass", context: "game variable governance.unity_pct, label" }),
    description: msg({ message: "Of the votes cast for or against, the share that must be in favor for a ballot run on the village's own dials to pass. Abstentions help a ballot reach quorum and take no side here. 100 asks for consensus in effect; the Hypha surface this inherits from runs at 80.", context: "game variable governance.unity_pct, description" }),
  },
  "governance.quorum_pct": {
    label: msg({ message: "Quorum needed to count", context: "game variable governance.quorum_pct, label" }),
    description: msg({ message: "The share of the electorate's total voting weight that must show up, counting abstentions, before a ballot's outcome counts at all. Below this the ballot closes as no quorum, whatever the votes said. Each ballot freezes this number when it opens.", context: "game variable governance.quorum_pct, description" }),
  },
  "governance.quorum_fallback": {
    label: msg({ message: "Ask again when too few vote", context: "game variable governance.quorum_fallback, label" }),
    description: msg({ message: "Off by default, and off means a ballot that misses quorum ends there. Turn it on and a ballot that misses quorum opens once more on the same question, for as many days as the first, needing half the quorum. If that one misses too, a simple majority of the votes cast decides it: more yes than no carries it and a tie does not. Only ballots opened after it is switched on are asked again. A steward or an admin may switch it on at any time as a failsafe, and every switch is recorded and announced on the village feed. Switching it off is the village's to decide.", context: "game variable governance.quorum_fallback, description" }),
    choices: {
      "off": {
        label: msg({ message: "Off", context: "game variable governance.quorum_fallback, choice off, label" }),
        hint: msg({ message: "A ballot that misses quorum ends as it closes.", context: "game variable governance.quorum_fallback, choice off, hint" }),
      },
      "on": {
        label: msg({ message: "On", context: "game variable governance.quorum_fallback, choice on, label" }),
        hint: msg({ message: "A ballot that misses quorum is asked again once, at half the quorum.", context: "game variable governance.quorum_fallback, choice on, hint" }),
      },
    },
  },
  "governance.vote_days": {
    label: msg({ message: "How long a ballot stays open", context: "game variable governance.vote_days, label" }),
    description: msg({ message: "Days between a ballot opening and its votes locking. Votes can be changed freely until then. The clock closes the ballot when the window ends and the village's own engine reads the result, so nobody chooses the moment. A change to the Game then waits again, for the window a steward can stop it in.", context: "game variable governance.vote_days, description" }),
  },
  "governance.consent_window_days": {
    label: msg({ message: "How long a consent window stays open", context: "game variable governance.consent_window_days, label" }),
    description: msg({ message: "Days an objection window runs on a consent ballot. A consent decision passes when the window has ended, participation met quorum, and no objection still stands open. Objections are ruled by a facilitator, and every ruling is attributed and explained on the record.", context: "game variable governance.consent_window_days, description" }),
  },
  "governance.default_method": {
    label: msg({ message: "How village-wide ballots decide", context: "game variable governance.default_method, label" }),
    description: msg({ message: "The method a village-wide ballot uses when nothing more specific applies. Your own dials use the unity and quorum settings above. Majority means more than half of the votes cast carries it. Consensus means everyone who takes a side agrees. Consent means a decision passes when nobody sustains a reasoned objection. Hypha keeps the shipped loop: proposals go to your Hypha space for the binding vote.", context: "game variable governance.default_method, description" }),
    choices: {
      "custom": {
        label: msg({ message: "This village's own dials", context: "game variable governance.default_method, choice custom, label" }),
        hint: msg({ message: "Uses the unity and quorum settings above.", context: "game variable governance.default_method, choice custom, hint" }),
      },
      "majority": {
        label: msg({ message: "Majority", context: "game variable governance.default_method, choice majority, label" }),
        hint: msg({ message: "More than half of the votes cast carries it.", context: "game variable governance.default_method, choice majority, hint" }),
      },
      "consensus": {
        label: msg({ message: "Consensus", context: "game variable governance.default_method, choice consensus, label" }),
        hint: msg({ message: "Everyone who takes a side agrees.", context: "game variable governance.default_method, choice consensus, hint" }),
      },
      "consent": {
        label: msg({ message: "Consent", context: "game variable governance.default_method, choice consent, label" }),
        hint: msg({ message: "Passes when no reasoned objection stands.", context: "game variable governance.default_method, choice consent, hint" }),
      },
      "hypha": {
        label: msg({ message: "Decide on Hypha", context: "game variable governance.default_method, choice hypha, label" }),
        hint: msg({ message: "The shipped loop: the binding vote happens in your Hypha space.", context: "game variable governance.default_method, choice hypha, hint" }),
      },
    },
  },
  "governance.tier_routine_quorum_pct": {
    label: msg({ message: "Routine changes: quorum floor", context: "game variable governance.tier_routine_quorum_pct, label" }),
    description: msg({ message: "The least share of the village's voting weight that must turn up before an ordinary change to the Game can be decided. Ordinary means a number the village tunes while it plays. 0 leaves it entirely to your own quorum setting above, which is the shipped posture. Raise it to ask for more attention on every change, however small.", context: "game variable governance.tier_routine_quorum_pct, description" }),
  },
  "governance.tier_routine_unity_pct": {
    label: msg({ message: "Routine changes: unity floor", context: "game variable governance.tier_routine_unity_pct, label" }),
    description: msg({ message: "The least share of the votes cast for or against that must be in favour before an ordinary change to the Game carries. 0 leaves it entirely to your own unity setting above, which is the shipped posture.", context: "game variable governance.tier_routine_unity_pct, description" }),
  },
  "governance.tier_structural_quorum_pct": {
    label: msg({ message: "Structural changes: quorum floor", context: "game variable governance.tier_structural_quorum_pct, label" }),
    description: msg({ message: "The least share of the village's voting weight that must turn up before a structural change can be decided. Structural means it changes how the village decides or who belongs to it: the unity and quorum settings themselves, how ballots decide, who may be admitted, what the village mints, and turning a part of the Game on or off. The shipped 50 is this platform's starting number and your village may raise it. It cannot go below the platform floor.", context: "game variable governance.tier_structural_quorum_pct, description" }),
  },
  "governance.tier_structural_unity_pct": {
    label: msg({ message: "Structural changes: unity floor", context: "game variable governance.tier_structural_unity_pct, label" }),
    description: msg({ message: "The least share of the votes cast for or against that must be in favour before a structural change carries. The shipped 80 is the number this platform inherited from Hypha, and it is a starting point your village may raise. It cannot go below the platform floor.", context: "game variable governance.tier_structural_unity_pct, description" }),
  },
  "governance.tier_constitutional_quorum_pct": {
    label: msg({ message: "Constitutional changes: quorum floor", context: "game variable governance.tier_constitutional_quorum_pct, label" }),
    description: msg({ message: "The least share of the village's voting weight that must turn up before a constitutional change can be decided. Constitutional means it changes the rules for changing the rules: how voting weight is assigned, which token carries weight, and these bars themselves. The shipped number is 97, which leaves room for 3 in 100 to be unreachable on the day. Going higher is allowed and the Game will warn you why it is risky.", context: "game variable governance.tier_constitutional_quorum_pct, description" }),
  },
  "governance.tier_constitutional_unity_pct": {
    label: msg({ message: "Constitutional changes: unity floor", context: "game variable governance.tier_constitutional_unity_pct, label" }),
    description: msg({ message: "The least share of the votes cast for or against that must be in favour before a constitutional change carries. The shipped number is 97. Going higher is allowed and the Game will warn you why it is risky.", context: "game variable governance.tier_constitutional_unity_pct, description" }),
  },
  "governance.highest_tier": {
    label: msg({ message: "The tier a veto override is passed at", context: "game variable governance.highest_tier, label" }),
    description: msg({ message: "A steward can veto a change the village passed. The village can bring the same proposal back and pass it again at this tier, and then it lands whatever any steward says. This names which tier that is: the highest one your village works at. Moving this setting costs whatever the tier it currently names costs, so lowering it is as hard as the bar you are lowering.", context: "game variable governance.highest_tier, description" }),
    choices: {
      "routine": {
        label: msg({ message: "Routine", context: "game variable governance.highest_tier, choice routine, label" }),
        hint: msg({ message: "Your own unity and quorum settings decide an override.", context: "game variable governance.highest_tier, choice routine, hint" }),
      },
      "structural": {
        label: msg({ message: "Structural", context: "game variable governance.highest_tier, choice structural, label" }),
        hint: msg({ message: "An override asks the structural bar: how the village decides.", context: "game variable governance.highest_tier, choice structural, hint" }),
      },
      "constitutional": {
        label: msg({ message: "Constitutional", context: "game variable governance.highest_tier, choice constitutional, label" }),
        hint: msg({ message: "An override asks the highest bar this platform ships.", context: "game variable governance.highest_tier, choice constitutional, hint" }),
      },
    },
  },
  "governance.launch_min_electorate": {
    label: msg({ message: "Yeses it takes to launch", context: "game variable governance.launch_min_electorate, label" }),
    description: msg({ message: "How many of the people the launch asks must say yes for the village to start its Game. The vote cannot open with fewer than this many on its roll, and it carries the moment this many have said yes, unless somebody on the roll has said no. The default is three, and it is never fewer. A founder sets it before the Game starts. After that it moves only by a vote at the highest tier your village works at.", context: "game variable governance.launch_min_electorate, description" }),
  },
  "governance.launch_roll": {
    label: msg({ message: "Who the launch vote asks", context: "game variable governance.launch_roll, label" }),
    description: msg({ message: "Who is on the roll when the village votes to start its Game. Each person on it counts once, and a no from any one of them holds the vote until they change their answer. A founder sets this before the Game starts. After that it moves only by a vote at the highest tier your village works at, which every member answers.", context: "game variable governance.launch_roll, description" }),
    choices: {
      "founders": {
        label: msg({ message: "Founding members", context: "game variable governance.launch_roll, choice founders, label" }),
        hint: msg({ message: "Only members who hold the founder role answer the launch vote.", context: "game variable governance.launch_roll, choice founders, hint" }),
      },
      "members": {
        label: msg({ message: "Every member", context: "game variable governance.launch_roll, choice members, label" }),
        hint: msg({ message: "Every member who holds a voice answers the launch vote.", context: "game variable governance.launch_roll, choice members, hint" }),
      },
    },
  },
  "governance.subject_mint_rule_quorum_pct": {
    label: msg({ message: "Minting rule changes: quorum floor", context: "game variable governance.subject_mint_rule_quorum_pct, label" }),
    description: msg({ message: "The least share of the village's voting weight that must turn up before a change to what the village mints can be decided. This one sits on top of the structural tier, so raising it asks for more attention on minting alone without moving every other structural change with it. Cannot be set below the platform floor.", context: "game variable governance.subject_mint_rule_quorum_pct, description" }),
  },
  "governance.subject_mint_rule_unity_pct": {
    label: msg({ message: "Minting rule changes: unity floor", context: "game variable governance.subject_mint_rule_unity_pct, label" }),
    description: msg({ message: "The least share of the votes cast for or against that must be in favour before a change to what the village mints carries. 0 leaves it to the structural tier and your own unity setting.", context: "game variable governance.subject_mint_rule_unity_pct, description" }),
  },
  "governance.nonhuman_in_quorum": {
    label: msg({ message: "Roles speaking for other beings count toward quorum", context: "game variable governance.nonhuman_in_quorum, label" }),
    description: msg({ message: "Your village can seat a voice for a being that is not a person: a mountain, a river, the trees, the wolves. A member or a bot holds that role and casts its vote. This says whether the weight on such a role is part of the count that decides whether enough of the village turned up. Off, which is how it ships, leaves that weight out of the count on both sides of the sum, and a vote cast from the role still counts toward agreement. On counts it like any member's, and weight that provably cannot answer drops out of the count instead.", context: "game variable governance.nonhuman_in_quorum, description" }),
  },
  "governance.absent_cycles": {
    label: msg({ message: "Cycles of silence before a role leaves the count", context: "game variable governance.absent_cycles, label" }),
    description: msg({ message: "When roles speaking for other beings do count toward quorum, this is how many cycles of casting nothing it takes before such a role's weight drops out of the count. A role nobody holds drops out straight away. The weight is always shown beside the people count, so the village can see how much of its Voice is silent. Nothing here changes a threshold: it changes what the threshold is measured against.", context: "game variable governance.absent_cycles, description" }),
  },
  "tokens.equity_address": {
    label: msg({ message: "Equity token contract address on Base", context: "game variable tokens.equity_address, label" }),
    description: msg({ message: "The ERC-20 address for the project's equity token. The platform only ever READS this balance to display it: minting, pricing and governance all happen on Hypha. Leave blank until the token is deployed and nothing is shown.", context: "game variable tokens.equity_address, description" }),
  },
  "tokens.voice_address": {
    label: msg({ message: "Governance token contract address on Base", context: "game variable tokens.voice_address, label" }),
    description: msg({ message: "The ERC-20 address for the governance-weight token. Read-only here, exactly like the equity token.", context: "game variable tokens.voice_address, description" }),
  },
  "tokens.show_economics_section": {
    label: msg({ message: "Show the economics section", context: "game variable tokens.show_economics_section, label" }),
    description: msg({ message: "Displays token balances and Gratitude flows on member profiles. Turn off while the tokens are still being designed so members are not shown empty charts.", context: "game variable tokens.show_economics_section, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "tokens.base_rpc_url": {
    label: msg({ message: "Base RPC endpoint", context: "game variable tokens.base_rpc_url, label" }),
    description: msg({ message: "Where balances are read from. A public endpoint is fine to start; a dedicated one is more reliable under load. If this fails, the platform shows nothing, never a wrong number. Saved under Admin, Integrations, where it is sealed, because a dedicated endpoint carries its key in the address. The host variable BASE_RPC_URL works too.", context: "game variable tokens.base_rpc_url, description" }),
  },
  "hypha.org_url": {
    label: msg({ message: "Your Hypha DHO address", context: "game variable hypha.org_url, label" }),
    description: msg({ message: "The one place this platform sends people for governance, proposals, treasury and membership on Hypha. Every module derives its deep links from this single value; leaving it blank hides every Hypha button, so nobody meets a dead link.", context: "game variable hypha.org_url, description" }),
  },
  "hypha.space_id": {
    label: msg({ message: "Hypha space id (on-chain)", context: "game variable hypha.space_id, label" }),
    description: msg({ message: "The numeric id of your DAO's space on Hypha's Base contracts. Every on-chain proposal your DAO creates is stamped with it. Found in your Hypha space's URL or from any of its proposals on Basescan. Fill this in and the governance webhook checks it: a delivery that names a different space is refused, even when its signature is good, because one hub watches Base for many villages off one listener and a routing mistake there arrives correctly signed. A delivery that names no space at all is recorded and an operator is told, and a passed one waits for a person to apply it, so an idle check is never read as a passing one. Left blank, nothing can be checked, so every passed vote waits for a person to apply it (after launch, any member can ask the village to decide it).", context: "game variable hypha.space_id, description" }),
  },
  "hypha.treasury_address": {
    label: msg({ message: "DAO treasury address on Base", context: "game variable hypha.treasury_address, label" }),
    description: msg({ message: "The 0x address holding your DAO's treasury on Base. The Hypha Bridge module reads what this address holds of each confirmed token and shows it as a fact about the village. Leave it blank and only total supply is shown. Reading it never moves anything: the platform displays what Base says and links you out to Hypha to act.", context: "game variable hypha.treasury_address, description" }),
  },
  "hypha.founder_base_address": {
    label: msg({ message: "Founder Base account address", context: "game variable hypha.founder_base_address, label" }),
    description: msg({ message: "The 0x address that created your DAO and issued its first tokens on Base. The Hypha Bridge panel reads it to list every token this account holds, so you can confirm which contract is which: issue yourself even a tiny amount of each token on Hypha first, because an issuance is what puts the contract on chain.", context: "game variable hypha.founder_base_address, description" }),
  },
  "hypha.link_governance": {
    label: msg({ message: "Override: governance link", context: "game variable hypha.link_governance, label" }),
    description: msg({ message: "Only if your DHO's governance page is not at the org root. Blank derives from the DHO address.", context: "game variable hypha.link_governance, description" }),
  },
  "hypha.link_proposals": {
    label: msg({ message: "Override: proposals link", context: "game variable hypha.link_proposals, label" }),
    description: msg({ message: "Only if your DHO's proposals page is not at /agreements. Blank derives from the DHO address.", context: "game variable hypha.link_proposals, description" }),
  },
};
