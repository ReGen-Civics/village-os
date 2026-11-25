/**
 * THE DANGER ZONE at the foot of Mail settings (Admin evolution, PR 2).
 *
 * Disconnecting delivery reports used to sit three clicks deep: item 4,
 * then "Do it by hand instead", then a Disconnect button behind a browser
 * prompt. It is rare and it stops every bounce and every test from being
 * reported back, so it moves to the end of the page, says what it stops,
 * and asks in the page itself (a browser prompt cannot say much, and some
 * app views never show one). The route and its body are unchanged.
 */
import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { SettingsPayload } from "./commsSettingsApi";
import { useSaver } from "./CommsSetupEditors";

const dangerCls =
  "min-h-[44px] px-3 text-sm rounded-lg border border-destructive bg-card text-destructive font-medium hover:bg-destructive/10 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-ring";
const dangerFillCls =
  "min-h-[44px] px-3 text-sm rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring";
const keepCls =
  "min-h-[44px] px-3 text-sm rounded-lg border border-border bg-card text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring";

export default function DeliveryDangerZone(props: { data: SettingsPayload; password: string; apply: (d: SettingsPayload) => void }) {
  const { t } = useLingui();
  const w = props.data.webhook;
  const [asking, setAsking] = useState(false);
  const { busy, refused, save } = useSaver(props);
  // Only a connection made here can be undone here; one made through the host's setting is the host's.
  if (!w.configured || w.source !== "admin") return null;

  return (
    <section aria-labelledby="mail-danger" className="border border-border border-t-4 border-t-destructive rounded-xl bg-card p-4 space-y-3">
      <h3 id="mail-danger" className="text-base font-semibold text-foreground">
        <Trans context="Mail settings, danger zone heading">Danger zone</Trans>
      </h3>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground"><Trans context="Mail settings, danger zone">Disconnect delivery reports</Trans></p>
          <p className="text-sm text-muted-foreground">
            <Trans context="Mail settings, danger zone">Reports Resend sends after this are refused, so bounces and tests stop being reported back until you connect again.</Trans>
          </p>
        </div>
        {!asking && (
          <button type="button" onClick={() => setAsking(true)} disabled={busy} className={dangerCls}>
            <Trans context="Mail settings, danger zone button">Disconnect...</Trans>
          </button>
        )}
      </div>
      {asking && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2" role="group" aria-label={t({ message: "Confirm disconnecting delivery reports", context: "Mail settings, danger zone confirm" })}>
          <p className="text-sm text-foreground">
            <Trans context="Mail settings, danger zone confirm">Disconnect delivery reports now? Mail keeps sending; only the reports stop.</Trans>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className={dangerFillCls}
              onClick={async () => {
                if (await save("/admin/comms/settings/webhook", "PUT", { secret: "" }, t({ message: "Delivery reports disconnected", context: "Mail settings, danger zone done" }))) setAsking(false);
              }}
            >
              <Trans context="Mail settings, danger zone confirm button">Disconnect delivery reports</Trans>
            </button>
            <button type="button" onClick={() => setAsking(false)} className={keepCls}>
              <Trans context="Mail settings, danger zone keep button">Keep them connected</Trans>
            </button>
          </div>
        </div>
      )}
      {refused && <p className="text-sm text-destructive" role="alert">{refused}</p>}
    </section>
  );
}
