/**
 * "NOTIFY ME" ON A COMING-SOON ROLE (the lead, Anchor session of 19 Nov 2026; shared/roleWaitlist.ts).
 *
 * An email, an optional WhatsApp number and which coming-soon roles interest the person, with one line on
 * what the details are for. Kept privately and read by admins only; nothing is sent from it and no one is
 * chosen from it. Loaded when a reader opens it, so it rides no route's first view.
 */
import { useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { BTN_PRIMARY, FIELD, HINT, LABEL, TICK } from "@/components/journey/look";
import ContributorRoutes from "@/components/ContributorRoutes";

export interface WaitlistRole {
  id: string;
  name: string;
}

export default function WaitlistForm({ roles, chosen }: { roles: WaitlistRole[]; chosen: string }) {
  const { t } = useLingui();
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  // Unticked by default: the village writes only to people who say yes.
  const [consent, setConsent] = useState(false);
  const [picked, setPicked] = useState<string[]>(chosen ? [chosen] : []);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [badField, setBadField] = useState<string | null>(null);
  // The server's refusal, in the reader's language and on its field (applicant reviewer, 24 Nov 2026).
  const fieldProblem = (field: unknown): string | null =>
    field === "email"
      ? t({ message: "Write an email address, like name@example.org.", context: "coming-soon waitlist: the email was refused" })
      : field === "whatsapp"
        ? t({ message: "Write the WhatsApp number with its country code, like +506 8888 8888, or leave it empty.", context: "coming-soon waitlist: the WhatsApp number was refused" })
        : field === "roleIds"
          ? t({ message: "Choose at least one role that is coming soon.", context: "coming-soon waitlist: no role chosen" })
          : null;

  if (state === "done") {
    return (
      <div className="grid gap-4">
        <p role="status" className="rounded-xl border border-notice/50 bg-muted px-4 py-3 text-card-foreground" data-waitlist-done="">
          {consent
            ? t({ message: "Thank you. Your details are saved. We will write when the role opens.", context: "coming-soon waitlist: after signing up" })
            : t({ message: "Thank you. Your details are saved. We will not write to you unless you tick the box next time.", context: "coming-soon waitlist: after signing up without the tick" })}
        </p>
        {/* While you wait, you can also (the lead, 23 Nov 2026): the other three ways to build. */}
        <ContributorRoutes variant="links" except={["team"]} heading={t({ message: "While you wait, you can also", context: "after an application or a waitlist sign-up: the other ways to build" })} />
      </div>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    setBadField(null);
    setState("sending");
    try {
      const r = await gameFetch("/api/roles/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, whatsapp, roleIds: picked, consent }) });
      if (r.ok) return setState("done");
      const d = await r.json().catch(() => ({}));
      const onField = r.status === 400 ? fieldProblem(d?.field) : null;
      if (onField) setBadField(String(d.field));
      // On a phone the line under the form sits below the screen and the tab bar: the field that needs a look, or the
      // line itself, comes into view, so a refusal is never a press that seemed to do nothing.
      requestAnimationFrame(() => {
        const target = document.getElementById(onField && d.field === "email" ? `${base}-email` : onField && d.field === "whatsapp" ? `${base}-wa` : `${base}-problem`);
        target?.scrollIntoView?.({ block: "center" });
        if (target instanceof HTMLInputElement) target.focus({ preventScroll: true });
      });
      setProblem(r.status === 429 ? t({ message: "Too many sign-ups from here just now. Please try again in an hour.", context: "coming-soon waitlist: rate limited" }) : (onField ?? t({ message: "That did not save. Please try again.", context: "coming-soon waitlist: failed" })));
    } catch {
      setProblem(t({ message: "That did not save. Please try again.", context: "coming-soon waitlist: failed" }));
    }
    setState("idle");
  };

  return (
    <form onSubmit={send} className="grid gap-3" data-waitlist-form="">
      <label className="grid gap-1">
        <span className={LABEL}>{t({ message: "Email", context: "coming-soon waitlist field" })}</span>
        <input id={`${base}-email`} type="email" required autoComplete="email" inputMode="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={badField === "email" || undefined} />
      </label>
      <label className="grid gap-1">
        <span className={LABEL}>{t({ message: "WhatsApp number (optional)", context: "coming-soon waitlist field" })}</span>
        <input id={`${base}-wa`} type="tel" autoComplete="tel" className={FIELD} value={whatsapp} maxLength={80} onChange={(e) => setWhatsapp(e.target.value)} aria-invalid={badField === "whatsapp" || undefined} />
      </label>
      {roles.length > 0 && (
        <fieldset className="grid gap-1.5">
          <legend className={LABEL}>{t({ message: "Which roles interest you", context: "coming-soon waitlist field" })}</legend>
          {roles.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-2 text-card-foreground" htmlFor={`${base}-${r.id}`}>
              <input id={`${base}-${r.id}`} type="checkbox" className={TICK} checked={picked.includes(r.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} />
              {r.name}
            </label>
          ))}
        </fieldset>
      )}
      <label className="flex min-h-11 items-start gap-2 text-card-foreground" htmlFor={`${base}-consent`}>
        <input id={`${base}-consent`} type="checkbox" className={`mt-0.5 ${TICK}`} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{t({ message: "Yes, write to me about this role and other ways into the village. One click takes me off.", context: "coming-soon waitlist: the consent tick" })}</span>
      </label>
      <p className={HINT}>{t({ message: "We use these details only for this waitlist, and you can ask us to remove them at any time. Every letter has a link that takes you off.", context: "coming-soon waitlist: what the details are for" })}</p>
      {problem && (
        <p id={`${base}-problem`} role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <button type="submit" className={`w-fit ${BTN_PRIMARY}`} disabled={state === "sending" || picked.length === 0}>
        {t({ message: "Notify me", context: "coming-soon waitlist: the button" })}
      </button>
    </form>
  );
}
