/**
 * THE GAME MECHANICS, folded into How we work together (the lead, 26 Nov 2026:
 * "first the part of how we work together, then ... all in collapsible menus so
 * people can skip over the 'how we work together' once they've read it and go
 * right to the game mechanics part").
 *
 * This file used to be its own page at /game-mechanics. It is now the members'
 * half of /governance/how, under `#game-mechanics`, and the old address
 * redirects there keeping its query and its anchor. A signed-out visitor never
 * mounts it ("Signed out visitor doesn't need to see game mechanics").
 *
 * Everything the game runs on, in four folds, each its own anchor so a link can
 * open one directly:
 *
 *   1. `#mechanics-constitution`: the laws no vote can change, in plain language.
 *   2. `#mechanics-dials`: every mechanic of every running module. Community-ring
 *      dials are EDITABLE in place: adjusting one stages a change, staged
 *      changes become a proposal with a title and a rationale, and the proposal
 *      walks the village's own path (support here, then the binding vote, then
 *      the amendment ledger when it applies). `?dial=` opens this fold.
 *   3. `#mechanics-proposals`: support, sponsor a draft, take one to the binding
 *      vote, and (admins) apply one that carried. `#proposal-<id>` and
 *      `?focus=proposal-<id>` (every notification's link) open this fold.
 *      A proposal here may have BEEN to a vote and come back: a missed quorum
 *      and a called-off ballot both send it to `open` holding its ballot id,
 *      and both settle nothing. The card says which, in the bell's own words,
 *      and links to the vote (`ballotReturn`, gameMechanicsBallotCopy.ts).
 *   4. `#mechanics-history`: the amendment history, read only when opened.
 *
 * Each fold is the disclosure pattern: a heading holding a button with
 * `aria-expanded` and `aria-controls`, so heading navigation still finds all
 * four and a screen reader hears whether each is open.
 *
 * WHERE THE BINDING VOTE HAPPENS IS THIS VILLAGE'S OWN ANSWER. `snapshot.governance`
 * carries the venue, the method and the auto-apply brake, so every sentence
 * here is true under either setting and the door to the village's own vote
 * exists.
 *
 * The page RENDERS the server's answers and computes no rule of its own:
 * eligibility comes from /standing (the same function the routes enforce
 * with), the venue comes from /api/game/mechanics (the same helpers the
 * open-ballot route conducts by), validation problems come back from the
 * server, and the proposal document is fetched, never rebuilt here: what is
 * voted on is what was checked.
 */
import { ballotIdIn, HistoryEntry, historyHeaders, SettingHistory, type Amendment } from "@/components/governance/SettingHistory";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Lock, Copy, X } from "lucide-react";
import { GoldenSpiral, Labyrinth, SeedOfLife, Triad } from "@/components/sacred/glyphs";
import { MushroomNetwork } from "@/components/sacred/living";
import { Link } from "wouter";
import { useCatalyst, authToken } from "@/lib/gameApi";
import { ballotReturn } from "./gameMechanicsBallotCopy";
import { dialLabel, localizeDials } from "./gameMechanicsDialWords";
import { APPLYABLE, WEIGHING_KEYS, founderAdoptable } from "./gameMechanicsAdoption";
import { useAuth } from "@/contexts/AuthContext";
import { focusTargetId, useFocusTarget } from "@/lib/useFocusTarget";
import { dialFromSearch } from "@shared/comms/memberView";
import { localizeConstitution } from "./gameMechanicsConstitutionWords";
import InfoTip, { DialFact } from "@/components/InfoTip";
import LongText from "@/components/LongText";
import PurposeAlignmentField, { usePurposeAlignment } from "@/components/governance/PurposeAlignmentField";
import { AskVillageButton, mayAskVillageOn } from "./gameMechanicsAskVillage";
import { BTN_PRIMARY, BTN_SECONDARY, BTN_NOTICE, CHIP_SOFT, FIELD, HINT, LINK, NOTE, RING, TILE } from "@/components/journey/look";
import { Trans, useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";

interface MechanicsVariable {
  key: string;
  category: string;
  label: string;
  description: string;
  type: string;
  unit: string | null;
  min: number | null;
  max: number | null;
  choices: Array<{ value: string; label: string; hint?: string }> | null;
  default: string;
  value: string;
  parsed: number | boolean | string | null;
  isDefault: boolean;
  ring: "open" | "founder";
  applyTiming: "instant" | "cycle-close";
  /** The server held the value back because it can carry a key (shared/gameVariables.ts). */
  withheld?: boolean;
}

/**
 * How THIS village decides a mechanics proposal, served whole so the page
 * states it and never infers it. `decidesBy` already folds in whether the
 * on-site engine is running at all.
 */
interface MechanicsGovernance {
  decidesBy: "onsite" | "hypha";
  /** The method an on-site ballot conducts. Null when the vote is on Hypha. */
  method: "majority" | "custom" | "consensus" | "consent" | null;
  /** `governance.auto_apply_enabled`: off holds a carried proposal for a hand. */
  autoApply: boolean;
  supportThreshold: number;
}

interface MechanicsSnapshot {
  constitution: Array<{ title: string; plain: string; enforcedBy: string }>;
  variables: MechanicsVariable[];
  modules: Array<{ id: string; name: string; core: boolean }>;
  governance: MechanicsGovernance;
}

/**
 * THE VOTE INSIDE AN AMENDMENT'S REFERENCE (`gm:<proposal>[ <hypha ref>][ bal:<ballot>]`).
 * Null when there is no `bal:` segment; nothing is inferred.
 */
export { ballotIdIn };

interface ProposalChange {
  key: string;
  label: string;
  from: string;
  fromDisplay: string;
  to: string;
  toDisplay: string;
  applyTiming: string;
  currentValue: string | null;
}

/** Every value `mechanics_proposals.status` can hold (0089 widened the enum to
 *  ten and this list carried eight, and 0172 added an eleventh; see STATUS_COPY). */
export type ProposalStatus =
  | "draft"
  | "open"
  | "withdrawn"
  | "to_hypha"
  | "onsite_vote"
  | "passed_claimed"
  | "passed_verified"
  | "passed_onsite"
  | "failed" | "vetoed"
  | "applied";

/** How the last ballot on a proposal ended (`ballots.status`). */
export type BallotStatus = "open" | "passed" | "failed" | "no_quorum" | "no_quorum_rerun" | "withdrawn";

interface Proposal {
  id: string;
  title: string;
  rationale: string;
  status: ProposalStatus;
  /** The vote this proposal last went to, null if it has never been to one. */
  ballotId: string | null;
  /** How that vote ended. Null while it is still open, and null with no vote. */
  lastBallotStatus: BallotStatus | null;
  hyphaRef: string | null;
  hyphaProposalId: string | null;
  hyphaProposalUrl: string | null;
  hubLinkSynced: boolean;
  createdAt: string;
  proposer: string;
  supports: number;
  sponsors: number;
  changes: ProposalChange[];
}

interface Standing {
  qualified: boolean;
  mayDraft: boolean;
  denied: boolean;
  recognitionRequired: number;
  recognitionHeld: number;
  supportThreshold: number;
  backed: Array<{ proposalId: string; kind: string }>;
  /** Holds `proposal.open`, so may take ANY proposal to the village vote. */
  mayOpenBallot: boolean;
  /** Proposals this viewer raised. The other half of who the route admits. */
  mine: string[];
  mayAskVillage?: boolean; // a held outcome after launch (./gameMechanicsAskVillage.tsx)
}

/** The state chips, in the sheet's tokens: gold for what waits on a hand, green for what is living or done. */
const CHIP_QUIET = "border-border text-muted-foreground";
const CHIP_GOLD = "border-notice/70 text-notice";
const CHIP_OPEN = "border-open/70 text-open";

export const STATUS_COPY: Record<ProposalStatus, { label: MessageDescriptor; cls: string }> = {
  draft: { label: msg({ message: "draft, needs a sponsor", context: "a proposal's state chip" }), cls: CHIP_GOLD },
  open: { label: msg({ message: "open for support", context: "a proposal's state chip" }), cls: CHIP_OPEN },
  withdrawn: { label: msg({ message: "withdrawn", context: "a proposal's state chip" }), cls: CHIP_QUIET },
  to_hypha: { label: msg({ message: "at Hypha for the vote", context: "a proposal's state chip" }), cls: CHIP_GOLD },
  onsite_vote: { label: msg({ message: "at the village vote", context: "a proposal's state chip" }), cls: CHIP_GOLD },
  // ", applying" came off the three "passed" chips: whether one IS applying
  // depends on the landing instant, the brake and the cycle timing, so the
  // chip states the fact that never varies and WaitingNote says which holds it.
  passed_claimed: { label: msg({ message: "passed, awaiting verification", context: "a proposal's state chip" }), cls: CHIP_GOLD },
  passed_verified: { label: msg({ message: "verified on-chain", context: "a proposal's state chip" }), cls: CHIP_GOLD },
  passed_onsite: { label: msg({ message: "carried at the village vote", context: "a proposal's state chip" }), cls: CHIP_GOLD },
  failed: { label: msg({ message: "did not pass", context: "a proposal's state chip" }), cls: CHIP_QUIET },
  vetoed: { label: msg({ message: "stopped by a steward, back with the proposer", context: "a proposal's state chip" }), cls: "border-destructive/70 text-destructive" }, // 0172
  applied: { label: msg({ message: "applied", context: "a proposal's state chip" }), cls: CHIP_OPEN },
};

/**
 * The state chip, never undefined. 0089 added `onsite_vote` and `passed_onsite`
 * while this map kept eight keys, and the first proposal to reach the village's
 * own vote took the whole page down. A status nobody has taught this page yet
 * reads as itself instead.
 */
function statusChip(status: ProposalStatus, i18n: I18n = appI18n): { label: string; cls: string } {
  const known = STATUS_COPY[status];
  return known ? { label: i18n._(known.label), cls: known.cls } : { label: String(status).replace(/_/g, " "), cls: CHIP_QUIET };
}

/** A chip in the sheet's soft shape, edged in its tone. */
const chipCls = (tone: string) => `${CHIP_SOFT} border ${tone}`;

/**
 * The chip that says a proposal has been to a vote and come back, beside the
 * chip that says where it stands now. A proposal that has never been to a vote
 * carries nothing here (R55: no badge for a thing that has not happened).
 */
function BallotReturnChip({ proposal }: { proposal: Proposal }) {
  const catalyst = useCatalyst();
  const back = proposal.lastBallotStatus ? ballotReturn(catalyst.aName)[proposal.lastBallotStatus] : null;
  if (!proposal.ballotId || !back?.chip) return null;
  return (
    <span className={chipCls(back.cls || CHIP_QUIET)}>
      {back.chip}
      {back.tip && <InfoTip tip={back.tip} label={`What ${back.chip} means`} />}
    </span>
  );
}

/** What the vote left behind, and the way to the vote itself. */
function BallotReturnNote({ proposal }: { proposal: Proposal }) {
  const catalyst = useCatalyst();
  if (!proposal.ballotId) return null;
  const back = proposal.lastBallotStatus ? ballotReturn(catalyst.aName)[proposal.lastBallotStatus] : null;
  const live = proposal.lastBallotStatus === "open";
  const to = (
    <Link href={`/governance/decisions/${proposal.ballotId}`} className={`${LINK} inline-flex min-h-11 items-center text-sm`}>
      {live ? "See the vote" : "See that vote"}
    </Link>
  );
  // No box around a bare link: an empty band reads as something that failed to load.
  if (!back?.line) return <p className="mb-2">{to}</p>;
  return (
    <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2">
      <p className={HINT}>{back.line}</p>
      {to}
    </div>
  );
}

/**
 * WHY A PROPOSAL THAT CARRIED IS STILL SITTING THERE. Two things hold one: the
 * founders' auto-apply brake, and a change-set touching a cycle-timed dial. The
 * order matches the server's: the brake first. R56: every line is a fact the
 * member cannot otherwise see, and none of it asks anybody to hurry.
 */
function WaitingNote({ proposal, gov }: { proposal: Proposal; gov: MechanicsGovernance | null }) {
  if (proposal.status !== "passed_onsite" && proposal.status !== "passed_verified") return null;
  const carried =
    proposal.status === "passed_onsite"
      ? "The village carried this at its own vote."
      : "This carried on Hypha and the verified result has come home.";
  const why =
    gov && !gov.autoApply
      ? "Applying it is a steward's own act while the founders' auto-apply brake is off."
      : proposal.changes.some((c) => c.applyTiming === "cycle-close")
        ? "One of these dials only moves at a cycle close, so the whole set applies together at the next one."
        : "Nothing has reached the amendment ledger under it yet, and a steward can see why from the apply.";
  return (
    <div className="mb-3 rounded-lg border border-notice/60 bg-notice/10 px-3 py-2">
      <p className="text-sm leading-relaxed text-foreground">
        {carried} {why}
      </p>
    </div>
  );
}

/**
 * Does this dial answer what somebody typed? (R79.) The description is part of
 * the haystack: a founder looking for the feedback switch types "bug report",
 * and only the description says that. Every word has to land somewhere, in any
 * order. Exported so `gameMechanicsStates.test.ts` can hold that line.
 */
export function dialMatches(
  v: { key: string; label: string; description: string; category: string },
  query: string,
): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${v.key} ${v.label} ${v.description} ${v.category}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

function displayValue(v: MechanicsVariable, raw: string): string {
  if (v.type === "boolean") return raw === "true" || raw === "1" ? "On" : "Off";
  if (v.type === "choice") {
    const c = v.choices?.find((c) => c.value === raw);
    return c?.label ?? raw;
  }
  if (raw === "" || raw == null) return "not set";
  return v.unit ? `${raw} ${v.unit}` : raw;
}

const authHeaders = (): Record<string, string> => {
  const t = authToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/**
 * An objection a new proposal may say it answers, as the server offers it. No
 * person in this shape, and there never may be one
 * (`server/lib/objectionLineageShape.test.ts`).
 */
interface AnswerableObjection {
  id: string;
  text: string;
  status: string;
  ballotId: string;
  ballotTitle: string;
  closedAt: string | null;
}

/** Enough of an objection to recognise it in a list, and no more. */
function objectionSummary(o: AnswerableObjection): string {
  const words = o.text.trim().replace(/\s+/g, " ");
  const shown = words.length > 90 ? `${words.slice(0, 89)}…` : words;
  return `${shown} (on "${o.ballotTitle}")`;
}

/** The per-dial editor: the input a member adjusts to stage a change. */
function DialEditor({
  v,
  staged,
  onStage,
}: {
  v: MechanicsVariable;
  staged: string | undefined;
  onStage: (key: string, value: string | undefined) => void;
}) {
  const current = staged ?? v.value;
  const cls = `${FIELD} min-h-11 max-w-[240px] text-sm`;
  const change = (value: string) => onStage(v.key, value === v.value ? undefined : value);
  if (v.type === "boolean") {
    return (
      <select aria-label={`Proposed value for ${v.label}`} value={current === "true" || current === "1" ? "true" : "false"} onChange={(e) => change(e.target.value)} className={cls}>
        <option value="true">On</option>
        <option value="false">Off</option>
      </select>
    );
  }
  if (v.type === "choice") {
    return (
      <select aria-label={`Proposed value for ${v.label}`} value={current} onChange={(e) => change(e.target.value)} className={cls}>
        {(v.choices ?? []).map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    );
  }
  if (v.type === "longtext") {
    // A paragraph, staged like every other dial, wide enough to read whole.
    return <textarea aria-label={`Proposed value for ${v.label}`} value={current} rows={6} onChange={(e) => change(e.target.value)} className={`${FIELD} text-sm`} />;
  }
  if (v.type === "text") {
    return <input aria-label={`Proposed value for ${v.label}`} value={current} onChange={(e) => change(e.target.value)} className={cls} />;
  }
  return (
    <input
      type="number"
      aria-label={`Proposed value for ${v.label}`}
      min={v.min ?? undefined}
      max={v.max ?? undefined}
      step={v.type === "integer" ? 1 : "any"}
      value={current}
      onChange={(e) => change(e.target.value)}
      className={cls}
    />
  );
}

/** The four folds, each its own anchor. Exported so the page's contents and its tests name the same ids. */
export const MECHANICS_FOLDS = ["mechanics-constitution", "mechanics-dials", "mechanics-proposals", "mechanics-history"] as const;
export type MechanicsFold = (typeof MECHANICS_FOLDS)[number];

/**
 * Which fold a URL asks for: its own anchor, a proposal's anchor or focus (a
 * notification's link), or a dial named in the query (the village email page's
 * door). Null when the URL names none, and then every fold starts shut.
 */
export function foldFromUrl(hash: string, search: string): MechanicsFold | null {
  const id = hash.replace(/^#/, "");
  if ((MECHANICS_FOLDS as readonly string[]).includes(id)) return id as MechanicsFold;
  if (id.startsWith("proposal-") || focusTargetId(search)?.startsWith("proposal-")) return "mechanics-proposals";
  if (dialFromSearch(search)) return "mechanics-dials";
  return null;
}

/**
 * ONE FOLD: the disclosure pattern. The heading holds the button, so heading
 * navigation lists all four; `aria-expanded` says open or shut; the panel stays
 * in the page while shut (`hidden`), so a staged dial or a typed search is kept.
 */
function Fold({
  id,
  icon,
  title,
  line,
  open,
  onToggle,
  children,
}: {
  id: MechanicsFold;
  icon: ReactNode;
  title: ReactNode;
  line: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24 rounded-2xl border border-border bg-card shadow-sm">
      <h3 id={headingId} className="m-0">
        <button
          type="button"
          data-mechanics-toggle
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="jw-btn group flex min-h-11 w-full items-center gap-4 rounded-2xl p-4 text-left hover:bg-muted/60 sm:p-6"
        >
          <span className={RING} aria-hidden="true">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl leading-tight text-card-foreground sm:text-2xl">{title}</span>
            <span className="mt-0.5 block font-body text-sm text-muted-foreground">{line}</span>
          </span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-notice transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="border-t border-border p-4 sm:p-6">
        {children}
      </div>
    </section>
  );
}

export default function GameMechanics() {
  const { t, i18n } = useLingui();
  // A LABEL. Who may withdraw is unchanged: the route still checks
  // proposal.decide and isAdmin, and this only says the village's word for it.
  const catalyst = useCatalyst();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<MechanicsSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState<Amendment[] | null>(null);
  const [openFolds, setOpenFolds] = useState<Record<MechanicsFold, boolean>>(() => {
    const asked = typeof window === "undefined" ? null : foldFromUrl(window.location.hash, window.location.search);
    return { "mechanics-constitution": false, "mechanics-dials": false, "mechanics-proposals": false, "mechanics-history": false, ...(asked ? { [asked]: true } : {}) };
  });
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  // A link may name one dial (`?dial=`, the village email page's door): the search finds it.
  const [dialQuery, setDialQuery] = useState(() => dialFromSearch(window.location.search));
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [staged, setStaged] = useState<Record<string, string>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [problems, setProblems] = useState<Array<{ key: string; problem: string }>>([]);
  /*
   * The objections a proposal opened today may say it answers, and the one the
   * proposer picked for each proposal. The list is exactly what
   * `objectionLineageProblem` will accept, so nobody is offered a choice that
   * comes back refused.
   */
  const [answerable, setAnswerable] = useState<AnswerableObjection[]>([]);
  const [answersFor, setAnswersFor] = useState<Record<string, string>>({});
  const alignment = usePurposeAlignment(); // 0219: the judgement line, per proposal

  // A notification about a proposal lands ON the proposal; the target arrives with the fetch.
  useFocusTarget([proposals.length]);

  const loadHistory = useCallback(() => {
    fetch("/api/game/mechanics/history", { headers: historyHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]));
  }, []);

  const toggleFold = (fold: MechanicsFold) => {
    const next = !openFolds[fold];
    setOpenFolds((s) => ({ ...s, [fold]: next }));
    if (fold === "mechanics-history" && next && history === null) loadHistory();
  };

  /*
   * EACH FOLD OPENS FROM ITS OWN ANCHOR. A jump link on this page changes the
   * hash, and the fold it names opens and comes into view. On arrival the
   * section is drawn only once the snapshot lands, so the browser's own jump
   * found nothing; it is made here once there is something to land on.
   */
  useEffect(() => {
    const onHash = () => {
      const fold = foldFromUrl(window.location.hash, "");
      if (!fold) return;
      setOpenFolds((s) => ({ ...s, [fold]: true }));
      if (fold === "mechanics-history" && history === null) loadHistory();
      window.requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" }));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [history, loadHistory]);

  useEffect(() => {
    if (!snapshot) return;
    const id = window.location.hash.slice(1);
    if (id === "mechanics-history" && history === null) loadHistory();
    // A notification's focus lands on its own card (useFocusTarget), so nothing here pulls the page away from it.
    if (focusTargetId(window.location.search)) return;
    // A fold the address names by anchor, or by query (`?dial=` from the old address), is where the reader lands.
    const fold = foldFromUrl(window.location.hash, window.location.search);
    const target = (MECHANICS_FOLDS as readonly string[]).includes(id) ? id : fold ?? (id === "game-mechanics" ? id : null);
    if (target) window.requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
    // Once, when the snapshot lands: the reader's later scrolling is theirs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const loadProposals = useCallback(() => {
    fetch("/api/game/mechanics/proposals")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setProposals(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const loadStanding = useCallback(() => {
    if (!authToken()) return;
    fetch("/api/game/mechanics/standing", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStanding)
      .catch(() => {});
  }, []);

  /*
   * A failed read leaves the list empty and the picker does not appear, which
   * is honest: naming an objection is optional, so every proposal still opens.
   */
  const loadAnswerable = useCallback(() => {
    if (!authToken()) return;
    fetch("/api/governance/objections/answerable", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAnswerable(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/game/mechanics")
      .then((r) => {
        if (!r.ok) throw new Error(`mechanics ${r.status}`);
        return r.json();
      })
      .then(setSnapshot)
      .catch(() => setFailed(true));
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    loadStanding();
    loadAnswerable();
  }, [user, loadStanding, loadAnswerable]);

  const stage = (key: string, value: string | undefined) => {
    setStaged((s) => {
      const next = { ...s };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const stagedCount = Object.keys(staged).length;

  const submitProposal = async () => {
    setSubmitting(true);
    setFeedback(null);
    setProblems([]);
    try {
      const res = await fetch("/api/game/mechanics/proposals", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title,
          rationale,
          changes: Object.entries(staged).map(([key, to]) => ({ key, to })),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setProblems(Array.isArray(d.problems) ? d.problems : []);
        setFeedback({ ok: false, text: d.message ?? d.error ?? "Something went wrong" });
      } else {
        setFeedback({ ok: true, text: d.message ?? "Proposed." });
        setStaged({});
        setTitle("");
        setRationale("");
        setComposerOpen(false);
        setOpenFolds((s) => ({ ...s, "mechanics-proposals": true }));
        loadProposals();
      }
    } catch {
      setFeedback({ ok: false, text: "Something went wrong. Try again." });
    }
    setSubmitting(false);
  };

  const act = async (path: string, body?: unknown) => {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: authHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ ok: false, text: d?.message ?? d?.error ?? "That did not work" });
        return null;
      }
      loadProposals();
      loadStanding();
      return d;
    } catch {
      setFeedback({ ok: false, text: "That did not work. Try again." });
      return null;
    }
  };

  const copyDocument = async (id: string) => {
    try {
      const res = await fetch(`/api/game/mechanics/proposals/${id}/document`);
      const d = await res.json();
      await navigator.clipboard.writeText(d.markdown);
      setFeedback({ ok: true, text: "Proposal document copied. Paste it into the Hypha proposal, and keep the [gm:…] marker in the title." });
    } catch {
      setFeedback({ ok: false, text: "Couldn't copy. Open the document and copy it by hand." });
    }
  };

  /** Copy ALWAYS, then open Hypha when the village has one configured; the
   *  [gm:] marker in the title is the thread home. */
  const continueToHypha = async (id: string) => {
    try {
      const res = await fetch(`/api/game/mechanics/proposals/${id}/handoff`);
      const d = await res.json();
      await navigator.clipboard.writeText(d.markdown).catch(() => {});
      if (d.configured && d.url) {
        window.open(d.url, "_blank", "noopener,noreferrer");
        setFeedback({
          ok: true,
          text: `Hypha opened and the document is on your clipboard. Keep ${d.title.slice(0, 24)}… in the title, and when the proposal exists, paste its URL back here with "Link the on-chain proposal". The chain reports outcomes by number, and that link is how the result finds its way home.`,
        });
      } else {
        setFeedback({
          ok: true,
          text: "Document copied. This village has no Hypha configured yet. A founder sets it under Admin → Game Mechanics → Hypha.",
        });
      }
    } catch {
      setFeedback({ ok: false, text: "Couldn't prepare the handoff. Try again." });
    }
  };

  /**
   * Take a proposal to the village's own vote. The confirm states the two
   * consequences a member cannot undo: the whole roll is asked, and the
   * weights freeze as they stand today (the snapshot law).
   */
  const openBallot = async (p: Proposal) => {
    if (
      !window.confirm(
        `Open the village vote on "${p.title}"? Everyone on the roll is asked, and the voting weights freeze as they stand today.`,
      )
    )
      return;
    /*
     * THE OBJECTION THIS VERSION ANSWERS, IF THE PROPOSER NAMES ONE (0102).
     * Optional, and left OFF the body entirely when nothing is chosen, so a vote
     * opened without it is byte-identical to every vote opened before.
     */
    const answers = answersFor[p.id];
    const body = { ...(answers ? { answersObjectionId: answers } : {}), ...alignment.bodyFor(p.id) };
    const d = await act(`/api/governance/mechanics/${p.id}/open-ballot`, Object.keys(body).length ? body : undefined);
    // Ask the record again either way: a refusal over an objection another
    // proposal claimed first must not leave the picker offering it.
    loadAnswerable();
    if (d) {
      setAnswersFor((s) => {
        const next = { ...s };
        delete next[p.id];
        return next;
      });
      setFeedback({
        ok: true,
        text: answers
          ? "The village vote is open, everyone on the roll has been asked, and the objection you named now points at it."
          : "The village vote is open, and everyone on the roll has been asked.",
      });
    }
  };

  // The dials arrive in English; the platform's own words are drawn in the reader's language (gameMechanicsDialWords.ts).
  const allDials = useMemo(() => localizeDials(snapshot?.variables ?? [], i18n), [snapshot, i18n, i18n.locale]);
  /**
   * An amendment's before and after, in the words its dial uses ("On" and
   * "Off", never `1 -> 0`). A key the snapshot does not carry falls back to the
   * stored string, the literal truth of what was recorded.
   */
  const amendmentValue = (key: string, raw: string | null): string => {
    if (raw == null) return "default";
    const def = allDials.find((v) => v.key === key);
    return def ? displayValue(def, raw) : raw;
  };

  const dialSearch = dialQuery.trim();
  const matchedDials = allDials.filter((v) => dialMatches(v, dialSearch));
  const categories = Array.from(new Set(matchedDials.map((v) => v.category)));
  const allCategoryCount = new Set(allDials.map((v) => v.category)).size;
  const tunedCount = allDials.filter((v) => !v.isDefault).length;
  const backedIds = new Set((standing?.backed ?? []).filter((b) => b.kind === "support").map((b) => b.proposalId));
  const isAdminViewer = user?.role === "admin" || user?.role === "founder";
  const gov = snapshot?.governance ?? null;
  const onSite = gov?.decidesBy === "onsite";
  // The public answer, with the signed-in one as the fallback before the snapshot lands.
  const supportThreshold = gov?.supportThreshold ?? standing?.supportThreshold ?? 0;
  /**
   * Whether THIS viewer may take THIS proposal to the vote, answered from the
   * standing payload the routes enforce with: the proposer or a `proposal.open`
   * holder, at or past the support threshold.
   */
  const mayOpenBallotOn = (p: Proposal) =>
    onSite &&
    p.status === "open" &&
    !!standing &&
    !standing.denied &&
    (standing.mayOpenBallot || standing.mine.includes(p.id)) &&
    p.supports >= supportThreshold;
  const activeProposals = proposals.filter(
    (p) => p.status !== "withdrawn" && p.status !== "applied" && p.status !== "failed",
  );
  const settledProposals = proposals.filter(
    (p) => p.status === "withdrawn" || p.status === "applied" || p.status === "failed",
  );
  const lawCount = snapshot?.constitution.length ?? 0;

  return (
    <div className="space-y-4" data-testid="game-mechanics">
      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`rounded-lg border px-4 py-2.5 text-sm ${feedback.ok ? "border-open/60 bg-open/10 text-foreground" : "border-destructive bg-destructive/10 text-destructive"}`}
        >
          {feedback.text}
        </p>
      )}
      {failed && (
        <p role="alert" className={NOTE}>
          <Trans context="GameMechanics, p">The mechanics couldn't be loaded just now. Reload to try again.
        </Trans></p>
      )}
      {!snapshot && !failed && <p className={HINT}><Trans context="GameMechanics, p">Loading the rules of the Game…</Trans></p>}

      {snapshot && (
        <>
          {/* 1. The constitution */}
          <Fold
            id="mechanics-constitution"
            icon={<SeedOfLife className="size-6" />}
            title={<Trans context="GameMechanics, h2">The Constitution</Trans>}
            line={<Trans context="GameMechanics, fold summary">{lawCount} laws that no vote can change</Trans>}
            open={openFolds["mechanics-constitution"]}
            onToggle={() => toggleFold("mechanics-constitution")}
          >
            <p className={`${NOTE} mb-4 max-w-2xl`}>
              <Trans context="GameMechanics, p">These are enforced by the platform itself and cannot be changed by any vote,
              admin, or founder. Everything below them is tunable <em>because</em> these are not.
            </Trans></p>
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
              {/* The laws arrive in English; the platform's own words are drawn in the reader's language. */}
              {localizeConstitution(snapshot.constitution, i18n).map((law) => (
                <li key={law.title} className={TILE}>
                  <h4 className="mb-1.5 font-semibold text-foreground">{law.title}</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{law.plain}</p>
                  <p className="mt-2 break-words text-xs text-muted-foreground">{law.enforcedBy}</p>
                </li>
              ))}
            </ul>
          </Fold>

          {/* 2. The dials, editable */}
          <Fold
            id="mechanics-dials"
            icon={<GoldenSpiral className="size-6" />}
            title={<Trans context="GameMechanics, h2">The Dials</Trans>}
            line={
              tunedCount > 0
                ? <Trans context="GameMechanics, fold summary">{allDials.length} dials in {allCategoryCount} groups, {tunedCount} tuned by the village</Trans>
                : <Trans context="GameMechanics, fold summary">{allDials.length} dials in {allCategoryCount} groups</Trans>
            }
            open={openFolds["mechanics-dials"]}
            onToggle={() => toggleFold("mechanics-dials")}
          >
            <ul className={`${NOTE} mb-3 max-w-2xl list-none space-y-2 p-0`}>
              <li className="flex items-start gap-2">
                <span className={`${chipCls(CHIP_OPEN)} mt-0.5 shrink-0`}>
                  <MushroomNetwork className="size-3" aria-hidden="true" /> <Trans context="GameMechanics, chip">community</Trans>
                </span>
                <span><Trans context="GameMechanics, p">Change one by proposal. Adjust it below to begin.</Trans></span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`${chipCls(CHIP_QUIET)} mt-0.5 shrink-0`}>
                  <Lock className="size-3" aria-hidden="true" /> <Trans context="GameMechanics, chip">founder-held</Trans>
                </span>
                <span><Trans context="GameMechanics, p">These stay with the founders.</Trans></span>
              </li>
              <li><Trans context="GameMechanics, p">Every dial only moves inside the bounds shown.</Trans></li>
            </ul>
            {standing?.denied && (
              <p role="alert" className="mb-4 rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <Trans context="GameMechanics, p">A standing warning currently suspends your proposal rights. Talk to a steward.
              </Trans></p>
            )}
            {standing && !standing.denied && !standing.qualified && (
              <p className={`${HINT} mb-4`}>
                <Trans context="GameMechanics, p">You can draft proposals; a qualified member's sponsorship opens them.
                {standing.recognitionRequired > 0 &&
                  ` Full standing takes ${standing.recognitionRequired} earned recognition (you have ${standing.recognitionHeld}).`}</Trans>
              </p>
            )}
            {/*
              * FINDING A DIAL YOU CANNOT NAME (R79). The groups start shut: open,
              * two dozen headings become scenery. Typing is the reader's intent,
              * so a group holding a match opens itself, and its header still wins.
              */}
            <div className="mb-4 max-w-md">
              <label htmlFor="dial-search" className="sr-only">
                <Trans context="GameMechanics, label">Search the dials
              </Trans></label>
              <input
                id="dial-search"
                type="search"
                value={dialQuery}
                onChange={(e) => setDialQuery(e.target.value)}
                placeholder={t({ message: "Search dials by name, key, or what they do", context: "GameMechanics, placeholder" })}
                className={`${FIELD} min-h-11`}
              />
              {allDials.some((v) => v.key.startsWith("comms.")) && (
                <Link href="/village-email" className={`${LINK} mt-1 inline-flex min-h-11 items-center text-sm`}><Trans context="GameMechanics, Link">See every email the village sends, and when</Trans></Link>
              )}
              <p aria-live="polite" className={HINT}>
                {dialSearch
                  ? `${matchedDials.length} of ${allDials.length} dials match.`
                  : `${allDials.length} dials in ${allCategoryCount} categories.`}
              </p>
            </div>
            {dialSearch && categories.length === 0 && (
              <p className={HINT}>
                <Trans context="GameMechanics, p">No dial matches that. The search reads each dial's name, its key, its
                category, and the description under it.
              </Trans></p>
            )}
            <div className="space-y-2">
              {categories.map((cat) => {
                const vars = matchedDials.filter((v) => v.category === cat);
                // A search opens what it found; an explicit toggle still wins.
                const open = dialSearch ? (openCategories[cat] ?? true) : !!openCategories[cat];
                const tuned = vars.filter((v) => !v.isDefault).length;
                const stagedHere = vars.filter((v) => staged[v.key] !== undefined).length;
                return (
                  <div key={cat} className="overflow-hidden rounded-xl border border-border bg-muted">
                    <button
                      type="button"
                      onClick={() => setOpenCategories((s) => ({ ...s, [cat]: !open }))}
                      aria-expanded={open}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="min-w-0 font-semibold text-foreground">
                        {cat}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          <Trans context="GameMechanics, span">{vars.length} {dialSearch ? "matching " : ""}dial{vars.length === 1 ? "" : "s"}
                          {tuned > 0 ? ` · ${tuned} village-tuned` : ""}
                          {stagedHere > 0 ? ` · ${stagedHere} staged` : ""}</Trans>
                        </span>
                      </span>
                      <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <ul className="divide-y divide-border border-t border-border bg-card">
                        {vars.map((v) => {
                          const stagedValue = staged[v.key];
                          const editable = !!user && !WEIGHING_KEYS.has(v.key) && !standing?.denied;
                          return (
                            <li key={v.key} className={`px-4 py-3 ${stagedValue !== undefined ? "border-l-2 border-notice bg-notice/10" : ""}`}>
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <span className="font-medium text-foreground">{v.label}</span>
                                <span className="font-semibold text-notice">
                                  {/* A paragraph keeps its line breaks and links its addresses, never markup. */}
                                  {v.withheld ? "set, kept private" : v.type === "longtext" ? <LongText text={v.value} /> : displayValue(v, v.value)}
                                  {stagedValue !== undefined && (
                                    <span className="ml-2 text-foreground">→ {displayValue(v, stagedValue)}</span>
                                  )}
                                  {!v.isDefault && stagedValue === undefined && (
                                    <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                                      <Trans context="GameMechanics, span">village-tuned · default {displayValue(v, v.default)}</Trans>
                                    </span>
                                  )}
                                </span>
                              </div>
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v.description}<DialFact v={v} staged={stagedValue} /></p>
                              {editable && (
                                <div className="mt-2 flex items-center gap-2">
                                  <DialEditor v={v} staged={stagedValue} onStage={stage} />
                                  {stagedValue !== undefined && (
                                    <button
                                      type="button"
                                      onClick={() => stage(v.key, undefined)}
                                      aria-label={`Unstage change to ${v.label}`}
                                      className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      <X className="size-4" />
                                    </button>
                                  )}
                                </div>
                              )}
                              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {v.ring === "open" ? (
                                  <span className="inline-flex items-center gap-1 text-open">
                                    <Trans context="GameMechanics, span"><MushroomNetwork className="w-3 h-3" /> community dial
                                  </Trans></span>
                                ) : (
                                  <span className="inline-flex items-center gap-1">
                                    <Trans context="GameMechanics, span"><Lock className="w-3 h-3" /> founder-held
                                  </Trans></span>
                                )}
                                {v.min != null && v.max != null && (
                                  <span>
                                    <Trans context="GameMechanics, span">bounds {v.min}-{v.max}</Trans>
                                  </span>
                                )}
                                {v.applyTiming === "cycle-close" && <span><Trans context="GameMechanics, span">changes take effect at the next cycle close</Trans></span>}
                                <span className="break-all">{v.key}</span>
                              </p>
                              <SettingHistory settingKey={v.key} label={v.label} valueOf={amendmentValue} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Fold>

          {/* 3. Proposals */}
          <Fold
            id="mechanics-proposals"
            icon={<Triad className="size-6" />}
            title={<Trans context="GameMechanics, h2">Proposals</Trans>}
            line={
              activeProposals.length > 0
                ? <Trans context="GameMechanics, fold summary">{activeProposals.length} in play, {settledProposals.length} settled</Trans>
                : <Trans context="GameMechanics, fold summary">Nothing in play, {settledProposals.length} settled</Trans>
            }
            open={openFolds["mechanics-proposals"]}
            onToggle={() => toggleFold("mechanics-proposals")}
          >
            {/* The venue, from the server. The threshold reads off the PUBLIC
                payload, so the sentence saying what sends a proposal to the
                vote is there for everyone who reads this fold. */}
            <ol className={`${NOTE} mb-5 max-w-2xl list-decimal space-y-1 pl-5`}>
              <li>
                {supportThreshold > 0
                  ? <Trans context="GameMechanics, proposal path">Support gathers here. {supportThreshold} supporters send a proposal to the vote.</Trans>
                  : <Trans context="GameMechanics, proposal path">Support gathers here.</Trans>}
              </li>
              <li>
                {onSite
                  ? <Trans context="GameMechanics, proposal path">The binding vote runs here, on this village's own ballot.</Trans>
                  : <Trans context="GameMechanics, proposal path">The binding vote runs on the village's Hypha.</Trans>}
              </li>
              <li><Trans context="GameMechanics, proposal path">A proposal that carries is applied and recorded on the amendment ledger.</Trans></li>
            </ol>
            {activeProposals.length === 0 && (
              <p className={HINT}>
                <Trans context="GameMechanics, p">Nothing is being proposed right now.</Trans>{" "}
                <a href="#mechanics-dials" className={LINK}><Trans context="GameMechanics, Link">Adjust a community dial to start one.</Trans></a>
              </p>
            )}
            <div className="space-y-3">
              {activeProposals.map((p) => {
                // Proposer-only actions render for every signed-in member;
                // the server answers an honest 403 for anyone else.
                const status = statusChip(p.status, i18n);
                return (
                  <article
                    key={p.id}
                    // The anchor a notification lands on, clear of the sticky header (SC 2.4.11).
                    id={`proposal-${p.id}`}
                    className={`${TILE} scroll-mt-24 focus:outline-none`}
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-foreground">{p.title}</h4>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={chipCls(status.cls)}>{status.label}</span>
                        <BallotReturnChip proposal={p} />
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      <Trans context="GameMechanics, p">by {p.proposer} · {new Date(p.createdAt).toLocaleDateString()} · {p.supports} supporter
                      {p.supports === 1 ? "" : "s"}
                      {p.sponsors > 0 ? ` · sponsored` : ""}</Trans>
                    </p>
                    <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{p.rationale}</p>
                    <BallotReturnNote proposal={p} />
                    <WaitingNote proposal={p} gov={gov} />
                    <ul className="mb-3 space-y-1 text-sm">
                      {p.changes.map((c) => (
                        <li key={c.key}>
                          <span className="text-foreground">{dialLabel(c.key, c.label, i18n)}:</span>{" "}
                          <del className="text-muted-foreground">{c.fromDisplay}</del> →{" "}
                          <ins className="font-semibold text-notice no-underline">{c.toDisplay}</ins>
                          {c.applyTiming === "cycle-close" && (
                            <span className="text-xs text-muted-foreground"> <Trans context="GameMechanics, span">(at next cycle close)</Trans></span>
                          )}
                          {c.currentValue !== null && c.currentValue !== c.from && (
                            <span className="text-xs text-notice"> <Trans context="GameMechanics, span">· baseline has since moved to {c.currentValue}</Trans></span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-2">
                      {user && p.status === "open" && !backedIds.has(p.id) && (
                        <button type="button" onClick={() => act(`/api/game/mechanics/proposals/${p.id}/support`)} className={BTN_PRIMARY}>
                          <Trans context="GameMechanics, button">Support
                        </Trans></button>
                      )}
                      {user && p.status === "open" && backedIds.has(p.id) && (
                        <span className={chipCls(CHIP_OPEN)}><Trans context="GameMechanics, span">You support this</Trans></span>
                      )}
                      {user && p.status === "draft" && standing?.qualified && (
                        <button type="button" onClick={() => act(`/api/game/mechanics/proposals/${p.id}/sponsor`)} className={BTN_PRIMARY}>
                          <Trans context="GameMechanics, button">Sponsor this draft
                        </Trans></button>
                      )}
                      {/* THE DOOR TO THE VILLAGE'S OWN VOTE (R54: never admin-only). */}
                      {mayOpenBallotOn(p) && (
                        <button type="button" onClick={() => openBallot(p)} className={BTN_PRIMARY}>
                          <Trans context="GameMechanics, button">Open the village vote
                        </Trans></button>
                      )}
                      {mayAskVillageOn(p, standing) && <AskVillageButton onAsk={() => openBallot(p)} />}
                      {/* 0219: the field asks itself whether to render, from the condition the route refuses on. */}
                      {mayOpenBallotOn(p) && <PurposeAlignmentField {...alignment.propsFor(p.id)} />}
                      {/* THE PROPOSER NAMES WHAT THIS ANSWERS (0102). Shown only when
                          the record holds something to name; optional, empty first. */}
                      {mayOpenBallotOn(p) && answerable.length > 0 && (
                        <label className="flex basis-full flex-col gap-1 text-xs text-muted-foreground">
                          <span><Trans context="GameMechanics, span">Does this answer an objection? Naming one is optional.</Trans></span>
                          <select
                            value={answersFor[p.id] ?? ""}
                            onChange={(e) =>
                              setAnswersFor((s) => {
                                const next = { ...s };
                                if (e.target.value) next[p.id] = e.target.value;
                                else delete next[p.id];
                                return next;
                              })
                            }
                            className={`${FIELD} min-h-11 max-w-full text-sm`}
                          >
                            <option value="">Nothing to name</option>
                            {answerable.map((o) => (
                              <option key={o.id} value={o.id}>
                                {objectionSummary(o)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {/* The Hypha route-out, offered while this village votes on
                          Hypha and for a proposal ALREADY there whatever the village
                          decided since. The proposal document is a Hypha paste, so its
                          copy door goes with it. */}
                      {(p.status === "to_hypha" || (p.status === "open" && !onSite)) && (
                        <>
                          <button type="button" onClick={() => copyDocument(p.id)} className={BTN_SECONDARY}>
                            <Copy className="size-3.5" aria-hidden="true" /> <Trans context="GameMechanics, button">Copy for Hypha</Trans>
                          </button>
                          <button type="button" onClick={() => continueToHypha(p.id)} className={BTN_SECONDARY}>
                            <Trans context="GameMechanics, button">Continue to Hypha ↗
                          </Trans></button>
                        </>
                      )}
                      {user && p.status === "open" && !onSite && (
                        <button
                          type="button"
                          onClick={() => act(`/api/game/mechanics/proposals/${p.id}/to-hypha`)}
                          className={BTN_SECONDARY}
                          title={t({ message: "Proposer only: marks this as taken to Hypha for the binding vote", context: "GameMechanics, title" })}
                        >
                          <Trans context="GameMechanics, button">I've taken it to Hypha
                        </Trans></button>
                      )}
                      {user && (p.status === "to_hypha" || p.status === "passed_claimed") && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = window.prompt(
                              p.hyphaProposalId
                                ? `Linked to on-chain proposal #${p.hyphaProposalId}. Paste a corrected Hypha proposal URL to re-link:`
                                : "Paste the Hypha proposal's URL (from your browser after creating it) so the on-chain vote can find this proposal:",
                              p.hyphaProposalUrl ?? "",
                            );
                            if (url) act(`/api/game/mechanics/proposals/${p.id}/link-hypha`, { url });
                          }}
                          className={p.hyphaProposalId ? BTN_SECONDARY : BTN_NOTICE}
                          title={t({ message: "The chain reports outcomes by proposal number, not by title. This link is how the verified result finds its way home", context: "GameMechanics, title" })}
                        >
                          {p.hyphaProposalId
                            ? `On-chain #${p.hyphaProposalId} linked${p.hubLinkSynced ? " ✓" : " (hub sync pending, click to retry)"}`
                            : "Link the on-chain proposal"}
                        </button>
                      )}
                      {user && p.status === "to_hypha" && (
                        <button
                          type="button"
                          onClick={() => {
                            const ref = window.prompt(
                              "It passed? Paste the Hypha proposal link (or id) so a steward can verify and apply:",
                            );
                            if (ref) act(`/api/game/mechanics/proposals/${p.id}/passed`, { ref });
                          }}
                          className={BTN_SECONDARY}
                        >
                          <Trans context="GameMechanics, button">It passed on Hypha
                        </Trans></button>
                      )}
                      {/* APPLYABLE, never a list retyped here. The confirm asks the
                          right question for the vote that actually happened. */}
                      {isAdminViewer && APPLYABLE.has(p.status) && (
                        <button
                          type="button"
                          onClick={() => {
                            const onsiteVote = p.status === "passed_onsite";
                            if (
                              window.confirm(
                                onsiteVote
                                  ? `Apply "${p.title}" now? The village carried this at its own vote and it is waiting on a hand. Every change lands on the public ledger under this proposal's reference.`
                                  : `Apply "${p.title}" now? Verify it actually passed on Hypha first${p.hyphaRef ? ` (${p.hyphaRef})` : ""}. Every change lands on the public ledger under this proposal's reference.`,
                              )
                            )
                              act(`/api/admin/mechanics/proposals/${p.id}/apply`);
                          }}
                          className={BTN_NOTICE}
                        >
                          {p.status === "passed_onsite" ? "Apply this" : "Verify & apply"}
                        </button>
                      )}
                      {isAdminViewer && founderAdoptable(p, (key) => allDials.find((v) => v.key === key)?.ring) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Adopt "${p.title}"? These dials are founder-held, so before the Game starts a founder adopts them. Every change lands on the public ledger under this proposal's reference.`))
                              act(`/api/admin/mechanics/proposals/${p.id}/apply`);
                          }}
                          className={BTN_NOTICE}
                        >
                          <Trans context="GameMechanics, button">Adopt this
                        </Trans></button>
                      )}
                      {user && (p.status === "open" || p.status === "draft") && (
                        <button
                          type="button"
                          onClick={() => act(`/api/game/mechanics/proposals/${p.id}/withdraw`)}
                          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title={`Proposer or ${catalyst.name} only`}
                        >
                          <Trans context="GameMechanics, button">Withdraw
                        </Trans></button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {settledProposals.length > 0 && (
              <details className="mt-4">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground hover:text-foreground">
                  <Trans context="GameMechanics, summary">{settledProposals.length} settled proposal{settledProposals.length === 1 ? "" : "s"} (applied,
                  withdrawn, or did not pass)
                </Trans></summary>
                <ul className="mt-2 space-y-1.5">
                  {settledProposals.map((p) => (
                    <li key={p.id} className="text-sm text-muted-foreground">
                      <span className={`${chipCls(statusChip(p.status).cls)} mr-2`}>
                        {statusChip(p.status, i18n).label}
                      </span>
                      {p.title} · by {p.proposer}
                      {p.ballotId && (
                        <>
                          {" · "}
                          <Link href={`/governance/decisions/${p.ballotId}`} className={LINK}>
                            <Trans context="GameMechanics, Link">see its vote
                          </Trans></Link>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Fold>

          {/* 4. The amendment history, read when the fold first opens */}
          <Fold
            id="mechanics-history"
            icon={<Labyrinth className="size-6" />}
            title={<Trans context="GameMechanics, h2">Amendment History</Trans>}
            line={<Trans context="GameMechanics, fold summary">Every change to the rules, who made it and why</Trans>}
            open={openFolds["mechanics-history"]}
            onToggle={() => toggleFold("mechanics-history")}
          >
            <p className={`${NOTE} mb-4 max-w-2xl`}>
              <Trans context="GameMechanics, p">Every change to the rules is on the permanent record: what moved, from what to
              what, by whom, and under which passed proposal.
            </Trans></p>
            {history === null ? (
              <p className={HINT} role="status"><Trans context="GameMechanics, p">Loading the record…</Trans></p>
            ) : history.length === 0 ? (
              <p className={HINT}>
                <Trans context="GameMechanics, p">No rules have been changed yet. This Game still plays entirely by its platform defaults.
              </Trans></p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-muted">
                {history.map((h) => (
                  <li key={h.id} className="px-4 py-3">
                    <HistoryEntry h={{ ...h, label: dialLabel(h.key, h.label, i18n) }} valueOf={amendmentValue} />
                  </li>
                ))}
              </ul>
            )}
          </Fold>
        </>
      )}

      {/* The proposal basket: staged changes become a proposal. Fixed above
          the mobile tab bar (z-[70] modal ladder, bar is z-50), so the next act
          sits under the thumb. It spans the bottom edge, so the shortcuts
          button steps out while it shows. */}
      {stagedCount > 0 && (
        <div data-hides-fab className="fixed inset-x-0 bottom-0 z-[70] border-t border-notice/60 bg-card pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-sm">
          <div className="container mx-auto max-w-3xl px-4 pt-3">
            {!composerOpen ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  <Trans context="GameMechanics, p"><span className="font-semibold">{stagedCount}</span> change{stagedCount === 1 ? "" : "s"} staged
                </Trans></p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStaged({})} className={BTN_SECONDARY}>
                    <Trans context="GameMechanics, button">Clear
                  </Trans></button>
                  <button type="button" onClick={() => setComposerOpen(true)} className={BTN_PRIMARY}>
                    <Trans context="GameMechanics, button">Write the proposal
                  </Trans></button>
                </div>
              </div>
            ) : (
              <div className="pb-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground"><Trans context="GameMechanics, h3">Propose these changes</Trans></h3>
                  <button
                    type="button"
                    onClick={() => setComposerOpen(false)}
                    aria-label={t({ message: "Collapse the composer", context: "GameMechanics, aria-label" })}
                    className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t({ message: "A title the village will recognize it by", context: "GameMechanics, placeholder" })}
                  aria-label={t({ message: "Proposal title", context: "GameMechanics, aria-label" })}
                  className={`${FIELD} mb-2 min-h-11 text-sm`}
                />
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder={t({ message: "Why this change matters. The village votes on reasons, not numbers.", context: "GameMechanics, placeholder" })}
                  aria-label={t({ message: "Proposal rationale", context: "GameMechanics, aria-label" })}
                  rows={3}
                  className={`${FIELD} mb-2 resize-y text-sm`}
                />
                {problems.length > 0 && (
                  <ul role="alert" className="mb-2 space-y-0.5 text-xs text-destructive">
                    {problems.map((p) => (
                      <li key={p.key}>
                        <span className="font-semibold">{p.key}</span>: {p.problem}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={submitting || !title.trim() || !rationale.trim()}
                    onClick={submitProposal}
                    className={BTN_PRIMARY}
                  >
                    {submitting ? "Proposing…" : standing?.qualified ? "Open the proposal" : "Save as draft"}
                  </button>
                  <span className={HINT}>
                    {standing?.qualified
                      ? "Opens for village support immediately."
                      : "A qualified member's sponsorship opens it."}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
