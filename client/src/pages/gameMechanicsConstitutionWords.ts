/**
 * THE CONSTITUTION'S LAWS, in the reader's language (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * The laws are copy in shared/constitution.ts, and /api/game/mechanics serves them in English
 * (servedConstitution). They are translated HERE and swapped in by `localizeConstitution`. A law carries no id,
 * so its English title is its key. A law whose words depend on a module (`whenModuleOff`) is served one of two
 * sentences; `offStarts` is the shortest start the off sentence has and the full one does not, so the right
 * translation is drawn without the client knowing the module's state. A title this file does not know is drawn
 * as the server sent it.
 *
 * gameMechanicsConstitutionWords.test.ts derives every law from shared/constitution.ts and fails on one this file
 * lacks or has stale, or one with no Spanish.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export interface LawWords {
  title: MessageDescriptor;
  plain: MessageDescriptor;
  enforcedBy: MessageDescriptor;
  /** The plain words a village with the law's module off is served. */
  whenModuleOff?: MessageDescriptor;
}

/** For a law with module-dependent words: the start that tells the off sentence apart. */
export const LAW_OFF_STARTS: Readonly<Record<string, string>> = {
  "Money flows in, never out": "No token",
};

export const CONSTITUTION_WORDS: Readonly<Record<string, LawWords>> = {
  "Every token is accounted for, always": {
    title: msg({ message: "Every token is accounted for, always", context: "constitution law \"Every token is accounted for, always\", title" }),
    plain: msg({ message: "All value in the village lives on one ledger where every movement has a source and a destination, and the books must balance to zero at every boot. If they ever don't, the village refuses to open until a human looks. Balances are recomputed from the record, never adjusted by hand.", context: "constitution law \"Every token is accounted for, always\", plain" }),
    enforcedBy: msg({ message: "server/lib/ledger.ts: conservation invariant, checked at every boot", context: "constitution law \"Every token is accounted for, always\", enforcedBy" }),
  },
  "Money flows in, never out": {
    title: msg({ message: "Money flows in, never out", context: "constitution law \"Money flows in, never out\", title" }),
    plain: msg({ message: "Real money can buy the village's credit tokens, but no token can ever be sold back for money. There is no cash-out path, and adding one is not a setting: it is what keeps village credits from becoming securities.", context: "constitution law \"Money flows in, never out\", plain" }), // village-ok: the server's own words from shared/constitution.ts, mirrored here to translate them
    enforcedBy: msg({ message: "No such code path exists; exchange is buy-only (server/lib/exchange.ts)", context: "constitution law \"Money flows in, never out\", enforcedBy" }),
    whenModuleOff: msg({ message: "No token can ever be sold back for money. There is no cash-out path, and adding one is not a setting.", context: "constitution law \"Money flows in, never out\", whenModuleOff" }),
  },
  "Recognition cannot be bought": {
    title: msg({ message: "Recognition cannot be bought", context: "constitution law \"Recognition cannot be bought\", title" }),
    plain: msg({ message: "The recognition token exists only as a record of appreciation between people. It is never for sale, never tradeable, and never granted by anything except a human act. Appreciation with a price would just be a price.", context: "constitution law \"Recognition cannot be bought\", plain" }),
    enforcedBy: msg({ message: "server/lib/exchange.ts: recognition is refused from every listing and swap", context: "constitution law \"Recognition cannot be bought\", enforcedBy" }),
  },
  "What the village can conjure can never claim what people paid for": {
    title: msg({ message: "What the village can conjure can never claim what people paid for", context: "constitution law \"What the village can conjure can never claim what people paid for\", title" }),
    plain: msg({ message: "Tokens the village issues freely (rewards, comps) can never be swapped into tokens that people bought with real money. The test is structural: it is about where tokens came from, and no privilege level overrides it.", context: "constitution law \"What the village can conjure can never claim what people paid for\", plain" }),
    enforcedBy: msg({ message: "server/lib/exchange.ts: faucet-issued tokens are permanently unswappable", context: "constitution law \"What the village can conjure can never claim what people paid for\", enforcedBy" }),
  },
  "Your record is yours, and you choose how it becomes formal": {
    title: msg({ message: "Your record is yours, and you choose how it becomes formal", context: "constitution law \"Your record is yours, and you choose how it becomes formal\", title" }),
    plain: msg({ message: "Every village keeps its own record here: what was decided, who decided it, and when. How that record becomes formal is the village's choice: a blockchain, legal documents, or both. Tokens governed on a chain live on that chain, and this platform reads them, displays them, and links you out to them. It never mints, moves, or prices them.", context: "constitution law \"Your record is yours, and you choose how it becomes formal\", plain" }),
    enforcedBy: msg({ message: "server/lib/ledger.ts: chain-governed tokens are refused from the ledger entirely", context: "constitution law \"Your record is yours, and you choose how it becomes formal\", enforcedBy" }),
  },
  "The village decides where its decisions bind": {
    title: msg({ message: "The village decides where its decisions bind", context: "constitution law \"The village decides where its decisions bind\", title" }),
    plain: msg({ message: "A village can hold its votes here, or keep its formal record somewhere else. A vote held here binds here and stays on the record, with the count and the reasoning kept. A village that keeps its record elsewhere gets a game that prepares the decision and carries it there, and never one that claims to have made it.", context: "constitution law \"The village decides where its decisions bind\", plain" }),
    enforcedBy: msg({ message: "server/lib/ballots.ts: a ballot freezes its rule at open and closes by a human act; shared/modules.ts: the governance module ships off, so a village that never turns it on keeps its record where it always was", context: "constitution law \"The village decides where its decisions bind\", enforcedBy" }),
  },
  "A vote is counted against the day it opened": {
    title: msg({ message: "A vote is counted against the day it opened", context: "constitution law \"A vote is counted against the day it opened\", title" }),
    plain: msg({ message: "When a ballot opens, its thresholds, its electorate and every voter's weight freeze inside it. No later change to any setting, allocation or balance rewrites a vote, open or closed. What you were asked, and what your voice weighed, is permanent from the moment the asking began.", context: "constitution law \"A vote is counted against the day it opened\", plain" }),
    enforcedBy: msg({ message: "the ballots snapshot columns (drizzle/0089) + server/lib/ballots.test.ts", context: "constitution law \"A vote is counted against the day it opened\", enforcedBy" }),
  },
  "Voting weight is on the record": {
    title: msg({ message: "Voting weight is on the record", context: "constitution law \"Voting weight is on the record\", title" }),
    plain: msg({ message: "Whatever weight mode the village runs, every member can see how voting weight is assigned, and every change to an assigned weight is a permanent record carrying who changed it and why. Weight is power, and this game holds no hidden power.", context: "constitution law \"Voting weight is on the record\", plain" }),
    enforcedBy: msg({ message: "governance_weight_changes (drizzle/0089), append-only, member-readable", context: "constitution law \"Voting weight is on the record\", enforcedBy" }),
  },
  "One gate decides every permission": {
    title: msg({ message: "One gate decides every permission", context: "constitution law \"One gate decides every permission\", title" }),
    plain: msg({ message: "Whether you can do something is decided by exactly one rule, in one place, in a fixed order: admins can always act; a standing warning overrides roles and stages; then roles, then badges, then your stage on the ladder. No feature may invent its own side-door.", context: "constitution law \"One gate decides every permission\", plain" }),
    enforcedBy: msg({ message: "shared/capabilities.ts: hasCapability(), the one gate", context: "constitution law \"One gate decides every permission\", enforcedBy" }),
  },
  "Value is released by human consent, never by a timer": {
    title: msg({ message: "Value is released by human consent, never by a timer", context: "constitution law \"Value is released by human consent, never by a timer\", title" }),
    plain: msg({ message: "Recognition lands when a person consents to someone's work, and cycles close when a human closes them. No scheduled job ever releases value or closes a cycle on its own.", context: "constitution law \"Value is released by human consent, never by a timer\", plain" }),
    enforcedBy: msg({ message: "server/lib/scheduler.ts: the scheduler's charter, in code and comments", context: "constitution law \"Value is released by human consent, never by a timer\", enforcedBy" }),
  },
  "Nobody witnesses their own work (once the village is grown)": {
    title: msg({ message: "Nobody witnesses their own work (once the village is grown)", context: "constitution law \"Nobody witnesses their own work (once the village is grown)\", title" }),
    plain: msg({ message: "You cannot consent to your own claim: someone else must witness the work. A founder building alone is exempt only before the village starts its Game and while it is smaller than the solo-founder window, and every such use is recorded.", context: "constitution law \"Nobody witnesses their own work (once the village is grown)\", plain" }),
    enforcedBy: msg({ message: "server/index.ts: the consent route's self-consent guard", context: "constitution law \"Nobody witnesses their own work (once the village is grown)\", enforcedBy" }),
  },
  "The record of value is never deleted": {
    title: msg({ message: "The record of value is never deleted", context: "constitution law \"The record of value is never deleted\", title" }),
    plain: msg({ message: "Ledger rows, settlements and measured facts are never erased. Leaving the village anonymizes who you were; it does not rewrite what happened, because the books must stay explicable forever.", context: "constitution law \"The record of value is never deleted\", plain" }),
    enforcedBy: msg({ message: "anonymizeMember and the retract-don't-delete contract (drizzle/0040)", context: "constitution law \"The record of value is never deleted\", enforcedBy" }),
  },
  "Every mechanic is bounded": {
    title: msg({ message: "Every mechanic is bounded", context: "constitution law \"Every mechanic is bounded\", title" }),
    plain: msg({ message: "Every tunable dial has a floor and a ceiling set by the platform. Governance can move a dial anywhere within its bounds; nothing can move the bounds themselves. The bounds are the safety envelope this constitution draws around the game.", context: "constitution law \"Every mechanic is bounded\", plain" }),
    enforcedBy: msg({ message: "shared/gameVariables.ts: min/max on every def, validated before every write", context: "constitution law \"Every mechanic is bounded\", enforcedBy" }),
  },
  "Every change to the rules is on the record": {
    title: msg({ message: "Every change to the rules is on the record", context: "constitution law \"Every change to the rules is on the record\", title" }),
    plain: msg({ message: "Any change to any mechanic, by an admin or by a passed proposal, is written to a permanent amendment ledger: what changed, from what to what, by whom, under which decision. The history is public.", context: "constitution law \"Every change to the rules is on the record\", plain" }),
    enforcedBy: msg({ message: "mechanics_changes table (drizzle/0042) + the variables write path", context: "constitution law \"Every change to the rules is on the record\", enforcedBy" }),
  },
  "Caps fail closed": {
    title: msg({ message: "Caps fail closed", context: "constitution law \"Caps fail closed\", title" }),
    plain: msg({ message: "Where a limit protects members' value (swap caps above all), an unset or zero limit means ZERO, never unlimited. A missing rule is a closed tap, not an open one.", context: "constitution law \"Caps fail closed\", plain" }),
    enforcedBy: msg({ message: "server/lib/exchange.ts: fail-closed swap caps", context: "constitution law \"Caps fail closed\", enforcedBy" }),
  },
  "Trading requires an informed, versioned yes": {
    title: msg({ message: "Trading requires an informed, versioned yes", context: "constitution law \"Trading requires an informed, versioned yes\", title" }),
    plain: msg({ message: "Token trading is off until this village's founder reads and accepts the current legal terms, and it closes again automatically if the terms change. A village run on a shared password cannot enable it at all: money needs accountable humans.", context: "constitution law \"Trading requires an informed, versioned yes\", plain" }),
    enforcedBy: msg({ message: "server/lib/exchange.ts + shared/modules.ts: the version-stamped legal card", context: "constitution law \"Trading requires an informed, versioned yes\", enforcedBy" }),
  },
  "Leaving well is guaranteed": {
    title: msg({ message: "Leaving well is guaranteed", context: "constitution law \"Leaving well is guaranteed\", title" }),
    plain: msg({ message: "Any member can see everything the village holds about them, take a copy, settle what is open, and leave. Their name is scrubbed everywhere while the village's shared record keeps its numbers. Departure is a supported path, not an escape.", context: "constitution law \"Leaving well is guaranteed\", plain" }),
    enforcedBy: msg({ message: "server/lib/exit.ts + /api/profile/export + anonymizeMember", context: "constitution law \"Leaving well is guaranteed\", enforcedBy" }),
  },
};

type ServedLaw = { title: string; plain: string; enforcedBy: string };

/** The constitution as the server sent it, each law in the reader's language where this file knows it. */
export function localizeConstitution<L extends ServedLaw>(laws: readonly L[], i18n: I18n = appI18n): L[] {
  return laws.map((law) => {
    const w = CONSTITUTION_WORDS[law.title];
    if (!w) return law;
    const off = LAW_OFF_STARTS[law.title];
    const plain = w.whenModuleOff && off && law.plain.startsWith(off) ? w.whenModuleOff : w.plain;
    return { ...law, title: i18n._(w.title), plain: i18n._(plain), enforcedBy: i18n._(w.enforcedBy) };
  });
}
