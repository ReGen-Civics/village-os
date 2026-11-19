/**
 * THE WALKTHROUGH on an application's page: one place to walk an applicant
 * from "proposal received" to a decision. The stage track (received, our
 * review, shortlist, references, follow-ups and intuition conversations, the
 * final conversation, the decision), who acts next (a role, never a person),
 * the one obvious act for the stage, the references with their follow-up
 * owners and notes, and everything gathered for the role that makes the final
 * call.
 *
 * The rules are shared/applicantOnboarding.ts and the doors
 * server/routes/applicantOnboarding.ts. The door answers 404 to anybody who is
 * not part of this application, and to the applicant, and the panel then
 * renders nothing. Nothing here ranks, scores or judges the applicant: the
 * scorecards are shown as written, untotalled.
 */
import { useCallback, useEffect, useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, H2, HINT, LABEL, TILE } from "@/components/journey/look";
import { FOLLOWUP_NOTE_MAX, ONBOARDING_WORDS, TRACK_WORDS, type PrimaryAction, type ShortlistAnswer, type TrackStage, type TrackState } from "@shared/applicantOnboarding";
import { GUT_WORDS, LEVEL_WORDS, PANEL_WORDS, type GutAnswer, type InterviewState, type ScoreLevel } from "@shared/applicationReview";

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
  you: { mayShortlist: boolean; mayAskReferences: boolean; mayAddFinal: boolean; isFinalCall: boolean; holdsPower: boolean };
}

const STATE_CLASS: Record<TrackState, string> = {
  done: "border-open/60 text-open",
  now: "border-notice bg-notice/10 font-bold text-foreground",
  later: "border-border text-muted-foreground",
  skipped: "border-border/60 text-muted-foreground line-through",
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
}

export default function Walkthrough({ applicationRef, onChanged }: WalkthroughProps) {
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
    const label = ONBOARDING_WORDS.primary[t.primary];
    switch (t.primary) {
      case "shortlist":
        return w.you.mayShortlist ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void act("/shortlist", { answer: "yes" })} data-walk-shortlist="yes">{label}</button>
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void act("/shortlist", { answer: "no" })} data-walk-shortlist="no">{ONBOARDING_WORDS.notShortlist}</button>
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
      case "final_conversation":
        return <a className={BTN_PRIMARY} href="#scorecards">{label}</a>;
      case "review":
      case "decide":
        return <a className={BTN_PRIMARY} href="#op-decide-panel">{label}</a>;
    }
  })();

  const gathered = w.you.isFinalCall || w.you.holdsPower;

  return (
    <section id="walkthrough" aria-labelledby="walk-heading" className={`scroll-mt-24 ${CARD}`} data-walkthrough={t.now}>
      <p className={EYEBROW}>{TRACK_WORDS[t.now]}</p>
      <h2 id="walk-heading" className={H2}>{ONBOARDING_WORDS.heading}</h2>
      <p className={`mt-1 ${HINT}`}>{ONBOARDING_WORDS.intro}</p>

      {/* The stage track: one row each on a phone, wrapping across on a wide screen. */}
      <ol className="mt-4 grid gap-2 sm:flex sm:flex-wrap" data-walk-track="">
        {t.stages.map((s, i) => (
          <li key={s.key} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${STATE_CLASS[s.state]}`} data-walk-stage={s.key} data-walk-state={s.state} aria-current={s.state === "now" ? "step" : undefined}>
            <span aria-hidden="true" className="tabular-nums">{i + 1}</span>
            <span>{s.label}</span>
            <span className="sr-only">{ONBOARDING_WORDS.stateWords[s.state]}</span>
          </li>
        ))}
      </ol>

      <div className={`mt-4 ${TILE}`} data-walk-next="">
        <p className={LABEL}>{ONBOARDING_WORDS.whoActs}</p>
        <p className="text-foreground" data-walk-who="">{t.who}</p>
        <p className={`mt-2 ${LABEL}`}>{ONBOARDING_WORDS.whatNext}</p>
        <p className="text-foreground">{t.next}</p>
        {primary && <div className="mt-3">{primary}</div>}
        {said?.text && <p role={said.ok ? "status" : "alert"} className={`mt-2 text-sm ${said.ok ? "text-foreground" : "text-destructive"}`}>{said.text}</p>}
      </div>

      {(w.references.asked || w.references.list.length > 0) && (
        <References w={w} busy={busy} act={act} />
      )}

      {gathered && <Gathered w={w} />}
    </section>
  );
}

function References({ w, busy, act }: { w: ServedWalkthrough; busy: boolean; act: (path: string, body?: unknown) => Promise<boolean> }) {
  return (
    <div id="walk-references" className="mt-6 scroll-mt-24" data-walk-references="">
      <h3 className="font-display text-xl font-bold text-foreground">{ONBOARDING_WORDS.referencesHeading}</h3>
      <p className={`mt-1 ${HINT}`}>{ONBOARDING_WORDS.referencesPrivate}</p>
      {!w.references.given && <p className="mt-2 text-foreground">{ONBOARDING_WORDS.referencesAsked}</p>}
      {w.references.given && w.references.list.length === 0 && <p className="mt-2 text-foreground">{ONBOARDING_WORDS.referencesNone}</p>}
      <ul className="mt-3 grid gap-3">
        {w.references.list.map((r) => (
          <ReferenceTile key={r.id} r={r} w={w} busy={busy} act={act} />
        ))}
      </ul>
    </div>
  );
}

function ownerWords(r: ServedReference): string {
  if (r.owner.userId) return r.owner.userName ?? ONBOARDING_WORDS.ownerMember;
  if (r.owner.roleName) return r.owner.isDefault ? ONBOARDING_WORDS.ownerDefault(r.owner.roleName) : r.owner.roleName;
  return ONBOARDING_WORDS.ownerNobody;
}

function ReferenceTile({ r, w, busy, act }: { r: ServedReference; w: ServedWalkthrough; busy: boolean; act: (path: string, body?: unknown) => Promise<boolean> }) {
  const [notes, setNotes] = useState(r.notes ?? "");
  const [done, setDone] = useState(r.followedUp);
  const [pick, setPick] = useState("");
  return (
    <li className={TILE} data-walk-reference={r.position}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{r.name}</p>
        <span className={CHIP_SOFT}>{r.followedUp ? ONBOARDING_WORDS.followedUp : ONBOARDING_WORDS.notFollowedUp}</span>
      </div>
      <dl className="mt-2 grid gap-1 text-sm">
        <div><dt className="inline font-semibold text-foreground">{ONBOARDING_WORDS.contact}: </dt><dd className="inline break-words text-foreground">{r.contact}</dd></div>
        <div><dt className="inline font-semibold text-foreground">{ONBOARDING_WORDS.howKnown}: </dt><dd className="inline break-words text-foreground">{r.how}</dd></div>
        {r.ally && <div><dt className="inline font-semibold text-foreground">{ONBOARDING_WORDS.ally}: </dt><dd className="inline break-words text-foreground">{r.ally}</dd></div>}
        <div><dt className="inline font-semibold text-foreground">{ONBOARDING_WORDS.owner}: </dt><dd className="inline text-foreground" data-walk-owner="">{ownerWords(r)}</dd></div>
      </dl>
      {w.references.mayAssign && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grow">
            <span className={LABEL}>{ONBOARDING_WORDS.ownerPick}</span>
            <select className={`mt-1 min-h-11 ${FIELD}`} value={pick} onChange={(e) => setPick(e.target.value)} data-walk-owner-pick="">
              <option value="">{ONBOARDING_WORDS.ownerPick}</option>
              <optgroup label={ONBOARDING_WORDS.ownerRole}>
                {w.roles.map((role) => <option key={`r:${role.id}`} value={`r:${role.id}`}>{role.name}</option>)}
              </optgroup>
              <optgroup label={ONBOARDING_WORDS.ownerMember}>
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
            {ONBOARDING_WORDS.ownerGive}
          </button>
        </div>
      )}
      {r.mine ? (
        <div className="mt-3">
          <label className="block">
            <span className={LABEL}>{ONBOARDING_WORDS.notes}</span>
            <textarea rows={3} className={`mt-1 ${FIELD}`} value={notes} maxLength={FOLLOWUP_NOTE_MAX} onChange={(e) => setNotes(e.target.value)} data-walk-notes="" />
          </label>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-foreground">
            <input type="checkbox" className="size-5" checked={done} onChange={(e) => setDone(e.target.checked)} />
            {ONBOARDING_WORDS.followedUp}
          </label>
          <button type="button" className={`mt-2 ${BTN_PRIMARY}`} disabled={busy} onClick={() => void act(`/references/${r.id}/notes`, { notes, followedUp: done })} data-walk-notes-save="">
            {ONBOARDING_WORDS.notesSave}
          </button>
        </div>
      ) : (
        r.notes && (
          <div className="mt-3">
            <p className={LABEL}>{ONBOARDING_WORDS.notes}{r.notesOn ? ` (${r.notesOn})` : ""}</p>
            <p className="whitespace-pre-wrap break-words text-foreground">{r.notes}</p>
          </div>
        )
      )}
    </li>
  );
}

/** Everything the final call reads, in one place: each reference's notes and each conversation's scorecard, as written. */
function Gathered({ w }: { w: ServedWalkthrough }) {
  const role = w.roleNames.finalCall ?? "the role that makes the final call";
  const cards = w.scorecards;
  const criterion = (id: string) => cards?.criteria.find((c) => c.id === id)?.text ?? id;
  return (
    <div className="mt-6" data-walk-gathered="">
      <h3 className="font-display text-xl font-bold text-foreground">{ONBOARDING_WORDS.gatheredHeading}</h3>
      <p className={`mt-1 ${HINT}`}>{ONBOARDING_WORDS.gatheredIntro(role)}</p>
      {w.references.list.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {w.references.list.map((r) => (
            <li key={r.id} className={TILE}>
              <p className="font-semibold text-foreground">{r.name} <span className="font-normal text-muted-foreground">· {ownerWords(r)}</span></p>
              <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{r.notes || ONBOARDING_WORDS.notFollowedUp}</p>
            </li>
          ))}
        </ul>
      )}
      {cards && (
        <div className="mt-3 grid gap-2">
          {!cards.mayRead && <p className={HINT}>{ONBOARDING_WORDS.scorecardsHidden}</p>}
          {cards.interviews.map((iv) => (
            <div key={iv.position} className={TILE} data-walk-card={iv.position}>
              <p className="font-semibold text-foreground">
                {iv.roleName}
                {iv.final ? ` · ${TRACK_WORDS.final_interview}` : ""}
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
