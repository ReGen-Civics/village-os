/**
 * ONE PROPOSED CHANGE, AS A CARD (the lead, 16 Nov 2026). Drawn in the role card's hand: the kind in a gold-edged
 * tile with its icon, the change in one sentence, where it lands with a door to see that page live, the plain
 * flags, then the change itself as before and after:
 *
 *   page words, a role card, a setting   the fields it touches, changed ones only, word by word
 *   season priorities                    the goals row by row: kept, moved, reworded, added, taken out
 *   a calendar event                     a small event card, in village time
 *   an FAQ taken down                    the question as it reads now, struck
 *
 * Three acts: Accept (through its own route, as the reader), Edit words (today's editor, in place) and Discard.
 * A change that did not land keeps its reason on the card, in the route's own words.
 *
 * `DecidedCard` is the same card in the history: what went live (and what the reader changed first), or what was
 * put aside, who decided and when.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ExternalLink, History as HistoryIcon, TriangleAlert, PenLine, Undo2, UserRound, X } from "lucide-react";
import { Firefly } from "@/components/sacred/living";
import type { I18n, MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP_SOFT, HINT, LINK } from "@/components/journey/look";
import { agendaLines, faceOf, fieldChanges, flagsOf, goalLines, type ChangeFace, type ChangeFlag } from "@shared/proposalReview";
import { fieldDiffs, valueAt } from "@shared/proposedChanges";
import type { PutBackBlock } from "@shared/proposalPutBack";
import type { ConflictWith, StaleBy } from "@shared/proposalConflicts";
import CodeChip from "./CodeChip";
import { EventCard, FieldDiffs, RowsDiff } from "./Diff";
import { FACE_ICON, FLAG_ICON } from "./faces";
import { Field, asText, nodePaths } from "./ProposalEditor";
import type { Decided, Problem, Proposal, Where } from "./reviewTypes";

/** What each kind of change and each flag is called, keyed by the unions so a new one fails the compiler. */
const FACE_WORDS: Record<ChangeFace, MessageDescriptor> = {
  page_words: msg({ message: "Page words", context: "proposed changes: kind of change" }),
  role_card: msg({ message: "Role card", context: "proposed changes: kind of change" }),
  faq: msg({ message: "FAQ", context: "proposed changes: kind of change" }),
  village_setting: msg({ message: "Village setting", context: "proposed changes: kind of change" }),
  module: msg({ message: "Module", context: "proposed changes: kind of change" }),
  listed_roles: msg({ message: "Listed roles", context: "proposed changes: kind of change" }),
  season_priorities: msg({ message: "Season priorities", context: "proposed changes: kind of change" }),
  onboarding: msg({ message: "Onboarding path", context: "proposed changes: kind of change" }),
  calendar_event: msg({ message: "Calendar event", context: "proposed changes: kind of change" }),
  meeting_agenda: msg({ message: "Meeting agenda", context: "proposed changes: kind of change" }),
  admin_setting: msg({ message: "Admin setting", context: "proposed changes: kind of change" }),
};

export const faceWords = (i18n: I18n, face: ChangeFace): string => i18n._(FACE_WORDS[face]);

const FLAG_WORDS: Record<ChangeFlag, MessageDescriptor> = {
  whole_document: msg({ message: "Replaces the whole document", context: "proposed changes: flag" }),
  public_page: msg({ message: "Public page", context: "proposed changes: flag" }),
  money_words: msg({ message: "Affects money words", context: "proposed changes: flag" }),
  calendar_event: msg({ message: "Creates a calendar event", context: "proposed changes: flag" }),
  priorities_links: msg({ message: "Changes priorities and their links", context: "proposed changes: flag" }),
};

/** Why "Propose putting it back" is not offered, keyed by the union so a new reason fails the compiler. */
const PUT_BACK_WORDS: Record<PutBackBlock, MessageDescriptor> = {
  not_accepted: msg({ message: "Only an accepted change can be proposed back.", context: "proposed changes: put back" }),
  not_kept: msg({ message: "This change was accepted before the page kept what was live, so there is nothing to put back.", context: "proposed changes: put back" }),
  unread: msg({ message: "What was live before could not be read when this was accepted, so there is nothing to put back.", context: "proposed changes: put back" }),
  made_new: msg({ message: "This change made something new. Taking it away is its own change, on its own page.", context: "proposed changes: put back" }),
  took_away: msg({ message: "This change took something away. Making it again is its own change, on its own page.", context: "proposed changes: put back" }),
  goal_links: msg({ message: "Season goals carry links to quests and moon items, and putting the list back could cut them. Change the goals in Admin, Season.", context: "proposed changes: put back" }),
  added_fields: msg({ message: "This change set fields that were not there before, and putting it back cannot take them away. Change them on the page itself.", context: "proposed changes: put back" }),
  already_waiting: msg({ message: "A proposal putting this back is already waiting above.", context: "proposed changes: put back" }),
};

export const putBackWords = (i18n: I18n, reason: PutBackBlock): string => i18n._(PUT_BACK_WORDS[reason]);

export const flagWords = (i18n: I18n, flag: ChangeFlag): string => i18n._(FLAG_WORDS[flag]);

export function dayWords(iso: string | null | undefined, zone: string, locale?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: zone }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/** The kind's tile, as the role card draws a piece's icon. */
export function FaceTile({ face, size = "md" }: { face: ChangeFace; size?: "sm" | "md" }) {
  const Icon = FACE_ICON[face];
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl border border-notice/50 bg-card text-notice ${size === "sm" ? "size-8" : "size-11"}`} aria-hidden="true">
      <Icon className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}

export function Flags({ flags }: { flags: ChangeFlag[] }) {
  const { i18n } = useLingui();
  if (!flags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="change-flags">
      {flags.map((f) => {
        const Icon = FLAG_ICON[f];
        return (
          <li key={f} className="inline-flex items-center gap-1.5 rounded-full border border-notice/50 px-2.5 py-1 text-xs font-semibold text-notice" data-flag={f}>
            <Icon className="size-3.5" aria-hidden="true" />
            {flagWords(i18n, f)}
          </li>
        );
      })}
    </ul>
  );
}

function WhereLine({ where, targetLabel: given }: { where?: Where; targetLabel: string }) {
  // A setting's label is its route ("/api/admin/events"), which says nothing to a reader: the page name is enough.
  const targetLabel = given.startsWith("/api/") ? "" : given;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span>
        {where ? <Trans context="proposed changes">Lands on {where.label}</Trans> : null}
        {where && targetLabel && targetLabel !== where.label ? <span>{` · ${targetLabel}`}</span> : !where ? targetLabel : null}
      </span>
      {where?.href && (
        <a href={where.href} target="_blank" rel="noopener noreferrer" className={`${LINK} inline-flex min-h-11 items-center gap-1`} data-testid="see-live">
          <Trans context="proposed changes">See it live</Trans>
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </p>
  );
}

function Head({ face, summary, targetLabel, where, flags, aside, code }: { face: ChangeFace; summary: string; targetLabel: string; where?: Where; flags: ChangeFlag[]; aside?: ReactNode; code?: string | null }) {
  const { i18n } = useLingui();
  return (
    <div className="relative flex min-w-0 items-start gap-3">
      {code && <CodeChip code={code} className="absolute -top-1 right-0" />}
      <FaceTile face={face} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className={`text-xs font-semibold uppercase tracking-widest text-notice ${code ? "pr-24" : ""}`} data-testid="change-kind">{faceWords(i18n, face)}</p>
        <h3 className={`break-words font-display text-xl leading-snug text-card-foreground ${code ? "sm:pr-24" : ""}`}>{summary}</h3>
        <WhereLine where={where} targetLabel={targetLabel} />
        <Flags flags={flags} />
        {aside}
      </div>
    </div>
  );
}

/** How a proposed agenda item asks to be held, keyed by the kind's words; anything else reads as written. */
const AGENDA_KIND_WORDS: Record<string, MessageDescriptor> = {
  consent: msg({ message: "For consent", context: "proposed changes: agenda item kind" }),
  decision: msg({ message: "For a decision", context: "proposed changes: agenda item kind" }),
  discussion: msg({ message: "For discussion", context: "proposed changes: agenda item kind" }),
};

/** A proposed agenda: each item as it would wait for its meeting (the meeting is named in the card's head). */
function AgendaItems({ body }: { body: Record<string, unknown> }) {
  const { i18n } = useLingui();
  const items = agendaLines(body);
  if (!items.length) {
    return (
      <p className="text-sm italic text-muted-foreground">
        <Trans context="proposed changes">No agenda items yet</Trans>
      </p>
    );
  }
  return (
    <ol className="grid gap-2" data-testid="agenda-items">
      {items.map((it, i) => (
        <li key={i} className="rounded-xl border border-border bg-muted p-3">
          <p className="break-words font-semibold text-foreground">{it.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className={CHIP_SOFT}>{AGENDA_KIND_WORDS[it.kind] ? i18n._(AGENDA_KIND_WORDS[it.kind]) : it.kind}</span>
            {it.ownerRole && <span>{i18n._(msg({ message: `Owner role: ${it.ownerRole}`, context: "proposed changes: agenda item" }))}</span>}
          </p>
          {it.detail && <p className="mt-1 whitespace-pre-line break-words text-sm text-foreground">{it.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

/** The change itself, as before and after, chosen by what it is. `before` is what is live; `after` what would be. */
function ChangeBody({ face, kind, before, after, labels, zone, whole, plain }: { face: ChangeFace; kind: string; before: unknown; after: Record<string, unknown>; labels: Record<string, string>; zone: string; whole: boolean; plain?: boolean }) {
  if (kind === "faq_remove") {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-3 sm:p-4" data-testid="faq-taken-down">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-destructive">
          <Trans context="proposed changes">Taken down if you accept</Trans>
        </p>
        <p className="break-words text-muted-foreground line-through decoration-destructive decoration-2">{asText(valueAt(before, "question"))}</p>
      </div>
    );
  }
  if (face === "season_priorities") {
    const b = goalLines(before).map((g) => g.text);
    const a = goalLines(after).map((g) => g.text);
    return plain ? <RowsDiff before={a} after={a} testId="goals-diff" /> : <RowsDiff before={b} after={a} testId="goals-diff" />;
  }
  if (face === "meeting_agenda") return <AgendaItems body={after} />;
  if (face === "calendar_event") {
    const changes = before && typeof before === "object" && !plain ? fieldChanges(before, after).filter((f) => f.changed) : [];
    return (
      <div className="space-y-3">
        <EventCard body={after} zone={zone} />
        {changes.length > 0 && <FieldDiffs fields={fieldChanges(before, after)} labels={labels} />}
      </div>
    );
  }
  return <FieldDiffs fields={plain ? fieldChanges(null, after).map((f) => ({ ...f, changed: true })) : fieldChanges(before, after, whole)} labels={labels} plain={plain} testId="field-diffs" />;
}

/**
 * What else writes what this change writes (shared/proposalConflicts.ts): each waiting change it collides with, and
 * each accept since it was proposed. Named plainly; the person decides which goes live.
 */
export function ConflictFlags({ conflicts, stale }: { conflicts: readonly ConflictWith[]; stale: readonly StaleBy[] }) {
  if (!conflicts.length && !stale.length) return null;
  return (
    <ul className="space-y-2" data-testid="conflict-flags">
      {conflicts.map((o) => {
        const other = o.summary;
        return (
          <li key={`c-${o.id}`} className="flex items-start gap-2 rounded-xl border border-notice/50 bg-notice/10 px-3 py-2 text-sm text-foreground" data-conflict={o.id} data-later={o.later ? "1" : "0"}>
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-notice" aria-hidden="true" />
            <span>
              {o.later ? (
                <Trans context="proposed changes: conflict">Also changed by “{other}”, proposed later. Accept one, then look again.</Trans>
              ) : (
                <Trans context="proposed changes: conflict">Also changed by “{other}”, proposed earlier. Accept one, then look again.</Trans>
              )}
            </span>
          </li>
        );
      })}
      {stale.map((s) => {
        const other = s.summary;
        return (
          <li key={`s-${s.id}`} className="flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-foreground" data-stale={s.id}>
            <HistoryIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <span>
              <Trans context="proposed changes: conflict">Drafted before “{other}” was accepted. Accepting it would put back older words.</Trans>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export interface ChangeCardProps {
  /** The other waiting changes that write what this one writes. */
  conflicts?: readonly ConflictWith[];
  change: Proposal;
  /** The search on the page names this card: it is ringed. */
  found?: boolean;
  body: Record<string, unknown>;
  zone: string;
  problems: Problem[];
  saved?: "saving" | "saved" | "failed";
  busy: boolean;
  checkedPage: boolean;
  onCheckedPage: (v: boolean) => void;
  onEdit: (path: string, next: unknown) => void;
  onAccept: () => void;
  onDiscard: () => void;
}

export default function ChangeCard({ change: c, found = false, conflicts = [], body, zone, problems, saved, busy, checkedPage, onCheckedPage, onEdit, onAccept, onDiscard }: ChangeCardProps) {
  const { t } = useLingui();
  const [editing, setEditing] = useState(false);
  // Accepting a change that a later waiting one also writes asks once, on the card. It never blocks.
  const [confirming, setConfirming] = useState(false);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) yes.current?.focus();
  }, [confirming]);
  const laterConflict = conflicts.some((o) => o.later);
  const [json, setJson] = useState(false);
  const face = faceOf(c.kind, c.route);
  const flags = flagsOf(c.kind, c.route, c.target, body);
  const whole = flags.includes("whole_document");
  const edited = JSON.stringify(body) !== JSON.stringify(c.body);
  const shown = nodePaths(body);
  const loose = problems.filter((p) => !p.field || !shown.has(p.field) || !editing);
  const editable = c.kind !== "faq_remove";
  const editorId = `edit-${c.id}`;

  return (
    <article className={`min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5 ${found ? "border-notice ring-2 ring-notice" : "border-border"}`} data-proposal={c.id} data-code={c.code ?? undefined} data-found={found ? "true" : undefined} id={`proposal-${c.id}`} data-testid={`proposal-${c.id}`} aria-label={c.summary}>
      <Head
        code={c.code}
        face={face}
        summary={c.summary}
        targetLabel={c.targetLabel}
        where={c.where}
        flags={flags}
        aside={
          <p className={HINT}>
            {c.reverts && (
              <span className={`${CHIP_SOFT} mr-2`} data-testid="puts-back">
                <Undo2 className="size-3.5" aria-hidden="true" />
                <Trans context="proposed changes">Puts back an earlier change</Trans>
              </span>
            )}
            {edited && (
              <span className={`${CHIP_SOFT} mr-2`}>
                <Trans context="proposed changes">Edited by you</Trans>
              </span>
            )}
            {saved === "saving" && <Trans context="proposed changes">Saving your edits</Trans>}
            {saved === "saved" && <Trans context="proposed changes">Edits saved</Trans>}
            {saved === "failed" && (
              <span className="text-destructive">
                <Trans context="proposed changes">Edits not saved</Trans>
              </span>
            )}
          </p>
        }
      />

      <ConflictFlags conflicts={conflicts} stale={c.stale ?? []} />

      {c.status === "failed" && c.error && !problems.length && (
        <p role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="last-try">
          <Trans context="proposed changes">Last try did not land: {c.error}</Trans>
        </p>
      )}
      {c.status === "unknown" && (
        <div role="alert" className="space-y-2 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {c.error && <p>{c.error}</p>}
          <label className="flex min-h-11 items-center gap-2 text-foreground">
            <input type="checkbox" className="size-5 accent-notice" checked={checkedPage} onChange={(e) => onCheckedPage(e.target.checked)} />
            <Trans context="proposed changes">I checked its page, and this change is not there yet</Trans>
          </label>
        </div>
      )}
      {loose.map((p, i) => (
        <p key={i} role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {p.error}
        </p>
      ))}

      {editing ? (
        <div id={editorId} className="rounded-xl border border-notice/40 p-3 sm:p-4">
          <Field path="" value={body} proposed={c.body} live={c.live} labels={c.labels} problems={problems} onChange={onEdit} depth={0} idPrefix={c.id} />
        </div>
      ) : (
        <ChangeBody face={face} kind={c.kind} before={c.live} after={body} labels={c.labels} zone={zone} whole={whole} />
      )}

      {confirming && (
        <div className="space-y-3 rounded-xl border border-notice/60 bg-card p-4" role="group" aria-label={t({ message: "Confirm accepting this change", context: "proposed changes: conflict" })} data-testid={`conflict-confirm-${c.id}`}>
          <p className="font-semibold text-card-foreground">
            <Trans context="proposed changes: conflict">A later change also edits this. Accept this one anyway?</Trans>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              ref={yes}
              type="button"
              className={BTN_PRIMARY}
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                onAccept();
              }}
              data-testid={`conflict-confirm-yes-${c.id}`}
            >
              <Trans context="proposed changes: conflict">Yes, accept</Trans>
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setConfirming(false)} data-testid={`conflict-confirm-no-${c.id}`}>
              <Trans context="proposed changes: conflict">Not yet</Trans>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button type="button" className={BTN_PRIMARY} disabled={busy || (c.status === "unknown" && !checkedPage)} onClick={() => (laterConflict ? setConfirming(true) : onAccept())} data-testid={`accept-${c.id}`}>
          <Check className="size-4" aria-hidden="true" />
          {busy ? <Trans context="proposed changes">Working</Trans> : <Trans context="proposed changes">Accept</Trans>}
        </button>
        {editable && (
          <button type="button" className={BTN_SECONDARY} onClick={() => setEditing((e) => !e)} aria-expanded={editing} aria-controls={editorId} data-testid={`edit-${c.id}`}>
            <PenLine className="size-4" aria-hidden="true" />
            {editing ? <Trans context="proposed changes">Done editing</Trans> : <Trans context="proposed changes">Edit words</Trans>}
          </button>
        )}
        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={onDiscard} data-testid={`discard-${c.id}`}>
          <X className="size-4" aria-hidden="true" />
          <Trans context="proposed changes">Discard</Trans>
        </button>
        <button type="button" className={`${LINK} ml-auto inline-flex min-h-11 items-center text-sm`} onClick={() => setJson((j) => !j)} aria-expanded={json}>
          {json ? <Trans context="proposed changes">Hide JSON</Trans> : <Trans context="proposed changes">Show JSON</Trans>}
        </button>
      </div>
      {json && (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground" aria-label={t({ message: "The change as JSON", context: "proposed changes" })}>
          {`${c.route.method} ${c.route.path}\n${JSON.stringify(body, null, 2)}`}
        </pre>
      )}
    </article>
  );
}

/** Who proposed it, in words: an agent account named whole, a person by first name. */
export function ByWho({ name, kind }: { name: string; kind?: "agent" | "person" }) {
  const Icon = kind === "agent" ? Firefly : UserRound;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-notice" aria-hidden="true" />
      {kind === "agent" ? <Trans context="proposed changes">{name}, an agent</Trans> : name}
    </span>
  );
}

/** The put-back row on an accepted change: the action, or one plain line saying why there is none. */
function PutBack({ d, onPutBack }: { d: Decided; onPutBack?: (d: Decided) => Promise<string | null> }) {
  const { i18n } = useLingui();
  const [state, setState] = useState<"idle" | "filing" | "filed">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const verdict = d.putBack ?? { can: false as const, reason: "not_kept" as const };
  // Once filed, the reload marks it as waiting; the reader still sees what they just did.
  if (!verdict.can && state !== "filed") {
    return (
      <p className={`${HINT} border-t border-border pt-4`} data-testid="put-back-none" data-reason={verdict.reason}>
        {putBackWords(i18n, verdict.reason)}
      </p>
    );
  }
  const file = async () => {
    if (!onPutBack) return;
    setState("filing");
    setProblem(null);
    const err = await onPutBack(d);
    if (err) {
      setProblem(err);
      setState("idle");
    } else setState("filed");
  };
  return (
    <div className="space-y-2 border-t border-border pt-4">
      {state === "filed" ? (
        <p className="text-sm text-open" role="status" data-testid="put-back-filed">
          <Trans context="proposed changes">Filed. It waits above like any other change, and nothing moves until someone accepts it.</Trans>
        </p>
      ) : (
        <>
          <button type="button" className={BTN_SECONDARY} disabled={state === "filing" || !onPutBack} onClick={() => void file()} data-testid={`put-back-${d.id}`}>
            <Undo2 className="size-4" aria-hidden="true" />
            {state === "filing" ? <Trans context="proposed changes">Filing</Trans> : <Trans context="proposed changes">Propose putting it back</Trans>}
          </button>
          <p className={HINT}>
            <Trans context="proposed changes">This files a new proposal with what was live before. Nothing changes until someone accepts it.</Trans>
          </p>
        </>
      )}
      {problem && (
        <p role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

/** A decided change, in the history. */
export function DecidedCard({ d, zone, onPutBack, found = false }: { d: Decided; zone: string; found?: boolean; onPutBack?: (d: Decided) => Promise<string | null> }) {
  const { i18n } = useLingui();
  const route = d.route ?? { method: "PUT", path: "" };
  const kind = d.kind ?? "setting";
  const face = faceOf(kind, route);
  const proposed = d.body ?? {};
  const accepted = d.accepted ?? null;
  const took = d.status === "accepted";
  const flags = flagsOf(kind, route, d.target ?? {}, accepted ?? proposed);
  const when = dayWords(d.at, zone, i18n.locale);
  const editedFields = took && accepted ? fieldDiffs(proposed, accepted).length : 0;
  return (
    <article className={`min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5 ${found ? "border-notice ring-2 ring-notice" : "border-border/60"}`} id={`decided-${d.id}`} data-code={d.code ?? undefined} data-found={found ? "true" : undefined} data-testid={`decided-${d.id}`} aria-label={d.summary}>
      <Head
        code={d.code}
        face={face}
        summary={d.summary}
        targetLabel={d.targetLabel}
        where={d.where}
        flags={flags}
        aside={
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${took ? "bg-open/15 text-open" : "border border-border bg-muted text-muted-foreground"}`} data-testid="decided-status">
              {took ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
              {took ? <Trans context="proposed changes">Accepted by {d.by}</Trans> : <Trans context="proposed changes">Discarded by {d.by}</Trans>}
            </span>
            <span className="text-muted-foreground">{when}</span>
            {took && d.edited > 0 && (
              <span className={CHIP_SOFT}>
                <Trans context="proposed changes">Edited before it went live</Trans>
              </span>
            )}
          </p>
        }
      />
      {d.error && (
        <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="decided-error">
          <Trans context="proposed changes">It did not land: {d.error}</Trans>
        </p>
      )}
      {took && accepted && editedFields > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Trans context="proposed changes">Proposed, then edited before it went live</Trans>
          </p>
          <ChangeBody face={face} kind={kind} before={proposed} after={accepted} labels={d.labels ?? {}} zone={zone} whole={false} />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {took ? <Trans context="proposed changes">What went live</Trans> : <Trans context="proposed changes">What was proposed</Trans>}
          </p>
          {kind === "faq_remove" ? (
            <p className="text-foreground">
              <Trans context="proposed changes">The FAQ comes down.</Trans>
            </p>
          ) : (
            <ChangeBody face={face} kind={kind} before={null} after={(took ? accepted : null) ?? proposed} labels={d.labels ?? {}} zone={zone} whole={false} plain />
          )}
        </div>
      )}
      {took && <PutBack d={d} onPutBack={onPutBack} />}
    </article>
  );
}
