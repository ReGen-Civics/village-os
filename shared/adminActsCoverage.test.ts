/**
 * COVERAGE: how many of the 195 admin functions the parity ledger tracks have an entry in the registry of acts.
 *
 * The ledger gives every function an id (A1 to H8), and every act names the ids it covers (`parity`,
 * shared/adminActs/parity.ts). This file holds the 195 ids, each with a short plain phrase, and counts them:
 *
 *   registered   an act covers it, and none of the acts covering it is partial
 *   partial      it is covered, and an act covering it is marked partial, or STILL_OPEN names what has no act yet
 *   missing      no act covers it
 *
 * A function the founder ruled out or merged is still counted: the registry describes where it lives today.
 * The test prints the report, section by section, and holds a floor at what was reached, so coverage only goes up.
 */
import { describe, expect, it } from "vitest";
import { ADMIN_ACTS, type AdminAct } from "./adminActs";
import { DIAL_ACTS, SEED_ACTS } from "./adminActs/derived";

/** The ledger: every id, and the function it names in a few plain words. */
const LEDGER: Readonly<Record<string, string>> = {
  // A. The Admin tabs, in the menu's order.
  A1: "Home: the needs-you list, the glance, role applications, the areas",
  A2: "Form submissions, join requests, open proposals, accept cash, snooze, undo",
  A3: "Portal visitors: entries, invitations, vouch, export",
  A4: "Feedback notes",
  A5: "Quest claims, a link only",
  A6: "Forum moderation, and the forum categories editor",
  A7: "Message reports",
  A8: "The guide's role and circle drafts",
  A9: "The village brain, the brief",
  A10: "What is failing",
  A11: "Players: stages, roles, sessions, erase prep",
  A12: "Power groups",
  A13: "Org chart: circles, roles, seating, terms, relations, onboarding path",
  A14: "Compare proposals side by side",
  A15: "Role discovery mapping",
  A16: "Role art library",
  A17: "The handover: which role holds which power",
  A18: "Voting weights",
  A19: "Team page cards",
  A20: "Make this yours, the setup wizard",
  A21: "Pages: every public page's words, and the story page switches",
  A22: "Paths and stages",
  A23: "Legal notices",
  A24: "Covenant",
  A25: "Money claims",
  A26: "Confidentiality agreement",
  A27: "Work with us, and the guide's name",
  A28: "FAQs",
  A29: "Build progress milestones",
  A30: "Visit program",
  A31: "Investor summary",
  A32: "The module library door",
  A33: "What this village is for: needs",
  A34: "Game mechanics: every dial",
  A35: "Season, and the timezone",
  A36: "Season shapes",
  A37: "Circles and map",
  A38: "Where the land is",
  A39: "Housing and reservations",
  A40: "Quests",
  A41: "Tools",
  A42: "The library module",
  A43: "Badges",
  A44: "Stays and payments",
  A45: "Exchange",
  A46: "Crowdpool",
  A47: "Calls and recordings",
  A48: "Introductions",
  A49: "Village health readings",
  A50: "Tokens, the mint desk, token jobs, org accounts",
  A51: "Ledger",
  A52: "Cash to pay out, invoices, End of Moon settings",
  A53: "Pricing desk",
  A54: "Cash budget",
  A55: "Cycle close",
  A56: "Payments and products",
  A57: "How resources flow",
  A58: "Departures, exit policy, closing policy",
  A59: "Settings: dues, land and money figures",
  A60: "Training modules",
  A61: "Investor vault, and the investor and business inbox card",
  A62: "Uploaded files",
  A63: "Calendar and events",
  A64: "Mail overview",
  A65: "Mail journeys",
  A66: "Mail words",
  A67: "Mail people",
  A68: "Letters",
  A69: "Sent mail",
  A70: "Mail settings",
  A71: "The old mail settings address",
  A72: "Integrations, signing key, voice transcription, list number, connector setup",
  // B. Pages beside Admin.
  B1: "Review: find by code",
  B2: "Review: the waiting list, every queue",
  B3: "Review: connector cards: check, accept, discard, draft, put back",
  B4: "Review: an org draft's row: decide, publish, put to the village, withdraw",
  B5: "Review: the held view",
  B6: "Review: the decided view",
  B7: "Proposal batches: accept, edit, discard, put back",
  B8: "Proposal history",
  B9: "Economy rules",
  B10: "The mint page's dials",
  B11: "Supply and settlement preview",
  // C. The road to launch.
  C1: "Launch: header and counts",
  C2: "Launch: readiness rows and fix links",
  C3: "Launch: mark done, un-confirm",
  C4: "Launch: decline, undo",
  C5: "Village economics",
  C6: "The governance canvas",
  C7: "The test run",
  C8: "Hand over powers to the village",
  C9: "Start the Game, and the steward list",
  C10: "The launch guide chat",
  C11: "Doors to the setup game and the board",
  C12: "The launch page's member view",
  C13: "The canvas-off notice",
  // D. The setup game.
  D1: "Setup game: the founder wall",
  D2: "Setup game: the view toggle",
  D3: "Setup game: layer status",
  D4: "Setup game: the journey view of every layer and seed",
  D5: "Email plot 1: the account",
  D6: "Email plot 2: the key",
  D7: "Email plot 3: the domain",
  D8: "Email plot 4: delivery reports",
  D9: "Email plot 5: the sender",
  D10: "Email plot 6: the test letter",
  D11: "Email plot 7: go live",
  D12: "Email plot 8: the key-rights check",
  D13: "Field notes",
  D14: "Waiting keys: co-sign",
  D15: "Waiting keys: decline",
  // E. The Village board.
  E1: "Board: timeline buckets, the checkbox cycle",
  E2: "Board: owner and stage controls",
  E3: "Board: deliverable notes",
  E4: "Board: kanban",
  E5: "Board: the decisions log",
  E6: "Board: discussion",
  E7: "Board: economics, a second mount",
  E8: "Board: the plan editor",
  E9: "Board: working documents",
  E10: "Board: quick links",
  // F. The setup wizard.
  F1: "Wizard: header, progress, re-run the walkthrough",
  F2: "Wizard: the guide key step",
  F3: "Wizard: profile import",
  F4: "Wizard: identity fields",
  F5: "Wizard: home headline and body",
  F6: "Wizard: noun fields",
  F7: "Wizard: the vocabulary panel",
  F8: "Wizard: the village currency",
  F9: "Wizard: the token names door",
  F10: "Wizard: site address, events address, contact email",
  F11: "Wizard: purpose statement",
  F12: "Wizard: the needs step",
  F13: "Wizard: hero picture",
  F14: "Wizard: investor picture",
  F15: "Wizard: resident picture",
  F16: "Wizard: steward picture",
  F17: "Wizard: prosperity picture",
  F18: "Wizard: master plan picture",
  F19: "Wizard: logo",
  F20: "Wizard: heart logo",
  F21: "Wizard: favicon",
  F22: "Wizard: look",
  F23: "Wizard: typography",
  F24: "Wizard: sounds",
  F25: "Wizard: identity pack",
  F26: "Wizard: menu",
  F27: "Wizard: notice words",
  F28: "Wizard: the Numbers step",
  F29: "Wizard: the Content step",
  F30: "Wizard: archetypes, power affinity",
  F31: "Wizard: the Map and styling step",
  F32: "Wizard: the Go live step",
  F33: "Wizard: the save bar",
  // G. Admin's chrome and helpers.
  G1: "The launch banner",
  G2: "Header: language, helper, night, sign out",
  G3: "The organisational memory chip",
  G4: "The Admin helper",
  G5: "The tour card",
  G6: "Gentle quests",
  G7: "The all-clear line",
  G8: "The week recap",
  G9: "Device switches",
  G10: "Simple view, show everything",
  G11: "The start-page switch",
  G12: "The proposed changes link",
  G13: "The health strip",
  G14: "Admin help",
  G15: "The module go-live card",
  G16: "The go-live package panel",
  G17: "The go-live plan",
  G18: "The brand preview panel",
  G19: "Village answers",
  G20: "The guide setup banner",
  G21: "Admin search",
  G22: "The undo bar",
  G23: "Snooze",
  G24: "The night look",
  G25: "Phone navigation",
  G26: "The nav rail",
  G27: "The organisational memory's home in Admin",
  G28: "The sign-in gate",
  G29: "The member admin view",
  G30: "Home's needs sentence, role applications, the role-progress door",
  G31: "Needs you now",
  G32: "The unified inbox",
  G33: "The six-area picker",
  // H. Other admin pages.
  H1: "Role progress",
  H2: "Module pages and the steward panel",
  H3: "The deciders' queue",
  H4: "Structure review",
  H5: "Treasury desks",
  H6: "Claim the village",
  H7: "Agent accounts",
  H8: "The approval of AI agents",
};

/** What the ledger says each section holds. */
const SECTION_SIZE: Readonly<Record<string, number>> = { A: 72, B: 11, C: 13, D: 15, E: 10, F: 33, G: 33, H: 8 };
const LEDGER_TOTAL = 195;

/** A row that is covered, with a part of it that has no act yet. Each names the part. */
const STILL_OPEN: Readonly<Record<string, string>> = {
  A6: "the forum categories editor",
  A11: "erase prep",
  A14: "the splits saved beside a comparison",
  A50: "linking a service to a role's account",
  A53: "pricing a quest",
  A57: "its rules, sources, budgets and circle treasuries",
  A61: "the investor and business inbox card",
  B3: "the check before accepting",
  B4: "putting a draft to the village",
  C6: "the canvas's other blocks",
  D5: "the step's own control",
  D6: "the step's own control",
  D7: "the step's own control",
  D8: "the step's own control",
  D9: "the step's own control",
  D10: "the step's own control",
  D11: "the step's own control",
  H1: "its own address, which is not on this base",
};

type State = "registered" | "partial" | "missing";

const covering = (id: string): AdminAct[] => ADMIN_ACTS.filter((a) => a.parity?.includes(id));

function stateOf(id: string): State {
  const acts = covering(id);
  if (!acts.length) return "missing";
  return STILL_OPEN[id] || acts.some((a) => a.partial) ? "partial" : "registered";
}

/** What was reached on 27 Nov 2026. A floor: the numbers may go up, never down. */
const FLOOR = { covered: 190, registered: 109 };

describe("how much of the parity ledger the registry covers", () => {
  const ids = Object.keys(LEDGER);
  const states = new Map(ids.map((id) => [id, stateOf(id)]));
  const count = (state: State, section?: string) => ids.filter((id) => states.get(id) === state && (!section || id[0] === section)).length;

  it("holds the whole ledger: 195 ids, each section the size the ledger says", () => {
    expect(ids).toHaveLength(LEDGER_TOTAL);
    for (const [section, size] of Object.entries(SECTION_SIZE)) {
      const got = ids.filter((id) => id[0] === section);
      expect(got, section).toHaveLength(size);
      expect(got, section).toEqual(Array.from({ length: size }, (_, i) => `${section}${i + 1}`));
    }
  });

  it("every id an act names is one the ledger has", () => {
    const known = new Set(ids);
    const unknown = ADMIN_ACTS.flatMap((a) => (a.parity ?? []).filter((id) => !known.has(id)).map((id) => `${a.id}: ${id}`));
    expect(unknown, unknown.join(", ")).toEqual([]);
  });

  it("a row marked still open is one an act covers", () => {
    for (const id of Object.keys(STILL_OPEN)) expect(covering(id).length, id).toBeGreaterThan(0);
  });

  it("prints the report and holds the floor", () => {
    const line = (name: string, total: number, section?: string) =>
      `  ${name.padEnd(8)}${String(total).padStart(5)}${String(count("registered", section)).padStart(12)}${String(count("partial", section)).padStart(9)}${String(count("missing", section)).padStart(9)}`;
    const of = (state: State) => ids.filter((id) => states.get(id) === state);
    const lines = [
      "",
      `Registry of acts: coverage of the parity ledger (${LEDGER_TOTAL} functions)`,
      `  ${"section".padEnd(8)}${"rows".padStart(5)}${"registered".padStart(12)}${"partial".padStart(9)}${"missing".padStart(9)}`,
      ...Object.entries(SECTION_SIZE).map(([section, size]) => line(section, size, section)),
      line("all", LEDGER_TOTAL),
      `  covered (registered or partial): ${count("registered") + count("partial")} of ${LEDGER_TOTAL}`,
      `  missing: ${of("missing").map((id) => `${id} ${LEDGER[id]}`).join("; ") || "none"}`,
      `  partial: ${of("partial").join(", ")}`,
      `  acts in the registry: ${ADMIN_ACTS.length} (${DIAL_ACTS.length} dials, ${SEED_ACTS.length} keys, ${ADMIN_ACTS.filter((a) => a.partial).length} marked partial)`,
      "",
    ];
    console.log(lines.join("\n"));
    expect(count("registered") + count("partial")).toBeGreaterThanOrEqual(FLOOR.covered);
    expect(count("registered")).toBeGreaterThanOrEqual(FLOOR.registered);
    expect(count("registered") + count("partial") + count("missing")).toBe(LEDGER_TOTAL);
  });
});
