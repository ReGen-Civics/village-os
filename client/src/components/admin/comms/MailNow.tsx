/**
 * MAIL NOW: the top of Mail settings (Admin evolution, PR 2).
 *
 * The lead looked for "Send me a test" and could not find it: it was the last
 * of thirteen checklist items, folded shut behind Change once a test had been
 * delivered, under a page with four names. The rule this panel follows is the
 * one the whole Admin evolution follows: an act is never behind Change.
 *
 * So the page now opens with what is true and the acts that matter:
 *
 *   what is true    whether mail is live, rehearsing, paused or off, and who
 *                   it sends as (how many required steps are done stays above
 *                   the checklist, beside the steps it counts)
 *   the test        Send me a test, and its own outcome in the same panel:
 *                   sent and waiting, arrived, or why it did not. While a test
 *                   waits for its delivery report the panel asks again by
 *                   itself every few seconds, for two minutes, so nobody has to
 *                   go and read Sent mail to learn whether it arrived.
 *   the brake       Pause all automated email, which used to sit below every
 *                   item and every dial
 *   the record      a link to Sent mail
 *
 * The outcome sentence is the server's own (item 13's `detail`, written in
 * server/lib/comms/setup.ts), so this panel and the checklist can never say
 * two different things about the same test.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { refusal } from "@/components/admin/adminApi";
import { commsCall, type SettingsPayload } from "./commsSettingsApi";
import { PAUSE_ALL_BUTTON_ID, TEST_EMAIL_BUTTON_ID } from "./commsLanding";

/**
 * Drawn in the palette tokens, so the panel follows the night look a steward
 * can turn on (adminNight.ts), the way every new Admin surface does.
 */
const primaryCls =
  "min-h-[44px] px-4 text-sm rounded-lg bg-teal-deep text-white font-medium hover:bg-teal-deep-dark disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring";
const secondaryCls =
  "min-h-[44px] px-3 text-sm rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-ring";

/** How often, and for how long, a waiting test asks again by itself. */
export const TEST_POLL_MS = 5000;
export const TEST_POLL_TRIES = 24;

/** The test is out and its delivery report has not come back yet. */
export function testIsWaiting(data: Pick<SettingsPayload, "testEmail">): boolean {
  const t = data.testEmail;
  return !!t && !t.delivered && t.status === "sent";
}

export default function MailNow({
  data,
  password,
  apply,
  note,
}: {
  data: SettingsPayload;
  password: string;
  apply: (d: SettingsPayload) => void;
  /** What the comms module's lifecycle means for this page, in a sentence. */
  note?: string;
}) {
  const { t } = useLingui();
  const [sending, setSending] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const tries = useRef(0);

  const item = data.checklist.find((i) => i.key === "test-email");
  const paused = data.settings.paused;
  const waiting = testIsWaiting(data);
  const live = data.lifecycle === "members" || data.lifecycle === "public";

  const reload = useCallback(async () => {
    const r = await commsCall<SettingsPayload>("/admin/comms/settings", password);
    if (r.ok) apply(r.data);
  }, [password, apply]);

  // A waiting test asks again by itself, a bounded number of times.
  useEffect(() => {
    if (!waiting) {
      tries.current = 0;
      return;
    }
    if (tries.current >= TEST_POLL_TRIES) return;
    const id = window.setTimeout(() => {
      tries.current += 1;
      void reload();
    }, TEST_POLL_MS);
    return () => window.clearTimeout(id);
  }, [waiting, data, reload]);

  const send = async () => {
    setSending(true);
    setRefused(null);
    const r = await commsCall<SettingsPayload & { result?: { status: string; reason?: string } }>("/admin/comms/settings/test", password, { method: "POST", body: {} });
    setSending(false);
    if (!r.ok) {
      setRefused(refusal(r.data, t({ message: "The test was not sent.", context: "Mail settings, test email refused" })));
      return;
    }
    tries.current = 0;
    if (r.data?.checklist) apply(r.data);
    else await reload();
  };

  const flip = async () => {
    setPausing(true);
    const r = await commsCall<SettingsPayload>("/admin/comms/settings", password, { method: "PUT", body: { paused: !paused } });
    setPausing(false);
    if (!r.ok) {
      toast.error(refusal(r.data, t({ message: "That was not saved.", context: "Mail settings, pause refused" })));
      return;
    }
    apply(r.data);
    toast.success(paused
      ? t({ message: "Email is flowing again", context: "Mail settings, pause lifted" })
      : t({ message: "Automated email is paused", context: "Mail settings, paused" }));
  };

  const sender = data.sender.line;
  const me = data.me.email;

  return (
    <section aria-labelledby="mail-now" className={`border-2 rounded-xl p-4 sm:p-5 bg-card space-y-3 ${paused ? "border-notice" : "border-primary/40"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="mail-now" className="text-base font-semibold text-foreground">
          {paused ? (
            <Trans context="Mail settings, state heading">Automated email is paused</Trans>
          ) : live ? (
            <Trans context="Mail settings, state heading">Mail is live</Trans>
          ) : data.lifecycle === "preview" ? (
            <Trans context="Mail settings, state heading">Mail is rehearsing</Trans>
          ) : (
            <Trans context="Mail settings, state heading">Mail is off</Trans>
          )}
        </h3>
      </div>

      {note && (
        <p className="text-sm text-muted-foreground">
          {note}{" "}
          <a href="/admin?tab=modules" className="font-medium text-primary underline underline-offset-2">
            <Trans context="Mail settings, link to the module library">Module Library</Trans>
          </a>
        </p>
      )}

      <p className="text-sm text-foreground">
        {sender ? (
          <Trans context="Mail settings, sender line">Sending as {sender}.</Trans>
        ) : (
          <Trans context="Mail settings, sender line">No sender yet, so nothing is sent.</Trans>
        )}
      </p>

      <div className="rounded-lg bg-muted border border-border px-3 py-2" role="status" aria-live="polite">
        <p className="text-sm text-foreground">
          <span className="font-medium"><Trans context="Mail settings, test outcome label">The test:</Trans></span>{" "}
          {item ? item.detail : <Trans context="Mail settings, test outcome">No test sent yet.</Trans>}
        </p>
        {me ? (
          <p className="text-xs text-muted-foreground mt-1">
            <Trans context="Mail settings, test explainer">It goes to {me}, from the sender above. This is the test that marks mail as ready, and this line changes when it arrives.</Trans>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            <Trans context="Mail settings, test explainer">Sign in with your own account to send yourself a test.</Trans>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button id={TEST_EMAIL_BUTTON_ID} type="button" onClick={send} disabled={sending || !me} className={primaryCls}>
          {sending ? t({ message: "Sending...", context: "Mail settings, test button busy" }) : t({ message: "Send me a test", context: "Mail settings, test button" })}
        </button>
        {waiting && (
          <button type="button" onClick={() => void reload()} className={secondaryCls}>
            <Trans context="Mail settings, test check">Check again</Trans>
          </button>
        )}
        <button id={PAUSE_ALL_BUTTON_ID} type="button" onClick={flip} disabled={pausing} className={paused ? primaryCls : secondaryCls}>
          {pausing
            ? t({ message: "Saving...", context: "Mail settings, pause busy" })
            : paused
              ? t({ message: "Let email flow again", context: "Mail settings, pause button" })
              : t({ message: "Pause all automated email", context: "Mail settings, pause button" })}
        </button>
        <a href="/admin?tab=comms-sent" className={`${secondaryCls} inline-flex items-center`}>
          <Trans context="Mail settings, link to sent mail">Open Sent mail</Trans>
        </a>
      </div>

      {paused && (
        <p className="text-sm text-foreground">
          <Trans context="Mail settings, paused note">Gathering emails, path emails and letters are held in the queue. Password links, confirmations people asked for and member notices still go. A held email that runs past its time is dropped.</Trans>
        </p>
      )}
      {refused && (
        <p className="text-sm text-destructive" role="alert">{refused}</p>
      )}
    </section>
  );
}
