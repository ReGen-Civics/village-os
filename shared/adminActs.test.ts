/**
 * The registry of acts (shared/adminActs.ts), held to the code it describes.
 *
 *   - every route it names exists on the server, method and path as Express registers them (the sources are parsed
 *     the way scripts/check-admin-reach.mjs parses them);
 *   - every power it names is the one the route's own handler asks for, and every field key is one the handler reads;
 *   - ids are unique, and the ids that shipped are frozen, so a rename fails by name;
 *   - the class is computed from the lists and follows them when they change;
 *   - a consequence line is the catalog's own, never typed here;
 *   - every tab and every dial is found by its own name in admin search;
 *   - every act names the rows of the parity ledger it covers.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ACTS,
  ADMIN_ACT_ENTRIES,
  HELPER_RULE_KEY,
  PERSON_ONLY_LISTS,
  WRITTEN_ACTS,
  actAlwaysRules,
  actCard,
  actClass,
  actConsequence,
  actHref,
  actModule,
  actPath,
  actReason,
  actSearchEntry,
  adminAct,
  type AdminAct,
  type PersonOnlyLists,
} from "./adminActs";
import { CONTROL_ACTS, DIAL_ACTS, DIAL_ROUTE, OUTSIDE_ACTS, SECRET_ROUTE, SEED_ACTS, TAB_ACTS, dialAct } from "./adminActs/derived";
import { FROZEN_ACT_IDS } from "./adminActs/frozenIds";
import { mayPropose } from "./adminHelper";
import { CONTROL_ENTRIES, OUTSIDE_ENTRIES, adminSearchHref, rankAdminSearch } from "./adminSearch";
import { TAB_MODULE } from "./adminTabModules";
import { ADMIN_PLACES, ADMIN_TABS } from "./adminTabs";
import { ALWAYS_A_PERSON } from "./agentAdmin";
import { ALL_CAPABILITIES } from "./capabilities";
import { CAPABILITY_CONSEQUENCE } from "./draftKinds";
import { VARIABLES, VARIABLES_BY_KEY } from "./gameVariables";
import { SEEDS_BY_ID } from "./guilds";
import { neverProposed } from "./proposedChanges";
import { ROUTE_POWERS } from "../server/lib/operatorRoutes";

// ── The server's routes, read from its sources ─────────────────────────────

const ROOT = path.resolve(__dirname, "..");

function routeModules(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeModules(full));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out.sort();
}

interface ServerRoute {
  file: string;
  /** The whole registration, handler included, as written. */
  text: string;
}

const METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const SOURCES = new Map<string, { text: string; sf: ts.SourceFile }>();
const ROUTES = new Map<string, ServerRoute>();

for (const file of [path.join(ROOT, "server", "index.ts"), ...routeModules(path.join(ROOT, "server", "routes"))]) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  SOURCES.set(file, { text, sf });
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && METHODS.has(node.expression.name.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const route = node.arguments[0].text;
      if (route.startsWith("/api/")) ROUTES.set(`${node.expression.name.text.toUpperCase()} ${route}`, { file, text: node.getText(sf) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/** Every function or constant a file declares, at any depth, by name: the helpers a handler asks through. */
const DECLARED = new Map<string, Map<string, string>>();
function declaredIn(file: string): Map<string, string> {
  let found = DECLARED.get(file);
  if (found) return found;
  found = new Map();
  const { sf } = SOURCES.get(file)!;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) found!.set(node.name.text, node.getText(sf));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) found!.set(node.name.text, node.getText(sf));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  DECLARED.set(file, found);
  return found;
}

/**
 * What a handler says, with the helpers it calls from its own file folded in, three calls deep. A gate asked
 * through `powerAssignGate(req)` or `mayLook(req, res)` is still asked by this handler.
 */
function handlerSays(route: ServerRoute): string {
  const helpers = declaredIn(route.file);
  const seen = new Set<string>();
  let text = route.text;
  let frontier = route.text;
  for (let depth = 0; depth < 3; depth++) {
    let next = "";
    for (const m of frontier.matchAll(/\b([A-Za-z_]\w*)\(/g)) {
      const name = m[1];
      if (seen.has(name)) continue;
      seen.add(name);
      const body = helpers.get(name);
      if (body && body.length < 6000) next += `\n${body}`;
    }
    if (!next) break;
    text += next;
    frontier = next;
  }
  return text;
}

/**
 * Doors that ask through another file, each with the file and what was read there. The test still checks that the
 * file names the power; this table only says where to look.
 */
const ASKED_IN: Readonly<Record<string, string>> = {
  // `writeDial` asks the one gate for `dial.set`, for both doors that write a dial.
  "PUT /api/admin/variables/:key": "server/lib/dialWrite.ts",
  // The budget's door (`budgetDoorOf`) asks for `role.pay`, the holder alone.
  "POST /api/admin/budgets/import": "server/routes/budgets.ts",
  "POST /api/admin/budgets/lines": "server/routes/budgets.ts",
  "PATCH /api/admin/budgets/lines/:id": "server/routes/budgets.ts",
  "POST /api/admin/budgets/lines/:id/withdraw": "server/routes/budgets.ts",
  "POST /api/admin/budgets/lines/:id/restore": "server/routes/budgets.ts",
  // The accounts' door is one constant, `ORG_ACCOUNT`, set to `operator.config` at the top of the file.
  "POST /api/admin/org-accounts": "server/routes/orgAccounts.ts",
  "PUT /api/admin/org-accounts/:orgRoleId": "server/routes/orgAccounts.ts",
  // `powerAssignGate` is made by `makePowerAssignGate`, which asks for `power.assign`, the holder alone.
  "PUT /api/admin/roles/:id/capabilities": "server/routes/seatPowerGroups.ts",
};

/**
 * Doors that let a holder through inside the handler, where the widening map (server/lib/operatorRoutes.ts) does
 * not name the route: the file that defines the key the handler asks its holders by.
 */
const HOLDER_ASKED_IN: Readonly<Record<string, string>> = {
  // `whoIs` reads the live holders of `MODULE_SWITCH_KEY`, and an admin or a holder passes.
  "PUT /api/admin/modules/:id/lifecycle": "shared/moduleSwitch.ts",
};

const routeKey = (a: AdminAct) => `${a.route!.method} ${a.route!.path}`;
const routed = ADMIN_ACTS.filter((a) => a.route);
/** One act for each route: a dial and a key share theirs with every other dial and key. */
const onePerRoute = Array.from(new Map(routed.map((a) => [routeKey(a), a])).values());
const written = [...WRITTEN_ACTS, ...CONTROL_ACTS];

describe("the routes the registry names", () => {
  it("reads the server's sources at all (a floor, so an empty parse cannot pass)", () => {
    expect(ROUTES.size).toBeGreaterThan(1000);
    expect(routed.length).toBeGreaterThan(400);
  });

  it("every route exists on the server, method and path exactly as Express registers them", () => {
    const missing = onePerRoute.filter((a) => !ROUTES.has(routeKey(a))).map((a) => `${a.id}: ${routeKey(a)}`);
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("an act that fixes a `:name` part names a part its route has", () => {
    for (const a of routed) for (const name of Object.keys(a.route!.params ?? {})) expect(a.route!.path.includes(`:${name}`), `${a.id} :${name}`).toBe(true);
  });

  it("a key's slot is one the sealed store accepts", () => {
    // The store accepts its own slots and every slot a module's vendor declares (server/lib/secrets.ts, `SECRET_KEYS`).
    const secrets = fs.readFileSync(path.join(ROOT, "server", "lib", "secrets.ts"), "utf8") + fs.readFileSync(path.join(ROOT, "shared", "modules.ts"), "utf8");
    for (const a of SEED_ACTS) {
      expect(a.route!.path).toBe(SECRET_ROUTE);
      const slot = a.route!.params!.key;
      expect(secrets.includes(`"${slot}"`), `${a.id}: ${slot}`).toBe(true);
    }
  });
});

describe("the power each act names is the one its door asks for", () => {
  it("names only powers the gate knows", () => {
    for (const a of ADMIN_ACTS) {
      const caps = ([a.power, a.holder, ...(a.also ?? [])] as Array<string | undefined>).filter((p): p is string => !!p && !["admin", "founder", "member", "signed-in", "anyone"].includes(p));
      for (const cap of caps) expect(ALL_CAPABILITIES as readonly string[], `${a.id}: ${cap}`).toContain(cap);
    }
  });

  it("a route the widening map names carries that power as its holder, and no other act claims a holder", () => {
    const wrong: string[] = [];
    for (const a of onePerRoute) {
      const mapped = ROUTE_POWERS[routeKey(a)] ?? null;
      const inHandler = HOLDER_ASKED_IN[routeKey(a)];
      if (inHandler) {
        if (!a.holder || !fs.readFileSync(path.join(ROOT, inHandler), "utf8").includes(`"${a.holder}"`)) wrong.push(`${a.id}: ${inHandler} does not name ${a.holder ?? "a holder"}`);
      } else if ((a.holder ?? null) !== mapped) wrong.push(`${a.id}: holder ${a.holder ?? "none"}, the map says ${mapped ?? "none"}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("the handler itself names the power: the key it hands the gate, the admin question, or the founder role", () => {
    const wrong: string[] = [];
    for (const a of onePerRoute) {
      const route = ROUTES.get(routeKey(a));
      if (!route) continue;
      const elsewhere = ASKED_IN[routeKey(a)];
      const says = elsewhere ? fs.readFileSync(path.join(ROOT, elsewhere), "utf8") : handlerSays(route);
      const names = (p: string) => {
        if (p === "admin") return /\bisAdmin\(|\bisJourney\(|\badminOnly\b|plantingAdmins\(/.test(says);
        if (p === "founder") return says.includes('"founder"');
        if (p === "anyone") return true;
        if (p === "member" || p === "signed-in") return /\bauthedUser\(/.test(says);
        return says.includes(`"${p}"`);
      };
      for (const p of [a.power, ...(a.also ?? [])]) if (!names(p)) wrong.push(`${a.id}: ${routeKey(a)} does not ask for ${p}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("every field key is one the handler reads", () => {
    const wrong: string[] = [];
    for (const a of written) {
      if (!a.route || !a.fields) continue;
      const route = ROUTES.get(routeKey(a));
      if (!route) continue;
      const elsewhere = ASKED_IN[routeKey(a)];
      const says = elsewhere ? fs.readFileSync(path.join(ROOT, elsewhere), "utf8") : handlerSays(route);
      // An upload's file part is read by the upload middleware, by its field name.
      for (const f of a.fields) if (!new RegExp(`\\b${f.key}\\b`).test(says)) wrong.push(`${a.id}: ${routeKey(a)} never reads ${f.key}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("a dial's field is read off its own definition: its kind, its bounds and its choices", () => {
    const pct = VARIABLES.find((v) => v.type === "percentage" && v.max !== undefined)!;
    expect(dialAct(pct).fields).toEqual([expect.objectContaining({ key: "value", kind: "number", max: pct.max })]);
    const choice = VARIABLES.find((v) => v.type === "choice" && v.choices?.length)!;
    expect(dialAct(choice).fields![0]).toMatchObject({ kind: "choice", choices: choice.choices!.map((c) => c.value) });
    for (const a of DIAL_ACTS) expect(Object.keys(a.fields![0]), a.id).not.toContain("value");
  });
});

describe("addresses are stable", () => {
  it("every id is unique", () => {
    const seen = new Set<string>();
    const twice = ADMIN_ACTS.map((a) => a.id).filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(twice, twice.join(", ")).toEqual([]);
  });

  it("every id that shipped is still here: a rename or a removal fails by name", () => {
    const gone = FROZEN_ACT_IDS.filter((id) => !adminAct(id));
    expect(gone, `renamed or removed: ${gone.join(", ")}`).toEqual([]);
  });

  it("every written act, tab, control and page is on the frozen list, so a new one is frozen the day it ships", () => {
    const frozen = new Set<string>(FROZEN_ACT_IDS);
    const unfrozen = [...written, ...TAB_ACTS, ...OUTSIDE_ACTS, ...SEED_ACTS].map((a) => a.id).filter((id) => !frozen.has(id));
    expect(unfrozen, `add to shared/adminActs/frozenIds.ts: ${unfrozen.join(", ")}`).toEqual([]);
  });

  it("a dial's id is its key, which the dial catalogue already keeps stable", () => {
    for (const a of DIAL_ACTS) expect(a.id).toBe(`dial.${a.route!.params!.key}`);
    expect(DIAL_ACTS).toHaveLength(VARIABLES.length);
  });

  it("a written act says its place first, then the thing, then the verb", () => {
    for (const a of WRITTEN_ACTS) {
      expect(a.id, a.id).toMatch(/^[a-z]+(\.[a-z0-9-]+){2}$/);
      expect(a.id.split(".")[0], a.id).toBe(a.place);
    }
  });

  it("every old address still lands where it did", () => {
    for (const e of [...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES]) expect(actHref(adminAct(e.id)!), e.id).toBe(adminSearchHref(e));
    expect(actHref(adminAct("comms.test-email")!)).toBe("/admin?tab=comms-settings&setting=comms.test-email");
    expect(actHref(adminAct("season.timezone")!)).toBe("/admin?tab=season&setting=season.timezone");
    expect(actHref(adminAct("tab.comms-settings")!)).toBe("/admin?tab=comms-settings&setting=comms.test-email");
    expect(actHref(adminAct("tab.players")!)).toBe("/admin?tab=players");
    expect(actHref(adminAct("gate.players.set-stage")!)).toBe("/admin?tab=players");
    expect(actHref(adminAct("hall.review.find")!)).toBe("/admin/review");
    expect(actHref(DIAL_ACTS[0])).toBe(`/admin?tab=variables&variable=${encodeURIComponent(VARIABLES[0].key)}`);
  });
});

describe("the two complete sets", () => {
  it("every admin tab is a page act, and an old address is listed once under the tab it opens", () => {
    for (const t of ADMIN_TABS) {
      const act = adminAct(`tab.${t.sameAs ?? t.key}`);
      expect(act, t.key).toBeTruthy();
      expect(act!.kind).toBe("page");
      expect(act!.place).toBe(ADMIN_TABS.find((x) => x.key === (t.sameAs ?? t.key))!.place);
    }
    expect(adminAct("tab.email-settings")).toBeUndefined();
  });

  it("every dial is an act with the dial door as its route", () => {
    for (const v of VARIABLES) {
      const act = adminAct(`dial.${v.key}`)!;
      expect(act.route, v.key).toEqual({ method: "PUT", path: DIAL_ROUTE, params: { key: v.key } });
      expect(actPath(act)).toBe(`/api/admin/variables/${v.key}`);
    }
  });

  it("every act names a place the garden has, and every place holds something", () => {
    for (const a of ADMIN_ACTS) expect(ADMIN_PLACES as readonly string[], a.id).toContain(a.place);
    for (const place of ADMIN_PLACES) expect(ADMIN_ACTS.some((a) => a.place === place), place).toBe(true);
  });

  it("every act on a tab names a tab that exists, and takes its module from the tab", () => {
    const keys = new Set(ADMIN_TABS.map((t) => t.key));
    for (const a of ADMIN_ACTS) if (a.tab) expect(keys.has(a.tab), `${a.id} -> ${a.tab}`).toBe(true);
    expect(actModule(adminAct("tower.calendar.add-event")!)).toBe(TAB_MODULE["events-admin"]);
    expect(actModule(adminAct("gate.players.set-stage")!)).toBeUndefined();
  });

  it("an entry is data: it survives a JSON round trip unchanged, so nothing in it can act", () => {
    for (const a of ADMIN_ACTS) expect(JSON.parse(JSON.stringify(a)), a.id).toEqual(a);
  });
});

describe("the class is computed from the lists", () => {
  const dial = (key: string) => adminAct(`dial.${key}`)!;
  const ordinary = VARIABLES.find((v) => mayPropose(v) && actClass(dialAct(v)) === "prepare")!;

  it("a page that calls nothing, and a GET, are reads", () => {
    expect(actClass(adminAct("tab.ledger")!)).toBe("read");
    expect(actClass(adminAct("fire.today.needs-you")!)).toBe("read");
    expect(actClass(adminAct("gate.visitors.export")!)).toBe("read");
    expect(actReason(adminAct("gate.visitors.export")!)).toBeNull();
  });

  it("an ordinary dial is one to prepare, although the connector's list names every dial write", () => {
    expect(ordinary, "an ordinary dial exists").toBeTruthy();
    const act = dial(ordinary.key);
    expect(actClass(act)).toBe("prepare");
    expect(actReason(act)).toBeNull();
    // The connector's `settings` rule (mode "writes") names it, and that does not make it a person's alone.
    expect(actAlwaysRules(act).map((r) => r.mode)).toContain("writes");
  });

  it("every dial the helper may not propose is a person's alone, with the helper's own sentence", () => {
    const held = VARIABLES.filter((v) => !mayPropose(v));
    expect(held.length).toBeGreaterThan(10);
    for (const v of held) {
      expect(actClass(dial(v.key)), v.key).toBe("person-only");
      expect(actReason(dial(v.key))?.words, v.key).toBeTruthy();
    }
    const byHelper = held.filter((v) => actReason(dial(v.key))?.list === "helper_money");
    expect(byHelper.length).toBeGreaterThan(0);
    expect(actReason(dial(byHelper[0].key))?.key).toBe(HELPER_RULE_KEY);
  });

  it("no act to prepare is one NEVER_PROPOSED names, or one the connector's list names with mode always", () => {
    for (const a of ADMIN_ACTS) {
      if (actClass(a) !== "prepare") continue;
      const p = (actPath(a) ?? "").replace(/:[A-Za-z][A-Za-z0-9]*/g, "x");
      const asProposed = a.route!.path === DIAL_ROUTE ? a.route!.path : p;
      expect(neverProposed(a.route!.method, asProposed, {}), a.id).toBeNull();
      expect(ALWAYS_A_PERSON.filter((r) => r.mode === "always" && r.test(a.route!.method, p)).map((r) => r.key), a.id).toEqual([]);
    }
  });

  it("money, secrets, accounts, erasure and sending are a person's alone, each by the rule that names it", () => {
    const why = (id: string) => `${actClass(adminAct(id)!)}:${actReason(adminAct(id)!)?.list}:${actReason(adminAct(id)!)?.key}`;
    // The mint's path reads as a token path first; either rule makes it a person's alone.
    expect(why("store.mint.mint")).toMatch(/^person-only:never_proposed:(money|secrets)$/);
    expect(why("store.cash.mark-paid")).toMatch(/^person-only:/);
    expect(why("store.cycles.close")).toMatch(/^person-only:/);
    expect(why("gate.players.set-access")).toMatch(/^person-only:never_proposed:/);
    expect(why("gate.players.remove")).toMatch(/^person-only:never_proposed:/);
    expect(why("tower.letters.send")).toBe("person-only:never_proposed:sending");
    expect(why("gate.org.seat")).toBe("person-only:never_proposed:seating");
    expect(why("hall.changes.accept")).toBe("person-only:never_proposed:agents");
    for (const a of SEED_ACTS) expect(actReason(a)?.key, a.id).toBe("secrets");
  });

  it("words and settings a person accepts are ones to prepare", () => {
    for (const id of ["library.pages.save", "library.faqs.add", "greenhouse.modules.set-lifecycle", "greenhouse.modules.config", "greenhouse.season.save", "tower.calendar.add-event", "stage.milestones.add"]) {
      expect(actClass(adminAct(id)!), id).toBe("prepare");
    }
  });

  it("follows the lists: a rule added to a test double moves a prepare act to person-only, and taking the rule away moves it back", () => {
    const act = adminAct("library.faqs.add")!;
    expect(actClass(act)).toBe("prepare");
    const withNever: PersonOnlyLists = { ...PERSON_ONLY_LISTS, neverProposed: (m, p, b) => (/\/faqs\//.test(p) ? { key: "test", words: "A test rule." } : PERSON_ONLY_LISTS.neverProposed(m, p, b)) };
    expect(actClass(act, withNever)).toBe("person-only");
    expect(actReason(act, withNever)).toEqual({ list: "never_proposed", key: "test", words: "A test rule." });
    const withAlways: PersonOnlyLists = { ...PERSON_ONLY_LISTS, always: [...PERSON_ONLY_LISTS.always, { key: "test_always", words: "Always a test.", mode: "always", test: (_m, p) => /\/faqs\//.test(p) }] };
    expect(actReason(act, withAlways)).toEqual({ list: "always_a_person", key: "test_always", words: "Always a test." });
    // The same rule with mode "writes" names the act and leaves it one to prepare.
    const withWrites: PersonOnlyLists = { ...PERSON_ONLY_LISTS, always: [...PERSON_ONLY_LISTS.always, { key: "test_writes", words: "Writes.", mode: "writes", test: (_m, p) => /\/faqs\//.test(p) }] };
    expect(actClass(act, withWrites)).toBe("prepare");
    expect(actAlwaysRules(act, withWrites).map((r) => r.key)).toContain("test_writes");
  });

  it("follows the lists the other way: with every list empty, a money act and a sealed dial are ones to prepare", () => {
    const empty: PersonOnlyLists = { always: [], neverProposed: () => null, variableNever: () => null, proposalRefusal: () => null };
    expect(actClass(adminAct("store.mint.mint")!, empty)).toBe("prepare");
    for (const a of DIAL_ACTS) expect(actClass(a, empty), a.id).toBe("prepare");
    const refusing: PersonOnlyLists = { ...empty, proposalRefusal: (def) => (def?.key === ordinary.key ? "Not this one." : null) };
    expect(actReason(dial(ordinary.key), refusing)).toEqual({ list: "helper_money", key: HELPER_RULE_KEY, words: "Not this one." });
    expect(actClass(adminAct("tab.ledger")!, refusing)).toBe("read");
  });

  it("the card carries the class, the reason and every connector rule, all computed", () => {
    const card = actCard(adminAct("store.mint.mint")!);
    expect(card.actClass).toBe("person-only");
    expect(card.reason?.list).toBe("never_proposed");
    expect(card.reason?.words).toContain("never proposed");
    expect(card.alwaysRules.map((r) => r.key)).toContain("money");
    expect(card.href).toBe("/admin?tab=tokens");
    expect(Object.keys(adminAct("store.mint.mint")!)).not.toContain("actClass");
  });
});

describe("the consequence line is the catalog's", () => {
  it("an act with a capability reads that capability's line, word for word", () => {
    expect(actConsequence(adminAct("hall.forms.set-status")!)).toBe(CAPABILITY_CONSEQUENCE["intake.moderate"]);
    expect(actConsequence(adminAct("gate.players.set-stage")!)).toBe(CAPABILITY_CONSEQUENCE["operator.accounts"]);
    expect(actConsequence(adminAct(`dial.${VARIABLES[0].key}`)!)).toBe(CAPABILITY_CONSEQUENCE["dial.set"]);
  });

  it("a key reads its seed's own line", () => {
    for (const a of SEED_ACTS) {
      expect(actConsequence(a), a.id).toBe(SEEDS_BY_ID[a.seed!].consequence);
      expect(actConsequence(a).length, a.id).toBeGreaterThan(10);
    }
  });

  it("a page has none, and an act whose door asks only for an admin has none: nothing is made up", () => {
    expect(actConsequence(adminAct("tab.ledger")!)).toBe("");
    expect(actConsequence(adminAct("gate.handover.pass-to-village")!)).toBe("");
    for (const a of ADMIN_ACTS) {
      const line = actConsequence(a);
      if (line) expect([...Object.values(CAPABILITY_CONSEQUENCE), ...Object.values(SEEDS_BY_ID).map((s) => s.consequence)], a.id).toContain(line);
    }
  });
});

describe("admin search reads the registry", () => {
  const entries = ADMIN_ACT_ENTRIES;

  it("grows from admin search: every shipped control and page is in it, word for word", () => {
    for (const e of [...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES]) expect(actSearchEntry(adminAct(e.id)!), e.id).toEqual(e);
  });

  it("names the key its door hands the gate, and none where the door asks only for an admin", () => {
    expect(actSearchEntry(adminAct("hall.forms.set-status")!).capability).toBe("intake.moderate");
    expect(actSearchEntry(adminAct("gate.players.set-stage")!).capability).toBeUndefined();
    expect(actSearchEntry(adminAct("tab.forum-moderation")!).module).toBe("forum");
  });

  it("every admin tab is found by its own name: a page of that name leads, and the tab is in the first three", () => {
    for (const t of ADMIN_TABS) {
      const want = `tab.${t.sameAs ?? t.key}`;
      const title = adminAct(want)!.title;
      // A name two pages share (the Pricing desk is a tab and a desk on the Treasury) may lead with either of them.
      const found = rankAdminSearch(title, entries, 12);
      expect(`${found[0].title}|${found[0].kind === "page" || found[0].kind === "outside"}`, title).toBe(`${title}|true`);
      expect(found.slice(0, 3).map((e) => e.id), title).toContain(want);
    }
  });

  it("every dial is found by its own name in the first results", () => {
    const missed = VARIABLES.filter((v) => !rankAdminSearch(v.label, entries, 8).some((e) => e.id === `dial.${v.key}`)).map((v) => v.key);
    expect(missed, missed.join(", ")).toEqual([]);
  });

  it("every written act is found by its own title in the first results, and by a synonym", () => {
    const missed: string[] = [];
    for (const a of WRITTEN_ACTS) {
      if (!rankAdminSearch(a.title, entries, 8).some((e) => e.id === a.id)) missed.push(`${a.id} by its title`);
      if (!a.synonyms.length) missed.push(`${a.id} has no synonyms`);
      else if (!rankAdminSearch(a.synonyms[0], entries, 40).some((e) => e.id === a.id)) missed.push(`${a.id} by "${a.synonyms[0]}"`);
    }
    expect(missed, missed.join("\n")).toEqual([]);
  });

  it("finds the words a founder would type", () => {
    const top = (q: string) => rankAdminSearch(q, entries, 6).map((e) => e.id);
    expect(top("make admin")).toContain("gate.players.set-access");
    expect(top("close the cycle")).toContain("store.cycles.close");
    expect(top("send me a test")[0]).toBe("comms.test-email");
    expect(top("newsletter")).toContain("tower.letters.write");
    expect(top("second signature")).toContain("hall.keys.cosign");
  });

  it("lands on the page that holds the control, and an act never borrows another page's focus", () => {
    expect(adminSearchHref(actSearchEntry(adminAct("tower.mail.key-rights")!))).toBe("/admin?tab=comms-settings");
    expect(adminSearchHref(actSearchEntry(adminAct("store.economy.rule")!))).toBe("/admin/mint");
    expect(adminSearchHref(actSearchEntry(adminAct("tab.players")!))).toBe("/admin?tab=players");
  });

  it("ships no village's name for its guide: the guide is the guide", () => {
    for (const a of ADMIN_ACTS) expect(`${a.title} ${a.help} ${a.synonyms.join(" ")}`, a.id).not.toMatch(/scarlet|maia/i);
  });
});

describe("every act names the ledger rows it covers", () => {
  it("names rows by their ids, and an act on a tab covers that tab's row unless it says otherwise", () => {
    for (const a of ADMIN_ACTS) for (const id of a.parity ?? []) expect(id, a.id).toMatch(/^[A-H][1-9]\d?$/);
    expect(adminAct("gate.players.set-stage")!.parity).toEqual(["A11"]);
    expect(adminAct("spring.agents.approval")!.parity).toEqual(["H8"]);
    expect(adminAct("tab.comms-settings")!.parity).toEqual(["A70", "A71"]);
    expect(adminAct(`dial.${VARIABLES[0].key}`)!.parity).toContain("A34");
    expect(adminAct("key.assistant_api_key")!.parity).toEqual(["A72", "F2"]);
  });

  it("every written act, control, key and dial covers some row", () => {
    // A tab added after the ledger was read has no row to name, so the tabs are not asked here.
    const loose = [...WRITTEN_ACTS, ...CONTROL_ACTS, ...SEED_ACTS, ...DIAL_ACTS].filter((a) => !a.parity?.length).map((a) => a.id);
    expect(loose, loose.join(", ")).toEqual([]);
  });
});

describe("the lists that own the rules are read, never copied", () => {
  it("reads the connector's list itself, so a rule added there is a rule here", () => {
    expect(PERSON_ONLY_LISTS.always).toBe(ALWAYS_A_PERSON);
    expect(PERSON_ONLY_LISTS.neverProposed).toBe(neverProposed);
  });

  it("a dial NEVER_PROPOSED's own variable rule names is a person's alone by that list", () => {
    const sealed = VARIABLES.find((v) => v.movedToSecret || v.withheld);
    if (sealed) expect(actReason(adminAct(`dial.${sealed.key}`)!)?.list).toBe("never_proposed");
    const agents = VARIABLES.find((v) => v.key.startsWith("agents."))!;
    expect(actReason(adminAct(`dial.${agents.key}`)!)).toMatchObject({ list: "never_proposed", key: "agents" });
    expect(VARIABLES_BY_KEY[agents.key]).toBeTruthy();
  });
});
