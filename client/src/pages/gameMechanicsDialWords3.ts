/**
 * Part 3 of 3 of the dials' words (gameMechanicsDialWords.ts explains them). Written from shared/gameVariables.ts;
 * gameMechanicsDialWords.test.ts holds every entry to the server's English.
 */
import { msg } from "@lingui/core/macro";
// The runtime as a value the build keeps: precompileEnglish compiles the messages of a file that imports it
// (client/src/i18n/precompileEnglish.ts), and a type-only import is erased before it looks.
export { i18n as dialWordsRuntime3 } from "@lingui/core";
import type { DialWords } from "./gameMechanicsDialWords";

export const DIAL_WORDS_3: Readonly<Record<string, DialWords>> = {
  "feed.show_system_events": {
    label: msg({ message: "Weave the village's own milestones into the feed", context: "game variable feed.show_system_events, label" }),
    description: msg({ message: "On, the feed mixes what the village DID (quests consented, seasons turning, people arriving) in among what people wrote. Off, it is only posts. A young village usually wants this on, because a feed with three posts and no events reads as abandoned.", context: "game variable feed.show_system_events, description" }),
  },
  "feed.max_post_length": {
    label: msg({ message: "How much of a long post the feed shows", context: "game variable feed.max_post_length, label" }),
    description: msg({ message: "Posts longer than this are cut off in the feed with the rest behind the post itself. Nothing is deleted; this only decides how much of a long piece takes over the page.", context: "game variable feed.max_post_length, description" }),
  },
  "feed.heart_amount": {
    label: msg({ message: "Gratitude each heart sends", context: "game variable feed.heart_amount, label" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
    description: msg({ message: "What one tap of appreciation on the feed is worth. A heart is a real send: it comes out of the tapper's own cycle allowance the same way a written acknowledgment does, so a larger heart empties an allowance faster and reaches the per-person share sooner. It will not go above 5, which keeps a tap a small and frequent gesture. Raising it makes every heart heavier and changes nothing about how many a member can leave. Works with: 'Base sending allowance per cycle', 'Share of an allowance any one person can receive', 'Hearts one member can tap for another per cycle', and 'Sending-budget multiplier' under Progression.", context: "game variable feed.heart_amount, description" }),
  },
  "feed.max_hearts_per_recipient_per_cycle": {
    label: msg({ message: "Hearts one member can tap for another per cycle", context: "game variable feed.max_hearts_per_recipient_per_cycle, label" }),
    description: msg({ message: "How many separate taps of appreciation one member can leave for another in a cycle. THE ONLY LIMIT IN THE VILLAGE THAT COUNTS TAPS: every other limit on giving counts Gratitude. Each tap spends the tapper's own cycle allowance, so the real ceiling is whichever runs out first, this count or the share of the allowance any one person can receive. At the stock dials a member can leave 5 hearts worth 1 each, well inside a share of 25. Set it to 1 to make a heart a once-per-cycle gesture; set it high and the share becomes the only thing holding the channel. Works with: 'Base sending allowance per cycle', 'Share of an allowance any one person can receive', 'Gratitude each heart sends', and 'Sending-budget multiplier' under Progression.", context: "game variable feed.max_hearts_per_recipient_per_cycle, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "stay.guest_booking_enabled": {
    label: msg({ message: "Guests can request stays", context: "game variable stay.guest_booking_enabled, label" }),
    description: msg({ message: "When off, only members can request a stay; visitors see the catalog but must join (or write in) first.", context: "game variable stay.guest_booking_enabled, description" }),
  },
  "stay.autopay_default": {
    label: msg({ message: "New stays autopay by default", context: "game variable stay.autopay_default, label" }),
    description: msg({ message: "Whether a newly activated stay burns one credit per night automatically. A guest can have autopay turned off per-stay by an admin (e.g. billing disputes).", context: "game variable stay.autopay_default, description" }),
  },
  "stay.autopay_post_hour": {
    label: msg({ message: "Hour nightly credits post (UTC)", context: "game variable stay.autopay_post_hour, label" }),
    description: msg({ message: "The scheduler posts each active stay's nightly credit once per day at (or after) this hour, UTC. Catch-up is automatic and idempotent if the server slept through a night.", context: "game variable stay.autopay_post_hour, description" }),
  },
  "stay.low_balance_warn_nights": {
    label: msg({ message: "Low-balance warning threshold", context: "game variable stay.low_balance_warn_nights, label" }),
    description: msg({ message: "Notify a guest when their remaining credits cover this many nights or fewer at their current rate.", context: "game variable stay.low_balance_warn_nights, description" }),
  },
  "stay.grace_nights": {
    label: msg({ message: "Grace nights below zero", context: "game variable stay.grace_nights, label" }),
    description: msg({ message: "How many nights a stay may keep posting after the balance hits zero before autopay refuses and admins are alerted. The debt is real and visible: a negative balance, not a hidden tab.", context: "game variable stay.grace_nights, description" }),
  },
  "stay.max_purchase_nights": {
    label: msg({ message: "Most nights purchasable at once", context: "game variable stay.max_purchase_nights, label" }),
    description: msg({ message: "Ceiling on a single credit purchase, counted in nights at the room's posted rate.", context: "game variable stay.max_purchase_nights, description" }),
  },
  "stay.credit_expiry_days": {
    label: msg({ message: "Credit expiry (0 = never)", context: "game variable stay.credit_expiry_days, label" }),
    description: msg({ message: "Days until unspent stay credits expire. 0 means they never expire. Expiry is a policy contract shipped ahead of enforcement: v1 does not yet sweep expired credits.", context: "game variable stay.credit_expiry_days, description" }),
  },
  "stay.credits_transferable": {
    label: msg({ message: "Members can gift credits to each other", context: "game variable stay.credits_transferable, label" }),
    description: msg({ message: "Off by default: credits are personal. Turning this on lets a member transfer credits to another member (a future surface; the token stays non-transferable until then).", context: "game variable stay.credits_transferable, description" }),
  },
  "stay.work_exchange_tag": {
    label: msg({ message: "Work-exchange quest tag", context: "game variable stay.work_exchange_tag, label" }),
    description: msg({ message: "Quests carrying this tag appear on the Stay page as ways to EARN credits. The reward itself lives on each quest (stay-credit reward field).", context: "game variable stay.work_exchange_tag, description" }),
  },
  "exchange.price_change_max_pct": {
    label: msg({ message: "Largest single price change", context: "game variable exchange.price_change_max_pct, label" }),
    description: msg({ message: "How far one posted price may move from the previous one, in percent. Big moves happen in bounded steps, each with its own note, so the price history stays a story, not a cliff. 0 removes the bound.", context: "game variable exchange.price_change_max_pct, description" }),
  },
  "library.intake_award_pct": {
    label: msg({ message: "Intake award, % of appraisal", context: "game variable library.intake_award_pct, label" }),
    description: msg({ message: "What a donor earns, as a share of the item's appraised replacement value. Never above 100: the mint's front door pays at most what the shelf gained.", context: "game variable library.intake_award_pct, description" }),
  },
  "library.intake_member_cycle_cap": {
    label: msg({ message: "Intake credits per member per cycle", context: "game variable library.intake_member_cycle_cap, label" }),
    description: msg({ message: "The most one member can earn from donations in one lunation. Intake is a mint; this is its per-person throttle. 0 disables the cap.", context: "game variable library.intake_member_cycle_cap, description" }),
  },
  "library.intake_dual_signoff_over": {
    label: msg({ message: "Dual sign-off above (appraisal)", context: "game variable library.intake_dual_signoff_over, label" }),
    description: msg({ message: "An item appraised above this needs a SECOND steward's approval before any credits mint. 0 turns the second signature off.", context: "game variable library.intake_dual_signoff_over, description" }),
  },
  "library.escrow_pct": {
    label: msg({ message: "Borrowing escrow, % of value", context: "game variable library.escrow_pct, label" }),
    description: msg({ message: "The deposit locked while an item is out, as a share of its appraised value. Returned at settle, minus wear and damage.", context: "game variable library.escrow_pct, description" }),
  },
  "library.usage_fee_pct": {
    label: msg({ message: "Usage fee per loan, % of value", context: "game variable library.usage_fee_pct, label" }),
    description: msg({ message: "The default wear fee a normal return pays into the library pool, and what a dispute resolves to after its deadline (computed wear, zero damage).", context: "game variable library.usage_fee_pct, description" }),
  },
  "library.loan_days_default": {
    label: msg({ message: "Loan length", context: "game variable library.loan_days_default, label" }),
    description: msg({ message: "Days from pickup to due date.", context: "game variable library.loan_days_default, description" }),
  },
  "library.dispute_deadline_days": {
    label: msg({ message: "Dispute deadline", context: "game variable library.dispute_deadline_days, label" }),
    description: msg({ message: "How long a disputed return may sit before stewards settle it with the default outcome (computed wear, zero damage). A policy contract surfaced in the admin panel; v1 does not auto-settle.", context: "game variable library.dispute_deadline_days, description" }),
  },
  "exchange.swap_spread_bps": {
    label: msg({ message: "The village's share of each swap", context: "game variable exchange.swap_spread_bps, label" }),
    description: msg({ message: "In basis points, so half a percent is expressible (50 = 0.50%). This is a POLICY dial, not the safety mechanism: a swap can never profit the member even at 0, because the amount they hand over always rounds up. At 0 the confirm card reads 'the village keeps nothing on this swap'.", context: "game variable exchange.swap_spread_bps, description" }),
  },
  "exchange.order_expiry_hours": {
    label: msg({ message: "Abandoned card checkouts are released after", context: "game variable exchange.order_expiry_hours, label" }),
    description: msg({ message: "A card purchase reserves an order the moment checkout opens, before the member has paid. If they close the tab, that order stays pending forever, and a pending order blocks BOTH turning the exchange off and letting that member leave the village. This is how long to wait before releasing one. Keep it comfortably above 24 hours: a Stripe checkout session stays payable that long, and releasing an order someone is still paying for would strand their money. 0 disables the release.", context: "game variable exchange.order_expiry_hours, description" }),
  },
  "exchange.swap_fiat_hold_days": {
    label: msg({ message: "Card-bought tokens settle before they can be swapped", context: "game variable exchange.swap_fiat_hold_days, label" }),
    description: msg({ message: "Tokens bought with a card are frozen from swapping for this many days, long enough that a chargeback still finds them in the wallet instead of already converted. 0 disables the hold.", context: "game variable exchange.swap_fiat_hold_days, description" }),
  },
  "exchange.swap_max_receive_per_order": {
    label: msg({ message: "Most a member can receive in one swap", context: "game variable exchange.swap_max_receive_per_order, label" }),
    description: msg({ message: "A ceiling on any single swap, whatever the caps allow across the cycle.", context: "game variable exchange.swap_max_receive_per_order, description" }),
  },
  "payments.purchase_limit_per_order_usd": {
    label: msg({ message: "Largest single purchase (USD)", context: "game variable payments.purchase_limit_per_order_usd, label" }),
    description: msg({ message: "Per-order ceiling across ALL fiat modules: stays, exchange, and anything after them. 0 disables the check.", context: "game variable payments.purchase_limit_per_order_usd, description" }),
  },
  "payments.purchase_limit_30d_usd": {
    label: msg({ message: "30-day purchase limit per member (USD)", context: "game variable payments.purchase_limit_30d_usd, label" }),
    description: msg({ message: "Rolling 30-day ceiling on one member's total fiat purchases, summed across every module. 0 disables the check.", context: "game variable payments.purchase_limit_30d_usd, description" }),
  },
  "payments.purchase_limit_annual_usd": {
    label: msg({ message: "Annual purchase limit per member (USD)", context: "game variable payments.purchase_limit_annual_usd, label" }),
    description: msg({ message: "Rolling 365-day ceiling on one member's total fiat purchases, summed across every module. 0 disables the check.", context: "game variable payments.purchase_limit_annual_usd, description" }),
  },
  "nav.responsive_bar": {
    label: msg({ message: "Fill the phone's bottom bar from where members go", context: "game variable nav.responsive_bar, label" }),
    description: msg({ message: "On, a signed-in member's bottom bar on a phone keeps its fixed places (Home first, the member's path, More last) and fills the two places between with the pages members visit most across the village, plus one place for the page that member visits most on their own phone. Visits are counted per page per day with no person in the count, and the personal place is worked out on the member's own phone and never sent. Off, every member sees the village's fixed bar, as before.", context: "game variable nav.responsive_bar, description" }),
  },
  "nav.popular_slots": {
    label: msg({ message: "Places on the bottom bar for the village's most visited pages", context: "game variable nav.popular_slots, label" }),
    description: msg({ message: "How many of the bar's two changing places go to the pages members visit most across the village, pinned pages included. Home, the member's path and More never move. With the personal place on, it takes the second of the two.", context: "game variable nav.popular_slots, description" }),
  },
  "nav.personal_slot": {
    label: msg({ message: "Keep one bottom bar place for each member's own most visited page", context: "game variable nav.personal_slot, label" }),
    description: msg({ message: "On, one place on the bar shows the page that member visits most, when it is not already on the bar. It is worked out on their own phone from their own visits and changes at most once a day. Off, both changing places go to the village's most visited pages.", context: "game variable nav.personal_slot, description" }),
  },
  "nav.refresh_days": {
    label: msg({ message: "How often the bottom bar's village pages are looked at again", context: "game variable nav.refresh_days, label" }),
    description: msg({ message: "The village's most visited pages are worked out again at most this often, from the visits of the four periods before. Between times the bar stays exactly as it is, so a member's thumb learns where things are.", context: "game variable nav.refresh_days, description" }),
  },
  "nav.swap_margin_pct": {
    label: msg({ message: "How clearly a page must lead before it takes a place on the bottom bar", context: "game variable nav.swap_margin_pct, label" }),
    description: msg({ message: "A page not on the bar replaces one that is only when it was visited this many percent more. Higher keeps the bar steadier; 0 lets the bar follow every small change.", context: "game variable nav.swap_margin_pct, description" }),
  },
  "nav.pinned": {
    label: msg({ message: "Pages the bottom bar always keeps", context: "game variable nav.pinned, label" }),
    description: msg({ message: "Addresses that always take the bar's first places after Home, in this order, whatever the visits say: for example /quests. Separate them with commas or new lines. They count toward the places above.", context: "game variable nav.pinned, description" }),
  },
  "nav.excluded": {
    label: msg({ message: "Pages the bottom bar never shows", context: "game variable nav.excluded, label" }),
    description: msg({ message: "Addresses that never take a place on the bar, for the village or for a member's own place, however often they are visited. Separate them with commas or new lines.", context: "game variable nav.excluded, description" }),
  },
  "village.pulse_max_entries": {
    label: msg({ message: "Village Pulse length", context: "game variable village.pulse_max_entries, label" }),
    description: msg({ message: "How many recent happenings the public activity feed shows. Nothing is deleted; this is how far back the page reaches, not how much the village keeps.", context: "game variable village.pulse_max_entries, description" }),
  },
  "village.satellite_provider": {
    label: msg({ message: "Where the land's satellite picture comes from", context: "game variable village.satellite_provider, label" }),
    description: msg({ message: "Which imagery provider Where the Land Is fetches the village's picture from. A provider that needs a key reads it from Admin, Integrations, where its card appears once it is chosen here. Blank leaves the choice to the host, which may have set one for this deployment. Some providers forbid keeping their pictures, and Where the Land Is says which before anything is fetched.", context: "game variable village.satellite_provider, description" }),
    choices: {
      "": {
        label: msg({ message: "Left to the host", context: "game variable village.satellite_provider, choice (unset), label" }),
        hint: msg({ message: "Reads SATELLITE_PROVIDER on the host. With nothing there either, no picture is fetched and the map draws its own ground.", context: "game variable village.satellite_provider, choice (unset), hint" }),
      },
      "village-upload": {
        label: msg({ message: "The village's own aerial photograph", context: "game variable village.satellite_provider, choice village-upload, label" }),
        hint: msg({ message: "No provider and no key: an admin uploads the picture.", context: "game variable village.satellite_provider, choice village-upload, hint" }),
      },
      "esri-open": {
        label: msg({ message: "Esri World Imagery, no key", context: "game variable village.satellite_provider, choice esri-open, label" }),
        hint: msg({ message: "Kept on the village's own volume.", context: "game variable village.satellite_provider, choice esri-open, hint" }),
      },
      "sentinel2": {
        label: msg({ message: "Copernicus Sentinel-2", context: "game variable village.satellite_provider, choice sentinel2, label" }),
        hint: msg({ message: "Needs the address of a Sentinel-2 WMS service.", context: "game variable village.satellite_provider, choice sentinel2, hint" }),
      },
      "mapbox": {
        label: msg({ message: "Mapbox Static Images", context: "game variable village.satellite_provider, choice mapbox, label" }),
        hint: msg({ message: "Needs a Mapbox token.", context: "game variable village.satellite_provider, choice mapbox, hint" }),
      },
      "google": {
        label: msg({ message: "Google Maps Static", context: "game variable village.satellite_provider, choice google, label" }),
        hint: msg({ message: "Needs a Google Maps Static API key.", context: "game variable village.satellite_provider, choice google, hint" }),
      },
      "esri": {
        label: msg({ message: "Esri World Imagery", context: "game variable village.satellite_provider, choice esri, label" }),
        hint: msg({ message: "Needs an ArcGIS API key.", context: "game variable village.satellite_provider, choice esri, hint" }),
      },
    },
  },
  "village.first_moon_at": {
    label: msg({ message: "The date this village counts Moon 1 from", context: "game variable village.first_moon_at, label" }),
    description: msg({ message: "Leave blank and Moon 1 is the moon your village launched under, which is what almost every village wants. Set a date here to count from a different moon: the moon containing the date you give becomes Moon 1, and every moon after it counts on from there. A date in the future is allowed, and until it arrives your moons are shown with their dates and no number. Moon numbers are a label the platform works out each time it draws a screen, so moving this date renames what people see and changes nothing that has been recorded, settled or paid.", context: "game variable village.first_moon_at, description" }),
  },
  "health.alert_change_pct": {
    label: msg({ message: "Alert when a metric moves this much", context: "game variable health.alert_change_pct, label" }),
    description: msg({ message: "After a lunation closes, any tracked metric that moved more than this against the previous lunation is flagged to the stewards, in either direction, without judging which is good. 0 turns alerts off.", context: "game variable health.alert_change_pct, description" }),
  },
  "library.intake_stall_days": {
    label: msg({ message: "Intake stall alarm", context: "game variable library.intake_stall_days, label" }),
    description: msg({ message: "An item awaiting its second sign-off longer than this many days appears in the stewards' daily digest: the donor already handed it over and is owed credits.", context: "game variable library.intake_stall_days, description" }),
  },
  "badges.max_featured": {
    label: msg({ message: "Featured badges per member", context: "game variable badges.max_featured, label" }),
    description: msg({ message: "How many badges a member may pin to their byline (forum posts, map chips). 0 turns featured chips off everywhere.", context: "game variable badges.max_featured, description" }),
  },
  "platform.feedback_relay": {
    label: msg({ message: "Share bug reports and ideas with the platform team", context: "game variable platform.feedback_relay, label" }),
    description: msg({ message: "A copy of each bug report and idea submitted here reaches the platform team who maintain this software, so fixes and features can ship to every village. Content only, never who said it. Turn it off to keep feedback entirely local. Your admins see all of it in Admin → Feedback either way, and the submission form discloses which is happening. Sharing also needs a hub address in the FEEDBACK_HUB_URL setting on the server. Without one this dial changes nothing, feedback stays local, and the form says so.", context: "game variable platform.feedback_relay, description" }),
  },
  "platform.cosign_cooling_hours": {
    label: msg({ message: "Cooling-off before a key lands with nobody to co-sign", context: "game variable platform.cosign_cooling_hours, label" }),
    description: msg({ message: "After launch, saving a key that touches money, email or the hosting waits for a second admin. A village with only one admin waits this many hours instead, and the steward and founder role holders are told and can decline it in that time.", context: "game variable platform.cosign_cooling_hours, description" }),
  },
  "platform.cosign_expiry_hours": {
    label: msg({ message: "How long a key waits for its co-sign", context: "game variable platform.cosign_expiry_hours, label" }),
    description: msg({ message: "After launch, a key that needs a second admin's co-sign waits this many hours. Unsigned by then, it is dropped and its value wiped, and the admin who asked can save it again.", context: "game variable platform.cosign_expiry_hours, description" }),
  },
  "platform.admin_helper": {
    label: msg({ message: "The guide's helper in Admin", context: "game variable platform.admin_helper, label" }),
    description: msg({ message: "Lets admins ask the village guide for help inside Admin: finding a page or setting, explaining a control, and proposing a settings change that an admin applies with a click. It reads settings, help text and the shape of the org chart only, never applications, proposals, people's details, terms or pay, and it does not help choose people for roles. It turns on by itself once the village connects an AI key: its own Anthropic key, or Sera when the org memory connection is set up. Turn this off to keep it off.", context: "game variable platform.admin_helper, description" }),
  },
  "platform.admin_guide_dock": {
    label: msg({ message: "The guide's dock in Admin", context: "game variable platform.admin_guide_dock, label" }),
    description: msg({ message: "Shows the village guide as one dock beside every Admin screen and on the road to launch, in place of the helper panel and the launch guide. The dock opens wide to talk a change through and closes back to the side, takes speech, offers next steps, and can send a change it drafted to the review page for a person to accept. While this is on, the guide in Admin also answers on a key the platform lends when the village has no key of its own, inside the platform's daily limit. Off keeps the helper panel and the launch guide as they are.", context: "game variable platform.admin_guide_dock, description" }),
  },
  "ops.crash_alert_recipients": {
    label: msg({ message: "Addresses that hear about crashes", context: "game variable ops.crash_alert_recipients, label" }),
    description: msg({ message: "Email addresses that hear about crashes. An admin or founder's address also gets the notice in the app; an address with no account gets the email only. Blank tells every admin and founder. Separate addresses with commas, at most 10. A member's address is skipped, and a list with no address left to reach tells every admin and founder.", context: "game variable ops.crash_alert_recipients, description" }),
  },
  "ops.crash_spread_visitors": {
    label: msg({ message: "Visitors who must hit a crash before it emails", context: "game variable ops.crash_spread_visitors, label" }),
    description: msg({ message: "A browser crash with no frame from this village's own code emails the crash alert list once this many different visitors hit it within the window below. A crash in our own code emails the first time. Every crash is still recorded on Village Health and counted in the daily crash digest.", context: "game variable ops.crash_spread_visitors, description" }),
  },
  "ops.crash_spread_minutes": {
    label: msg({ message: "Window for counting visitors who hit a crash", context: "game variable ops.crash_spread_minutes, label" }),
    description: msg({ message: "How far back the visitors above are counted, in minutes.", context: "game variable ops.crash_spread_minutes, description" }),
  },
  "ops.crash_email_every_hours": {
    label: msg({ message: "Hours between emails about the same crash", context: "game variable ops.crash_email_every_hours, label" }),
    description: msg({ message: "One email per crash in this many hours at most, saying how many times it has happened so far. The crashes in between are counted on Village Health.", context: "game variable ops.crash_email_every_hours, description" }),
  },
  "ops.crash_keep_days": {
    label: msg({ message: "Days browser crash reports are kept", context: "game variable ops.crash_keep_days, label" }),
    description: msg({ message: "Browser crash reports older than this are deleted each day, and a crash nobody has reported since is forgotten with them. They hold no names and no addresses; this keeps the record short.", context: "game variable ops.crash_keep_days, description" }),
  },
  "village.source_url": {
    label: msg({ message: "Where this village shares its own source code", context: "game variable village.source_url, label" }),
    description: msg({ message: "The footer shows a second source link, named for your village, when this is set. Leave it empty if you run the software as published, because the footer already links the public Village OS code. If this village runs a changed version, set it to the https address of your own copy of the code, because the licence says the people who use your village must be able to get it.", context: "game variable village.source_url, description" }),
  },
  "stay.request_daily_cap": {
    label: msg({ message: "Stay requests per member per day", context: "game variable stay.request_daily_cap, label" }),
    description: msg({ message: "How many stay requests one member may open in 24 hours. A cap on requests, not on stays: stewards still decide every activation.", context: "game variable stay.request_daily_cap, description" }),
  },
  "library.reserve_daily_cap": {
    label: msg({ message: "Library reservations per member per day", context: "game variable library.reserve_daily_cap, label" }),
    description: msg({ message: "How many items one member may reserve in 24 hours. Bounds how fast one person can lock shelf items and escrow credits.", context: "game variable library.reserve_daily_cap, description" }),
  },
  "payments.donation_max_usd": {
    label: msg({ message: "Largest checkout donation", context: "game variable payments.donation_max_usd, label" }),
    description: msg({ message: "The ceiling on a single choose-your-amount donation checkout. Anything above it gets a personal conversation instead of a card form.", context: "game variable payments.donation_max_usd, description" }),
  },
  "calendar.year_anchor": {
    label: msg({ message: "The solar event that opens the village year", context: "game variable calendar.year_anchor, label" }),
    description: msg({ message: "The year's first moon begins at the first new moon after this event. Twelve or thirteen moons follow, as the sky gives them, until the first new moon after the next one. Villages in the south often choose the June solstice.", context: "game variable calendar.year_anchor, description" }),
    choices: {
      "december_solstice": {
        label: msg({ message: "December solstice", context: "game variable calendar.year_anchor, choice december_solstice, label" }),
      },
      "march_equinox": {
        label: msg({ message: "March equinox", context: "game variable calendar.year_anchor, choice march_equinox, label" }),
      },
      "june_solstice": {
        label: msg({ message: "June solstice", context: "game variable calendar.year_anchor, choice june_solstice, label" }),
      },
      "september_equinox": {
        label: msg({ message: "September equinox", context: "game variable calendar.year_anchor, choice september_equinox, label" }),
      },
    },
  },
  "calendar.hemisphere": {
    label: msg({ message: "Hemisphere", context: "game variable calendar.hemisphere, label" }),
    description: msg({ message: "Which way the seasons turn. Sets which solstice is the longest day and which the shortest, and rotates the example moon names by six months for a village south of the equator.", context: "game variable calendar.hemisphere, description" }),
    choices: {
      "north": {
        label: msg({ message: "Northern", context: "game variable calendar.hemisphere, choice north, label" }),
      },
      "south": {
        label: msg({ message: "Southern", context: "game variable calendar.hemisphere, choice south, label" }),
      },
    },
  },
  "calendar.cross_quarters": {
    label: msg({ message: "Mark the cross-quarter days", context: "game variable calendar.cross_quarters, label" }),
    description: msg({ message: "Also put the four midpoints between the solstices and equinoxes on the calendar. Off by default; the quarter days themselves are always shown.", context: "game variable calendar.cross_quarters, description" }),
  },
  "calendar.seasons": {
    label: msg({ message: "Your village's own seasons", context: "game variable calendar.seasons, label" }),
    description: msg({ message: "The seasons your village names, each with the day it starts, as Name: MM-DD separated by commas. For example: Planting: 03-01, Harvest: 09-01. A season runs until the next one starts and wraps round the new year, and a name can come back later in the year. Live sessions stamp the season they open in. Leave it blank and the room uses spring, summer, autumn and winter by your hemisphere, or names no season when your land sits in the tropics.", context: "game variable calendar.seasons, description" }),
  },
  "introductions.recipient_daily_cap": {
    label: msg({ message: "Introductions one person receives per day", context: "game variable introductions.recipient_daily_cap, label" }),
    description: msg({ message: "Protects busy people, the map relay's per-recipient brake extended to introductions: the relay's received count and the day's surfaced introductions share one day. A match over the cap is held for the sweep, never dropped.", context: "game variable introductions.recipient_daily_cap, description" }),
  },
  "introductions.match_floor": {
    label: msg({ message: "Match score floor", context: "game variable introductions.match_floor, label" }),
    description: msg({ message: "Nothing scoring under this is ever shown. Few good introductions beat many okay ones; raise it when matches feel thin, lower it for a small village where any bridge helps.", context: "game variable introductions.match_floor, description" }),
  },
  "introductions.opportunity_days": {
    label: msg({ message: "Days an introduction stays open", context: "game variable introductions.opportunity_days, label" }),
    description: msg({ message: "How long both people have to say yes. One gentle reminder after three days; past the window the proposal expires and both intents return to the pool.", context: "game variable introductions.opportunity_days, description" }),
  },
  "introductions.retention_days": {
    label: msg({ message: "Keep match reasoning for", context: "game variable introductions.retention_days, label" }),
    description: msg({ message: "The sweep blanks an introduction's reasoning sentences, and the words of expired intents, once they are older than this. The record that an introduction happened stays. 0 keeps everything forever.", context: "game variable introductions.retention_days, description" }),
  },
  "exit.keep_pct.credit": {
    label: msg({ message: "Share of credits a leaver keeps", context: "game variable exit.keep_pct.credit, label" }),
    description: msg({ message: "The share of each credit token a departing member keeps when their balance is settled. At 100, where this starts, they keep all of it, by the founder's ruling that members keep their tokens, and a member still holding any stays on as a former member when their exit resolves. At 0 the whole balance moves to the account named in 'Where the rest of a settled balance goes'. At 40 they keep forty percent of every credit token they hold and the village receives the other sixty. This counts by KIND and never by token name, so a village that mints its own credits gets the same answer as one running the platform's. The share is worked out in the token's smallest unit and rounded DOWN, so what a leaver keeps plus what the village receives is exactly what they held, to the last unit. Works with: 'Where the rest of a settled balance goes' and 'Days of cooling before a balance settles'. The settle act records the shares it actually applied onto the exit, so a dial moved afterwards never rewrites what happened.", context: "game variable exit.keep_pct.credit, description" }),
  },
  "exit.keep_pct.voice": {
    label: msg({ message: "Share of Voice a leaver keeps", context: "game variable exit.keep_pct.voice, label" }),
    description: msg({ message: "The share of a departing member's Voice that 'What happens to Voice at a departure' is applied to. At 100, where this starts, that is the whole holding, and with keep chosen there, which is where that dial starts, the member keeps all of it. At 0 the whole holding settles to the account named in 'Where the rest of a settled balance goes'. Above 0, the shape of what happens to that share is the other dial's answer: forfeit sends it with everything else, keep leaves it where it is, convert turns it into credits at the rate below. Voice that was earned and Voice that was bought are treated alike, because the ledger holds one balance for both. At forfeit the whole holding moves whatever share you set here.", context: "game variable exit.keep_pct.voice, description" }),
  },
  "exit.keep_pct.recognition": {
    label: msg({ message: "Share of recognition a leaver keeps", context: "game variable exit.keep_pct.recognition, label" }),
    description: msg({ message: "Here so all four kinds of token are visible in one place. Any value above 0 is refused when you save it, and the refusal says why: recognition is a record of what happened between two people, it stays on the village's books whoever leaves, and a share of it is nothing a leaver can hold. Leave it at 0.", context: "game variable exit.keep_pct.recognition, description" }),
  },
  "exit.keep_pct.equity": {
    label: msg({ message: "Share of equity a leaver keeps", context: "game variable exit.keep_pct.equity, label" }),
    description: msg({ message: "The share of each equity token this ledger holds, Earned Equity among them, that a departing member keeps when their balance is settled. At 100, where this starts, they keep all of it, by the founder's ruling that members keep their tokens, and a member still holding any stays on as a former member when their exit resolves. At 0 the whole balance moves to the account named in 'Where the rest of a settled balance goes'. The village's equity on Base under Hypha is outside this dial: this ledger holds no rows of it, so there is nothing of it here to settle.", context: "game variable exit.keep_pct.equity, description" }),
  },
  "exit.remainder_account": {
    label: msg({ message: "Where the rest of a settled balance goes", context: "game variable exit.remainder_account, label" }),
    description: msg({ message: "The account that receives whatever a departing member does not keep. Exit settlement is where it goes today: a holding account nothing spends, so the village can decide later without deciding now. The treasury is an ordinary vault the village spends from. The last two choices change what a number several pages already print MEANS, and each of them says so on itself. The settle act sends every remainder to the account chosen here, one posting per token, and records on the exit which account received it.", context: "game variable exit.remainder_account, description" }),
    choices: {
      "settlement": {
        label: msg({ message: "Held in exit settlement, where it goes today", context: "game variable exit.remainder_account, choice settlement, label" }),
        hint: msg({ message: "Nothing spends it. It is a holding account, and the village decides what becomes of it later.", context: "game variable exit.remainder_account, choice settlement, hint" }),
      },
      "treasury": {
        label: msg({ message: "Into the village treasury, which the village can spend", context: "game variable exit.remainder_account, choice treasury, label" }),
        hint: msg({ message: "An ordinary vault. The treasury has to be funded before it can spend anything, by design, and this funds it.", context: "game variable exit.remainder_account, choice treasury, hint" }),
      },
      "cycle-pool": {
        label: msg({ message: "Back into the pool that pays at each cycle close", context: "game variable exit.remainder_account, choice cycle-pool, label" }),
        hint: msg({ message: "Choosing this makes the supply figures on the Mint panel and in the token document read as 'outstanding' instead of 'released to date'. That is a real change to what those numbers mean. Choose it only if you mean it.", context: "game variable exit.remainder_account, choice cycle-pool, hint" }),
      },
      "burn": {
        label: msg({ message: "Back to the faucet that issued it, so the supply shrinks", context: "game variable exit.remainder_account, choice burn, label" }),
        hint: msg({ message: "Choosing this makes the supply figures on the Mint panel and in the token document read as 'outstanding' instead of 'released to date'. That is a real change to what those numbers mean. Choose it only if you mean it. A token with no faucet has nowhere to go back to, and saving this refuses and names that token.", context: "game variable exit.remainder_account, choice burn, hint" }),
      },
    },
  },
  "exit.cooling_days": {
    label: msg({ message: "Days of cooling before a balance settles", context: "game variable exit.cooling_days, label" }),
    description: msg({ message: "How long after a member opens their exit before an admin may settle their balance. At 0, which is today, the sweep is available the moment the exit is open. Above 0 the settle act refuses until that many days have passed and the refusal names the date. This may never exceed the notice period your published exit policy prints, and saving a longer one is refused with both numbers in the sentence, because that page is the highest-stakes copy on the site. The exits table has carried the notice date since the module shipped and no guard ever read it; this is the dial that gives it meaning. The settle act counts from the day the exit opened, and it never holds a balance past the notice date that member's own exit already carries, so a policy edited afterwards cannot extend a hold somebody was told would end.", context: "game variable exit.cooling_days, description" }),
  },
  "exit.voice_on_exit": {
    label: msg({ message: "What happens to Voice at a departure", context: "game variable exit.voice_on_exit, label" }),
    description: msg({ message: "Voice is the one holding that is also standing in the village, so it gets its own answer. Keep is where this starts, by the founder's ruling of 2026-10-23: the member keeps the share set under 'Share of Voice a leaver keeps', and while they hold any of it their exit resolves with the account kept, as a former member. Forfeit sends the share with everything else, which is what a departure did before that ruling. Convert needs a rate under it and a share of Voice the leaver keeps, because only that share converts, so convert with a rate of 0 or a share of 0 is refused. Works with: 'Share of Voice a leaver keeps' and 'Credits per Voice when converting'.", context: "game variable exit.voice_on_exit, description" }),
    choices: {
      "forfeit": {
        label: msg({ message: "It goes with everything else", context: "game variable exit.voice_on_exit, choice forfeit, label" }),
        hint: msg({ message: "The share settles to the account above, which is what a departure did before the ruling of 2026-10-23.", context: "game variable exit.voice_on_exit, choice forfeit, hint" }),
      },
      "keep": {
        label: msg({ message: "The member keeps it", context: "game variable exit.voice_on_exit, choice keep, label" }),
        hint: msg({ message: "Where this starts. The Voice stays in their account, and the account stays on as a former member while it holds anything of value.", context: "game variable exit.voice_on_exit, choice keep, hint" }),
      },
      "convert": {
        label: msg({ message: "It becomes credits", context: "game variable exit.voice_on_exit, choice convert, label" }),
        hint: msg({ message: "Posted as one pair, so a half-finished conversion cannot leave somebody holding neither. The credits come out of the treasury, which has to hold enough of them or the conversion is refused whole. Set the rate below it.", context: "game variable exit.voice_on_exit, choice convert, hint" }),
      },
    },
  },
  "exit.voice_convert_rate": {
    label: msg({ message: "Credits per Voice when converting", context: "game variable exit.voice_convert_rate, label" }),
    description: msg({ message: "How many credits one Voice becomes when 'What happens to Voice at a departure' is set to convert. A rate of 0 with convert chosen is refused when you save it, because a conversion that pays nothing is a forfeit wearing another word. This is read in the convert case alone, so it sits at 0 while the other dial says forfeit. The credits are worked out in the smallest unit of both tokens and rounded DOWN, and a rate too small to pay a single unit converts nothing and says so.", context: "game variable exit.voice_convert_rate, description" }),
  },
  "exit.vote_over": {
    label: msg({ message: "Value above which a departure needs the village to agree", context: "game variable exit.vote_over, label" }),
    description: msg({ message: "Measured in the token the village already prices things in, the one chosen under 'Which token the pool pays'. 0 means never, which is today: no departure asks anybody. Above 0, a settlement worth more than this would go to the village before it moved. The ballot subject that would carry such a vote belongs to governance and is not built, so this reads 0 in every village until it is, and the test run says as much in plain words.", context: "game variable exit.vote_over, description" }),
  },
  "exit.sellback_enabled": {
    label: msg({ message: "A leaver may sell kept credits back to the village", context: "game variable exit.sellback_enabled, label" }),
    description: msg({ message: "Whether a departing member can sell the credits they keep back at the price the exchange posts. Off is today, and off is the whole of what the code can do: the exchange buys in one direction only, the send path allows credit-kind tokens between members alone, and no path anywhere pays fiat or treasury value out to a member. Turning this on records what the village intends and opens nothing on its own.", context: "game variable exit.sellback_enabled, description" }),
  },
  "needs.totality_target_pct": {
    label: msg({ message: "Share of its members' needs this village aims to meet", context: "game variable needs.totality_target_pct, label" }),
    description: msg({ message: "What the village is reaching for, taken over every need it has adopted and every member it is designing for. This figure is DESCRIPTIVE. It sizes nothing, budgets nothing and gates nothing: no pool, no allowance, no payout and no launch check reads it, and none is meant to. It is here so a village can say the number out loud, see it on the test run, and be told when what it has built falls short of it. Ten percent is a good neighbour. A hundred percent is a whole world and needs a whole economy behind it. 0 means nobody has said yet, and the test run says exactly that. This is one of four figures a village is meant to settle before it launches and then leave alone; no code freezes it today, so that is a discipline the village keeps and not a lock the platform applies.", context: "game variable needs.totality_target_pct, description" }),
  },
  "needs.default_depth_target": {
    label: msg({ message: "Rung a need aims for when nobody said otherwise", context: "game variable needs.default_depth_target, label" }),
    description: msg({ message: "The depth a need starts at when the village adopts it without choosing one. The ladder runs Deprived, Unmet, Alive, Satisfied, Thriving, lowest first, and most villages aim at Satisfied across the board and reach for Thriving on two or three. Every need can be moved on its own afterwards; this is only where it starts. The scope editor reads this: a need adopted without a rung is written at whatever this says, and a need adopted WITH one keeps the rung that was named.", context: "game variable needs.default_depth_target, description" }),
    choices: {
      "deprived": {
        label: msg({ message: "Deprived", context: "game variable needs.default_depth_target, choice deprived, label" }),
      },
      "unmet": {
        label: msg({ message: "Unmet", context: "game variable needs.default_depth_target, choice unmet, label" }),
      },
      "alive": {
        label: msg({ message: "Alive", context: "game variable needs.default_depth_target, choice alive, label" }),
      },
      "satisfied": {
        label: msg({ message: "Satisfied", context: "game variable needs.default_depth_target, choice satisfied, label" }),
      },
      "thriving": {
        label: msg({ message: "Thriving", context: "game variable needs.default_depth_target, choice thriving, label" }),
      },
    },
  },
  "needs.default_breadth_pct": {
    label: msg({ message: "Share of members a need aims to reach when nobody said otherwise", context: "game variable needs.default_breadth_pct, label" }),
    description: msg({ message: "How much of the village a need is meant to cover when it is adopted without a figure. 100 means everybody, which is where the platform starts and what the scope editor writes until this moves. Lower it where the village is being honest that a need is met for some and unmet for others. Whole percents only, because the scope table refuses a fraction by name. Every need can be moved on its own afterwards.", context: "game variable needs.default_breadth_pct, description" }),
  },
  "needs.aggregate_floor": {
    label: msg({ message: "Smallest count of members that may be shown", context: "game variable needs.aggregate_floor, label" }),
    description: msg({ message: "The smallest number of answers on one need that may appear as a count anywhere in the village. Below it the counts are withheld, and a need the village never adopted is left off the list entirely, so one member's answer cannot put a need only they named in front of everybody. 3 is where the platform starts, and the member's own needs card prints this number into the sentence that says when a count appears. What the floor does is keep a small count out of casual reading. It cannot stop inference: anyone who already knows how the other members answered on a need can subtract those answers from the total and learn the rest, so at a floor of 3, knowing two answers is enough to learn the third. Raise it where members know enough of each other's answers for that to matter.", context: "game variable needs.aggregate_floor, description" }),
  },
  "needs.launch_requirement": {
    label: msg({ message: "Whether naming the village's needs target is asked before launch", context: "game variable needs.launch_requirement, label" }),
    description: msg({ message: "Whether the launch checklist asks a village to name its needs and its target before the launch vote opens. Recommended puts it on the list beside the items a member will feel the absence of, and the vote still opens. There is deliberately no blocking choice: a village that has not named a needs target may still start its Game, and a platform that held the launch over an unanswered target would be the platform deciding what the village needs. What the village is for is a separate question, and it does block: the governing purpose statement is its own row on the launch checklist, and the vote waits for it. Nothing reads this dial until the launch check names it.", context: "game variable needs.launch_requirement, description" }),
    choices: {
      "recommended": {
        label: msg({ message: "Ask for it, and let the vote open anyway", context: "game variable needs.launch_requirement, choice recommended, label" }),
      },
      "none": {
        label: msg({ message: "Do not ask", context: "game variable needs.launch_requirement, choice none, label" }),
      },
    },
  },
  "journal.pulse_floor": {
    label: msg({ message: "Members who must answer before a pulse average shows", context: "game variable journal.pulse_floor, label" }),
    description: msg({ message: "How many different members must answer a pulse question in a week before anybody sees that week's average for it. The default is 1, by ruling: a small team still sees its own pulse, and the privacy the village keeps lives in how feedback is written and delivered. Raise it when members know enough of each other's answers that a small average would point at a person. A floor keeps a small count out of casual reading and cannot stop subtraction: somebody who knows how all but one person answered can still read the last answer off the average. Only numbers are ever shown. The words a member writes in the pulse stay in their own journal.", context: "game variable journal.pulse_floor, description" }),
  },
  "hiddenmap.unlock_pins": {
    label: msg({ message: "Vouched pins that open the whole map", context: "game variable hiddenmap.unlock_pins, label" }),
    description: msg({ message: "How many of a member's own planting pins must be vouched for by somebody else before they see every pin on the hidden map. Until then they see only their own. Once a member's map has opened it stays open, so raising this later only asks more of members who have not opened yet. Zero opens the map to every member who can see the module.", context: "game variable hiddenmap.unlock_pins, description" }),
  },
  "hiddenmap.vouches_per_pin": {
    label: msg({ message: "Vouches one pin needs before it counts", context: "game variable hiddenmap.vouches_per_pin, label" }),
    description: msg({ message: "How many different members must vouch that a pin is real before it counts toward its owner opening the map. A vouch comes from a member whose own map has opened, or from a keeper of the hidden map while nobody has opened yet.", context: "game variable hiddenmap.vouches_per_pin, description" }),
  },
  "hiddenmap.default_precision": {
    label: msg({ message: "How exactly a new pin is shown beyond the open members", context: "game variable hiddenmap.default_precision, label" }),
    description: msg({ message: "The starting choice when a member logs a pin. It decides the finest place anybody outside the open members is ever shown: a downloaded copy at a coarser setting, and the dots a member sees before their map opens when that is switched on. Members whose map has opened always see the exact place. The member can change it on each pin.", context: "game variable hiddenmap.default_precision, description" }),
    choices: {
      "region": {
        label: msg({ message: "Region, about 50 km", context: "game variable hiddenmap.default_precision, choice region, label" }),
        hint: msg({ message: "The safest. A dot says which part of the country, and nothing nearer.", context: "game variable hiddenmap.default_precision, choice region, hint" }),
      },
      "km": {
        label: msg({ message: "About 1 km", context: "game variable hiddenmap.default_precision, choice km, label" }),
        hint: msg({ message: "Close enough to find the area, too coarse to find the spot.", context: "game variable hiddenmap.default_precision, choice km, hint" }),
      },
      "exact": {
        label: msg({ message: "Exact", context: "game variable hiddenmap.default_precision, choice exact, label" }),
        hint: msg({ message: "Only for places that are safe to be found.", context: "game variable hiddenmap.default_precision, choice exact, hint" }),
      },
    },
  },
  "hiddenmap.teaser": {
    label: msg({ message: "Show dots to members whose map has not opened", context: "game variable hiddenmap.teaser, label" }),
    description: msg({ message: "When on, a member who has not opened the map yet sees every other pin as a plain dot, no finer than about 1 km and never finer than the pin's own setting, with no words, photos or stage. When off, they see their own pins and nothing else about anybody's.", context: "game variable hiddenmap.teaser, description" }),
  },
  "hiddenmap.basemap": {
    label: msg({ message: "What the hidden map is drawn on", context: "game variable hiddenmap.basemap, label" }),
    description: msg({ message: "The picture under the pins. Tiles load on each member's own phone from the provider named here, with its credit always on screen, and nothing is stored on the village's server. The provider can see which squares of the world a phone asked for, which is why the zoom below is capped. A grid draws no picture at all and sends nothing anywhere.", context: "game variable hiddenmap.basemap, description" }),
    choices: {
      "none": {
        label: msg({ message: "A grid of latitude and longitude", context: "game variable hiddenmap.basemap, choice none, label" }),
        hint: msg({ message: "Nothing leaves the phone. No coastline, roads or names.", context: "game variable hiddenmap.basemap, choice none, hint" }),
      },
      "osm": {
        label: msg({ message: "OpenStreetMap", context: "game variable hiddenmap.basemap, choice osm, label" }),
        hint: msg({ message: "Roads, places and names, drawn by volunteers. Free for light use with the credit shown.", context: "game variable hiddenmap.basemap, choice osm, hint" }),
      },
      "esri-imagery": {
        label: msg({ message: "Satellite imagery from Esri", context: "game variable hiddenmap.basemap, choice esri-imagery, label" }),
        hint: msg({ message: "Photographs from above. Free to view with the credit shown.", context: "game variable hiddenmap.basemap, choice esri-imagery, hint" }),
      },
    },
  },
  "hiddenmap.basemap_max_zoom": {
    label: msg({ message: "Closest the picture under the pins will zoom", context: "game variable hiddenmap.basemap_max_zoom, label" }),
    description: msg({ message: "The deepest zoom at which tiles are asked for. At 13 one tile covers about 5 km, so the provider learns only which 5 km square a member looked at. Pins are still drawn exactly where they are for members who may see them.", context: "game variable hiddenmap.basemap_max_zoom, description" }),
  },
  "hiddenmap.access_log_days": {
    label: msg({ message: "Days the record of who looked is kept", context: "game variable hiddenmap.access_log_days, label" }),
    description: msg({ message: "Every read of the shared map, every vouch and every copy taken is recorded with who and when, and never where. Rows older than this are deleted.", context: "game variable hiddenmap.access_log_days, description" }),
  },
  "hiddenmap.export_hours": {
    label: msg({ message: "Hours a second member has to approve a copy of the map", context: "game variable hiddenmap.export_hours, label" }),
    description: msg({ message: "A copy of the hidden map takes two members: one asks, a different one who may approve says yes. After this many hours an unanswered ask expires, and an approved copy the asker has not downloaded expires too.", context: "game variable hiddenmap.export_hours, description" }),
  },
  "hiddenmap.visit_pay_days": {
    label: msg({ message: "Days between paid return visits to the same pin", context: "game variable hiddenmap.visit_pay_days, label" }),
    description: msg({ message: "When the village names a quest for return visits, a member's visit to the same pin opens a new claim at most this often, so one tree is visited for its story and never farmed.", context: "game variable hiddenmap.visit_pay_days, description" }),
  },
  "hiddenmap.paid_plantings_per_week": {
    label: msg({ message: "Vouched plantings paid per member each week", context: "game variable hiddenmap.paid_plantings_per_week, label" }),
    description: msg({ message: "When the village names a planting quest, how many of one member's vouched plantings open a claim in any seven days. A paid planting also needs a photo and two members vouching for it, whatever the vouches setting above says. More plantings wait and open in a later week. 0 pays none.", context: "game variable hiddenmap.paid_plantings_per_week, description" }),
  },
  "hiddenmap.photo_max_mb": {
    label: msg({ message: "Largest photo a member may add to a pin", context: "game variable hiddenmap.photo_max_mb, label" }),
    description: msg({ message: "The largest single photo, before it is shrunk and every hidden detail in it is removed.", context: "game variable hiddenmap.photo_max_mb, description" }),
  },
  "memberTasks.listDefault": {
    label: msg({ message: "Every member has a task board unless a steward turns one off", context: "game variable memberTasks.listDefault, label" }),
    description: msg({ message: "When on, every member has a task board on their profile unless a steward turns theirs off, and a member linked to Organisational Memory has their tasks brought in. When off, a board stays off until a steward turns it on for that member, which is how boards worked before.", context: "game variable memberTasks.listDefault, description" }),
  },
  "agents.lead_approved_writes": {
    label: msg({ message: "Our agent may make the changes we approve in the chat", context: "game variable agents.lead_approved_writes, label" }),
    description: msg({ message: "When on, the village connector, acting for the person who connected it, may write a role's words, draft the wording of its terms, seat and unseat a person, and change the village's own wording, each time a person has approved it in the chat. Every seating names who approved it and quotes the approval, and every admin and founder is told. Pay, money, erasure, secrets, agent accounts and powers stay a person's act. It is on by default because it opens nothing by itself: the list of paths the agent may use is still edited only by a person, and every write still needs the approval note from the person in the chat. Off, the connector does only what it did before.", context: "game variable agents.lead_approved_writes, description" }),
  },
  "sessions.place_line": {
    label: msg({ message: "The place line read at drop in", context: "game variable sessions.place_line, label" }),
    description: msg({ message: "One line the facilitator reads out as a live session begins, to honour the land and the place the village meets on. Write it in your village's own words, the way you would say it aloud: whose land this is, what grows here, what the place asks of the people on it. Each session keeps the line it opened with. Leave it blank and the room offers a short neutral sentence instead.", context: "game variable sessions.place_line, description" }),
  },
  "sessions.default_minutes": {
    label: msg({ message: "How long a live session runs unless its opener says otherwise", context: "game variable sessions.default_minutes, label" }),
    description: msg({ message: "The length a new live session starts with when whoever opens it names none. The room compares its agenda against this, and warns when the items ask for more time than the session has left. The opener can always choose another length between 10 and 480 minutes for one session.", context: "game variable sessions.default_minutes, description" }),
  },
  "progression.multiplier.visitor": {
    label: msg({ message: "Sending-budget multiplier: Visitor", context: "game variable progression.multiplier.visitor, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Visitor stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.visitor, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.guest": {
    label: msg({ message: "Sending-budget multiplier: Guest", context: "game variable progression.multiplier.guest, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Guest stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.guest, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.immersant": {
    label: msg({ message: "Sending-budget multiplier: Immersant", context: "game variable progression.multiplier.immersant, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Immersant stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.immersant, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.participant": {
    label: msg({ message: "Sending-budget multiplier: Participant", context: "game variable progression.multiplier.participant, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Participant stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.participant, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.member": {
    label: msg({ message: "Sending-budget multiplier: Member", context: "game variable progression.multiplier.member, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Member stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.member, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.contributor": {
    label: msg({ message: "Sending-budget multiplier: Contributor", context: "game variable progression.multiplier.contributor, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Contributor stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.contributor, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.quest-seeker": {
    label: msg({ message: "Sending-budget multiplier: Quest Seeker", context: "game variable progression.multiplier.quest-seeker, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Quest Seeker stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.quest-seeker, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.initiate": {
    label: msg({ message: "Sending-budget multiplier: Initiate", context: "game variable progression.multiplier.initiate, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Initiate stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.initiate, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.co-creator": {
    label: msg({ message: "Sending-budget multiplier: Co-Creator", context: "game variable progression.multiplier.co-creator, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Co-Creator stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.co-creator, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.role-holder": {
    label: msg({ message: "Sending-budget multiplier: Role Holder", context: "game variable progression.multiplier.role-holder, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Role Holder stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.role-holder, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.guide": {
    label: msg({ message: "Sending-budget multiplier: Guide", context: "game variable progression.multiplier.guide, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Guide stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.guide, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.multiplier.sage": {
    label: msg({ message: "Sending-budget multiplier: Sage", context: "game variable progression.multiplier.sage, label" }),
    description: msg({ message: "Multiplies the base Gratitude sending allowance for members at the Sage stage, so a member here gives this many times 'Base sending allowance per cycle' each cycle. Set it to 0 and members at this stage cannot send yet. It moves the per-person ceiling too, because that is a share of the allowance this produces. Works with: 'Base sending allowance per cycle' and 'Share of an allowance any one person can receive', both under Gratitude.", context: "game variable progression.multiplier.sage, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "progression.quests_for.quest-seeker": {
    label: msg({ message: "Consented quests to reach Quest Seeker", context: "game variable progression.quests_for.quest-seeker, label" }),
    description: msg({ message: "How many consented quests advance a member to the Quest Seeker stage. Raising it never demotes anyone retroactively on its own: stages are recomputed from live counts.", context: "game variable progression.quests_for.quest-seeker, description" }),
  },
  "progression.unlock.forum.post": {
    label: msg({ message: "Stage that unlocks: forum.post", context: "game variable progression.unlock.forum.post, label" }),
    description: msg({ message: "Which rung of the ladder grants \"forum.post\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.forum.post, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.forum.post, choice none, label" }),
      },
    },
  },
  "progression.unlock.proposal.open": {
    label: msg({ message: "Stage that unlocks: proposal.open", context: "game variable progression.unlock.proposal.open, label" }),
    description: msg({ message: "Which rung of the ladder grants \"proposal.open\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.proposal.open, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.proposal.open, choice none, label" }),
      },
    },
  },
  "progression.unlock.map.viewPeople": {
    label: msg({ message: "Stage that unlocks: map.viewPeople", context: "game variable progression.unlock.map.viewPeople, label" }),
    description: msg({ message: "Which rung of the ladder grants \"map.viewPeople\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.map.viewPeople, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.map.viewPeople, choice none, label" }),
      },
    },
  },
  "progression.unlock.terms.read": {
    label: msg({ message: "Stage that unlocks: terms.read", context: "game variable progression.unlock.terms.read, label" }),
    description: msg({ message: "Which rung of the ladder grants \"terms.read\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.terms.read, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.terms.read, choice none, label" }),
      },
    },
  },
  "progression.unlock.map.contact": {
    label: msg({ message: "Stage that unlocks: map.contact", context: "game variable progression.unlock.map.contact, label" }),
    description: msg({ message: "Which rung of the ladder grants \"map.contact\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.map.contact, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.map.contact, choice none, label" }),
      },
    },
  },
  "progression.unlock.stay.member_rate": {
    label: msg({ message: "Stage that unlocks: stay.member_rate", context: "game variable progression.unlock.stay.member_rate, label" }),
    description: msg({ message: "Which rung of the ladder grants \"stay.member_rate\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.stay.member_rate, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.stay.member_rate, choice none, label" }),
      },
    },
  },
  "progression.unlock.message.send": {
    label: msg({ message: "Stage that unlocks: message.send", context: "game variable progression.unlock.message.send, label" }),
    description: msg({ message: "Which rung of the ladder grants \"message.send\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.message.send, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.message.send, choice none, label" }),
      },
    },
  },
  "progression.unlock.exchange.buy": {
    label: msg({ message: "Stage that unlocks: exchange.buy", context: "game variable progression.unlock.exchange.buy, label" }),
    description: msg({ message: "Which rung of the ladder grants \"exchange.buy\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.exchange.buy, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.exchange.buy, choice none, label" }),
      },
    },
  },
  "progression.unlock.exchange.swap": {
    label: msg({ message: "Stage that unlocks: exchange.swap", context: "game variable progression.unlock.exchange.swap, label" }),
    description: msg({ message: "Which rung of the ladder grants \"exchange.swap\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.exchange.swap, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.exchange.swap, choice none, label" }),
      },
    },
  },
  "progression.unlock.mechanics.propose": {
    label: msg({ message: "Stage that unlocks: mechanics.propose", context: "game variable progression.unlock.mechanics.propose, label" }),
    description: msg({ message: "Which rung of the ladder grants \"mechanics.propose\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.mechanics.propose, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.mechanics.propose, choice none, label" }),
      },
    },
  },
  "progression.unlock.event.rsvp": {
    label: msg({ message: "Stage that unlocks: event.rsvp", context: "game variable progression.unlock.event.rsvp, label" }),
    description: msg({ message: "Which rung of the ladder grants \"event.rsvp\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.event.rsvp, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.event.rsvp, choice none, label" }),
      },
    },
  },
  "progression.unlock.ballot.vote": {
    label: msg({ message: "Stage that unlocks: ballot.vote", context: "game variable progression.unlock.ballot.vote, label" }),
    description: msg({ message: "Which rung of the ladder grants \"ballot.vote\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.ballot.vote, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.ballot.vote, choice none, label" }),
      },
    },
  },
  "progression.unlock.member.vouch": {
    label: msg({ message: "Stage that unlocks: member.vouch", context: "game variable progression.unlock.member.vouch, label" }),
    description: msg({ message: "Which rung of the ladder grants \"member.vouch\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.member.vouch, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.member.vouch, choice none, label" }),
      },
    },
  },
  "progression.unlock.map.photograph": {
    label: msg({ message: "Stage that unlocks: map.photograph", context: "game variable progression.unlock.map.photograph, label" }),
    description: msg({ message: "Which rung of the ladder grants \"map.photograph\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.map.photograph, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.map.photograph, choice none, label" }),
      },
    },
  },
  "progression.unlock.session.template": {
    label: msg({ message: "Stage that unlocks: session.template", context: "game variable progression.unlock.session.template, label" }),
    description: msg({ message: "Which rung of the ladder grants \"session.template\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.session.template, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.session.template, choice none, label" }),
      },
    },
  },
  "progression.unlock.companion.use": {
    label: msg({ message: "Stage that unlocks: companion.use", context: "game variable progression.unlock.companion.use, label" }),
    description: msg({ message: "Which rung of the ladder grants \"companion.use\" by progression alone. Roles and badges can still grant it at any stage; \"never by stage\" makes it role/badge-only. This is the constitution's parameter table, so move rungs deliberately.", context: "game variable progression.unlock.companion.use, description" }),
    choices: {
      "none": {
        label: msg({ message: "Never by stage (role or badge only)", context: "game variable progression.unlock.companion.use, choice none, label" }),
      },
    },
  },
  "village.default_locale": {
    label: msg({ message: "Default language", context: "game variable village.default_locale, label" }),
    description: msg({ message: "The language a visitor sees when their browser asks for none this village offers. A member who picks a language keeps it, and a browser set to a language on offer gets that one first.", context: "game variable village.default_locale, description" }),
  },
  "village.offer_locale.es": {
    label: msg({ message: "Offer Español", context: "game variable village.offer_locale.es, label" }),
    description: msg({ message: "Whether visitors and members can read this village in Español. Off removes it from the language picker; anyone who had chosen it reads the village's default language instead.", context: "game variable village.offer_locale.es, description" }),
  },
};
