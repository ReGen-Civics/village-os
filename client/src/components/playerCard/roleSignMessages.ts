/**
 * THE SIGNS ON THE PLAYER CARD AND THEIR SHEETS, as the extractor reads them (the coordinator, 26 Nov 2026: the
 * player card follow-ups). The server says these lines from the plain copy in shared/roleSignMessages.ts, because its
 * build runs no macro; this file is the same messages as `msg()` calls, so `lingui extract` puts them in the
 * catalogs and their Spanish lives in client/src/locales/es.d/esb-card-signs.po. No page imports it: it costs the
 * bundle nothing. roleSignMessages.test.ts holds the two copies to the same ids.
 */
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const ROLE_SIGN_MESSAGES: readonly MessageDescriptor[] = [
  msg({ message: "Role applications answered within 2 business days", context: "role sign applications-answered, label" }),
  msg({ message: "Counted from when each role application was filed and when it was decided.", context: "role sign applications-answered, counted from" }),
  msg({ message: "Season plans filed", context: "role sign season-plans-filed, label" }),
  msg({ message: "Counted from the season plans members have filed, against every member.", context: "role sign season-plans-filed, counted from" }),
  msg({ message: "Newcomers active within 7 days", context: "role sign newcomers-active, label" }),
  msg({ message: "Counted from each newcomer's join date to their first quest claim or first role.", context: "role sign newcomers-active, counted from" }),
  msg({ message: "Community quests finished", context: "role sign community-quests-finished, label" }),
  msg({ message: "Counted from quest claims the village consented to as done.", context: "role sign community-quests-finished, counted from" }),
  msg({ message: "Roles with a full card and a term", context: "role sign roles-with-card-and-term, label" }),
  msg({ message: "Counted from each active role's aim, domain and accountabilities, and a term on its holding.", context: "role sign roles-with-card-and-term, counted from" }),
  msg({ message: "Org chart drafts decided within 2 business days", context: "role sign org-drafts-decided, label" }),
  msg({ message: "Counted from when each org chart draft was opened and when it was published.", context: "role sign org-drafts-decided, counted from" }),
  msg({ message: "Times the circle met", context: "role sign circle-met, label" }),
  msg({ message: "Counted from live sessions that two or more people joined.", context: "role sign circle-met, counted from" }),
  msg({ message: "Decisions recorded", context: "role sign decisions-recorded, label" }),
  msg({ message: "Counted from decisions a live session agreed by consent.", context: "role sign decisions-recorded, counted from" }),
  msg({ message: "Not counted yet", context: "role sign, not counted yet" }),
  msg({ message: "trend from next moon", context: "role sign, trend from next moon" }),
  msg({ message: "Answered within 2 business days", context: "role sign sheet, answered in time" }),
  msg({ message: "Answered after 2 business days", context: "role sign sheet, answered late" }),
  msg({ message: "Waiting, still inside 2 business days", context: "role sign sheet, waiting" }),
  msg({ message: "Not answered within 2 business days", context: "role sign sheet, not answered" }),
  msg({ message: "Season plan filed", context: "role sign sheet, season plan filed" }),
  msg({ message: "No season plan filed yet", context: "role sign sheet, no season plan filed" }),
  msg({ message: "Active within 7 days of joining", context: "role sign sheet, active in time" }),
  msg({ message: "Joined, still inside 7 days", context: "role sign sheet, still new" }),
  msg({ message: "Not active within 7 days of joining", context: "role sign sheet, not active" }),
  msg({ message: "Community quest finished", context: "role sign sheet, quest finished" }),
  msg({ message: "{role}: full card and a term", context: "role sign sheet, full card and a term" }),
  msg({ message: "{role}: missing {what}", context: "role sign sheet, missing parts" }),
  msg({ message: "Org chart draft decided within 2 business days", context: "role sign sheet, draft decided in time" }),
  msg({ message: "Org chart draft decided after 2 business days", context: "role sign sheet, draft decided late" }),
  msg({ message: "Org chart draft open, still inside 2 business days", context: "role sign sheet, draft waiting" }),
  msg({ message: "Org chart draft not decided within 2 business days", context: "role sign sheet, draft not decided" }),
  msg({ message: "The circle met, {n} people", context: "role sign sheet, the circle met" }),
  msg({ message: "A decision recorded", context: "role sign sheet, a decision recorded" }),
  msg({ message: "Nothing to show in this window yet", context: "role sign sheet, nothing to show" }),
  msg({ message: "What this count is made of", context: "role sign sheet, heading" }),
  msg({ message: "First names only. Listed in the order it happened.", context: "role sign sheet, first names note" }),
  msg({ message: "Listed in the order it happened.", context: "role sign sheet, order note" }),
  msg({ message: "aim", context: "role sign sheet, missing part aim" }),
  msg({ message: "domain", context: "role sign sheet, missing part domain" }),
  msg({ message: "what it answers for", context: "role sign sheet, missing part what it answers for" }),
  msg({ message: "a term", context: "role sign sheet, missing part a term" }),
];
