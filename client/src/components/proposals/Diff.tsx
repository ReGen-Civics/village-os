/**
 * Before and after, as the review page draws them (shared/proposalReview.ts reads them):
 *
 *   WordDiff     a text, word by word: taken-out words struck and dimmed, new words lit gold.
 *   FieldDiffs   the fields a change touches, changed ones only until "Show everything".
 *   RowsDiff     a list row by row: kept, moved (with where from), reworded (with the words that changed),
 *                added, taken out.
 *   EventCard    a calendar event as a small card: its title, when in village time, how it repeats, its link
 *                and whether it is on the calendar or a draft.
 *
 * Colour is the sheet's tokens only: struck words in muted ink with a warn-coloured line, new words on a soft
 * gold ground, so the change reads in the night world and never by colour alone (struck is struck, new is
 * underlined).
 */
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, CalendarDays, Clock, ExternalLink, Repeat } from "lucide-react";
import { SeedPin } from "@/components/sacred/living";
import { Trans, useLingui } from "@lingui/react/macro";
import { CHIP_SOFT, LINK } from "@/components/journey/look";
import { fieldLabel } from "@shared/proposedChanges";
import { describeRecurrence, type Recurrence } from "@shared/gatherings";
import { listDiff, wordDiff, type FieldChange, type RowDiff, type Seg } from "@shared/proposalReview";
import { asText, isWordList } from "./ProposalEditor";

const DEL = "text-muted-foreground line-through decoration-destructive decoration-2";
const ADD = "bg-notice/20 text-foreground underline decoration-notice/70 decoration-1 underline-offset-4";

/** One text's change, word by word. */
export function WordDiff({ segs }: { segs: Seg[] }) {
  return (
    <p className="max-w-prose whitespace-pre-wrap break-words text-base leading-relaxed text-foreground" data-word-diff="">
      {segs.map((s, i) =>
        s.op === "same" ? (
          <span key={i}>{s.text}</span>
        ) : s.op === "del" ? (
          // Struck words run straight into the new ones otherwise ("canwill"): a small gap keeps them apart.
          <del key={i} className={segs[i + 1]?.op === "add" ? `${DEL} mr-1` : DEL}>
            {s.text}
          </del>
        ) : (
          <ins key={i} className={ADD}>
            {s.text}
          </ins>
        ),
      )}
    </p>
  );
}

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** A row of a list, as it changes. */
function Row({ r }: { r: RowDiff }) {
  const { t } = useLingui();
  const mark =
    r.op === "moved"
      ? r.from && r.to && r.to < r.from
        ? t({ message: `Moved up from ${r.from}`, context: "proposed changes: a list row" })
        : t({ message: `Moved down from ${r.from}`, context: "proposed changes: a list row" })
      : r.op === "reworded"
        ? t({ message: "Reworded", context: "proposed changes: a list row" })
        : r.op === "added"
          ? t({ message: "New", context: "proposed changes: a list row" })
          : r.op === "removed"
            ? t({ message: "Taken out", context: "proposed changes: a list row" })
            : null;
  const Arrow = r.op === "moved" ? (r.from && r.to && r.to < r.from ? ArrowUp : ArrowDown) : null;
  return (
    <li className={`flex min-w-0 gap-3 rounded-xl border p-3 ${r.op === "same" ? "border-border/60" : r.op === "removed" ? "border-destructive/50 bg-destructive/5" : "border-notice/50 bg-muted"}`} data-row-op={r.op}>
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-xs font-semibold text-muted-foreground" aria-hidden="true">
        {r.op === "removed" ? "" : r.to}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {r.op === "reworded" ? (
          <WordDiff segs={wordDiff(r.before ?? "", r.text)} />
        ) : r.op === "removed" ? (
          <p className={`break-words ${DEL}`}>{r.text}</p>
        ) : r.op === "added" ? (
          <p className="break-words">
            <ins className={ADD}>{r.text}</ins>
          </p>
        ) : (
          <p className="break-words leading-relaxed text-foreground">{r.text}</p>
        )}
        {mark && (
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-notice">
            {Arrow && <Arrow className="size-3.5" aria-hidden="true" />}
            {mark}
          </p>
        )}
      </div>
    </li>
  );
}

/** A list of lines, row by row. */
export function RowsDiff({ before, after, testId }: { before: string[]; after: string[]; testId?: string }) {
  const rows = listDiff(before, after);
  if (!rows.length) {
    return (
      <p className="text-sm italic text-muted-foreground">
        <Trans context="proposed changes">Nothing set yet</Trans>
      </p>
    );
  }
  return (
    <ol className="grid gap-2" data-testid={testId}>
      {rows.map((r, i) => (
        <Row key={`${r.op}-${i}`} r={r} />
      ))}
    </ol>
  );
}

/** One value as it changes: words word by word, a list row by row, anything else before and after. */
export function ValueDiff({ before, after }: { before: unknown; after: unknown }) {
  if (isWordList(before) || isWordList(after)) {
    const b = isWordList(before) ? before.map(asText) : isBlank(before) ? [] : [asText(before)];
    const a = isWordList(after) ? after.map(asText) : isBlank(after) ? [] : [asText(after)];
    return <RowsDiff before={b} after={a} />;
  }
  if (typeof before === "string" || typeof after === "string" || isBlank(before) || isBlank(after)) {
    if (isBlank(before) && isBlank(after)) return <Empty />;
    return <WordDiff segs={wordDiff(asText(before), asText(after))} />;
  }
  return (
    <p className="flex flex-wrap items-center gap-2 break-words text-base text-foreground">
      <del className={DEL}>{asText(before)}</del>
      <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
      <ins className={ADD}>{asText(after)}</ins>
    </p>
  );
}

function Empty() {
  return (
    <p className="text-sm italic text-muted-foreground">
      <Trans context="proposed changes">Nothing set yet</Trans>
    </p>
  );
}

/** One value, read plainly (the history's "what went live"). */
export function PlainValue({ value }: { value: unknown }) {
  if (isBlank(value)) return <Empty />;
  if (isWordList(value)) {
    return (
      <ul className="max-w-prose list-disc space-y-1 pl-5 leading-relaxed text-foreground marker:text-notice">
        {value.map((x, i) => (
          <li key={i} className="break-words">{asText(x)}</li>
        ))}
      </ul>
    );
  }
  return <p className="max-w-prose whitespace-pre-wrap break-words leading-relaxed text-foreground">{asText(value)}</p>;
}

const labelFor = (labels: Record<string, string>, path: string) => labels[path] ?? fieldLabel(path.split(".").slice(-2).join("."));

/**
 * The fields a change touches. Changed ones show first and alone; "Show everything" opens the rest, dimmed.
 * `plain` draws values without a diff (a history entry that went live as proposed).
 */
export function FieldDiffs({ fields, labels, plain = false, testId }: { fields: FieldChange[]; labels: Record<string, string>; plain?: boolean; testId?: string }) {
  const [all, setAll] = useState(false);
  const changed = plain ? fields : fields.filter((f) => f.changed);
  const quiet = plain ? [] : fields.filter((f) => !f.changed);
  const shown = all ? [...changed, ...quiet] : changed;
  return (
    <div className="space-y-3" data-testid={testId}>
      {changed.length === 0 && (
        <p className="text-sm text-muted-foreground">
          <Trans context="proposed changes">This matches what is live now.</Trans>
        </p>
      )}
      <dl className="grid gap-3">
        {shown.map((f) => {
          const taken = !plain && f.changed && isBlank(f.after) && !isBlank(f.before);
          const fresh = !plain && f.changed && isBlank(f.before) && !isBlank(f.after);
          return (
            <div key={f.path} className={`min-w-0 rounded-xl border p-3 sm:p-4 ${f.changed || plain ? "border-border bg-muted" : "border-border/60"}`} data-field-diff={f.path} data-changed={f.changed ? "yes" : "no"}>
              <dt className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                {labelFor(labels, f.path)}
                {taken && (
                  <span className={CHIP_SOFT}>
                    <Trans context="proposed changes: a field">Taken out</Trans>
                  </span>
                )}
                {fresh && (
                  <span className={CHIP_SOFT}>
                    <Trans context="proposed changes: a field">New</Trans>
                  </span>
                )}
                {!plain && !f.changed && (
                  <span className={CHIP_SOFT}>
                    <Trans context="proposed changes: a field">Unchanged</Trans>
                  </span>
                )}
              </dt>
              <dd className="min-w-0">{plain || !f.changed ? <PlainValue value={plain ? f.after : f.before} /> : <ValueDiff before={f.before} after={f.after} />}</dd>
            </div>
          );
        })}
      </dl>
      {quiet.length > 0 && (
        <button type="button" className={`${LINK} inline-flex min-h-11 items-center text-sm`} onClick={() => setAll((a) => !a)} aria-expanded={all}>
          {all ? <Trans context="proposed changes">Show only what changes</Trans> : <Trans context="proposed changes">Show everything ({quiet.length} unchanged)</Trans>}
        </button>
      )}
    </div>
  );
}

// ── A calendar event ────────────────────────────────────────────────────────

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function viewerZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** A time in the village's zone, the zone named when it is not the reader's. */
export function villageWhen(iso: string, zone: string, locale?: string, allDay = false, how: { timeOnly?: boolean; named?: boolean } = {}): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = allDay
    ? { weekday: "short", month: "short", day: "numeric", year: "numeric" }
    : how.timeOnly
      ? { hour: "numeric", minute: "2-digit" }
      : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  let text: string;
  try {
    text = new Intl.DateTimeFormat(locale, { ...opts, timeZone: zone }).format(d);
  } catch {
    text = d.toUTCString();
  }
  return zone === viewerZone() || allDay || how.named === false ? text : `${text} (${zone.split("/").pop()?.replace(/_/g, " ") ?? zone})`;
}

/** Whether two instants fall on the same day in the village's zone. */
function sameVillageDay(a: string, b: string, zone: string): boolean {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone });
    return f.format(new Date(a)) === f.format(new Date(b));
  } catch {
    return false;
  }
}

function dayBlock(iso: string, zone: string, locale?: string): { month: string; day: string } | null {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  try {
    return {
      month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: zone }).format(d),
      day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: zone }).format(d),
    };
  } catch {
    return null;
  }
}

/** A calendar event as a small card. `body` is the event as proposed (or accepted). */
export function EventCard({ body, zone }: { body: Record<string, unknown>; zone: string }) {
  const { i18n, t } = useLingui();
  const title = str(body.title) || t({ message: "A gathering with no title yet", context: "proposed changes" });
  const starts = str(body.startsAt);
  const ends = str(body.endsAt);
  const allDay = body.allDay === true;
  const block = dayBlock(starts, zone, i18n.locale);
  let repeats: string | null = null;
  try {
    repeats = body.recurrence && typeof body.recurrence === "object" ? describeRecurrence(body.recurrence as Recurrence) : null;
  } catch {
    repeats = null;
  }
  const link = str(body.link) || str(body.onlineUrl);
  const where = str(body.locationText);
  const status = str(body.status);
  const statusWords: ReactNode =
    status === "draft" ? (
      <Trans context="proposed changes: event status">Draft, not on the calendar yet</Trans>
    ) : status === "cancelled" ? (
      <Trans context="proposed changes: event status">Cancelled</Trans>
    ) : status ? (
      <Trans context="proposed changes: event status">On the calendar</Trans>
    ) : null;
  return (
    <div className="flex min-w-0 gap-4 rounded-xl border border-notice/40 bg-muted p-4" data-testid="event-card">
      <div className="grid w-16 shrink-0 place-items-center self-start rounded-xl border-2 border-notice px-2 py-2 text-center text-notice" aria-hidden="true">
        {block ? (
          <>
            <span className="text-xs font-semibold uppercase tracking-widest">{block.month}</span>
            <span className="font-display text-2xl leading-tight">{block.day}</span>
          </>
        ) : (
          <CalendarDays className="size-6" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="break-words font-display text-xl leading-snug text-card-foreground">{title}</p>
        <ul className="space-y-1 text-sm text-foreground">
          {starts && (
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-notice" aria-hidden="true" />
              <span className="break-words">
                {ends && !allDay ? (
                  <Trans context="proposed changes: an event's time">
                    {villageWhen(starts, zone, i18n.locale, false, { named: false })} until{" "}
                    {villageWhen(ends, zone, i18n.locale, false, { timeOnly: sameVillageDay(starts, ends, zone) })}
                  </Trans>
                ) : (
                  villageWhen(starts, zone, i18n.locale, allDay)
                )}
              </span>
            </li>
          )}
          {repeats && (
            <li className="flex items-start gap-2">
              <Repeat className="mt-0.5 size-4 shrink-0 text-notice" aria-hidden="true" />
              <span>{repeats}</span>
            </li>
          )}
          {where && (
            <li className="flex items-start gap-2">
              <SeedPin className="mt-0.5 size-4 shrink-0 text-notice" aria-hidden="true" />
              <span className="break-words">{where}</span>
            </li>
          )}
          {link && (
            <li className="flex min-w-0 items-start gap-2">
              <ExternalLink className="mt-0.5 size-4 shrink-0 text-notice" aria-hidden="true" />
              <a href={link} target="_blank" rel="noopener noreferrer" className={`${LINK} min-w-0 break-all`}>
                {link}
              </a>
            </li>
          )}
        </ul>
        {statusWords && <span className={CHIP_SOFT}>{statusWords}</span>}
        {str(body.description) && <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{str(body.description)}</p>}
      </div>
    </div>
  );
}
