/**
 * ASK FOR THE PROSPERITY PACKET, ON THE PAGE (a reviewer's feedback, approved
 * by the lead on 24 Nov 2026).
 *
 * The packet buttons on /prosperity were mailto: links, which open nothing on
 * a phone with no mail app set up. This is the short form that replaces them:
 * a name, an email, what they want to build and an optional note. No account
 * needed. It posts to the public forms door as `prosperity-packet`
 * (shared/prosperityPacket.ts), with that door's honeypot and per-IP limit,
 * and reaches the inbox a partner proposal reaches.
 *
 * On send, every problem at once, the way the partner form says them: a
 * summary listing each thing to fix, each field naming its own under it, and
 * focus on the first. A sending failure is said beside the button. Once sent,
 * the form gives way to a clear sent state, which takes focus so a screen
 * reader hears it.
 */
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, FIELD, HINT, LABEL } from "@/components/journey/look";
import { sendProposal } from "@/lib/proposals";
import { PACKET_LIMITS, PROSPERITY_PACKET_FORM, packetProblems, type PacketProblem, type PacketRequest } from "@shared/prosperityPacket";

/** The id the page's other packet buttons point at. */
export const PACKET_ANCHOR = "packet-request";

const EMPTY: PacketRequest = { name: "", email: "", build: "", note: "" };

const fieldId = (p: PacketProblem) => `packet-${p}`;

function focusField(p: PacketProblem) {
  const el = document.getElementById(fieldId(p));
  if (!el) return;
  el.scrollIntoView?.({ block: "center" });
  el.focus({ preventScroll: true });
}

export default function PacketRequestForm({ sendLabel }: { sendLabel?: string }) {
  const { t } = useLingui();
  const [form, setForm] = useState<PacketRequest>(EMPTY);
  const [hp, setHp] = useState(""); // honeypot: real people never fill this
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [tried, setTried] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const sentRef = useRef<HTMLDivElement>(null);
  const problems = tried ? packetProblems(form) : [];
  const wrong = (id: PacketProblem) => problems.includes(id);

  // Arriving from one of the page's other packet buttons puts the cursor in the first field.
  useEffect(() => {
    const arrive = () => {
      if (window.location.hash === `#${PACKET_ANCHOR}`) document.getElementById(fieldId("name"))?.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", arrive);
    return () => window.removeEventListener("hashchange", arrive);
  }, []);

  useEffect(() => {
    if (state === "sent") sentRef.current?.focus();
  }, [state]);

  const problemWords: Record<PacketProblem, string> = {
    name: t({ message: "Add your name.", context: "prosperity packet form: a field to fix" }),
    email: t({ message: "Add an email address we can write to.", context: "prosperity packet form: a field to fix" }),
    build: t({ message: "Say what you would like to build.", context: "prosperity packet form: a field to fix" }),
    note: t({ message: "Keep the note under 2,000 characters.", context: "prosperity packet form: a field to fix" }),
  };

  const set = (key: keyof PacketRequest, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = packetProblems(form);
    setTried(true);
    setSendFailed(false);
    if (found.length) {
      requestAnimationFrame(() => focusField(found[0]));
      return;
    }
    setState("sending");
    const clean = { name: form.name.trim(), email: form.email.trim(), build: form.build.trim(), note: form.note.trim() };
    const answer = await sendProposal(PROSPERITY_PACKET_FORM, clean, hp);
    if (answer.ok) setState("sent");
    else {
      setState("idle");
      setSendFailed(true);
    }
  };

  if (state === "sent") {
    return (
      <div ref={sentRef} tabIndex={-1} role="status" className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm sm:p-8" data-packet-sent="">
        <h3 className="font-display text-2xl leading-tight text-foreground">
          {t({ message: "Your request is on its way", context: "prosperity packet form: sent" })}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {t({ message: "The people who look after new businesses here read every request. We will write to the email you gave.", context: "prosperity packet form: sent" })}
        </p>
      </div>
    );
  }

  const describedBy = (id: PacketProblem, hint: boolean) => [hint ? `${fieldId(id)}-hint` : "", wrong(id) ? `${fieldId(id)}-error` : ""].filter(Boolean).join(" ") || undefined;
  const field = (id: PacketProblem, label: string, opts: { type?: string; max: number; area?: boolean; optional?: boolean; hint?: string; autoComplete?: string }) => (
    <div className="grid gap-1.5">
      <label htmlFor={fieldId(id)} className={LABEL}>
        {label}
        {opts.optional ? <span className="font-normal text-muted-foreground"> {t({ message: "(optional)", context: "prosperity packet form: an optional field" })}</span> : null}
      </label>
      {opts.area ? (
        <textarea id={fieldId(id)} rows={4} maxLength={opts.max} value={form[id]} onChange={(e) => set(id, e.target.value)} className={`${FIELD} min-h-28 py-3`} aria-invalid={wrong(id) || undefined} aria-describedby={describedBy(id, !!opts.hint)} />
      ) : (
        <input id={fieldId(id)} type={opts.type ?? "text"} maxLength={opts.max} autoComplete={opts.autoComplete} value={form[id]} onChange={(e) => set(id, e.target.value)} className={`${FIELD} min-h-11`} aria-invalid={wrong(id) || undefined} aria-describedby={describedBy(id, !!opts.hint)} />
      )}
      {opts.hint ? <p id={`${fieldId(id)}-hint`} className={HINT}>{opts.hint}</p> : null}
      {wrong(id) ? (
        <p id={`${fieldId(id)}-error`} className="text-sm font-medium text-destructive" data-field-problem={id}>
          {problemWords[id]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border border-border bg-card p-6 text-left shadow-sm sm:p-8" data-packet-form="">
      {/* Hidden from people; a bot that fills it is told it worked and nothing is kept. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" aria-hidden="true" />
      <p className={HINT}>{t({ message: "No account needed. It takes a minute.", context: "prosperity packet form" })}</p>
      {problems.length > 0 ? (
        <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-foreground" data-packet-problems={problems.length}>
          <p className="font-semibold">{t({ message: "A few things to fix before it can go:", context: "prosperity packet form: the list of fields to fix" })}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {problems.map((p) => (
              <li key={p}>
                <a
                  href={`#${fieldId(p)}`}
                  className="underline underline-offset-2"
                  onClick={(e) => {
                    e.preventDefault();
                    focusField(p);
                  }}
                >
                  {problemWords[p]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", t({ message: "Your name", context: "prosperity packet form" }), { max: PACKET_LIMITS.name, autoComplete: "name" })}
        {field("email", t({ message: "Your email", context: "prosperity packet form" }), { type: "email", max: PACKET_LIMITS.email, autoComplete: "email" })}
      </div>
      {field("build", t({ message: "What you would like to build", context: "prosperity packet form" }), { area: true, max: PACKET_LIMITS.build, hint: t({ message: "A business, a service, a craft: a few lines is plenty.", context: "prosperity packet form: the build field's hint" }) })}
      {field("note", t({ message: "Anything else", context: "prosperity packet form: the optional note" }), { area: true, max: PACKET_LIMITS.note, optional: true })}
      {sendFailed ? (
        <p role="alert" className="border-l-4 border-destructive pl-3 text-sm font-medium text-foreground" data-packet-problem="send">
          {t({ message: "That didn't send. Try again in a few minutes.", context: "prosperity packet form: sending failed" })}
        </p>
      ) : null}
      <div>
        <button type="submit" className={BTN_PRIMARY} disabled={state === "sending"} data-packet-send="">
          {state === "sending" ? t({ message: "Sending", context: "prosperity packet form: the button while it sends" }) : sendLabel || t({ message: "Send my request", context: "prosperity packet form: the button" })}
        </button>
      </div>
    </form>
  );
}
