/**
 * Part 2 of 3 of the dials' words (gameMechanicsDialWords.ts explains them). Written from shared/gameVariables.ts;
 * gameMechanicsDialWords.test.ts holds every entry to the server's English.
 */
import { msg } from "@lingui/core/macro";
// The runtime as a value the build keeps: precompileEnglish compiles the messages of a file that imports it
// (client/src/i18n/precompileEnglish.ts), and a type-only import is erased before it looks.
export { i18n as dialWordsRuntime2 } from "@lingui/core";
import type { DialWords } from "./gameMechanicsDialWords";

export const DIAL_WORDS_2: Readonly<Record<string, DialWords>> = {
  "hypha.link_treasury": {
    label: msg({ message: "Override: treasury link", context: "game variable hypha.link_treasury, label" }),
    description: msg({ message: "Only if your DHO's treasury page is not at /treasury. Blank derives from the DHO address.", context: "game variable hypha.link_treasury, description" }),
  },
  "hypha.link_members": {
    label: msg({ message: "Override: members link", context: "game variable hypha.link_members, label" }),
    description: msg({ message: "Only if your DHO's members page is not at /members. Blank derives from the DHO address.", context: "game variable hypha.link_members, description" }),
  },
  "tools.click_tracking": {
    label: msg({ message: "Count tool opens", context: "game variable tools.click_tracking, label" }),
    description: msg({ message: "When on, opening a tool records an anonymous-friendly click row (member id attached only for signed-in members) so admins can see which tools the village actually uses. Turning it off records nothing, a village-level privacy choice.", context: "game variable tools.click_tracking, description" }),
  },
  "tools.link_check_days": {
    label: msg({ message: "Days between automatic link checks", context: "game variable tools.link_check_days, label" }),
    description: msg({ message: "0 means manual-only: admins run 'Check links now' from the Tools tab. A cadence takes effect once the platform scheduler ships (v3 S16); setting it earlier is harmless and remembered.", context: "game variable tools.link_check_days, description" }),
  },
  "auth.session_days": {
    label: msg({ message: "Signed-in session length", context: "game variable auth.session_days, label" }),
    description: msg({ message: "How long a sign-in lasts before the member has to sign in again. Applies to sessions started AFTER a change: existing sessions keep the length they were minted with. Shorter is safer on shared devices; longer is kinder on personal phones.", context: "game variable auth.session_days, description" }),
  },
  "notify.daily_email_cap": {
    label: msg({ message: "Most emails one member receives per day", context: "game variable notify.daily_email_cap, label" }),
    description: msg({ message: "Over this many notification emails in a rolling 24 hours, further ones stay in-app only (the notification itself is never lost; only the email is skipped). A ceiling on noisy days, not a quota: raise it for a large, busy village.", context: "game variable notify.daily_email_cap, description" }),
  },
  "comms.quiet_start_hour": {
    label: msg({ message: "Earliest hour a path email is sent", context: "game variable comms.quiet_start_hour, label" }),
    description: msg({ message: "Path, welcome and joining emails wait for this hour in the reader's own time zone, or the village's when theirs is unknown. Gathering reminders follow the gathering's own clock and are not held.", context: "game variable comms.quiet_start_hour, description" }),
  },
  "comms.quiet_end_hour": {
    label: msg({ message: "Latest hour a path email is sent", context: "game variable comms.quiet_end_hour, label" }),
    description: msg({ message: "From this hour in the reader's own time zone, a path, welcome or joining email waits for the next morning. Keep it later than the earliest hour.", context: "game variable comms.quiet_end_hour, description" }),
  },
  "comms.daily_cap": {
    label: msg({ message: "Most automated emails one person receives per day", context: "game variable comms.daily_cap, label" }),
    description: msg({ message: "Counts path emails and letters to one person in a rolling 24 hours. Over it, the next one waits for the following window and is never dropped. Gathering reminders, notices and the emails a person asked for do not count.", context: "game variable comms.daily_cap, description" }),
  },
  "comms.event_reminder_minutes": {
    label: msg({ message: "When gathering reminders go out", context: "game variable comms.event_reminder_minutes, label" }),
    description: msg({ message: "Minutes before a gathering starts, separated by commas. The default sends one a day before and one two hours before. Leave it empty to send none, unless a gathering sets its own.", context: "game variable comms.event_reminder_minutes, description" }),
  },
  "comms.host_nudge_minutes": {
    label: msg({ message: "When a host is asked for the recap", context: "game variable comms.host_nudge_minutes, label" }),
    description: msg({ message: "Minutes after a gathering ends before its host is asked to write the recap. Nobody is asked when nobody said yes, or when the recap has already gone.", context: "game variable comms.host_nudge_minutes, description" }),
  },
  "comms.recap_window_days": {
    label: msg({ message: "How long a recap can still be sent", context: "game variable comms.recap_window_days, label" }),
    description: msg({ message: "Days after a gathering in which its host can still send the recap to the people who said yes.", context: "game variable comms.recap_window_days, description" }),
  },
  "comms.guests_default": {
    label: msg({ message: "Guests may say they are coming", context: "game variable comms.guests_default, label" }),
    description: msg({ message: "When on, somebody with no account can say yes to a free public gathering and confirm by email. Each gathering can turn this on or off for itself. Guests need the comms module open to everyone.", context: "game variable comms.guests_default, description" }),
  },
  "comms.time_poll_freeze_hours": {
    label: msg({ message: "When a voted time stops moving", context: "game variable comms.time_poll_freeze_hours, label" }),
    description: msg({ message: "Hours before a gathering in which its time no longer follows the vote. A one-off vote closes this long before its earliest time, and a weekly series never moves an evening this close.", context: "game variable comms.time_poll_freeze_hours, description" }),
  },
  "comms.time_poll_settle_minutes": {
    label: msg({ message: "How long a time must lead before the gathering moves", context: "game variable comms.time_poll_settle_minutes, label" }),
    description: msg({ message: "Minutes a time must lead the vote before the gathering moves to it. Zero follows the vote live, so the time that is winning is the time on the calendar.", context: "game variable comms.time_poll_settle_minutes, description" }),
  },
  "comms.letters_per_day": {
    label: msg({ message: "Most letters the village sends in a day", context: "game variable comms.letters_per_day, label" }),
    description: msg({ message: "How many letters can go out in one day. A letter also waits ten minutes after the one before it.", context: "game variable comms.letters_per_day, description" }),
  },
  "comms.retention_months": {
    label: msg({ message: "How long the record of each email is kept", context: "game variable comms.retention_months, label" }),
    description: msg({ message: "Months the record of a sent email, its words included, is kept before it is deleted. Whoever runs the village's email reads those words. The words of essential mail are never kept, and the provider's delivery reports are cleared after 30 days whatever this says.", context: "game variable comms.retention_months, description" }),
  },
  "comms.send_rate_per_second": {
    label: msg({ message: "Emails sent per second", context: "game variable comms.send_rate_per_second, label" }),
    description: msg({ message: "How fast queued emails go out. Keep it at or under what your email provider allows on your plan, or sends are refused and retried later.", context: "game variable comms.send_rate_per_second, description" }),
  },
  "comms.notice_expiry_minutes": {
    label: msg({ message: "How long a notification email may wait", context: "game variable comms.notice_expiry_minutes, label" }),
    description: msg({ message: "A notification email still unsent this many minutes after it was written is dropped, because a late notice surprises more than a missed one. The notification itself stays in the app.", context: "game variable comms.notice_expiry_minutes, description" }),
  },
  "comms.open_tracking": {
    label: msg({ message: "Count when emails are opened", context: "game variable comms.open_tracking, label" }),
    description: msg({ message: "Off by default. Some mail apps open every email by themselves, so an open count misleads, and counting needs a hidden image in every email.", context: "game variable comms.open_tracking, description" }),
  },
  "comms.click_tracking": {
    label: msg({ message: "Count which links are clicked", context: "game variable comms.click_tracking, label" }),
    description: msg({ message: "Off by default. When on, links in automated emails pass through the email provider first so a journey can see what people did next. Links in the emails a person asked for are never rewritten.", context: "game variable comms.click_tracking, description" }),
  },
  "abuse.register_per_ip_hourly": {
    label: msg({ message: "Registrations per IP per hour", context: "game variable abuse.register_per_ip_hourly, label" }),
    description: msg({ message: "How many account registrations one IP address may attempt per hour. Also bounds how fast an outsider can probe which email addresses belong to members. An onboarding gathering behind one shared connection counts as one IP, so keep this comfortably above the size of a signup circle.", context: "game variable abuse.register_per_ip_hourly, description" }),
  },
  "abuse.login_ip_per_quarter_hour": {
    label: msg({ message: "Failed logins per IP per 15 minutes", context: "game variable abuse.login_ip_per_quarter_hour, label" }),
    description: msg({ message: "How many FAILED sign-in attempts one IP address may make per 15 minutes. Successful sign-ins never count. The per-account limit below is the real brute-force bound; this one only caps bulk abuse from a single address, so it can stay loose.", context: "game variable abuse.login_ip_per_quarter_hour, description" }),
  },
  "abuse.login_account_per_quarter_hour": {
    label: msg({ message: "Failed logins per account per 15 minutes", context: "game variable abuse.login_account_per_quarter_hour, label" }),
    description: msg({ message: "How many FAILED sign-in attempts any one account may receive per 15 minutes, from all addresses combined: the bound an attacker with many IPs cannot dodge. Successful sign-ins never count. Anyone who knows an address can briefly lock that account out by failing on purpose, so do not set this too low.", context: "game variable abuse.login_account_per_quarter_hour, description" }),
  },
  "abuse.password_reset_per_ip_hourly": {
    label: msg({ message: "Password-reset requests per IP per hour", context: "game variable abuse.password_reset_per_ip_hourly, label" }),
    description: msg({ message: "How many 'forgot password' requests one IP address may make per hour. Each one can send an email, so this bounds using the village as a mail cannon. A separate per-address limit always applies as well, so one member cannot be mail-bombed from many addresses.", context: "game variable abuse.password_reset_per_ip_hourly, description" }),
  },
  "abuse.investor_docs_per_ip_hourly": {
    label: msg({ message: "Investor-packet requests per IP per hour", context: "game variable abuse.investor_docs_per_ip_hourly, label" }),
    description: msg({ message: "How many investor document requests one IP address may make per hour. Each request stores a lead and emails the packet to the address given, so unthrottled it doubles as a spam cannon. Several genuine investors behind one corporate network share a bucket, so keep this above 1.", context: "game variable abuse.investor_docs_per_ip_hourly, description" }),
  },
  "assistant.account_day_share_percent": {
    label: msg({ message: "Most of the guide's day one account may use", context: "game variable assistant.account_day_share_percent, label" }),
    description: msg({ message: "Each way of asking the guide has its own number of calls a day on the village's key, shared by everyone. This is the most of that one signed-in account may use in a day, so one person asking all day cannot use it up for everybody. Admin tools keep the whole day, and a member who brings their own key pays their own way. 0 means signed-in accounts get no calls on the village's key at all.", context: "game variable assistant.account_day_share_percent, description" }),
  },
  "assistant.account_day_share_floor": {
    label: msg({ message: "Fewest guide calls one account may use in a day", context: "game variable assistant.account_day_share_floor, label" }),
    description: msg({ message: "A floor under the share above, for a way of asking whose whole day is small: one account may always use at least this many calls a day, while the share is above 0. It is never more than that way's whole day. 0 means no floor.", context: "game variable assistant.account_day_share_floor, description" }),
  },
  "assistant.anonymous_day_calls": {
    label: msg({ message: "Guide calls a day for visitors with no account", context: "game variable assistant.anonymous_day_calls, label" }),
    description: msg({ message: "The visitor guide and the application's voice drafts answer people with no account. Together, those people may use this many of the public guide's calls a day, and the rest stay for people who are signed in, so a few visitors cannot use up the day. It is never more than the public guide's whole day. 0 means visitors with no account get no guide calls.", context: "game variable assistant.anonymous_day_calls, description" }),
  },
  "assistant.anonymous_address_day_calls": {
    label: msg({ message: "Guide calls a day for one address with no account", context: "game variable assistant.anonymous_address_day_calls, label" }),
    description: msg({ message: "How many of the visitors' calls above one internet address may use in a day. A household or an office behind one connection counts as one address, so keep it above one conversation's worth. 0 means visitors with no account get no guide calls.", context: "game variable assistant.anonymous_address_day_calls, description" }),
  },
  "documents.model_drafts_per_hour": {
    label: msg({ message: "Model drafts from a document per account per hour", context: "game variable documents.model_drafts_per_hour, label" }),
    description: msg({ message: "How many times one account may ask a model to draft from a document in an hour, on the village's key. A member who brings their own key is not counted. 0 means no model drafts on the village's key; the words-only draft always works.", context: "game variable documents.model_drafts_per_hour, description" }),
  },
  "documents.model_drafts_per_day": {
    label: msg({ message: "Model drafts from a document per account per day", context: "game variable documents.model_drafts_per_day, label" }),
    description: msg({ message: "How many times one account may ask a model to draft from a document in a day, on the village's key. A member who brings their own key is not counted. 0 means no model drafts on the village's key; the words-only draft always works.", context: "game variable documents.model_drafts_per_day, description" }),
  },
  "retention.submissions_days": {
    label: msg({ message: "Keep handled form submissions for", context: "game variable retention.submissions_days, label" }),
    description: msg({ message: "Form submissions carry personal details (names, emails, phone numbers). Once a submission has been handled (any status other than new), it is deleted this many days after it arrived. Unhandled submissions are never swept: an unread message is a commitment, not clutter. 0 keeps everything forever.", context: "game variable retention.submissions_days, description" }),
  },
  "retention.notifications_days": {
    label: msg({ message: "Keep read notifications for", context: "game variable retention.notifications_days, label" }),
    description: msg({ message: "Read notifications older than this are deleted by the daily sweep. Unread ones stay: they have not done their job yet. 0 keeps everything forever.", context: "game variable retention.notifications_days, description" }),
  },
  "uploads.orphan_grace_days": {
    label: msg({ message: "Leave an unreferenced upload alone for", context: "game variable uploads.orphan_grace_days, label" }),
    description: msg({ message: "The uploads volume holds files from five doors: proposal attachments, brand images, village fonts, investor documents and members' photographs. Admin > Uploaded Files lists the ones no row in the database points at, and this is how long a file is left alone before it can appear on that list. The window protects a picture you have just replaced: swapping an image mints a new address by design, so the old file goes unreferenced the moment the new one lands while every browser and every email already sent still points at it. Nothing is ever removed without somebody pressing the button.", context: "game variable uploads.orphan_grace_days, description" }),
  },
  "assistant.synthesis_batch": {
    label: msg({ message: "Draft call syntheses in the background at half price", context: "game variable assistant.synthesis_batch, label" }),
    description: msg({ message: "Recordings that have a transcript and no synthesis are sent to the model in one batch instead of one call at a time. Every token in a batch costs half. Results usually arrive within an hour and can take up to a day, so this suits the recordings nobody is waiting on. The Synthesize button in Admin is unaffected: it still answers straight away at full price, because a person is watching it. Off keeps every synthesis something a person asks for.", context: "game variable assistant.synthesis_batch, description" }),
  },
  "map.public_structure": {
    label: msg({ message: "Show the map's structure to visitors", context: "game variable map.public_structure, label" }),
    description: msg({ message: "When the map module is public, anonymous visitors see circles, role titles and holder counts, never names or faces. Off hides the map from visitors entirely, even at public lifecycle.", context: "game variable map.public_structure, description" }),
  },
  "map.concierge_enabled": {
    label: msg({ message: "Show the coordination concierge", context: "game variable map.concierge_enabled, label" }),
    description: msg({ message: "The 'what do you want to do?' bar that routes a member to the right circle, role or quest. Deterministic matching always runs first; the assistant is only consulted for ambiguous asks, and only when an API key is configured.", context: "game variable map.concierge_enabled, description" }),
  },
  "map.contact_daily_cap": {
    label: msg({ message: "Contact requests a member may send per day", context: "game variable map.contact_daily_cap, label" }),
    description: msg({ message: "The relay's outbound brake. 0 disables the contact relay entirely.", context: "game variable map.contact_daily_cap, description" }),
  },
  "map.contact_recipient_daily_cap": {
    label: msg({ message: "Contact requests one person receives per day", context: "game variable map.contact_recipient_daily_cap, label" }),
    description: msg({ message: "Protects busy role holders. Once someone's day is full, would-be senders are pointed at the circle's open quests instead.", context: "game variable map.contact_recipient_daily_cap, description" }),
  },
  "map.show_quests": {
    label: msg({ message: "Show open quests on the map", context: "game variable map.show_quests, label" }),
    description: msg({ message: "Open quests orbit their circle as small satellites, capped for legibility.", context: "game variable map.show_quests, description" }),
  },
  "map.vacant_highlight": {
    label: msg({ message: "Highlight openings", context: "game variable map.vacant_highlight, label" }),
    description: msg({ message: "Openings pulse gently as an open call. Off renders them as plain grey rings.", context: "game variable map.vacant_highlight, description" }),
  },
  "map.contact_retention_days": {
    label: msg({ message: "Keep contact message bodies for", context: "game variable map.contact_retention_days, label" }),
    description: msg({ message: "Relay message bodies are personal correspondence: the daily sweep clears bodies older than this while keeping the contact event itself (who reached whom, when). 0 keeps bodies forever.", context: "game variable map.contact_retention_days, description" }),
  },
  "map.photo_max_mb": {
    label: msg({ message: "Largest photograph a member may upload", context: "game variable map.photo_max_mb, label" }),
    description: msg({ message: "Measured on the file that arrives. The browser shrinks a picture to WebP before it is sent, so a phone photo usually lands far under this; the ceiling is what stops an untouched original from spending the whole volume. At 1 the pipeline still accepts a prepared phone photo. At 25 one picture can cost 25 MB of the uploads volume, and /health reports what the photographs are using.", context: "game variable map.photo_max_mb, description" }),
  },
  "map.photos_per_place": {
    label: msg({ message: "Photographs one place may hold", context: "game variable map.photos_per_place, label" }),
    description: msg({ message: "Counts the pictures currently on a place, so a takedown frees a slot. 0 means no place accepts a photograph and the upload control is gone from every gallery. At 500 one place can hold five hundred pictures and its gallery pages through them.", context: "game variable map.photos_per_place, description" }),
  },
  "map.photos_per_member_daily": {
    label: msg({ message: "Photographs one member may add per day", context: "game variable map.photos_per_member_daily, label" }),
    description: msg({ message: "Counted across every place over the last 24 hours. 0 closes contribution for everyone, whatever their stage or role. At 200 one member can add two hundred pictures in a day.", context: "game variable map.photos_per_member_daily, description" }),
  },
  "map.photo_report_hide_threshold": {
    label: msg({ message: "Reports that hide a photograph on their own", context: "game variable map.photo_report_hide_threshold, label" }),
    description: msg({ message: "Distinct members flagging one picture. Once this many have, it leaves the gallery and waits for a curator, who can put it back. 0 means the village's reports never hide anything by themselves and a curator acts on every one. A person asking for a photograph OF THEMSELVES to come down is a different act and never waits for this number: one is always enough.", context: "game variable map.photo_report_hide_threshold, description" }),
  },
  "map.photo_tombstone_days": {
    label: msg({ message: "Keep the record of a removed photograph for", context: "game variable map.photo_tombstone_days, label" }),
    description: msg({ message: "A photograph taken down loses its file immediately. What stays is the record of the takedown, so a curator can still see what they decided and which report it answered. The daily sweep forgets that record after this many days. 0 keeps it forever.", context: "game variable map.photo_tombstone_days, description" }),
  },
  "org.public_people": {
    label: msg({ message: "Show who holds each role to visitors", context: "game variable org.public_people, label" }),
    description: msg({ message: "On, anyone can read the first names of the people holding each role on the Team, Roles and Circles pages, and a visitor reads members by first name elsewhere. Off, a visitor who is not signed in reads no member's name, handle, address or portrait on any page: the pulse, the decisions, profiles and role cards included. Signed-in members whose role or badge grants map.viewPeople still read who holds each role, and a visitor still sees every circle, every role, and how many of them are filled. This is the secret society setting. It moves names only: the shape of the village stays public at both settings.", context: "game variable org.public_people, description" }),
  },
  "entrance.required": {
    label: msg({ message: "Ask visitors for their name and email before the portal", context: "game variable entrance.required, label" }),
    description: msg({ message: "On, a visitor who is not signed in meets one calm screen before the roles, the game, the quests, the circles and the map: their name and email, a WhatsApp number and a website or social link if they want, a box to tick for updates, and a check that they are a person. Their device is remembered for 90 days. The public pages stay open to everyone, and signed-in members never see the screen. Admin, Portal visitors lists everyone who entered, with a CSV. Off, everything that was public stays public.", context: "game variable entrance.required, description" }),
  },
  "entrance.turnstile_site_key": {
    label: msg({ message: "Portal entrance: Turnstile site key", context: "game variable entrance.turnstile_site_key, label" }),
    description: msg({ message: "The public half of a Cloudflare Turnstile widget, which checks that a visitor at the portal entrance is a person. It works only together with its secret, typed under Admin, Integrations. Blank, or without the secret, the entrance uses its simpler check: a hidden field, a minimum time on the form and a limit per connection.", context: "game variable entrance.turnstile_site_key, description" }),
  },
  "entrance.brevo_list_id": {
    label: msg({ message: "Portal entrance: Brevo list", context: "game variable entrance.brevo_list_id, label" }),
    description: msg({ message: "The number of the Brevo list that portal visitors join when they answer Yes to keeping in touch. It works only together with the Brevo key, typed under Admin, Integrations. 0 means nobody is sent to Brevo, and the visitors stay on the Portal visitors list in Admin. Joining the list sends no email by itself; a welcome goes out only if the list has one set up inside Brevo.", context: "game variable entrance.brevo_list_id, description" }),
  },
  "entrance.privacy_contact": {
    label: msg({ message: "Portal entrance: who to write to about what is kept", context: "game variable entrance.privacy_contact, label" }),
    description: msg({ message: "The email address the entrance's privacy line names, for a visitor who wants to see what is kept about them or have it deleted. Leave it blank to name the village's contact address.", context: "game variable entrance.privacy_contact, description" }),
  },
  "entrance.background_video": {
    label: msg({ message: "Portal entrance: background video", context: "game variable entrance.background_video, label" }),
    description: msg({ message: "A video that plays, muted and looping, behind the entrance card. An address that starts with https://, or a file of this site such as /uploads/gate.mp4; mp4 plays in every browser. Leave it blank for the plain background. Visitors who ask their device for less motion see the still image below instead.", context: "game variable entrance.background_video, description" }),
  },
  "entrance.background_video_mobile": {
    label: msg({ message: "Portal entrance: background video on phones", context: "game variable entrance.background_video_mobile, label" }),
    description: msg({ message: "A smaller copy of the background video for screens 768 pixels wide or less, so a phone downloads less. Leave it blank to use the main video on phones too.", context: "game variable entrance.background_video_mobile, description" }),
  },
  "entrance.background_poster": {
    label: msg({ message: "Portal entrance: background still image", context: "game variable entrance.background_poster, label" }),
    description: msg({ message: "The still image shown while the background video loads, and in its place for visitors who ask for less motion. An address that starts with https://, or a file of this site. Leave it blank for none.", context: "game variable entrance.background_poster, description" }),
  },
  "entrance.look_minutes": {
    label: msg({ message: "Portal entrance: minutes to look around before the code", context: "game variable entrance.look_minutes, label" }),
    description: msg({ message: "While the village can send email, entering the portal sends a 6-digit code to the visitor's address, and they go straight in. They can look around for this many minutes, or until they open the number of pages below, whichever comes first. The next page they open asks for the code. The step never covers a page they are reading.", context: "game variable entrance.look_minutes, description" }),
  },
  "entrance.look_pages": {
    label: msg({ message: "Portal entrance: pages to look at before the code", context: "game variable entrance.look_pages, label" }),
    description: msg({ message: "How many pages a visitor can open after entering, before the next one asks for the 6-digit code we sent them. Works together with the minutes above: whichever runs out first.", context: "game variable entrance.look_pages, description" }),
  },
  "entrance.views_keep_days": {
    label: msg({ message: "Portal entrance: keep the pages visitors opened for", context: "game variable entrance.views_keep_days, label" }),
    description: msg({ message: "How many days the list of pages each portal visitor opened is kept, shown under Admin, Portal visitors. Older page views are deleted once a day. The visitor's name and email are kept until somebody asks for them to be forgotten; this setting covers only the pages.", context: "game variable entrance.views_keep_days, description" }),
  },
  "org.consent_after_interviews": {
    label: msg({ message: "Ask the circle to consent after the conversations", context: "game variable org.consent_after_interviews, label" }),
    description: msg({ message: "Off, the circle is asked to consent the moment an applicant confirms their address. On, the circle is only told an application arrived, and the consent round opens once every conversation a role names has been scored, so the circle weighs the whole picture. Roles that name no interviewers are asked at once either way. Nobody's score is shown to the circle's ask or to the applicant.", context: "game variable org.consent_after_interviews, description" }),
  },
  "org.onboarding_role": {
    label: msg({ message: "The role that sends first replies to applicants", context: "game variable org.onboarding_role, label" }),
    description: msg({ message: "The role whose holders are reminded to send each applicant a first reply within 3 business days, and are told when an application has not moved for ten days. Paste the role id from the org chart. Leave it empty and the admins are told instead. Reminders only: nothing here adopts or declines anybody.", context: "game variable org.onboarding_role, description" }),
  },
  "org.reference_followup_role": {
    label: msg({ message: "The role that follows up with an applicant's references", context: "game variable org.reference_followup_role, label" }),
    description: msg({ message: "When a shortlisted applicant sends their references, each one is given to this role first: its holders read how to reach the reference and write their follow-up notes. The team can then give any reference to another role or member, whoever is most aligned with that person. Usually the role that holds human relations and operations. Paste the role id from the org chart. Leave it empty and each reference waits for the team to pick who follows up.", context: "game variable org.reference_followup_role, description" }),
  },
  "org.final_call_role": {
    label: msg({ message: "The role that makes the final call on an applicant", context: "game variable org.final_call_role, label" }),
    description: msg({ message: "The role whose holders read everything gathered for an applicant (the reference follow-ups and every conversation's scorecard), hold the final conversation and then make the call. The adoption or decline itself goes through the usual doors, so this role should also carry the power to place people in roles. Paste the role id from the org chart. Leave it empty and the holders of that power make the final call.", context: "game variable org.final_call_role, description" }),
  },
  "org.applicant_reply_days": {
    label: msg({ message: "Longest reply in days a proposer was ever promised (a floor for the moon cycles)", context: "game variable org.applicant_reply_days, label" }),
    description: msg({ message: "Nobody is told a number of days any more (the lead, 24 Nov 2026): every proposer, an applicant included, is told they will hear back within the moon cycles set below. This number is kept so a village that once promised a long wait is never made to promise a shorter one: the moon cycles said are never fewer than these days, rounded up to whole cycles (45 days reads as two). The default 7 sits inside one cycle and changes nothing. The reminder to the role that sends first replies runs on its own clock (3 business days) and is not changed by this.", context: "game variable org.applicant_reply_days, description" }),
  },
  "org.reply_window_moons": {
    label: msg({ message: "Moon cycles we tell a proposer they will hear back within", context: "game variable org.reply_window_moons, label" }),
    description: msg({ message: "What a person is told once they have sent an application, a venture, a partnership or a quest idea: on the thank-you page, in the confirmation and update letters, in the application's steps and on its status page, that they will hear back within this many moon cycles. Nothing before they send promises a reply. It is a promise to the person, so set what the people who reply can keep. It never reads fewer cycles than the days above, rounded up.", context: "game variable org.reply_window_moons, description" }),
  },
  "org.partnerships_role": {
    label: msg({ message: "The role that answers partner proposals", context: "game variable org.partnerships_role, label" }),
    description: msg({ message: "The role whose holders receive each proposal sent through Become a partner, by email: someone who already runs a project or business and would like to work with the village. Usually the role that holds partnerships. Paste the role id from the org chart. Leave it empty and partner proposals go to the business inbox in the email settings.", context: "game variable org.partnerships_role, description" }),
  },
  "org.voice_clips_max": {
    label: msg({ message: "Voice clips an applicant may record beside their answers", context: "game variable org.voice_clips_max, label" }),
    description: msg({ message: "On the public role application, each written answer has a small record button so the applicant can say that answer out loud. This is how many such clips one application may carry, beside the main voice note. They are kept only when the applicant ticks that the people who decide may listen, and go 90 days after the decision. 0 turns the clip buttons off.", context: "game variable org.voice_clips_max, description" }),
  },
  "org.voice_clip_seconds": {
    label: msg({ message: "Longest voice clip beside an answer", context: "game variable org.voice_clip_seconds, label" }),
    description: msg({ message: "How long one voice clip beside a written answer on the public role application may run. The recording stops by itself at this length.", context: "game variable org.voice_clip_seconds, description" }),
  },
  "org.review_before_conversations": {
    label: msg({ message: "Review each application before the conversations", context: "game variable org.review_before_conversations, label" }),
    description: msg({ message: "On, an application waits for our review once its address confirms: a holder of the power to place people in roles invites the applicant to the conversations, in the order the role names them, or sends the not-invited letter, which thanks them and points to open ways to stay close. The first conversation opens only with the invitation, and the circle is asked to consent once the conversations are written up. Off, the first conversation opens as the address confirms. An application keeps the setting it confirmed under.", context: "game variable org.review_before_conversations, description" }),
  },
  "characters.forge_style": {
    label: msg({ message: "The style for portraits drawn for members", context: "game variable characters.forge_style, label" }),
    description: msg({ message: "How a portrait drawn for a member should look, in a few sentences: the medium, the light, the palette and anything to leave out. A portrait provider puts these words before its own. Only the first 1500 characters are used. Leave it empty and a provider draws in its own neutral style. Members who upload their own picture are not affected.", context: "game variable characters.forge_style, description" }),
  },
  "guide.voice": {
    label: msg({ message: "How your guide speaks", context: "game variable guide.voice, label" }),
    description: msg({ message: "A few sentences on how the village guide should sound: plain or formal, brief or warm, the words it uses and the ones it avoids. The guide reads them before it answers someone shaping a proposal or a role card. They change its tone and wording only; the platform's own rules always hold. Only the first 1000 characters are used. Leave it empty and the guide keeps its platform voice: warm, encouraging, concrete, unhurried.", context: "game variable guide.voice, description" }),
  },
  "org.letter_team": {
    label: msg({ message: "The team that signs letters to applicants", context: "game variable org.letter_team, label" }),
    description: msg({ message: "The sign-off on the letters an applicant or a person asking to join reads, such as \"The Human Operations team\". A team, never a person's name. Leave it empty and the letters are signed by the village's own team.", context: "game variable org.letter_team, description" }),
  },
  "org.stay_close_name": {
    label: msg({ message: "The way to stay close, named in the not-invited letter", context: "game variable org.stay_close_name, label" }),
    description: msg({ message: "The name of the village's open way in for someone not invited to a role, such as its supporters' circle. The not-invited letter and the status page point to it first, then to quests and events. Leave it empty and they point to quests and events only.", context: "game variable org.stay_close_name, description" }),
  },
  "org.stay_close_link": {
    label: msg({ message: "Where the way to stay close is", context: "game variable org.stay_close_link, label" }),
    description: msg({ message: "A page of this site, such as /resident, or an https address. Used only when the way to stay close has a name.", context: "game variable org.stay_close_link, description" }),
  },
  "org.sync_starts_unlisted": {
    label: msg({ message: "Roles accepted from a sync start unlisted", context: "game variable org.sync_starts_unlisted, label" }),
    description: msg({ message: "On, a role that arrives from a sync and is accepted starts unlisted: holders, stewards and admins see it, and no visitor or member browsing the village does. A steward lists it once its card is ready. Off, an accepted role is listed at once.", context: "game variable org.sync_starts_unlisted, description" }),
  },
  "org.default_track": {
    label: msg({ message: "The track a role without one reads as", context: "game variable org.default_track, label" }),
    description: msg({ message: "What a role whose card names no track reads as: contractor, volunteer, employee or ai. A village whose roles are all moon-to-moon contracts, paid for the tasks delivered and invoiced at the End of Moon, writes contractor. Leave it empty and a role with no track shows none, as before. A role's own track always wins.", context: "game variable org.default_track, description" }),
  },
  "org.apply_needs_complete_card": {
    label: msg({ message: "A role needs a complete card before anyone can apply", context: "game variable org.apply_needs_complete_card, label" }),
    description: msg({ message: "On, a role whose card is not complete shows \"Being written\" in place of Apply, and the open form leaves it out. A card is complete when its aim, what it decides on, what it answers for, commitment, track, reward type, term, a village goal, selection criteria and interviewing roles are written, and, for a paid role, a pay range is on offer. Off, Apply shows on every open role as before.", context: "game variable org.apply_needs_complete_card, description" }),
  },
  "org.first_conversation_role": {
    label: msg({ message: "The role that holds first conversations", context: "game variable org.first_conversation_role, label" }),
    description: msg({ message: "The role whose holders hold the first conversation with somebody who applies for a role. The card names it as the first step, and its booking link is where the first conversation is booked. Leave it empty and the card names no first step. Paste the role id from the org chart.", context: "game variable org.first_conversation_role, description" }),
  },
  "org.paid_consent_circle": {
    label: msg({ message: "The circle that consents paid roles", context: "game variable org.paid_consent_circle, label" }),
    description: msg({ message: "The circle whose consent a paid role needs before anybody is seated in it. The card names it when the role is paid. Leave it empty and the card names no consenting circle. Paste the circle id from the org chart.", context: "game variable org.paid_consent_circle, description" }),
  },
  "org.ccos_terms": {
    label: msg({ message: "Show the CCOS term on circle and role card headings", context: "game variable org.ccos_terms, label" }),
    description: msg({ message: "Each heading on a circle card, and on each role in full on a player's card, is plain words, like \"What we look after\" or \"What I can decide on my own\". On, hovering or tapping a heading also shows the matching heading in the CCOS Circle Charter or Role Card, like \"CCOS: Domains\", for a village that writes its charters and roles with it. Off keeps the plain headings and shows no term.", context: "game variable org.ccos_terms, description" }),
  },
  "org.conflict_intro": {
    label: msg({ message: "How we see conflict, before the conflict steps", context: "game variable org.conflict_intro, label" }),
    description: msg({ message: "The paragraph above the conflict steps on /roles and /governance, under How we evolve through conflict: how this village sees conflict, in its own words. Empty, the steps show with no paragraph above them.", context: "game variable org.conflict_intro, description" }),
  },
  "org.founding_team": {
    label: msg({ message: "Feature the founding team on the Roles page", context: "game variable org.founding_team, label" }),
    description: msg({ message: "On, the top of the Roles and Circles page is a quiet \"Join the founding team\" section: the paid founding roles the village is hiring for, each with its full card and one Apply act. The roles are the ones written in \"The founding team's roles\". Off, the page opens on the roles and circles as before.", context: "game variable org.founding_team, description" }),
  },
  "org.founding_team_roles": {
    label: msg({ message: "The founding team's roles", context: "game variable org.founding_team_roles, label" }),
    description: msg({ message: "The roles the founding team section features, in the order they show: paste each role id from the org chart, separated by commas or new lines. A role that is unlisted, ended or held as an example is left out of the section. Empty, the section shows nothing.", context: "game variable org.founding_team_roles, description" }),
  },
  "org.show_pay_ranges": {
    label: msg({ message: "Show pay ranges on role cards", context: "game variable org.show_pay_ranges, label" }),
    description: msg({ message: "Off, no role card shows a pay range or an amount to visitors or members, whatever a role's terms hold: a card shows how pay works (its shares) instead. On, an open listed role whose terms name a pay range shows that range on its card to everyone. People who hold the power to read terms still read the full terms either way. A role card can choose for itself in the role editor, under Who sees the listed price: everyone, or only the people who edit the card. That choice holds on the card, the founding team and the application form.", context: "game variable org.show_pay_ranges, description" }),
  },
  "org.pay_split_amounts": {
    label: msg({ message: "Show each reward share as its own amount", context: "game variable org.pay_split_amounts, label" }),
    description: msg({ message: "Off, a role card with a listed price shows it as one figure for the full role. On, the card names each share of that figure as its own amount, worked out from the role's shares, such as up to $4,000 in cash and $6,000 in equity a month. A role card can choose for itself in the role editor, under How the listed price reads. Who sees the figure at all is still decided by Show pay ranges on role cards and the card's own choice.", context: "game variable org.pay_split_amounts, description" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  },
  "moon_review.far_off_pct": {
    label: msg({ message: "When a moon counts as far from what was agreed", context: "game variable moon_review.far_off_pct, label" }),
    description: msg({ message: "At the End of Moon review, each member's invoice shows what was agreed (their pay and their moon goals) beside what they delivered (goals done, and every task done, including tasks outside their roles). When the two are this far apart, the review flags it for the Treasurer: goal progress below 100 minus this percent, or this percent or more of the tasks done outside the member's roles. At the default of 25, that is goal progress under 75%, or a quarter of the work outside their roles, about one week in a four-week moon. The flag changes no pay. The Treasurer may propose a different amount with a reason, the member can reply, and nothing pays until the Treasurer confirms. Works with: the Treasurer's role, which holds the power to pay.", context: "game variable moon_review.far_off_pct, description" }),
  },
  "org.pay_shape": {
    label: msg({ message: "How compensation works, on every role card", context: "game variable org.pay_shape, label" }),
    description: msg({ message: "The shape of the pay every role card shows under \"How compensation works\", as shares of the whole, never an amount: write each share's name and percent, separated by commas, like Cash 60, Equity 40, Credits 0. The shares add up to 100 or less, and a share at 0 still shows, as 0%. A role whose card writes its own shares shows those instead. Empty, cards show no pay shape.", context: "game variable org.pay_shape, description" }),
  },
  "org.pay_shape_at_risk": {
    label: msg({ message: "The at-risk line under the pay shape", context: "game variable org.pay_shape_at_risk, label" }),
    description: msg({ message: "One line under the shares on every role card, in the village's words, saying which part of the pay depends on what the village raises or earns. No amounts. Empty, no line.", context: "game variable org.pay_shape_at_risk, description" }),
  },
  "org.pay_shape_note": {
    label: msg({ message: "The note under the pay shape", context: "game variable org.pay_shape_note, label" }),
    description: msg({ message: "The last line under the pay shape on every role card. When a card lists a price, its footnote already says the first moon starts lower and that equity and credit terms are subject to legal review, and this note is added after it, so write only what the footnote does not say. No amounts. A role's card may write its own. A note that starts with * puts a matching * after the card's total compensation line, so it reads as that line's fine print. Empty, no note.", context: "game variable org.pay_shape_note, description" }),
  },
  "org.founding_know_us": {
    label: msg({ message: "Ways to get to know us before applying", context: "game variable org.founding_know_us, label" }),
    description: msg({ message: "The first step of the application lists these, one per line, and the applicant ticks the ones they have done. The step never stops anyone applying. Up to 24 lines.", context: "game variable org.founding_know_us, description" }),
  },
  "org.founding_know_us_note": {
    label: msg({ message: "The note while a way to get to know us is not ticked", context: "game variable org.founding_know_us_note, label" }),
    description: msg({ message: "Shown on the first step of the application whenever a way is not ticked yet. It encourages, and the applicant can always continue.", context: "game variable org.founding_know_us_note, description" }),
  },
  "org.founding_recording_link": {
    label: msg({ message: "The last community call recording", context: "game variable org.founding_recording_link, label" }),
    description: msg({ message: "Step 1 of the application offers \"Watch the last recording\" with this link, as the easiest first step. A page of this site or an https address. Empty: not offered.", context: "game variable org.founding_recording_link, description" }),
  },
  "org.founding_call_link": {
    label: msg({ message: "Where to join the next community call", context: "game variable org.founding_call_link, label" }),
    description: msg({ message: "Step 1 offers \"Join the next call\". The next public event titled community call or webinar is linked first, with its date; this link stands in when there is none. Empty: not offered.", context: "game variable org.founding_call_link, description" }),
  },
  "org.founding_tour_link": {
    label: msg({ message: "Where to book a land tour", context: "game variable org.founding_tour_link, label" }),
    description: msg({ message: "Step 1 offers \"Book a land tour\". The next public event titled land tour is linked first; this booking link stands in when there is none. Empty: not offered.", context: "game variable org.founding_tour_link, description" }),
  },
  "org.founding_potluck_link": {
    label: msg({ message: "Where to find the next potluck", context: "game variable org.founding_potluck_link, label" }),
    description: msg({ message: "Step 1 offers \"Come to the next potluck\". The next public event titled potluck is linked first, with its date and place; this link stands in when there is none. Empty: not offered.", context: "game variable org.founding_potluck_link, description" }),
  },
  "org.tours_resumed": {
    label: msg({ message: "Land tours and potlucks are running", context: "game variable org.tours_resumed, label" }),
    description: msg({ message: "Off, the application's first step and the steward page's first steps show only the webinar or community call: every way, link or step that names a land tour, a visit to the land, a potluck or a shared meal is hidden. On, they all show again, as written. Nothing is deleted either way.", context: "game variable org.tours_resumed, description" }),
  },
  "org.founding_steward_path_link": {
    label: msg({ message: "Where someone completely new explores first", context: "game variable org.founding_steward_path_link, label" }),
    description: msg({ message: "Where the Steward path lives, carried with the application's links. The application's first step no longer offers it (the lead, 24 Nov 2026: it sent an applicant back to the page they had just read). A page of this site or an https address; empty means /steward.", context: "game variable org.founding_steward_path_link, description" }),
  },
  "org.newsletter_link": {
    label: msg({ message: "Where to sign up for the newsletter", context: "game variable org.newsletter_link, label" }),
    description: msg({ message: "The roles opening after the founding team invite people to hear first about new ones: join a community call and sign up for the newsletter here. A page of this site or an https address. Empty: the newsletter is not mentioned.", context: "game variable org.newsletter_link, description" }),
  },
  "org.founding_first_cycle": {
    label: msg({ message: "What the first cycle looks like", context: "game variable org.founding_first_cycle, label" }),
    description: msg({ message: "Shown on the Your first day step of the application: how long the first cycle is, when it runs, and that either side may end it there after the first full moon cycle.", context: "game variable org.founding_first_cycle, description" }),
  },
  "org.founding_first_conversations": {
    label: msg({ message: "The first conversations after joining", context: "game variable org.founding_first_conversations, label" }),
    description: msg({ message: "Shown on the Your first day step: the first conversations a new team member has once they are chosen, one per line. Leave it empty and none are listed.", context: "game variable org.founding_first_conversations, description" }),
  },
  "org.founding_updated_note": {
    label: msg({ message: "A note when the application changes", context: "game variable org.founding_updated_note, label" }),
    description: msg({ message: "Shown under the application's title while it is set, for example: We updated this application on 14 November. Your saved answers are still here. Empty, no note.", context: "game variable org.founding_updated_note, description" }),
  },
  "org.role_card_shared": {
    label: msg({ message: "Lines every role card shows under what the village needs", context: "game variable org.role_card_shared, label" }),
    description: msg({ message: "One per line, drawn as bullets above each role's own lines: where the village is, the circle every role answers to. A line written Label: words shows its label in bold. Empty, no lines.", context: "game variable org.role_card_shared, description" }),
  },
  "org.role_card_rhythm": {
    label: msg({ message: "The sessions every role attends", context: "game variable org.role_card_rhythm, label" }),
    description: msg({ message: "One per line, drawn first under Rhythm on every role card, before the role's own rhythm. Write each as Weekly: Monday team meeting, or Each moon: new moon recap and intentions, and the lines group by what comes before the colon. Empty, no lines.", context: "game variable org.role_card_rhythm, description" }),
  },
  "org.role_card_first_review": {
    label: msg({ message: "When a role's first review happens", context: "game variable org.role_card_first_review, label" }),
    description: msg({ message: "Read after First review on every role card, for example: at the first new moon celebration. Empty: each card says its own number of days.", context: "game variable org.role_card_first_review, description" }),
  },
  "org.role_card_nationality": {
    label: msg({ message: "Nationality line on every open role", context: "game variable org.role_card_nationality, label" }),
    description: msg({ message: "Shown under Nationality on every open role card, coming soon and venture cards too. Put a | between two lines, for example: Citizens of this country (preferred) | Other nationalities (possible). Empty, no Nationality row.", context: "game variable org.role_card_nationality, description" }),
  },
  "org.role_card_onboarding": {
    label: msg({ message: "The first steps once someone is selected", context: "game variable org.role_card_onboarding, label" }),
    description: msg({ message: "One per line, shown in the Once you're selected tab of every role card. A role that writes its own steps shows those in their place. Empty, no tab on a card without its own.", context: "game variable org.role_card_onboarding, description" }),
  },
  "org.role_card_word_tips": {
    label: msg({ message: "Tooltips for your own words on the role cards", context: "game variable org.role_card_word_tips, label" }),
    description: msg({ message: "One per line, written as word: what it means, for example consent: a decision passes when nobody has a reasoned objection. The first time a role card says the word, it carries your words as a tooltip. Your line replaces the platform's tip for consent, steward, Founding Seeder, Digital Companion or your anchor circle's name, and a new word gets a tip too. Empty, the platform's tips, and the anchor circle's own purpose.", context: "game variable org.role_card_word_tips, description" }),
  },
  "org.other_ways_seeder_title": {
    label: msg({ message: "Other ways to join: the resident path tile", context: "game variable org.other_ways_seeder_title, label" }),
    description: msg({ message: "The first tile under Other ways to join on the Roles page. It goes to the way to stay close, or to the resident page while that is empty.", context: "game variable org.other_ways_seeder_title, description" }),
  },
  "org.other_ways_seeder_line": {
    label: msg({ message: "Other ways to join: the line under the resident path tile", context: "game variable org.other_ways_seeder_line, label" }),
    description: msg({ message: "One short line under the resident path tile.", context: "game variable org.other_ways_seeder_line, description" }),
  },
  "org.other_ways_gifts_title": {
    label: msg({ message: "Other ways to join: the gifts tile", context: "game variable org.other_ways_gifts_title, label" }),
    description: msg({ message: "The tile under Other ways to join that goes to the work-with-us page, for volunteering and work-trade.", context: "game variable org.other_ways_gifts_title, description" }),
  },
  "org.other_ways_gifts_line": {
    label: msg({ message: "Other ways to join: the line under the gifts tile", context: "game variable org.other_ways_gifts_line, label" }),
    description: msg({ message: "One short line under the gifts tile.", context: "game variable org.other_ways_gifts_line, description" }),
  },
  "org.decline_next_steps_on": {
    label: msg({ message: "Decline letter: offer next steps", context: "game variable org.decline_next_steps_on, label" }),
    description: msg({ message: "When on, the letter that says no to an application also offers the waitlist for other roles, open quests and the resident path, as links.", context: "game variable org.decline_next_steps_on, description" }),
  },
  "org.decline_next_steps_intro": {
    label: msg({ message: "Decline letter: the line above the next steps", context: "game variable org.decline_next_steps_intro, label" }),
    description: msg({ message: "One short line that introduces the three ways to stay close.", context: "game variable org.decline_next_steps_intro, description" }),
  },
  "org.decline_next_steps_waitlist": {
    label: msg({ message: "Decline letter: the waitlist line", context: "game variable org.decline_next_steps_waitlist, label" }),
    description: msg({ message: "The line above the link to the Roles page, where a coming-soon role says Notify me.", context: "game variable org.decline_next_steps_waitlist, description" }),
  },
  "org.decline_next_steps_quests": {
    label: msg({ message: "Decline letter: the quests line", context: "game variable org.decline_next_steps_quests, label" }),
    description: msg({ message: "The line above the link to the Quests page.", context: "game variable org.decline_next_steps_quests, description" }),
  },
  "events.rsvp_enabled": {
    label: msg({ message: "Let members RSVP", context: "game variable events.rsvp_enabled, label" }),
    description: msg({ message: "Members can say they are coming, and a gathering with a capacity counts them against it. Off leaves the calendar readable and takes no answers, which suits a village that handles attendance elsewhere.", context: "game variable events.rsvp_enabled, description" }),
  },
  "events.upcoming_days": {
    label: msg({ message: "Show gatherings this far ahead", context: "game variable events.upcoming_days, label" }),
    description: msg({ message: "How far into the future the calendar looks. Anything starting beyond this is stored and stays hidden until it comes into range.", context: "game variable events.upcoming_days, description" }),
  },
  "events.past_visible_days": {
    label: msg({ message: "Keep finished gatherings listed for", context: "game variable events.past_visible_days, label" }),
    description: msg({ message: "A gathering that has ended stays on the calendar this long. Dropping one the moment it starts tells somebody standing at the door that nothing is happening.", context: "game variable events.past_visible_days, description" }),
  },
  "forum.report_hide_threshold": {
    label: msg({ message: "Soft reports that auto-hide a post", context: "game variable forum.report_hide_threshold, label" }),
    description: msg({ message: "When this many DIFFERENT members soft-report the same thread or reply, it hides automatically pending moderation, so the community can act before a moderator wakes up. Hard reports always go straight to the queue without hiding.", context: "game variable forum.report_hide_threshold, description" }),
  },
  "companions.max_questions_per_day": {
    label: msg({ message: "Questions one companion may ask a day", context: "game variable companions.max_questions_per_day, label" }),
    description: msg({ message: "The most questions each companion brings a member in one village day. Drafts are never held back by this, because a draft that wants to move money should always be seen. A member may lower it for any of their companions. More than 3 is not offered: that ceiling waits on a founder's ruling. A question over the limit waits for the next morning.", context: "game variable companions.max_questions_per_day, description" }),
  },
  "companions.role_ids": {
    label: msg({ message: "Roles that have a companion", context: "game variable companions.role_ids, label" }),
    description: msg({ message: "Which roles give their holders a companion that speaks for the role. Write all for every role, leave it empty for none, or paste role ids from the org chart separated by commas. The personal companion is always there for every member, whatever this says.", context: "game variable companions.role_ids, description" }),
  },
  "messaging.sends_per_minute": {
    label: msg({ message: "Messages one member may send per minute", context: "game variable messaging.sends_per_minute, label" }),
    description: msg({ message: "The send limit, counted per member across every conversation they are in. High enough that a fast typer in a live conversation never feels it, low enough that a stolen token cannot spray the village. Members who hit it are told to slow down and can send again the next minute.", context: "game variable messaging.sends_per_minute, description" }),
  },
  "messaging.max_members": {
    label: msg({ message: "Largest group conversation", context: "game variable messaging.max_members, label" }),
    description: msg({ message: "How many people one group thread may hold, the creator included. Every message notifies everyone in the thread who has not muted it, so this number is also the size of the loudest single send anyone can make.", context: "game variable messaging.max_members, description" }),
  },
  "feed.category_slug": {
    label: msg({ message: "Which forum category the feed shows", context: "game variable feed.category_slug, label" }),
    description: msg({ message: "The feed is a LENS over one forum category plus the village's system events. It is not a second content store. Point it at the category where everyday village life gets posted.", context: "game variable feed.category_slug, description" }),
  },
  "look.light_paper": {
    label: msg({ message: "Light mode's paper", context: "game variable look.light_paper, label" }),
    description: msg({ message: "How light mode draws the member pages. Plain is the clean Golden Hour page. Sea chart turns it into an old sea chart: aged, crumpled paper with a burnt edge, role cards on torn and scorched sheets, and Garamond headings. Dark mode and Admin stay as they are.", context: "game variable look.light_paper, description" }),
    choices: {
      "plain": {
        label: msg({ message: "Plain", context: "game variable look.light_paper, choice plain, label" }),
        hint: msg({ message: "The clean Golden Hour page.", context: "game variable look.light_paper, choice plain, hint" }),
      },
      "sea-chart": {
        label: msg({ message: "Sea chart", context: "game variable look.light_paper, choice sea-chart, label" }),
        hint: msg({ message: "Aged paper, torn cards and Garamond headings.", context: "game variable look.light_paper, choice sea-chart, hint" }),
      },
    },
  },
};
