/**
 * "START A CONVERSATION": THE TWO-SPEED WAY IN (the lead, 20 Nov 2026, idea 14). Senior people rarely fill a
 * six-step form cold, so beside "Apply" a person can send their name, email, a link to their work, a few lines on
 * why and the role or roles, in about two minutes.
 *
 * It goes through the same door as the full application (POST /api/open-proposals with `kind: "conversation"`,
 * judged in shared/openProposals.ts): the same caps, the same confirmation email, the same status page and letters,
 * the same privacy and erasure rules. Reviewers read it in the same walkthrough and can make a link inviting the
 * person to complete the full proposal later (server/routes/openProposalDecide.ts `full-proposal-link`). No AI
 * judges it, and nothing here ranks anyone.
 *
 * Loaded only when asked for (`?way=talk`), off /propose-a-role's first view.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import GrowingField from "@/components/form/GrowingField";
import { BTN_PRIMARY, CARD, EYEBROW, FIELD, HINT, LABEL, LINK } from "@/components/journey/look";
import { CONVERSATION_WHY_MAX, OPEN_ANONYMISE_DAYS, OPEN_APPLY_ROLES, OPEN_CONFIRM_HOURS, OPEN_WORDS } from "@shared/openProposals";
import { addressProblem } from "@shared/comms/address";
import { applyWordT, notSentWords } from "./applyWordsT";
import type { SentNote } from "./Thresholds";

export interface TalkRole {
  id: string;
  name: string;
  circle: string;
  held?: boolean;
  futureVenture?: boolean;
  comingSoon?: boolean;
}

export default function StartConversation({
  village,
  roles,
  first,
  link,
  me,
  onSent,
  onFull,
}: {
  village: string;
  roles: ReadonlyArray<TalkRole>;
  /** The role the card's link named, chosen to start. */
  first: string | null;
  link: string;
  me: { name: string; email: string } | null;
  onSent: (sent: SentNote, roleIds: string[]) => void;
  /** Back to the full application. */
  onFull: () => void;
}) {
  const { t, i18n } = useLingui();
  // Every role the form offers, except one fully held or a future venture (its pitch has prompts of its own).
  const offered = roles.filter((r) => !r.held && !r.futureVenture);
  const [picked, setPicked] = useState<string[]>(() => (first && offered.some((r) => r.id === first) ? [first] : []));
  const [name, setName] = useState(me?.name ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [work, setWork] = useState("");
  const [why, setWhy] = useState("");
  const [hp, setHp] = useState("");
  const [problem, setProblem] = useState<{ field: string | null; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  const toggle = (id: string) => setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : now.length < OPEN_APPLY_ROLES ? [...now, id] : now));

  const check = (): { field: string; message: string } | null => {
    if (!name.trim()) return { field: "name", message: OPEN_WORDS.needName };
    if (!email.trim()) return { field: "email", message: OPEN_WORDS.needEmail };
    if (/[,;]/.test(email) || addressProblem(email)) return { field: "email", message: OPEN_WORDS.badEmail };
    if (!why.trim()) return { field: "why", message: OPEN_WORDS.needWhy };
    if (why.trim().length > CONVERSATION_WHY_MAX) return { field: "why", message: t({ message: `Keep it to ${CONVERSATION_WHY_MAX} characters. The full proposal has room for more.`, context: "start a conversation check" }) };
    if (picked.length === 0) return { field: "roles", message: OPEN_WORDS.needRole };
    return null;
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const found = check();
    if (found) {
      setProblem(found);
      document.getElementById(`talk-${found.field}`)?.focus();
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      const body = {
        kind: "conversation",
        name,
        email,
        why,
        hp,
        link: link || undefined,
        roles: picked.map((roleId) => ({ roleId, note: "" })),
        ...(work.trim() ? { links: [{ label: t({ message: "My work", context: "start a conversation: the link's label" }), url: work.trim() }] } : {}),
        locale: i18n.locale,
      };
      const res = await fetch("/api/open-proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const field = typeof data?.field === "string" ? (data.field === "links" ? "work" : data.field) : null;
        setProblem({ field, message: typeof data?.error === "string" ? data.error : notSentWords() });
        return;
      }
      const sentTo = email.trim();
      const kept = data?.kept === true;
      onSent(
        {
          message: kept
            ? t({ message: `We have your application. Our confirmation email didn't go out, so we'll write to you at ${sentTo} soon.`, context: "founding application kept" })
            : t({ message: `Check ${sentTo}. We sent a link to confirm it's you. Your application reaches us once you open it.`, context: "founding application sent" }),
          to: sentTo,
          at: new Date(),
          replyDays: typeof data?.replyDays === "number" ? data.replyDays : null,
          afterFounding: data?.afterFounding === true,
          comingSoon: picked.some((id) => roles.find((r) => r.id === id)?.comingSoon === true),
          ...(kept ? { kept, statusPath: typeof data?.statusPath === "string" && data.statusPath.startsWith("/application-status/") ? data.statusPath : null } : {}),
        },
        picked,
      );
      window.scrollTo?.({ top: 0 });
    } catch {
      setProblem({ field: null, message: notSentWords() });
    } finally {
      setSending(false);
    }
  };

  const on = (field: string) => (problem?.field === field ? { "aria-invalid": true as const, "aria-describedby": "talk-problem" } : {});
  const problemLine = problem && (
    <p id="talk-problem" role="alert" className="border-l-4 border-notice pl-3 text-sm font-medium text-foreground" data-talk-problem={problem.field ?? ""}>
      {applyWordT(problem.message)}
    </p>
  );

  return (
    <section aria-labelledby="talk-h" className={`${CARD} grid gap-6`} data-start-conversation="">
      <div className="grid gap-2">
        <p className={EYEBROW}>{village}</p>
        <h1 id="talk-h" className="font-display text-4xl leading-tight text-card-foreground">
          {t({ message: "Start a conversation", context: "start a conversation" })}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {t({ message: "About two minutes. Tell us who you are and why, and we shape your proposal together later.", context: "start a conversation" })}
        </p>
      </div>
      <form onSubmit={send} noValidate className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="talk-name" className={`mb-2 block ${LABEL}`}>{t({ message: "Your name", context: "open proposal field" })}</label>
            <input id="talk-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={`${FIELD} py-3`} {...on("name")} />
          </div>
          <div>
            <label htmlFor="talk-email" className={`mb-2 block ${LABEL}`}>{t({ message: "Your email", context: "open proposal field" })}</label>
            <input id="talk-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${FIELD} py-3`} {...on("email")} />
          </div>
        </div>
        <div>
          <label htmlFor="talk-work" className={`mb-2 block ${LABEL}`}>{t({ message: "A link to your work (optional)", context: "start a conversation" })}</label>
          <input id="talk-work" type="url" inputMode="url" placeholder={t({ message: "https://", context: "start a conversation: the link placeholder" })} value={work} onChange={(e) => setWork(e.target.value)} className={`${FIELD} py-3`} {...on("work")} />
        </div>
        <div>
          <label htmlFor="talk-why" className={`mb-2 block ${LABEL}`}>{t({ message: "Why you, and why this role, in a few lines", context: "start a conversation" })}</label>
          <GrowingField id="talk-why" minRows={3} limit={CONVERSATION_WHY_MAX} value={why} onChange={setWhy} className={`${FIELD} py-3`} {...on("why")} />
        </div>
        <fieldset className="grid gap-2" {...(problem?.field === "roles" ? { "aria-describedby": "talk-problem" } : {})}>
          <legend id="talk-roles" tabIndex={-1} className={`mb-1 ${LABEL}`}>
            {t({ message: `The role you have in mind (up to ${OPEN_APPLY_ROLES})`, context: "start a conversation" })}
          </legend>
          {offered.map((r) => (
            <label key={r.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-2">
              <input type="checkbox" className="size-5 shrink-0 accent-notice" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} data-talk-role={r.id} />
              <span className="min-w-0 break-words text-foreground">
                {r.name} <span className="text-sm text-muted-foreground">{r.circle}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {/* The honeypot, as the full form has it. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <input type="text" name="hp" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </div>
        {problemLine}
        <div className="grid gap-1 text-sm text-muted-foreground" data-talk-kept="">
          <p>{t({ message: `If you don't confirm within ${OPEN_CONFIRM_HOURS} hours, we delete what you sent. If we say no, or say yes and you never make your account, we remove your name and email ${OPEN_ANONYMISE_DAYS} days later.`, context: "founding application review" })}</p>
          <p>{t`An AI may help draft our replies to you; a person always reads and sends them, and no AI takes part in choosing.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={sending} className={`${BTN_PRIMARY} py-3`} data-talk-send="">
            {sending ? t({ message: "Sending", context: "start a conversation" }) : t({ message: "Send", context: "start a conversation: the button" })}
          </button>
          <button type="button" onClick={onFull} className={`${LINK} inline-flex min-h-11 items-center text-sm`} data-talk-full="">
            {t({ message: "Fill in the full application instead", context: "start a conversation" })}
          </button>
        </div>
        <p className={HINT}>{t({ message: "We send a link to confirm your email. Nothing reaches us until you open it.", context: "start a conversation" })}</p>
      </form>
    </section>
  );
}
