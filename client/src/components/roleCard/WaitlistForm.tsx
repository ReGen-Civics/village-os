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
import { BTN_PRIMARY, FIELD, HINT, LABEL } from "@/components/journey/look";

export interface WaitlistRole {
  id: string;
  name: string;
}

export default function WaitlistForm({ roles, chosen }: { roles: WaitlistRole[]; chosen: string }) {
  const { t } = useLingui();
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [picked, setPicked] = useState<string[]>(chosen ? [chosen] : []);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  if (state === "done") {
    return (
      <p role="status" className="rounded-xl border border-notice/50 bg-muted px-4 py-3 text-card-foreground" data-waitlist-done="">
        {t({ message: "Thank you. Your details are saved. We will write when the role opens.", context: "coming-soon waitlist: after signing up" })}
      </p>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    setState("sending");
    try {
      const r = await gameFetch("/api/roles/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, whatsapp, roleIds: picked }) });
      if (r.ok) return setState("done");
      const d = await r.json().catch(() => ({}));
      setProblem(r.status === 429 ? t({ message: "Too many sign-ups from here just now. Please try again in an hour.", context: "coming-soon waitlist: rate limited" }) : String(d?.message ?? t({ message: "That did not save. Please try again.", context: "coming-soon waitlist: failed" })));
    } catch {
      setProblem(t({ message: "That did not save. Please try again.", context: "coming-soon waitlist: failed" }));
    }
    setState("idle");
  };

  return (
    <form onSubmit={send} className="grid gap-3" data-waitlist-form="">
      <label className="grid gap-1">
        <span className={LABEL}>{t({ message: "Email", context: "coming-soon waitlist field" })}</span>
        <input type="email" required autoComplete="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className={LABEL}>{t({ message: "WhatsApp number (optional)", context: "coming-soon waitlist field" })}</span>
        <input type="tel" autoComplete="tel" className={FIELD} value={whatsapp} maxLength={60} onChange={(e) => setWhatsapp(e.target.value)} />
      </label>
      {roles.length > 0 && (
        <fieldset className="grid gap-1.5">
          <legend className={LABEL}>{t({ message: "Which roles interest you", context: "coming-soon waitlist field" })}</legend>
          {roles.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-2 text-card-foreground" htmlFor={`${base}-${r.id}`}>
              <input id={`${base}-${r.id}`} type="checkbox" className="size-5 accent-notice" checked={picked.includes(r.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} />
              {r.name}
            </label>
          ))}
        </fieldset>
      )}
      <p className={HINT}>{t({ message: "We use these details only to tell you when the role opens. You can ask us to remove them.", context: "coming-soon waitlist: what the details are for" })}</p>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <button type="submit" className={`w-fit ${BTN_PRIMARY}`} disabled={state === "sending" || picked.length === 0}>
        {t({ message: "Notify me", context: "coming-soon waitlist: the button" })}
      </button>
    </form>
  );
}
