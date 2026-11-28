/**
 * THE ADMIN HELPER PANEL: the village's guide, docked beside Admin.
 *
 * Opened from the "you" menu in the header's corner, or with Ctrl+/ (Cmd+/ on
 * a Mac); AdminHelperHost owns that and lazy-loads this file, so the panel
 * costs the first page nothing. It docks on the right UNDER the sticky header
 * (the host hands it the header's bottom edge as `top`), so it never covers
 * the page name or the corner menu.
 *
 * Three states, and the component test walks each one:
 *   off        the village switched the helper off (the dial
 *              `platform.admin_helper`, on by default), or has no key of its
 *              own yet: plain steps for whichever is missing.
 *   ready      a conversation. The guide answers, and may offer a page to open.
 *   proposing  the guide's answer carries ONE change, drawn as a card with the
 *              setting, what it is now and what it would become. Review and
 *              save puts it on the page's one save bar (AdminHelperHost holds
 *              it, so closing the panel keeps it); only a person's Save there
 *              writes it, through the dial's own admin route, the same gate as
 *              a hand edit. Take me there opens the dial's own place; Not now
 *              drops the card.
 *
 * Paints with the sheet tokens only (bg-card, text-foreground, border-border,
 * bg-muted, bg-primary), so it follows the Admin palette and its night look.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { HelperAnswer, HelperProposal, HelperProvider, HelperStatus } from "@shared/adminHelper";
import { guideNameAtSentenceStart, UNNAMED_GUIDE } from "@shared/guideName";
import { guideLabelIn } from "@/lib/guideNameWords";
import ChatComposer from "@/components/chat/ChatComposer";
import { useChatDraft } from "@/components/chat/chatDraft";
import type { NavGroup } from "./adminNavGroups";
import { askHelper, fetchHelperStatus, tabsFromGroups, type HelperLine } from "./adminHelperApi";
// The pieces the dock shares (dock/GuideDock.tsx grew from this panel): moved out whole, words and classes unchanged.
import { ConnectSteps, OpenLabel, ProposalCard, proposalMarkOf as mark, readPicked, rememberPicked, SwitchedOff } from "./helperPieces";

export { ConnectSteps, proposalHref } from "./helperPieces";

type Turn = HelperLine & { answer?: HelperAnswer; applied?: "dropped" };

export default function AdminHelperPanel({
  password,
  groups,
  tab,
  top,
  bottom = 0,
  onClose,
  onOpenTab,
  initialStatus,
  waiting = [],
  saved = [],
  onReview,
  onUnreview,
  onStatus,
}: {
  password: string;
  groups: readonly NavGroup[];
  /** The open admin tab, so the guide knows where the admin is. */
  tab: string;
  /** The header's bottom edge, in pixels: the panel starts below it. */
  top: number;
  /** The phone's bottom bar height, in pixels: the panel stops above it. */
  bottom?: number;
  onClose: () => void;
  onOpenTab: (key: string) => void;
  /** For tests and previews: skip the status fetch. */
  initialStatus?: HelperStatus;
  /** Proposals waiting on the save bar, and the ones saved, by key and value (AdminHelperHost). */
  waiting?: readonly string[];
  saved?: readonly string[];
  /** Put a proposal on the page's one save bar, or take it off. The guide never writes it itself. */
  onReview?: (p: HelperProposal) => void;
  onUnreview?: (p: HelperProposal) => void;
  /** Told the status this panel read, so its host learns whether the village turned the guide's dock on. */
  onStatus?: (s: HelperStatus) => void;
}) {
  const { t, i18n } = useLingui();
  const [status, setStatus] = useState<HelperStatus | null>(initialStatus ?? null);
  const [statusError, setStatusError] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  // Kept in this tab, so closing the helper and opening it again keeps a half-written question.
  const [draft, setDraft] = useChatDraft("admin-helper");
  const panel = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialStatus) return;
    const ctrl = new AbortController();
    fetchHelperStatus(password, ctrl.signal)
      .then((s) => {
        setStatus(s);
        onStatus?.(s);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setStatusError(String(e?.message ?? e));
      });
    return () => ctrl.abort();
  }, [password, initialStatus]);

  useEffect(() => {
    if (status?.on) input.current?.focus();
  }, [status?.on]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns, busy]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  // When both Claude and Sera can answer, the admin picks; the pick is remembered on this device.
  const [picked, setPicked] = useState<HelperProvider | null>(() => readPicked());
  const chosen: HelperProvider | null =
    status && picked && status.available.includes(picked) ? picked : status?.provider ?? null;
  const pick = (p: HelperProvider) => {
    setPicked(p);
    rememberPicked(p);
  };
  // The server says an unnamed guide in English; guideLabelIn says it in the reader's language, and leaves a
  // village's own name exactly as typed.
  const guide = guideNameAtSentenceStart(
    guideLabelIn((chosen && status?.names?.[chosen]) || status?.guide || UNNAMED_GUIDE.own, i18n),
  );

  const send = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const words = draft.trim();
      if (!words || busy) return;
      const next: Turn[] = [...turns, { role: "user", content: words }];
      setTurns(next);
      setDraft("");
      setError("");
      setBusy(true);
      const out = await askHelper(password, {
        messages: next.map(({ role, content }) => ({ role, content })),
        tabs: tabsFromGroups(groups),
        tab,
        provider: chosen,
      });
      setBusy(false);
      if (!out.ok) {
        if (out.off) setStatus((s) => ({ guide: s?.guide ?? "", on: false, off: out.off, provider: null, available: [], names: {} }));
        else setError(out.error);
        return;
      }
      setTurns([...next, { role: "assistant", content: out.answer.reply, answer: out.answer }]);
    },
    [draft, busy, turns, password, groups, tab, chosen],
  );


  const drop = (index: number) => setTurns((all) => all.map((turn, i) => (i === index ? { ...turn, applied: "dropped" } : turn)));

  return (
    <aside
      ref={panel}
      aria-label={t({ message: `${guide}, your Admin helper`, context: "admin helper panel" })}
      data-testid="admin-helper"
      // Above a phone's keyboard too (QA round 2 on #1885): --kb is set while a chat box is open (chat/keyboardInset.ts).
      style={{ top, bottom: `max(${bottom}px, var(--kb, 0px))` }}
      className="fixed right-0 z-20 flex w-full flex-col border-l border-border bg-card text-card-foreground shadow-lg sm:w-[26rem]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg font-semibold text-foreground">{guide}</h2>
          <p className="text-xs text-muted-foreground"><Trans context="admin helper panel">Helps you find things and proposes changes for you to approve.</Trans></p>
          {chosen && <ProviderLine provider={chosen} />}
          {status && status.on && status.available.length > 1 && (
            <ProviderPicker available={status.available} names={status.names} chosen={chosen} onPick={pick} />
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t({ message: "Close the helper", context: "admin helper panel" })}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {!status && !statusError && (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <Trans context="admin helper panel">Opening the helper</Trans>
        </div>
      )}
      {statusError && <p role="alert" className="p-4 text-sm text-destructive">{statusError}</p>}

      {status && !status.on && (status.off === "switch" ? <SwitchedOff /> : <ConnectSteps onOpenIntegrations={() => onOpenTab("integrations")} />)}

      {status?.on && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {turns.length === 0 && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><Trans context="admin helper panel">Ask me how to do something in Admin, where a setting lives, or what a control does. If you want something changed, I will show you the change first and you decide.</Trans></p>
                <p><Trans context="admin helper panel">I read settings, help text and the shape of the org chart. I never read applications, proposals, interviews, terms or pay, and I can't help with choosing people for roles. Money stays with you too.</Trans></p>
              </div>
            )}
            {turns.map((turn, i) => (
              <div key={i} className={turn.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    turn.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-full whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-sm text-foreground"
                  }
                >
                  {turn.content}
                </div>
                {turn.answer?.open && (
                  <button
                    type="button"
                    onClick={() => onOpenTab(turn.answer!.open!.key)}
                    className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <OpenLabel label={turn.answer.open.label} />
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                {turn.answer?.refused && (
                  <p className="mt-2 text-xs text-muted-foreground">{turn.answer.refused}</p>
                )}
                {turn.answer?.proposal && (
                  <ProposalCard
                    proposal={turn.answer.proposal}
                    state={
                      turn.applied === "dropped"
                        ? "dropped"
                        : waiting.includes(mark(turn.answer.proposal))
                          ? "waiting"
                          : saved.includes(mark(turn.answer.proposal))
                            ? "saved"
                            : null
                    }
                    onReview={() => onReview?.(turn.answer!.proposal!)}
                    onUnreview={() => onUnreview?.(turn.answer!.proposal!)}
                    onDrop={() => drop(i)}
                  />
                )}
              </div>
            ))}
            {busy && (
              <p className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                <Trans context="admin helper panel">{guide} is thinking</Trans>
              </p>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div ref={end} />
          </div>
          <ChatComposer
            id="admin-helper-input"
            className="border-t border-border p-3"
            inputRef={input}
            within={panel}
            value={draft}
            onChange={setDraft}
            onSend={() => void send()}
            busy={busy}
            label={<Trans context="admin helper panel">Your question</Trans>}
            placeholder={t({ message: "How do I…", context: "admin helper, question box placeholder" })}
            sendLabel={t({ message: "Send", context: "admin helper, sends the question" })}
            sendClassName="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </>
      )}
    </aside>
  );
}

/** Claude or Sera, when both are connected. Switching mid-conversation is fine: the next answer comes from the pick. */
function ProviderPicker({
  available,
  names,
  chosen,
  onPick,
}: {
  available: HelperProvider[];
  names: Partial<Record<HelperProvider, string>>;
  chosen: HelperProvider | null;
  onPick: (p: HelperProvider) => void;
}) {
  const { t } = useLingui();
  const label = (p: HelperProvider) =>
    p === "sera" ? names.sera || "Sera" : t({ message: "Claude", context: "admin helper, the Anthropic provider's name" });
  return (
    <div role="radiogroup" aria-label={t({ message: "Who answers", context: "admin helper, provider choice" })} className="mt-2 inline-flex rounded-full border border-border p-0.5">
      {available.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={chosen === p}
          onClick={() => onPick(p)}
          className={`min-h-9 rounded-full px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chosen === p ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
        >
          {label(p)}
        </button>
      ))}
    </div>
  );
}

/** Who answers, said once under the heading, so an admin knows where their words go. */
function ProviderLine({ provider }: { provider: "anthropic" | "sera" }) {
  return (
    <p className="text-xs text-muted-foreground">
      {provider === "sera"
        ? <Trans context="admin helper panel, who answers">Answers come from Sera, through your village's org memory connection.</Trans>
        : <Trans context="admin helper panel, who answers">Answers come from Claude, on your village's own Anthropic key.</Trans>}
    </p>
  );
}
