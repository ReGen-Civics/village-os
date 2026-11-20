/**
 * HOW THIS APPLICATION CAME IN, for the people who read it (the lead, 20 Nov 2026):
 *
 *   - "Start a conversation" (idea 14): name, email, a link and a few lines on why. It has no terms, so it is never
 *     adopted as it stands; a decider makes a link inviting the person to complete the full proposal, and sends it
 *     in their reply (server/routes/openProposalDecide.ts `full-proposal-link`).
 *   - An early application: a role was coming soon when it was sent, so its card may have changed since.
 *
 * Nothing here judges or ranks anyone.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY } from "@/components/journey/look";

export function WayInNote({ id, conversation, early, mayInvite }: { id: string; conversation: boolean; early: readonly string[]; mayInvite: boolean }) {
  const { t } = useLingui();
  const [url, setUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!conversation && early.length === 0) return null;
  const make = async () => {
    setProblem(null);
    const res = await fetch(`/api/open-proposals/${encodeURIComponent(id)}/full-proposal-link`, { method: "POST", credentials: "include" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && typeof data?.url === "string") setUrl(data.url);
    else setProblem(t({ message: "The link could not be made. Try again in a moment.", context: "open proposal: the way in" }));
  };
  const earlyList = early.join(", ");
  return (
    <div role="note" className="mt-2 grid gap-2 rounded-xl border-2 border-notice/40 bg-card px-4 py-3 text-sm text-foreground" data-way-in={conversation ? "conversation" : "early"}>
      {conversation && (
        <p className="font-medium" data-way-in-conversation="">
          {t({ message: "Started as a conversation: a name, an email, a link and a few lines on why. It has no terms yet, so it can't be adopted as it stands. When you're ready, invite them to complete the full proposal.", context: "open proposal: the way in" })}
        </p>
      )}
      {early.length > 0 && (
        <p className="font-medium" data-way-in-early="">
          {t({ message: `An early application: ${earlyList} was coming soon when they applied, so its card may have changed since.`, context: "open proposal: the way in" })}
        </p>
      )}
      {conversation && mayInvite && !url && (
        <button type="button" onClick={() => void make()} className={`${BTN_SECONDARY} justify-self-start`} data-full-proposal-link="">
          {t({ message: "Make a link to the full proposal", context: "open proposal: the way in" })}
        </button>
      )}
      {url && (
        <p className="grid gap-1" data-full-proposal-url="">
          <span>{t({ message: "Send this link in your reply. It opens the full application for this person.", context: "open proposal: the way in" })}</span>
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground" aria-label={t({ message: "The link to the full proposal", context: "open proposal: the way in" })} />
        </p>
      )}
      {problem && <p role="alert">{problem}</p>}
    </div>
  );
}
