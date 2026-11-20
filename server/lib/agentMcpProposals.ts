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
 *
 *   accept_proposals        FULL ACCESS ONLY (the lead, 20 Nov 2026; shared/agentFullAccess.ts): accept or discard
 *                           waiting changes as the review page does, as the holder, once the approval note names
 *                           the batch code or every change's code. Its route checks the switch, the seat, the note
 *                           and the floor again, and refuses every other caller.
 */
import type { ToolDef, RouteAnswer } from "./agentMcp";
import { ALIAS_WORDS, KIND_ALIAS_NAMES, KIND_WORDS, PROPOSAL_KINDS, PROPOSAL_LIMITS, normalizeCode } from "../../shared/proposedChanges";
import { CONTENT_DOCUMENTS, vocabularySlotsLine } from "../../shared/contentDocuments";
import { ACCEPT_PROPOSAL_WORDS, approvalCovers, FULL_ACCESS_WORDS } from "../../shared/agentFullAccess";
import { readLeadApproval } from "../../shared/agentAdmin";

/** The connector's own door for accepting as the holder, full access only (server/routes/proposedChanges.ts). */
export const ACCEPT_AS_HOLDER_PATH = "/api/admin/proposals/accept-as-holder";

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
    name: "accept_proposals",
    scope: "admin",
    kind: "write",
    destructive: true,
    title: "Accept or discard proposals (full access)",
    description:
      "Only for the agent of whoever holds the role a person named for full access in Admin, Players, Agents; for every other connector it refuses. Accepts or discards changes waiting on the review page, exactly as the page's Accept or Discard does, as the holder, so each change runs through its own route and the holder's own checks. Name a batch (batchId, its id or its code such as B-66) or the changes (itemIds, ids or codes such as B-66.2), and action accept or discard. The first call writes nothing and lists every change with its code and summary, and a confirmToken. " +
      ACCEPT_PROPOSAL_WORDS.note +
      " Call again with the same batch or items, the confirmToken, approvedBy and approvalNote. The answer says per change what landed.",
    inputSchema: {
      type: "object",
      properties: {
        batchId: { type: "string", description: "A batch's id or its code, such as B-66: every change of it that waits." },
        itemIds: { type: "array", maxItems: 100, items: { type: "string" }, description: "Changes by id or code, such as B-66.2." },
        action: { type: "string", enum: ["accept", "discard"] },
        approvedBy: { type: "string", description: "Second call: who approved it in the chat." },
        approvalNote: { type: "string", description: "Second call: their approval, quoted, naming the batch code or every change's code." },
        confirmToken: { type: "string", description: "From the first call. Leave it out to see what would happen." },
      },
      required: ["action"],
      additionalProperties: false,
    },
    routes: ["GET /api/admin/proposals/queue", `POST ${ACCEPT_AS_HOLDER_PATH}`],
    async run(args, ctx) {
      if (!ctx.fullAccess || !(await ctx.fullAccess.on())) return { ok: false, error: `${FULL_ACCESS_WORDS.notOn} A person accepts on the review page, /admin/proposals.` };
      const action = args.action === "accept" || args.action === "discard" ? args.action : null;
      if (!action) return { ok: false, error: "action is accept or discard." };
      const batchArg = typeof args.batchId === "string" ? args.batchId.trim().slice(0, 60) : "";
      const named = Array.isArray(args.itemIds) ? Array.from(new Set(args.itemIds.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 60)))) : [];
      if (!batchArg && !named.length) return { ok: false, error: "Name a batch (batchId, or its code such as B-66) or the changes (itemIds)." };
      // The queue, read fresh at both calls, so the token covers exactly the changes the person saw listed.
      const q = await ctx.dispatch("GET", "/api/admin/proposals/queue?decided=1");
      if (q.status !== 200) return refusal("The queue could not be read", q);
      const batches = ((q.body as { batches?: Array<{ batchId?: string; code?: string | null; items?: Array<Record<string, unknown>> }> })?.batches ?? []);
      const waiting = batches.flatMap((b) => (b.items ?? []).filter((i) => i.state === "waiting").map((i) => ({ id: String(i.id ?? ""), code: typeof i.code === "string" ? i.code : null, summary: typeof i.summary === "string" ? i.summary : "", kind: typeof i.kind === "string" ? i.kind : "", stuck: i.stuck === true, batchId: String(b.batchId ?? ""), batchCode: b.code ?? null })));
      const batchCode = batchArg ? normalizeCode(batchArg) : null;
      const picked = waiting.filter((i) => {
        if (batchArg && (i.batchId === batchArg || (!!batchCode && i.batchCode === batchCode))) return true;
        return named.some((n) => n === i.id || (!!normalizeCode(n) && (normalizeCode(n) === i.code || (!normalizeCode(n)!.includes(".") && normalizeCode(n) === i.batchCode))));
      });
      // A change whose last try may have landed waits for a person to check its page first.
      const items = picked.filter((i) => !i.stuck).sort((x, y) => (x.code ?? x.id).localeCompare(y.code ?? y.id, undefined, { numeric: true }));
      const held = picked.filter((i) => i.stuck).map((i) => ({ id: i.id, code: i.code, summary: i.summary, why: "it may already have landed, so a person checks its page first" }));
      if (!items.length) return { ok: false, error: ACCEPT_PROPOSAL_WORDS.nothing, detail: { held } };
      const echo = { action, items: items.map((i) => ({ id: i.id, code: i.code, batchCode: i.batchCode, kind: i.kind, summary: i.summary })) };
      if (args.confirmToken === undefined) {
        const { token, expiresAt } = ctx.mintConfirm("accept_proposals", echo);
        return {
          ok: true,
          result: {
            confirmRequired: true,
            echo,
            held,
            confirmToken: token,
            expiresAt,
            message: `Nothing was ${action === "accept" ? "accepted" : "put aside"}. Show the person every change listed here, by code and summary. ${ACCEPT_PROPOSAL_WORDS.note}`,
          },
        };
      }
      const approval = readLeadApproval({ approvedBy: args.approvedBy, approvalNote: args.approvalNote });
      if (!approval.ok) return { ok: false, error: `${approval.words} ${ACCEPT_PROPOSAL_WORDS.note}`, detail: { code: "approval_required" } };
      if (!approvalCovers(approval.approvalNote, echo.items)) return { ok: false, error: ACCEPT_PROPOSAL_WORDS.notCovered, detail: { code: "approval_not_covering" } };
      const check = ctx.verifyConfirm("accept_proposals", args.confirmToken, echo);
      if (!check.ok) return { ok: false, error: check.sentence, detail: { reason: check.reason } };
      const a = await ctx.dispatch("POST", ACCEPT_AS_HOLDER_PATH, { action, ids: items.map((i) => i.id), approvedBy: approval.approvedBy, approvalNote: approval.approvalNote });
      if (a.status !== 200) return refusal(`Nothing was ${action === "accept" ? "accepted" : "put aside"}`, a);
      const results = ((a.body as { results?: Array<Record<string, unknown>> })?.results ?? []).map((r) => {
        const it = items.find((i) => i.id === r.id);
        return { id: String(r.id ?? ""), code: it?.code ?? null, summary: it?.summary ?? "", landed: r.ok === true, ...(r.ok === true ? {} : { error: String(r.error ?? "It did not land.") }), ...(typeof r.note === "string" ? { note: r.note } : {}) };
      });
      const landed = results.filter((r) => r.landed).length;
      return { ok: true, result: { written: landed > 0, action, landed, failed: results.length - landed, results } };
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
