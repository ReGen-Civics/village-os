/**
 * THE SPRING: health. The launch requirements checked live, the connections and their keys, the signing key, what
 * is failing, and the agent accounts. Every key a village plants is here too, by derivation from the setup seeds
 * (shared/adminActs/derived.ts), and each reads its seed's own consequence line.
 *
 * Each row's power is what its own handler asks (read on 27 Nov 2026).
 */
import { POST, PUT, bool, long, text, inPlace } from "./types";

export const SPRING_ACTS = inPlace("spring", [
  {
    id: "spring.launch.checks", parity: ["C2"], path: "/journey-to-launch", power: "admin",
    title: "The launch requirements, checked live",
    help: "Every launch requirement with what proves it, read fresh each time the page opens.",
    synonyms: ["launch requirements", "health", "checks", "what is green", "proof"],
  },
  {
    id: "spring.connections.strip", parity: ["G13"], tab: "integrations", power: "admin",
    title: "The connections strip",
    help: "One line for each outside service: connected, or what it still needs.",
    synonyms: ["connections", "status", "is it connected", "health strip"],
  },
  {
    id: "spring.seeds.proof", parity: ["D3", "D4"], path: "/setup-game", power: "admin",
    title: "The setup seeds and what proves each one",
    help: "Every key and setting the village plants, with whether it is alive, only present, or still to do.",
    synonyms: ["setup seeds", "seeds", "garden", "proof states", "what is planted"],
  },
  {
    id: "spring.signing-key.rotate", tab: "integrations", power: "admin",
    title: "Replace the village's signing key",
    help: "Make a new key for signing what the village sends other villages. It asks you to confirm first.",
    synonyms: ["signing key", "rotate key", "identity key", "new signing key"],
    route: POST("/api/admin/identity/signing-key/rotate"),
    fields: [text("confirm", "The words that confirm it")],
  },
  {
    id: "spring.signing-key.decline", tab: "integrations", power: "admin",
    title: "Decline a signing key replacement that waits",
    help: "Refuse a new signing key another admin asked for.",
    synonyms: ["decline rotation", "refuse new key"],
    route: POST("/api/admin/identity/signing-key/rotate/decline"),
  },
  {
    id: "spring.voice.choose", tab: "integrations", power: "operator.secrets",
    title: "Choose who writes down voice recordings",
    help: "Which service turns an applicant's recording into text.",
    synonyms: ["voice transcription", "transcribe", "whisper", "speech to text"],
    route: PUT("/api/admin/voice-transcription"),
    fields: [text("choice", "The service")],
  },

  // ── Agent accounts ───────────────────────────────────────────────────────
  {
    id: "spring.agents.set-account", parity: ["H7"], tab: "players", power: "admin",
    title: "Mark an account as an agent's",
    help: "Say that an account belongs to a software agent, or that it is a person's again.",
    synonyms: ["agent account", "bot account", "software agent", "ai agent"],
    route: PUT("/api/admin/players/:id/agent"),
    fields: [bool("isAgent", "This account is an agent's")],
  },
  {
    id: "spring.agents.paths", parity: ["H7"], tab: "players", power: "admin",
    title: "Set which admin paths an agent may call",
    help: "The list of admin paths open to agents, and who confirms each write.",
    synonyms: ["agent paths", "agent permissions", "connector paths", "allow list"],
    route: PUT("/api/admin/agent-admin-paths"),
    partial: true,
  },
  {
    id: "spring.agents.full-access", parity: ["H7"], tab: "players", power: "admin",
    title: "Give one role's agent full access",
    help: "Name the one role whose holder's agent may reach admin paths on that person's yes.",
    synonyms: ["full access", "super agent", "agent for my role"],
    route: PUT("/api/admin/agent-accounts/full-access"),
    partial: true,
  },
  {
    id: "spring.agents.reads-open", parity: ["H7"], tab: "players", power: "admin",
    title: "Let the full-access agent read without asking",
    help: "Whether the full-access role's agent reads without the saved list. Writes still ask.",
    synonyms: ["reads open", "agent reads", "read without permission"],
    route: PUT("/api/admin/agent-accounts/full-access/reads-open"),
    partial: true,
  },
  {
    id: "spring.agents.undo", parity: ["H7"], tab: "players", power: "admin",
    title: "Undo something an agent did",
    help: "Take back one recorded act of an agent.",
    synonyms: ["undo agent", "agent actions", "reverse agent change"],
    route: POST("/api/admin/agent-actions/:id/undo"),
  },
  {
    id: "spring.agents.approval", parity: ["H8"], tab: "players", power: "admin",
    title: "Record the village's approval of AI agents",
    help: "Record that the village approves AI agents reading applicant and member data, or take that back, with a note.",
    synonyms: ["ai agents approval", "approve agents", "anchor approval", "applicant data"],
    route: PUT("/api/admin/ai-agents-approval"),
    fields: [bool("approved", "Approved"), long("note", "Note")],
  },
]);
