/**
 * ONE CHANGE REQUEST, a kind of decision under Decisions (Rye, 2026-11-06; spec
 * village-os-ops/internal/spec/change-requests/, US1, US3, R35 to R41; folded
 * under Decisions by the lead, 27 Nov 2026).
 *
 *   /governance/decisions/changes/:id  its changes before and after, its review,
 *                                      and what is still needed before the vote
 *
 * The list of change requests and the form that starts one are the Change
 * requests section of Decisions (components/governance/ChangeRequestsSection),
 * and the old addresses (/changes, /changes/:id) redirect there and here. The
 * page draws inside the site's shell now, in the night world, with the
 * Governance views above it, so a change request reads as one of the village's
 * decisions and not as a separate tool.
 *
 * Everything a member reads here that the SERVER decides comes from the server
 * in plain words: the checklist lines, the names ("Role (FirstName)", III.2),
 * the refusals. Every rule stays the server's: who may edit (the author), who is
 * asked to review (the holders of the powers the changes touch), and when it
 * may go to the vote. The page's own words go through Lingui (spec i18n US6.1),
 * with a context on every short one so a translator can tell them apart.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { ArrowLeft, Check, Clock, MessageSquare } from "lucide-react";
import Layout from "@/components/Layout";
import { headers, refusal } from "@/components/governance/changeRequestClient";
import GovernanceTabs from "@/components/governance/now/GovernanceTabs";
import { authToken } from "@/lib/gameApi";
import VoiceArea from "@/components/voice/VoiceArea";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CARD_FEATURED, CHIP_SOFT, EYEBROW, FIELD, HINT, LABEL, TILE, WORLD } from "@/components/journey/look";
import { CHANGE_REQUESTS_HREF } from "@shared/changeRequestAddress";

type State = "gathering" | "in_review" | "voting" | "closed";

interface Change {
  position: number;
  key: string;
  kind: string;
  label: string;
  withheld: boolean;
  before: string | null;
  after: string | null;
  change: Record<string, unknown> | null;
}

interface Note {
  id: string;
  kind: "question" | "concern" | "objection" | "edit" | "consent" | "answer";
  revision: number;
  position: number | null;
  body: string;
  proposed: { op: string; position: number | null; change: Record<string, unknown> | null } | null;
  answers: string | null;
  outcome: "open" | "taken_in" | "turned_down" | "answered";
  by: string;
  yours: boolean;
  at: string;
}

interface ChangeRequest {
  id: string;
  title: string;
  why: string;
  state: State;
  revision: number;
  relation: string | null;
  relatesTo: string | null;
  yours: boolean;
  author: string;
  cap: number;
  changes: Change[];
  review: null | {
    endsAt: string;
    ready: boolean;
    checklist: { key: string; done: boolean; words: string }[];
    consents: number;
    notes: Note[];
  };
}

type I18n = ReturnType<typeof useLingui>["i18n"];

const STEPS: readonly State[] = ["gathering", "in_review", "voting", "closed"];

// Words chosen outside a component are `msg` descriptors, rendered with
// i18n._ where they are shown, so the macro compiles them (spec i18n US6.1).
const STEP_WORDS: Record<State, MessageDescriptor> = {
  gathering: msg({ message: "Gathering", context: "change request step" }),
  in_review: msg({ message: "In review", context: "change request step" }),
  voting: msg({ message: "In the vote", context: "change request step" }),
  closed: msg({ message: "Decided", context: "change request step" }),
};

const NOTE_WORDS: Record<Note["kind"], MessageDescriptor> = {
  question: msg({ message: "Question", context: "change request note kind" }),
  concern: msg({ message: "Concern", context: "change request note kind" }),
  objection: msg({ message: "Objection", context: "change request note kind" }),
  edit: msg({ message: "Suggested edit", context: "change request note kind" }),
  consent: msg({ message: "Can live with it", context: "change request note kind" }),
  answer: msg({ message: "Answer", context: "change request note kind" }),
};

const OUTCOME_WORDS: Partial<Record<Note["outcome"], MessageDescriptor>> = {
  taken_in: msg({ message: "Taken in", context: "change request note outcome" }),
  turned_down: msg({ message: "Turned down", context: "change request note outcome" }),
  answered: msg({ message: "Answered", context: "change request note outcome" }),
};

const CHECKLIST_LABEL: Record<string, MessageDescriptor> = {
  changes: msg({ message: "Changes", context: "change request checklist" }),
  review_time: msg({ message: "Time to review", context: "change request checklist" }),
  objections: msg({ message: "Objections answered", context: "change request checklist" }),
};

const stepWords = (i18n: I18n, state: State) => i18n._(STEP_WORDS[state]);
const noteWords = (i18n: I18n, kind: Note["kind"]) => i18n._(NOTE_WORDS[kind]);
const outcomeWords = (i18n: I18n, outcome: Note["outcome"]) => (OUTCOME_WORDS[outcome] ? i18n._(OUTCOME_WORDS[outcome]!) : "");
const checklistLabel = (i18n: I18n, key: string) => i18n._(CHECKLIST_LABEL[key] ?? CHECKLIST_LABEL.objections);

// The reader's own language for dates (the review plan: never a hard-coded en-GB).
const day = (i18n: I18n, iso: string) => i18n.date(new Date(iso), { day: "numeric", month: "short" });
const moment = (i18n: I18n, iso: string) => i18n.date(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The sheet's look, named for this page's acts (components/journey/look.ts). */
const panel = `${CARD} space-y-3`;
const primary = BTN_PRIMARY;
const quiet = BTN_SECONDARY;
const field = `${FIELD} mt-1 block min-h-11 text-base`;
const link = "inline-flex min-h-11 items-center text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground";
const heading = "flex items-center gap-2 font-display text-xl font-bold text-card-foreground";

/** One message line that a screen reader hears: refusals as alerts, the rest as status. */
function Say({ text, alert }: { text: string | null; alert?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (text && alert) ref.current?.focus();
  }, [text, alert]);
  if (!text) return null;
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role={alert ? "alert" : "status"}
      className={`rounded-lg px-4 py-3 text-sm font-medium ${alert ? "border border-destructive bg-destructive/10 text-destructive" : "border border-border bg-muted text-foreground"}`}
    >
      {text}
    </p>
  );
}

/**
 * The four steps a change request walks, as stepping stones (the journey kit's
 * look, `.jw-stone`): a passed step is a gold ring, the step it stands on is
 * filled gold. A picture of where it is, never a control.
 */
function StepStones({ state }: { state: State }) {
  const { t, i18n } = useLingui();
  const here = STEPS.indexOf(state);
  const n = STEPS.length;
  return (
    <div className="jw-trail" data-testid="cr-steps">
      <div
        role="progressbar"
        aria-label={t({ message: "Where this change request is", context: "change request steps, read aloud" })}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={here + 1}
        aria-valuetext={stepWords(i18n, state)}
        className="jw-trail-path"
      >
        <span className="jw-trail-fill" style={{ transform: `scaleX(${here / (n - 1)})` }} />
      </div>
      <ol className="relative grid grid-cols-4">
        {STEPS.map((s, i) => {
          const at = i === here ? "here" : i < here ? "done" : "ahead";
          return (
            <li key={s} className="jw-stone flex flex-col items-center gap-1.5 text-center" data-state={at} aria-current={at === "here" ? "step" : undefined}>
              <span className="jw-stone-face" aria-hidden="true">
                {at === "done" ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={`text-xs leading-tight sm:text-sm ${at === "ahead" ? "font-semibold text-muted-foreground" : "font-bold text-foreground"}`}>{stepWords(i18n, s)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Before and after, stacked, so long words fit at 375 px; named "<setting>, from X to Y" (R38). */
function BeforeAfter({ c }: { c: Change }) {
  const { t } = useLingui();
  const shown = (v: string | null) => (v === null || v === "" ? t({ message: "not set", context: "a setting with no value" }) : v);
  if (c.withheld)
    return (
      <p className={`${HINT} mt-1`}>
        <Trans context="a setting whose value is hidden">Kept private</Trans>
      </p>
    );
  const before = shown(c.before);
  const after = shown(c.after);
  const label = c.label;
  return (
    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2" aria-label={t({ message: `${label}, from ${before} to ${after}`, context: "screen reader name of one change" })} role="group">
      <p className={`${TILE} break-words py-2 text-muted-foreground`}>
        <span aria-hidden="true" className="mr-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Trans context="the value of a setting today">Now</Trans>
        </span>
        <del>{before}</del>
      </p>
      <p className={`${TILE} break-words border-notice/60 py-2 font-semibold text-foreground`}>
        <span aria-hidden="true" className="mr-1 block text-xs font-semibold uppercase tracking-widest text-notice">
          <Trans context="the value of a setting once changed">After</Trans>
        </span>
        <ins className="no-underline">{after}</ins>
      </p>
    </div>
  );
}

function SignInLine() {
  return (
    <div className={panel}>
      <p className="text-base text-foreground">
        <Trans>Sign in to see what your village is weighing.</Trans>
      </p>
      <Link href="/login" className={primary}>
        <Trans context="change request: sign in">Sign in</Trans>
      </Link>
    </div>
  );
}

type Act = (path: string, method: string, body?: unknown) => Promise<boolean>;

function ChangeRow({ c, cr, act }: { c: Change; cr: ChangeRequest; act: Act }) {
  const [editing, setEditing] = useState(false);
  const [to, setTo] = useState(c.after ?? "");
  const canEdit = cr.yours && (cr.state === "gathering" || cr.state === "in_review") && !c.withheld && c.change;
  return (
    <li className="py-3">
      <p className="font-semibold text-foreground">{c.label}</p>
      <BeforeAfter c={c} />
      {canEdit && !editing && (
        <div className="mt-1 flex flex-wrap gap-x-4">
          <button type="button" className={link} onClick={() => setEditing(true)}>
            <Trans context="edit one change">Edit</Trans>
          </button>
          <button type="button" className={link} onClick={() => void act(`/changes/${c.position}?revision=${cr.revision}`, "DELETE")}>
            <Trans context="remove one change">Remove</Trans>
          </button>
          {cr.state === "gathering" && cr.changes.length > 1 && (
            <button type="button" className={link} onClick={() => void act(`/changes/${c.position}/split`, "POST", { revision: cr.revision })}>
              <Trans>Move to its own change request</Trans>
            </button>
          )}
        </div>
      )}
      {editing && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act(`/changes/${c.position}`, "PUT", { change: { ...c.change, to }, revision: cr.revision })) setEditing(false);
          }}
        >
          <label className={`${LABEL} block grow`}>
            <Trans context="the new value of a setting">New value</Trans>
            <input value={to} onChange={(e) => setTo(e.target.value)} className={field} />
          </label>
          <button type="submit" className={primary}>
            <Trans context="save a change">Save</Trans>
          </button>
          <button type="button" className={quiet} onClick={() => setEditing(false)}>
            <Trans context="close a form without saving">Not now</Trans>
          </button>
        </form>
      )}
    </li>
  );
}

function NoteItem({ n, cr, notes, act }: { n: Note; cr: ChangeRequest; notes: Note[]; act: Act }) {
  const { t, i18n } = useLingui();
  const [answering, setAnswering] = useState(false);
  const [text, setText] = useState("");
  const replies = notes.filter((r) => r.kind === "answer" && r.answers === n.id);
  const waiting = n.outcome === "open" && cr.state === "in_review" && cr.yours;
  const about = n.position !== null ? cr.changes[n.position]?.label : null;
  const outcome = outcomeWords(i18n, n.outcome);
  const when = day(i18n, n.at);
  const proposedTo = String((n.proposed?.change as any)?.to ?? "");
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className={CHIP_SOFT}>{noteWords(i18n, n.kind)}</span>
        {about ? <span className="text-xs font-semibold text-muted-foreground">{about}</span> : null}
        {outcome ? <span className={`${CHIP_SOFT} border-notice/60 text-notice`}>{outcome}</span> : null}
      </p>
      <p className={`${HINT} mt-1`}>
        {n.by} · {when}
      </p>
      {n.kind === "edit" && n.proposed && (
        <p className="mt-1 text-sm text-foreground">
          {n.proposed.op === "remove" ? (
            <Trans>Take this change out.</Trans>
          ) : n.proposed.op === "add" ? (
            <Trans context="a suggested edit that adds a change">Add: {proposedTo}</Trans>
          ) : (
            <Trans context="a suggested edit that changes a value">Change it to: {proposedTo}</Trans>
          )}
        </p>
      )}
      {n.body && <p className="mt-1 whitespace-pre-line break-words text-foreground">{n.body}</p>}
      {replies.map((r) => {
        const by = r.by;
        return (
          <div key={r.id} className="mt-2 border-l-2 border-notice/50 pl-3">
            <p className={HINT}>
              <Trans context="who answered a note">{by} answered</Trans>
            </p>
            <p className="whitespace-pre-line break-words text-foreground">{r.body}</p>
          </div>
        );
      })}
      {waiting && n.kind === "edit" && !answering && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={() => void act(`/suggestions/${n.id}/take-in`, "POST", { revision: cr.revision })}>
            <Trans context="accept a suggested edit">Take it in</Trans>
          </button>
          <button type="button" className={quiet} onClick={() => setAnswering(true)}>
            <Trans context="decline a suggested edit">Turn it down</Trans>
          </button>
        </div>
      )}
      {waiting && n.kind !== "edit" && n.kind !== "consent" && !answering && (
        <button type="button" className={`mt-1 ${link}`} onClick={() => setAnswering(true)}>
          <Trans context="answer a note in a review">Answer</Trans>
        </button>
      )}
      {answering && (
        <form
          className="mt-2 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok =
              n.kind === "edit"
                ? await act(`/suggestions/${n.id}/turn-down`, "POST", { reason: text, revision: cr.revision })
                : await act(`/notes/${n.id}/answer`, "POST", { body: text, revision: cr.revision });
            if (ok) setAnswering(false);
          }}
        >
          <label className={`${LABEL} block`}>
            {n.kind === "edit" ? t`Why not, in one line` : t({ message: "Your answer", context: "label of an answer box" })}
            {n.kind === "edit" ? (
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} className={field} />
            ) : (
              <VoiceArea value={text} onValue={setText}>
                <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} className={`${field} py-2`} />
              </VoiceArea>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primary} disabled={!text.trim()}>
              <Trans context="send a note">Send</Trans>
            </button>
            <button type="button" className={quiet} onClick={() => setAnswering(false)}>
              <Trans context="close a form without saving">Not now</Trans>
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

type PostKind = "question" | "concern" | "objection" | "consent" | "edit";

function ReviewForm({ cr, act }: { cr: ChangeRequest; act: Act }) {
  const { t } = useLingui();
  const [kind, setKind] = useState<PostKind | null>(null);
  const [body, setBody] = useState("");
  const [position, setPosition] = useState<string>("");
  const [to, setTo] = useState("");
  const helpId = useId();

  const posts: { kind: PostKind; words: string; help: string }[] = [
    { kind: "question", words: t({ message: "Ask a question", context: "review response" }), help: t`Something you want to understand before you decide.` },
    { kind: "concern", words: t({ message: "Share a concern", context: "review response" }), help: t`A worry you cannot point to yet.` },
    { kind: "objection", words: t({ message: "Object", context: "review response" }), help: t`What harm could this do to the village, or what would it stop us doing?` },
    { kind: "edit", words: t({ message: "Suggest an edit", context: "review response" }), help: t`A different value for one of the changes. The author may take it in.` },
    { kind: "consent", words: t({ message: "I can live with this", context: "review response" }), help: t`Counts for this version. An edit asks again.` },
  ];
  const chosen = posts.find((p) => p.kind === kind);

  const send = async () => {
    let ok = false;
    if (kind === "edit") {
      const at = Number(position);
      const base = cr.changes[at]?.change;
      ok = await act("/suggestions", "POST", { op: "replace", position: at, change: { ...base, to }, body });
    } else ok = await act("/notes", "POST", { kind, body, position: position === "" ? null : Number(position) });
    if (ok) {
      setKind(null);
      setBody("");
      setTo("");
      setPosition("");
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className={HINT}>
        <Trans>Everyone in the village can read what you write here.</Trans>
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t`Respond to this change request`}>
        {posts.map((p) => (
          <button
            key={p.kind}
            type="button"
            aria-pressed={kind === p.kind}
            onClick={() => (p.kind === "consent" ? void act("/notes", "POST", { kind: "consent" }) : setKind(p.kind))}
            className={kind === p.kind ? primary : quiet}
          >
            {p.words}
          </button>
        ))}
      </div>
      {chosen && kind !== "consent" && (
        <form
          className={`${TILE} space-y-3`}
          aria-describedby={helpId}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <p id={helpId} className={HINT}>
            {chosen.help}
          </p>
          <label className={`${LABEL} block`}>
            <Trans context="pick which change a note is about">Which change?</Trans>
            <select value={position} onChange={(e) => setPosition(e.target.value)} className={field} required={kind === "edit"}>
              {kind !== "edit" && <option value="">{t({ message: "The whole request", context: "a note about every change" })}</option>}
              {kind === "edit" && <option value="">{t({ message: "Choose a change", context: "pick a change to edit" })}</option>}
              {cr.changes.map((c) => (
                <option key={c.position} value={String(c.position)}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {kind === "edit" && (
            <label className={`${LABEL} block`}>
              <Trans context="the value a member suggests">Your value</Trans>
              <input value={to} onChange={(e) => setTo(e.target.value)} className={field} />
            </label>
          )}
          <label className={`${LABEL} block`}>
            {kind === "objection"
              ? t({ message: "The harm you see", context: "label of an objection box" })
              : kind === "edit"
                ? t({ message: "Why (optional)", context: "label of a suggested edit's reason" })
                : t({ message: "Your words", context: "label of a note box" })}
            <VoiceArea value={body} onValue={setBody}>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} className={`${field} py-2`} />
            </VoiceArea>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primary} disabled={kind === "edit" ? position === "" || !to.trim() : !body.trim()}>
              <Trans context="send a note">Send</Trans>
            </button>
            <button type="button" className={quiet} onClick={() => setKind(null)}>
              <Trans context="close a form without saving">Not now</Trans>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function DetailPage({ id }: { id: string }) {
  const { t, i18n } = useLingui();
  const [cr, setCr] = useState<ChangeRequest | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [editingWords, setEditingWords] = useState(false);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");

  const load = useCallback(() => {
    setFailed(null);
    fetch(`/api/change-requests/${encodeURIComponent(id)}`, { headers: headers() })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(await refusal(r, "")))))
      .then((b: ChangeRequest) => setCr(b))
      .catch((e) => setFailed(String(e?.message || "")));
  }, [id]);
  useEffect(() => {
    if (authToken()) load();
  }, [load]);

  /** One call to this change request; the answer replaces what the page shows. */
  const act: Act = async (path, method, body) => {
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/change-requests/${encodeURIComponent(id)}${path}`, {
      method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null);
    if (!res) {
      setError(t`That did not go through. Try again in a moment.`);
      return false;
    }
    if (!res.ok) {
      setError(await refusal(res, t({ message: "That was refused.", context: "a request the server refused" })));
      if (res.status === 409) load();
      return false;
    }
    const next = await res.json();
    if (next?.from && next?.id && path.endsWith("/split")) {
      setStatus(t`Moved into a change request of its own.`);
      load();
      return true;
    }
    if (next?.deleted) {
      window.location.assign(CHANGE_REQUESTS_HREF);
      return true;
    }
    setCr(next as ChangeRequest);
    setStatus(t({ message: "Saved.", context: "a change was saved" }));
    return true;
  };

  if (!authToken()) return <SignInLine />;
  if (failed !== null)
    return (
      <div className={panel} role="alert">
        <p className="text-base text-foreground">{failed || t`That did not load.`}</p>
        <button type="button" onClick={load} className={quiet}>
          <Trans context="retry a failed read">Try again</Trans>
        </button>
      </div>
    );
  if (!cr)
    return (
      <p className={HINT} role="status">
        <Trans context="a page loading">Loading…</Trans>
      </p>
    );

  const words = stepWords(i18n, cr.state);
  const ends = cr.review ? day(i18n, cr.review.endsAt) : "";
  const author = cr.author;
  const notes = cr.review?.notes ?? [];
  const top = notes.filter((x) => x.kind !== "answer");
  const count = cr.changes.length;
  const cap = cr.cap;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className={EYEBROW}>
          {cr.state === "in_review" && cr.review ? (
            <Trans context="change request: where it stands, in review">In review · review ends {ends}</Trans>
          ) : (
            words
          )}
        </p>
        <h1 className="break-words font-display text-3xl leading-tight text-foreground sm:text-4xl">{cr.title}</h1>
        <p className={HINT}>{cr.yours ? <Trans context="the reader started this change request">You started this</Trans> : <Trans context="who started a change request">Started by {author}</Trans>}</p>
        <StepStones state={cr.state} />
      </header>

      <Say text={error} alert />
      <Say text={status} />

      {cr.yours && cr.state === "gathering" && (
        <section className={`${CARD_FEATURED} space-y-3`} aria-labelledby="cr-next">
          <p className={EYEBROW}>
            <Trans context="change request: the author's next step, eyebrow">Your next step</Trans>
          </p>
          <h2 id="cr-next" className={heading}>
            <Trans>Ready for the village to review?</Trans>
          </h2>
          <ul className={`${HINT} list-disc space-y-1 pl-5`}>
            <li>
              <Trans context="change request: what review means">The village can ask, raise concerns and objections, and suggest edits.</Trans>
            </li>
            <li>
              <Trans context="change request: what review means">The people whose roles look after these settings are asked to look.</Trans>
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            {/* On a phone this act rides above the tab bar instead (the end of the page), so it is always in reach. */}
            <button type="button" className={`${primary} max-sm:hidden`} disabled={count === 0} onClick={() => void act("/open-review", "POST", { revision: cr.revision })}>
              <Trans context="open a change request for review">Open for review</Trans>
            </button>
            <button
              type="button"
              className={quiet}
              onClick={() => {
                if (window.confirm(t`Delete this change request? This cannot be undone.`)) void act(`?revision=${cr.revision}`, "DELETE");
              }}
            >
              <Trans context="delete a change request">Delete</Trans>
            </button>
          </div>
        </section>
      )}

      <section className={panel} aria-labelledby="cr-why">
        <p className={EYEBROW}>
          <Trans context="change request: the reason, eyebrow">The reason</Trans>
        </p>
        <h2 id="cr-why" className={heading}>
          <Trans context="the reason for a change request">Why</Trans>
        </h2>
        {editingWords ? (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act("", "PATCH", { title, why, revision: cr.revision })) {
                setEditingWords(false);
                load();
              }
            }}
          >
            <label className={`${LABEL} block`}>
              <Trans context="the name of a change request">Name</Trans>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} />
            </label>
            <label className={`${LABEL} block`}>
              <Trans context="the reason for a change request">Why</Trans>
              <VoiceArea value={why} onValue={setWhy}>
                <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={4000} rows={4} className={`${field} py-2`} />
              </VoiceArea>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={primary}>
                <Trans context="save a change">Save</Trans>
              </button>
              <button type="button" className={quiet} onClick={() => setEditingWords(false)}>
                <Trans context="close a form without saving">Not now</Trans>
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground">{cr.why}</p>
            {cr.yours && (cr.state === "gathering" || cr.state === "in_review") && (
              <button
                type="button"
                className={link}
                onClick={() => {
                  setTitle(cr.title);
                  setWhy(cr.why);
                  setEditingWords(true);
                }}
              >
                <Trans>Edit the name or the why</Trans>
              </button>
            )}
          </>
        )}
      </section>

      <section className={panel} aria-labelledby="cr-changes">
        <p className={EYEBROW}>
          <Trans context="change request: the changes, eyebrow">What changes</Trans>
        </p>
        <h2 id="cr-changes" className={heading}>
          <Trans context="heading of the list of changes">The changes</Trans>{" "}
          <span className="text-sm font-semibold text-muted-foreground">
            <Trans>
              ({count} of at most {cap})
            </Trans>
          </span>
        </h2>
        {count === 0 ? (
          <p className={HINT}>
            <Trans>
              No changes yet. Open any setting with a Suggest button, such as those in{" "}
              <Link href="/governance/how#mechanics-dials" className="font-medium text-notice underline underline-offset-2">
                Game Mechanics
              </Link>
              , and add it here.
            </Trans>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {cr.changes.map((c) => (
              <ChangeRow key={`${c.position}:${c.key}`} c={c} cr={cr} act={act} />
            ))}
          </ul>
        )}
        {cr.yours && cr.state === "in_review" && (
          <p className={HINT}>
            <Trans>Editing a change starts the review again.</Trans>
          </p>
        )}
      </section>

      {cr.review && (
        <section className={panel} aria-labelledby="cr-ready">
          <p className={EYEBROW}>
            <Trans context="change request: the checklist, eyebrow">What is still needed</Trans>
          </p>
          <h2 id="cr-ready" className={heading}>
            <Trans context="heading of the checklist">Before the vote</Trans>
          </h2>
          <ul className="space-y-2">
            {cr.review.checklist.map((l) => {
              const until = moment(i18n, cr.review!.endsAt);
              return (
                <li key={l.key} className={`${TILE} flex items-start gap-3 py-3 text-sm`}>
                  {l.done ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-open" aria-hidden="true" />
                  ) : (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-notice" aria-hidden="true" />
                  )}
                  <span>
                    <span className="font-semibold text-foreground">{checklistLabel(i18n, l.key)}:</span>{" "}
                    <span className="text-muted-foreground">{l.key === "review_time" && !l.done ? t({ message: `Waits until ${until}`, context: "when the review time ends" }) : l.words}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={HINT}>
            <Plural value={cr.review.consents} one="# person can live with this version." other="# people can live with this version." />
          </p>
        </section>
      )}

      {cr.review && (
        <section className={panel} aria-labelledby="cr-review">
          <p className={EYEBROW}>
            <Trans context="change request: the review, eyebrow">What the village said</Trans>
          </p>
          <h2 id="cr-review" className={heading}>
            <MessageSquare className="h-5 w-5 text-notice" aria-hidden="true" /> <Trans context="heading of the review feed">The review</Trans>
          </h2>
          {top.length === 0 ? (
            <p className={HINT}>
              <Trans>Nobody has written yet.</Trans>
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {top.map((x) => (
                <NoteItem key={x.id} n={x} cr={cr} notes={notes} act={act} />
              ))}
            </ul>
          )}
          {cr.state === "in_review" && <ReviewForm cr={cr} act={act} />}
        </section>
      )}

      {/* THE ONE ACT, IN REACH ON A PHONE (as /roles keeps its apply act): while the author gathers, "Open for review"
          sticks above the tab bar from the first screen to the last. From sm up it sits in its panel above. */}
      {cr.yours && cr.state === "gathering" && (
        <div data-hides-fab-phone="" className="sticky bottom-[calc(var(--tabbar-h,0px)+0.75rem)] z-10 sm:hidden" data-testid="cr-phone-act">
          <button type="button" className={`${primary} w-full shadow-sm`} disabled={count === 0} onClick={() => void act("/open-review", "POST", { revision: cr.revision })}>
            <Trans context="open a change request for review">Open for review</Trans>
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChangeRequestPage() {
  const [, params] = useRoute("/governance/decisions/changes/:id");
  const id = params?.id ?? "";
  return (
    <Layout>
      <div className={WORLD}>
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28 sm:py-12">
          <GovernanceTabs signedIn={!!authToken()} />
          <Link href={CHANGE_REQUESTS_HREF} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-notice hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> <Trans context="link back to the list">All change requests</Trans>
          </Link>
          <DetailPage id={id} />
        </div>
      </div>
    </Layout>
  );
}
