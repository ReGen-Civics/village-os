/**
 * Governance, Now (/governance), as fields: the words a village writes for the Now view (Governance brief, step 3).
 *
 * The lead, 26 Nov 2026: a guest on the Now view (signed out, or a visitor) first reads, in the village's own words,
 * whose village this is and what this place is for. The default is true of any village on this platform and names no
 * method; a village writes its own in Admin, Pages, Governance: Now. The explainer has its own page
 * (shared/pageContent/governance.ts, How We Govern), whose every field renders there.
 */
import type { PageSpec } from "./types";

export const GOVERNANCE_NOW_PAGE: PageSpec = {
  id: "governance-now",
  label: "Governance: Now",
  path: "/governance",
  sections: [
    {
      id: "guests",
      label: "A line for guests",
      shows: "The first line a signed-out visitor or a guest reads on the Now view, above the door to membership.",
      fields: [
        {
          key: "line",
          label: "The line",
          kind: "long",
          max: 240,
          default: "{village} is decided by the people who live and work here. This is one of the places where that work happens.",
        },
      ],
    },
  ],
};
