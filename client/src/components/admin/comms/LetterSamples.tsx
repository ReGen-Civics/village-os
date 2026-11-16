/**
 * LETTERS AS THEY ARRIVE, on the Words screen: the letters written in code
 * (the applicant letters and a member email with the come-and-play footer,
 * shared/comms/letterSamples.ts), rendered by the server in this village's
 * look with a made-up reader, and a way to send any of them to yourself.
 *
 * The routes are `GET /api/admin/comms/letter-previews` and
 * `POST /api/admin/comms/letter-previews/send` (server/routes/commsWords.ts).
 * The send goes to the signed-in admin's own account address and nowhere
 * else; this screen never asks for an address, and the server would not read
 * one. Each letter sits in a sandboxed frame with no permissions, like the
 * Words preview (WordsPreview.tsx).
 *
 * Loaded lazily from CommsWords.tsx, so its code costs nothing until the
 * Words screen opens. Colours come from the palette tokens, so the card
 * follows the village's Admin palette.
 */
import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { fetchSampleLetters, sendSampleLetters, type SampleLetter, type SampleLetterResult } from "./wordsApi";

type Notice = { tone: "ok" | "error"; text: string };

export default function LetterSamples({ password }: { password: string }) {
  const { t } = useLingui();
  const [letters, setLetters] = useState<SampleLetter[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let live = true;
    fetchSampleLetters(password).then((answer) => {
      if (!live) return;
      if (answer.ok) setLetters(answer.body.letters);
      else setError(answer.error);
    });
    return () => {
      live = false;
    };
  }, [password]);

  const outcome = (sentTo: string, results: SampleLetterResult[]): Notice => {
    const sent = results.filter((r) => r.status === "sent").length;
    if (sent === results.length) {
      return {
        tone: "ok",
        text:
          sent === 1
            ? t({ message: `Sent to ${sentTo}. It should arrive in a minute or two.`, context: "admin letter samples" })
            : t({ message: `${sent} letters sent to ${sentTo}. They should arrive in a minute or two.`, context: "admin letter samples" }),
      };
    }
    const reason = results.find((r) => r.status !== "sent")?.reason;
    if (reason === "no_api_key") {
      return { tone: "error", text: t({ message: "Not sent: the village has no email provider key yet. Add it in Comms Settings.", context: "admin letter samples" }) };
    }
    if (reason === "no_sender") {
      return { tone: "error", text: t({ message: "Not sent: the village has no sender address yet. Add it in Comms Settings.", context: "admin letter samples" }) };
    }
    const failed = results.length - sent;
    return {
      tone: "error",
      text: t({ message: `${failed} of ${results.length} did not go out. Sent mail has the details.`, context: "admin letter samples" }),
    };
  };

  const send = async (keys: string[] | null) => {
    setBusy(keys ? keys[0] : "all");
    setNotice(null);
    const answer = await sendSampleLetters(password, keys);
    setBusy(null);
    if (!answer.ok) return setNotice({ tone: "error", text: answer.error });
    setNotice(outcome(answer.body.sentTo, answer.body.results));
  };

  return (
    <section aria-labelledby="letter-samples-title" className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="letter-samples-title" className="text-lg font-semibold text-foreground">
            <Trans context="admin letter samples">Letters as they arrive</Trans>
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            <Trans context="admin letter samples">
              The letters the platform writes for you, in your village's look, with a made-up reader. Send any of them to your own inbox
              to see it the way an applicant or member will.
            </Trans>
          </p>
        </div>
        <button
          type="button"
          onClick={() => send(null)}
          disabled={!letters || busy !== null}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy === "all" ? t({ message: "Sending...", context: "admin letter samples" }) : t({ message: "Send all to me", context: "admin letter samples" })}
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-sage-light text-open" : "bg-destructive/10 text-destructive"}`}
        >
          {notice.text}
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {!letters && !error && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          <Trans context="admin letter samples">Loading the letters...</Trans>
        </p>
      )}

      {letters && (
        <ul className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {letters.map((letter) => (
            <li key={letter.id} className="min-w-0 rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{letter.label}</p>
                  <p className="truncate text-xs text-muted-foreground" title={letter.subject}>
                    {letter.subject}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => send([letter.id])}
                  disabled={busy !== null}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {busy === letter.id
                    ? t({ message: "Sending...", context: "admin letter samples" })
                    : t({ message: "Send me a test", context: "admin letter samples" })}
                </button>
              </div>
              <iframe
                title={letter.label}
                srcDoc={letter.html}
                sandbox=""
                loading="lazy"
                className="block h-96 w-full rounded-b-lg bg-card"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
