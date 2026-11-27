/**
 * THE INVESTOR INTEREST FORM (the lead, 27 Nov 2026): what a reader without investor access sees on the investor
 * page, in place of the whole page. A short welcome, then the form: a name and an email, and every other question
 * optional (the real estate norms in shared/investorInterest.ts). A name and address the village already holds come
 * filled in and locked, so the form reads as one more request.
 *
 * The privacy words under the form are posted with it and kept beside the answer (the entrance's pattern).
 */
import { useId, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { ArrowRight } from "lucide-react";
import { useVillageName } from "@/hooks/useVillageName";
import { useVillageLinks } from "@/lib/gameApi";
import { investorHeaders } from "@/lib/investorAccess";
import { BTN_PRIMARY, CARD_FEATURED, EYEBROW, FIELD, H1, HINT, LABEL, LEDE } from "@/components/journey/look";
import {
  ACCREDITATION,
  ALLOCATIONS,
  CHECK_SIZES,
  contactProblem,
  ENTITY,
  EXPERIENCE,
  HORIZONS,
  INTERESTS,
  INVESTOR_TYPES,
  LONG_MAX,
  SHORT_MAX,
  STRUCTURES,
  type Accreditation,
  type Allocation,
  type CheckSize,
  type EntityAnswer,
  type Experience,
  type Horizon,
  type InvestorAccessState,
  type InvestorInterestArea,
  type InvestorType,
  type Structure,
} from "@shared/investorInterest";

type Choice<T extends string> = { list: readonly T[]; words: Record<T, string> };

export default function InvestorInterest({ state, onSent }: { state: InvestorAccessState | null; onSent?: () => void }) {
  const { t, i18n } = useLingui();
  const village = useVillageName();
  const { contactEmail } = useVillageLinks();
  const ids = useId();
  const prefill = state?.prefill ?? { name: "", email: "", whatsapp: "", link: "", locked: false };
  const locked = prefill.locked;
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [whatsapp, setWhatsapp] = useState(prefill.whatsapp);
  const [link, setLink] = useState(prefill.link);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [interests, setInterests] = useState<InvestorInterestArea[]>([]);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const privacy = useRef<HTMLDivElement>(null);
  const set = (k: string) => (v: string) => setAnswers((a) => ({ ...a, [k]: v }));

  const investorType: Choice<InvestorType> = {
    list: INVESTOR_TYPES,
    words: {
      individual: t({ message: "An individual", context: "investor interest: investor type" }),
      "family-office": t({ message: "A family office", context: "investor interest: investor type" }),
      fund: t({ message: "A fund or institution", context: "investor interest: investor type" }),
      company: t({ message: "A company", context: "investor interest: investor type" }),
      other: t({ message: "Something else", context: "investor interest: investor type" }),
    },
  };
  const accreditation: Choice<Accreditation> = {
    list: ACCREDITATION,
    words: {
      accredited: t({ message: "Accredited investor", context: "investor interest: accreditation" }),
      "qualified-purchaser": t({ message: "Qualified purchaser", context: "investor interest: accreditation" }),
      "not-accredited": t({ message: "Not accredited", context: "investor interest: accreditation" }),
      "not-sure": t({ message: "Not sure", context: "investor interest: accreditation" }),
    },
  };
  const checkSize: Choice<CheckSize> = {
    list: CHECK_SIZES,
    words: {
      "under-25k": t({ message: "Under $25,000", context: "investor interest: typical check size" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "25k-100k": t({ message: "$25,000 to $100,000", context: "investor interest: typical check size" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "100k-250k": t({ message: "$100,000 to $250,000", context: "investor interest: typical check size" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "250k-1m": t({ message: "$250,000 to $1 million", context: "investor interest: typical check size" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "1m-5m": t({ message: "$1 million to $5 million", context: "investor interest: typical check size" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "over-5m": t({ message: "Over $5 million", context: "investor interest: typical check size" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
    },
  };
  const allocation: Choice<Allocation> = {
    list: ALLOCATIONS,
    words: {
      "under-100k": t({ message: "Under $100,000", context: "investor interest: total allocation" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "100k-500k": t({ message: "$100,000 to $500,000", context: "investor interest: total allocation" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "500k-2m": t({ message: "$500,000 to $2 million", context: "investor interest: total allocation" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "over-2m": t({ message: "Over $2 million", context: "investor interest: total allocation" }), // village-ok: investor check brackets in US dollars, the currency international investors size a check in; the form says so
      "not-sure": t({ message: "Not sure yet", context: "investor interest: total allocation" }),
    },
  };
  const structure: Choice<Structure> = {
    list: STRUCTURES,
    words: {
      equity: t({ message: "Equity", context: "investor interest: preferred structure" }),
      debt: t({ message: "Debt or a loan", context: "investor interest: preferred structure" }),
      "revenue-share": t({ message: "A revenue share", context: "investor interest: preferred structure" }),
      open: t({ message: "Open to talk", context: "investor interest: preferred structure" }),
    },
  };
  const horizon: Choice<Horizon> = {
    list: HORIZONS,
    words: {
      "under-3y": t({ message: "Under 3 years", context: "investor interest: time horizon" }),
      "3-5y": t({ message: "3 to 5 years", context: "investor interest: time horizon" }),
      "5-10y": t({ message: "5 to 10 years", context: "investor interest: time horizon" }),
      "over-10y": t({ message: "Over 10 years", context: "investor interest: time horizon" }),
      "not-sure": t({ message: "Not sure yet", context: "investor interest: time horizon" }),
    },
  };
  const experience: Choice<Experience> = {
    list: EXPERIENCE,
    words: {
      none: t({ message: "This would be my first", context: "investor interest: real estate experience" }),
      some: t({ message: "A few investments", context: "investor interest: real estate experience" }),
      experienced: t({ message: "Many investments", context: "investor interest: real estate experience" }),
      professional: t({ message: "It is my profession", context: "investor interest: real estate experience" }),
    },
  };
  const entity: Choice<EntityAnswer> = {
    list: ENTITY,
    words: {
      personal: t({ message: "Personally", context: "investor interest: invest through an entity" }),
      entity: t({ message: "Through a company, trust or fund", context: "investor interest: invest through an entity" }),
      "not-sure": t({ message: "Not sure yet", context: "investor interest: invest through an entity" }),
    },
  };
  const interestWords: Record<InvestorInterestArea, string> = {
    land: t({ message: "Land", context: "investor interest: areas of interest" }),
    homes: t({ message: "Homes", context: "investor interest: areas of interest" }),
    ventures: t({ message: "Ventures on the land", context: "investor interest: areas of interest" }),
    impact: t({ message: "Impact", context: "investor interest: areas of interest" }),
    other: t({ message: "Something else", context: "investor interest: areas of interest" }),
  };

  const usd = t({ message: "In US dollars.", context: "investor interest: the check size and allocation ranges, their currency" });
  const optional = <span className="font-normal text-muted-foreground"> {t({ message: "(optional)", context: "investor interest: marks a question as optional" })}</span>;
  const fieldId = (k: string) => `${ids}-${k}`;

  /** One optional choice. A render function, so React keeps the same select between keystrokes. */
  function select<T extends string>(k: string, label: string, choice: Choice<T>, hint?: string) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={fieldId(k)} className={LABEL}>{label}{optional}</label>
        <select id={fieldId(k)} name={k} value={answers[k] ?? ""} onChange={(e) => set(k)(e.target.value)} className={`${FIELD} min-h-11`}>
          <option value="">{t({ message: "Choose one", context: "investor interest: an empty choice" })}</option>
          {choice.list.map((v) => <option key={v} value={v}>{choice.words[v]}</option>)}
        </select>
        {hint ? <p className={HINT}>{hint}</p> : null}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    const p = contactProblem(name, email);
    if (p) return setProblem(p === "name" ? t({ message: "Tell us your name.", context: "investor interest: a missing name" }) : t({ message: "That email address does not look right.", context: "investor interest: a bad email" }));
    setBusy(true);
    try {
      const r = await fetch("/api/investor/interest", {
        method: "POST",
        credentials: "same-origin",
        headers: investorHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name,
          email,
          whatsapp,
          link,
          ...answers,
          interests,
          website,
          consent: Array.from(privacy.current?.querySelectorAll("p, li") ?? []).map((n) => n.textContent ?? "").join("\n\n"),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setProblem(typeof j?.message === "string" ? j.message : t({ message: "That did not send. Please try again.", context: "investor interest: a failed send" }));
      setSent(true);
      onSent?.();
    } catch {
      setProblem(t({ message: "That did not send. Please try again.", context: "investor interest: a failed send" }));
    } finally {
      setBusy(false);
    }
  }

  const sentBefore = state?.request ? new Date(state.request.sentAt).toLocaleDateString(i18n.locale, { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <section className="container flex max-w-2xl flex-col gap-8 py-12 sm:py-20" data-investor-interest="">
      <header className="flex flex-col gap-4">
        <p className={EYEBROW}>{t({ message: "Investors", context: "investor interest: eyebrow" })}</p>
        <h1 className={H1}>{t({ message: "Investor interest", context: "investor interest: heading" })}</h1>
        <p className={LEDE}>
          {t({
            message: `Tell us about yourself and how you invest. The team reads every form and opens the investor page of ${village} to the people it accepts.`,
            context: "investor interest: the welcome line, with the village's name",
          })}
        </p>
        {sentBefore && !sent ? (
          <p className={HINT} data-investor-sent-before="">
            {t({ message: `We have your form from ${sentBefore}. Send it again to add or change anything.`, context: "investor interest: a form already sent, with its date" })}
          </p>
        ) : null}
      </header>

      {sent ? (
        <div role="status" className={`${CARD_FEATURED} flex flex-col gap-2`} data-investor-sent="">
          <p className="font-display text-2xl text-foreground">{t({ message: "Thank you.", context: "investor interest: sent, heading" })}</p>
          <p className={LEDE}>{t({ message: "The team will read your form and write to you.", context: "investor interest: sent, what happens next" })}</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className={`${CARD_FEATURED} flex flex-col gap-6`} aria-label={t({ message: "Investor interest form", context: "investor interest: the form's name" })}>
          {problem ? <p role="alert" className="rounded-xl border border-destructive/60 bg-muted p-4 text-sm text-foreground">{problem}</p> : null}

          <div className="flex flex-col gap-2">
            <label htmlFor={fieldId("name")} className={LABEL}>{t({ message: "Name", context: "investor interest: name" })}</label>
            <input id={fieldId("name")} name="name" autoComplete="name" required maxLength={120} value={name} readOnly={locked} onChange={(e) => setName(e.target.value)} className={`${FIELD} min-h-11 ${locked ? "opacity-80" : ""}`} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={fieldId("email")} className={LABEL}>{t({ message: "Email", context: "investor interest: email" })}</label>
            <input id={fieldId("email")} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={320} value={email} readOnly={locked} onChange={(e) => setEmail(e.target.value)} className={`${FIELD} min-h-11 ${locked ? "opacity-80" : ""}`} />
            {locked ? <p className={HINT} data-investor-locked="">{t({ message: "We already have these from when you came in.", context: "investor interest: name and email already held" })}</p> : null}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor={fieldId("whatsapp")} className={LABEL}>{t({ message: "WhatsApp number", context: "investor interest: whatsapp" })}{optional}</label>
              <input id={fieldId("whatsapp")} name="whatsapp" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={`${FIELD} min-h-11`} />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor={fieldId("link")} className={LABEL}>{t({ message: "Website or LinkedIn", context: "investor interest: link" })}{optional}</label>
              <input id={fieldId("link")} name="link" autoComplete="url" inputMode="url" maxLength={500} value={link} onChange={(e) => setLink(e.target.value)} className={`${FIELD} min-h-11`} />
            </div>
          </div>

          <p className={`${LABEL} border-t border-border pt-6`}>{t({ message: "A few questions, all optional", context: "investor interest: the optional questions, heading" })}</p>

          <div className="grid gap-6 sm:grid-cols-2">
            {select("investorType", t({ message: "What kind of investor are you?", context: "investor interest: investor type, question" }), investorType)}
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor={fieldId("country")} className={LABEL}>{t({ message: "Country where you live", context: "investor interest: country, question" })}{optional}</label>
              <input id={fieldId("country")} name="country" autoComplete="country-name" maxLength={SHORT_MAX} value={answers.country ?? ""} onChange={(e) => set("country")(e.target.value)} className={`${FIELD} min-h-11`} />
            </div>
          </div>
          {select("accreditation", t({ message: "Accreditation status", context: "investor interest: accreditation, question" }), accreditation, t({ message: "An accredited investor meets a legal test of income or net worth where they live. Choose what fits you. This is your own answer, and we check nothing here.", context: "investor interest: accreditation, what it means" }))}
          <div className="grid gap-6 sm:grid-cols-2">
            {select("checkSize", t({ message: "Your typical check size", context: "investor interest: check size, question" }), checkSize, usd)}
            {select("allocation", t({ message: "How much you might place here in all", context: "investor interest: total allocation, question" }), allocation, usd)}
            {select("structure", t({ message: "The structure you prefer", context: "investor interest: structure, question" }), structure)}
            {select("horizon", t({ message: "Your time horizon", context: "investor interest: time horizon, question" }), horizon)}
            {select("experience", t({ message: "Real estate or development experience", context: "investor interest: experience, question" }), experience)}
            {select("entity", t({ message: "Would you invest personally or through an entity?", context: "investor interest: entity, question" }), entity)}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={fieldId("thesis")} className={LABEL}>{t({ message: "Your investment thesis", context: "investor interest: thesis, question" })}{optional}</label>
            <textarea id={fieldId("thesis")} name="thesis" rows={4} maxLength={LONG_MAX} value={answers.thesis ?? ""} onChange={(e) => set("thesis")(e.target.value)} className={FIELD} />
            <p className={HINT}>{t({ message: "What you look for in a project, in your own words.", context: "investor interest: thesis, hint" })}</p>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className={`${LABEL} mb-3`}>{t({ message: "What interests you here?", context: "investor interest: areas of interest, question" })}{optional}</legend>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((k) => {
                const on = interests.includes(k);
                return (
                  <label key={k} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${on ? "border-notice bg-notice text-background" : "border-border bg-muted text-foreground hover:border-notice"}`}>
                    <input type="checkbox" name="interests" value={k} checked={on} onChange={() => setInterests((cur) => (on ? cur.filter((x) => x !== k) : [...cur, k]))} className="sr-only" />
                    {interestWords[k]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor={fieldId("heardFrom")} className={LABEL}>{t({ message: "How did you hear about us?", context: "investor interest: how they heard, question" })}{optional}</label>
            <input id={fieldId("heardFrom")} name="heardFrom" maxLength={SHORT_MAX} value={answers.heardFrom ?? ""} onChange={(e) => set("heardFrom")(e.target.value)} className={`${FIELD} min-h-11`} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={fieldId("more")} className={LABEL}>{t({ message: "Anything else we should know?", context: "investor interest: anything else, question" })}{optional}</label>
            <textarea id={fieldId("more")} name="more" rows={3} maxLength={LONG_MAX} value={answers.more ?? ""} onChange={(e) => set("more")(e.target.value)} className={FIELD} />
          </div>

          {/* A field no person sees or fills: a bot's tell. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={fieldId("website")}>{t({ message: "Leave this empty", context: "investor interest: a hidden field only bots fill" })}</label>
            <input id={fieldId("website")} name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          {/* Posted with the form and kept beside the answer, so the record shows what each person read. */}
          <div ref={privacy} className={`${HINT} flex flex-col gap-2`} data-investor-privacy="">
            <p>
              {t({
                message: "This form is an expression of interest. It is not an offer to sell, or a request to buy, any investment or security.",
                context: "investor interest: the not-an-offer line",
              })}
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>{t({ message: `We keep what you send here for the investor contacts of ${village}.`, context: "investor interest: privacy, what is kept, with the village's name" })}</li>
              <li>{t({ message: "The team reads it and may write to you about investing.", context: "investor interest: privacy, what the team does" })}</li>
              <li>
                {contactEmail
                  ? t({ message: `To see or delete what we keep, write to ${contactEmail}.`, context: "investor interest: privacy, how to ask, with the contact address" })
                  : t({ message: "To see or delete what we keep, ask the team.", context: "investor interest: privacy, how to ask, with no contact address" })}
              </li>
            </ul>
          </div>

          <button type="submit" disabled={busy} className={`${BTN_PRIMARY} self-start text-base disabled:opacity-60`}>
            {busy ? t({ message: "Sending…", context: "investor interest: sending" }) : t({ message: "Send my interest", context: "investor interest: send" })}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </form>
      )}
    </section>
  );
}
