/**
 * THE ENTRANCE TO THE PORTAL (the lead, 24 Nov 2026): "a beautiful entrance to entering the portal
 * of the game". One calm screen in front of the roles, the game and the village's inner life,
 * shown to a visitor who is not signed in and has not entered on this device. The contract and the
 * lists of what it stands in front of are shared/entrance.ts; components/EntranceGate.tsx decides
 * when it shows.
 *
 * Name and email are asked for; a WhatsApp number and a website or social link are offered. Then, on
 * a step of its own, one question with two buttons: "Do you want us to keep you updated, and to hear
 * about opportunities?" Yes, No, or leaving without answering are all kept as they are, and only a
 * yes ever reaches a list (the lead, 24 Nov 2026: two buttons, no box to tick).
 *
 * TWO DOORS (the lead, 24 Nov 2026, "a short look, then the code"): the form, or "Continue with
 * Google", which proves the address on the spot. While the village can send email, the form's
 * address gets a 6-digit code; the visitor goes in at once and is told so plainly, and the code is
 * asked for after a short look (components/EntranceGate.tsx, pages/EntranceCode.tsx). The email
 * field suggests a likely typo (`gmial.com`); a throwaway inbox and a domain that takes no mail are
 * refused by the server with a sentence. The human check is Cloudflare Turnstile while the village has it set
 * up, and otherwise a field no person sees plus the time the form was on screen. After the answer the
 * page reloads onto the page the visitor first asked for (`next`; `/roles` lands on `/roles`), so every read on it starts again with the entry.
 *
 * "What draws you here?" is optional and offers five plain answers (shared/entrance.ts, `INTERESTS`);
 * nothing ranks or sorts a visitor by it.
 *
 * THE PRIVACY LINE IS FOR LEGAL REVIEW (Costa Rica, Law 8968: informed consent, a stated purpose, a
 * way to ask for deletion). The words the visitor saw are posted with the form and kept beside the
 * entry, so the record shows what each person agreed to.
 */
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, DoorOpen, Mail } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { useVillageName } from "@/hooks/useVillageName";
import { useVillageLinks } from "@/lib/gameApi";
import EntranceBackdrop, { FLOATING } from "@/components/EntranceBackdrop";
import type { EntranceBackdrop as EntranceBackdropValue } from "@shared/entrance";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_FEATURED, EYEBROW, FIELD, H1, HINT, LABEL, LEDE, LINK, STATEMENT, WORLD } from "@/components/journey/look";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { suggestEmail } from "@shared/emailCheck";
import { INTERESTS, safeNext, type EntranceProblem, type Interest, type UpdatesAnswer } from "@shared/entrance";

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void; theme?: string; language?: string }): string;
      reset(id?: string): void;
      remove(id?: string): void;
    };
  }
}

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`);
  return new Promise((resolve, reject) => {
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile")));
    if (!existing) {
      s.src = TURNSTILE_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

/** The Turnstile widget, rendered once the script arrives. Answers its token through `onToken`. */
function HumanCheck({ siteKey, onToken, locale }: { siteKey: string; onToken: (token: string) => void; locale: string }) {
  const { t } = useLingui();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let id: string | undefined;
    let live = true;
    loadTurnstile()
      .then(() => {
        if (!live || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => setFailed(true),
          theme: "auto",
          language: locale,
        });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, onToken, locale]);
  return (
    <div className="flex flex-col gap-2">
      <div ref={box} className="min-h-16" />
      {failed && (
        <p role="alert" className={HINT}>
          {t({ message: "The check that you are a person did not load. Reload the page to try again.", context: "portal entrance: the human check failed to load" })}
        </p>
      )}
    </div>
  );
}

export default function Entrance({ next, siteKey, privacyContact = "", codes = false, backdrop = null }: { next: string; siteKey: string | null; privacyContact?: string; codes?: boolean; backdrop?: EntranceBackdropValue | null }) {
  const { t, i18n } = useLingui();
  const village = useVillageName();
  const { contactEmail, siteUrl } = useVillageLinks();
  /** Who to write to about what is kept: the village's own privacy contact, else its contact address. */
  const contact = privacyContact.trim() || contactEmail;
  const ids = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [link, setLink] = useState("");
  /** Where to go once in: set when the entry is kept, which opens the keep-in-touch step. */
  const [goTo, setGoTo] = useState<string | null>(null);
  /** The address a code went to, when one did. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ field: EntranceProblem | null; message: string } | null>(null);
  const shownAt = useRef(Date.now());
  const privacy = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const fieldId = (f: string) => `${ids}-${f}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (siteKey && !token) {
      setError({ field: null, message: t({ message: "Finish the check that you are a person first.", context: "portal entrance: the human check is not done yet" }) });
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/entrance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          whatsapp,
          link,
          interest,
          next,
          locale: i18n.locale,
          turnstileToken: token,
          website,
          shownAt: shownAt.current,
          consentWords: Array.from(privacy.current?.querySelectorAll("p, li") ?? []).map((p) => p.textContent ?? "").join("\n\n"),
        }),
      });
      const body = (await res.json().catch(() => null)) as { next?: string | null; field?: EntranceProblem; message?: string; code?: { sentTo: string } | null } | null;
      if (!res.ok) {
        setError({ field: body?.field ?? null, message: body?.message ?? t({ message: "That did not go through. Try again in a moment.", context: "portal entrance: a generic failure" }) });
        if (siteKey && window.turnstile) window.turnstile.reset();
        setToken("");
        return;
      }
      // The entry is kept and the cookie set; the keep-in-touch question is the next step.
      setSentTo(body?.code?.sentTo ?? null);
      setGoTo(safeNext(body?.next) ?? safeNext(next) ?? "/");
    } catch {
      setError({ field: null, message: t({ message: "That did not go through. Check your connection and try again.", context: "portal entrance: the network failed" }) });
    } finally {
      setSending(false);
    }
  };

  const interestWords: Record<Interest, string> = {
    seeder: t({ message: 'Becoming a "Founding Seeder"', context: "portal entrance: what draws you, a founding seeder" }),
    home: t({ message: "A home here", context: "portal entrance: what draws you, a home" }),
    visit: t({ message: "Visiting", context: "portal entrance: what draws you, a visit" }),
    role: t({ message: "A role on our team", context: "portal entrance: what draws you, a role" }),
    curious: t({ message: "Just curious", context: "portal entrance: what draws you, curiosity" }),
  };

  const siteHost = hostOf(siteUrl);

  if (goTo) return <KeepInTouch village={village} goTo={goTo} sentTo={sentTo} />;

  const invalid = (f: EntranceProblem) => (error?.field === f ? { "aria-invalid": true, "aria-describedby": `${ids}-error` } : {});
  const signIn = `/login?next=${encodeURIComponent(next)}`;

  return (
    <Layout>
      <div className={WORLD}>
        {backdrop && <EntranceBackdrop backdrop={backdrop} />}
        <section className={`container flex max-w-2xl flex-col gap-8 py-12 sm:py-20 ${backdrop ? FLOATING : ""}`} data-entrance="">
          <header className="flex flex-col gap-4">
            <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-notice text-notice" aria-hidden="true">
              <DoorOpen className="size-6" />
            </span>
            <p className={EYEBROW}>{t({ message: "The portal", context: "portal entrance: eyebrow" })}</p>
            <h1 className={H1}>{t({ message: `Welcome to ${village}`, context: "portal entrance: heading, with the village's name" })}</h1>
            <p className={LEDE}>
              {t({
                message: 'Just inside are the village\'s roles, its "game" and the work of building it together. We share a lot about who we are and how we co-create, so we\'d like to know a bit about you too!',
                context: "portal entrance: what is inside, and what is asked",
              })}
            </p>
            {siteHost && (
              <p className={HINT}>
                {t({ message: "To know more about us, visit", context: "portal entrance: before the link to the village's public site" })}{" "}
                <a href={siteUrl} className={LINK}>
                  {siteHost}
                </a>
                .{" "}
                {t({ message: "This is our game, where we co-create the village.", context: "portal entrance: what this site is, after the link to the public site" })}
              </p>
            )}
          </header>

          <form onSubmit={submit} noValidate className={`${CARD_FEATURED} flex flex-col gap-6`} aria-labelledby={`${ids}-form-heading`}>
            <h2 id={`${ids}-form-heading`} className="sr-only">
              {t({ message: "Enter the portal", context: "portal entrance: the form's name for screen readers" })}
            </h2>
            {error && (
              <p id={`${ids}-error`} ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-destructive/60 bg-muted p-4 text-sm text-foreground outline-none">
                {error.message}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor={fieldId("name")} className={LABEL}>
                {t({ message: "Name or Nickname", context: "portal entrance: name field" })}
              </label>
              <input id={fieldId("name")} name="name" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={`${FIELD} min-h-11`} {...invalid("name")} />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor={fieldId("email")} className={LABEL}>
                {t({ message: "Your email", context: "portal entrance: email field" })}
              </label>
              <input id={fieldId("email")} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={320} value={email} onChange={(e) => { setEmail(e.target.value); setSuggestion(null); }} onBlur={() => setSuggestion(suggestEmail(email.trim()))} className={`${FIELD} min-h-11`} {...invalid("email")} />
              {suggestion && (
                <p className={HINT}>
                  {t({ message: "Did you mean", context: "portal entrance: before a suggested email address" })}{" "}
                  <button type="button" className={LINK} onClick={() => { setEmail(suggestion); setSuggestion(null); }}>
                    {suggestion}
                  </button>
                  ?
                </p>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor={fieldId("whatsapp")} className={LABEL}>
                  {t({ message: "WhatsApp number", context: "portal entrance: optional WhatsApp field" })}{" "}
                  <span className="font-normal text-muted-foreground">{t({ message: "(optional)", context: "portal entrance: marks a field as optional" })}</span>
                </label>
                <input id={fieldId("whatsapp")} name="whatsapp" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={`${FIELD} min-h-11`} {...invalid("whatsapp")} />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor={fieldId("link")} className={LABEL}>
                  {t({ message: "Website or social link", context: "portal entrance: optional link field" })}{" "}
                  <span className="font-normal text-muted-foreground">{t({ message: "(optional)", context: "portal entrance: marks a field as optional" })}</span>
                </label>
                <input id={fieldId("link")} name="link" autoComplete="url" inputMode="url" maxLength={500} value={link} onChange={(e) => setLink(e.target.value)} className={`${FIELD} min-h-11`} {...invalid("link")} />
              </div>
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className={`${LABEL} mb-3`}>
                {t({ message: "What draws you here?", context: "portal entrance: the optional interest question" })}{" "}
                <span className="font-normal text-muted-foreground">{t({ message: "(optional)", context: "portal entrance: marks a field as optional" })}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((k) => (
                  <label
                    key={k}
                    className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${interest === k ? "border-notice bg-notice text-background" : "border-border bg-muted text-foreground hover:border-notice"}`}
                  >
                    <input type="radio" name="interest" value={k} checked={interest === k} onChange={() => setInterest(k)} className="sr-only" />
                    {interestWords[k]}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* A field no person sees or fills: the fallback check's half (shared/entrance.ts). */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor={fieldId("website")}>{t({ message: "Leave this empty", context: "portal entrance: a hidden field only bots fill" })}</label>
              <input id={fieldId("website")} name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {siteKey && <HumanCheck siteKey={siteKey} onToken={setToken} locale={i18n.locale} />}

            {/* The lead's own words (24 Nov 2026), as a list since 25 Nov at the lead's ask. For legal review (Law 8968). */}
            <div ref={privacy} className={`${HINT} flex flex-col gap-2`} data-privacy="">
              <p>{t({ message: "Hi friend:", context: "portal entrance: the privacy list, its greeting" })}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>{t({ message: "We keep what you type here, so it's saved for you.", context: "portal entrance: the privacy list, what you type" })}</li>
                <li>
                  {t({
                    message: `We note which pages you open while you explore, so we know who is visiting ${village} and can follow up with you.`,
                    context: "portal entrance: the privacy list, the pages opened, with the village's name",
                  })}
                </li>
                {codes && (
                  <li>
                    {t({
                      message: "We email you a code to confirm your address, which you need to do if you want to go further in the process and stay in touch.",
                      context: "portal entrance: the privacy list, the code by email, shown only while the village sends codes",
                    })}
                  </li>
                )}
                <li>{t({ message: "If you say yes to updates on the next step, we also add you to our email list, kept with an email service.", context: "portal entrance: the privacy list, the email list" })}</li>
                <li>{t({ message: "We never sell any of it.", context: "portal entrance: the privacy list, never sold" })}</li>
                <li>
                  {contact
                    ? t({ message: `To see it or have it deleted, write to ${contact}.`, context: "portal entrance: the privacy line, how to see or delete it, with the village's privacy contact" })
                    : t({ message: "To see it or have it deleted, ask anyone at the village.", context: "portal entrance: the privacy line, how to see or delete it, when the village has no contact address" })}
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="submit" className={`${BTN_PRIMARY} text-base`} disabled={sending} aria-busy={sending}>
                {sending ? t({ message: "Opening the way", context: "portal entrance: the button while sending" }) : t({ message: "Enter", context: "portal entrance: the main button" })}
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
              <a href={signIn} className={BTN_SECONDARY}>
                {t({ message: "I have an account: sign in", context: "portal entrance: the second act, for members" })}
              </a>
            </div>
            <p className={HINT}>
              {t({ message: "Been here before?", context: "portal entrance: before the returning visitor's link" })}{" "}
              <a href={`/visitor/sign-in?next=${encodeURIComponent(next)}`} className={LINK} data-visitor-return="">
                {t({ message: "Sign back in with a code", context: "portal entrance: a returning visitor signs in by email code" })}
              </a>
            </p>
            <GoogleSignInButton next={next} portal />
          </form>

        </section>
      </div>
    </Layout>
  );
}

/** The site's host for the visible link text (`amora.example`), or "" when the village has no site. */
function hostOf(url: string): string {
  try {
    return url ? new URL(url).host.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

/**
 * The keep-in-touch step: one question, two buttons, after the entry is kept. Either answer is
 * stored with the words shown, and either one opens the way on to the page first asked for.
 */
export function KeepInTouch({ village, goTo, sentTo = null }: { village: string; goTo: string; sentTo?: string | null }) {
  const { t } = useLingui();
  const ids = useId();
  const question = useRef<HTMLHeadingElement>(null);
  const [sending, setSending] = useState<UpdatesAnswer | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // The step replaces the form in place; start it at the top, where its question is.
    window.scrollTo({ top: 0 });
    question.current?.focus({ preventScroll: true });
  }, []);

  const answer = async (a: UpdatesAnswer) => {
    if (sending) return;
    setSending(a);
    setFailed(false);
    try {
      const res = await fetch("/api/entrance/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: a, words: question.current?.textContent ?? "" }),
      });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      // A full load, so every read on the next page starts again with the entry in hand.
      window.location.assign(goTo);
    } catch {
      setFailed(true);
    } finally {
      setSending(null);
    }
  };

  return (
    <Layout>
      <div className={WORLD}>
        <section className="container flex max-w-2xl flex-col gap-8 py-12 sm:py-20" data-entrance-updates="">
          <section className={`${CARD_FEATURED} flex flex-col gap-6`} aria-labelledby={`${ids}-q`}>
            <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-notice text-notice" aria-hidden="true">
              <Mail className="size-6" />
            </span>
            {sentTo && (
              <p className={LEDE} data-code-sent="">
                {t({
                  message: `We have sent a 6-digit code to ${sentTo}. Have a look around. You will need the code to keep exploring.`,
                  context: "portal entrance: told up front that a code was emailed, before the keep-in-touch question",
                })}
              </p>
            )}
            <h1 id={`${ids}-q`} ref={question} tabIndex={-1} className={`${STATEMENT} outline-none`}>
              {t({ message: `Do you want us to keep you updated, and to hear about opportunities from ${village}?`, context: "portal entrance: the keep-in-touch question, its own step after entering" })}
            </h1>
            {failed && (
              <p role="alert" className="rounded-xl border border-destructive/60 bg-muted p-4 text-sm text-foreground">
                {t({ message: "That did not go through. Try again in a moment.", context: "portal entrance: a generic failure" })}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className={`${BTN_PRIMARY} text-base`} disabled={!!sending} aria-busy={sending === "yes"} onClick={() => void answer("yes")} data-answer="yes">
                {t({ message: "Yes", context: "portal entrance: the keep-in-touch answer yes" })}
              </button>
              <button type="button" className={`${BTN_SECONDARY} text-base`} disabled={!!sending} aria-busy={sending === "no"} onClick={() => void answer("no")} data-answer="no">
                {t({ message: "No", context: "portal entrance: the keep-in-touch answer no" })}
              </button>
            </div>
          </section>
        </section>
      </div>
    </Layout>
  );
}
