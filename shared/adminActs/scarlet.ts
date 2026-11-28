/**
 * SCARLET: the village's guide. Her dock, the two guides on the road to launch, and what she has learned about
 * the village. Her drafts are decided in the Hall (shared/adminActs/hall.ts) and her own key is one of the keys
 * the Spring plants (shared/adminActs/derived.ts).
 *
 * Each row's power is what its own handler asks (read on 27 Nov 2026).
 */
import { POST, PUT, list, long, inPlace } from "./types";

export const SCARLET_ACTS = inPlace("scarlet", [
  {
    id: "scarlet.dock.ask", parity: ["G4"], tab: "home", power: "admin",
    title: "Ask the guide",
    help: "Ask the village's guide where something is in Admin, or what a setting does.",
    synonyms: ["guide", "helper", "assistant", "ask", "help me"],
    route: POST("/api/admin/helper/ask"),
    fields: [list("messages", "What was said so far")],
  },
  {
    id: "scarlet.guide.launch", parity: ["C10"], path: "/journey-to-launch", power: "admin", holder: "operator.config",
    title: "Ask the launch guide",
    help: "Talk the road to launch through with the guide.",
    synonyms: ["launch guide", "launch help", "what is next for launch"],
    route: POST("/api/admin/assistant/launch"),
    fields: [list("messages", "What was said so far")],
  },
  {
    id: "scarlet.guide.organize", parity: ["C10"], path: "/journey-to-launch", power: "admin", holder: "operator.config",
    title: "Ask the guide to help organize the village",
    help: "Talk through circles and roles with the guide. What she drafts waits for a person to accept.",
    synonyms: ["organize guide", "organise", "draft roles", "draft circles"],
    route: POST("/api/admin/assistant/organize"),
    fields: [list("messages", "What was said so far")],
  },
  {
    id: "scarlet.brain.save", tab: "brain", power: "story.tell",
    title: "Change what the guide knows about the village",
    help: "Edit one section of the village's brief, which the guide reads before she answers.",
    synonyms: ["village brain", "brief", "what the guide knows", "memory", "teach the guide"],
    route: PUT("/api/admin/brain/:section"),
    fields: [long("body", "The section's words")],
  },
  {
    id: "scarlet.brain.confirm", tab: "brain", power: "story.tell",
    title: "Confirm a section of the village's brief",
    help: "Say that a section of the brief is still true as it stands.",
    synonyms: ["confirm brief", "still true", "review brief"],
    route: POST("/api/admin/brain/:section/confirm"),
  },
  {
    id: "scarlet.name.set", tab: "work-with-us", power: "admin", holder: "story.tell",
    title: "Name the village's guide",
    help: "The name the guide answers to in this village.",
    synonyms: ["guide name", "assistant name", "rename the guide"],
    route: PUT("/api/admin/work-with-us-config"),
    partial: true,
  },
  {
    id: "scarlet.memory.link", tab: "modules", power: "admin", parity: ["G3", "G27"],
    title: "The way to the organisational memory board",
    help: "A chip in the Admin header that opens the organisational memory board, and the screen that brings you back.",
    synonyms: ["memory board", "organisational memory", "organizational memory"],
  },
  {
    id: "scarlet.setup.banner", tab: "home", power: "admin", parity: ["G20"],
    title: "Set up your guide first",
    help: "A notice at the top of Home and Make this yours while no guide can answer. It leads to the guide's key.",
    synonyms: ["ai setup", "guide key", "set up the guide", "no guide"],
  },
]);
