/**
 * APPLY FOR A ROLE, WITHOUT AN ACCOUNT (Rye, 2026-10-30; sheet 19i), as the
 * founding-team application (the lead, 11 Nov 2026; Phase A, lane A1).
 *
 *   /propose-a-role?role=<id>       "Apply: [role name]", from the role's card
 *   /propose-a-role                 the open roles, to choose one
 *   /propose-a-role/<token>         a link made for one person
 *   /propose-a-role/confirm?token=  the link in the confirmation email
 *
 * ONE ROLE PER APPLICATION. The role card's Apply link names it, and it is
 * already chosen. With no role named, the page shows the open roles, one door
 * each, and never lets more than one be chosen. A link naming several (the
 * draft board) applies for the first one the village still offers.
 *
 * SIX STEPS, "Step N of 6": Get to know us, About you, Your value, The terms,
 * Your first moon, Review & submit. The Firefly Path's mechanics are kept
 * (game feel wave 2): every step stays drawn and only the one you are on
 * shows, so Back loses nothing; every check runs in one place
 * (`findProblems`): Continue judges the step you are on, and Send reviews the
 * whole application in walking order, names every gap, and puts the cursor on
 * the first one (components/fireflyPath/stones.ts). Ticked to remember (the default), the answers
 * are saved on this device, never references or files (fireflyPath/applyRemember.ts).
 *
 * THE FOUNDING REGISTER (Phase A brief): the same night world, quieter.
 * Larger display type, more space, gold rules, the step circles as the only
 * geometry, one firefly cluster on the one primary act, and no game words.
 * Every village word (the ways to get to know us, the compensation shape, the
 * first cycle) is a village setting (shared/foundingApplication.ts).
 *
 * PHONE AND DESKTOP, each at its best. On a phone: one step fills the screen,
 * Back and Continue stay within thumb reach above the tab bar, and a swipe
 * walks between steps. On a desk: the role sits beside the step, every step
 * name shows on the gold rule, Enter moves on, and the arrow keys walk the
 * steps whenever the caret is not in a field.
 *
 * Sending asks the address to confirm; nothing reaches the village until it does
 * (server/routes/openProposals.ts; thresholds: components/fireflyPath/Thresholds.tsx).
 *
 * WHAT IS KEPT, said on the form in one line (sheet 19i): never confirmed, deleted after 48 hours;
 * declined, its name and address go after 90 days (docs/ARCHITECTURE.md, 3.9).
 */
import LoadFailed from "@/components/LoadFailed";
import GrowingField from "@/components/form/GrowingField";
import { LimitsAtTop } from "@/components/form/LimitSigns";
import { attachedBytes, attachmentRoom } from "@/components/openProposal/uploadSize";
import { sendApplication } from "@/components/openProposal/sendParts";
import { limitProblems } from "@/components/fireflyPath/limitProblems";
import { EMPTY_VOICE, useAskBeforeLeaving, VoiceClipsProvider, VoiceInvite, clipLimitsOf, type VoiceClipLimits, type VoiceState } from "@/components/voice/VoiceInvite";
import type { PieceSuggestion } from "@/components/roleCard/ShapeTheRole";
import { MembershipAtApplication, type MembershipChoice } from "@/components/openProposal/MembershipAtApplication";
import { AttachmentFields, linksToSend } from "@/components/openProposal/ProposalAttachments";
import type { ProposalLink } from "@shared/proposalAttachments";
import { AskSera, DraftMark } from "@/components/proposalDrafts/AskSera";
import { DRAFT_WORDS, goalsFromDraft, isTextDraft, placeDraftGoals, unconfirmedDrafts, type DraftMarks, type DraftableGoal } from "@shared/seraDrafts";
import { BLANK_GOAL, GOAL_LIMITS } from "@shared/proposalGoals";
import { CARD_LIMITS } from "@shared/openProposalCard";
import { BreathingLoader } from "@/components/natural";
import { AboutYouFacts, ReferencesBlock, EMPTY_ABOUT_YOU, aboutYouBody, aboutYouProblem, type AboutYouValue } from "@/components/openProposal/AboutYou";
import { civilDayWords } from "@shared/seasonPlans";
import { termOf, type OpenProposalTerm } from "@shared/openProposalTerm";
import { useLingui } from "@lingui/react/macro";
import { i18n } from "@/i18n/i18n";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { doorBackOf } from "@shared/seatApplyLinks";
import { EYEBROW, FIELD as LOOK_FIELD, HINT, LABEL, TILE, WORLD } from "@/components/journey/look";
import Layout from "@/components/Layout";
import { Beside, goToProblem, roleFromLink, showRoleInAddress, targetFor, type FormProblem } from "@/components/fireflyPath/applyPage";
import type { ExtraRole } from "@/components/fireflyPath/MoreRoles";
import { LazyStateNote } from "@/components/ComingSoonLazy";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { readStoredJson, removeStored, writeStoredJson } from "@/lib/safeStorage";
import { useFocusedFieldInView, useKeyboardInset } from "@/lib/keyboardInset";
import { IKIGAI_KEY, ikigaiFromStored, whyFromIkigai } from "@shared/roleDiscover";
import { OPEN_AIM_MAX, OPEN_ANONYMISE_DAYS, OPEN_APPLY_ROLES, OPEN_CONFIRM_HOURS, OPEN_WHY_MAX, OPEN_WORDS, SELF_KNOWLEDGE_MAX } from "@shared/openProposals";
import { addressProblem } from "@shared/comms/address";
import { foundingSetupOf, type FoundingSetup } from "@shared/foundingApplication";
import TermsEight, { draftTerms, EMPTY_TERMS_STEP, splitBody, splitOfDraft, withCardChoice, type TermsStepValue } from "@/components/governance/TermsEight";
import { judgeTermsStep, writtenKeys, type TermsWords } from "@shared/termsWords";
import { Practicalities, SeasonServes, browserTimeZone, goalsToFirstMoon, type Practical } from "@/components/openProposal/RoleCardBridge";
import { MoonText } from "@/components/MoonWord";
import { APPLY_MINUTES, LAST_STONE, STONES, enterWalksOn, onStone, orderByStone, ownsKeys, stoneOfField, swipeStep } from "@/components/fireflyPath/stones";
import { Notice, SentThreshold, prefersStill, type SentNote } from "@/components/fireflyPath/Thresholds";
import StoneBar from "@/components/fireflyPath/StoneBar";
import { recordingsReview, reviewExtras } from "@/components/fireflyPath/reviewExtras";
import { applyWordT, notSentWords } from "@/components/fireflyPath/applyWordsT";
import { ABOUT_PANES, AboutPanes, CompensationShape, NotOpenYet, ProblemsList, ReviewLines, RoleBeside, FirstDayFacts, GOLD_RULE, KnowUsStep, OpensLaterNote, OtherRole, RewardsBeside, RoleChoice, StepMark, StepTrail, ValueItems, aboutPaneOf } from "@/components/fireflyPath/ApplySteps";
import { draftKey, fromDraft, toDraft } from "@/components/fireflyPath/applyDraft";
import { useApplyWords } from "@/components/fireflyPath/applyWords";
import { EarlyWords } from "@/components/fireflyPath/EarlyWords";
import { ReviewPromises } from "@/components/fireflyPath/ReviewPromises";
import { carryAsDraft, readCarry, toCarry, writeCarry, type ApplyCarry } from "@/components/fireflyPath/applyCarry";
import { RestoredNote } from "@/components/fireflyPath/RestoredNote";
import { RememberOnDevice } from "@/components/fireflyPath/RememberOnDevice";
import { remembersByDefault } from "@/components/fireflyPath/applyRemember";
import { needsSafetyNet, type SendFailure } from "@/components/fireflyPath/applySendFailure";
export { ConfirmProposal } from "@/components/fireflyPath/Thresholds"; // The confirmation link lives with the other threshold; App.tsx and the tests still find it here.
export { firstUnanswered } from "@/components/fireflyPath/applyPage";
// Roles added to one application (the lead, 17 Nov 2026): loaded with The terms, off the first view.
const MoreRoles = lazy(() => import("@/components/fireflyPath/MoreRoles"));
// Shaping the role card, on Your value: loaded with the step, off the first view (scripts/route-first-view.json).
const ShapeTheRole = lazy(() => import("@/components/roleCard/ShapeTheRole"));
// The way out when a send fails (apply safety net, 19 Nov 2026): loaded only after a failure, off the first view.
const SafetyNet = lazy(() => import("@/components/fireflyPath/SafetyNet"));
// "Start a conversation", the two-minute way in (the lead, 20 Nov 2026): loaded only when asked for.
const StartConversation = lazy(() => import("@/components/fireflyPath/StartConversation"));

// The sheet's field and main button (docs/DESIGN_RULE.md, components/journey/look.ts).
const FIELD = `${LOOK_FIELD} py-3`;
/** Nothing a season goal does not have: the "serves" list a card sends is at most this long (shared/openProposalCard.ts). */
const SERVES_MAX = CARD_LIMITS.serves;

interface FormRole {
  id: string;
  name: string;
  circle: string;
  aim: string | null;
  accountabilities?: string[];
  timeCommitment?: string | null;
  /** The role's suggested wording for the eight settings and the commitment it asks (joining lane PR 3). */
  terms?: { words?: TermsWords; commitmentPct?: number | null }; commitmentMin?: number | null; payCeiling?: import("@shared/roleCardSections").PayCeiling | null; payShape?: import("@shared/proposalSplit").ShapeShare[]; // the commitment range (Rye, 14 Nov 2026) and the split in force (17 Nov)
  conversations?: Array<{ role: string; minutes: number; finalApproval?: boolean }>; held?: boolean; stillRecruiting?: boolean;
  bookingUrl?: string | null;
  /** A check happens for this role whatever the references say (0370). */
  alwaysChecked?: boolean;
  opensLater?: boolean; // opens after the founding team (Rye, 14 Nov 2026): OpensLaterNote
  comingSoon?: boolean; futureVenture?: boolean; // 16 Nov 2026: StateNote in place of OpensLaterNote
}

type FormState =
  | { kind: "loading" }
  | { kind: "closed"; message: string }
  | { kind: "open"; village: string; season: { id: string; name: string | null; startsOn: string } | null; term: OpenProposalTerm | null; goals: Array<{ id: string; text: string }>; roles: FormRole[]; setup: FoundingSetup; clips: VoiceClipLimits }
  | { kind: "failed" };

/** The form's page: the sheet's night ground, wide enough on a desk for the role beside the step. */
function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <Layout>
      <div className={`${WORLD} py-10 sm:py-16`}>
        <div className={`container ${wide ? "max-w-7xl" : "max-w-2xl"}`}>{children}</div>
      </div>
    </Layout>
  );
}

export default function ProposeARole() {
  const params = useParams<{ token?: string }>();
  const link = params.token ? decodeURIComponent(params.token) : "";
  const [form, setForm] = useState<FormState>({ kind: "loading" });
  const [formTries, setFormTries] = useState(0); // bumped by "Try again" after a failed load
  const [roleId, setRoleId] = useState<string | null>(null);
  /** A coming-soon role, applied for early (the lead, 20 Nov 2026): from the not-open page's button, or `?early=1`. */
  const [talk, setTalk] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("way") === "talk"); // "Start a conversation" (idea 14)
  const [early, setEarly] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("early") === "1");
  /** The roles added after the first, each with its own commitment, price and split (the lead, 17 Nov 2026). */
  const [extras, setExtras] = useState<ExtraRole[]>([]);
  const [gone, setGone] = useState(false);
  const [knowUs, setKnowUs] = useState<string[]>([]);
  const [why, setWhy] = useState("");
  const [aim, setAim] = useState("");
  const [items, setItems] = useState<DraftableGoal[]>([{ ...BLANK_GOAL }]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [selfKnowledge, setSelfKnowledge] = useState("");
  const [pieceSuggestions, setPieceSuggestions] = useState<PieceSuggestion[]>([]);
  const [rampUp, setRampUp] = useState(false);
  const [sending, setSending] = useState(false);
  /** Every problem found on the last press of Continue or Send, each with the field it is on (audit M1). */
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const error = problems[0] ?? null;
  const problemOn = (field: string) => { const m = problems.find((p) => p.field === field)?.message; return m ? applyWordT(m) : null; };
  const [sent, setSent] = useState<SentNote | null>(null);
  /** The last send's failure when it needs the safety net (fireflyPath/applySendFailure.ts); cleared by the next send. */
  const [failure, setFailure] = useState<SendFailure | null>(null);
  const [practical, setPractical] = useState<Practical>(() => ({ timeZone: browserTimeZone(), windows: [], earliestStart: "" }));
  /** The eight settings answered and the commitment chosen (components/governance/TermsEight.tsx). */
  const [termsStep, setTermsStep] = useState<TermsStepValue>(EMPTY_TERMS_STEP);
  const [agreed, setAgreed] = useState({ nda: false });
  /** Links to their work and files, for the deciders only (Rye, 10 Nov 2026). Files are never saved in the draft. */
  const [links, setLinks] = useState<ProposalLink[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [voice, setVoice] = useState<VoiceState>(EMPTY_VOICE); // Their voice note, sent only with their tick (components/voice/VoiceInvite.tsx).
  /** About you: facts, references and the consent (components/openProposal/AboutYou.tsx). */
  const [about, setAbout] = useState<AboutYouValue>(EMPTY_ABOUT_YOU);
  /** The words Sera drafted, until they are edited or kept (shared/seraDrafts.ts). Never sent. */
  const [marks, setMarks] = useState<DraftMarks>({});
  /** The membership alignment made here (Rye's answer 8). */
  const [membership, setMembership] = useState<MembershipChoice>({ kind: "none" });
  const [letterRead, setLetterRead] = useState(0);
  /** THE STEPS: the one you are on, and the furthest reached. */
  const [stone, setStone] = useState(0);
  const [reached, setReached] = useState(0);
  /** About you comes in three short panes (M7): You, Your story, Who can speak for you. */
  const [pane, setPane] = useState(0);
  /** The draft for this role has been read back (or there was none), so saving may begin. */
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [restored, setRestored] = useState<false | "draft" | "carry">(false);
  /** Their own choice to keep the answers on this device (fireflyPath/applyRemember.ts). Ticked to start (the lead, 19 Nov 2026), unless this browser unticked it before. */
  const [remember, setRemember] = useState(remembersByDefault);
  /** The words of the application just sent, held in this page only, so "Apply for another role too" works with nothing kept on the device. */
  const carriedHere = useRef<ApplyCarry | null>(null);
  /** What to put the cursor on after the next draw: the step's heading, or a field with a problem. */
  const [aimAt, setAimAt] = useState<{ n: number; target: string | null } | null>(null);
  const touch = useRef<{ x: number; y: number; owned: boolean } | null>(null);
  // M2: the step bar rides above a phone's keyboard, and the field being typed in comes into view.
  const formRef = useRef<HTMLFormElement>(null);
  const keyboard = useKeyboardInset();
  useFocusedFieldInView(formRef);
  const me = useOptionalAuth()?.user ?? null;
  const { t, i18n } = useLingui();

  // Recordings live only on this page until Send (never in the draft), so leaving or reloading asks first.
  useAskBeforeLeaving(!sent && (voice.takes.length > 0 || Object.keys(voice.clips).length > 0));
  useEffect(() => {
    // The role a card's Apply link (or the draft board) named: the first the village still offers.
    const wanted = new URLSearchParams(window.location.search).getAll("role").map((r) => r.trim()).filter(Boolean);
    fetch(`/api/open-proposals/form${link ? `?link=${encodeURIComponent(link)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))) // closed is a 200 with open: false; a 500 is an outage (resilience P2-6)
      .then((d) => {
        const roles: FormRole[] = Array.isArray(d?.roles) ? d.roles : [];
        setForm(
          d?.open
            ? { kind: "open", village: String(d.village ?? ""), season: d.season ?? null, term: termOf(d.term) ?? null, goals: Array.isArray(d.goals) ? d.goals : [], roles, setup: foundingSetupOf(d.founding), clips: clipLimitsOf(d.voice) }
            : { kind: "closed", message: String(d?.message ?? OPEN_WORDS.closed) },
        );
        if (d?.open) {
          const picked = roleFromLink(wanted, roles, OPEN_APPLY_ROLES);
          setRoleId(picked.id);
          // A coming-soon role named after the first is added as an early application (the lead, 20 Nov 2026).
          setExtras(picked.more.map((id) => ({ roleId: id, terms: EMPTY_TERMS_STEP })));
          setGone(picked.gone);
        }
      })
      .catch(() => setForm({ kind: "failed" }));
  }, [link, formTries]);

  // R-Ikigai answers the person ticked on the draft board become their own words in "Why you", once, and only into an empty field.
  useEffect(() => {
    const read = readStoredJson("local", IKIGAI_KEY);
    const words = whyFromIkigai(ikigaiFromStored(read.status === "value" ? read.value : null));
    if (words) setWhy((w) => w || words);
  }, []);

  // A guest who is signed in: their own name and address, which they can still change.
  useEffect(() => {
    if (!me) return;
    setName((n) => n || String(me.name ?? ""));
    setEmail((e) => e || String(me.email ?? ""));
  }, [me]);

  // THE SAVED DRAFT, read back once the role is known: the words, the step they were on. Never references or files.
  useEffect(() => {
    if (form.kind !== "open" || !roleId || draftFor === roleId) return;
    if (!early && form.roles.some((r) => r.id === roleId && r.comingSoon === true)) return; // a coming-soon role's draft is untouched until they apply early
    const read = readStoredJson("local", draftKey(roleId, link));
    const own = fromDraft(read.status === "value" ? read.value : null, new Date(), LAST_STONE);
    // No draft of its own: what they wrote in an earlier application, with this role's own answers blank (fireflyPath/applyCarry.ts).
    const stored = own ? null : readCarry(link, roleId, LAST_STONE);
    const carry = own ? null : (stored ?? (carriedHere.current ? carryAsDraft(carriedHere.current, roleId, new Date(), LAST_STONE) : null));
    // Something this device already keeps reads as ticked, so they see what is kept and can forget it.
    if (own || stored) setRemember(true);
    const d = own ?? carry?.draft ?? null;
    if (carry) {
      // Straight on from a sent one, the page still holds the last role's answers: those, files, consents and agreements start fresh.
      setAbout((a) => ({ ...a, references: [], consent: false })); setVoice({ ...EMPTY_VOICE, transcript: carry.transcript });
      setWhy(""); setItems([{ ...BLANK_GOAL }]); setFiles([]); setAgreed({ nda: false }); setMembership({ kind: "none" });
    }
    if (d) {
      setKnowUs(d.knowUs.filter((w) => form.setup.knowUs.includes(w)));
      if (d.why) setWhy(d.why);
      if (d.name) setName(d.name);
      if (d.email) setEmail(d.email);
      setAbout((a) => ({ ...a, ...d.about }));
      setSelfKnowledge(d.selfKnowledge);
      setLinks(d.links);
      setAim(d.aim);
      if (d.items.length) setItems(d.items);
      setMarks(d.marks);
      setTermsStep({ answers: d.terms.answers, commitmentPct: d.terms.commitmentPct, payAsk: d.terms.payAsk, paySplit: splitOfDraft(d.terms.paySplit) });
      // The roles added before the reload, each on its own terms, then any more the link names (the lead, 17 Nov 2026).
      const kept = (own?.extras ?? []).filter((x) => x.roleId !== roleId && form.roles.some((r) => r.id === x.roleId)).map((x) => ({ roleId: x.roleId, terms: { answers: {}, commitmentPct: x.terms.commitmentPct, payAsk: x.terms.payAsk, paySplit: splitOfDraft(x.terms.paySplit) } }));
      if (kept.length) setExtras((now) => [...kept, ...now.filter((x) => !kept.some((k) => k.roleId === x.roleId))].slice(0, OPEN_APPLY_ROLES - 1));
      setRampUp(d.rampUp); setPieceSuggestions(d.pieceSuggestions);
      setPractical((p) => ({ timeZone: d.practical.timeZone || p.timeZone, windows: d.practical.windows, earliestStart: d.practical.earliestStart }));
      setStone(d.step);
      setReached(d.reached);
      setRestored(own ? "draft" : "carry");
    }
    if (!d) setRampUp(false); setTermsStep((s) => withCardChoice(s, window.location.search, form.roles.find((r) => r.id === roleId))); setDraftFor(roleId); // the box starts as remembersByDefault set it (19 Nov 2026); the card's slider and split (17 Nov 2026)
  }, [form, roleId, link, draftFor, early]);

  /** The draft as toDraft writes it, from what the page holds now. */
  const draftNow = () => toDraft({ step: stone, reached, knowUs, why, name, email, about: { based: about.based, languages: about.languages, story: about.story }, selfKnowledge, links, aim, items, marks, terms: draftTerms(termsStep), rampUp, practical, pieceSuggestions, extras: extras.map((x) => ({ roleId: x.roleId, terms: draftTerms(x.terms) })) }, new Date());
  /** What the safety net downloads: the draft this browser saved, or, with nothing kept on the device, the same fields from the page. */
  const draftForBackup = () => {
    if (roleId) {
      const read = readStoredJson("local", draftKey(roleId, link));
      const kept = fromDraft(read.status === "value" ? read.value : null, new Date(), LAST_STONE);
      if (kept) return kept;
    }
    return draftNow();
  };

  // THE DRAFT, saved as they go. Only the fields toDraft names: references, consent, files and agreements cannot reach it.
  useEffect(() => {
    if (!roleId || draftFor !== roleId || sent || !remember) return;
    writeStoredJson("local", draftKey(roleId, link), draftNow());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId, draftFor, link, sent, remember, stone, reached, knowUs, why, name, email, about.based, about.languages, about.story, selfKnowledge, links, aim, items, marks, termsStep, rampUp, practical, pieceSuggestions, extras]);

  // After a step: the cursor on the new step's heading, or on the field that needs a look.
  useEffect(() => {
    if (!aimAt) return;
    if (aimAt.target) {
      goToProblem(aimAt.target);
      return;
    }
    const h = document.getElementById(`stone-${stone}-h`);
    document.querySelector<HTMLElement>("[data-open-proposal]")?.scrollIntoView?.({ block: "start", behavior: prefersStill() ? "auto" : "smooth" });
    h?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimAt]);

  const role = useMemo(() => (form.kind === "open" && roleId ? (form.roles.find((r) => r.id === roleId) ?? null) : null), [form, roleId]);
  /** A role as The terms read it: its words, commitment range, price and split, and its circle. */
  const asTerms = (r: FormRole) => ({ id: r.id, name: r.name, circle: r.circle, held: r.held, stillRecruiting: r.stillRecruiting, comingSoon: r.comingSoon, futureVenture: r.futureVenture, words: r.terms?.words, commitmentPct: r.terms?.commitmentPct ?? null, commitmentMin: r.commitmentMin ?? null, ceiling: r.payCeiling ?? null, payShape: r.payShape, suggestions: r.id === roleId ? pieceSuggestions.length : 0 });
  const extraRoles = extras.map((x) => (form.kind === "open" ? form.roles.find((r) => r.id === x.roleId) : undefined));
  /** Each role's own split as the rail and the phone's terms step say it (production check of 1.3.25). */
  const ownSplits = [{ name: role?.name ?? "", line: termsStep.paySplitView?.line ?? "" }, ...extras.map((x, i) => ({ name: extraRoles[i]?.name ?? "", line: x.terms.paySplitView?.line ?? "" }))].filter((x) => x.line);
  /** An added role's commitment: none chosen yet, or below what the role takes from one person. */
  const extraRoleCheck = (x: ExtraRole, r: FormRole | undefined) => (x.terms.commitmentPct === null ? "none" : x.terms.commitmentPct < (r?.commitmentMin ?? 0) ? "below" : null);

  const { labels, intro, starters, starterHint, paneNames } = useApplyWords();

  /** The value items as the card sends them: blank rows out, the draft flag off. */
  const filledItems = items.filter((g) => g.title.trim() || g.doneWhen.trim() || g.serves);
  /** The season goals the items are tagged to, in order, as the card's "serves" (at most three; each item keeps its own tag). */
  const servesOf = (): Array<{ goalId: string; how: string; roleId: string }> => {
    const ids: string[] = [];
    for (const g of filledItems) if (g.serves && !ids.includes(g.serves)) ids.push(g.serves);
    return ids.slice(0, SERVES_MAX).map((goalId) => ({
      goalId,
      how: filledItems.filter((g) => g.serves === goalId).map((g) => g.title.trim()).filter(Boolean).join("; ").slice(0, CARD_LIMITS.how),
      roleId: roleId as string,
    }));
  };

  /**
   * EVERY CHECK THE FORM MAKES, in one place (audit M1, B1). Continue keeps the
   * ones on its own step; Send keeps all of them. The server judges all of it again.
   */
  const findProblems = (): FormProblem[] => {
    const found: FormProblem[] = [];
    const add = (field: string, message: string, target = targetFor(field)) => found.push({ field, message, target });
    const valueDrafts = unconfirmedDrafts({ aim, story: "", marks, goals: items });
    if (valueDrafts.length > 0) found.push({ field: "drafts:moon", message: DRAFT_WORDS.blocked(valueDrafts), target: null });
    const aboutDrafts = unconfirmedDrafts({ aim: "", story: about.story, marks, goals: [] });
    if (aboutDrafts.length > 0) found.push({ field: "drafts:about", message: DRAFT_WORDS.blocked(aboutDrafts), target: null });
    if (!name.trim()) add("name", OPEN_WORDS.needName);
    if (!email.trim()) add("email", OPEN_WORDS.needEmail); else if (/[,;]/.test(email) || addressProblem(email)) add("email", OPEN_WORDS.badEmail);
    if (!why.trim()) add("why", OPEN_WORDS.needWhy);
    const aboutProblem = aboutYouProblem(about, role?.alwaysChecked === true || extraRoles.some((r) => r?.alwaysChecked === true));
    if (aboutProblem) add("checkConsent", aboutProblem);
    if (!aim.trim()) add("aim", OPEN_WORDS.needAim);
    if (!roleId) add("roles", OPEN_WORDS.needRole);
    // Your value: at least one item, each named, each with how we will know it is done, each tagged when the season has goals.
    const prefix = `#value-${roleId ?? ""}`;
    if (filledItems.length === 0) add("card", t({ message: "Add at least one value item.", context: "founding application check" }), `${prefix}-0-title`);
    items.forEach((g, i) => {
      if (!(g.title.trim() || g.doneWhen.trim() || g.serves)) return;
      const n = i + 1;
      if (!g.title.trim()) add("card", t({ message: `Say what value ${n} brings.`, context: "founding application check" }), `${prefix}-${i}-title`);
      else if (!g.doneWhen.trim()) add("card", t({ message: `Say how we'll know value ${n} is done.`, context: "founding application check" }), `${prefix}-${i}-done`);
      if (form.kind === "open" && form.goals.length > 0 && !g.serves) add("serves", t({ message: `Choose the season goal value ${n} serves.`, context: "founding application check" }), `${prefix}-${i}-serves`);
    });
    // Every written setting answered and the commitment chosen, in the shared rules' words.
    if (role) {
      const judgedTerms = judgeTermsStep({ answers: termsStep.answers, commitmentPct: termsStep.commitmentPct }, writtenKeys([role, ...extraRoles].map((r) => ({ words: r?.terms?.words, commitmentPct: r?.terms?.commitmentPct ?? null }))));
      if (!judgedTerms.ok) add("terms", judgedTerms.error);
    }
    // Each role added: its own commitment, within what that role takes from one person.
    extras.forEach((x, i) => {
      const p = extraRoleCheck(x, extraRoles[i]);
      if (p) add(`roles.${i + 1}`, p === "none" ? OPEN_WORDS.needRoleCommitment : t({ message: `Choose ${extraRoles[i]?.commitmentMin ?? 10}% or more for ${extraRoles[i]?.name ?? ""}.`, context: "founding application check" }));
    });
    if (!agreed.nda) add("agreed", t({ message: "Tick that you will align with the village's confidentiality agreement once you are approved.", context: "founding application check" }));
    // NOTHING OVER ITS LIMIT GOES, AND NOTHING IS CUT (the ops request of 19 Nov 2026): every answer stays whole in its
    // box; the send names each one that runs over, with how much to trim, and anything too big to upload.
    for (const p of limitProblems({ why, about, selfKnowledge, links, aim, items, valuePrefix: prefix, pieceSuggestions, terms: [termsStep, ...extras.map((x) => x.terms)], voice, files, clipsMax: form.kind === "open" ? form.clips.max : 0 }, i18n)) {
      add(p.field, p.message, p.target === undefined ? targetFor(p.field) : p.target);
    }
    return orderByStone(found);
  };

  /** Stand on a step. `keep` leaves the problems listed (a jump from the review to a field). */
  const goTo = (i: number, opts: { keep?: boolean; target?: string | null; pane?: number } = {}) => {
    const s = Math.max(0, Math.min(LAST_STONE, i));
    if (!opts.keep) setProblems([]);
    // About you opens on its first pane, and on its last when Back walks into it.
    setPane(opts.pane ?? 0);
    setStone(s);
    setReached((r) => Math.max(r, s));
    setAimAt((a) => ({ n: (a?.n ?? 0) + 1, target: opts.target ?? null }));
  };

  /** A problem's own place: its step, then its field. */
  const show = (p: FormProblem) => goTo(stoneOfField(p.field), { keep: true, target: p.target ?? "#propose-problems", pane: aboutPaneOf(p.field) });

  /** Continue: this step is judged on its own, and the application goes on only when it holds. Step 1 never holds anyone. */
  const next = () => {
    if (stone >= LAST_STONE) return;
    const onAbout = stone === STONES.indexOf("about");
    // On About you, Continue judges the pane you are on and walks to the next pane before the next step.
    const mine = onStone(findProblems(), stone).filter((p) => !onAbout || aboutPaneOf(p.field) <= pane);
    if (mine.length > 0) {
      setProblems(mine);
      if (onAbout) setPane(aboutPaneOf(mine[0].field));
      // The list of what is missing stands just above Continue; the cursor goes to it, so the press is answered in place.
      setAimAt((a) => ({ n: (a?.n ?? 0) + 1, target: "#propose-problems" }));
      return;
    }
    if (onAbout && pane < ABOUT_PANES - 1) {
      setProblems([]);
      setPane(pane + 1);
      setAimAt((a) => ({ n: (a?.n ?? 0) + 1, target: null }));
      return;
    }
    goTo(stone + 1);
  };
  const back = () => {
    if (stone === STONES.indexOf("about") && pane > 0) {
      setProblems([]);
      setPane(pane - 1);
      setAimAt((a) => ({ n: (a?.n ?? 0) + 1, target: null }));
      return;
    }
    goTo(stone - 1, { pane: ABOUT_PANES - 1 });
  };

  const send = async () => {
    if (sending || !roleId) return;
    // THE FINAL REVIEW: every problem in the whole application at once, in the order it is walked.
    const found = findProblems();
    if (found.length > 0) {
      setProblems(found);
      const here = stoneOfField(found[0].field) === LAST_STONE;
      setAimAt((a) => ({ n: (a?.n ?? 0) + 1, target: here ? (found[0].target ?? "#propose-problems") : "#propose-problems" }));
      return;
    }
    setSending(true);
    setProblems([]);
    setFailure(null);
    // A send that hangs is a failure too: given up after a while long enough for files on a slow line.
    const stop = new AbortController();
    try {
      const proposal = {
        name,
        email,
        why,
        aim,
        hp,
        link: link || undefined,
        roles: [{ roleId, note: "" }, ...extras.map((x) => ({ roleId: x.roleId, note: "", commitmentPct: x.terms.commitmentPct ?? undefined, ...splitBody(x.terms), ...(x.terms.payAsk && (x.terms.payAsk.kind === "negotiate" || x.terms.payAsk.monthly > 0) ? { payAsk: x.terms.payAsk } : {}) }))],
        card: {
          roles: [{ roleId, moves: [], firstMoon: goalsToFirstMoon(filledItems) }],
          timeZone: practical.timeZone.trim(),
          windows: practical.windows,
          earliestStart: practical.earliestStart,
          // The eight settings, each answered, and the commitment chosen: the server judges both again.
          terms: { answers: termsStep.answers },
          commitmentPct: termsStep.commitmentPct ?? undefined,
          serves: servesOf(),
          agreed,
        },
        // Step 1's ticks, the ramp-up, and Human Design or Gene Keys (never served to the people who decide).
        knowUs,
        ...(rampUp ? { rampUp: true } : {}),
        ...(selfKnowledge.trim() ? { selfKnowledge: selfKnowledge.trim() } : {}),
        // The site language they are reading this in: their emails and status page follow it (shared/applicantLanguage.ts).
        locale: i18n.locale,
        ...(membership.kind === "aligned" ? { membership: { letterVersion: membership.letterVersion } } : {}),
        ...(linksToSend(links).length ? { links: linksToSend(links) } : {}),
        ...aboutYouBody(about), ...(pieceSuggestions.length ? { pieceSuggestions } : {}), ...splitBody(termsStep), ...(termsStep.payAsk && (termsStep.payAsk.kind === "negotiate" || termsStep.payAsk.monthly > 0) ? { payAsk: termsStep.payAsk } : {}),
      };
      // Each file, take and clip goes first in a request of its own, inside the host's five minutes, and then the
      // application naming them; every request has its own window for its size (components/openProposal/sendParts.ts).
      const res = await sendApplication(proposal, files, voice, { link: link || undefined, signal: stop.signal });
      const data = await res.json().catch(() => ({}));
      // The letter changed while they read it: show it again, untick, and say so.
      if (!res.ok && data?.field === "membership") setLetterRead((n) => n + 1);
      if (!res.ok) {
        // A refusal (a rate limit's words among them) lands on its field's step; one with no field stays on Review & submit.
        const field = typeof data?.field === "string" ? data.field : null;
        const p = { field, message: typeof data?.error === "string" ? data.error : notSentWords(), target: targetFor(field) };
        setProblems([p]);
        // Nothing the applicant can fix in an answer: the way out, beside the server's words. The draft stays as it is.
        const f: SendFailure = { kind: "status", status: res.status, field };
        if (needsSafetyNet(f)) setFailure(f);
        show(p);
        return;
      }
      // Sent, and only now: the draft has done its work, and their own words wait for a next role (fireflyPath/applyCarry.ts).
      removeStored("local", draftKey(roleId, link));
      const carryFields = { name, email, about, selfKnowledge, links, knowUs, items, marks, transcript: voice.transcript };
      carriedHere.current = toCarry(carryFields, new Date());
      if (remember) writeCarry(link, carryFields);
      const sentTo = email.trim();
      const kept = data?.kept === true; // Kept though our confirmation email failed (server/lib/openProposalKept.ts): said honestly.
      setSent({
        message: kept ? t({ message: `We have your application. Our confirmation email didn't go out, so we'll write to you at ${sentTo} soon.`, context: "founding application kept" }) : t({ message: `Check ${sentTo}. We sent a link to confirm it's you. Your application reaches us once you open it.`, context: "founding application sent" }),
        to: sentTo,
        at: new Date(),
        replyDays: typeof data?.replyDays === "number" ? data.replyDays : null, afterFounding: data?.afterFounding === true,
        // Coming soon (Rye, 16 Nov 2026): the confirmation repeats that interviews may take a while to start.
        comingSoon: role?.comingSoon === true,
        futureVenture: role?.futureVenture === true,
        ...(kept ? { kept, statusPath: typeof data?.statusPath === "string" && data.statusPath.startsWith("/application-status/") ? data.statusPath : null } : {}),
      });
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      // The network dropped or the send took too long: the way out, and the draft stays as it is.
      setFailure({ kind: stop.signal.aborted || (e as { name?: string } | null)?.name === "AbortError" ? "timeout" : "network" });
    } finally {
      setSending(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stone < LAST_STONE) next();
    else void send();
  };

  // A desk's keys: Ctrl or Cmd with Enter moves on even from a long answer; the arrows walk the steps whenever the caret is not in a field.
  const onKeys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (stone < LAST_STONE) next();
      else void send();
      return;
    }
    // Enter in a one-line field walks on: before Send the form has no submit button, so the page says it itself.
    if (e.key === "Enter" && stone < LAST_STONE && enterWalksOn(e.target)) {
      e.preventDefault();
      next();
      return;
    }
    if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || ownsKeys(e.target)) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" && stone > 0) {
      e.preventDefault();
      back();
    }
  };

  // A phone's swipe: the finger moving left walks on, right walks back. A swipe that starts in a field is the field's.
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = p ? { x: p.clientX, y: p.clientY, owned: ownsKeys(e.target) } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    const p = e.changedTouches[0];
    if (!start || !p || start.owned) return;
    const step = swipeStep(p.clientX - start.x, p.clientY - start.y);
    if (step === 1) next();
    else if (step === -1 && stone > 0) back();
  };

  if (form.kind === "loading") {
    return (
      <Shell>
        <BreathingLoader label={t({ message: "Opening the application", context: "founding application" })} showLabel />
      </Shell>
    );
  }
  if (form.kind === "failed") {
    return (
      <Shell>
        <LoadFailed onRetry={() => { setForm({ kind: "loading" }); setFormTries((n) => n + 1); }} />
      </Shell>
    );
  }
  if (form.kind === "closed") {
    return (
      <Shell>
        <Notice title={t`Not open right now`}>
          <p>{applyWordT(form.message)}</p>
        </Notice>
      </Shell>
    );
  }
  if (sent) {
    // Another role: back to the open roles; the next one starts from what they wrote here (fireflyPath/applyCarry.ts).
    const another = form.roles.length > 1 ? () => { setSent(null); setRoleId(null); setStone(0); setReached(0); setRestored(false); showRoleInAddress(null); window.scrollTo?.({ top: 0 }); } : undefined;
    return <SentThreshold sent={sent} roles={role ? [role, ...extraRoles.filter((r): r is FormRole => !!r)] : []} onFixAddress={() => { setSent(null); goTo(stoneOfField("email"), { target: "#propose-email" }); }} onAnother={another} />;
  }

  // Only when a door sent the visitor here with `from`; a shared link stands on its own.
  const cameFrom = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") ? doorBackOf(window.location.search, "", window.location.origin) : null;
  const backDoor = cameFrom && (
    <Link
      href={cameFrom.href}
      className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      data-door-back=""
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {cameFrom.card ? t`Back to the role` : cameFrom.circle ? t`Back to the circle` : t`Back to the roles`}
    </Link>
  );
  const setup = form.setup;
  const choose = (id: string | null) => {
    setRoleId(id);
    setEarly(false);
    setExtras([]);
    setGone(false);
    setProblems([]);
    setStone(0);
    setReached(0);
    setRestored(false);
    showRoleInAddress(id);
  };

  // "START A CONVERSATION" (the lead, 20 Nov 2026): the short way in, through the same door; the sent page follows as for any application.
  if (talk && form.season) return <Shell>{backDoor}<Suspense fallback={<BreathingLoader label={t({ message: "Opening the application", context: "founding application" })} showLabel />}><StartConversation village={form.village} roles={form.roles} first={roleId} link={link} me={me ? { name: String(me.name ?? ""), email: String(me.email ?? "") } : null} onSent={(s, ids) => { setRoleId(ids[0] ?? null); setExtras(ids.slice(1).map((id) => ({ roleId: id, terms: EMPTY_TERMS_STEP }))); setSent(s); }} onFull={() => setTalk(false)} /></Suspense></Shell>;

  // NO ROLE NAMED: the open roles, one door each. One application is for one role.
  if (!role) {
    return (
      <Shell>
        {backDoor}
        <p className={EYEBROW}>{form.village}</p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-foreground sm:text-5xl">{t({ message: "Join the founding team", context: "founding application choose" })}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {form.season
            ? t({ message: "Choose the role you are applying for. Each application is for one role.", context: "founding application choose" })
            : t`The village hasn't set its next season yet, so there's nothing to propose for right now. Check back soon.`}
        </p>
        {gone && (
          <p role="status" className={`mt-6 ${TILE} text-sm text-foreground`} data-role-gone="">
            {t({ message: "The role in your link is not open any more. These are open now.", context: "founding application choose" })}
          </p>
        )}
        {form.season && (
          <div className={`mt-8 ${GOLD_RULE} pt-8`}>
            <RoleChoice roles={form.roles} onPick={(id) => choose(id)} />
          </div>
        )}
      </Shell>
    );
  }

  // A COMING-SOON ROLE: its waitlist first, and "Apply early" opens the form (the lead, 19 and 20 Nov 2026).
  if (role.comingSoon && !early) return <Shell>{backDoor}<NotOpenYet role={role} onEarly={() => setEarly(true)}>{form.roles.some((r) => !r.comingSoon && r.id !== role.id) && <OtherRole onChoose={() => choose(null)} />}</NotOpenYet></Shell>;
  const invalid = (field: string) => (problems.some((p) => p.field === field) ? { "aria-invalid": true, "aria-describedby": `propose-problem-${field}` } : {});
  const startWith = (phrase: string) => {
    const next = why.trim() ? `${why.trimEnd()}\n\n${phrase} ` : `${phrase} `;
    setWhy(next);
    window.setTimeout(() => {
      const box = document.getElementById("propose-why") as HTMLTextAreaElement | null;
      box?.focus();
      box?.setSelectionRange?.(box.value.length, box.value.length);
    }, 0);
  };
  const askRoles = [{ roleId: role.id, note: "" }];
  const commitment = termsStep.commitmentPct;
  const stepNumber = stone + 1;
  const stepCount = STONES.length;
  const nextName = stone === STONES.indexOf("about") && pane < ABOUT_PANES - 1 ? paneNames[pane + 1] : labels[Math.min(stone + 1, LAST_STONE)];
  const ticked = knowUs.length;
  const ways = setup.knowUs.length;
  const valueCount = filledItems.length;
  const missingTag = form.goals.length > 0 ? items.map((g, i) => (g.title.trim() && !g.serves ? i + 1 : 0)).filter(Boolean) : [];
  const short = (s: string) => (s.trim().length > 90 ? `${s.trim().slice(0, 90)}…` : s.trim());
  const notYet = t({ message: "Not written yet", context: "founding application review" });
  // The review reads the earliest start in plain words ("1 December 2026"), as the rest of the page says a day.
  const startDay = practical.earliestStart ? civilDayWords(practical.earliestStart, i18n.locale) : "";
  // Several roles: each one's commitment, and the commitments added (the lead, 17 Nov 2026).
  const eachRole = [`${commitment}% ${role.name}`, ...extras.map((x, i) => `${x.terms.commitmentPct}% ${extraRoles[i]?.name ?? ""}`)].join(", ");
  const allPct = (commitment ?? 0) + extras.reduce((n, x) => n + (x.terms.commitmentPct ?? 0), 0);
  // Each role's own price and split on Review & submit, then the total (production check of 1.3.24).
  const reviewRoles = extras.length ? [{ name: role.name, ceiling: role.payCeiling, pct: commitment, ask: termsStep.payAsk, split: termsStep.paySplitView }, ...extras.map((x, i) => ({ name: extraRoles[i]?.name ?? "", ceiling: extraRoles[i]?.payCeiling, pct: x.terms.commitmentPct, ask: x.terms.payAsk, split: x.terms.paySplitView }))] : undefined;
  /** Review & submit: each step in a line, with a way back to it. */
  const review: Array<[number, string]> = [
    [0, ways === 0 ? t({ message: "Nothing to tick", context: "founding application review" }) : t({ message: `${ticked} of ${ways} done`, context: "founding application review" })],
    [1, why.trim() ? `${name.trim() || notYet} · ${short(why)}` : notYet],
    [2, valueCount === 1 ? t({ message: `1 value item. Aim: ${short(aim) || notYet}`, context: "founding application review" }) : t({ message: `${valueCount} value items. Aim: ${short(aim) || notYet}`, context: "founding application review" })],
    [
      3,
      extras.length > 0 && commitment != null && extras.every((x) => x.terms.commitmentPct != null)
        ? t({ message: `Commitment: ${eachRole}. ${allPct}% in all`, context: "founding application review, several roles" })
        : commitment == null
        ? t({ message: "Commitment not chosen yet", context: "founding application review" })
        : rampUp
          ? t({ message: `Commitment: ${commitment}%, with a ramp-up`, context: "founding application review" })
          : t({ message: `Commitment: ${commitment}%`, context: "founding application review" }),
    ],
    [4, startDay ? t({ message: `Earliest start: ${startDay}`, context: "founding application review" }) : t({ message: "No start date given", context: "founding application review" })],
  ];

  // The recordings on Review & submit: whether they go (reviewExtras.ts recordingsReview).
  const voiceReview = recordingsReview(i18n, { step: STONES.indexOf("about"), recordings: voice.takes.length + Object.keys(voice.clips).length, consent: voice.consent });

  const panel = (i: number) => ({
    hidden: stone !== i,
    "data-stone": STONES[i],
    "aria-labelledby": `stone-${i}-h`,
    className: "grid gap-8",
  });
  const heading = (i: number) => (
    <div className="grid gap-3">
      <h2 id={`stone-${i}-h`} tabIndex={-1} className="font-display text-3xl leading-tight text-card-foreground outline-none sm:text-4xl">
        <span className={`block ${EYEBROW}`}>{t({ message: `Step ${stepNumber} of ${stepCount}`, context: "founding application steps" })}</span>
        <span className="sr-only"> · </span>
        <MoonText text={labels[i]} />
      </h2>
      <p className="max-w-2xl text-base leading-relaxed text-muted-foreground"><MoonText text={intro[i]} /></p>
    </div>
  );
  const pct = role.terms?.commitmentPct;
  return (
    <Shell wide>
      <header className="mb-8 max-w-3xl">
        {backDoor}
        <p className={EYEBROW}>{role.circle}</p>
        <h1 className="mt-2 break-words font-display text-4xl leading-tight text-foreground sm:text-5xl">{t({ message: `Apply: ${role.name}`, context: "founding application title" })}</h1>
        {/* The real count, from the steps themselves, and the time (idea 7); with the notes below, said once, on the first step. */}
        {stone === 0 && <p className="mt-4 text-base leading-relaxed text-muted-foreground" data-apply-lede="">{t({ message: `${stepCount} steps. About ${APPLY_MINUTES} minutes. You can answer by voice.`, context: "founding application lede" })} {me ? t({ message: "Your name and email come from your account.", context: "founding application lede" }) : t({ message: "No account needed.", context: "founding application lede" })}</p>}
        {/* The cycle's dates are not named here (QA2-05): a founding role's first cycle is one paid month from
            the day it starts, said on the Your first moon step, and an internal moon has no plain meaning here. */}
        {/* Coming soon or a future venture (16 Nov 2026): its own note says the later start, so the founding-team note steps aside. */}
        {stone > 0 ? null : role.comingSoon ? <p className={`mt-4 ${TILE} text-sm text-foreground`} data-early-application=""><EarlyWords /></p> : role.futureVenture ? <LazyStateNote role={role} className={`mt-4 ${TILE}`} /> : <OpensLaterNote show={role.opensLater} />}
        {/* The village's note when the application changes (QA2-14, org.founding_updated_note): empty, no note. */}
        {setup.updatedNote && (
          <p className="mt-2 text-sm text-foreground" data-updated-note="">
            {setup.updatedNote}
          </p>
        )}
        <RememberOnDevice on={remember} onChange={setRemember} onForgotten={() => setRestored(false)} brief={stone > 0} />
        {stone === 0 && <LimitsAtTop className="mt-3" />}
        {restored && <RestoredNote kind={restored} />}
        {stone === 0 && form.roles.length > 1 && <OtherRole onChoose={() => choose(null)} />}
        {stone === 0 && <button type="button" onClick={() => setTalk(true)} className="ml-4 min-h-11 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" data-start-conversation-door="">{t({ message: "Short on time? Start a conversation", context: "founding application: the short way in" })}</button>}
      </header>

      {!form.season ? (
        <p className="text-muted-foreground">{t`The village hasn't set its next season yet, so there's nothing to propose for right now. Check back soon.`}</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)_17rem] lg:items-start">
          {/* A desk: the path stands in its own column beside the step (D-06). */}
          <aside aria-label={t({ message: "Your progress", context: "founding application, the steps beside" })} className="hidden lg:sticky lg:top-24 lg:block" data-step-trail-beside="">
            <StepTrail labels={labels} now={stone} reached={reached} onGo={(i) => goTo(i)} />
          </aside>
          <VoiceClipsProvider voice={voice} setVoice={setVoice} limits={form.clips} link={link || undefined} aiLineAt={voice.skipped ? "why" : null}>
          <form
            ref={formRef}
            onSubmit={submit}
            onKeyDown={onKeys}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            noValidate
            className="relative min-w-0 scroll-mt-28 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-10"
            data-open-proposal=""
            data-hides-fab=""
            data-hides-tabbar-phone=""
            data-stone-now={STONES[stone]}
            data-about-pane-now={stone === STONES.indexOf("about") ? pane : undefined}
          >
            <div className="mb-8 border-b border-notice/40 pb-6 lg:hidden">
              <StepMark labels={labels} now={stone} reached={reached} onGo={(i) => goTo(i)} />
            </div>

            {stone === LAST_STONE && <ProblemsList problems={problems} labels={labels} stone={stone} onShow={show} />}
            {failure && (
              <Suspense fallback={null}>
                <SafetyNet
                  village={form.village}
                  roles={[{ id: role.id, name: role.name }, ...extras.map((x, i) => ({ id: x.roleId, name: extraRoles[i]?.name ?? x.roleId }))]}
                  goals={form.goals}
                  draft={draftForBackup}
                  kept={remember && !!roleId && readStoredJson("local", draftKey(roleId, link)).status === "value"}
                  onRetry={() => void send()}
                  sending={sending}
                />
              </Suspense>
            )}

            {/* STEP 1: get to know us. Never locks. */}
            <section {...panel(0)}>
              {heading(0)}
              <KnowUsStep ways={setup.knowUs} note={setup.knowUsNote} ticked={knowUs} onChange={setKnowUs} links={setup.knowUsLinks} />
            </section>

            {/* STEP 2: about you. Who you are, why you and why now, your work, references, and Human Design or Gene Keys. */}
            <section {...panel(1)}>
              {heading(1)}
              <AboutPanes names={paneNames} now={pane} />
              <div hidden={pane !== 0} data-about-pane="0" className="grid gap-8">
              <VoiceInvite value={voice} onChange={setVoice} drafting={{ roleId: role.id, link: link || undefined, empty: { why: !why.trim(), aim: !aim.trim(), story: !about.story.trim(), items: filledItems.length === 0 },
                onUse: (d) => { if (d.why) setWhy(d.why); if (d.aim) setAim(d.aim); if (d.story) setAbout((a) => ({ ...a, story: d.story! })); if (d.items) setItems((now) => placeDraftGoals(now, d.items!.map((g) => ({ ...BLANK_GOAL, ...g })), GOAL_LIMITS.max)); } }} />
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="propose-name" className={`mb-2 block ${LABEL}`}>
                    {t({ message: "Your name", context: "open proposal field" })}
                  </label>
                  <input id="propose-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={FIELD} {...invalid("name")} />
                  <Beside id="propose-problem-name" message={problemOn("name")} />
                </div>
                <div>
                  <label htmlFor="propose-email" className={`mb-2 block ${LABEL}`}>
                    {t({ message: "Your email", context: "open proposal field" })}
                  </label>
                  <input id="propose-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} {...invalid("email")} />
                  <Beside id="propose-problem-email" message={problemOn("email")} />
                </div>
              </div>
              <p className={`-mt-4 ${HINT}`}>{t({ message: "We'll only write to you about this application.", context: "founding application" })}</p>
              <div className="grid gap-3">
                <label htmlFor="propose-why" className={LABEL}>
                  {t`Why you, and why now`}
                </label>
                <p className={HINT} data-starter-hint="">{starterHint}</p>
                <div className="flex flex-wrap gap-2" data-starters="">
                  {starters.map((s) => (
                    <button key={s} type="button" onClick={() => startWith(s)} aria-label={t({ message: `Start with: ${s}`, context: "founding application why starter" })} className="jw-btn inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm text-foreground hover:border-notice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      {s}
                    </button>
                  ))}
                </div>
                <GrowingField id="propose-why" clip="why" required minRows={7} limit={OPEN_WHY_MAX} value={why} onChange={setWhy} className={FIELD} {...invalid("why")} />
                <Beside id="propose-problem-why" message={problemOn("why")} />
              </div>
              </div>
              <div hidden={pane !== 1} data-about-pane="1" className="grid scroll-mt-24 gap-6" data-about-you-section="">
                <AboutYouFacts
                  value={about}
                  onChange={setAbout}
                  idPrefix="propose-about"
                  storyAssist={
                    <>
                      {(!about.story.trim() || isTextDraft(about.story, marks.story)) && <AskSera founding kind="story" roles={askRoles} why={why} aim={aim} onDraft={(r) => { if (r.story) { setAbout((a) => ({ ...a, story: r.story! })); setMarks((m) => ({ ...m, story: r.story })); } }} />}
                      {isTextDraft(about.story, marks.story) && <DraftMark founding onKeep={() => setMarks((m) => ({ ...m, story: undefined }))} />}
                    </>
                  }
                />
                <div>
                  <label htmlFor="propose-self" className={`mb-2 block ${LABEL}`}>
                    {t({ message: "Your Human Design, Gene Keys, or other ways of working we should know about (optional)", context: "founding application about" })}
                  </label>
                  <GrowingField minRows={2} id="propose-self" limit={SELF_KNOWLEDGE_MAX} value={selfKnowledge} onChange={setSelfKnowledge} className={FIELD} {...invalid("selfKnowledge")} />
                  <p className={`mt-2 ${HINT}`}>{t({ message: "For your own profile once you join. The people who decide never see it.", context: "founding application about" })}</p>
                  <Beside id="propose-problem-selfKnowledge" message={problemOn("selfKnowledge")} />
                </div>
                <AttachmentFields
                  links={links}
                  onLinks={setLinks}
                  files={files}
                  onFiles={setFiles}
                  together={{ voiceBytes: attachedBytes([], voice), room: attachmentRoom(form.clips.max) }}
                  invalid={error && (error.field === "links" || error.field === "files") ? { field: error.field, message: error.message } : null}
                />
              </div>
              <div hidden={pane !== 2} data-about-pane="2" className="grid gap-6">
                <ReferencesBlock value={about} onChange={setAbout} idPrefix="propose-about" alwaysChecked={role.alwaysChecked === true} invalid={problems.some((p) => p.field === "checkConsent" || p.field === "references")} />
              </div>
            </section>

            {/* STEP 3: your value. The aim in a line, then the items, each tagged to a season goal. */}
            <section {...panel(2)}>
              {heading(2)}
              <div>
                <label htmlFor="propose-aim" className={`mb-2 block ${LABEL}`}>
                  {t({ message: "Your aim in this role, in a line", context: "founding application value" })}
                </label>
                <GrowingField minRows={2} id="propose-aim" clip="aim" required limit={OPEN_AIM_MAX} value={aim} onChange={setAim} className={FIELD} {...invalid("aim")} />
                <Beside id="propose-problem-aim" message={problemOn("aim")} />
                <div className="mt-2 grid gap-2">
                  {(!aim.trim() || isTextDraft(aim, marks.aim)) && <AskSera founding kind="aim" roles={askRoles} why={why} aim={aim} onDraft={(r) => { if (r.aim) { setAim(r.aim); setMarks((m) => ({ ...m, aim: r.aim })); } }} />}
                  {isTextDraft(aim, marks.aim) && <DraftMark founding onKeep={() => setMarks((m) => ({ ...m, aim: undefined }))} />}
                </div>
              </div>
              <ValueItems
                roleId={role.id}
                items={items}
                onChange={setItems}
                goals={form.goals}
                missingTag={problems.some((p) => p.field === "serves") ? missingTag : []}
                assist={
                  <AskSera
                    founding
                    kind="goals"
                    roles={askRoles}
                    why={why}
                    aim={aim}
                    onDraft={(reply) => setItems((now) => placeDraftGoals(now, goalsFromDraft((reply.goals ?? []).filter((g) => g.roleId === role.id)).map((g) => ({ ...g, moves: "" })), GOAL_LIMITS.max))}
                  />
                }
              />
              <Beside id="propose-problem-card" message={problemOn("card") ?? problemOn("serves")} />
              <Suspense fallback={null}><ShapeTheRole roleId={role.id} value={pieceSuggestions} onChange={setPieceSuggestions} pct={commitment} /></Suspense>
            </section>

            {/* STEP 4: the terms. Commitment and the eight settings, the ramp-up, and the shape of compensation. */}
            <section {...panel(3)}>
              {heading(3)}
              <section aria-label={labels[3]} tabIndex={-1} className="grid scroll-mt-24 gap-4 outline-none" data-terms-section="">
                <TermsEight
                  roles={[role, ...extraRoles.filter((r): r is FormRole => !!r)].map(asTerms)}
                  priced={role.id}
                  value={termsStep}
                  onChange={setTermsStep}
                  problem={problemOn("terms")}
                  idPrefix="propose-terms"
                />
                {/* More roles in this one application, each on its own terms, and the total across them (the lead, 17 Nov 2026). */}
                <Suspense fallback={null}>
                  <MoreRoles offered={form.roles.map(asTerms)} first={asTerms(role)} firstTerms={termsStep} extras={extras} onChange={setExtras} max={OPEN_APPLY_ROLES} problemOf={(i) => problemOn(`roles.${i}`)} />
                </Suspense>
              </section>
              <div className={`${TILE} flex min-h-11 items-start gap-3`} data-ramp-up="">{/* Only the box and its words tick it, never a tap on the tile (1.3.22 check). */}
                <input id="propose-ramp" type="checkbox" className="mt-0.5 size-5 shrink-0 accent-notice" checked={rampUp} onChange={(e) => setRampUp(e.target.checked)} aria-describedby="propose-ramp-hint" />
                <span className="grid gap-1">
                  <label htmlFor="propose-ramp" className="cursor-pointer font-semibold text-foreground">{t({ message: "I would like a ramp-up", context: "founding application terms" })}</label>
                  <span id="propose-ramp-hint" className={HINT}>{t({ message: "For when you want a higher commitment and would like to start lower, so the change goes well for you and the work. For example, half time the first month and full time the second. Rewards follow the steps, and we agree them together.", context: "founding application terms" })}</span>
                </span>
              </div>
              {/* On a desk the rewards stand in the rail beside every step (D-06). */}
              <div className="lg:hidden">
                <CompensationShape setup={setup} splits={ownSplits} />
              </div>
            </section>

            {/* STEP 5: your first day. The first cycle, the first conversations, and when you could begin. */}
            <section {...panel(4)}>
              {heading(4)}
              <FirstDayFacts setup={setup} firstConversation={role.conversations?.[0]?.role ?? null} />
              <div className={`${GOLD_RULE} pt-6`}>
                <Practicalities value={practical} onChange={setPractical} />
              </div>
            </section>

            {/* STEP 6: review & submit. Everything read back, the agreements, then send. */}
            <section {...panel(5)}>
              {heading(5)}
              <ReviewLines review={review} labels={labels} onChange={(i) => goTo(i)} extras={[...reviewExtras(i18n, { termsStep: STONES.indexOf("terms"), valueStep: STONES.indexOf("value"), ceiling: role?.payCeiling, pct: commitment, ask: termsStep.payAsk, notes: pieceSuggestions, split: termsStep.paySplitView ?? null, roles: reviewRoles }), ...voiceReview]} />
              <div data-agreements="" className="scroll-mt-24">
                <SeasonServes goals={form.goals} serves={{}} onServes={() => {}} showGoals={false} agreed={agreed} onAgreed={setAgreed} membership={<MembershipAtApplication signedIn={!!me} choice={membership} onChoice={setMembership} refreshKey={letterRead} />} />
                <Beside id="propose-problem-agreed" message={problemOn("agreed") ?? problemOn("membership")} />
              </div>
              <ReviewPromises />
            </section>

            {/* The honeypot. Named `hp` so no autofill heuristic fills it; see ReserveHome.tsx. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: 0 }}>
              <input type="text" name="hp" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </div>

            {stone < LAST_STONE && <ProblemsList atButton problems={problems} labels={labels} stone={stone} onShow={show} />}
            <StoneBar close={stone < LAST_STONE && problems.length > 0} keyboard={keyboard} stone={stone} last={LAST_STONE} nextName={nextName} sending={sending} onBack={back} onNext={next} />
          </form>
          </VoiceClipsProvider>

          {/* A desk has the width: the role stays beside the step. */}
          <aside aria-label={t({ message: "The role", context: "founding application, the role beside" })} className="hidden lg:sticky lg:top-24 lg:grid lg:gap-4">
            <RoleBeside role={role} pct={pct} open={stone === STONES.indexOf("terms")} />
            {/* The rewards open once, on The terms where the split is set; folded to their heading on every other step (the roles lane, 19 Nov 2026). */}
            <RewardsBeside setup={setup} splits={ownSplits} collapsed={stone !== STONES.indexOf("terms")} />
          </aside>
        </div>
      )}
    </Shell>
  );
}
