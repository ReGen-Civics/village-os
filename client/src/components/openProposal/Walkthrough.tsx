/**
 * THE WALKTHROUGH on an application's page: one place to walk an applicant
 * from "proposal received" to a decision. The stage track (received, our
 * review with its shortlist and first conversation, references and proposal with the follow-ups and the next
 * conversation, the final conversation, the agreement, the start), who acts next (a role, never a person),
 * the one obvious act for the stage, the references with their follow-up
 * owners and notes, and everything gathered for the role that makes the final
 * call.
 *
 * The rules are shared/applicantOnboarding.ts and the doors
 * server/routes/applicantOnboarding.ts. The door answers 404 to anybody who is
 * not part of this application, and to the applicant, and the panel then
 * renders nothing. A member's own application for a first long-term role
 * (pages/SeatApplication.tsx) gets the same panel with its shorter track: the
 * references, the follow-ups and the decision. Nothing here ranks, scores or judges the applicant: the
 * scorecards are shown as written, untotalled.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { gameFetch } from "@/lib/gameApi";
import { BTN_NOTICE, BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, H2, HINT, LABEL, TILE } from "@/components/journey/look";
import { FOLLOWUP_NOTE_MAX, type PrimaryAction, type ShortlistAnswer, type TrackStage, type TrackState } from "@shared/applicantOnboarding";
import { trackStageWords } from "./trackStageWords";
import ConversationGuide from "@/components/openProposal/ConversationGuide";
import ConversationNotes from "@/components/openProposal/ConversationNotes";
import ProposalVersions from "@/components/openProposal/ProposalVersions";
import PrivacyNote from "@/components/openProposal/PrivacyNote";
import { useDayWords } from "@/components/openProposal/ConversationNotes";
import type { ProposalVersion } from "@shared/proposalRefine";
import type { GuideView } from "@shared/conversationGuide";
import type { ConversationNotesView } from "@shared/conversationNotes";
import { GUT_WORDS, LEVEL_WORDS, PANEL_WORDS, type GutAnswer, type InterviewState, type ScoreLevel } from "@shared/applicationReview";
import { onboardingWords, useOnboardingWords } from "@/components/openProposal/onboardingWords";

/** A conversation's state in the review panel's own words. */
const IV_STATE: Record<InterviewState, string> = { waiting: PANEL_WORDS.waiting, open: PANEL_WORDS.open, scored: PANEL_WORDS.scored, skipped: PANEL_WORDS.skipped };

interface ServedReference {
  id: number;
  position: number;
  name: string;
  contact: string;
  how: string;
  ally: string;
  owner: { roleId: string; roleName: string | null; userId: string | null; userName: string | null; isDefault: boolean };
  notes: string | null;
  notesOn: string | null;
  followedUp: boolean;
  mine: boolean;
}

interface ServedWalkthrough {
  track: { stages: Array<{ key: TrackStage; label: string; state: TrackState }>; now: TrackStage; who: string; next: string; primary: PrimaryAction };
  shortlist: ShortlistAnswer | null;
  references: { asked: boolean; given: boolean; list: ServedReference[]; total: number; mayAssign: boolean };
  roles: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  scorecards: {
    criteria: Array<{ id: string; text: string }>;
    mayRead: boolean;
    interviews: Array<{ position: number; roleName: string; minutes: number; final: boolean; state: InterviewState; entries: Array<{ criterionId: string; level: string; evidence: string }> | null; gut: { answer: GutAnswer; note: string } | null }>;
  } | null;
  roleNames: { followup: string | null; finalCall: string | null };
  guide?: GuideView | null;
  /** Each conversation's private notes and files this reader may read (0444). Never served to the applicant. */
  conversations?: ConversationNotesView[];
  /** The proposal's earlier versions, when the applicant refined it (shared/proposalRefine.ts), and its words now. */
  proposalVersions?: ProposalVersion[];
  proposalNow?: { why: string; aim: string } | null;
  you: { mayShortlist: boolean; mayAskReferences: boolean; mayAddFinal: boolean; isFinalCall: boolean; holdsPower: boolean };
}

/**
 * The track as the applicant page's trail stones (QA round 3: bordered numbered squares read like pagination): the
 * stone you stand on gold, a passed one green, the rest plain. The stage's name beside it from sm up, and always for
 * a screen reader.
 */
const STONE_STATE: Record<TrackState, "done" | "here" | "ahead"> = { done: "done", now: "here", later: "ahead", skipped: "ahead" };
const STONE_FACE: Record<TrackState, string> = {
  done: "!border-open !text-open",
  now: "",
  later: "",
  skipped: "opacity-60",
};
const STONE_LABEL: Record<TrackState, string> = {
  done: "font-medium text-foreground",
  now: "font-bold text-foreground",
  later: "text-muted-foreground",
  skipped: "text-muted-foreground line-through",
};

async function call(path: string, method: "GET" | "POST", body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await gameFetch(path, { method, cache: "no-store", ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}) });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export interface WalkthroughProps {
  applicationRef: string;
  /** The page reloads its own data after an act here (the decision panel reads the same steps). */
  onChanged?: () => void;
  /** Where "Go to the decision" leads on this page: the open proposal's decide panel, or a member application's holder card. */
  decideHref?: string;
  /** Tells the page the stage it stands at, so the phone's adopt row floats only at Agreement (QA round 1). */
  onStage?: (stage: TrackStage) => void;
  /**
   * The decide panel with its own gold act (Adopt, or the invitation) is on this page: "Go to the decision" is then
   * gold-edged, so the page keeps one gold act (QA round 3).
   */
  decideOnPage?: boolean;
}

export default function Walkthrough({ applicationRef, onChanged, decideHref = "#op-decide-panel", onStage, decideOnPage = false }: WalkthroughProps) {
  const OW = useOnboardingWords();
  const [w, setW] = useState<ServedWalkthrough | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/api/governance/applications/${encodeURIComponent(applicationRef)}`;

  const load = useCallback(async () => {
    const a = await call(`${base}/walkthrough`, "GET");
    setW(a.ok ? (a.data.walkthrough as ServedWalkthrough) : null);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (w) onStage?.(w.track.now);
  }, [w, onStage]);

  // A bell's link lands on a part this card draws (#conversation-notes): the browser looked for it before the card
  // had loaded, so once it has, go there once (QA round 2).
  const landed = useRef(false);
  useEffect(() => {
    if (!w || landed.current || typeof window === "undefined") return;
    landed.current = true;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const land = () => {
      const el = document.getElementById(decodeURIComponent(hash));
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start" });
    };
    land();
    // The page grows after the jump (art, the decide panel, the scorecards), which once left the notes 1000px off
    // (QA round 4). Land again after it settles, unless the reader has moved the page themselves.
    let moved = false;
    const mine = () => {
      moved = true;
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const e of events) window.addEventListener(e, mine, { passive: true, once: true });
    const timers = [350, 1000, 2000].map((ms) => window.setTimeout(() => !moved && land(), ms));
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      for (const e of events) window.removeEventListener(e, mine);
    };
  }, [w]);

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    setSaid(null);
    const a = await call(`${base}${path}`, "POST", body);
    setBusy(false);
    setSaid({ ok: a.ok, text: String(a.data?.message ?? (a.ok ? "" : "That did not go through. Try again.")) });
    await load();
    if (a.ok) onChanged?.();
    return a.ok;
  };

  if (!w) return null;
  const t = w.track;

  /** The one obvious act for the stage: a button where this reader may act here, a link to the panel that holds it otherwise. */
  const primary = (() => {
    const label = OW.primary[t.primary];
    switch (t.primary) {
      case "shortlist":
        return w.you.mayShortlist ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void act("/shortlist", { answer: "yes" })} data-walk-shortlist="yes">{label}</button>
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void act("/shortlist", { answer: "no" })} data-walk-shortlist="no">{OW.notShortlist}</button>
          </div>
        ) : null;
      case "ask_references":
        return w.you.mayAskReferences ? <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void act("/references/ask")} data-walk-ask="">{label}</button> : null;
      case "add_final":
        return w.you.mayAddFinal ? <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void act("/final-conversation")} data-walk-final="">{label}</button> : null;
      case "wait_applicant":
      case "none":
        return <p className={HINT}>{label}</p>;
      case "follow_up":
        return <a className={BTN_PRIMARY} href="#walk-references">{label}</a>;
      case "conversation":
      case "final_conversation":
        return <a className={BTN_PRIMARY} href="#scorecards">{label}</a>;
      case "review":
        // "Go to our review" shows at every width (QA round 5): our review card holds no floating bar, so this link is
        // how a phone reaches it. Gold-edged while the decide panel's own gold act is on the page.
        return (
          <a className={decideOnPage ? BTN_NOTICE : BTN_PRIMARY} href={decideHref} data-walk-decide={decideOnPage ? "edged" : "gold"}>
            {label}
          </a>
        );
      case "decide":
        // Below md the decide panel floats its own Adopt and Decline (DecideDock), so a second door to the same choice
        // only covered the track (QA round 4): there the words point below. From md up there is no floating bar, so
        // the link stays, gold-edged (QA round 5).
        return decideOnPage ? (
          <>
            <p className={`md:hidden ${HINT}`} data-walk-decide-below="">{OW.decideBelow}</p>
            <span className="hidden md:block">
              <a className={BTN_NOTICE} href={decideHref} data-walk-decide="edged">{label}</a>
            </span>
          </>
        ) : (
          <a className={BTN_PRIMARY} href={decideHref} data-walk-decide="gold">{label}</a>
        );
    }
  })();

  const gathered = w.you.isFinalCall || w.you.holdsPower;

  return (
    <section id="walkthrough" aria-labelledby="walk-heading" className={`scroll-mt-24 ${CARD}`} data-walkthrough={t.now}>
      <p className={EYEBROW}>{trackStageWords()[t.now]}</p>
      <h2 id="walk-heading" className={H2}>{OW.heading}</h2>
      {/* Below sm the intro waits: the act comes first on a phone's first screen (QA round 3). */}
      <p className={`mt-1 hidden sm:block ${HINT}`}>{OW.intro}</p>

      {/* Who acts next, then the act, then what happens next (QA round 3): the act on a phone's first screen. */}
      <div className={`mt-4 ${TILE}`} data-walk-next="">
        <p className={LABEL}>{OW.whoActs}</p>
        <p className="text-foreground" data-walk-who="">{t.who}</p>
        {primary && <div className="mt-3" data-walk-act="">{primary}</div>}
        {said?.text && <p role={said.ok ? "status" : "alert"} className={`mt-2 text-sm ${said.ok ? "text-foreground" : "text-destructive"}`}>{said.text}</p>}
        <p className={`mt-3 ${LABEL}`}>{OW.whatNext}</p>
        <p className="text-foreground" data-walk-what="">{t.next}</p>
      </div>

      {/* The stage track as trail stones: one row of six on a phone (the stage's name is the eyebrow above); from sm
          up, each stone carries its name and the row wraps. */}
      <ol className="mt-4 flex items-center gap-2 sm:flex-wrap sm:gap-x-4 sm:gap-y-2" data-walk-track="">
        {t.stages.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 text-sm" data-walk-stage={s.key} data-walk-state={s.state} aria-current={s.state === "now" ? "step" : undefined}>
            <span className="jw-stone flex shrink-0" data-state={STONE_STATE[s.state]} aria-hidden="true">
              {/* The gold fill says "you are here"; no number on it (QA round 4: dark on gold read at 2.35:1). */}
              <span className={`jw-stone-face !size-8 !text-xs ${STONE_FACE[s.state]}`}>{s.state === "done" ? <Check className="size-3.5" /> : ""}</span>
            </span>
            <span className={`sr-only sm:not-sr-only ${STONE_LABEL[s.state]}`}>{s.label}</span>
            <span className="sr-only">{OW.stateWords[s.state]}</span>
          </li>
        ))}
      </ol>

      {(w.references.asked || w.references.list.length > 0) && (
        <References w={w} busy={busy} act={act} />
      )}

      {/* One place for notes (QA round 1): the guide's questions fold into each conversation; alone only when there is none. */}
      {w.conversations && w.conversations.length > 0 ? (
        <ConversationNotes base={base} conversations={w.conversations} guide={w.guide ?? null} onSaved={() => void load()} />
      ) : (
        w.guide && <ConversationGuide base={base} guide={w.guide} onSaved={() => void load()} />
      )}
      {w.proposalVersions && w.proposalVersions.length > 0 && <ProposalVersions versions={w.proposalVersions} current={w.proposalNow ?? null} />}
      {gathered && <Gathered w={w} />}
    </section>
  );
}

function References({ w, busy, act }: { w: ServedWalkthrough; busy: boolean; act: (path: string, body?: unknown) => Promise<boolean> }) {
  const OW = useOnboardingWords();
  return (
    <div id="walk-references" className="mt-6 scroll-mt-24" data-walk-references="">
      <p className={EYEBROW}>{OW.referencesKicker}</p>
      <h3 className="mt-1 font-display text-xl font-bold text-foreground">{OW.referencesHeading}</h3>
      <PrivacyNote line={OW.referencesShort} label={OW.whoReads} more={OW.referencesPrivate} />
      {!w.references.given && <p className="mt-2 text-foreground">{OW.referencesAsked}</p>}
      {w.references.given && w.references.list.length === 0 && <p className="mt-2 text-foreground">{OW.referencesNone}</p>}
      <ul className="mt-3 grid gap-3">
        {w.references.list.map((r) => (
          <ReferenceTile key={r.id} r={r} w={w} busy={busy} act={act} />
        ))}
      </ul>
    </div>
  );
}

function ownerWords(r: ServedReference): string {
  if (r.owner.userId) return r.owner.userName ?? onboardingWords().ownerMember;
  if (r.owner.roleName) return r.owner.isDefault ? onboardingWords().ownerDefault(r.owner.roleName) : r.owner.roleName;
  return onboardingWords().ownerNobody;
}

function ReferenceTile({ r, w, busy, act }: { r: ServedReference; w: ServedWalkthrough; busy: boolean; act: (path: string, body?: unknown) => Promise<boolean> }) {
  const OW = useOnboardingWords();
  const day = useDayWords();
  const [notes, setNotes] = useState(r.notes ?? "");
  const [done, setDone] = useState(r.followedUp);
  const [pick, setPick] = useState("");
  return (
    <li className={TILE} data-walk-reference={r.position}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{r.name}</p>
        <span className={CHIP_SOFT}>{r.followedUp ? OW.followedUp : OW.notFollowedUp}</span>
      </div>
      <dl className="mt-2 grid gap-1 text-sm">
        <div><dt className="inline font-semibold text-foreground">{OW.contact}: </dt><dd className="inline break-words text-foreground">{r.contact}</dd></div>
        <div><dt className="inline font-semibold text-foreground">{OW.howKnown}: </dt><dd className="inline break-words text-foreground">{r.how}</dd></div>
        {r.ally && <div><dt className="inline font-semibold text-foreground">{OW.ally}: </dt><dd className="inline break-words text-foreground">{r.ally}</dd></div>}
        <div><dt className="inline font-semibold text-foreground">{OW.owner}: </dt><dd className="inline text-foreground" data-walk-owner="">{ownerWords(r)}</dd></div>
      </dl>
      {w.references.mayAssign && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grow">
            <span className={LABEL}>{OW.ownerPick}</span>
            <select className={`mt-1 min-h-11 ${FIELD}`} value={pick} onChange={(e) => setPick(e.target.value)} data-walk-owner-pick="">
              <option value="">{OW.ownerPick}</option>
              <optgroup label={OW.ownerRole}>
                {w.roles.map((role) => <option key={`r:${role.id}`} value={`r:${role.id}`}>{role.name}</option>)}
              </optgroup>
              <optgroup label={OW.ownerMember}>
                {w.members.map((m) => <option key={`u:${m.id}`} value={`u:${m.id}`}>{m.name}</option>)}
              </optgroup>
            </select>
          </label>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={busy || !pick}
            onClick={() => void act(`/references/${r.id}/owner`, pick.startsWith("r:") ? { roleId: pick.slice(2) } : { userId: pick.slice(2) }).then((ok) => ok && setPick(""))}
          >
            {OW.ownerGive}
          </button>
        </div>
      )}
      {r.mine ? (
        <div className="mt-3">
          <label className="block">
            <span className={LABEL}>{OW.notes}</span>
            <textarea rows={3} className={`mt-1 ${FIELD}`} value={notes} maxLength={FOLLOWUP_NOTE_MAX} onChange={(e) => setNotes(e.target.value)} data-walk-notes="" />
          </label>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-foreground">
            <input type="checkbox" className="size-5" checked={done} onChange={(e) => setDone(e.target.checked)} />
            {OW.followedUp}
          </label>
          <button type="button" className={`mt-2 ${BTN_PRIMARY}`} disabled={busy} onClick={() => void act(`/references/${r.id}/notes`, { notes, followedUp: done })} data-walk-notes-save="">
            {OW.notesSave}
          </button>
        </div>
      ) : (
        r.notes && (
          <div className="mt-3">
            {/* The day said like the note dates (QA round 4), never a raw 2026-11-27. */}
            <p className={LABEL}>{OW.notes}{r.notesOn ? ` · ${day(r.notesOn)}` : ""}</p>
            <p className="whitespace-pre-wrap break-words text-foreground">{r.notes}</p>
          </div>
        )
      )}
    </li>
  );
}

/** Everything the final call reads, in one place: each reference's notes and each conversation's scorecard, as written. */
function Gathered({ w }: { w: ServedWalkthrough }) {
  const OW = useOnboardingWords();
  const role = w.roleNames.finalCall ?? "the role that makes the final call";
  const cards = w.scorecards;
  const criterion = (id: string) => cards?.criteria.find((c) => c.id === id)?.text ?? id;
  return (
    <div className="mt-6" data-walk-gathered="">
      <p className={EYEBROW}>{OW.gatheredKicker}</p>
      <h3 className="mt-1 font-display text-xl font-bold text-foreground">{OW.gatheredHeading}</h3>
      <PrivacyNote line={OW.gatheredShort(role)} label={OW.gatheredMore} more={OW.gatheredIntro(role)} />
      {w.references.list.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {w.references.list.map((r) => (
            <li key={r.id} className={TILE}>
              <p className="font-semibold text-foreground">{r.name} <span className="font-normal text-muted-foreground">· {ownerWords(r)}</span></p>
              <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{r.notes || OW.notFollowedUp}</p>
            </li>
          ))}
        </ul>
      )}
      {cards && (
        <div className="mt-3 grid gap-2">
          {!cards.mayRead && <p className={HINT}>{OW.scorecardsHidden}</p>}
          {cards.interviews.map((iv) => (
            <div key={iv.position} className={TILE} data-walk-card={iv.position}>
              <p className="font-semibold text-foreground">
                {iv.roleName}
                {iv.final ? ` · ${trackStageWords().final_interview}` : ""}
                <span className="font-normal text-muted-foreground"> · {IV_STATE[iv.state] ?? iv.state}</span>
              </p>
              {iv.gut && <p className="mt-1 text-foreground">{PANEL_WORDS.gutRead}: {GUT_WORDS[iv.gut.answer]}{iv.gut.note ? `, ${iv.gut.note}` : ""}</p>}
              {iv.entries && (
                <ul className="mt-1 grid gap-1 text-sm">
                  {iv.entries.map((e) => (
                    <li key={e.criterionId} className="text-foreground">
                      <span className="font-semibold">{criterion(e.criterionId)}</span>: {LEVEL_WORDS[e.level as ScoreLevel] ?? e.level}. {e.evidence}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
