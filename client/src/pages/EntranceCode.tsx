/**
 * THE CODE STEP (the lead, 24 Nov 2026: "a short look, then the code"). Shown by
 * components/EntranceGate.tsx in place of a page, on a page change, once the visitor's short look
 * is over. One calm screen in the entrance's look: the 6 digits we emailed, a way to send them
 * again after 30 seconds, a way to change the address, and Google instead.
 *
 * A correct code proves the address and keeps the visitor on the page they were opening. When the
 * address already had an account, the code signs it in, and the session is kept the way the
 * sign-in page keeps one.
 */
import { useEffect, useId, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { TOKEN_KEY } from "@/lib/gameApi";
import { writeStored } from "@/lib/safeStorage";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_FEATURED, EYEBROW, FIELD, HINT, LABEL, LEDE, LINK, STATEMENT, WORLD } from "@/components/journey/look";
import { CODE_LENGTH, RESEND_AFTER_MS, cleanCode } from "@shared/entrance";

export default function EntranceCode({ sentTo, next, onChangeEmail }: { sentTo: string; next: string; onChangeEmail: () => void }) {
  const { t } = useLingui();
  const ids = useId();
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "alert" | "status"; text: string } | null>(null);
  const [waitUntil, setWaitUntil] = useState(() => Date.now() + RESEND_AFTER_MS);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (nowMs >= waitUntil) return;
    const timer = setTimeout(() => setNowMs(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [nowMs, waitUntil]);

  const secondsLeft = Math.max(0, Math.ceil((waitUntil - nowMs) / 1000));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const clean = cleanCode(code);
    if (!clean) {
      setMessage({ tone: "alert", text: t({ message: "The code is 6 digits.", context: "portal code step: the code is the wrong shape" }) });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/entrance/code", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: clean }) });
      const body = (await res.json().catch(() => null)) as { message?: string; token?: string } | null;
      if (!res.ok) {
        setMessage({ tone: "alert", text: body?.message ?? t({ message: "That did not go through. Try again in a moment.", context: "portal entrance: a generic failure" }) });
        return;
      }
      // An address that already had an account is signed in by its code.
      if (body?.token) writeStored("local", TOKEN_KEY, body.token);
      // A full load of the page they were opening, so every read starts again with the address proved.
      window.location.assign(next);
    } catch {
      setMessage({ tone: "alert", text: t({ message: "That did not go through. Check your connection and try again.", context: "portal entrance: the network failed" }) });
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/entrance/code/resend", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setMessage({ tone: "alert", text: body?.message ?? t({ message: "That did not go through. Try again in a moment.", context: "portal entrance: a generic failure" }) });
        return;
      }
      setWaitUntil(Date.now() + RESEND_AFTER_MS);
      setNowMs(Date.now());
      setMessage({ tone: "status", text: t({ message: `A new code is on its way to ${sentTo}.`, context: "portal code step: a new code was sent" }) });
    } catch {
      setMessage({ tone: "alert", text: t({ message: "That did not go through. Check your connection and try again.", context: "portal entrance: the network failed" }) });
    }
  };

  return (
    <Layout>
      <div className={WORLD}>
        <main className="container flex max-w-2xl flex-col gap-8 py-12 sm:py-20" data-entrance-code="">
          <form onSubmit={submit} noValidate className={`${CARD_FEATURED} flex flex-col gap-6`} aria-labelledby={`${ids}-h`}>
            <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-notice text-notice" aria-hidden="true">
              <KeyRound className="size-6" />
            </span>
            <p className={EYEBROW}>{t({ message: "One more step", context: "portal code step: eyebrow" })}</p>
            <h1 id={`${ids}-h`} ref={heading} tabIndex={-1} className={`${STATEMENT} outline-none`}>
              {t({ message: "Type the code we emailed you", context: "portal code step: heading" })}
            </h1>
            <p className={LEDE}>
              {t({ message: `We sent a 6-digit code to ${sentTo}. Type it here to keep exploring.`, context: "portal code step: what to do, naming the address" })}
            </p>
            {message && (
              <p role={message.tone} className={message.tone === "alert" ? "rounded-xl border border-destructive/60 bg-muted p-4 text-sm text-foreground" : HINT}>
                {message.text}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor={`${ids}-code`} className={LABEL}>
                {t({ message: "Your code", context: "portal code step: the code field" })}
              </label>
              <input
                id={`${ids}-code`}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH + 2}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${FIELD} min-h-11 text-2xl tracking-widest`}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="submit" className={`${BTN_PRIMARY} text-base`} disabled={sending} aria-busy={sending}>
                {t({ message: "Keep exploring", context: "portal code step: the main button" })}
              </button>
              <button type="button" className={BTN_SECONDARY} disabled={secondsLeft > 0} onClick={() => void resend()}>
                {secondsLeft > 0
                  ? t({ message: `Send a new code in ${secondsLeft} s`, context: "portal code step: resend, counting down" })
                  : t({ message: "Send a new code", context: "portal code step: resend" })}
              </button>
            </div>
            <p className={HINT}>
              <button type="button" className={LINK} onClick={onChangeEmail}>
                {t({ message: "Use a different email", context: "portal code step: change the address" })}
              </button>
            </p>
            <GoogleSignInButton next={next} portal label={t({ message: "Use Google instead", context: "portal code step: Google instead" })} />
          </form>
        </main>
      </div>
    </Layout>
  );
}
