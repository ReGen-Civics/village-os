/**
 * THE WALK LIST: every admin function in one file a person can read top to bottom while they walk the build.
 *
 * It is the scoreboard (shared/gardenScore.ts) turned to face a person. Nothing here is typed: every row is read
 * from the same inputs and the same counts the scoreboard uses, so the list and the numbers cannot disagree.
 *
 *   Part 1   every act, by place in the garden's own order, then by the tab or the page it opens on: where it
 *            opens, the route it calls, who its door admits, its tier for the guide, its ledger rows, and whether
 *            it is marked partial. The dials go in one table at the end.
 *   Part 2   every route no act claims that an admin can reach: every open route under /api/admin/, and every open
 *            route elsewhere whose own handler asks the admin question or names a power only a role gives. Then,
 *            apart, how many open routes are left that nobody has decided, family by family.
 *   Part 3   every setting the Settings count calls open, with what it is missing.
 *
 * THE TIER, IN A PERSON'S WORDS. The registry computes three classes (`actClass`, shared/adminActs.ts). An act that
 * calls no write route "reads only". One the guide may fill for a person to press "prepares for your yes". One a
 * list makes a person's alone is "yours alone", with that list's own sentence. No act is one the guide does by
 * herself today: the code that would let her is not built, so that tier is empty and the list says so.
 *
 * Pure: no I/O, no clock.
 */
import { PERSON_ONLY_LISTS, actClass, actHref, actReason, type PersonOnlyLists } from "./adminActs";
import { DIAL_ROUTE } from "./adminActs/derived";
import type { AdminAct } from "./adminActs/types";
import { ADMIN_PLACES } from "./adminTabs";
import { ringOf } from "./gameVariables";
import { barePath } from "./gardenMounts";
import { countOf, routeGroup, routeKey, stewardsByItsHandler, type Scoreboard, type ScoreInputs } from "./gardenScore";
import { summaryRow } from "./gardenScoreReport";

export interface WalkAct {
  place: string;
  /** The tab or the page it opens on, as a heading: "tab players" or "page /admin/review". */
  on: string;
  id: string;
  title: string;
  /** The address to paste after the site's own. */
  opens: string;
  /** The route it calls, or "reads only". */
  calls: string;
  /** Who its door admits. */
  door: string;
  tier: "reads only" | "prepares for your yes" | "yours alone" | "not settled";
  /** Why it is yours alone, or why its tier is not settled. Empty otherwise. */
  why: string;
  ledger: string;
  partial: boolean;
}

export interface WalkDial {
  key: string;
  label: string;
  category: string;
  /** Who may change it, from its ring. */
  who: string;
  tier: WalkAct["tier"];
}

export interface WalkRoute {
  method: string;
  path: string;
  /** The file and line of its registration. */
  at: string;
  /** The permission matrix's six codes for it, or "" when the matrix holds no line. */
  matrix: string;
  /** What shows an admin can reach it. */
  why: string;
}

export interface WalkSetting {
  kind: string;
  name: string;
  missing: string;
}

export interface Walk {
  acts: WalkAct[];
  dials: WalkDial[];
  routes: WalkRoute[];
  /** The open routes left over, counted by family: nobody has decided whose they are. */
  undecided: Array<{ family: string; count: number }>;
  settings: WalkSetting[];
  matrixColumns: readonly string[];
}

const TIER: Readonly<Record<"read" | "prepare" | "person-only", WalkAct["tier"]>> = { read: "reads only", prepare: "prepares for your yes", "person-only": "yours alone" };

/** Who a door admits, in a few words: the power it asks, and the holder the widening map lets through beside an admin. */
export function doorWords(a: Pick<AdminAct, "power" | "holder" | "also">): string {
  const base = a.power === "admin" ? "an admin" : a.power === "founder" ? "a founder" : a.power === "member" ? "any member" : a.power === "signed-in" ? "anybody signed in" : a.power === "anyone" ? "anyone" : `a holder of ${a.power}`;
  return `${base}${a.holder ? `, or a holder of ${a.holder}` : ""}${a.also?.length ? `, and it also asks for ${a.also.join(", ")}` : ""}`;
}

function tierOf(a: AdminAct, lists: PersonOnlyLists): Pick<WalkAct, "tier" | "why"> {
  if (a.partial && !a.route) return { tier: "not settled", why: "Its route was never read, so nothing says whether it changes something." };
  const cls = actClass(a, lists);
  return { tier: TIER[cls], why: cls === "person-only" ? (actReason(a, lists)?.words ?? "") : "" };
}

const isDial = (a: AdminAct): boolean => a.route?.path === DIAL_ROUTE;

/** The walk list, read off the scoreboard's own inputs and its own counts. */
export function walkOf(inputs: ScoreInputs, board: Scoreboard): Walk {
  const lists = inputs.lists ?? PERSON_ONLY_LISTS;
  const placeOrder = new Map<string, number>((ADMIN_PLACES as readonly string[]).map((p, i) => [p, i]));
  const tabOrder = new Map(inputs.tabs.map((t, i) => [t.key, i]));
  const onOf = (a: AdminAct): string => (a.tab ? `tab ${a.tab}` : a.path ? `page ${barePath(a.path)}` : "no address");
  const rank = (a: AdminAct): [number, number, string] => [placeOrder.get(a.place) ?? 99, a.tab ? (tabOrder.get(a.tab) ?? 998) : 999, onOf(a)];

  const acts = inputs.acts
    .filter((a) => !isDial(a))
    .map((a, index) => ({ a, index, rank: rank(a) }))
    .sort((x, y) => x.rank[0] - y.rank[0] || x.rank[1] - y.rank[1] || (x.rank[2] < y.rank[2] ? -1 : x.rank[2] > y.rank[2] ? 1 : 0) || x.index - y.index)
    .map(({ a }): WalkAct => ({
      place: a.place,
      on: onOf(a),
      id: a.id,
      title: a.title,
      opens: actHref(a),
      calls: a.route ? `${a.route.method} ${a.route.path}${a.route.params ? ` (${Object.entries(a.route.params).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}` : "reads only",
      door: doorWords(a),
      ...tierOf(a, lists),
      ledger: (a.parity ?? []).join(" "),
      partial: !!a.partial,
    }));

  const dialActs = new Map(inputs.acts.filter(isDial).map((a) => [a.route?.params?.key ?? "", a]));
  const dials = inputs.dials.map((d): WalkDial => {
    const act = dialActs.get(d.key);
    return {
      key: d.key,
      label: d.label,
      category: d.category,
      who: ringOf(d) === "open" ? "the village governs it" : "founder-held",
      tier: act ? tierOf(act, lists).tier : "not settled",
    };
  });

  // Part 2 is the Endpoints count's own open list, split by what shows an admin can reach the route.
  const byKey = new Map(inputs.routes.map((r) => [routeKey(r.method, r.path), r]));
  const routes: WalkRoute[] = [];
  const left = new Map<string, number>();
  for (const item of countOf(board, "endpoints").open) {
    const r = byKey.get(item.name);
    const handler = r ? stewardsByItsHandler(r) : null;
    const underAdmin = !!r && r.path.startsWith("/api/admin/");
    if (!r || (!underAdmin && !handler)) {
      const family = r ? routeGroup(r.path) : item.group;
      left.set(family, (left.get(family) ?? 0) + 1);
      continue;
    }
    const row = Object.prototype.hasOwnProperty.call(inputs.matrix.routes, item.name) ? inputs.matrix.routes[item.name] : null;
    routes.push({
      method: r.method,
      path: r.path,
      at: r.file ? `${r.file}:${r.line ?? ""}` : "",
      matrix: row ? row.join(" ") : "",
      why: [underAdmin ? "under /api/admin/" : "", handler ?? ""].filter(Boolean).join("; "),
    });
  }
  routes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.method < b.method ? -1 : 1));
  const undecided = Array.from(left.entries(), ([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count || (a.family < b.family ? -1 : 1));

  const settings = countOf(board, "settings").open.map((o): WalkSetting => ({ kind: o.group.split(":")[0], name: o.name, missing: o.why }));

  return { acts, dials, routes, undecided, settings, matrixColumns: inputs.matrix.identities };
}

// ── Printed ────────────────────────────────────────────────────────────────

const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** The walk list as Markdown. `stamp` is the line the caller adds: the commit it was measured on. */
export function walkMarkdown(walk: Walk, board: Scoreboard, stamp: string): string {
  const out: string[] = ["# The walk list: every admin function, to walk the build by", ""];
  if (stamp) out.push(stamp, "");
  out.push("Written by `npx tsx scripts/garden-scoreboard.ts --walk <dir>`. Every row is read from code: the registry of acts, the server's routes, the permission matrix and the dial registry. Nothing in it is typed.", "");
  out.push("| Count | Done | Total | Open |", "|---|---:|---:|---:|");
  for (const count of board.counts) {
    const r = summaryRow(count);
    out.push(`| ${r.title} | ${r.done} | ${r.total} | ${r.open} |`);
  }
  out.push("");
  out.push("## How to use this file", "");
  out.push("1. Go place by place through part 1: open each address after the site's own, find the control, and press it or read it as its row says.");
  out.push("2. An act marked partial has a control, and its route or its fields were never read from the server, so walk it with more care and say what it really does.");
  out.push("3. Part 2 is where a function could be hiding with no entry: a route an admin can reach that no act claims. Part 3 is every setting with no full home.");
  out.push("");
  const tiers = new Map<string, number>();
  for (const a of walk.acts) tiers.set(a.tier, (tiers.get(a.tier) ?? 0) + 1);
  out.push(
    `Part 1 holds ${walk.acts.length} acts and ${walk.dials.length} dials. Part 2 holds ${walk.routes.length} routes an admin can reach that no act claims, and ${walk.undecided.reduce((n, u) => n + u.count, 0)} more open routes nobody has decided. Part 3 holds ${walk.settings.length} settings.`,
    "",
  );
  out.push(`The guide's tier, as each row says it: ${Array.from(tiers.entries(), ([t, n]) => `${t} ${n}`).join(", ")}. No act is one she does by herself yet: the code that would let her is not built.`, "");

  out.push("## Part 1: every act", "");
  let place = "";
  let on = "";
  for (const a of walk.acts) {
    if (a.place !== place) {
      place = a.place;
      on = "";
      out.push(`### ${place}`, "");
    }
    if (a.on !== on) {
      on = a.on;
      out.push(`#### ${place}: ${on}`, "", "| Act | Title | Opens | Calls | Door admits | Guide's tier | Ledger | Partial |", "|---|---|---|---|---|---|---|---|");
    }
    const tier = a.why ? `${a.tier}: ${a.why}` : a.tier;
    out.push(`| \`${a.id}\` | ${cell(a.title)} | \`${a.opens}\` | ${a.calls === "reads only" ? a.calls : `\`${cell(a.calls)}\``} | ${cell(a.door)} | ${cell(tier)} | ${a.ledger} | ${a.partial ? "partial" : ""} |`);
    const next = walk.acts[walk.acts.indexOf(a) + 1];
    if (!next || next.on !== a.on || next.place !== a.place) out.push("");
  }

  out.push("### The dials", "", "Every dial opens at `/admin?tab=variables&variable=<key>` and is written through `PUT /api/admin/variables/:key`, whose door asks for a holder of dial.set.", "");
  out.push("| Key | Label | Category | Who may change it | Guide's tier |", "|---|---|---|---|---|");
  for (const d of walk.dials) out.push(`| \`${d.key}\` | ${cell(d.label)} | ${cell(d.category)} | ${d.who} | ${d.tier} |`);
  out.push("");

  out.push("## Part 2: every route an admin can reach that no act claims", "");
  out.push(`The six codes are the permission matrix's own, in this order: ${walk.matrixColumns.join(", ")}. The matrix is a recorded table: it shows what the server answered when it was written. A blank means the matrix holds no line for the route.`, "");
  out.push("| Method | Path | Handler | Matrix | Why an admin can reach it |", "|---|---|---|---|---|");
  for (const r of walk.routes) out.push(`| ${r.method} | \`${r.path}\` | ${r.at} | ${r.matrix} | ${cell(r.why)} |`);
  out.push("");
  out.push("### Not decided: whose route is this", "");
  out.push(
    `${walk.undecided.reduce((n, u) => n + u.count, 0)} more routes are open, and nothing read from the code says an admin can reach them. Nobody has decided whose they are: a member's, a visitor's, a machine's, or a steward's whose door is asked in another file. By family, with how many each holds:`,
    "",
  );
  out.push(walk.undecided.map((u) => `\`${u.family}\` ${u.count}`).join(", "), "");

  out.push("## Part 3: every setting with no full home", "", "| Kind | Setting | What it is missing |", "|---|---|---|");
  for (const s of walk.settings) out.push(`| ${s.kind} | ${cell(s.name)} | ${cell(s.missing)} |`);
  out.push("");
  return out.join("\n");
}

const csvCell = (s: string): string => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** The walk list as one CSV. Its first column says which part a row belongs to. */
export function walkCsv(walk: Walk): string {
  const head = ["part", "place", "on", "id", "title", "opens", "calls", "door admits", "guide's tier", "why", "ledger", "partial", "handler", "matrix", "missing", "category"];
  const rows: string[][] = [head];
  for (const a of walk.acts) rows.push(["1 act", a.place, a.on, a.id, a.title, a.opens, a.calls, a.door, a.tier, a.why, a.ledger, a.partial ? "partial" : "", "", "", "", ""]);
  for (const d of walk.dials) rows.push(["1 dial", "greenhouse", "tab variables", `dial.${d.key}`, d.label, `/admin?tab=variables&variable=${encodeURIComponent(d.key)}`, `PUT ${DIAL_ROUTE} (key=${d.key})`, d.who, d.tier, "", "", "", "", "", "", d.category]);
  for (const r of walk.routes) rows.push(["2 unclaimed route", "", "", `${r.method} ${r.path}`, "", "", `${r.method} ${r.path}`, "", "", r.why, "", "", r.at, r.matrix, "", ""]);
  for (const u of walk.undecided) rows.push(["2 not decided", "", "", u.family, `${u.count} open routes`, "", "", "", "", "", "", "", "", "", "", ""]);
  for (const s of walk.settings) rows.push(["3 setting", "", "", s.name, "", "", "", "", "", "", "", "", "", "", s.missing, s.kind]);
  return `${rows.map((r) => r.map(csvCell).join(",")).join("\n")}\n`;
}
