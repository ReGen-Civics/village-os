/**
 * The curator's queue for photographs: the "Reports" view of /places.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────
 *
 * A member can flag a direct message on this platform and the report lands in
 * a table no client can read, so somebody reporting harassment gets a success
 * message into nothing. This panel is the promise that the same thing did not
 * happen to photographs: the flag reaches a queue, the queue has a surface, a
 * person who is not an admin can open it, and closing a card notifies the
 * member who raised it.
 *
 * It reads `/api/places/reports`, which is gated on `map.curatePhotos` and
 * sits OUTSIDE `/api/admin` on purpose (R54): whoever the village appointed to
 * curate its pictures can work this queue without being handed the operator's
 * keys. The page shows this view only to a holder of that capability; the
 * server refuses everyone else whatever the page shows.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Check, X } from "lucide-react";
import { Image } from "@/components/Image";
import BreathingLoader from "@/components/natural/BreathingLoader";
import CuratorImage from "@/components/places/CuratorImage";
import { jsonHeaders, placeName } from "@/components/places/placesApi";
import ViewTabs, { panelId, tabId } from "@/components/places/ViewTabs";
import { BTN_SECONDARY, HINT, LINK, NOTE, TILE } from "@/components/journey/look";
import { canAct, emptyQueueLine, reportHeadline, type PlacePhotoReport, type ReportStatus } from "@shared/placePhotos";
import { Trans, useLingui } from "@lingui/react/macro";

export default function PhotoReportsPanel() {
  const { t, i18n } = useLingui();
  const [status, setStatus] = useState<ReportStatus>("open");
  const [reports, setReports] = useState<PlacePhotoReport[] | null>(null);
  const [say, setSay] = useState("");

  const tabs: { key: ReportStatus; label: string }[] = [
    { key: "open", label: t({ message: "Open", context: "photo reports queue" }) },
    { key: "resolved", label: t({ message: "Handled", context: "photo reports queue" }) },
    { key: "dismissed", label: t({ message: "Dismissed", context: "photo reports queue" }) },
  ];

  const load = useCallback(async () => {
    setReports(null);
    try {
      const res = await fetch(`/api/places/reports?status=${status}`, { headers: jsonHeaders() });
      if (!res.ok) {
        setReports([]);
        return;
      }
      const payload = await res.json();
      setReports(Array.isArray(payload?.reports) ? payload.reports : []);
    } catch {
      setReports([]);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const failedClose = t({ message: "That did not close. Try again in a moment.", context: "photo reports queue" });
  const close = async (id: string, next: "resolved" | "dismissed", said: string) => {
    try {
      const res = await fetch(`/api/places/reports/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: jsonHeaders(),
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setSay(failedClose);
        return;
      }
      setSay(said);
      void load();
    } catch {
      setSay(failedClose);
    }
  };

  return (
    <div className="space-y-5">
      <ul className={`${NOTE} m-0 list-disc space-y-1 pl-5`}>
        <li><Trans context="photo reports queue">Closing a report tells the member who raised it that someone read it.</Trans></li>
        <li><Trans context="photo reports queue">Taking a photo down closes every open report on it.</Trans></li>
      </ul>
      <ViewTabs
        tabs={tabs}
        value={status}
        onChange={setStatus}
        label={t({ message: "Report status", context: "photo reports queue" })}
        idPrefix="photo-reports"
      />
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-foreground">{say}</p>
      <div role="tabpanel" id={panelId("photo-reports", status)} aria-labelledby={tabId("photo-reports", status)}>
      {reports === null ? (
        <BreathingLoader label={t({ message: "Reading the queue", context: "photo reports queue" })} />
      ) : reports.length === 0 ? (
        <p className={HINT}>{emptyQueueLine(status)}</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 lg:grid-cols-2">
          {reports.map((r) => {
            const alt = r.photoAltText ?? t({ message: "The reported photo", context: "photo reports queue" });
            const who = r.reporter;
            const when = i18n.date(new Date(r.at), { dateStyle: "medium" });
            const closer = r.resolvedBy ?? "";
            const place = r.structureKey ? placeName(r.structureKey) : "";
            return (
              <li key={r.id} className={`${TILE} flex gap-4`}>
                <div className="w-24 shrink-0 overflow-hidden rounded-lg sm:w-28">
                  {!r.photoUrl ? (
                    <p className="text-xs text-muted-foreground"><Trans context="photo reports queue">This photo has been taken down. Its file is gone.</Trans></p>
                  ) : r.photoHidden ? (
                    <CuratorImage src={r.photoUrl} alt={alt} ratio={1} />
                  ) : (
                    <Image src={r.photoUrl} alt={alt} ratio={1} />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">{reportHeadline(r)}</p>
                  {r.reason && <p className="text-sm text-foreground">{r.reason}</p>}
                  <p className="text-xs text-muted-foreground">
                    <Trans context="photo reports queue">Raised by {who} on {when}.</Trans>
                    {r.photoHidden && (
                      <>
                        {" "}
                        <Trans context="photo reports queue">It is hidden now.</Trans>
                      </>
                    )}
                  </p>
                  {r.structureKey && (
                    <Link href={`/places/${encodeURIComponent(r.structureKey)}`} className={`${LINK} inline-flex min-h-11 items-center text-sm`}>
                      <Trans context="photo reports queue">Open {place}</Trans>
                    </Link>
                  )}
                  {r.resolvedBy && (
                    <p className="text-xs text-muted-foreground"><Trans context="photo reports queue">Closed by {closer}</Trans></p>
                  )}
                  {canAct(r) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" onClick={() => close(r.id, "resolved", t({ message: "Marked handled.", context: "photo reports queue" }))} className={BTN_SECONDARY}>
                        <Check className="size-4" aria-hidden="true" />
                        <Trans context="photo reports queue, mark a report">Handled</Trans>
                      </button>
                      <button type="button" onClick={() => close(r.id, "dismissed", t({ message: "Dismissed.", context: "photo reports queue" }))} className={BTN_SECONDARY}>
                        <X className="size-4" aria-hidden="true" />
                        <Trans context="photo reports queue">Dismiss</Trans>
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
