import { describe, expect, it } from "vitest";
import { VARIABLES, VARIABLES_BY_KEY, type VariableDef } from "./gameVariables";
import {
  DOCK_SWITCH,
  HANDS_OFF_CATEGORIES,
  HELPER_SWITCH,
  MONEY_SWITCH,
  TODAYS_RULES,
  buildAdvice,
  buildProposal,
  cleanTabs,
  guideMaySee,
  mayPropose,
  proposalRefusal,
  queryWords,
  searchAdmin,
  type GuideRules,
  type HelperDial,
} from "./adminHelper";

const dials: HelperDial[] = VARIABLES.map((v) => ({
  key: v.key, label: v.label, category: v.category, description: v.description, type: v.type, value: v.default, isDefault: true,
}));

describe("cleanTabs", () => {
  it("keeps only real tab keys with a label, once each, and bounds the list", () => {
    const tabs = cleanTabs([
      { key: "players", label: "Players", group: "Who runs this village", help: "Everyone" },
      { key: "players", label: "Again" },
      { key: "javascript:alert(1)", label: "Bad" },
      { key: "no-label" },
      "junk",
    ]);
    expect(tabs).toEqual([{ key: "players", label: "Players", group: "Who runs this village", help: "Everyone" }]);
    expect(cleanTabs(Array.from({ length: 500 }, (_, i) => ({ key: `t-${i}`, label: "x" }))).length).toBe(200);
    expect(cleanTabs("nope")).toEqual([]);
  });
});

describe("money stays manual", () => {
  it("refuses every dial in a money category, and every key that names money", () => {
    for (const v of VARIABLES) {
      if (["Ledger", "The Mint", "Tokens", "Payments", "Exchange"].includes(v.category)) expect(mayPropose(v), v.key).toBe(false);
      if (/pay|price|cash|budget|redeem|redemption/i.test(v.key)) expect(mayPropose(v), v.key).toBe(false);
      if (v.movedToSecret) expect(mayPropose(v), v.key).toBe(false);
    }
    expect(proposalRefusal(undefined)).toContain("not a setting");
  });

  it("still leaves plenty an admin can be helped with", () => {
    expect(VARIABLES.filter((v) => mayPropose(v)).length).toBeGreaterThan(50);
  });
});

describe("buildProposal", () => {
  it("is null when there is nothing proposed", () => {
    expect(buildProposal(null, () => undefined)).toBeNull();
    expect(buildProposal({ why: "x" }, () => undefined)).toBeNull();
  });

  it("reads the current value it is handed, not the default", () => {
    const v = VARIABLES.find((d) => d.type === "boolean" && mayPropose(d))!;
    const out = buildProposal({ key: v.key, value: "true" }, () => "false");
    expect(out).toMatchObject({ ok: true, proposal: { from: "false", to: "true" } });
    expect(VARIABLES_BY_KEY[v.key]).toBeTruthy();
  });
});

describe("searchAdmin", () => {
  it("ranks pages and settings by the question's own words", () => {
    const tabs = cleanTabs([
      { key: "players", label: "Players", group: "Who runs this village", help: "Everyone in the village" },
      { key: "org-chart", label: "Org Chart", group: "Who runs this village", help: "Roles and who holds them" },
    ]);
    const out = searchAdmin("where is the org chart with roles", tabs, dials);
    expect(out.pages[0].key).toBe("org-chart");
    expect(queryWords("How do I change the settings?")).toEqual([]);
  });

  it("marks which settings may be proposed and withholds a credential-shaped value", () => {
    const withheld = VARIABLES.find((v) => v.withheld);
    const out = searchAdmin("calendar hemisphere moon", [], dials);
    expect(out.settings.length).toBeGreaterThan(0);
    for (const s of out.settings) expect(typeof s.proposable).toBe("boolean");
    if (withheld) {
      const hit = searchAdmin(withheld.label, [], dials.map((d) => (d.key === withheld.key ? { ...d, value: "https://x.example/v2/abcdef0123456789abcdef0123456789" } : d)));
      const row = hit.settings.find((s) => s.key === withheld.key);
      if (row) expect(row.value).toContain("withheld");
    }
  });
});

/**
 * THE RULES AS A VALUE (the founder, 27 Nov 2026). Every rule function answers under the rules as they always were
 * unless it is handed others. Each kind of dial is picked by what it is: money by its category, sealed and the
 * agents' own by their definition, the switches by their keys.
 */
describe("the guide's rules", () => {
  const OPEN: GuideRules = { wide: true, moneyDials: true };
  const ADVISING: GuideRules = { wide: true, moneyDials: false };
  const EVERY: Array<GuideRules | undefined> = [undefined, TODAYS_RULES, OPEN, ADVISING];
  const sealed = (v: VariableDef) => !!v.withheld || !!v.movedToSecret;
  const inMoney = (v: VariableDef) => HANDS_OFF_CATEGORIES.includes(v.category) && !sealed(v) && !v.key.startsWith("agents.");
  const BOUNDED = ["integer", "decimal", "percentage", "boolean", "choice"];
  const current = () => undefined;

  it("the rules as they always were are narrow, and are what every function answers under when handed none", () => {
    expect(TODAYS_RULES).toEqual({ wide: false, moneyDials: false });
    for (const v of VARIABLES) {
      expect(proposalRefusal(v, TODAYS_RULES), v.key).toBe(proposalRefusal(v));
      expect(guideMaySee(v, TODAYS_RULES), v.key).toBe(guideMaySee(v));
    }
  });

  it("a money dial with bounds may be prepared only while the village's money dial is on", () => {
    const bounded = VARIABLES.filter((v) => inMoney(v) && BOUNDED.includes(v.type));
    expect(bounded.length).toBeGreaterThan(30);
    for (const v of bounded) {
      expect(proposalRefusal(v), v.key).toContain("money settings stay in your own hands");
      expect(proposalRefusal(v, ADVISING), v.key).toBe(proposalRefusal(v));
      expect(proposalRefusal(v, OPEN), v.key).toBeNull();
      // Money dials open only with the dock's rules: named without them, the rule set opens nothing.
      expect(proposalRefusal(v, { wide: false, moneyDials: true }), v.key).toBe(proposalRefusal(v));
    }
  });

  it("a money dial in free text is refused under every rule set, and says why once money dials are open", () => {
    const text = VARIABLES.filter((v) => inMoney(v) && !BOUNDED.includes(v.type));
    expect(text.length).toBeGreaterThan(5);
    expect(text.some((v) => v.type === "longtext")).toBe(true);
    for (const v of text) {
      expect(proposalRefusal(v), v.key).toContain("money settings stay in your own hands");
      expect(proposalRefusal(v, ADVISING), v.key).toContain("money settings stay in your own hands");
      expect(proposalRefusal(v, OPEN), v.key).toBe(`${v.label} names where value goes or who holds it, so only a person changes it: open ${v.category} under Game Mechanics to set it.`);
    }
  });

  it("holds under every rule set: an unknown dial, a sealed one, a withheld one, her three switches, the agents' own, choosing people", () => {
    const agents = VARIABLES.filter((v) => v.key.startsWith("agents."));
    const withheld = VARIABLES.filter((v) => v.withheld && !v.movedToSecret);
    const moved = VARIABLES.filter((v) => v.movedToSecret);
    const choosing = VARIABLES.filter((v) => (proposalRefusal(v) ?? "").includes("stays out of selection"));
    for (const list of [agents, withheld, moved, choosing]) expect(list.length).toBeGreaterThan(0);
    for (const rules of EVERY) {
      expect(proposalRefusal(undefined, rules)).toBe("That is not a setting Admin knows.");
      for (const v of moved) expect(proposalRefusal(v, rules), v.key).toContain("lives in the sealed connections");
      for (const v of withheld) expect(proposalRefusal(v, rules), v.key).toBe(`${v.label} can hold a key or people's private details, so only a person changes it: open Game Mechanics to set it.`);
      for (const v of agents) expect(proposalRefusal(v, rules), v.key).toBe(`${v.label} decides what the agent accounts may do, so only a person changes it: open Game Mechanics to set it.`);
      for (const v of choosing) expect(proposalRefusal(v, rules), v.key).toContain("stays out of selection");
      expect(proposalRefusal(VARIABLES_BY_KEY[HELPER_SWITCH], rules)).toContain("cannot switch itself on or off");
      expect(proposalRefusal(VARIABLES_BY_KEY[DOCK_SWITCH], rules)).toContain("cannot turn its own dock on or off");
      expect(proposalRefusal(VARIABLES_BY_KEY[MONEY_SWITCH], rules)).toBe("What the guide may prepare is your village's decision, so only a person changes this: open Game Mechanics to set it.");
    }
  });

  it("asks in order: a sealed money dial is sealed first, and a switch is a switch before it is anything else", () => {
    const sealedMoney = VARIABLES.find((v) => HANDS_OFF_CATEGORIES.includes(v.category) && v.movedToSecret);
    if (sealedMoney) expect(proposalRefusal(sealedMoney, OPEN)).toContain("lives in the sealed connections");
    // The patterns for money and for choosing people are as they were: opening money dials changes neither list.
    const money = (rules?: GuideRules) => VARIABLES.filter((v) => /money/.test(proposalRefusal(v, rules) ?? "")).map((v) => v.key);
    expect(money(ADVISING)).toEqual(money());
    expect(VARIABLES.filter((v) => mayPropose(v, ADVISING)).map((v) => v.key)).toEqual(VARIABLES.filter((v) => mayPropose(v)).map((v) => v.key));
    // What opening money dials adds is money dials with bounds, and nothing else.
    const added = VARIABLES.filter((v) => mayPropose(v, OPEN) && !mayPropose(v));
    expect(added.length).toBeGreaterThan(30);
    for (const v of added) {
      expect(proposalRefusal(v), v.key).toContain("is about money");
      expect(BOUNDED, v.key).toContain(v.type);
    }
  });

  it("she sees every dial but a sealed one under the wide rules, and exactly what she saw before under the others", () => {
    for (const v of VARIABLES) {
      expect(guideMaySee(v, OPEN), v.key).toBe(!sealed(v));
      expect(guideMaySee(v, ADVISING), v.key).toBe(!sealed(v));
    }
    expect(guideMaySee(undefined, OPEN)).toBe(false);
    const withheld = VARIABLES.find((v) => v.withheld && !v.movedToSecret);
    if (withheld) expect(guideMaySee(withheld)).toBe(true);
    expect(VARIABLES.filter((v) => inMoney(v)).every((v) => !guideMaySee(v))).toBe(true);
  });

  it("a word every object answers to is not a dial, on either road", () => {
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
      for (const rules of EVERY) {
        expect(buildProposal({ key, value: "5" }, current, rules), key).toEqual({ ok: false, error: "That is not a setting Admin knows.", held: true });
        expect(buildAdvice({ key, value: "5" }, current, rules), key).toBeNull();
      }
    }
  });

  it("builds a proposal for a money dial with bounds only under open rules, and marks a refusal a rule made", () => {
    const v = VARIABLES.find((d) => inMoney(d) && d.type === "integer")!;
    const to = String(Number(v.default) + 1);
    expect(buildProposal({ key: v.key, value: to }, current)).toMatchObject({ ok: false, held: true });
    expect(buildProposal({ key: v.key, value: to }, current, ADVISING)).toMatchObject({ ok: false, held: true });
    expect(buildProposal({ key: v.key, value: to, why: "asked" }, current, OPEN)).toEqual({
      ok: true,
      proposal: { key: v.key, label: v.label, category: v.category, from: v.default, to, why: "asked", applyPath: `/api/admin/variables/${encodeURIComponent(v.key)}` },
    });
    // A refusal about the value is no rule's: it carries no mark.
    expect(buildProposal({ key: v.key, value: v.default }, current, OPEN)).toEqual({ ok: false, error: `${v.label} is already set to that.` });
    expect(buildProposal({ key: v.key, value: "plenty" }, current, OPEN)).not.toHaveProperty("held");
  });

  describe("buildAdvice", () => {
    const safe = VARIABLES.find((d) => d.type === "boolean" && mayPropose(d))!;
    const to = safe.default === "true" ? "false" : "true";

    it("is null without the wide rules, for nothing, for a list, for an unknown dial and for a sealed one", () => {
      expect(buildAdvice({ key: safe.key, value: to }, current)).toBeNull();
      expect(buildAdvice({ key: safe.key, value: to }, current, TODAYS_RULES)).toBeNull();
      expect(buildAdvice(null, current, OPEN)).toBeNull();
      expect(buildAdvice("advice", current, OPEN)).toBeNull();
      expect(buildAdvice([{ key: safe.key, value: to }], current, OPEN)).toBeNull();
      expect(buildAdvice({ value: to }, current, OPEN)).toBeNull();
      expect(buildAdvice({ key: "no.such_dial", value: to }, current, OPEN)).toBeNull();
      for (const v of VARIABLES.filter(sealed)) expect(buildAdvice({ key: v.key, value: v.default }, current, OPEN), v.key).toBeNull();
    });

    it("keeps six fields, all but the value and the reason read from the dial, and nothing else the model sent", () => {
      const out = buildAdvice(
        { key: safe.key, value: to, why: "  It  suits you.  ", label: "Press here", category: "Trusted", now: "x", suggested: "y", href: "https://elsewhere.example", path: "/api/admin/tokens/mint", tab: "secrets", applyPath: "/api/admin/users/u-9/role" },
        current,
        OPEN,
      );
      expect(out).toEqual({ key: safe.key, label: safe.label, category: safe.category, now: safe.default, suggested: to, why: "It suits you." });
    });

    it("suggests only a value the dial would take and that changes something, read against the value as it stands", () => {
      expect(buildAdvice({ key: safe.key, value: "perhaps" }, current, OPEN)?.suggested).toBeNull();
      expect(buildAdvice({ key: safe.key, value: safe.default }, current, OPEN)?.suggested).toBeNull();
      expect(buildAdvice({ key: safe.key }, current, OPEN)).toMatchObject({ now: safe.default, suggested: null, why: "" });
      expect(buildAdvice({ key: safe.key, value: safe.default }, () => to, OPEN)).toMatchObject({ now: to, suggested: safe.default });
      expect(buildAdvice({ key: safe.key, value: true }, () => "false", OPEN)?.suggested).toBe("true");
      expect(buildAdvice({ key: safe.key, value: { nested: "true" } }, current, OPEN)?.suggested).toBeNull();
      expect(buildAdvice({ key: safe.key, value: to, why: "y".repeat(900) }, current, OPEN)?.why).toHaveLength(400);
    });

    it("is drawn for any dial she may see under the wide rules, whichever way the village's money dial stands", () => {
      for (const rules of [OPEN, ADVISING]) {
        for (const v of VARIABLES) {
          const out = buildAdvice({ key: v.key, why: "asked" }, current, rules);
          if (sealed(v)) expect(out, v.key).toBeNull();
          else expect(out, v.key).toEqual({ key: v.key, label: v.label, category: v.category, now: v.default, suggested: null, why: "asked" });
        }
      }
    });
  });

  describe("searchAdmin under the rules", () => {
    const everything = VARIABLES.map((v) => v.label).join(" ");
    const all = { tabs: 8, dials: 10_000 };

    it("shows money and selection dials under the wide rules, never a sealed one, and marks what she may prepare", () => {
      const before = searchAdmin(everything, [], dials, all);
      const open = searchAdmin(everything, [], dials, all, OPEN);
      const closed = searchAdmin(everything, [], dials, all, ADVISING);
      expect(before.leftOut).toBe("Money, role selection and sealed settings are never shown to the guide.");
      expect(open.leftOut).toBe("Sealed settings are never shown to the guide.");
      expect(closed.leftOut).toBe(open.leftOut);
      const keys = (out: typeof open) => new Set(out.settings.map((s) => s.key));
      for (const v of VARIABLES.filter((d) => inMoney(d))) {
        expect(keys(before).has(v.key), v.key).toBe(false);
      }
      const shownMoney = VARIABLES.filter((d) => inMoney(d) && keys(open).has(d.key));
      expect(shownMoney.length).toBeGreaterThan(30);
      for (const v of VARIABLES.filter(sealed)) {
        expect(keys(open).has(v.key), v.key).toBe(false);
        expect(keys(closed).has(v.key), v.key).toBe(false);
      }
      for (const s of open.settings) expect(s.proposable, s.key).toBe(mayPropose(VARIABLES_BY_KEY[s.key], OPEN));
      for (const s of closed.settings) expect(s.proposable, s.key).toBe(mayPropose(VARIABLES_BY_KEY[s.key]));
      expect(open.settings.filter((s) => s.proposable).length).toBeGreaterThan(closed.settings.filter((s) => s.proposable).length);
    });

    it("still withholds a value shaped like a key, under the wide rules too", () => {
      const v = VARIABLES.find((d) => d.type === "text" && !sealed(d) && guideMaySee(d, OPEN))!;
      const hit = searchAdmin(v.label, [], dials.map((d) => (d.key === v.key ? { ...d, value: "https://x.example/v2/abcdef0123456789abcdef0123456789" } : d)), all, OPEN);
      expect(hit.settings.find((s) => s.key === v.key)?.value).toContain("withheld");
    });
  });
});
