/**
 * A CIRCLE'S OWN CALENDAR, under "Coming up" on /sessions: for a circle that
 * already keeps its meetings in Google Calendar, Apple or Outlook. Its members
 * and admins paste that calendar's secret address, and its meetings show under
 * Coming up, reach the day before, and travel to everyone who follows the
 * circle (shared/sessionCalendar.ts).
 *
 * Shown only to someone who may keep at least one circle. Each attached
 * calendar is named by where it points and its last four characters, never
 * the address, with how its last read went, and can be detached after one
 * confirm, since attaching it again takes the secret address. While the
 * village cannot seal an address the panel says to ask an admin. The address
 * box is a password box: the address is a key to the whole calendar. Every
 * write reads `res.ok` before it says anything, then the page reads the list
 * again, and the focus returns to the button that opened the form.
 *
 * A TITLE FILTER (0401). A calendar can hold other things than the circle's
 * meetings. The attach form takes an optional word, and each attached
 * calendar can change it after ("Which events count"): only events whose
 * title holds the word become the circle's meetings. The address is never
 * asked for again to change it, and never shown.
 */
import type { PickerCircle } from "@shared/circlePicker";
import CirclePicker from "@/components/circles/CirclePicker";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { CALENDAR_LIMITS, OWN_CALENDAR_COPY, ownCalendarUrl, type OwnCalendarView } from "@shared/sessionCalendar";
import { RHYTHM_COPY } from "@shared/sessionRhythm";
import { gameFetch } from "@/lib/gameApi";
import { BTN_DANGER, BTN_DANGER_QUIET, BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, HINT, INPUT, LABEL, LABEL_CAPS, PANEL, UNDER_BOX } from "./roomUi";

type Sent = { ok: true; body: { read?: boolean } } | { ok: false; error: string };

async function send(path: string, method: string, body?: unknown): Promise<Sent> {
  try {
    const res = await gameFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const out = (await res.json().catch(() => null)) as { error?: unknown; read?: boolean } | null;
    if (res.ok) return { ok: true, body: out ?? {} };
    const text = typeof out?.error === "string" ? out.error.trim() : "";
    return { ok: false, error: /\s/.test(text) ? text : RHYTHM_COPY.failed };
  } catch {
    return { ok: false, error: RHYTHM_COPY.failed };
  }
}

/** "14 October", in the reader's own locale. */
function shortDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

function readLine(view: OwnCalendarView): string {
  if (view.status === "failed") return OWN_CALENDAR_COPY.readFailed;
  return view.lastReadAt ? OWN_CALENDAR_COPY.readOn(shortDay(view.lastReadAt)) : OWN_CALENDAR_COPY.notReadYet;
}

export default function OwnCalendarPanel({
  circles,
  ownCalendars,
  available,
  onChanged,
  onSaid,
}: {
  /** The circles this person may keep. */
  circles: PickerCircle[];
  ownCalendars: Record<string, OwnCalendarView>;
  /** Whether the village can seal an address, so one can be attached. */
  available: boolean;
  onChanged: () => Promise<void> | void;
  onSaid: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [circleId, setCircleId] = useState(circles.length === 1 ? circles[0].id : "");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [titleFilter, setTitleFilter] = useState("");
  /** The calendar whose title filter is being changed, and the word as typed. */
  const [filtering, setFiltering] = useState<{ circleId: string; word: string } | null>(null);
  const { t } = useLingui();
  const openButton = useRef<HTMLButtonElement>(null);
  const backToButton = useRef(false);

  useEffect(() => {
    if (!open && backToButton.current) {
      backToButton.current = false;
      openButton.current?.focus();
    }
  }, [open]);

  if (!circles.length) return null;
  const nameOf = (id: string) => circles.find((c) => c.id === id)?.name ?? id;
  const attached = circles.filter((c) => ownCalendars[c.id]);

  const close = () => {
    backToButton.current = true;
    setOpen(false);
    setUrl("");
    setTitleFilter("");
    setError(null);
  };

  const saveFilter = async (e: FormEvent) => {
    e.preventDefault();
    if (!filtering || busy) return;
    setBusy(true);
    setError(null);
    const out = await send(ownCalendarUrl(filtering.circleId), "PATCH", { titleFilter: filtering.word.trim() });
    if (!out.ok) {
      setBusy(false);
      setError(out.error);
      return;
    }
    await onChanged();
    setBusy(false);
    const word = filtering.word.trim();
    const name = nameOf(filtering.circleId);
    setFiltering(null);
    onSaid(word ? t`Saved. Only events titled with "${word}" count as ${name} meetings.` : t`Saved. Every timed event on the calendar counts as a ${name} meeting.`);
  };

  const attach = async (e: FormEvent) => {
    e.preventDefault();
    if (!circleId || busy) return;
    setBusy(true);
    setError(null);
    const out = await send(ownCalendarUrl(circleId), "PUT", { url, ...(titleFilter.trim() ? { titleFilter: titleFilter.trim() } : {}) });
    if (!out.ok) {
      setBusy(false);
      setError(out.error);
      return;
    }
    await onChanged();
    setBusy(false);
    close();
    onSaid(out.body.read === false ? OWN_CALENDAR_COPY.attachedUnread(nameOf(circleId)) : OWN_CALENDAR_COPY.attached(nameOf(circleId)));
  };

  const detach = async (id: string) => {
    setAsking(null);
    setBusy(true);
    setError(null);
    const out = await send(ownCalendarUrl(id), "DELETE");
    if (!out.ok) {
      setBusy(false);
      setError(out.error);
      return;
    }
    await onChanged();
    setBusy(false);
    onSaid(OWN_CALENDAR_COPY.detached(nameOf(id)));
    openButton.current?.focus();
  };

  return (
    <div className={`mt-3 ${PANEL}`}>
      {attached.length > 0 && (
        <ul className="mb-3 space-y-2" aria-label={OWN_CALENDAR_COPY.title}>
          {attached.map((c) => {
            const view = ownCalendars[c.id];
            return (
              <li key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words text-sm text-foreground">
                    {OWN_CALENDAR_COPY.attachedLine(c.name, view.host, view.last4)}
                    <span className={`block ${view.status === "failed" ? "font-medium text-destructive" : "text-muted-foreground"}`}>{readLine(view)}</span>
                    <span className="block text-muted-foreground">
                      {view.titleFilter ? t`Only events titled with "${view.titleFilter}" count.` : t`Every timed event counts.`}
                    </span>
                  </span>
                  {asking !== c.id && filtering?.circleId !== c.id && (
                    <button
                      type="button"
                      className={BTN_QUIET}
                      disabled={busy || open}
                      onClick={() => {
                        setAsking(null);
                        setError(null);
                        setFiltering({ circleId: c.id, word: view.titleFilter ?? "" });
                      }}
                      aria-label={`${t({ message: "Which events count", context: "a circle's own calendar, change its title filter" })}: ${OWN_CALENDAR_COPY.attachedLine(c.name, view.host, view.last4)}`}
                    >
                      {t({ message: "Which events count", context: "a circle's own calendar, change its title filter" })}
                    </button>
                  )}
                  {asking !== c.id && (
                    <button
                      type="button"
                      className={BTN_DANGER_QUIET}
                      disabled={busy || open}
                      onClick={() => setAsking(c.id)}
                      aria-label={`${OWN_CALENDAR_COPY.detach}: ${OWN_CALENDAR_COPY.attachedLine(c.name, view.host, view.last4)}`}
                    >
                      {OWN_CALENDAR_COPY.detach}
                    </button>
                  )}
                </div>
                {filtering?.circleId === c.id && (
                  <form className="mt-2 space-y-2 rounded-xl border border-border bg-muted px-3 py-3" onSubmit={(e) => void saveFilter(e)} noValidate>
                    <label htmlFor={`own-calendar-filter-${c.id}`} className={LABEL}>
                      {t`Only events whose title holds`}
                    </label>
                    <input
                      id={`own-calendar-filter-${c.id}`}
                      type="text"
                      autoFocus
                      className={INPUT}
                      value={filtering.word}
                      maxLength={CALENDAR_LIMITS.titleFilter}
                      aria-describedby={`own-calendar-filter-${c.id}-hint`}
                      onChange={(e) => setFiltering({ circleId: c.id, word: e.target.value })}
                    />
                    <p id={`own-calendar-filter-${c.id}-hint`} className={HINT}>
                      {t`Leave it empty and every timed event counts. Case and accents do not matter.`}
                    </p>
                    {error && (
                      <p role="alert" className="text-sm font-medium text-destructive">
                        {error}
                      </p>
                    )}
                    <div className={UNDER_BOX}>
                      <button type="submit" className={BTN_PRIMARY} disabled={busy}>
                        {busy ? RHYTHM_COPY.saving : t`Save which events count`}
                      </button>
                      <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => setFiltering(null)}>
                        {OWN_CALENDAR_COPY.cancel}
                      </button>
                    </div>
                  </form>
                )}
                {asking === c.id && (
                  <div role="group" aria-label={OWN_CALENDAR_COPY.detach} className="mt-2 rounded-xl border border-border bg-muted px-3 py-3">
                    <p className="text-sm text-foreground">{OWN_CALENDAR_COPY.detachConfirm(c.name)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void detach(c.id)}>
                        {OWN_CALENDAR_COPY.detachYes}
                      </button>
                      <button type="button" autoFocus className={BTN_QUIET} disabled={busy} onClick={() => setAsking(null)}>
                        {OWN_CALENDAR_COPY.keep}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {open ? (
        <form className="space-y-4" onSubmit={(e) => void attach(e)} noValidate aria-labelledby="own-calendar-heading">
          <h3 id="own-calendar-heading" className={LABEL_CAPS}>
            {OWN_CALENDAR_COPY.title}
          </h3>
          <p className={`${HINT} max-w-2xl`}>{OWN_CALENDAR_COPY.lede}</p>
          <div>
            <label htmlFor="own-calendar-circle" className={LABEL}>
              {OWN_CALENDAR_COPY.circleLabel}
            </label>
            <CirclePicker id="own-calendar-circle" className={`mt-1 ${INPUT}`} circles={circles} value={circleId} onChange={setCircleId} placeholder={OWN_CALENDAR_COPY.circleChoose} autoDefault />
          </div>
          <div>
            <label htmlFor="own-calendar-url" className={LABEL}>
              {OWN_CALENDAR_COPY.urlLabel}
            </label>
            <input
              id="own-calendar-url"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className={`mt-1 ${INPUT}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            />
            <p className={`${HINT} mt-1`}>{OWN_CALENDAR_COPY.findIt}</p>
          </div>
          <div>
            <label htmlFor="own-calendar-filter" className={LABEL}>
              {t`Only events whose title holds`}
            </label>
            <input
              id="own-calendar-filter"
              type="text"
              className={`mt-1 ${INPUT}`}
              value={titleFilter}
              maxLength={CALENDAR_LIMITS.titleFilter}
              aria-describedby="own-calendar-filter-hint"
              onChange={(e) => setTitleFilter(e.target.value)}
            />
            <p id="own-calendar-filter-hint" className={`${HINT} mt-1`}>
              {t`Optional. For a calendar that holds other things too: only events whose title holds this word become the circle's meetings.`}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <div className={UNDER_BOX}>
            <button type="submit" className={BTN_PRIMARY} disabled={busy || !circleId || !url.trim()}>
              {busy ? OWN_CALENDAR_COPY.attaching : circleId && ownCalendars[circleId] ? OWN_CALENDAR_COPY.replace : OWN_CALENDAR_COPY.attach}
            </button>
            <button type="button" className={BTN_QUIET} onClick={close}>
              {OWN_CALENDAR_COPY.cancel}
            </button>
          </div>
        </form>
      ) : (
        <>
          {available ? (
            <button
              ref={openButton}
              type="button"
              className={BTN_SECONDARY}
              onClick={() => {
                setError(null);
                setAsking(null);
                setOpen(true);
              }}
            >
              {OWN_CALENDAR_COPY.open}
            </button>
          ) : (
            <p className={HINT}>{OWN_CALENDAR_COPY.unavailable}</p>
          )}
          {error && !filtering && (
            <p role="alert" className="mt-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
