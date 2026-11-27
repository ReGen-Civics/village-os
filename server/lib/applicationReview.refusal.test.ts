/**
 * NO AI IN SELECTION (role journey L5, Rye's rule): no companion, guide, agent
 * or Sera tool reads an application, a score, an interview note or the terms
 * on one. Each case below has a control that fails for the reason claimed.
 *
 * Two kinds of proof, because one alone can lie:
 *  - behaviour: the tool tables and the admin-path rule refuse the reads;
 *  - structure: no source a model can reach names the review tables or doors,
 *    and the review's own files import no model client.
 * The structural scan is itself tested on planted text, so an empty result
 * means the scan looked, not that it was blind.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SELECTION_IS_HUMAN } from "../../shared/applicationReview";
import { adminRequestDecision, DEFAULT_AGENT_ADMIN_PATHS } from "../../shared/agentAdmin";
import { MCP_TOOLS } from "./agentMcp";
import { runSeraTool, SERA_TOOLS, type SeraActor } from "./seraAgent";

const ROOT = path.resolve(__dirname, "..", "..");

/** What a model-facing source must never name. */
const FORBIDDEN = [...SELECTION_IS_HUMAN, "applicationReview", "applicantOnboarding", "scorecards", "walkthrough", "/applications/", "interviewer_roles", "selection_criteria", "application_guide_notes", "conversationGuide", "applicationGuide", "guide-notes", "application_conversation_notes", "conversationNotes", "applicationConversationNotes", "conversation-notes", "conversationNoteFiles"];

export function namesForbidden(source: string): string[] {
  return FORBIDDEN.filter((f) => source.includes(f));
}

/** Every file a companion, the guide, an agent token or Sera can run through. */
const MODEL_FACING = [
  "server/lib/companions.ts",
  "server/lib/companionSera.ts",
  "server/lib/roleGuide.ts",
  "server/lib/roleGuideContext.ts",
  "server/lib/saberraGuide.ts",
  "server/lib/seraAgent.ts",
  "server/lib/agentMcp.ts",
  "server/lib/agentInbox.ts",
  "server/lib/agentProfile.ts",
  "shared/companionItems.ts",
  "shared/agentAdmin.ts",
  "shared/seraBridgeBoard.ts",
];

describe("the scan sees what it is told to look for", () => {
  it("CONTROL: planted text naming a review table or door is found", () => {
    expect(namesForbidden("select * from application_scores")).toContain("application_scores");
    expect(namesForbidden("GET /api/governance/applications/:ref/scorecards")).toEqual(expect.arrayContaining(["scorecards", "/applications/"]));
    expect(namesForbidden("a harmless line")).toEqual([]);
    // The onboarding stage (0412): the references table, its module and its door.
    expect(namesForbidden("DELETE FROM application_references")).toContain("application_references");
    expect(namesForbidden('import { walkthroughFor } from "./applicantOnboarding"')).toEqual(expect.arrayContaining(["applicantOnboarding", "walkthrough"]));
    // The conversation guide (0417): its notes table, its repo, its rules and its door.
    expect(namesForbidden("SELECT note FROM application_guide_notes")).toContain("application_guide_notes");
    expect(namesForbidden('import { guideItems } from "../../shared/conversationGuide"')).toContain("conversationGuide");
    expect(namesForbidden('import * as g from "../repos/applicationGuide"')).toContain("applicationGuide");
    expect(namesForbidden("POST /api/governance/applications/:ref/guide-notes")).toContain("guide-notes");
    // Each conversation's private notes (0442): the table, its rules, its repo, its files and its door.
    expect(namesForbidden("SELECT body FROM application_conversation_notes")).toContain("application_conversation_notes");
    expect(namesForbidden('import { NOTES_WORDS } from "../../shared/conversationNotes"')).toContain("conversationNotes");
    expect(namesForbidden('import * as n from "../repos/applicationConversationNotes"')).toContain("applicationConversationNotes");
    expect(namesForbidden("GET /api/governance/applications/:ref/conversation-notes/:id/file")).toContain("conversation-notes");
  });
});

describe("no model-facing source names the review", () => {
  for (const file of MODEL_FACING) {
    it(`${file}`, () => {
      const full = path.join(ROOT, file);
      expect(fs.existsSync(full), `${file} should exist; update this list if it moved`).toBe(true);
      expect(namesForbidden(fs.readFileSync(full, "utf8"))).toEqual([]);
    });
  }
});

describe("the review's own files call no model", () => {
  const OWN = [
    "server/lib/applicationReview.ts",
    "server/routes/applicationReview.ts",
    "server/repos/applicationReview.ts",
    "shared/applicationReview.ts",
    // Shortlist, references, follow-up owners and the gathered view (0412).
    "server/lib/applicantOnboarding.ts",
    "server/routes/applicantOnboarding.ts",
    "server/repos/applicantOnboarding.ts",
    "shared/applicantOnboarding.ts",
    // The conversation guide's notes (0417): written and read by people, never by a model.
    "server/repos/applicationGuide.ts",
    "shared/conversationGuide.ts",
  ];
  const MODEL_IMPORT = /anthropic|openai|saberra|seraAgent|companions|roleGuide|llm|generateText|messages\.create/i;
  for (const file of OWN) {
    it(`${file} imports no model client`, () => {
      const imports = fs
        .readFileSync(path.join(ROOT, file), "utf8")
        .split("\n")
        .filter((l) => /^\s*import\b/.test(l));
      expect(imports.filter((l) => MODEL_IMPORT.test(l))).toEqual([]);
    });
  }
  it("CONTROL: the import filter does catch a model import", () => {
    expect(['import Anthropic from "@anthropic-ai/sdk";'].filter((l) => MODEL_IMPORT.test(l))).toHaveLength(1);
  });
});

describe("the agent tool tables are refused the reads", () => {
  it("no MCP tool reaches an application, a score or an interview", () => {
    const routes = MCP_TOOLS.flatMap((t) => t.routes);
    expect(routes.length).toBeGreaterThan(5);
    expect(routes.filter((r) => /applications\/|open-proposals|application-status|scorecards|recuse|walkthrough|references|shortlist|final-conversation|guide-notes/.test(r))).toEqual([]);
  });
  it("CONTROL: the same filter does match a route that would read them", () => {
    expect(["GET /api/governance/applications/:ref/scorecards"].filter((r) => /applications\/|scorecards/.test(r))).toHaveLength(1);
    // And a member's own references door (`sa-` refs, a first long-term role).
    expect(["GET /api/governance/applications/:ref/references/mine"].filter((r) => /applications\/|references/.test(r))).toHaveLength(1);
  });
  it("admin_request refuses the review's doors, whatever the village's list holds", () => {
    const doc = DEFAULT_AGENT_ADMIN_PATHS;
    for (const p of [
      "/api/governance/applications/op-0123456789abcdef0123/scorecards",
      "/api/application-status/op-0123456789abcdef0123",
      "/api/governance/open-proposals/op-0123456789abcdef0123",
      // The onboarding doors: the walkthrough (references, notes, scorecards), the shortlist and the references.
      "/api/governance/applications/op-0123456789abcdef0123/walkthrough",
      "/api/governance/applications/op-0123456789abcdef0123/shortlist",
      "/api/governance/applications/op-0123456789abcdef0123/references/1/notes",
      "/api/application-status/op-0123456789abcdef0123/references",
      // A member's own application for a first long-term role (the lead, 19 Nov 2026): its walkthrough, the member's
      // count of their references and the door they give them through.
      "/api/governance/applications/sa-0123456789abcdef/walkthrough",
      "/api/governance/applications/sa-0123456789abcdef/references/mine",
      "/api/governance/applications/sa-0123456789abcdef/references",
      "/api/governance/applications/sa-0123456789abcdef/references/1/notes",
      // The conversation guide's notes (0417): the reviewers' words against the role's criteria.
      "/api/governance/applications/op-0123456789abcdef0123/guide-notes",
    ]) {
      expect(adminRequestDecision("GET", p, doc, "u1").ok, p).toBe(false);
    }
    // CONTROL: a path the list does hold is allowed, so the refusals above are about the path.
    expect(adminRequestDecision("GET", "/api/admin/member-tasks/access", doc, "u1").ok).toBe(true);
  });
});

describe("Sera's tools", () => {
  const actor: SeraActor = { userId: "u-sera", tokenId: "atk-sera", tokenPrefix: "vat_sera" };
  const deps = { listDefault: true, today: "2026-11-09" } as any;
  it("has no tool that names the review", () => {
    expect(SERA_TOOLS.length).toBeGreaterThan(0);
    expect(SERA_TOOLS.filter((t) => /application|score|interview|applicant|reference|shortlist|onboard/i.test(t))).toEqual([]);
  });
  it("refuses a request to read applications, scores or interviews before touching anything", async () => {
    const pool = new Proxy({}, { get: () => { throw new Error("the pool was touched"); } }) as any;
    for (const tool of ["read_applications", "list_application_scores", "get_scorecards", "summarise_candidates", "rank_applicants", "read_references", "shortlist_applicants", "summarise_follow_ups"]) {
      const out = await runSeraTool(pool, actor, tool as any, {}, deps);
      expect(out.ok, tool).toBe(false);
      expect((out as any).error).toMatch(/no such Sera tool/);
    }
  });
});

describe("the conversation guide's notes are read and written by people alone (0417)", () => {
  const GUIDE_FILES = ["server/repos/applicationGuide.ts", "shared/conversationGuide.ts"];
  it("the guide's own files exist and import no model client", () => {
    const MODEL_IMPORT = /anthropic|openai|saberra|seraAgent|companions|roleGuide|llm|generateText|messages\.create/i;
    for (const file of GUIDE_FILES) {
      const full = path.join(ROOT, file);
      expect(fs.existsSync(full), file).toBe(true);
      const imports = fs.readFileSync(full, "utf8").split("\n").filter((l) => /^\s*import\b/.test(l));
      expect(imports.filter((l) => MODEL_IMPORT.test(l)), file).toEqual([]);
    }
  });
  it("the guide's door is not one an agent token can reach, whatever the village's admin list holds", () => {
    for (const method of ["GET", "POST"]) {
      expect(adminRequestDecision(method, "/api/governance/applications/op-0123456789abcdef0123/guide-notes", DEFAULT_AGENT_ADMIN_PATHS, "u1").ok, method).toBe(false);
    }
  });
  it("no MCP tool and no Sera tool names the guide", () => {
    expect(MCP_TOOLS.flatMap((t) => t.routes).filter((r) => /guide-notes/.test(r))).toEqual([]);
    expect(SERA_TOOLS.filter((t) => /guide|note/i.test(t) && /application|applicant|review|criteri/i.test(t))).toEqual([]);
  });
  it("walkthroughFor's guide has no score, level, rank or rating field in its shape", () => {
    const src = fs.readFileSync(path.join(ROOT, "shared/conversationGuide.ts"), "utf8");
    const shape = src.slice(src.indexOf("export interface GuideItem"), src.indexOf("export function guideItems")) + src.slice(src.indexOf("export interface GuideNoteView"));
    expect(shape).toContain("key: string");
    expect(shape.match(/\b(score|level|rank|rating|grade)\w*\s*[?:]/gi) ?? []).toEqual([]);
    // CONTROL: the same pattern does match a field that would hold one.
    expect("  level: number;".match(/\b(score|level|rank|rating|grade)\w*\s*[?:]/gi)).toHaveLength(1);
  });
});

describe("comparing proposals side by side maps work and never judges people (the lead, 20 Nov 2026)", () => {
  const COMPARE_FILES = ["shared/proposalCompare.ts", "shared/deliverableSplit.ts", "server/lib/proposalCompare.ts", "server/routes/proposalCompare.ts", "client/src/components/admin/CompareTab.tsx", "server/repos/proposalStamps.ts", "shared/commitmentLimit.ts", "server/lib/commitmentLimit.ts"];
  const MODEL_IMPORT = /anthropic|openai|saberra|seraAgent|companions|roleGuide|adminHelper|assistant|llm|generateText|messages\.create/i;
  const RANKING = /\b(score|rank|rating|grade|merit|best|recommend)\w*\s*[?:]/gi;

  it("the compare files exist and import no model client, the admin helper included", () => {
    for (const file of COMPARE_FILES) {
      const full = path.join(ROOT, file);
      expect(fs.existsSync(full), file).toBe(true);
      const imports = fs.readFileSync(full, "utf8").split("\n").filter((l) => /^\s*import\b/.test(l));
      expect(imports.filter((l) => MODEL_IMPORT.test(l)), file).toEqual([]);
    }
  });

  it("CONTROL: the import filter catches the admin helper's own client", () => {
    expect(['import { askHelper } from "./adminHelperApi";'].filter((l) => MODEL_IMPORT.test(l))).toHaveLength(1);
  });

  it("no source a model can reach names the compare files or their door", () => {
    for (const file of MODEL_FACING) {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      // shared/agentAdmin.ts names the door once, to refuse it.
      const named = ["proposalCompare", "deliverableSplit", "CompareTab", "proposalStamps", "heldSplit"].filter((n) => src.includes(n));
      expect(named, file).toEqual([]);
    }
    expect(MCP_TOOLS.flatMap((t) => t.routes).filter((r) => /proposal-?compare/.test(r))).toEqual([]);
    expect(SERA_TOOLS.filter((t) => /compare|split|candidate|deliverable/i.test(t))).toEqual([]);
  });

  it("admin_request refuses the compare door always, even once the Anchor opens applicant data to agents", () => {
    for (const opts of [{}, { applicantDataOpen: true }]) {
      const d = adminRequestDecision("GET", "/api/admin/proposal-compare", { ...DEFAULT_AGENT_ADMIN_PATHS, paths: [...DEFAULT_AGENT_ADMIN_PATHS.paths, { method: "GET", path: "/api/admin/proposal-compare" } as any] }, "u1", opts as any);
      expect(d.ok, JSON.stringify(opts)).toBe(false);
      expect((d as any).code).toBe("always_a_person");
    }
    // The saved split's doors (the lead, 20 Nov 2026): never read or written by an agent, whatever is listed or approved.
    for (const [m, p] of [["POST", "/api/admin/proposal-compare/split"], ["GET", "/api/admin/proposal-compare/held/op-0123456789abcdef0123"], ["GET", "/api/admin/proposal-compare/held/sa-0123456789abcdef"]] as const) {
      for (const opts of [{}, { applicantDataOpen: true, leadApprovedWrites: true }]) {
        const d = adminRequestDecision(m, p, { ...DEFAULT_AGENT_ADMIN_PATHS, paths: [...DEFAULT_AGENT_ADMIN_PATHS.paths, { method: m, path: p, confirm: "agent" } as any] }, "u1", opts as any);
        expect(d.ok, `${m} ${p} ${JSON.stringify(opts)}`).toBe(false);
        expect((d as any).code).toBe("always_a_person");
      }
    }
    // CONTROL: the open proposals desk itself does open to an agent once the Anchor approves and the village lists it.
    const desk = adminRequestDecision("GET", "/api/admin/open-proposals", { ...DEFAULT_AGENT_ADMIN_PATHS, paths: [...DEFAULT_AGENT_ADMIN_PATHS.paths, { method: "GET", path: "/api/admin/open-proposals" } as any] }, "u1", { applicantDataOpen: true } as any);
    expect(desk.ok).toBe(true);
  });

  it("the shapes the comparison and the split hand back hold no score, rank, rating or recommendation", () => {
    for (const file of ["shared/proposalCompare.ts", "shared/deliverableSplit.ts"]) {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      const shapes = src.split(/\n(?=export (?:interface|type) )/).filter((b) => /^export (interface|type) /.test(b)).map((b) => b.slice(0, b.indexOf("\n}") + 2 || undefined)).join("\n");
      expect(shapes.length, file).toBeGreaterThan(200);
      expect(shapes.match(RANKING) ?? [], file).toEqual([]);
    }
    // CONTROL: the same pattern does match a field that would hold one.
    expect("  rank: number;\n  recommended?: boolean;".match(RANKING)).toHaveLength(2);
  });

  it("the split reads only deliverables and commitments: the same work under other people's names maps the same way", async () => {
    const { mapDeliverables } = await import("../../shared/deliverableSplit");
    const work = [
      { deliverables: ["Keep the seed bank catalogued", "Run the weekly garden circle"], commitmentPct: 50 },
      { deliverables: ["Run the weekly garden circle", "Plan the dry season planting"], commitmentPct: 50 },
    ];
    const one = mapDeliverables(work.map((w, i) => ({ key: `Q7Q${i}`, ...w })), ["Q7Q0", "Q7Q1"], [], 100);
    const two = mapDeliverables(work.map((w, i) => ({ key: `W9W${i}`, ...w })), ["W9W0", "W9W1"], [], 100);
    const strip = (m: typeof one, prefix: string) => JSON.stringify(m).split(prefix).join("X");
    expect(strip(one, "Q7Q")).toBe(strip(two, "W9W"));
    // Extra facts about a person are not even accepted: the candidate shape is a key, deliverables and a commitment.
    const src = fs.readFileSync(path.join(ROOT, "shared/deliverableSplit.ts"), "utf8");
    const shape = src.slice(src.indexOf("export interface SplitCandidate"), src.indexOf("}", src.indexOf("export interface SplitCandidate")));
    expect(shape.match(/^\s+(\w+)\??:/gm)?.map((l) => l.trim().replace(/\??:$/, ""))).toEqual(["key", "deliverables", "commitmentPct"]);
  });

  it("the compare page reads its own door and writes one thing, the saved split, to its own door", () => {
    const page = fs.readFileSync(path.join(ROOT, "client/src/components/admin/CompareTab.tsx"), "utf8");
    // The one write (the lead, 20 Nov 2026): the saved split. No adopt, decline, terms or send door is called.
    expect(page.match(/method:\s*"(POST|PUT|PATCH|DELETE)"/g) ?? []).toEqual(['method: "POST"']);
    expect(page.match(/fetch\(/g)).toHaveLength(2);
    expect(Array.from(page.matchAll(/\{API_BASE\}([^`]*)`/g), (m) => m[1])).toEqual(["/admin/proposal-compare", "/admin/proposal-compare/split"]);
    expect(page).not.toMatch(/\/adopt|\/decline|\/terms|\/invite|\/send/);
    // CONTROL: the write pattern does match a write.
    expect('{ method: "POST" }'.match(/method:\s*"(POST|PUT|PATCH|DELETE)"/g)).toHaveLength(1);
  });
});
