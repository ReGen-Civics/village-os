/**
 * "I'VE BOOKED IT" (the lead, 27 Nov 2026: "I've booked it button for now for booked call dates - build it simply and
 * naturally into the flow"). A quiet action beside "Book with <role>": one tap asks only for the date and time they
 * picked, in their own time zone, with the village's beside it. Once saved, the line reads "Booked: Tue 3 Dec, 10:00
 * your time (11:00 Costa Rica time)" with "Change" to fix a wrong date. Optional: the flow is the same without it.
 *
 * The same control serves the applicant (their page and their profile) and the team (the walkthrough), each posting to
 * its own route; the server checks the time again (shared/callBooked.ts).
 */
import { useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { BTN_SECONDARY, HINT } from "@/components/journey/look";
import { BOOKED_MAX_DAYS, BOOKED_WORDS, readBookedAt, sayBookedAt, sayVillageTime, type BookedError } from "@shared/callBooked";
import { zoneLabel } from "@shared/startDay";
import type { ApplicantLanguage } from "@shared/applicantWords";

/** A `datetime-local` value ("2026-12-03T10:00") read in the browser's own zone. */
function fromLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** The same field's bound for a moment, in the browser's zone. */
function toLocal(at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}T${p(at.getHours())}:${p(at.getMinutes())}`;
}

export function bookedLine(at: string, villageZone: string, lang: ApplicantLanguage): string {
  const when = new Date(at);
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = villageZone || local;
  const w = BOOKED_WORDS[lang];
  return local === zone ? w.booked(sayBookedAt(when, zone, lang), null, zoneLabel(zone, lang)) : w.booked(sayBookedAt(when, local, lang), sayVillageTime(when, local, zone, lang), zoneLabel(zone, lang));
}

export default function BookedIt({ booked, zone: villageZone, lang, url, onSaved }: { booked: string | null; zone: string; lang: ApplicantLanguage; url: string; onSaved: (at: string) => void }) {
  const w = BOOKED_WORDS[lang];
  const zone = villageZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BookedError | "closed" | "failed" | null>(null);
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const picked = fromLocal(value);
  const now = new Date();

  const save = async () => {
    setError(null);
    const read = readBookedAt(picked ? picked.toISOString() : "", new Date());
    if (!read.ok) return setError(read.error);
    setBusy(true);
    const res = await gameFetch(url, { method: "POST", body: JSON.stringify({ at: read.at.toISOString() }), cache: "no-store" }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (res?.ok && typeof data?.at === "string") {
      setOpen(false);
      onSaved(data.at);
      return;
    }
    const code = String(data?.error ?? "");
    setError(code === "past" || code === "far" || code === "when" || code === "closed" ? code : "failed");
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-booked-call={booked ? "booked" : "ask"}>
        {booked && <p className="text-sm font-medium text-foreground" data-booked-line="">{bookedLine(booked, zone, lang)}</p>}
        <button
          type="button"
          className="min-h-11 text-sm text-muted-foreground underline underline-offset-4"
          onClick={() => {
            setValue(booked ? toLocal(new Date(booked)) : "");
            setOpen(true);
          }}
          data-booked-open=""
        >
          {booked ? w.change : w.action}
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-2" role="group" aria-label={w.ask} data-booked-form="">
      <label className="grid gap-1 text-sm text-foreground">
        <span className="font-medium">{w.ask}</span>
        <input
          type="datetime-local"
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-foreground"
          value={value}
          min={toLocal(now)}
          max={toLocal(new Date(now.getTime() + BOOKED_MAX_DAYS * 86_400_000))}
          onChange={(e) => setValue(e.target.value)}
          data-booked-input=""
        />
        <span className={HINT}>{w.hint}</span>
      </label>
      {picked && local !== zone && <p className={HINT} data-booked-preview="">{w.preview(sayVillageTime(picked, local, zone, lang), zoneLabel(zone, lang))}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void save()} data-booked-save="">
          {busy ? w.saving : w.save}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(false)}>
          {w.cancel}
        </button>
      </div>
      {error && <p role="alert" className={`${HINT} text-destructive`} data-booked-error={error}>{w.errors[error]}</p>}
    </div>
  );
}
