/**
 * THE ADMIN HELPER, the pure half (2026-11-09).
 *
 * The village's guide (under the name the village gave it, or Sera) in a
 * panel beside Admin. It answers "how do I", finds the right page or setting,
 * explains what a control does, and proposes ONE change at a time for the
 * admin to apply. The server half is server/routes/adminHelper.ts; the panel
 * is client/src/components/admin/AdminHelperPanel.tsx.
 *
 * Shared because both sides read it: the client sends the Admin map it is
 * showing (the tabs this admin can actually open), and the server ranks that
 * map and the game dials against the question. Pure: no I/O, no clock.
 *
 * WHAT IT MAY READ (the coordinator's guardrail, 2026-11-09, from Rye's
 * role-journey rule "no AI in selection"). Settings, help text and the SHAPE
 * of the org chart. Never role applications or open proposals (their words,
 * contact details, time zones), interview scores, role terms or pay, and no
 * person's details. The server's tool layer refuses those reads by name
 * (`DENIED_READS`, server/routes/adminHelper.ts), and the dial search below
 * leaves out every money and selection dial, so the guide never sees them.
 *
 * WHAT IT MAY PROPOSE. A game dial (shared/gameVariables.ts), and only one
 * that is not about money. Money actions stay manual (the brief, 2026-11-09:
 * role.pay, cash.pay, budgets, exchange, redemption), so a dial in a money
 * category, or whose key names pay, price, cash, budget, mint, exchange,
 * redemption or a fee, is refused here before a card is ever drawn. So is a
 * dial whose value moved into the sealed secrets. The Apply button then goes
 * through `PUT /api/admin/variables/:key`, the dial's own route, with every
 * guard it already has (who may act, the founder override, the ledger). The
 * model never writes.
 *
 * THE RULES ARE A VALUE (`GuideRules`; the founder, 27 Nov 2026). Everything
 * above is `TODAYS_RULES`, and every rule function answers under it unless it
 * is handed another. With the village's dock on the rules are WIDE: the guide
 * sees every dial that is not sealed, money and selection dials among them,
 * and may advise on any of them (`buildAdvice`: a card with no apply). With
 * the village's money dial on as well (`MONEY_SWITCH`, which ships on and a
 * village may close) she may place a value for a village-wide money dial on
 * the save bar, for a person to save. Never, under any rules: a money dial in
 * free text (it names where value goes or who holds it), a dial about choosing
 * people, a sealed or withheld dial, a dial under `agents.`, or one of her own
 * three switches. Pay, payments and anything about one person are not dials,
 * and nothing here reaches them.
 */
import { VARIABLES_BY_KEY, validateVariable, withheldFromPublic, type VariableDef } from "./gameVariables";

/** One page of Admin as the panel saw it in the nav. */
export interface HelperTab {
  key: string;
  label: string;
  /** The nav group it sits under ("Who runs this village"). */
  group: string;
  /** Its one-line purpose, the same words as "What is this?". */
  help: string;
}

/** A dial as the helper reads it: what it is, and what it is set to now. */
export interface HelperDial {
  key: string;
  label: string;
  category: string;
  description: string;
  type: string;
  value: string;
  isDefault: boolean;
  min?: number;
  max?: number;
  choices?: Array<{ value: string; label: string }>;
  unit?: string;
}

/** The card the panel draws for a proposed change. */
export interface HelperProposal {
  key: string;
  label: string;
  category: string;
  from: string;
  to: string;
  why: string;
  /** The admin route the Apply button calls, so the card says where it goes. */
  applyPath: string;
}

/**
 * ADVICE ON ONE SETTING (the founder, 27 Nov 2026: she may advise and suggest;
 * the act stays a person's). What it is set to now, the value she suggests
 * when she has one the dial would take, and why. It carries no route, path,
 * address or tab: the page reaches the control from `key`, the way a proposal
 * card's "Take me there" does. It is never applied and never put on the save
 * bar.
 */
export interface HelperAdvice {
  key: string;
  label: string;
  category: string;
  now: string;
  /** The value she suggests, when the dial would take it and it changes something; else null. */
  suggested: string | null;
  why: string;
}

/**
 * A change the guide drafted for the review page (the dock, 27 Nov 2026;
 * server/lib/guideFiling.ts). It is not a dial, so it cannot go on the save
 * bar: "Send to review" files it into the queue at /admin/proposals, where a
 * person accepts it. The guide applies nothing.
 */
export interface HelperFiling {
  /** What it changes, in one sentence. */
  summary: string;
  /** Where it lands, as the review page names it ("Library", "Resident page"). */
  where: string;
  /** What it would set, field by field, for the card. */
  fields: Array<{ label: string; value: string }>;
  /** The change exactly as the server read it, signed for the person who asked. Send to review hands this back. */
  ticket: string;
}

/** What "Send to review" answers (POST /api/admin/helper/file). */
export interface HelperFiled {
  /** filed: waits on the review page. waiting: the same change already waits there. held: held before review, with the reason. */
  state: "filed" | "waiting" | "held";
  /** The short code the review page shows, such as B-27.1, when it has one. */
  code: string | null;
  /** A sentence for the card, when the queue had something to say. */
  words: string;
  reviewAt: string;
}

/** The ask route's answer. */
export interface HelperAnswer {
  reply: string;
  /** A page to open, from the tabs the panel sent. */
  open: { key: string; label: string } | null;
  proposal: HelperProposal | null;
  /** Why a proposed change was not drawn as a card, in plain words. */
  refused: string | null;
  /** Which readers the guide opened, for the transparency line. */
  consulted: string[];
  /** A change drafted for the review page. Only ever sent while the village's dock is on. */
  filing?: HelperFiling | null;
  /** Advice on a setting, with no apply. Only ever sent while the village's dock is on. */
  advice?: HelperAdvice | null;
}

/**
 * Who answers. `anthropic` is the village's own Anthropic key, and wins when
 * it is set. `sera` is the org memory service's agent, reached through the
 * village's Saberra connection, used when there is no Anthropic key.
 */
export type HelperProvider = "anthropic" | "sera";

/**
 * The status route's answer. `on` needs the village's switch (the dial
 * `platform.admin_helper`, ON by default) and an AI to answer: the village's
 * own Anthropic key, or a working Sera connection. `off` says which is
 * missing, switch first, so the panel names the right step; the Admin
 * banner asks for the key.
 */
export interface HelperStatus {
  on: boolean;
  guide: string;
  off: "switch" | "key" | null;
  provider: HelperProvider | null;
  /**
   * Every provider that could answer right now, default first. Two entries
   * means the admin may choose (Rye, 2026-11-09: "When both the anthropic key
   * and sera are set we should be able to choose between them").
   */
  available: HelperProvider[];
  /** The name each provider answers under. */
  names: Partial<Record<HelperProvider, string>>;
  /**
   * The village turned the guide's dock on (`DOCK_SWITCH`): Admin and the road
   * to launch draw the dock in place of the helper panel and the launch guide.
   * Absent while it is off, so an off village's answer is what it always was.
   */
  dock?: boolean;
  /**
   * Only with the dock on: the village has no Anthropic key of its own, and
   * its own model answers on a key the platform lends for now. The page says
   * so, and never says "your village's own key" of a key that is not.
   */
  lent?: boolean;
  /** Only with the dock on: the rules the guide answers under, so the page can say what is true of her. */
  rules?: GuideRules;
}

/** The provider a request asked for, when it is one that could answer; else the default. */
export function chooseProvider(asked: unknown, available: readonly HelperProvider[]): HelperProvider | null {
  return available.find((p) => p === asked) ?? available[0] ?? null;
}

/** The village's own switch for the helper. Ships on; a village may turn it off. */
export const HELPER_SWITCH = "platform.admin_helper";

/** The village's switch for the guide's dock (shared/gameVariables.ts). Ships off. */
export const DOCK_SWITCH = "platform.admin_guide_dock";

/**
 * The village's switch for money settings (shared/gameVariables.ts): with the
 * dock on, whether the guide may place a village-wide money setting on the
 * save bar. Ships on, a village may close it, and it does nothing while the
 * dock is off.
 */
export const MONEY_SWITCH = "platform.admin_guide_money";

// ── The rules, as a value ───────────────────────────────────────────────────

/** The rules the guide answers under. The server makes this from the village's two dials; nothing a model says changes it. */
export interface GuideRules {
  /** The dock's rules: she sees every dial that is not sealed, and may advise on any of them. */
  wide: boolean;
  /** She may place a village-wide money dial on the save bar. Only ever true with `wide`. */
  moneyDials: boolean;
}

/** The rules as they always were, and as they stay with the dock off. */
export const TODAYS_RULES: GuideRules = { wide: false, moneyDials: false };

// ── The map the panel sends ─────────────────────────────────────────────────

export const MAX_TABS = 200;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/**
 * The tabs the client sent, bounded and stripped to plain strings. A key is
 * the shape every Admin tab key has (lowercase words and dashes), so nothing
 * odd can ride a key into an "open this page" link.
 */
export function cleanTabs(incoming: unknown): HelperTab[] {
  if (!Array.isArray(incoming)) return [];
  const out: HelperTab[] = [];
  const seen = new Set<string>();
  for (const t of incoming.slice(0, MAX_TABS)) {
    const key = clip((t as any)?.key, 60);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(key) || seen.has(key)) continue;
    const label = clip((t as any)?.label, 60);
    if (!label) continue;
    seen.add(key);
    out.push({ key, label, group: clip((t as any)?.group, 60), help: clip((t as any)?.help, 200) });
  }
  return out;
}

// ── Money stays manual ──────────────────────────────────────────────────────

/** Dial categories that are about money, value or pay. */
export const HANDS_OFF_CATEGORIES: readonly string[] = [
  "Ledger",
  "The Mint",
  "Tokens",
  "Payments",
  "Exchange",
  "Gratitude",
  "Exit",
  "Stays",
];

/** A dial key naming money, whatever category it sits in. */
const MONEY_KEY = /(pay|price|cash|budget|mint|exchange|redeem|redemption|fee|wage|reward|treasur|fund|loan|dues|token|credit|ledger)/i;

/** A dial about choosing people for roles: applications, interviews, terms. No AI in selection. */
const SELECTION = /(applica|applicant|candidate|interview|selection|shortlist|role_term|seat_term|term_length|term_months|term_days)/i;

/** A dial by its key, or undefined. Only a key the registry itself holds: a word every object answers to is not a dial. */
function dialOf(key: string): VariableDef | undefined {
  return Object.prototype.hasOwnProperty.call(VARIABLES_BY_KEY, key) ? VARIABLES_BY_KEY[key] : undefined;
}

type Named = Pick<VariableDef, "key" | "label" | "category">;
const aboutMoney = (def: Named) => HANDS_OFF_CATEGORIES.includes(def.category) || MONEY_KEY.test(def.key);
const aboutChoosing = (def: Named) => SELECTION.test(def.key) || SELECTION.test(def.label);

/**
 * Whether the guide may see this dial at all. Under the rules as they always
 * were: never money, never selection, never a dial whose value moved into the
 * sealed secrets. Under the wide rules: every dial but a sealed one, which is
 * one whose value moved into the secrets or is withheld because it can carry
 * a key or people's addresses.
 */
export function guideMaySee(def: (Named & Pick<VariableDef, "movedToSecret" | "withheld">) | undefined, rules: GuideRules = TODAYS_RULES): boolean {
  if (!def) return false;
  if (rules.wide) return !def.movedToSecret && !def.withheld;
  if (def.movedToSecret) return false;
  if (aboutMoney(def)) return false;
  if (aboutChoosing(def)) return false;
  return true;
}

/**
 * Why the helper may not propose a change to this dial, or null when it may.
 * The sentence lands in the panel, so it is written for the admin. It is the
 * server's own plain sentence and never the guide's voice: what is true, and
 * what the person can do.
 *
 * Asked in this order. These hold under every rule set: a dial Admin does not
 * know, a sealed one, a withheld one, her own three switches, and any dial
 * under `agents.`. A money dial is refused unless the rules open money dials,
 * and then only free text is: it names where value goes or who holds it. A
 * dial about choosing people is refused under every rule set, a money dial
 * that is also about choosing people among them.
 */
export function proposalRefusal(def: VariableDef | undefined, rules: GuideRules = TODAYS_RULES): string | null {
  if (!def) return "That is not a setting Admin knows.";
  if (def.movedToSecret) return `${def.label} lives in the sealed connections now, so change it under Integrations yourself.`;
  if (def.withheld) return `${def.label} can hold a key or people's private details, so only a person changes it: open Game Mechanics to set it.`;
  if (def.key === HELPER_SWITCH) return "The helper cannot switch itself on or off. That is the village's decision, made under Game Mechanics.";
  if (def.key === DOCK_SWITCH) return "The guide cannot turn its own dock on or off. That is the village's decision, made under Game Mechanics.";
  if (def.key === MONEY_SWITCH) return "What the guide may prepare is your village's decision, so only a person changes this: open Game Mechanics to set it.";
  if (def.key.startsWith("agents.")) return `${def.label} decides what the agent accounts may do, so only a person changes it: open Game Mechanics to set it.`;
  if (aboutMoney(def)) {
    // Money dials open only with the wide rules: a rule set that names one without the other opens nothing.
    if (!(rules.wide && rules.moneyDials)) return `${def.label} is about money, and money settings stay in your own hands. Open ${def.category} under Game Mechanics to change it.`;
    if (def.type === "text" || def.type === "longtext") {
      return `${def.label} names where value goes or who holds it, so only a person changes it: open ${def.category} under Game Mechanics to set it.`;
    }
    // An open money dial is still asked the next question: one that is also about choosing people stays a person's.
  }
  if (aboutChoosing(def)) {
    return `${def.label} is about choosing people for roles, and the helper stays out of selection. Change it by hand under Game Mechanics.`;
  }
  return null;
}

/** Whether the helper may propose this dial. */
export function mayPropose(def: VariableDef | undefined, rules: GuideRules = TODAYS_RULES): boolean {
  return proposalRefusal(def, rules) === null;
}

/** A value as the model sent it, as the text a dial stores; null when it sent none. */
function saidValue(raw: unknown): string | null {
  return typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" ? String(raw).trim() : null;
}

/**
 * The card for one proposed change, or the plain reason there is none.
 * `current` is what the dial holds now; a proposal that changes nothing is
 * refused rather than drawn, because an Apply button that does nothing
 * teaches an admin the button is decoration.
 */
export function buildProposal(
  raw: unknown,
  current: (key: string) => string | undefined,
  rules: GuideRules = TODAYS_RULES,
): { ok: true; proposal: HelperProposal } | { ok: false; error: string; held?: true } | null {
  if (!raw || typeof raw !== "object") return null;
  const key = clip((raw as any).key, 120);
  if (!key) return null;
  const def = dialOf(key);
  const refusal = proposalRefusal(def, rules);
  // `held`: a rule about the dial refused it, whatever value was asked for. The other refusals are about the value.
  if (refusal || !def) return { ok: false, error: refusal ?? "That is not a setting Admin knows.", held: true };
  const to = saidValue((raw as any).value) ?? "";
  const problem = validateVariable(def, to);
  if (problem) return { ok: false, error: `${def.label} cannot be set to that: ${problem}` };
  const from = current(key) ?? def.default;
  if (from === to) return { ok: false, error: `${def.label} is already set to that.` };
  return {
    ok: true,
    proposal: {
      key,
      label: def.label,
      category: def.category,
      from,
      to,
      why: clip((raw as any).why, 400),
      applyPath: `/api/admin/variables/${encodeURIComponent(key)}`,
    },
  };
}

// ── Advice: said, never applied ─────────────────────────────────────────────

/** The shape of `advise` in the answer, as both answerers are told it and as `buildAdvice` reads it. */
export const ADVISE_ANSWER_SHAPE = '"advise": null or {"key": "<setting key>", "value": "<the value you suggest, as text, or leave it out>", "why": "<one sentence>"}';

/**
 * The advice card for one setting, or null. Only under the wide rules, and
 * only for a dial she may see there. Everything on the card but `suggested`
 * and `why` is read from the dial's own definition and its current value, and
 * nothing else the model sent is kept: no route, address, path, tab or label
 * of its own. `suggested` is kept only when the dial would take it and it
 * changes something.
 */
export function buildAdvice(raw: unknown, current: (key: string) => string | undefined, rules: GuideRules = TODAYS_RULES): HelperAdvice | null {
  if (!rules.wide || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const key = clip((raw as any).key, 120);
  const def = key ? dialOf(key) : undefined;
  if (!def || !guideMaySee(def, rules)) return null;
  const now = current(key) ?? def.default;
  const said = saidValue((raw as any).value);
  const suggested = said !== null && said !== now && validateVariable(def, said) === null ? said : null;
  return { key, label: def.label, category: def.category, now, suggested, why: clip((raw as any).why, 400) };
}

// ── Finding things ──────────────────────────────────────────────────────────

const STOP = new Set([
  "the", "and", "for", "how", "what", "where", "when", "who", "why", "can", "does", "this", "that", "with",
  "from", "into", "our", "your", "you", "are", "was", "will", "would", "should", "could", "there", "here",
  "about", "change", "set", "find", "show", "turn", "make", "want", "need", "page", "setting", "settings",
  "admin", "village", "please", "help", "tell", "explain", "which", "have", "has", "its", "it's", "not",
]);

/** The words of a question worth matching on. */
export function queryWords(q: string): string[] {
  return Array.from(new Set(
    String(q ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)),
  ));
}

function score(words: string[], strong: string, medium: string, weak: string): number {
  let n = 0;
  const s = strong.toLowerCase(), m = medium.toLowerCase(), w = weak.toLowerCase();
  for (const word of words) {
    if (s.includes(word)) n += 3;
    if (m.includes(word)) n += 2;
    if (w.includes(word)) n += 1;
  }
  return n;
}

/**
 * Admin pages and dials ranked against the question, with every dial the guide
 * may not see under `rules` left out before ranking: money, selection and
 * sealed dials under the rules as they always were, and sealed dials alone
 * under the wide ones. The value of a dial that can carry a credential is
 * withheld, the way the public mechanics feed withholds it: this result goes
 * to a model provider.
 */
export function searchAdmin(
  query: string,
  tabs: readonly HelperTab[],
  dials: readonly HelperDial[],
  limits = { tabs: 8, dials: 10 },
  rules: GuideRules = TODAYS_RULES,
): { pages: Array<HelperTab>; settings: Array<HelperDial & { proposable: boolean }>; leftOut: string } {
  const words = queryWords(query);
  const pages = tabs
    .map((t) => ({ t, n: score(words, t.label, t.group, t.help) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limits.tabs)
    .map((x) => x.t);
  const settings = dials
    .filter((d) => guideMaySee(dialOf(d.key), rules))
    .map((d) => ({ d, n: score(words, d.label, `${d.category} ${d.key}`, d.description) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limits.dials)
    .map(({ d }) => {
      const def = dialOf(d.key);
      const hidden = def ? withheldFromPublic({ withheld: def.withheld, value: d.value }) : false;
      return {
        ...d,
        description: d.description.slice(0, 300),
        value: hidden ? "(withheld: it can carry a key)" : d.value,
        proposable: mayPropose(def, rules),
      };
    });
  return { pages, settings, leftOut: rules.wide ? "Sealed settings are never shown to the guide." : "Money, role selection and sealed settings are never shown to the guide." };
}
