/**
 * COMING UP, on /sessions: each circle's next meeting, from its rhythm
 * (shared/sessionRhythm.ts). The member's own circles come first, then the
 * rest by when they meet.
 *
 * Each row says when in the village's own words ("Tomorrow at 18:00"), how the
 * circle meets ("Every Thursday at 18:00"), and how many agenda items wait for
 * it. While the circle's room is open the row offers the room; otherwise
 * "Get the room ready" fills the start card for that meeting (its title, its
 * circle, its length, and the circle's waiting items ticked), and a person
 * opens it. Nothing opens a room by itself.
 *
 * The circle's members and admins change, skip or stop its rhythm from the
 * row (`canKeep`), and set one for a circle that has none from "Set a meeting
 * rhythm". Every write reads `res.ok` before it says anything, and then the
 * page reads the list again, a refusal included, so a row that moved is never
 * tried twice. What landed is read out in one polite line. The focus returns
 * to the control that opened a form, and to the section's heading when a row
 * leaves. Each control is described by its row's circle and meeting, so a list
 * of buttons tells one row from the next.
 *
 * A notice about a meeting links to `/sessions#coming-<circle>`. The row with
 * that anchor is lit, scrolled to and focused once the list holds it, on the
 * first visit and when the link is followed from the page itself.
 *
 * A row's next meeting can come from the circle's own calendar
 * (OwnCalendarPanel.tsx, for the circle's keepers): it then carries that
 * meeting's own title. A skip always names the rhythm's own next meeting, so
 * while a calendar's meeting comes sooner it says which ("Skip the rhythm's
 * meeting on Thursday"); a meeting on the calendar is skipped there. A circle
 * with a calendar and no rhythm is offered "Set a meeting rhythm".
 *
 * "I'LL BE THERE" (Phase C, the Gathering). A row whose next meeting is on the
 * village calendar carries the gatherings' own answer (GatheringSeed.tsx): a
 * Seed of Life that fills one circle for each of us who said we will come, and
 * the button. Fireflies gather on one of them only: the viewer's own circle
 * that meets soonest and has not heard from them (`leadRow`).
 *
 * SEVERAL RHYTHMS (0401). A circle that keeps two or more rhythms lists them
 * under its row, each with its name, how it meets, its own next meeting and
 * what waits for it, and its own Change and Skip; "Stop this rhythm" in a
 * rhythm's form stops that one only. "Add another meeting" opens the same form
 * for a new one. A circle with one rhythm reads exactly as it did before.
 *
 * "Follow the calendar" sits at the foot of the section (FollowCalendar.tsx):
 * any member puts the circles they choose on their own calendar. It shows
 * whenever the village has a circle, a rhythm or not, so "every circle, new
 * ones too" can be chosen before the first rhythm is set.
 */
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Link } from "wouter";
import { SESSION_LIST_COPY } from "@shared/sessions";
import { circleWords } from "@shared/sessionTasks";
import {
  MAIN_RHYTHM,
  RHYTHM_COPY,
  RHYTHM_LIMITS,
  comingAnchor,
  rhythmsUrl,
  phraseOf,
  type Meeting,
  rhythmSkipUrl,
  rhythmUrl,
  type ComingUpPayload,
  type ComingUpRow,
  type RhythmInput,
} from "@shared/sessionRhythm";
import { gameFetch } from "@/lib/gameApi";
import FollowCalendar from "./FollowCalendar";
import GatheringSeed from "./GatheringSeed";
import OwnCalendarPanel from "./OwnCalendarPanel";
import RhythmForm from "./RhythmForm";
import { useHash } from "./useHash";
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, EYEBROW, HINT, LABEL_CAPS, PANEL } from "./roomUi";

/** The one row whose "I'll be there" carries the page's fireflies: the viewer's own circle that meets soonest and has not heard from them. */
export function leadRow(rows: readonly ComingUpRow[]): string | null {
  const open = rows.filter((r) => r.mine && r.gathering && !r.gathering.mine && !r.openRoom);
  open.sort((a, b) => Date.parse(a.next.at) - Date.parse(b.next.at));
  return open[0]?.circleId ?? null;
}

type Sent = { ok: true; row: ComingUpRow | null } | { ok: false; error: string };

/** One write: the row the server now holds, or the sentence to show. */
async function send(path: string, method: string, body: unknown): Promise<Sent> {
  try {
    const res = await gameFetch(path, { method, body: JSON.stringify(body) });
    const out = (await res.json().catch(() => null)) as { error?: unknown; row?: ComingUpRow | null } | null;
    if (res.ok) return { ok: true, row: out?.row ?? null };
    const text = typeof out?.error === "string" ? out.error.trim() : "";
    return { ok: false, error: /\s/.test(text) ? text : RHYTHM_COPY.failed };
  } catch {
    return { ok: false, error: RHYTHM_COPY.failed };
  }
}

/** Is the person typing somewhere? A landing never takes the focus from a field. */
const typing = () => {
  const el = typeof document === "undefined" ? null : document.activeElement;
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

/** What a write sends for one rhythm: its key, unless it is the first, so an older server reads the same body it always did. */
const withKey = <T extends object>(body: T, key: string | null | undefined): T & { rhythmKey?: string } =>
  key && key !== MAIN_RHYTHM ? { ...body, rhythmKey: key } : body;

function Row({
  row,
  zone,
  defaultMinutes,
  lit,
  lead,
  onGetReady,
  onChanged,
  onSaid,
  onGone,
}: {
  row: ComingUpRow;
  zone: string;
  defaultMinutes: number | null;
  lit: boolean;
  lead: boolean;
  onGetReady: (row: ComingUpRow) => void;
  onChanged: () => Promise<void> | void;
  onSaid: (text: string) => void;
  onGone: () => void;
}) {
  const { t } = useLingui();
  /** Which form is open: a rhythm's key, ADDING for another meeting, or null. */
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const refocus = useRef<"change" | "skip" | "add" | null>(null);
  const anchor = comingAnchor(row.circleId);
  const describedBy = `${anchor}-circle ${anchor}-when`;
  const lines = row.rhythms ?? [];
  // Two or more rhythms are listed one by one; one rhythm keeps the row as it always was.
  const several = lines.length > 1;
  const only = lines.length === 1 ? lines[0] : null;
  const canAdd = row.canKeep && lines.length > 0 && lines.length < RHYTHM_LIMITS.perCircle;

  // Back from the form or a skip, the focus returns to the control that was used, or to Change when a skip left none.
  useEffect(() => {
    if (editing || busy || !refocus.current) return;
    const target = refocus.current === "add" ? addButton : refocus.current === "skip" && skipButton.current ? skipButton : changeButton;
    target.current?.focus();
    refocus.current = null;
  }, [editing, busy]);

  const write = async (path: string, method: string, body: unknown, after: (row: ComingUpRow | null) => string) => {
    setBusy(true);
    setError(null);
    const out = await send(path, method, body);
    if (!out.ok) setError(out.error);
    // The list is read again either way: a refusal often means the row moved.
    await onChanged();
    setBusy(false);
    if (!out.ok) return;
    setEditing(null);
    onSaid(after(out.row));
    if (!out.row) onGone();
  };

  /** Save or stop one rhythm, by its key (null: the circle's first, as an older page sent it). */
  const save = (key: string | null) => (circleId: string, input: RhythmInput) => {
    refocus.current = "change";
    const stopped = input.kind === "none";
    void write(rhythmUrl(circleId), "PUT", withKey(input, key), (next) =>
      !next ? RHYTHM_COPY.stopped(row.circleName) : stopped ? t`Stopped. That meeting has left Coming up.` : RHYTHM_COPY.saved(row.circleName),
    );
  };

  const add = (circleId: string, input: RhythmInput) => {
    refocus.current = "add";
    void write(rhythmsUrl(circleId), "POST", input, () => t`Added. The ${circleWords(row.circleName)} has another meeting.`);
  };

  const skip = (meeting: Meeting, key: string | null) => {
    refocus.current = "skip";
    void write(rhythmSkipUrl(row.circleId), "POST", withKey({ key: meeting.key }, key), (next) =>
      next ? RHYTHM_COPY.skipped(row.circleName, phraseOf(next.words)) : RHYTHM_COPY.skippedLast(row.circleName),
    );
  };

  const cancel = () => {
    refocus.current = editing === ADDING ? "add" : "change";
    setEditing(null);
    setError(null);
  };

  const form = (key: string, initial: RhythmInput | null, extra: { saveLabel?: string; stopConfirm?: string } = {}) => (
    <div className="mt-3">
      <RhythmForm
        idBase={`rhythm-${row.circleId}-${key}`}
        circles={[{ id: row.circleId, name: row.circleName }]}
        fixedCircleId={row.circleId}
        initial={initial}
        labelledBy={`${anchor}-circle`}
        defaultMinutes={defaultMinutes}
        zone={zone}
        busy={busy}
        error={error}
        onSubmit={key === ADDING ? add : save(key === ROW ? (only?.key ?? null) : key)}
        onCancel={cancel}
        {...extra}
      />
    </div>
  );

  return (
    <li
      id={anchor}
      tabIndex={-1}
      className={`scroll-mt-24 rounded-xl border bg-card px-4 py-3 outline-none ${lit ? "border-notice ring-2 ring-notice/60" : "border-border"}`}
    >
      <p id={`${anchor}-circle`} className={EYEBROW}>
        {circleWords(row.circleName)}
      </p>
      {editing === ROW ? (
        form(ROW, row.rhythm)
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p id={`${anchor}-when`} className="mt-1 font-display text-xl leading-tight text-foreground">
                {row.words}
              </p>
              {(row.nextTitle ?? row.nextName) && (
                <p className="mt-0.5 line-clamp-2 break-words text-sm text-foreground [overflow-wrap:anywhere]">{row.nextTitle ?? row.nextName}</p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {several ? RHYTHM_COPY.waiting(row.waiting) : `${row.rhythmWords} · ${RHYTHM_COPY.waiting(row.waiting)}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {row.openRoom ? (
                <Link href={`/sessions/${row.openRoom.id}`} className={`${BTN_PRIMARY} no-underline`} aria-describedby={describedBy}>
                  {RHYTHM_COPY.openNow}: {SESSION_LIST_COPY.enterRoom}
                </Link>
              ) : (
                <button type="button" className={BTN_SECONDARY} aria-describedby={describedBy} onClick={() => onGetReady(row)}>
                  {RHYTHM_COPY.getReady}
                </button>
              )}
            </div>
          </div>
          {row.gathering && <GatheringSeed row={{ ...row, gathering: row.gathering }} lead={lead} onChanged={onChanged} onSaid={onSaid} />}
          {several && (
            <ul aria-label={t({ message: `The ${circleWords(row.circleName)}'s meetings`, context: "sessions coming up, the list of one circle's meeting rhythms" })} className="mt-3 space-y-2">
              {lines.map((line) => {
                const lineId = `${anchor}-${line.key}`;
                return (
                  <li key={line.key} id={lineId} className="rounded-lg border border-border bg-muted px-3 py-2">
                    {editing === line.key ? (
                      form(line.key, line.input, { stopConfirm: t`Stop "${line.name || line.words}"? The circle's other meetings stay as they are.` })
                    ) : (
                      <>
                        <p id={`${lineId}-name`} className="text-sm font-semibold text-foreground">
                          {line.name || line.words}
                        </p>
                        <p id={`${lineId}-when`} className="text-sm text-muted-foreground">
                          {line.name ? `${line.words} · ` : ""}
                          {line.next ? t({ message: `Next: ${line.next.words}`, context: "sessions coming up, one rhythm's next meeting" }) : t({ message: "Nothing coming up", context: "sessions coming up, a rhythm with no meeting ahead" })} · {RHYTHM_COPY.waiting(line.waiting)}
                        </p>
                        {row.canKeep && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              className={BTN_QUIET}
                              disabled={busy || editing != null}
                              aria-describedby={`${anchor}-circle ${lineId}-name ${lineId}-when`}
                              onClick={() => setEditing(line.key)}
                            >
                              {RHYTHM_COPY.change}
                            </button>
                            {line.next && (
                              <button
                                type="button"
                                className={BTN_QUIET}
                                disabled={busy || editing != null}
                                aria-describedby={`${anchor}-circle ${lineId}-name ${lineId}-when`}
                                onClick={() => skip(line.next!, line.key)}
                              >
                                {RHYTHM_COPY.skip}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {row.canKeep && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {!several && (
                <button ref={changeButton} type="button" className={BTN_QUIET} disabled={busy} aria-describedby={describedBy} onClick={() => setEditing(ROW)}>
                  {row.rhythm.kind === "none" ? RHYTHM_COPY.setRhythm : RHYTHM_COPY.change}
                </button>
              )}
              {!several && row.rhythmNext && (
                <button
                  ref={skipButton}
                  type="button"
                  className={BTN_QUIET}
                  disabled={busy}
                  aria-describedby={describedBy}
                  onClick={() => skip(row.rhythmNext!, row.nextRhythmKey ?? only?.key ?? null)}
                >
                  {row.nextFrom === "rhythm" ? RHYTHM_COPY.skip : RHYTHM_COPY.skipRhythm(phraseOf(row.rhythmNext.words))}
                </button>
              )}
              {canAdd && editing !== ADDING && (
                <button ref={addButton} type="button" className={BTN_QUIET} disabled={busy || editing != null} aria-describedby={`${anchor}-circle`} onClick={() => setEditing(ADDING)}>
                  {t({ message: "Add another meeting", context: "sessions coming up, add a rhythm to a circle" })}
                </button>
              )}
            </div>
          )}
          {editing === ADDING && form(ADDING, null, { saveLabel: t({ message: "Add the meeting", context: "sessions coming up, save a new rhythm" }) })}
          {error && editing == null && (
            <p role="alert" className="mt-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </li>
  );
}

/** The forms a row opens: the row's own rhythm (one rhythm, as it always was), or another meeting. Never a rhythm's key. */
const ROW = "@row";
const ADDING = "@add";

export default function ComingUp({
  comingUp,
  circles,
  defaultMinutes,
  onGetReady,
  onChanged,
}: {
  comingUp: ComingUpPayload;
  circles: { id: string; name: string }[];
  defaultMinutes: number | null;
  onGetReady: (row: ComingUpRow) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [setting, setSetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [lit, setLit] = useState<string | null>(null);
  const landed = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const setButton = useRef<HTMLButtonElement>(null);
  const backToSet = useRef(false);
  const hash = useHash();

  // A notice's link lands on its row once the list holds it, once per hash.
  useEffect(() => {
    const target = comingUp.rows.find((r) => hash === `#${comingAnchor(r.circleId)}`);
    if (!target || landed.current === hash) return;
    landed.current = hash;
    setLit(target.circleId);
    const frame = window.requestAnimationFrame(() => {
      const el = document.getElementById(comingAnchor(target.circleId));
      el?.scrollIntoView?.({ block: "center" });
      if (!typing()) el?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, comingUp.rows]);

  // The outline fades on its own clock, whatever the list does meanwhile.
  useEffect(() => {
    if (lit == null) return;
    const timer = window.setTimeout(() => setLit(null), 4000);
    return () => window.clearTimeout(timer);
  }, [lit]);

  // Back from the form, the focus returns to the button that opened it.
  useEffect(() => {
    if (!setting && backToSet.current) {
      backToSet.current = false;
      setButton.current?.focus();
    }
  }, [setting]);

  // A circle that has a rhythm changes it from its own row, so this form only sets new ones.
  const lead = leadRow(comingUp.rows);
  const keepable = circles.filter((c) => comingUp.keepCircleIds.includes(c.id) && !comingUp.rows.some((r) => r.circleId === c.id));
  if (!comingUp.rows.length && !keepable.length && !circles.length) return null;

  const closeForm = () => {
    backToSet.current = true;
    setSetting(false);
    setError(null);
  };

  const add = async (circleId: string, input: RhythmInput) => {
    setBusy(true);
    setError(null);
    const out = await send(rhythmUrl(circleId), "PUT", input);
    if (!out.ok) {
      setBusy(false);
      setError(out.error);
      return;
    }
    await onChanged();
    setBusy(false);
    closeForm();
    setSaid(RHYTHM_COPY.saved(circles.find((c) => c.id === circleId)?.name ?? ""));
  };

  return (
    <section aria-labelledby="sessions-coming-heading">
      <h2 ref={heading} tabIndex={-1} id="sessions-coming-heading" className="font-display text-2xl text-foreground outline-none">
        {RHYTHM_COPY.sectionTitle}
      </h2>
      {/* Mounted from the start, so what landed is read out when its words arrive. */}
      <p aria-live="polite" className={`text-sm text-open ${said ? "mt-2" : "sr-only"}`}>
        {said}
      </p>
      {comingUp.rows.length === 0 ? (
        <p className={`mt-3 ${PANEL} ${HINT}`}>{RHYTHM_COPY.empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {comingUp.rows.map((row) => (
            <Row
              key={row.circleId}
              row={row}
              zone={comingUp.zone}
              defaultMinutes={defaultMinutes}
              lit={lit === row.circleId}
              lead={lead === row.circleId}
              onGetReady={onGetReady}
              onChanged={onChanged}
              onSaid={setSaid}
              onGone={() => heading.current?.focus()}
            />
          ))}
        </ul>
      )}
      {keepable.length > 0 && (
        <div className={`mt-3 ${PANEL}`}>
          {setting ? (
            <>
              <h3 className={`${LABEL_CAPS} mb-3`}>{RHYTHM_COPY.formTitle}</h3>
              <RhythmForm
                idBase="rhythm-new"
                circles={keepable}
                defaultMinutes={defaultMinutes}
                zone={comingUp.zone}
                busy={busy}
                error={error}
                onSubmit={(circleId, input) => void add(circleId, input)}
                onCancel={closeForm}
              />
            </>
          ) : (
            <button
              ref={setButton}
              type="button"
              className={BTN_SECONDARY}
              onClick={() => {
                setSetting(true);
                setSaid("");
              }}
            >
              {RHYTHM_COPY.setRhythm}
            </button>
          )}
        </div>
      )}
      <OwnCalendarPanel
        circles={circles.filter((c) => comingUp.keepCircleIds.includes(c.id))}
        ownCalendars={comingUp.ownCalendars}
        available={comingUp.ownCalendarsAvailable}
        onChanged={onChanged}
        onSaid={setSaid}
      />
      <FollowCalendar />
    </section>
  );
}
