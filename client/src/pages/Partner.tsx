/**
 * BECOME A PARTNER (the lead, 23 Nov 2026): for someone who already runs their own project or business and wants to
 * work with the village, to build the community, build the village or help it thrive. No seat and no lease.
 *
 * No account needed. It posts to the submissions pipeline as `partner` (POST /api/forms/submit), with that route's
 * honeypot and per-IP limit, and lands in the admin's form submissions under its own type. The holders of the role
 * the village names in `org.partnerships_role` get it by email (server/lib/partnerRouting.ts), else the business
 * inbox. When they will hear back is said once they have sent, in moon cycles (`org.reply_window_moons`), never before.
 *
 * ON SEND, EVERY PROBLEM AT ONCE (QA, 23 Nov 2026): a summary at the top of the form lists each thing to fix, each a
 * link to its field; each field names its own problem under it (`aria-describedby`, `aria-invalid`); and focus moves
 * to the first field to fix. A sending failure is said by the button, where the press was.
 */
import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { BTN_PRIMARY, CARD, EYEBROW, FIELD, H1, HINT, LABEL, LEDE, TICK, WORLD } from "@/components/journey/look";
import { sendProposal } from "@/lib/proposals";
import ContributorRoutes, { useReplyPromise, useRouteWords } from "@/components/ContributorRoutes";
import { CONTRIBUTOR_SOURCE, PARTNER_FORM, PARTNER_LIMITS, PARTNER_SERVES, partnerProblems, type PartnerProblem, type PartnerProposal, type PartnerServes } from "@shared/contributorRoutes";

/** The element a problem's link moves to: the field, or the first box of the serves question. */
const fieldIdOf = (p: PartnerProblem): string => (p === "serves" ? `partner-serves-${PARTNER_SERVES[0]}` : `partner-${p}`);

function focusField(p: PartnerProblem) {
  const el = document.getElementById(fieldIdOf(p));
  if (!el) return;
  el.scrollIntoView?.({ block: "center" });
  el.focus({ preventScroll: true });
}

const EMPTY: PartnerProposal = { name: "", email: "", project: "", link: "", serves: [], offer: "", wish: "" };

export default function Partner() {
  const { t } = useLingui();
  const words = useRouteWords().partner;
  const [form, setForm] = useState<PartnerProposal>(EMPTY);
  const [hp, setHp] = useState(""); // honeypot: real people never fill this
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [tried, setTried] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  // Once a send has been tried, the list follows the form as it is fixed.
  const problems = tried ? partnerProblems(form) : [];
  const wrong = (id: PartnerProblem) => problems.includes(id);

  const serveWords: Record<PartnerServes, string> = {
    community: t({ message: "Building the community", context: "partner form: what the partnership serves" }),
    village: t({ message: "Building the village", context: "partner form: what the partnership serves" }),
    thriving: t({ message: "Helping the village thrive", context: "partner form: what the partnership serves" }),
  };
  const problemWords: Record<PartnerProblem, string> = {
    name: t({ message: "Add your name.", context: "partner form: a field to fix" }),
    email: t({ message: "Add an email address we can write to.", context: "partner form: a field to fix" }),
    project: t({ message: "Add the name of your project or business.", context: "partner form: a field to fix" }),
    link: t({ message: "The link starts with https:// and has no spaces.", context: "partner form: a field to fix" }),
    serves: t({ message: "Choose at least one thing the partnership serves.", context: "partner form: a field to fix" }),
    offer: t({ message: "Say what you offer.", context: "partner form: a field to fix" }),
    wish: t({ message: "Say what you would like from the village.", context: "partner form: a field to fix" }),
  };
  const sendFailWords = t({ message: "That didn't send. Try again in a few minutes.", context: "partner form: sending failed" });
  const promise = useReplyPromise();

  const set = <K extends keyof PartnerProposal>(key: K, value: PartnerProposal[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (s: PartnerServes) => set("serves", form.serves.includes(s) ? form.serves.filter((x) => x !== s) : [...form.serves, s]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = partnerProblems(form);
    setTried(true);
    setSendFailed(false);
    if (found.length) {
      // The summary is announced (role="alert"); focus goes to the first field to fix.
      requestAnimationFrame(() => focusField(found[0]));
      return;
    }
    setState("sending");
    // The tag the review inbox reads (CONTRIBUTOR_SOURCE): one stable source, and the route it came by.
    const clean = { ...form, name: form.name.trim(), email: form.email.trim(), project: form.project.trim(), link: form.link.trim(), source: CONTRIBUTOR_SOURCE, route: "partner" };
    const answer = await sendProposal(PARTNER_FORM, clean, hp);
    if (answer.ok) setState("sent");
    else {
      setState("idle");
      setSendFailed(true);
    }
  };

  if (state === "sent") {
    return (
      <Layout>
        <section className={`${WORLD} py-16 sm:py-24`}>
          <div className="container grid max-w-3xl gap-8">
            <div className={`${CARD} grid gap-4`} role="status" data-partner-sent="">
              <CheckCircle2 className="size-10 text-notice" aria-hidden="true" />
              <h1 className="font-display text-3xl text-foreground">{t({ message: "Your proposal is with us", context: "partner form: sent" })}</h1>
              <p className={LEDE}>{t({ message: "The people who hold partnerships read every proposal. We write to the email you gave.", context: "partner form: sent" })}</p>
              <p className="font-semibold text-foreground" data-route-promise="">{promise}</p>
            </div>
            <ContributorRoutes variant="links" except={["partner"]} heading={t({ message: "While you wait, you can also", context: "after an application or a waitlist sign-up: the other ways to build" })} headingAs="h2" />
          </div>
        </section>
      </Layout>
    );
  }

  /** A field's own problem, under it, and the ids its control is described by. */
  const errorOf = (id: PartnerProblem) =>
    wrong(id) ? (
      <p id={`partner-${id}-error`} className="text-sm font-medium text-destructive" data-field-problem={id}>
        {problemWords[id]}
      </p>
    ) : null;
  const describedBy = (id: PartnerProblem, hint: boolean) => [hint ? `partner-${id}-hint` : "", wrong(id) ? `partner-${id}-error` : ""].filter(Boolean).join(" ") || undefined;

  const field = (id: PartnerProblem, label: string, opts: { type?: string; max: number; hint?: string; optional?: boolean; area?: boolean; autoComplete?: string }) => (
    <div className="grid gap-1.5">
      <label htmlFor={`partner-${id}`} className={LABEL}>
        {label}
        {opts.optional ? <span className="font-normal text-muted-foreground"> {t({ message: "(optional)", context: "partner form: an optional field" })}</span> : null}
      </label>
      {opts.area ? (
        <textarea id={`partner-${id}`} rows={5} maxLength={opts.max} value={form[id] as string} onChange={(e) => set(id, e.target.value as never)} className={`${FIELD} min-h-32 py-3`} aria-invalid={wrong(id) || undefined} aria-describedby={describedBy(id, !!opts.hint)} />
      ) : (
        <input id={`partner-${id}`} type={opts.type ?? "text"} maxLength={opts.max} autoComplete={opts.autoComplete} value={form[id] as string} onChange={(e) => set(id, e.target.value as never)} className={`${FIELD} min-h-11`} aria-invalid={wrong(id) || undefined} aria-describedby={describedBy(id, !!opts.hint)} />
      )}
      {opts.hint ? <p id={`partner-${id}-hint`} className={HINT}>{opts.hint}</p> : null}
      {errorOf(id)}
    </div>
  );

  return (
    <Layout>
      <section className={`${WORLD} py-16 sm:py-24`}>
        <div className="container grid max-w-3xl gap-8">
          <header className="grid gap-3">
            <p className={EYEBROW}>{t({ message: "Four ways to build", context: "partner form: eyebrow" })}</p>
            <h1 className={H1}>{words.verb}</h1>
            <p className={LEDE}>{words.line}</p>
            {words.note ? <p className="text-base leading-relaxed text-foreground" data-route-note="">{words.note}</p> : null}
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-foreground">{t({ message: "You bring", context: "four ways to build: the label before what you bring" })}</dt>
                <dd className="text-muted-foreground">{words.bring}</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">{t({ message: "You get back", context: "four ways to build: the label before what you get back" })}</dt>
                <dd className="text-muted-foreground">{words.back}</dd>
              </div>
            </dl>
          </header>
          <form onSubmit={submit} noValidate className={`${CARD} grid gap-5`} data-partner-form="">
            {/* Honeypot: hidden from people and screen readers; only a bot fills it. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" aria-hidden="true" />
            <p className={HINT}>{t({ message: "No account needed.", context: "partner form" })}</p>
            {problems.length > 0 && (
              <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-foreground" data-partner-problems={problems.length}>
                <p className="font-semibold">
                  {problems.length === 1
                    ? t({ message: "One thing to fix before you send:", context: "partner form: the problems found on send" })
                    : t({ message: `${problems.length} things to fix before you send:`, context: "partner form: the problems found on send" })}
                </p>
                <ul className="mt-1 grid list-disc pl-5">
                  {problems.map((p) => (
                    <li key={p}>
                      <a
                        href={`#${fieldIdOf(p)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          focusField(p);
                        }}
                        className="inline-flex min-h-11 items-center text-left font-medium text-foreground underline underline-offset-4 hover:text-notice focus-visible:outline-2 focus-visible:outline-ring"
                        data-problem-link={p}
                      >
                        {problemWords[p]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              {field("name", t({ message: "Your name", context: "partner form" }), { max: PARTNER_LIMITS.name, autoComplete: "name" })}
              {field("email", t({ message: "Your email", context: "partner form" }), { type: "email", max: PARTNER_LIMITS.email, autoComplete: "email" })}
            </div>
            {field("project", t({ message: "Your project or business", context: "partner form" }), { max: PARTNER_LIMITS.project, autoComplete: "organization" })}
            {field("link", t({ message: "A link to it", context: "partner form" }), { type: "url", max: PARTNER_LIMITS.link, optional: true, hint: t({ message: "A website or a page about your work, starting with https://", context: "partner form" }) })}
            <fieldset className="grid gap-2">
              <legend className={LABEL}>{t({ message: "What would the partnership serve?", context: "partner form: the serves question" })}</legend>
              <p className={HINT}>{t({ message: "Choose one or more.", context: "partner form: the serves question" })}</p>
              {PARTNER_SERVES.map((s) => (
                <label key={s} className="flex min-h-11 items-center gap-3 text-foreground">
                  <input type="checkbox" id={`partner-serves-${s}`} className={TICK} checked={form.serves.includes(s)} onChange={() => toggle(s)} aria-describedby={wrong("serves") ? "partner-serves-error" : undefined} data-serves={s} />
                  {serveWords[s]}
                </label>
              ))}
              {errorOf("serves")}
            </fieldset>
            {field("offer", t({ message: "What you offer", context: "partner form" }), { area: true, max: PARTNER_LIMITS.prose })}
            {field("wish", t({ message: "What you would like from the village", context: "partner form" }), { area: true, max: PARTNER_LIMITS.prose })}
            {sendFailed ? (
              <p role="alert" className="border-l-4 border-destructive pl-3 text-sm font-medium text-foreground" data-partner-problem="send">
                {sendFailWords}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" className={BTN_PRIMARY} disabled={state === "sending"} data-partner-send="">
                {state === "sending" ? t({ message: "Sending…", context: "partner form" }) : t({ message: "Send your proposal", context: "partner form" })}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </section>
    </Layout>
  );
}
