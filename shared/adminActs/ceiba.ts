/**
 * THE CEIBA: the road to launch, then the record of it. The launch requirements and what is done with each, the
 * purpose statement, the test run, the steward list and the vote that starts the Game.
 *
 * Each row's power is what its own handler asks (read on 27 Nov 2026). The vote, the hand-over and every
 * confirmation stay a person's act: the class of each row is computed from the person-only lists.
 */
import { DELETE, POST, PUT, list, long, num, text, inPlace } from "./types";

const ROAD = "/journey-to-launch";

export const CEIBA_ACTS = inPlace("ceiba", [
  {
    id: "ceiba.road.read", parity: ["C1", "C2"], path: ROAD, power: "admin",
    title: "The road to launch",
    help: "Every requirement between here and the vote that starts the Game, in order.",
    synonyms: ["launch", "road to launch", "stones", "checklist", "go live", "journey to launch"],
  },
  {
    id: "ceiba.requirement.confirm", parity: ["C3", "C4"], path: ROAD, power: "admin",
    title: "Mark a launch requirement done, take that back, or decline it",
    help: "Confirm a requirement a person has to attest, take the confirmation back, or decline it on the record.",
    synonyms: ["mark done", "confirm", "un-confirm", "decline requirement", "attest"],
    route: POST("/api/admin/launch/confirm"),
    fields: [text("id", "The requirement"), text("done", "Done, not done, or declined")],
  },
  {
    id: "ceiba.purpose.save", parity: ["F11"], tab: "setup", power: "admin", holder: "story.tell",
    title: "Write the purpose statement",
    help: "The village's own sentence for what it is for.",
    synonyms: ["purpose", "purpose statement", "what we are for", "mission"],
    route: PUT("/api/admin/purpose"),
    fields: [long("statement", "The statement")],
  },
  {
    id: "ceiba.email-plot.read", parity: ["D5", "D6", "D7", "D8", "D9", "D10", "D11"], path: "/setup-game", power: "admin",
    title: "The email plot",
    help: "The steps that get the village's email working, as one plot of the setup garden.",
    synonyms: ["email plot", "set up email", "mail setup"],
  },
  {
    id: "ceiba.test-run.run", parity: ["C7"], path: ROAD, power: "signed-in",
    title: "Run the test run",
    help: "Play a number of moons forward on this village's own settings, as a rehearsal.",
    synonyms: ["test run", "dry run", "rehearse", "simulate", "practice"],
    route: POST("/api/dry-run"),
    fields: [num("moons", "How many moons")],
  },
  {
    id: "ceiba.hand-over.read", parity: ["C8"], path: ROAD, power: "signed-in",
    title: "Hand the powers to the village",
    help: "Pass the founders' powers to the village's roles. It takes two signatures and a waiting time.",
    synonyms: ["hand over", "handover", "pass powers", "two signatures", "stewards"],
    partial: true,
  },
  {
    id: "ceiba.stewards.read", parity: ["C9"], path: ROAD, power: "admin",
    title: "The steward list",
    help: "Who is put forward to hold the village's roles when the Game starts.",
    synonyms: ["steward list", "slate", "stewards", "who will lead"],
  },
  {
    id: "ceiba.vote.start", parity: ["C9"], path: ROAD, power: "founder",
    title: "Start the launch vote",
    help: "Ask the village to start its Game, with the steward list it votes on.",
    synonyms: ["start the vote", "launch vote", "start the game", "propose launch"],
    route: POST("/api/admin/launch/propose"),
    fields: [list("slate", "The steward list")],
  },
  {
    id: "ceiba.canvas.save-season", parity: ["C6", "C13"], path: ROAD, power: "story.tell",
    title: "Write the season on the canvas",
    help: "What the village means to do this season, on its canvas.",
    synonyms: ["canvas", "season canvas", "village canvas", "intentions"],
    route: PUT("/api/canvas/season"),
    partial: true,
  },
  {
    id: "ceiba.canvas.clear-season", parity: ["C6"], path: ROAD, power: "story.tell",
    title: "Clear the season from the canvas",
    help: "Take the season's words off the canvas.",
    synonyms: ["clear canvas", "reset season canvas"],
    route: DELETE("/api/canvas/season"),
  },
  {
    id: "ceiba.import.door", tab: "setup", power: "admin", parity: ["F3"],
    title: "Start from a profile file",
    help: "Bring in a project's profile file at the top of Make this yours. It fills the identity boxes, unsaved.",
    synonyms: ["import", "profile file", "bring in a file"],
    partial: true,
  },
  {
    id: "ceiba.field-notes.read", path: "/setup-game", power: "admin", parity: ["D13"],
    title: "Field notes",
    help: "The setup garden as a plain checklist, for a screen reader or anyone who would sooner read a table.",
    synonyms: ["field notes", "checklist view", "table view"],
  },
  {
    id: "ceiba.claim.village", path: "/claim", power: "anyone", parity: ["H6"],
    title: "Claim the village",
    help: "Make the first founder account of a village that has none yet.",
    synonyms: ["claim", "first founder", "claim the village", "bootstrap"],
    route: POST("/api/admin/bootstrap"),
    partial: true,
  },
]);
