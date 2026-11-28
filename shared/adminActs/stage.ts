/**
 * THE STAGE: the Village board. The plan, the timeline and its owners, the kanban, decisions, working documents
 * and the build milestones.
 *
 * The board's routes ask for an admin (server/routes/journey.ts: `isJourney` is `isAdmin`). Read on 27 Nov 2026.
 */
import { DELETE, POST, PUT, list, long, num, text, inPlace, type AdminAct } from "./types";

const BOARD = "/project-history";

/**
 * The board is a story page (shared/brochure.ts): a village serves it only while its story pages are on, and they
 * start off. Every act on the board names it once, here, so a search offers them only where the page is served,
 * exactly as Find anything offers the page itself (shared/findPages.ts). The milestones live on an Admin tab.
 */
const onTheBoard = (acts: AdminAct[]): AdminAct[] => acts.map((a) => (a.path === BOARD ? { ...a, brochure: BOARD } : a));

export const STAGE_ACTS = onTheBoard(inPlace("stage", [
  {
    id: "stage.plan.save", parity: ["E8"], path: BOARD, power: "admin",
    title: "Change the village's plan",
    help: "Edit the plan the board is drawn from.",
    synonyms: ["plan", "plan editor", "village board", "command centre", "roadmap"],
    route: POST("/api/journey/plan"),
    fields: [list("plan", "The plan"), text("revision", "The version you opened")],
  },
  {
    id: "stage.timeline.owner", parity: ["E2"], path: BOARD, power: "admin",
    title: "Set where a timeline item stands",
    help: "Mark a timeline item's stage, such as started or delivered.",
    synonyms: ["timeline", "owner", "stage", "delivery status"],
    route: POST("/api/journey/owner"),
    fields: [text("id", "The item"), text("status", "Where it stands")],
  },
  {
    id: "stage.timeline.import-owners", parity: ["E2"], path: BOARD, power: "admin",
    title: "Bring in the timeline's owners",
    help: "Load who owns each timeline item from a list.",
    synonyms: ["import owners", "owners list"],
    route: POST("/api/journey/owners/import"),
    fields: [list("owners", "Owners")],
  },
  {
    id: "stage.kanban.move", parity: ["E4"], path: BOARD, power: "admin",
    title: "Move a card on the kanban",
    help: "Move a card to another column, and say who has it.",
    synonyms: ["kanban", "card", "board", "move card", "assign card"],
    route: POST("/api/journey/kanban"),
    fields: [text("id", "The card"), text("column", "Column"), text("assignee", "Who has it")],
  },
  {
    id: "stage.checklist.tick", parity: ["E1"], path: BOARD, power: "admin",
    title: "Tick an item on the board",
    help: "Mark a checklist item on the board as done or not done.",
    synonyms: ["checkbox", "tick", "checklist"],
    route: POST("/api/journey/checkbox"),
    fields: [text("id", "The item"), text("state", "Done or not")],
  },
  {
    id: "stage.decisions.record", parity: ["E5"], path: BOARD, power: "admin",
    title: "Record a decision on the board",
    help: "Say where a decision stands, what was chosen, and any notes.",
    synonyms: ["decision", "decisions", "what we chose", "decision log"],
    route: POST("/api/journey/decision"),
    fields: [text("id", "The decision"), text("status", "Where it stands"), text("chosen", "What was chosen"), long("notes", "Notes")],
  },
  {
    // A note on a timeline item is one section of the board's copy, kept under `note-<item>` (pages/ProjectHistory.tsx, saveNote).
    id: "stage.timeline.note", parity: ["E3"], path: BOARD, power: "admin",
    title: "Write a note on a timeline item",
    help: "Add or change the note under one item of the board's timeline.",
    synonyms: ["deliverable note", "timeline note", "note on an item", "delivery note"],
    route: POST("/api/journey/copy"),
    fields: [text("sectionId", "Which item's note"), long("content", "The note")],
  },
  {
    id: "stage.documents.save", parity: ["E9"], path: BOARD, power: "admin",
    title: "Change a working document",
    help: "Edit one section of the board's working documents.",
    synonyms: ["working documents", "document", "copy", "notes"],
    route: POST("/api/journey/copy"),
    fields: [text("sectionId", "Which section"), long("content", "Its words")],
  },
  {
    id: "stage.documents.links", parity: ["E9"], path: BOARD, power: "admin",
    title: "Change the board's links to documents",
    help: "The list of documents and links the board keeps to hand.",
    synonyms: ["resources", "links", "document links"],
    route: POST("/api/journey/resources"),
    fields: [list("resources", "Documents and links")],
  },
  {
    id: "stage.discussion.read", parity: ["E6"], path: BOARD, power: "admin",
    title: "The board's discussion",
    help: "Notes left on the board. Today they are kept in one browser only.",
    synonyms: ["discussion", "comments", "notes on the board"],
  },
  {
    id: "stage.milestones.add", tab: "milestones", power: "story.tell",
    title: "Add a build milestone",
    help: "Add something built or still ahead, with its phase, where it stands and a note.",
    synonyms: ["milestone", "build progress", "what was built", "progress update"],
    route: POST("/api/admin/milestones"),
    fields: [text("phase", "Phase"), text("title", "Title"), long("description", "About it"), text("status", "Where it stands"), text("completedDate", "When it was finished"), long("updateNote", "Note"), num("order", "Order")],
  },
  {
    id: "stage.milestones.edit", tab: "milestones", power: "story.tell",
    title: "Change a build milestone",
    help: "Change a milestone's words or where it stands.",
    synonyms: ["edit milestone", "update progress"],
    route: PUT("/api/admin/milestones/:id"),
    partial: true,
  },
  {
    id: "stage.milestones.remove", tab: "milestones", power: "story.tell",
    title: "Remove a build milestone",
    help: "Take a milestone off the page.",
    synonyms: ["delete milestone"],
    route: DELETE("/api/admin/milestones/:id"),
  },
  {
    id: "stage.links.read", path: BOARD, power: "admin", parity: ["E10"],
    title: "The board's quick links",
    help: "A fixed list of doors to other pages, on the board.",
    synonyms: ["quick links", "shortcuts", "doors"],
  },
]));
