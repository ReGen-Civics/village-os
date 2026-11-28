/**
 * THE STEWARDS' GET ROUTES EACH ADMIN PAGE READS, so a read route has an act that answers for it.
 *
 * A tab's page act (`tab.<key>`) carries its tab's routes as `reads`, and every act that lands on a page beside
 * Admin carries that page's (shared/adminActs.ts). The scoreboard's Endpoints count then accounts for those routes
 * (shared/gardenScore.ts).
 *
 * NOBODY TYPES THIS TABLE. It is derived from the client's own source: start at the component a tab or a page
 * draws, follow what it draws and calls, and look for each steward's GET route in that code
 * (server/testkit/pageReads.ts). It is a file only because an act is plain data and cannot read the client.
 *
 *   to regenerate   npx tsx scripts/garden-reads.ts --write
 *   held by         server/gardenReads.test.ts, which fails by name when this file and the client disagree
 *
 * Only a steward's route is ever listed: one under /api/admin/, one the permission matrix shows is admin's, or one
 * whose own handler asks for an admin or names a power only a role gives. A member's route an admin page happens to
 * call is never listed here.
 *
 * Pure: no I/O, no clock.
 */

// ── generated: do not edit below this line by hand ──

export const TAB_READS: Readonly<Record<string, readonly string[]>> = {
  "art-library": ["/api/admin/art/nature"],
  "badges-admin": ["/api/admin/badges", "/api/admin/players", "/api/examples"],
  "brain": ["/api/admin/brain"],
  "calls-admin": ["/api/admin/recordings", "/api/admin/recordings/:id", "/api/examples", "/api/roles"],
  "cash-payouts": ["/api/cash-owed/export.csv", "/api/cash-owed/invoice-track", "/api/cash-owed/queue"],
  "circles-map": ["/api/admin/map/concierge-log", "/api/admin/map/contact-log", "/api/circles", "/api/examples", "/api/roles"],
  "comms-journeys": ["/api/admin/comms/journeys", "/api/admin/comms/journeys/:key", "/api/admin/comms/journeys/:key/subjects", "/api/admin/comms/outcomes/:journeyKey", "/api/admin/comms/paths/:key"],
  "comms-letters": ["/api/admin/comms/letters"],
  "comms-people": ["/api/admin/comms/people", "/api/admin/comms/people-export", "/api/admin/comms/people/:id"],
  "comms-sent": ["/api/admin/comms/messages", "/api/admin/comms/messages/:id"],
  "comms-settings": ["/api/admin/hypha/status", "/api/admin/variables"],
  "comms-words": ["/api/admin/comms/letter-previews", "/api/admin/comms/words", "/api/admin/comms/words/:key", "/api/admin/comms/words/:key/preview"],
  "compare": ["/api/admin/proposal-compare"],
  "confidentiality": ["/api/admin/brochure-pages", "/api/admin/confidentiality/document", "/api/admin/content", "/api/admin/page-specs/kept", "/api/admin/village-paths", "/api/admin/visit-config", "/api/content/:section"],
  "covenant": ["/api/admin/brochure-pages", "/api/admin/confidentiality/document", "/api/admin/content", "/api/admin/page-specs/kept", "/api/admin/village-paths", "/api/admin/visit-config", "/api/content/:section"],
  "crowdpool-admin": ["/api/admin/crowdpool/status", "/api/admin/modules"],
  "cycles": ["/api/admin/cycles/pending"],
  "drafts": ["/api/admin/drafts"],
  "events-admin": ["/api/admin/events", "/api/admin/events/:id/rsvps", "/api/admin/events/:id/slots", "/api/admin/events/brief", "/api/admin/events/calendars", "/api/admin/events/month-names", "/api/admin/modules", "/api/events/:id/attendance", "/api/events/:id/comms", "/api/events/:id/recap", "/api/events/:id/time-poll", "/api/events/comms-access"],
  "exchange-admin": ["/api/admin/exchange", "/api/examples"],
  "exits-admin": ["/api/admin/exits", "/api/admin/players", "/api/admin/players/:id/exit-state", "/api/roles"],
  "failures": ["/api/admin/failures"],
  "feedback": ["/api/admin/feedback", "/api/admin/feedback/:id/screenshot"],
  "game-roles": ["/api/admin/capabilities/holding", "/api/admin/players", "/api/roles"],
  "governance-weights": ["/api/admin/governance/weights", "/api/admin/governance/weights/history"],
  "handover": ["/api/admin/capabilities/holding"],
  "health-admin": ["/api/examples", "/api/health/regen"],
  "home": ["/api/admin/feedback", "/api/admin/integrations", "/api/admin/launch", "/api/admin/member-tasks/bridge", "/api/admin/open-proposals", "/api/admin/org/drafts/:id/preview", "/api/admin/quest-claims", "/api/admin/review/inbox", "/api/admin/submissions", "/api/org/drafts/:id/decide"],
  "housing": ["/api/housing/availability", "/api/housing/home-types", "/api/housing/reservations"],
  "integrations": ["/api/admin/identity/signing-key", "/api/admin/integrations", "/api/admin/variables", "/api/admin/voice-transcription"],
  "intents-admin": ["/api/admin/map/concierge-log", "/api/intents/admin/demand"],
  "investor-summary": ["/api/admin/investor-summary"],
  "investor-vault": ["/api/admin/email-config", "/api/admin/investor-docs"],
  "land": ["/api/admin/land"],
  "ledger": ["/api/admin/ledger/reconciliation"],
  "legal": ["/api/admin/brochure-pages", "/api/admin/confidentiality/document", "/api/admin/content", "/api/admin/page-specs/kept", "/api/admin/village-paths", "/api/admin/visit-config", "/api/content/:section"],
  "library-admin": ["/api/admin/exchange", "/api/admin/library", "/api/admin/players", "/api/examples"],
  "menu-use": ["/api/admin/nav/usage"],
  "milestones": ["/api/admin/milestones"],
  "money": ["/api/admin/brochure-pages", "/api/admin/confidentiality/document", "/api/admin/content", "/api/admin/page-specs/kept", "/api/admin/village-paths", "/api/admin/visit-config", "/api/content/:section"],
  "needs-admin": ["/api/org"],
  "org-chart": ["/api/admin/onboarding-path", "/api/admin/org/expiring", "/api/admin/players", "/api/admin/seat-presets", "/api/org", "/api/org/seat-claims"],
  "pages": ["/api/admin/brochure-pages", "/api/admin/confidentiality/document", "/api/admin/content", "/api/admin/page-specs/kept", "/api/admin/village-paths", "/api/admin/visit-config", "/api/content/:section"],
  "paths-stages": ["/api/admin/brochure-pages", "/api/admin/confidentiality/document", "/api/admin/content", "/api/admin/page-specs/kept", "/api/admin/village-paths", "/api/admin/visit-config", "/api/content/:section"],
  "players": ["/api/admin/agent-accounts", "/api/admin/agent-accounts/full-access", "/api/admin/agent-actions", "/api/admin/agent-admin-paths", "/api/admin/agent-approvals", "/api/admin/ai-agents-approval", "/api/admin/letter-drafts", "/api/admin/member-tasks/:userId/export", "/api/admin/member-tasks/access", "/api/admin/member-tasks/bridge", "/api/admin/members/:id/email-addresses", "/api/admin/players", "/api/admin/players/detail", "/api/approval-inbox"],
  "portal-visitors": ["/api/admin/entrance/entries", "/api/admin/entrance/entries.csv", "/api/admin/visitors/invitations"],
  "products": ["/api/admin/products", "/api/examples"],
  "quests-admin": ["/api/admin/badges", "/api/examples", "/api/valuation/model"],
  "reports": ["/api/admin/forum/reports", "/api/admin/messages/reports", "/api/admin/modules"],
  "resources-admin": ["/api/admin/modules", "/api/admin/resources", "/api/admin/resources/treasuries"],
  "season": ["/api/admin/seasons"],
  "seasons-patterns": ["/api/admin/seasons/patterns", "/api/org"],
  "settings": ["/api/admin/settings"],
  "setup": ["/api/admin/archetypes", "/api/admin/brand", "/api/admin/characters/stock-art", "/api/admin/helper", "/api/admin/power-affinity", "/api/admin/purpose", "/api/admin/variables", "/api/content/:section"],
  "stays-admin": ["/api/admin/payments", "/api/admin/players", "/api/admin/stays", "/api/examples"],
  "submissions": ["/api/admin/open-proposals", "/api/admin/submission-attachments/:filename", "/api/admin/submissions", "/api/admin/submissions/hand-targets"],
  "team": ["/api/admin/brochure-pages", "/api/admin/confidentiality/document", "/api/admin/content", "/api/admin/page-specs/kept", "/api/admin/village-paths", "/api/admin/visit-config", "/api/content/:section"],
  "tokens": ["/api/admin/brand", "/api/admin/mint-requests", "/api/admin/players", "/api/admin/token-jobs", "/api/admin/tokens", "/api/examples"],
  "tools-admin": ["/api/admin/modules", "/api/admin/tools", "/api/examples", "/api/roles"],
  "training-modules": ["/api/admin/training-modules"],
  "uploaded-files": ["/api/admin/uploads/orphans"],
  "variables": ["/api/admin/variables"],
  "work-with-us": ["/api/admin/work-with-us-config"],
};

export const PATH_READS: Readonly<Record<string, readonly string[]>> = {
  "/admin/mint": ["/api/admin/economy", "/api/admin/variables", "/api/content/:section", "/api/org/founding-team"],
  "/admin/review": ["/api/admin/events", "/api/admin/events/calendars", "/api/admin/org/drafts/:id/preview", "/api/admin/proposals", "/api/admin/proposals/held", "/api/admin/review/find", "/api/admin/review/inbox", "/api/content/:section", "/api/org/drafts/:id/decide", "/api/org/founding-team", "/api/review/queue", "/api/saberra/differences", "/api/saberra/differences/count"],
  "/admin/role-progress": ["/api/content/:section", "/api/org/founding-team", "/api/role-measures"],
  "/claim": ["/api/content/:section", "/api/org/founding-team"],
  "/governance/decisions": ["/api/content/:section", "/api/governance/standing", "/api/org/founding-team"],
  "/governance/treasury": ["/api/admin/mint-requests", "/api/cash-owed/export.csv", "/api/cash-owed/invoice-track", "/api/cash-owed/queue", "/api/content/:section", "/api/org/founding-team", "/api/treasury/mint-options"],
  "/governance/work": ["/api/admin/quest-claims", "/api/admin/quest-claims/owed", "/api/approval-inbox", "/api/content/:section", "/api/org", "/api/org/drafts/:id/decide", "/api/org/founding-team", "/api/review/erasure", "/api/review/queue", "/api/saberra/differences", "/api/saberra/differences/count"],
  "/journey-to-launch": ["/api/admin/command-centre", "/api/admin/launch", "/api/admin/launch/steward-candidates", "/api/canvas", "/api/canvas/blocks/:id", "/api/canvas/moon", "/api/canvas/season", "/api/content/:section", "/api/documents", "/api/documents/:id", "/api/documents/:id/file", "/api/org/founding-team"],
  "/modules": ["/api/admin/modules", "/api/content/:section", "/api/modules/catalog", "/api/org/founding-team"],
  "/network": ["/api/admin/network/peers", "/api/content/:section", "/api/examples", "/api/org/founding-team"],
  "/powers": ["/api/content/:section", "/api/org/founding-team"],
  "/profile": ["/api/admin/org-redemptions", "/api/admin/quest-claims", "/api/cash-owed/queue", "/api/content/:section", "/api/events", "/api/org/drafts/:id/decide", "/api/org/founding-team", "/api/people/:handle/role-card", "/api/roles/:id/tensions", "/api/sessions", "/api/sessions/tasks/count"],
  "/project-history": ["/api/admin/command-centre", "/api/content/:section", "/api/journey/state", "/api/org/founding-team"],
  "/setup-game": ["/api/content/:section", "/api/org/founding-team"],
};
