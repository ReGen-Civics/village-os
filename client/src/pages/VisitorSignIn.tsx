/**
 * A VISITOR SIGNS BACK IN (shared/visitorProfile.ts; the routes are server/routes/visitorProfile.ts).
 *
 * Their email, then the 6-digit code we send to it: no password to remember. A visitor who came by
 * Google signs back in with Google. The answer to the email step is the same whether or not we
 * know the address, so this page tells nobody who has been here.
 */
import { useEffect, useId, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { TOKEN_KEY } from "@/lib/gameApi";
import { writeStored } from "@/lib/safeStorage";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_FEATURED, EYEBROW, FIELD, HINT, LABEL, LEDE, LINK, STATEMENT, WORLD } from "@/components/journey/look";
import { CODE_LENGTH, cleanCode, safeNext } from "@shared/entrance";
import { useVerifiedVisitor } from "@/lib/entranceStatus";

export default function VisitorSignIn() {
  const { t } = useLingui();
  const ids = useId();
  const next = safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/visitor";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "alert" | "status"; text: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const already = useVerifiedVisitor(false); // this browser is already signed in as a visitor

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [sent]);

  const failed = () => t({ message: "That did not go through. Try again in a moment.", context: "portal entrance: a generic failure" });

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/visitor/sign-in", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setMessage({ tone: "alert", text: body?.message ?? failed() });
        return;
      }
      setSent(email.trim());
    } catch {
      setMessage({ tone: "alert", text: failed() });
    } finally {
      setBusy(false);
    }
  };

  const take = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const clean = cleanCode(code);
    if (!clean) {
      setMessage({ tone: "alert", text: t({ message: "The code is 6 digits.", context: "portal code step: the code is the wrong shape" }) });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/visitor/sign-in/code", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: clean }) });
      const body = (await res.json().catch(() => null)) as { message?: string; token?: string } | null;
      if (!res.ok) {
        setMessage({ tone: "alert", text: body?.message ?? failed() });
        return;
      }
      // An address that is a member's signs the member in; a visitor goes to their visit.
      if (body?.token) {
        writeStored("local", TOKEN_KEY, body.token);
        window.location.assign("/profile");
        return;
      }
      window.location.assign(next);
    } catch {
      setMessage({ tone: "alert", text: failed() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className={WORLD}>
        <main className="container flex max-w-2xl flex-col gap-8 py-12 sm:py-20" data-visitor-sign-in-page="">
          <section className={`${CARD_FEATURED} flex flex-col gap-6`} aria-labelledby={`${ids}-h`}>
            <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-notice text-notice" aria-hidden="true">
              <KeyRound className="size-6" />
            </span>
            <p className={EYEBROW}>{t({ message: "Your visit", context: "visitor sign-in: eyebrow" })}</p>
            <h1 id={`${ids}-h`} ref={heading} tabIndex={-1} className={`${STATEMENT} outline-none`}>
              {sent ? t({ message: "Type the code we emailed you", context: "portal code step: heading" }) : t({ message: "Sign back in with your email", context: "visitor sign-in: heading" })}
            </h1>
            <p className={LEDE}>
              {sent
                ? t({ message: `If ${sent} has a visitor profile here, a 6-digit code is on its way to it.`, context: "visitor sign-in: the code was asked for, naming the address" })
                : t({ message: "No password needed. We send a 6-digit code to the email you gave us when you entered.", context: "visitor sign-in: what happens" })}
            </p>
            {already && !sent && (
              <p className={HINT}>
                {t({ message: "This browser is already signed in as a visitor.", context: "visitor sign-in: already signed in" })}{" "}
                <a href="/visitor" className={LINK} data-visitor-open="">
                  {t({ message: "Open your visit", context: "visitor sign-in: link to the visitor profile" })}
                </a>
              </p>
            )}
            {message && (
              <p role={message.tone} className={message.tone === "alert" ? "rounded-xl border border-destructive/60 bg-muted p-4 text-sm text-foreground" : HINT}>
                {message.text}
              </p>
            )}
            {!sent ? (
              <form onSubmit={ask} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor={`${ids}-email`} className={LABEL}>
                    {t({ message: "Your email", context: "portal entrance: email field" })}
                  </label>
                  <input id={`${ids}-email`} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} className={`${FIELD} min-h-11`} />
                </div>
                <button type="submit" className={`${BTN_PRIMARY} text-base`} disabled={busy || !email.trim()} aria-busy={busy}>
                  {t({ message: "Send me a code", context: "visitor sign-in: the main button" })}
                </button>
              </form>
            ) : (
              <form onSubmit={take} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor={`${ids}-code`} className={LABEL}>
                    {t({ message: "Your code", context: "portal code step: the code field" })}
                  </label>
                  <input id={`${ids}-code`} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={CODE_LENGTH + 2} value={code} onChange={(e) => setCode(e.target.value)} className={`${FIELD} min-h-11 text-2xl tracking-widest`} />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="submit" className={`${BTN_PRIMARY} text-base`} disabled={busy} aria-busy={busy}>
                    {t({ message: "Sign in", context: "visitor sign-in: take the code" })}
                  </button>
                  <button type="button" className={BTN_SECONDARY} onClick={() => { setSent(null); setCode(""); setMessage(null); }}>
                    {t({ message: "Use a different email", context: "portal code step: change the address" })}
                  </button>
                </div>
              </form>
            )}
            <GoogleSignInButton next={next} portal label={t({ message: "Came in with Google? Continue with Google", context: "visitor sign-in: Google for a visitor who entered with it" })} />
            <p className={HINT}>
              {t({ message: "A member with a password?", context: "visitor sign-in: before the member sign-in link" })}{" "}
              <a href="/login" className={LINK}>
                {t({ message: "Sign in as a member", context: "visitor sign-in: link to the member sign-in" })}
              </a>
            </p>
          </section>
        </main>
      </div>
    </Layout>
  );
}
