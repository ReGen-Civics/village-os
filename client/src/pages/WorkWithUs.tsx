import { useThanksInView } from "@/lib/thanksInView";
import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { fetchConfigCached } from "@/lib/gameApi";
import { readStoredJson, removeStored, writeStoredJson } from "@/lib/safeStorage";
import { useAuth } from "@/contexts/AuthContext";
import GuideChat from "@/components/GuideChat";
import NameYourGuide from "@/components/NameYourGuide";
import { guideAudience } from "@shared/guideName";
import { guideNameIn } from "@/lib/guideNameWords";
import { submitProposal } from "@/lib/proposals";
import PathConsentBox, { FORM_CONSENT_FIELD } from "@/components/comms/PathConsentBox";
import { usePageContent } from "@/hooks/usePageContent";
import { Emphasized } from "@/components/PageText";
import { WORK_WITH_US_PAGE } from "@shared/pageContent/workWithUs";
import {
  Handshake,
  MessageCircle,
  ClipboardList,
  CheckCircle2,
  ArrowRight,
  Paperclip,
  X,
} from "lucide-react";
import VoiceArea from "@/components/voice/VoiceArea";
import { useLingui } from "@lingui/react/macro";
import { useReplyPromise } from "@/components/ContributorRoutes";
import { useSearch } from "wouter";
import { isVentureQuery, VENTURE_KIND } from "@shared/contributorRoutes";
import Sprout from "@/components/motion/Sprout";

// ── Shared proposal shape ────────────────────────────────────────────────────

interface Proposal {
  name: string;
  email: string;
  phone: string;
  background: string;
  work: string;
  serves: string;
  materialsCost: string;
  timeToImplement: string;
  needsFromUs: string;
  maintenance: string;
  reciprocity: string[];
  reciprocityDetail: string;
  attachment: string;
  attachmentName: string;
}

interface ReciprocityOption { value: string; title: string; desc: string }
interface WwuConfig {
  intro: string;
  assistantName: string;
  assistantGreeting: string;
  reciprocityOptions: ReciprocityOption[];
}

const EMPTY: Proposal = {
  name: "", email: "", phone: "", background: "",
  work: "", serves: "", materialsCost: "", timeToImplement: "",
  needsFromUs: "", maintenance: "", reciprocity: [], reciprocityDetail: "",
  attachment: "", attachmentName: "",
};

const PROPOSAL_FIELDS: { key: keyof Proposal; label: string; hint: string; required: boolean; rows?: number }[] = [
  { key: "work", label: "The work", hint: "Describe what you're proposing, in plain terms. What is it?", required: true, rows: 3 },
  { key: "serves", label: "How it serves the community", hint: "How would this serve the community, the land, the guests, the ecosystem, or the mission?", required: true, rows: 3 },
  { key: "materialsCost", label: "Cost of materials", hint: "What materials, supplies, or inputs are required, and what do they cost? Note anything the village may already have.", required: true, rows: 3 },
  { key: "timeToImplement", label: "Time to implement", hint: "How long from approval to completion? Note any phases, seasonality, or dependencies.", required: true, rows: 2 },
  { key: "needsFromUs", label: "What you'd need from us", hint: "Information or access, decisions and by when, meeting time, site access, utilities, equipment, or labor.", required: true, rows: 3 },
  { key: "maintenance", label: "Maintenance & longevity", hint: "What keeps it alive and well? Ongoing care, who's responsible, cost over time, expected lifespan.", required: true, rows: 3 },
];

type ProposalField = (typeof PROPOSAL_FIELDS)[number];

/*
 * SET UP FOR A VENTURE (the lead, 24 Nov 2026): /work-with-us?kind=venture, where every Start a venture link lands
 * (shared/contributorRoutes.ts). The venture's three questions come first, and each fills a key the proposal already
 * has, so the inbox, the email and the guide read a venture exactly as they read any offer: what the business is in
 * `work`, what it needs from the land and the village in `needsFromUs`, how it gives back in `serves`. The other
 * questions follow in their usual order. The proposal says `kind: "venture"` beside them.
 */
const VENTURE_FIRST: (keyof Proposal)[] = ["work", "needsFromUs", "serves"];

function useVentureFields(): ProposalField[] {
  const { t } = useLingui();
  const first: ProposalField[] = [
    {
      key: "work",
      label: t({ message: "What the business is", context: "work with us, set up for a venture: the first question" }),
      hint: t({ message: "What you would build and run on the land, who it is for, and how it earns its way.", context: "work with us, set up for a venture: help under the first question" }),
      required: true,
      rows: 3,
    },
    {
      key: "needsFromUs",
      label: t({ message: "What it needs from the land and the village", context: "work with us, set up for a venture: the second question" }),
      hint: t({ message: "Space, water, power, access, people, time or decisions, and by when.", context: "work with us, set up for a venture: help under the second question" }),
      required: true,
      rows: 3,
    },
    {
      key: "serves",
      label: t({ message: "How it gives back", context: "work with us, set up for a venture: the third question" }),
      hint: t({ message: "How the business gives back to the village, the land and the people around it.", context: "work with us, set up for a venture: help under the third question" }),
      required: true,
      rows: 3,
    },
  ];
  return [...first, ...PROPOSAL_FIELDS.filter((f) => !VENTURE_FIRST.includes(f.key))];
}

/*
 * THE FOUR OPTIONS A PAGE SHOWS WHEN THE CONFIG COULD NOT BE READ, and only then.
 * A village that deleted every option in Make it yours, Work With Us saves an
 * empty list, and an empty list is its answer: no options. This used to test
 * the list's LENGTH, so deleting all four brought these four straight back on
 * the public page, the exact words the founder had just removed.
 */
const RECIPROCITY_FALLBACK: ReciprocityOption[] = [
  { value: "Financial - Cash", title: "Financial: Cash", desc: "A direct payment for your work, materials, or service: upfront, on milestones, or on completion." },
  { value: "Tokens", title: "Tokens", desc: "You earn contribution tokens." },
  { value: "Joint Venture", title: "Joint Venture", desc: "You operate autonomously, and the community holds a share, e.g. part of your revenue in exchange for space on the land." },
  { value: "Memorandum of Understanding", title: "Memorandum of Understanding", desc: "A clear, living exchange of contribution, e.g. you grow vegetables, share some harvest, and add to the beauty of the land." },
];


// ── Page ─────────────────────────────────────────────────────────────────────

export default function WorkWithUs() {
  const { user } = useAuth();
  const { t, i18n } = useLingui();
  // When they will hear back, said once they have sent (the lead, 24 Nov 2026).
  const replyPromise = useReplyPromise();
  // Arrived from Start a venture: the page opens set up for a venture. Without the query it is the page it always was.
  const venture = isVentureQuery(useSearch());
  /*
   * A generic stand-in until /api/game/config answers, and on a village that
   * has not named itself yet. This read "Amora" on every instance, so the
   * platform's first tenant's name was what every founder's page showed on
   * first paint, whatever they had called their own village.
   */
  const [projectName, setProjectName] = useState("this village");
  /* The intro's stand-in opens a sentence with the name, and a real village
   * name is already capitalised, so this is a no-op for every named village
   * and grammar for the stand-in. */
  const projectNameSentenceStart = projectName.charAt(0).toUpperCase() + projectName.slice(1);
  const [wwu, setWwu] = useState<WwuConfig | null>(null);
  const [wwuFailed, setWwuFailed] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"ai" | "form">("form");
  const [submitted, setSubmitted] = useState(false);
  // On a phone the thank-you would open scrolled past its own end (lib/thanksInView.ts).
  const thanks = useThanksInView(submitted);
  const [form, setForm] = useState<Proposal>(EMPTY);
  // The reciprocity line and the thank-you are the village's own, from Admin,
  // Pages, Work With Us (shared/pageContent/workWithUs.ts).
  const page = usePageContent(WORK_WITH_US_PAGE);

  useEffect(() => {
    fetchConfigCached().then((c) => { if (c?.project?.name) setProjectName(c.project.name); });
    fetch("/api/work-with-us-config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setWwu)
      .catch(() => setWwuFailed(true));
    fetch("/api/assistant/status")
      .then((r) => r.json())
      .then((d) => { setAiAvailable(!!d.available); setMode(d.available ? "ai" : "form"); })
      .catch(() => { setAiAvailable(false); setMode("form"); });
    // restore a saved form draft
    const saved = readStoredJson("local", "amora-work-with-us-draft");
    if (saved.status === "value" && saved.value && typeof saved.value === "object") {
      setForm({ ...EMPTY, ...(saved.value as Partial<Proposal>) });
    }
  }, []);

  // Prefill name/email for a signed-in member (only if they haven't typed yet).
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name || "", email: f.email || user.email || "" }));
  }, [user]);

  // The village's list once it has answered, an empty one included. Nothing
  // while it is on its way, so a list the founder emptied never flashes the
  // compiled four first; the compiled four only when the read failed.
  const reciprocityOptions: ReciprocityOption[] = wwu
    ? Array.isArray(wwu.reciprocityOptions) ? wwu.reciprocityOptions : RECIPROCITY_FALLBACK
    : wwuFailed ? RECIPROCITY_FALLBACK : [];
  // The village's own name for its guide, or "the village guide" (shared/guideName.ts), the neutral label
  // in the reader's language (client/src/lib/guideNameWords.ts). A typed name is never translated.
  // Ready once the document answers, so a named guide is never shown as the neutral label first.
  const audience = guideAudience(user);
  const guide = guideNameIn(wwu?.assistantName, audience, i18n);
  const assistantName = guide.name;
  const guideReady = wwu !== null || wwuFailed;

  const saveDraft = (next: Proposal) => {
    setForm(next);
    writeStoredJson("local", "amora-work-with-us-draft", next);
  };

  const onSubmitted = () => {
    setSubmitted(true);
    removeStored("local", "amora-work-with-us-draft");
  };

  if (submitted) {
    return (
      <Layout>
        <section className="bg-teal-band text-white py-24">
          <div className="container max-w-2xl mx-auto px-4 text-center">
            <Sprout size={72} className="mx-auto mb-6 text-amber-on-band" />
            {/* A longer heading the village wrote steps down a size on a
                phone: at its 48-character limit it ran five lines at 320px. */}
            <h1 ref={thanks} tabIndex={-1} className={`focus:outline-none font-display ${Array.from(page?.thanks.fields.heading ?? "").length > 32 ? "text-3xl md:text-4xl" : "text-4xl"} font-bold mb-4 break-words${page ? "" : " invisible"}`}>
              {page?.thanks.fields.heading || "\u00a0"}
            </h1>
            <p className="text-white text-lg break-words">
              <Emphasized text={page?.thanks.fields.body ?? ""} />
            </p>
            <p className="mt-4 text-lg font-semibold text-white" data-route-promise="">{replyPromise}</p>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="bg-teal-band text-white py-16">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-3">
            <Handshake className="w-6 h-6 text-amber-on-band" />
            <span className="text-amber-on-band font-medium text-sm tracking-widest uppercase">Work With Us</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4" data-venture-heading={venture ? "" : undefined}>
            {venture ? t({ message: "Start a venture", context: "four ways to build: a venture" }) : `Build and grow alongside ${projectName}`}
          </h1>
          {venture ? (
            <p className="text-white text-lg max-w-2xl leading-relaxed" data-venture-line="">
              {t({ message: `A venture is your own business on the land. You run it and keep its upside; ${projectName} shares in it through a lease or profit share.`, context: "work with us, set up for a venture: what a venture is, under the heading" })}
            </p>
          ) : (
          <p className="text-white text-lg max-w-2xl leading-relaxed">
            {wwu?.intro ??
              `Propose an idea, an offering, or a venture: a garden, a piece of infrastructure, a service, a craft, a program, or something we haven't imagined yet. ${projectNameSentenceStart} grows through the people who bring their gifts to it.`}
          </p>
          )}
        </div>
      </section>

      {/* Mode toggle */}
      <div className="bg-stone-50 border-b border-stone-200">
        <div className="container max-w-3xl mx-auto px-4 flex gap-2 py-3">
          {aiAvailable && guideReady && (
            <button
              onClick={() => setMode("ai")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                mode === "ai" ? "bg-teal-deep text-white" : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
              }`}
            >
              <MessageCircle className="w-4 h-4" /> {t({ message: `Talk it through with ${assistantName}`, context: "work with us: the button that opens a conversation with the village guide" })}
            </button>
          )}
          <button
            onClick={() => setMode("form")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              mode === "form" ? "bg-teal-deep text-white" : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Fill the form yourself
          </button>
        </div>
      </div>

      <section className="bg-stone-50 py-12">
        <div className="container max-w-3xl mx-auto px-4">
          <NameYourGuide guide={guide} audience={audience} ready={guideReady && !!aiAvailable} />
          {mode === "ai" && aiAvailable ? (
            !guideReady ? null : <GuideChat
              kind="work-with-us"
              venture={venture}
              projectName={projectName}
              assistantName={assistantName}
              greeting={wwu?.assistantGreeting}
              empty={EMPTY}
              onSubmitted={onSubmitted}
              onFallback={() => { setAiAvailable(false); setMode("form"); }}
              onRefineInForm={(p) => { saveDraft({ ...EMPTY, ...form, ...p }); setMode("form"); }}
            />
          ) : (
            /* ProposalForm's one use of the name opens a sentence with it. */
            <ProposalForm venture={venture} reciprocityLede={page?.reciprocity.fields.lede ?? null} reciprocityOptions={reciprocityOptions} form={form} setForm={saveDraft} onSubmitted={onSubmitted} />
          )}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground max-w-2xl mx-auto px-4 pb-12">
        This form is an invitation to propose and does not constitute an offer, agreement, or commitment.
        Any partnership is subject to mutual agreement and formal terms.
      </p>
    </Layout>
  );
}

// ── The structured form ──────────────────────────────────────────────────────

function ProposalForm({
  venture = false, reciprocityLede, reciprocityOptions, form, setForm, onSubmitted,
}: {
  /** Set up for a venture: the venture's three questions first, and `kind: "venture"` on what is sent. */
  venture?: boolean;
  /** Null until the page's words arrive. */
  reciprocityLede: string | null;
  reciprocityOptions: ReciprocityOption[];
  form: Proposal;
  setForm: (p: Proposal) => void;
  onSubmitted: () => void;
}) {
  const { t } = useLingui();
  const ventureFields = useVentureFields();
  const fields = venture ? ventureFields : PROPOSAL_FIELDS;
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hp, setHp] = useState(""); // honeypot: real people never fill this
  // "Walk me through the next steps" (5.11). Kept out of the saved draft: a yes is given once, here.
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key: keyof Proposal, value: any) => setForm({ ...form, [key]: value });
  const toggleRecip = (v: string) =>
    set("reciprocity", form.reciprocity.includes(v) ? form.reciprocity.filter((x) => x !== v) : [...form.reciprocity, v]);

  const uploadAttachment = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/work-with-us/attachment", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? data.error ?? "That file didn't attach. Try again.");
      else setForm({ ...form, attachment: data.filename, attachmentName: data.originalName || file.name });
    } catch {
      setError("That file didn't attach. Try again.");
    }
    setUploading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError("Add your name and email so we know who we're speaking with."); return; }
    for (const f of fields) if (f.required && !String(form[f.key]).trim()) { setError(`Answer this to continue: ${f.label}.`); return; }
    // Only a village that offers options can ask for one. With none listed
    // the person describes the exchange in their own words below.
    if (reciprocityOptions.length > 0 && form.reciprocity.length === 0) { setError("Choose at least one form of reciprocity that fits."); return; }
    setError("");
    setSubmitting(true);
    // A venture keeps the type the inbox already reads and says what it is beside it (shared/contributorRoutes.ts).
    const ok = await submitProposal("work-with-us", { ...form, ...(venture ? { kind: VENTURE_KIND } : {}), [FORM_CONSENT_FIELD]: consent }, hp);
    setSubmitting(false);
    if (ok) onSubmitted(); else setError("That didn't send. Try again.");
  };

  // The field key doubles as the control's id, so the label this helper
  // already renders is tied to the textarea it already renders. Six of these
  // go on the page and every one of them reached a screen reader unnamed.
  const field = (key: keyof Proposal, label: string, hint: string, required: boolean, rows = 3) => (
    <div>
      <label htmlFor={`work-${String(key)}`} className="block text-sm font-semibold text-foreground mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      <VoiceArea value={String(form[key])} onValue={(v) => set(key, v)} talk={{ label, purpose: hint }}>
      <textarea
        id={`work-${String(key)}`}
        value={String(form[key])}
        onChange={(e) => set(key, e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-deep resize-y"
      />
      </VoiceArea>
    </div>
  );

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 md:p-8 space-y-8">
      {/* About you */}
      <div>
        <h2 className="font-display text-xl font-bold text-teal-deep mb-1">About you</h2>
        <p className="text-sm text-muted-foreground mb-4">So we know who we're speaking with.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="work-name" className="block text-sm font-semibold text-foreground mb-1">Name <span className="text-red-500">*</span></label>
            <input id="work-name" autoComplete="name" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-deep" />
          </div>
          <div>
            <label htmlFor="work-email" className="block text-sm font-semibold text-foreground mb-1">Email <span className="text-red-500">*</span></label>
            <input id="work-email" autoComplete="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-deep" />
          </div>
          <div>
            <label htmlFor="work-phone" className="block text-sm font-semibold text-foreground mb-1">Phone / WhatsApp</label>
            <input id="work-phone" autoComplete="tel" type="text" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-deep" />
          </div>
          <div>
            <label htmlFor="work-background" className="block text-sm font-semibold text-foreground mb-1">What you do / where you're based</label>
            <input id="work-background" type="text" value={form.background} onChange={(e) => set("background", e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-deep" />
          </div>
        </div>
      </div>

      {/* The idea */}
      <div>
        <h2 className="font-display text-xl font-bold text-teal-deep mb-1">{venture ? t({ message: "Your venture", context: "work with us, set up for a venture: the heading over its questions" }) : "Your proposal"}</h2>
        <p className="text-sm text-muted-foreground mb-4">{venture ? t({ message: "Start with the business. The questions after it help us see what it takes.", context: "work with us, set up for a venture: the line under Your venture" }) : "Tell us about your idea. Specificity is a gift to both of us."}</p>
        <div className="space-y-5">
          {fields.map((f) => (
            <div key={f.key}>{field(f.key, f.label, f.hint, f.required, f.rows)}</div>
          ))}
        </div>
      </div>

      {/* Reciprocity */}
      <div>
        <h2 className="font-display text-xl font-bold text-teal-deep mb-1">Reciprocity</h2>
        <p className={`text-sm text-muted-foreground mb-4 break-words${reciprocityLede === null ? " invisible" : ""}`}>
          <Emphasized text={reciprocityLede ?? "\u00a0"} />
          {reciprocityOptions.length > 0 && (
            <> Select any that fit. <span className="text-red-500">*</span></>
          )}
        </p>
        {reciprocityOptions.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          {reciprocityOptions.map((o) => {
            const on = form.reciprocity.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => toggleRecip(o.value)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  on ? "border-teal-deep bg-teal-deep/5" : "border-stone-200 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? "bg-teal-deep border-teal-deep" : "border-stone-300"}`}>
                    {on && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </span>
                  <span className="font-semibold text-teal-deep text-sm">{o.title}</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">{o.desc}</p>
              </button>
            );
          })}
        </div>
        )}
        <label htmlFor="work-reciprocity" className="block text-sm font-semibold text-foreground mb-1">Tell us more about the exchange you're proposing</label>
        <p className="text-xs text-muted-foreground mb-2">Amounts, structure, percentages, a blend, or something we haven't listed.</p>
        <VoiceArea value={form.reciprocityDetail} onValue={(v) => set("reciprocityDetail", v)}
          talk={{
            label: t({ message: "What you offer in return", context: "voice field label: work with us reciprocity" }),
            purpose: t({ message: "The exchange you are proposing: amounts, structure, percentages, a blend, or something else.", context: "voice field purpose: work with us reciprocity" }),
          }}
        >
        <textarea id="work-reciprocity" value={form.reciprocityDetail} onChange={(e) => set("reciprocityDetail", e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-deep resize-y" />
        </VoiceArea>
      </div>

      {/* Optional attachment */}
      <div>
        <h2 className="font-display text-xl font-bold text-teal-deep mb-1">Bring a picture (optional)</h2>
        <p className="text-sm text-muted-foreground mb-3">A sketch, a photo, or a one-pager helps us see it. Image or PDF, up to 10MB.</p>
        {form.attachment ? (
          <div className="inline-flex items-center gap-2 bg-teal-deep/5 border border-teal-deep/20 rounded-lg px-3 py-2 text-sm text-teal-deep">
            <Paperclip className="w-4 h-4" /> {form.attachmentName || "Attached"}
            <button type="button" onClick={() => setForm({ ...form, attachment: "", attachmentName: "" })} className="text-stone-400 hover:text-red-500 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center pointer-coarse:-m-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 cursor-pointer bg-white border border-stone-200 rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
            <Paperclip className="w-4 h-4" /> {uploading ? "Attaching…" : "Attach a file"}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => uploadAttachment(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </div>

      {/* Honeypot — hidden from people, tempting to bots */}
      <input
        type="text"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <PathConsentBox checked={consent} onChange={setConsent} />

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-teal-deep text-white font-semibold px-8 py-3 rounded-xl hover:bg-teal-deep-dark disabled:opacity-50 transition-colors">
        {submitting ? "Sending…" : "Send proposal"} <ArrowRight className="w-4 h-4" />
      </button>
      <p className="text-xs text-stone-500">Your answers save as you go, so you can come back and finish later.</p>
    </form>
  );
}
