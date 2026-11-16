/**
 * "Your booking link" on the member's profile (shared/interviewBooking.ts).
 * When the member holds a role that talks with applicants, the applicant books
 * their conversation through this link. https only; clearing it falls back to
 * the role's own link.
 */
import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";

export default function BookingLinkField() {
  const { t } = useLingui();
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    gameFetch("/api/profile/booking-link", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setSaved(typeof d?.bookingUrl === "string" ? d.bookingUrl : null); })
      .catch(() => {})
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);

  if (!loaded) return null;
  const value = draft ?? saved ?? "";

  const run = async (next: string) => {
    setNote(null);
    try {
      const r = await gameFetch("/api/profile/booking-link", { method: "PUT", body: JSON.stringify({ bookingUrl: next }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) return setNote({ ok: false, text: String(d?.error ?? t({ message: "That did not save. Try again.", context: "booking link field" })) });
      setSaved(typeof d?.bookingUrl === "string" ? d.bookingUrl : null);
      setDraft(null);
      setNote({ ok: true, text: t({ message: "Saved.", context: "booking link field" }) });
    } catch {
      setNote({ ok: false, text: t({ message: "That did not save. Try again.", context: "booking link field" }) });
    }
  };

  return (
    <section aria-labelledby="my-booking-link" className="space-y-2 rounded-lg border border-border p-4">
      <h3 id="my-booking-link" className="font-semibold text-foreground"><Trans context="booking link field">Your booking link</Trans></h3>
      <p className="text-sm text-muted-foreground">
        <Trans context="booking link field">When you talk with someone applying for a role, they book a time with you here. Use your own booking page, such as a Google booking page.</Trans>
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label={t({ message: "Booking link", context: "booking link field" })}
          inputMode="url"
          className="min-h-[44px] min-w-[16rem] flex-1 rounded-lg border border-border bg-background px-3 text-foreground"
          value={value}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" className="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted" onClick={() => void run(value.trim())} disabled={!value.trim() || value.trim() === saved}>
          <Trans context="booking link field">Save</Trans>
        </button>
        {saved && (
          <button type="button" className="min-h-[44px] rounded-lg border border-border px-4 text-sm text-foreground hover:bg-muted" onClick={() => void run("")}>
            <Trans context="booking link field">Clear</Trans>
          </button>
        )}
      </div>
      {note && <p role={note.ok ? "status" : "alert"} className={`text-sm ${note.ok ? "text-foreground" : "text-destructive"}`}>{note.text}</p>}
    </section>
  );
}
