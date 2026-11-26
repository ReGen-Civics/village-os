/**
 * THE PLAYER CARD SAID AGAIN IN THE READER'S LANGUAGE (the lead, 26 Nov 2026: the whole site in Spanish). Pure.
 *
 * `buildPlayerCard` builds the card in English and notes what each sentence was made from (`card.said`,
 * shared/playerCardSay.ts). For a reader who asked for another language, the server hands that card and a `say`
 * for the language to `sayCardIn`, which says every noted sentence again from the same key and arguments, each day
 * and each list of names in the reader's language. A person's own words stay as they wrote them, and a sentence
 * the language has no words for stays in English.
 *
 * `say` reads one message (shared/playerCardMessages.ts) in the reader's language, and throws when the language has
 * none; server/lib/platformSpeech.ts makes it from the compiled catalog. The table reads each entry only when it is
 * used, so a missing message leaves that one sentence in English and nothing else.
 */
import { CARD_WORDS, WEEKDAYS, type PlayerCard } from "./playerCard";
import type { CardMessageKey } from "./playerCardMessages";
import { MONTH_NAMES } from "./playerCardHero";
import { HANDOVER_PREFIX, HEALTH_PREFIX, JOIN_KEY, LIST_KEY } from "./playerCardSay";
import type { HealthWordsIn } from "./playerCardHealthMessages";
import type { SaidArg, SaidDay } from "./saidWords";

type English = typeof CARD_WORDS;
/** The table's shape with every fixed line as a plain string, so a translation fits where the English did. */
export type PlayerCardWords = {
  [K in keyof English]: English[K] extends string
    ? string
    : English[K] extends readonly [string, string]
      ? readonly [string, string]
      : English[K] extends (...a: infer A) => infer R
        ? (...a: A) => R extends string ? string : R
        : English[K];
};
/** The entries that are one fixed line. */
export type FixedCardWord = { [K in keyof English]: English[K] extends string ? K : never }[keyof English];

/** One message in the reader's language. Throws when the language has none. */
export type CardSay = (key: CardMessageKey, values?: Record<string, unknown>) => string;

/** "a", "a and b", "a, b and c" in the reader's language. */
export function listIn(items: readonly string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale === "en" ? "en-GB" : locale, { type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** The card's table in the reader's language. */
export function cardWordsWith(s: CardSay, locale: string): PlayerCardWords {
  const english = !locale || locale === "en";
  const month = (name: string): string => {
    const i = (MONTH_NAMES as readonly string[]).indexOf(name);
    if (english || i < 0) return name;
    try {
      return new Date(Date.UTC(2026, i, 15)).toLocaleDateString(locale, { month: "long", timeZone: "UTC" });
    } catch {
      return name;
    }
  };
  const weekdayName = (wd: number): string => {
    const name = WEEKDAYS[wd];
    if (name === undefined) return s("aSetDay");
    if (english) return name;
    try {
      // 2026-11-01 is a Sunday, the table's day 0.
      return new Date(Date.UTC(2026, 10, 1 + wd)).toLocaleDateString(locale, { weekday: "long", timeZone: "UTC" });
    } catch {
      return name;
    }
  };
  const count = (n: number) => s("countWord", { n });
  return {
    get holdsNoRoles() {
      return s("holdsNoRoles");
    },
    rolesLine: (n: number, names: string) => s("rolesLine", { n, names }),
    dayOfSeason: (day: number, of: number) => s("dayOfSeason", { day, of }),
    get seasonNotRead() {
      return s("seasonNotRead");
    },
    appliesFor: (names: string) => s("appliesFor", { names }),
    moonName: (m: string) => s("moonName", { month: month(m) }),
    moonPill: (moon: string, day: number, of: number) => s("moonPill", { moon, day, of }),
    moonLine: (moon: string, from: string, to: string) => s("moonLine", { moon, from, to }),
    heroSpan: (from: string, to: string) => s("heroSpan", { from, to }),
    // The count is said again from `n`, in the reader's language; the English one the server sent is not needed.
    tagline: (_count: string, n: number, circles: string | null, time: string | null, applying: boolean) => {
      let roles = applying ? s("taglineProposing", { count: count(n).toLocaleLowerCase(locale || "en"), n }) : s("taglineRoles", { count: count(n), n });
      if (circles) roles = s("taglineIn", { roles, circles });
      return time ? s("taglineTime", { roles, time }) : roles;
    },
    get fullTime() {
      return s("fullTime");
    },
    aboutHours: (n: number) => s("aboutHours", { n }),
    portraitAlt: (name: string) => s("portraitAlt", { name }),
    get applyDoor() {
      return s("applyDoor");
    },
    get planDoor() {
      return s("planDoor");
    },
    get myRoles() {
      return s("myRoles");
    },
    get proposedRoles() {
      return s("proposedRoles");
    },
    get acrossOne() {
      return s("acrossOne");
    },
    acrossMany: (n: number) => s("acrossMany", { n }),
    myNRoles: (n: number) => s("myNRoles", { n }),
    eachInFull: (n: number) => s("eachInFull", { n }),
    get aim() {
      return s("aim");
    },
    get noAim() {
      return s("noAim");
    },
    get noPlan() {
      return s("noPlan");
    },
    seasonalGoals: (n: number) => s("seasonalGoals", { n }),
    get seasonalGoalsLede() {
      return s("seasonalGoalsLede");
    },
    get noSeasonalGoals() {
      return s("noSeasonalGoals");
    },
    goalDoneBy: (day: string, w: string) => s("goalDoneBy", { day, w }),
    get goals() {
      return s("goals");
    },
    get noGoals() {
      return s("noGoals");
    },
    get howItHelps() {
      return s("howItHelps");
    },
    get howItHelpsMissing() {
      return s("howItHelpsMissing");
    },
    get tasks() {
      return s("tasks");
    },
    get noTasks() {
      return s("noTasks");
    },
    get taskOpen() {
      return s("taskOpen");
    },
    get taskDone() {
      return s("taskDone");
    },
    doneWhen: (w: string) => s("doneWhen", { w }),
    get signs() {
      return s("signs");
    },
    signsLede: (village: string | null) => (village ? s("signsLede", { village }) : s("signsLedePlain")),
    signFrom: (countedFrom: string, role: string) => s("signFrom", { countedFrom, role }),
    nOf: (n: number, of: number) => s("nOf", { n, of }),
    get noSigns() {
      return s("noSigns");
    },
    get load() {
      return s("load");
    },
    loadRoles: (n: number) => s("loadRoles", { n }),
    loadTasks: (n: number) => s("loadTasks", { n }),
    get loadCaption() {
      return s("loadCaption");
    },
    get loadNotSet() {
      return s("loadNotSet");
    },
    get loadSlider() {
      return s("loadSlider");
    },
    get loadEnds() {
      return [s("loadStep1"), s("loadStep5")] as const;
    },
    get loadStep() {
      return { 1: s("loadStep1"), 2: s("loadStep2"), 3: s("loadStep3"), 4: s("loadStep4"), 5: s("loadStep5") };
    },
    get trend() {
      return { up: s("trendUp"), down: s("trendDown"), same: s("trendSame") };
    },
    get trendLater() {
      return s("trendLater");
    },
    openSheet: (sign: string) => s("openSheet", { sign }),
    get wallet() {
      return s("wallet");
    },
    get pendingRoleWords() {
      return s("pendingRoleWords");
    },
    get growingEdge() {
      return s("growingEdge");
    },
    get whoCouldHoldNext() {
      return s("whoCouldHoldNext");
    },
    get keyRole() {
      return s("keyRole");
    },
    heldUntil: (day: string) => s("heldUntil", { day }),
    reviewWeekOf: (day: string) => s("reviewWeekOf", { day }),
    get purpose() {
      return s("purpose");
    },
    get noPurpose() {
      return s("noPurpose");
    },
    get existsWhile() {
      return s("existsWhile");
    },
    get decide() {
      return s("decide");
    },
    get authorities() {
      return s("authorities");
    },
    get bringMe() {
      return s("bringMe");
    },
    get countOnMe() {
      return s("countOnMe");
    },
    get responsibilities() {
      return s("responsibilities");
    },
    get holdingWell() {
      return s("holdingWell");
    },
    get signsStretched() {
      return s("signsStretched");
    },
    get flowsBack() {
      return s("flowsBack");
    },
    get stepBack() {
      return s("stepBack");
    },
    get timeCommitment() {
      return s("timeCommitment");
    },
    get termsKey() {
      return s("termsKey");
    },
    get working() {
      return s("working");
    },
    get worksWith() {
      return s("worksWith");
    },
    get notMine() {
      return s("notMine");
    },
    get runbook() {
      return s("runbook");
    },
    get powers() {
      return s("powers");
    },
    get powersShared() {
      return s("powersShared");
    },
    get suitedTo() {
      return s("suitedTo");
    },
    get suitedNote() {
      return s("suitedNote");
    },
    sharedWith: (label: string, roles: string) => s("sharedWith", { label, roles }),
    worksWithLine: (role: string, about: string) => s("worksWithLine", { role, about }),
    get noPowers() {
      return s("noPowers");
    },
    get notWritten() {
      return s("notWritten");
    },
    get playsAs() {
      return s("playsAs");
    },
    get notCountedYet() {
      return s("notCountedYet");
    },
    ofTarget: (n: number) => s("ofTarget", { n }),
    get tensions() {
      return s("tensions");
    },
    tensionsAnswered: (n: number) => s("tensionsAnswered", { n }),
    get noTensions() {
      return s("noTensions");
    },
    tensionsOpen: (n: number) => s("tensionsOpen", { n }),
    tensionsOpenPrivate: (n: number, withheld: number) => (withheld >= n ? s("tensionsOpenPrivateAll", { n }) : s("tensionsOpenPrivateSome", { n, withheld })),
    tensionsAnsweredThisMoon: (n: number) => s("tensionsAnsweredThisMoon", { n }),
    get noOpenTensions() {
      return s("noOpenTensions");
    },
    get tensionsBrought() {
      return s("tensionsBrought");
    },
    get tensionsWaiting() {
      return s("tensionsWaiting");
    },
    get timeline() {
      return s("timeline");
    },
    get timelineEyebrow() {
      return s("timelineEyebrow");
    },
    get invoiceDue() {
      return s("invoiceDue");
    },
    get today() {
      return s("today");
    },
    get timelineLede() {
      return s("timelineLede");
    },
    get gettingStarted() {
      return s("gettingStarted");
    },
    get newMoon() {
      return s("newMoon");
    },
    get fullMoon() {
      return s("fullMoon");
    },
    get tasksAgreed() {
      return s("tasksAgreed");
    },
    get newMoonCircle() {
      return s("newMoonCircle");
    },
    get fullMoonCheckIn() {
      return s("fullMoonCheckIn");
    },
    get carryOn() {
      return s("carryOn");
    },
    get endOfMoon() {
      return s("endOfMoon");
    },
    get signedOff() {
      return s("signedOff");
    },
    reviewOn: (role: string) => s("reviewOn", { role }),
    renewalOn: (role: string) => s("renewalOn", { role }),
    termEnds: (role: string) => s("termEnds", { role }),
    invoice: (role: string) => s("invoice", { role }),
    moonDates: (from: string, to: string) => s("moonDates", { from, to }),
    gathering: (label: string, weekday: number, time: string, fortnightly: boolean, role: string) =>
      s(fortnightly ? "gatheringFortnightly" : "gatheringWeekly", { label, weekday: weekdayName(weekday), time, role }),
    get accomplished() {
      return s("accomplished");
    },
    get noAccomplished() {
      return s("noAccomplished");
    },
    acceptedOn: (day: string) => s("acceptedOn", { day }),
    get howIHold() {
      return s("howIHold");
    },
    get applications() {
      return s("applications");
    },
    get historyEyebrow() {
      return s("historyEyebrow");
    },
    get past() {
      return s("past");
    },
    get thisSeason() {
      return s("thisSeason");
    },
    get nextSeason() {
      return s("nextSeason");
    },
    get noPast() {
      return s("noPast");
    },
    get noThisSeason() {
      return s("noThisSeason");
    },
    get noNextSeason() {
      return s("noNextSeason");
    },
    get startsOnceAdopted() {
      return s("startsOnceAdopted");
    },
    filedOn: (day: string) => s("filedOn", { day }),
    get agreements() {
      return s("agreements");
    },
    get agreementsEyebrow() {
      return s("agreementsEyebrow");
    },
    termsOnce: (n: string) => s("termsOnce", { count: n }),
    get noTerms() {
      return s("noTerms");
    },
    get clocks() {
      return s("clocks");
    },
    get payByMonth() {
      return s("payByMonth");
    },
    get payByMoon() {
      return s("payByMoon");
    },
    get workByMoon() {
      return s("workByMoon");
    },
    get workByWeek() {
      return s("workByWeek");
    },
    get term() {
      return s("term");
    },
    endsOn: (day: string) => s("endsOn", { day }),
    get endsWithSeason() {
      return s("endsWithSeason");
    },
    lengthMoons: (n: number) => s("lengthMoons", { n }),
    reviewDate: (day: string) => s("reviewDate", { day }),
    get noReviewDate() {
      return s("noReviewDate");
    },
    renewalDate: (day: string) => s("renewalDate", { day }),
    notice: (n: number) => s("notice", { n }),
    get rhythm() {
      return s("rhythm");
    },
    tasksPerMoon: (min: number | null, max: number | null) =>
      min !== null && max !== null && min !== max ? s("tasksPerMoonRange", { min, max }) : s("tasksPerMoon", { n: (min ?? max)! }),
    get ending() {
      return s("ending");
    },
    get payThroughNotice() {
      return s("payThroughNotice");
    },
    get pay() {
      return s("pay");
    },
    get allowance() {
      return s("allowance");
    },
    get bonus() {
      return s("bonus");
    },
    bonusEquity: (village: string, token: string) => s("bonusEquity", { village, token }),
    get bonusEquityNoToken() {
      return s("bonusEquityNoToken");
    },
    bonusCap: (w: string) => s("bonusCap", { w }),
    bonusRatedBy: (w: string) => s("bonusRatedBy", { w }),
    bonusCadence: (w: string) => s("bonusCadence", { w }),
  };
}

/** A day the server formatted, in the reader's language. */
function dayIn(d: SaidDay, locale: string): string | null {
  const civil = /^\d{4}-\d{2}-\d{2}$/.test(d.iso);
  const t = civil ? new Date(`${d.iso}T00:00:00Z`) : new Date(d.iso);
  if (Number.isNaN(t.getTime())) return null;
  try {
    return t.toLocaleDateString(locale, { day: "numeric", month: "long", ...(d.year ? { year: "numeric" } : {}), timeZone: civil ? "UTC" : (d.tz ?? undefined) });
  } catch {
    return null;
  }
}

/** Every string in a value, at any depth, passed through `say`; anything else as it is. */
function mapStrings<T>(v: T, say: (s: string) => string): T {
  if (typeof v === "string") return say(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, say)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, say)])) as T;
  return v;
}

/** Joined lines the builder put together (" · ", ". "): said again piece by piece when every piece is known. */
const JOINS = [" · ", ". "] as const;

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * The card the server built, said in the reader's language, with no record left on it. An English reader's card,
 * or a card with no record, is returned as built. `health` says the role health and handover lines
 * (shared/playerCardHealthMessages.ts); without it they stay as built.
 */
export function sayCardIn(card: PlayerCard, words: PlayerCardWords, locale: string, health?: HealthWordsIn): PlayerCard {
  const said = card.said;
  if (!locale || locale === "en" || !said) return card;
  const known = (s: string) => has(said.words, s) || has(said.days, s);
  const arg = (a: SaidArg): SaidArg => (typeof a === "string" && known(a) ? say(a) : a);
  function sayOne(english: string): string | null {
    const day = has(said!.days, english) ? said!.days[english] : undefined;
    const w = has(said!.words, english) ? said!.words[english] : undefined;
    if (!w) return day ? dayIn(day, locale) : null;
    if (w.k === LIST_KEY) {
      const items = w.a?.[0];
      return Array.isArray(items) ? listIn(items.map((x) => say(x)), locale) : null;
    }
    if (w.k === JOIN_KEY) {
      const [items, sep] = w.a ?? [];
      return Array.isArray(items) && typeof sep === "string" ? items.map((x) => say(x)).join(sep) : null;
    }
    // The health and handover lines are looked up in their own table, the rest in the card's.
    const [head, ...tail] = w.k.split(".");
    const own = head === HEALTH_PREFIX ? health?.health : head === HANDOVER_PREFIX ? health?.handover : undefined;
    if ((head === HEALTH_PREFIX || head === HANDOVER_PREFIX) && !own) return null;
    let entry: unknown = own ?? words;
    const path = own ? tail : w.k.split(".");
    try {
      for (const part of path) entry = entry && typeof entry === "object" && has(entry, part) ? (entry as Record<string, unknown>)[part] : undefined;
      if (typeof entry === "string") return entry;
      if (typeof entry === "function") {
        const out = (entry as (...a: SaidArg[]) => unknown)(...(w.a ?? []).map(arg));
        return typeof out === "string" ? out : null;
      }
    } catch {
      // The language has no words for this one: it stays in English.
    }
    return null;
  }
  function say(english: string): string {
    const one = sayOne(english);
    if (one !== null) return one;
    for (const sep of JOINS) {
      const parts = english.split(sep);
      if (parts.length < 2) continue;
      const out: string[] = [];
      let i = 0;
      while (i < parts.length) {
        let j = parts.length;
        while (j > i && !known(parts.slice(i, j).join(sep))) j--;
        if (j === i) break;
        out.push(say(parts.slice(i, j).join(sep)));
        i = j;
      }
      if (i === parts.length) return out.join(sep);
    }
    return english;
  }
  const { said: _record, ...rest } = card;
  const out = mapStrings(rest, say) as PlayerCard;
  // A role proposal's field is headed by the card's own heading, written once at load.
  const fixed = words as unknown as Record<string, unknown>;
  const english = CARD_WORDS as unknown as Record<string, unknown>;
  return {
    ...out,
    roles: out.roles.map((r) => ({
      ...r,
      proposals: r.proposals.map((p) => ({
        ...p,
        fields: p.fields.map((f) => {
          const mine = f.label === english[f.key] ? fixedOf(fixed, f.key) : null;
          return typeof mine === "string" ? { ...f, label: mine } : f;
        }),
      })),
    })),
  };
}

/** One entry of the table, or null when the language has no words for it. */
function fixedOf(words: Record<string, unknown>, key: string): unknown {
  try {
    return words[key];
  } catch {
    return null;
  }
}

/**
 * The fixed lines of the table (and its small groups: the load steps, the trends), for the components that draw
 * their own headings. A line the language lacks is left out, and the component draws its English.
 */
export function fixedCardWords(words: PlayerCardWords): Partial<PlayerCardWords> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(words)) {
    const v = fixedOf(words as unknown as Record<string, unknown>, k);
    if (typeof v === "string" || Array.isArray(v) || (v && typeof v === "object")) out[k] = v;
  }
  return out as Partial<PlayerCardWords>;
}
