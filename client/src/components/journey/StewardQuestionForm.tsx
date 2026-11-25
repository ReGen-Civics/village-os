/**
 * ASK A QUESTION, ON THE STEWARD PAGE (UNFINISHED-AREAS 21, decided by the lead: inline forms, one form type per
 * page; the every-page audit, 24 Nov 2026, found /steward's "Ask us a question" still a mailto).
 *
 * A mailto opens nothing on a phone with no mail app set up. This is the short form that replaces it: a name, an
 * email and the question. No account needed. It posts to the public forms door as `steward`, which that door
 * already accepts and routes to the steward path's inbox (server/lib/comms/mailer.ts), with the door's honeypot
 * and per-IP limit. It follows the prosperity packet form (components/prosperity/PacketRequestForm.tsx): every
 * problem at once with focus on the first, a sending failure said by the button, and a sent state that takes focus.
 */
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, FIELD, HINT, LABEL } from "@/components/journey/look";
import { sendProposal } from "@/lib/proposals";

/** The id the page's question buttons point at (TargetContext.contactForm). */
export const STEWARD_QUESTION_ANCHOR = "steward-question";
/** The form type the public door routes to the steward inbox. */
export const STEWARD_QUESTION_FORM = "steward";

export const QUESTION_LIMITS = { name: 120, email: 254, question: 2000 } as const;
export type QuestionProblem = "name" | "email" | "question";
export interface StewardQuestion { name: string; email: string; question: string }

/** What is still to fix, in the order the fields stand. */
export function questionProblems(q: StewardQuestion): QuestionProblem[] {
  const out: QuestionProblem[] = [];
  if (!q.name.trim() || q.name.trim().length > QUESTION_LIMITS.name) out.push("name");
  const email = q.email.trim();
  if (!email || email.length > QUESTION_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.push("email");
  if (!q.question.trim() || q.question.trim().length > QUESTION_LIMITS.question) out.push("question");
  return out;
}

const EMPTY: StewardQuestion = { name: "", email: "", question: "" };
const fieldId = (p: QuestionProblem) => `steward-question-${p}`;

function focusField(p: QuestionProblem) {
  const el = document.getElementById(fieldId(p));
  if (!el) return;
  el.scrollIntoView?.({ block: "center" });
  el.focus({ preventScroll: true });
}

export default function StewardQuestionForm() {
  const { t } = useLingui();
  const [form, setForm] = useState<StewardQuestion>(EMPTY);
  const [hp, setHp] = useState(""); // honeypot: real people never fill this
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [tried, setTried] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const sentRef = useRef<HTMLDivElement>(null);
  const problems = tried ? questionProblems(form) : [];
  const wrong = (id: QuestionProblem) => problems.includes(id);

  // Arriving from one of the page's question buttons puts the cursor in the first field.
  useEffect(() => {
    const arrive = () => {
      if (window.location.hash === `#${STEWARD_QUESTION_ANCHOR}`) document.getElementById(fieldId("name"))?.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", arrive);
    return () => window.removeEventListener("hashchange", arrive);
  }, []);

  useEffect(() => {
    if (state === "sent") sentRef.current?.focus();
  }, [state]);

  const problemWords: Record<QuestionProblem, string> = {
    name: t({ message: "Add your name.", context: "steward question form: a field to fix" }),
    email: t({ message: "Add an email address we can write to.", context: "steward question form: a field to fix" }),
    question: t({ message: "Write your question, in under 2,000 characters.", context: "steward question form: a field to fix" }),
  };
  const set = (key: keyof StewardQuestion, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = questionProblems(form);
    setTried(true);
    setSendFailed(false);
    if (found.length) {
      requestAnimationFrame(() => focusField(found[0]));
      return;
    }
    setState("sending");
    const answer = await sendProposal(STEWARD_QUESTION_FORM, { name: form.name.trim(), email: form.email.trim(), message: form.question.trim() }, hp);
    if (answer.ok) setState("sent");
    else {
      setState("idle");
      setSendFailed(true);
    }
  };

  if (state === "sent") {
    return (
      <div ref={sentRef} tabIndex={-1} role="status" className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm sm:p-8" data-steward-question-sent="">
        <h3 className="font-display text-2xl leading-tight text-foreground">{t({ message: "Your question is with us", context: "steward question form: sent" })}</h3>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {t({ message: "The people who look after the roles read every question. We will write to the email you gave.", context: "steward question form: sent" })}
        </p>
      </div>
    );
  }

  const describedBy = (id: QuestionProblem) => (wrong(id) ? `${fieldId(id)}-error` : undefined);
  const field = (id: QuestionProblem, label: string, opts: { type?: string; max: number; area?: boolean; autoComplete?: string }) => (
    <div className="grid gap-1.5">
      <label htmlFor={fieldId(id)} className={LABEL}>{label}</label>
      {opts.area ? (
        <textarea id={fieldId(id)} rows={4} maxLength={opts.max} value={form[id]} onChange={(e) => set(id, e.target.value)} className={`${FIELD} min-h-28 py-3`} aria-invalid={wrong(id) || undefined} aria-describedby={describedBy(id)} />
      ) : (
        <input id={fieldId(id)} type={opts.type ?? "text"} maxLength={opts.max} autoComplete={opts.autoComplete} value={form[id]} onChange={(e) => set(id, e.target.value)} className={`${FIELD} min-h-11`} aria-invalid={wrong(id) || undefined} aria-describedby={describedBy(id)} />
      )}
      {wrong(id) ? (
        <p id={`${fieldId(id)}-error`} className="text-sm font-medium text-destructive" data-field-problem={id}>
          {problemWords[id]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border border-border bg-card p-6 text-left shadow-sm sm:p-8" data-steward-question-form="">
      {/* Hidden from people; a bot that fills it is told it worked and nothing is kept. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" aria-hidden="true" />
      <p className={HINT}>{t({ message: "No account needed. We write back to the email you give.", context: "steward question form" })}</p>
      {problems.length > 0 ? (
        <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-foreground" data-steward-question-problems={problems.length}>
          <p className="font-semibold">{t({ message: "A few things to fix before it can go:", context: "steward question form: the list of fields to fix" })}</p>
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
        {field("name", t({ message: "Your name", context: "steward question form" }), { max: QUESTION_LIMITS.name, autoComplete: "name" })}
        {field("email", t({ message: "Your email", context: "steward question form" }), { type: "email", max: QUESTION_LIMITS.email, autoComplete: "email" })}
      </div>
      {field("question", t({ message: "Your question", context: "steward question form" }), { area: true, max: QUESTION_LIMITS.question })}
      {sendFailed ? (
        <p role="alert" className="border-l-4 border-destructive pl-3 text-sm font-medium text-foreground" data-steward-question-problem="send">
          {t({ message: "That didn't send. Try again in a few minutes.", context: "steward question form: sending failed" })}
        </p>
      ) : null}
      <div>
        <button type="submit" className={BTN_PRIMARY} disabled={state === "sending"} data-steward-question-send="">
          {state === "sending" ? t({ message: "Sending", context: "steward question form: the button while it sends" }) : t({ message: "Send my question", context: "steward question form: the button" })}
        </button>
      </div>
    </form>
  );
}
