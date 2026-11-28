/**
 * WHICH ROW OF THE PARITY LEDGER AN ACT COVERS.
 *
 * The Admin Garden's parity ledger lists 195 admin functions, each with an id: A1 to A72 are the Admin tabs in the
 * menu's own order, B the pages beside Admin, C the road to launch, D the setup game, E the Village board, F the
 * setup wizard, G Admin's chrome and helpers, H the other admin pages. Every act names the row or rows it covers
 * (`parity`), and shared/adminActsCoverage.test.ts counts the ledger against them.
 *
 * An act on a tab covers that tab's row unless its own entry says otherwise, so a row is typed once, here.
 *
 * Pure: no I/O, no clock.
 */

/** The ledger's row for each Admin tab, in the ledger's order. An old address shares the row of the tab it opens. */
export const TAB_PARITY: Readonly<Record<string, string>> = {
  home: "A1",
  submissions: "A2",
  "portal-visitors": "A3",
  feedback: "A4",
  reports: "A6",
  drafts: "A8",
  brain: "A9",
  failures: "A10",
  players: "A11",
  "game-roles": "A12",
  "org-chart": "A13",
  compare: "A14",
  "role-discover": "A15",
  "art-library": "A16",
  handover: "A17",
  "governance-weights": "A18",
  team: "A19",
  setup: "A20",
  pages: "A21",
  "paths-stages": "A22",
  legal: "A23",
  covenant: "A24",
  money: "A25",
  confidentiality: "A26",
  "work-with-us": "A27",
  faqs: "A28",
  milestones: "A29",
  "investor-summary": "A31",
  modules: "A32",
  "needs-admin": "A33",
  variables: "A34",
  season: "A35",
  "seasons-patterns": "A36",
  "circles-map": "A37",
  land: "A38",
  housing: "A39",
  "quests-admin": "A40",
  "tools-admin": "A41",
  "library-admin": "A42",
  "badges-admin": "A43",
  "stays-admin": "A44",
  "exchange-admin": "A45",
  "crowdpool-admin": "A46",
  "calls-admin": "A47",
  "intents-admin": "A48",
  "health-admin": "A49",
  tokens: "A50",
  ledger: "A51",
  "cash-payouts": "A52",
  cycles: "A55",
  products: "A56",
  "resources-admin": "A57",
  "exits-admin": "A58",
  settings: "A59",
  "training-modules": "A60",
  "investor-vault": "A61",
  "uploaded-files": "A62",
  "events-admin": "A63",
  "comms-overview": "A64",
  "comms-journeys": "A65",
  "comms-words": "A66",
  "comms-people": "A67",
  "comms-letters": "A68",
  "comms-sent": "A69",
  "comms-settings": "A70",
  integrations: "A72",
};

/**
 * The rows a tab's PAGE covers beside its own. The setup wizard's header, its door to the token names and its four
 * tick-only steps (Numbers, Content, Map and styling, Go live) all live on the wizard's own page today, and none of
 * them writes anything of its own.
 */
export const TAB_PAGE_ALSO: Readonly<Record<string, readonly string[]>> = {
  setup: ["F1", "F9", "F28", "F29", "F31", "F32"],
  // One Reports queue holds the forum's reports (its own row, A6) and the reports on messages (27 Nov 2026).
  reports: ["A7"],
  // Mail settings was listed twice. Its first address still opens this page (adminTabAliases.ts).
  "comms-settings": ["A71"],
};

/** The ledger's row for an act on a tab, when the act does not name its own. */
export function tabParity(tab: string | undefined): readonly string[] | undefined {
  const row = tab ? TAB_PARITY[tab] : undefined;
  return row ? [row] : undefined;
}

/** The rows the dials cover: every dial is Game mechanics, and the Mint's own dials are also the Mint page's. */
export const DIAL_PARITY = "A34";
export const MINT_DIAL_PARITY = "B10";
export const MINT_DIAL_CATEGORY = "The Mint";

/** A key is planted under Integrations. The guide's own key is also the wizard's guide-key step. */
export const KEY_PARITY = "A72";
export const KEY_ALSO: Readonly<Record<string, readonly string[]>> = { assistant_api_key: ["F2"] };

/** The rows the shipped controls cover, where that is more than their tab's row. */
export const CONTROL_PARITY: Readonly<Record<string, readonly string[]>> = {
  "season.timezone": ["A35", "G19"],
  // The visit program had a tab of its own. It is a setting inside Pages now.
  "visit.program": ["A30"],
  "project.fiatCurrency": ["F8", "G19"],
};

/** The rows the pages beside Admin cover. A page with no row here is not one the ledger tracks. */
export const OUTSIDE_PARITY: Readonly<Record<string, readonly string[]>> = {
  "page.modules": ["H2"],
  "page.review": ["H3"],
  // Quest claims was a tab holding one link. Finished work is a kind on the review list.
  "page.quest-claims": ["A5"],
  "page.approvals": ["H3"],
  "page.proposals": ["B7", "B8", "G12"],
  "page.mint": ["B9", "B10", "B11"],
  "page.treasury": ["H5"],
  "page.pricing": ["H5", "A53"],
  "page.budget": ["H5", "A54"],
  "page.role-measures": ["H1", "G30"],
  "page.launch": ["C1", "C11", "C12"],
  "page.setup-game": ["D1", "D2"],
};
