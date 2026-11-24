/**
 * THE ENTRANCE TO THE PORTAL (the lead, 24 Nov 2026): "a beautiful entrance to entering the portal
 * of the game". One calm screen in front of the roles, the game and the village's inner life,
 * shown to a visitor who is not signed in and has not entered on this device. The contract and the
 * lists of what it stands in front of are shared/entrance.ts; components/EntranceGate.tsx decides
 * when it shows.
 *
 * Name and email are asked for; a WhatsApp number and a website or social link are offered; the box
 * for updates starts unticked. The human check is Cloudflare Turnstile while the village has it set
 * up, and otherwise a field no person sees plus the time the form was on screen. After entry the
 * page reloads onto where the visitor was going, so every read on it starts again with the entry.
 *
 * "What draws you here?" is optional and offers five plain answers (shared/entrance.ts, `INTERESTS`);
 * nothing ranks or sorts a visitor by it.
 *
 * THE PRIVACY LINE IS FOR LEGAL REVIEW (Costa Rica, Law 8968: informed consent, a stated purpose, a
 * way to ask for deletion). The words the visitor saw are posted with the form and kept beside the
 * entry, so the record shows what each person agreed to.
 */
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, DoorOpen } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { useVillageName } from "@/hooks/useVillageName";
import { useVillageLinks } from "@/lib/gameApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_FEATURED, EYEBROW, FIELD, H1, HINT, LABEL, LEDE, LINK, TICK, WORLD } from "@/components/journey/look";
import { INTERESTS, safeNext, type EntranceProblem, type Interest } from "@shared/entrance";

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

export default function Entrance({ next, siteKey }: { next: string; siteKey: string | null }) {
  const { t, i18n } = useLingui();
  const village = useVillageName();
  const { contactEmail } = useVillageLinks();
  const ids = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [link, setLink] = useState("");
  const [updates, setUpdates] = useState(false);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ field: EntranceProblem | null; message: string } | null>(null);
  const shownAt = useRef(Date.now());
  const privacy = useRef<HTMLParagraphElement>(null);
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
          updates,
          interest,
          next,
          locale: i18n.locale,
          turnstileToken: token,
          website,
          shownAt: shownAt.current,
          consentWords: privacy.current?.textContent ?? "",
        }),
      });
      const body = (await res.json().catch(() => null)) as { next?: string | null; field?: EntranceProblem; message?: string } | null;
      if (!res.ok) {
        setError({ field: body?.field ?? null, message: body?.message ?? t({ message: "That did not go through. Try again in a moment.", context: "portal entrance: a generic failure" }) });
        if (siteKey && window.turnstile) window.turnstile.reset();
        setToken("");
        return;
      }
      // A full load, so every read on the next page starts again with the entry in hand.
      window.location.assign(safeNext(body?.next) ?? safeNext(next) ?? "/");
    } catch {
      setError({ field: null, message: t({ message: "That did not go through. Check your connection and try again.", context: "portal entrance: the network failed" }) });
    } finally {
      setSending(false);
    }
  };

  const interestWords: Record<Interest, string> = {
    seeder: t({ message: "Becoming a founding seeder", context: "portal entrance: what draws you, a founding seeder" }),
    home: t({ message: "A home here", context: "portal entrance: what draws you, a home" }),
    visit: t({ message: "Visiting", context: "portal entrance: what draws you, a visit" }),
    role: t({ message: "A role on the team", context: "portal entrance: what draws you, a role" }),
    curious: t({ message: "Just curious", context: "portal entrance: what draws you, curiosity" }),
  };

  const invalid = (f: EntranceProblem) => (error?.field === f ? { "aria-invalid": true, "aria-describedby": `${ids}-error` } : {});
  const signIn = `/login?next=${encodeURIComponent(next)}`;

  return (
    <Layout>
      <div className={WORLD}>
        <main className="container flex max-w-2xl flex-col gap-8 py-12 sm:py-20" data-entrance="">
          <header className="flex flex-col gap-4">
            <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-notice text-notice" aria-hidden="true">
              <DoorOpen className="size-6" />
            </span>
            <p className={EYEBROW}>{t({ message: "The portal", context: "portal entrance: eyebrow" })}</p>
            <h1 className={H1}>{t({ message: `Welcome to ${village}`, context: "portal entrance: heading, with the village's name" })}</h1>
            <p className={LEDE}>
              {t({
                message: "Just inside are the village's roles, its game and the work of building it together. Tell us who you are and the way opens.",
                context: "portal entrance: what is inside, and what is asked",
              })}
            </p>
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
                {t({ message: "Your name", context: "portal entrance: name field" })}
              </label>
              <input id={fieldId("name")} name="name" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={`${FIELD} min-h-11`} {...invalid("name")} />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor={fieldId("email")} className={LABEL}>
                {t({ message: "Your email", context: "portal entrance: email field" })}
              </label>
              <input id={fieldId("email")} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} className={`${FIELD} min-h-11`} {...invalid("email")} />
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

            <label htmlFor={fieldId("updates")} className="flex min-h-11 cursor-pointer items-start gap-3">
              <input id={fieldId("updates")} type="checkbox" className={`${TICK} mt-0.5`} checked={updates} onChange={(e) => setUpdates(e.target.checked)} />
              <span className="text-base text-foreground">
                {t({ message: `Send me occasional updates about ${village} by email.`, context: "portal entrance: the updates box, unticked by default" })}
              </span>
            </label>

            {siteKey && <HumanCheck siteKey={siteKey} onToken={setToken} locale={i18n.locale} />}

            <p ref={privacy} className={HINT}>
              {contactEmail
                ? t({
                    message: `We keep what you type here so we know who is exploring ${village} and can follow up about what draws you here. If you tick the box, we also add you to our email list, kept with an email service, for occasional updates. We never sell it. To see it or have it deleted, write to ${contactEmail}.`,
                    context: "portal entrance: the privacy line, with the village's contact address, naming the follow-up and the email list",
                  })
                : t({
                    message: `We keep what you type here so we know who is exploring ${village} and can follow up about what draws you here. If you tick the box, we also add you to our email list, kept with an email service, for occasional updates. We never sell it. To see it or have it deleted, ask anyone at the village.`,
                    context: "portal entrance: the privacy line, when the village has no contact address, naming the follow-up and the email list",
                  })}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="submit" className={`${BTN_PRIMARY} text-base`} disabled={sending} aria-busy={sending}>
                {sending ? t({ message: "Opening the way", context: "portal entrance: the button while sending" }) : t({ message: "Enter", context: "portal entrance: the main button" })}
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
              <a href={signIn} className={BTN_SECONDARY}>
                {t({ message: "I have an account: sign in", context: "portal entrance: the second act, for members" })}
              </a>
            </div>
          </form>

          <p className={HINT}>
            {t({ message: "Looking for the public pages? They are all open.", context: "portal entrance: the brochure stays open" })}{" "}
            <a href="/" className={LINK}>
              {t({ message: "Back to the home page", context: "portal entrance: link home" })}
            </a>
          </p>
        </main>
      </div>
    </Layout>
  );
}
