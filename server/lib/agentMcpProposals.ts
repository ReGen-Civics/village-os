/**
 * THE CONNECTOR'S PROPOSAL PATH (the lead, 11 Nov 2026; shared/proposedChanges.ts).
 *
 *   propose_changes         one change or a whole batch, for a person to review on /admin/proposals
 *   read_proposal_lessons   what people changed in earlier proposals before accepting them
 *   read_proposal_queue     what waits and what was decided lately, redacted to batch, id, kind, sentence and state
 *   discard_my_proposals    put aside changes this connector filed, while they wait (two calls, like every write)
 *   read_seat_terms         a role's terms as words: never an amount, a currency or a pay shape
 *
 * A proposal changes nothing live, so it needs no confirmToken: the person's
 * accept on the review page is the decision. The connector cannot accept, and
 * cannot discard what somebody else filed: those routes refuse anything that
 * came through it, and `ALWAYS_A_PERSON` keeps them off the agent paths list.
 * It may put aside what it filed itself (the lead, 19 Nov 2026), through its
 * own route, which checks the filer in the same statement that discards.
 */
import type { ToolDef, RouteAnswer } from "./agentMcp";
import { ALIAS_WORDS, KIND_ALIAS_NAMES, KIND_WORDS, PROPOSAL_KINDS, PROPOSAL_LIMITS, normalizeCode } from "../../shared/proposedChanges";
import { CONTENT_DOCUMENTS, vocabularySlotsLine } from "../../shared/contentDocuments";

const refusal = (what: string, a: RouteAnswer) => {
  const b = (a.body && typeof a.body === "object" ? a.body : {}) as Record<string, unknown>;
  return { ok: false as const, error: `${what}: ${String(b.message ?? b.error ?? `the route answered ${a.status}`)}`, detail: b.refused ?? undefined };
};

const KINDS_LINE = [...PROPOSAL_KINDS.map((k) => `${k}: ${KIND_WORDS[k]}`), ...KIND_ALIAS_NAMES.map((k) => `${k}: ${ALIAS_WORDS[k]}`)].join(" ");
const ALL_KINDS = [...PROPOSAL_KINDS, ...KIND_ALIAS_NAMES];
const DOCS_LINE = `The village's word documents a page_content may name: ${CONTENT_DOCUMENTS.map((d) => `${d.section} (${d.label.toLowerCase()})`).join(", ")}. The vocabulary's word slots: ${vocabularySlotsLine()}.`;

export const PROPOSAL_TOOLS: readonly ToolDef[] = [
  {
    name: "propose_changes",
    scope: "admin",
    kind: "write",
    title: "Propose changes for review",
    description:
      `Puts one change, or a whole batch, in front of a person on the village's review page (/admin/proposals). Nothing changes live: the person reads each change beside what is live now, edits the words, and accepts or discards them there; accepting runs each change through its own admin route as that person. Covers every setting an admin can change. Send batch (a short title, such as Phase A content) and items, up to ${PROPOSAL_LIMITS.items}, each {kind, target, body, summary}. summary is one plain sentence a non-technical person understands. Kinds: ${KINDS_LINE} ` +
      `${DOCS_LINE} ` +
      "Any admin write route not listed is kind setting with target {method, path}; a setting that names a listed route is read as that kind. Each item is checked by its route's own validator when proposed, and the batch is refused whole, with a reason per item, when any is broken. Never proposable: secrets and integration keys, erasure, agent accounts and tokens, powers, capability grants and badges, moving value (payments, payouts, invoices, ledger, treasury, mint, settlement), seating or unseating a person, and sending letters or email. The answer carries batchCode (such as B-27), the id of each item and its code (such as B-27.2): these are the codes the review page shows in the corner of each card, so cite them with the summary, such as B-27.2 Investor page, when you tell the person which to accept. Read read_proposal_lessons first, and read_proposal_queue to see what already waits.",
    inputSchema: {
      type: "object",
      properties: {
        batch: { type: "string", description: "The batch's title, such as Phase A content. Required unless batchId is given." },
        batchId: { type: "string", description: "Add to a batch already waiting, by the id an earlier call answered." },
        items: {
          type: "array",
          maxItems: PROPOSAL_LIMITS.items,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ALL_KINDS },
              target: { type: "object", description: "What the change reaches; the shape depends on kind." },
              body: { type: "object", description: "The proposed fields." },
              summary: { type: "string", description: "One plain sentence saying what it changes." },
            },
            required: ["kind", "target", "summary"],
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
    routes: ["POST /api/admin/proposals"],
    async run(args, ctx) {
      const a = await ctx.dispatch("POST", "/api/admin/proposals", { batch: args.batch, batchId: args.batchId, items: args.items });
      if (a.status !== 200) return refusal("Nothing was proposed", a);
      return { ok: true, result: { written: false, proposed: true, ...(a.body as Record<string, unknown>) } };
    },
  },
  {
    name: "read_proposal_lessons",
    scope: "admin",
    kind: "read",
    title: "Read what people changed before accepting",
    description:
      "Answers recent proposals a person edited before accepting, grouped by kind and then by field: what was proposed, what was accepted, and the proposal's summary. Read it before drafting proposals, and write the next ones the way people accepted them. Optional kind narrows it to one kind; vocabulary reads the lessons on the village's words for things, and seat_terms those on a role's terms wording.",
    inputSchema: {
      type: "object",
      properties: { kind: { type: "string", enum: ALL_KINDS }, limit: { type: "number" } },
      additionalProperties: false,
    },
    routes: ["GET /api/admin/proposals/lessons"],
    async run(args, ctx) {
      const q = new URLSearchParams();
      if (typeof args.kind === "string") q.set("kind", args.kind);
      if (typeof args.limit === "number") q.set("limit", String(Math.floor(args.limit)));
      const a = await ctx.dispatch("GET", `/api/admin/proposals/lessons${q.toString() ? `?${q}` : ""}`);
      return a.status === 200 ? { ok: true, result: a.body } : refusal("The lessons could not be read", a);
    },
  },
  {
    name: "read_proposal_queue",
    scope: "admin",
    kind: "read",
    title: "Read the review queue",
    description:
      "Answers what waits on the review page and what was decided lately, by batch: each change's id, short code (such as B-27.2, as the review page shows it, with the batch's code, such as B-27), kind, one sentence and state (waiting, accepted or discarded), stuck when it did not land and a person looks at it, and yours when you filed it through the connector. Never a body, what is live, or who decided. Read it before proposing, so you do not file a change twice, and after, to confirm what became of yours.",
    inputSchema: { type: "object", properties: { decided: { type: "number", description: "How many recent decisions to include, up to 100. 40 when left out." } }, additionalProperties: false },
    routes: ["GET /api/admin/proposals/queue"],
    async run(args, ctx) {
      const n = typeof args.decided === "number" ? Math.max(1, Math.min(100, Math.floor(args.decided))) : null;
      const a = await ctx.dispatch("GET", `/api/admin/proposals/queue${n ? `?decided=${n}` : ""}`);
      return a.status === 200 ? { ok: true, result: a.body } : refusal("The queue could not be read", a);
    },
  },
  {
    name: "discard_my_proposals",
    scope: "admin",
    kind: "write",
    destructive: true,
    title: "Put aside proposals you filed",
    description:
      "Puts aside changes you filed through the connector that still wait, named by id or by short code, such as a draft a newer proposal replaces. Only yours (read_proposal_queue marks them), and only while they wait; it never accepts anything, and a person puts aside the others on the review page. The first call writes nothing and answers which of the ids would be put aside, with a confirmToken; call again with the same ids and the token.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", maxItems: 100, items: { type: "string" }, description: "The change ids to put aside, or their short codes (B-27.2). A batch code (B-27) names every change of yours that still waits in it." },
        confirmToken: { type: "string", description: "From the first call. Leave it out to see what would be put aside." },
      },
      required: ["ids"],
      additionalProperties: false,
    },
    routes: ["GET /api/admin/proposals/queue", "POST /api/admin/proposals/discard-mine"],
    async run(args, ctx) {
      const named = Array.isArray(args.ids) ? Array.from(new Set(args.ids.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 60)))).sort().slice(0, 100) : [];
      if (!named.length) return { ok: false, error: "Name the changes to put aside: ids or codes, from read_proposal_queue." };
      // What would be put aside, read fresh at both calls, so the token covers exactly the changes the member saw.
      const q = await ctx.dispatch("GET", "/api/admin/proposals/queue?decided=100");
      if (q.status !== 200) return refusal("The queue could not be read", q);
      const queued: Array<Record<string, unknown>> = ((q.body as { batches?: Array<{ code?: string | null; items?: Array<Record<string, unknown>> }> })?.batches ?? []).flatMap((b) => (b.items ?? []).map((i) => ({ ...i, batchCode: b.code ?? null })));
      // A code names its change; a batch code names every change in the batch. The long id still works.
      const all = queued;
      const ids = Array.from(
        new Set(
          named.flatMap((x) => {
            const code = normalizeCode(x);
            if (!code) return [x];
            const hit = queued.filter((i) => i.code === code || (!code.includes(".") && i.batchCode === code));
            return hit.length ? hit.map((i) => String(i.id)) : [x];
          }),
        ),
      )
        .sort()
        .slice(0, 100);
      const items = ids.map((id) => {
        const c = all.find((x) => x.id === id);
        const can = !!c && c.yours === true && c.state === "waiting" && c.stuck !== true;
        return { id, code: typeof c?.code === "string" ? c.code : null, summary: typeof c?.summary === "string" ? c.summary : null, willPutAside: can };
      });
      const going = items.filter((i) => i.willPutAside);
      if (!going.length) return { ok: false, error: "None of these is yours and waiting, so nothing would be put aside. A person puts aside the others on the review page.", detail: { items } };
      const echo = { putAside: going.map((i) => ({ id: i.id, code: i.code, summary: i.summary })) };
      if (args.confirmToken === undefined) {
        const { token, expiresAt } = ctx.mintConfirm("discard_my_proposals", echo);
        return {
          ok: true,
          result: { confirmRequired: true, echo, skipped: items.filter((i) => !i.willPutAside).map((i) => i.id), confirmToken: token, expiresAt, message: "Nothing was put aside. Show this to the member, and after their yes call discard_my_proposals again with the same ids and this confirmToken." },
        };
      }
      const check = ctx.verifyConfirm("discard_my_proposals", args.confirmToken, echo);
      if (!check.ok) return { ok: false, error: check.sentence, detail: { reason: check.reason } };
      const a = await ctx.dispatch("POST", "/api/admin/proposals/discard-mine", { ids: going.map((i) => i.id) });
      if (a.status !== 200) return refusal("Nothing was put aside", a);
      return { ok: true, result: { written: true, echo, ...(a.body as Record<string, unknown>) } };
    },
  },
  {
    name: "read_seat_terms",
    scope: "admin",
    kind: "read",
    title: "Read a role's terms wording",
    description:
      "Answers each role's terms on offer as words: the suggested wording a candidate reads for term, clocks, rhythm, allowance, bonus, goals, scoreboard and ending (\"\" where none is written), the commitment the role asks, and the names of the settings its offer sets. Never an amount, a currency or a pay shape. Optional roleId reads one role. To change a wording, propose_changes with kind seat_terms.",
    inputSchema: { type: "object", properties: { roleId: { type: "string" } }, additionalProperties: false },
    routes: ["GET /api/admin/proposals/seat-terms"],
    async run(args, ctx) {
      const id = typeof args.roleId === "string" ? args.roleId.trim().slice(0, 120) : "";
      const a = await ctx.dispatch("GET", `/api/admin/proposals/seat-terms${id ? `?roleId=${encodeURIComponent(id)}` : ""}`);
      return a.status === 200 ? { ok: true, result: a.body } : refusal("The terms could not be read", a);
    },
  },
];
