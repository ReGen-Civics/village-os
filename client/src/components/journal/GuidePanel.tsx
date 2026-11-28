/**
 * The guide: a conversation beside the page, a sheet from the bottom on a
 * phone and a panel on the right on a desk.
 *
 * It reflects back and never speaks for the member. A follow-up question it
 * offers becomes a question in the sitting only when tapped, and its
 * distilled reflection is kept only when the member says "yes, that is it",
 * or after they have corrected it in their own words.
 *
 * When the server has no model to ask, it answers 503 and the panel says so
 * in one calm line. Nothing about saving depends on it.
 */
import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import {
  GUIDE_MAX_MESSAGES,
  JOURNAL_REFLECTION_MAX,
  type GuideMessage,
  type GuideReply,
  type GuideRequest,
} from "@shared/journal";
import { askGuide, isAssistantUnavailable, problemText } from "@/lib/journalApi";
import GrowingTextarea from "./GrowingTextarea";
import ChatComposer from "@/components/chat/ChatComposer";
import { useChatDraft } from "@/components/chat/chatDraft";
import GuideTasks from "./GuideTasks";
import MyGuide, { useGuideState } from "@/components/guide/MyGuide";
import { JOURNAL_ON_SERA, journalGuide, type GuideState } from "@shared/guideChoice";
import { saveGuide } from "@/lib/guideApi";
import { useLingui, Trans } from "@lingui/react/macro";
import { guideLabelIn } from "@/lib/guideNameWords";
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, HINT } from "./ui";

export const GUIDE_RESTING = "The guide is resting. Your journal works without it.";

/**
 * The most messages one ask may carry, from the contract. The server refuses a
 * conversation longer than its MAX_TURNS outright, so the 21st ask of a long
 * sitting used to fail, and every ask after it, reloads included.
 * server/routes/journal.guide.test.ts holds the contract's number to MAX_TURNS.
 */
export { GUIDE_MAX_MESSAGES };

/**
 * What one ask sends: the newest messages that fit, starting on one of the
 * member's own turns and ending on the one just typed. Only the request is
 * trimmed; the whole conversation stays on the page and in the sitting. Every
 * ask carries the sitting's answers as well, so the oldest turns are what the
 * guide can best do without.
 */
export function guideWindow(messages: GuideMessage[], turn: GuideMessage): GuideMessage[] {
  let tail = [...messages, turn].slice(-GUIDE_MAX_MESSAGES);
  while (tail.length > 1 && tail[0]!.role !== "user") tail = tail.slice(1);
  return tail;
}

export default function GuidePanel({
  open,
  onClose,
  request,
  messages,
  onMessages,
  onAddQuestion,
  onConfirmReflection,
}: {
  open: boolean;
  onClose: () => void;
  /** Everything the guide needs except the conversation, read at send time. */
  request: () => Omit<GuideRequest, "messages">;
  messages: GuideMessage[];
  onMessages: (next: GuideMessage[]) => void;
  onAddQuestion: (prompt: string) => void;
  onConfirmReflection: (text: string) => void;
}) {
  const { t } = useLingui();
  // Kept in this tab (components/chat/chatDraft.ts): closing the guide halfway through a thought keeps it.
  const [draft, setDraft] = useChatDraft("journal-guide");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [latest, setLatest] = useState<GuideReply | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [kept, setKept] = useState(false);
  const inputId = "journal-guide-input";
  // Who answers: the member's own choice, the village guide or Sera (shared/guideChoice.ts).
  const [guideState, setGuideState] = useGuideState();
  const panelRef = useRef<HTMLDivElement>(null);

  // Opening puts the cursor in the box; Escape closes.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => document.getElementById(inputId)?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const ask = async (text: string) => {
    const said = text.trim();
    if (!said || busy) return;
    const turn: GuideMessage = { role: "user", content: said };
    setBusy(true);
    setProblem(null);
    try {
      const reply = await askGuide({ ...request(), messages: guideWindow(messages, turn) });
      onMessages([...messages, turn, { role: "assistant", content: reply.reply }]);
      setLatest(reply);
      setEditing(null);
      setKept(false);
      setDraft("");
    } catch (err) {
      // The typed words stay in the box, so nothing is lost by asking.
      setProblem(
        isAssistantUnavailable(err)
          ? GUIDE_RESTING
          : problemText(err, "The guide could not answer just now. Your journal works without it."),
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = (text: string) => {
    const clean = text.trim().slice(0, JOURNAL_REFLECTION_MAX);
    if (!clean) return;
    onConfirmReflection(clean);
    setEditing(null);
    setKept(true);
  };

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[69] bg-black/30 md:hidden" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t({ message: "The guide", context: "GuidePanel, aria-label" })}
        data-scroll-contain
        // It holds the bottom-right corner on every width, so the shortcuts
        // button steps out (index.css) instead of sitting reachable under it.
        data-hides-fab
        className="fixed inset-x-0 bottom-[var(--kb,0px)] z-[70] flex max-h-[min(85vh,calc(var(--vvh,100vh)-1rem))] flex-col rounded-t-2xl border-t border-border bg-card text-card-foreground shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:border-l md:border-t-0"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 className="font-display text-lg font-bold text-foreground"><Trans context="GuidePanel, h2">The guide</Trans></h2>
          <button type="button" onClick={onClose} className={BTN_QUIET} aria-label={t({ message: "Close the guide", context: "GuidePanel, aria-label" })}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
          <MyGuide state={guideState ? journalGuide(guideState) : null} onChange={setGuideState} />
          {guideState && !journalGuide(guideState).answering && journalGuide(guideState).note && (
            <p role="status" className={HINT}>{journalGuide(guideState).note}</p>
          )}
          {JOURNAL_ON_SERA && guideState && !journalGuide(guideState).answering && journalGuide(guideState).note && (
            <JournalChooseSera
              note={journalGuide(guideState).note!}
              name={guideState.options.find((o) => o.id === "saberra")?.name ?? ""}
              onChosen={setGuideState}
            />
          )}
          {messages.length === 0 && (
            <p className={HINT}>
              <Trans context="GuidePanel, p">Ask anything about what you have written, or let the guide reflect it back to you. It asks; it never
              answers for you.
            </Trans></p>
          )}
          {messages.map((m, i) => (
            <p
              key={i}
              className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                m.role === "user" ? "ml-8 bg-teal-deep/10 text-foreground" : "mr-8 bg-muted text-foreground"
              }`}
            >
              <span className="sr-only">{m.role === "user" ? "You said: " : "The guide said: "}</span>
              {m.content}
            </p>
          ))}

          {latest?.nextQuestion && (
            <button
              type="button"
              className="block min-h-11 w-full rounded-xl border border-teal-deep/50 bg-card px-3 py-2 text-left text-sm font-medium text-teal-deep hover:bg-teal-deep/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-deep"
              onClick={() => {
                onAddQuestion(latest.nextQuestion);
                setLatest({ ...latest, nextQuestion: "" });
              }}
            >
              <Trans context="GuidePanel, button">Add this question to my page: {latest.nextQuestion}</Trans>
            </button>
          )}

          {latest?.reflection && !kept && (
            <div className="rounded-xl border border-sage/40 bg-sage-light/40 p-3">
              <p className="text-xs font-semibold text-sage"><Trans context="GuidePanel, p">What I heard</Trans></p>
              {editing === null ? (
                <>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{latest.reflection}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground"><Trans context="GuidePanel, p">Did I get that right?</Trans></p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={BTN_PRIMARY} onClick={() => confirm(latest.reflection)}>
                      <Trans context="GuidePanel, button">Yes
                    </Trans></button>
                    <button type="button" className={BTN_SECONDARY} onClick={() => setEditing(latest.reflection)}>
                      <Trans context="GuidePanel, button">Not quite
                    </Trans></button>
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor="journal-guide-reflection" className="mt-1 block text-sm text-foreground">
                    <Trans context="GuidePanel, label">Say it your way
                  </Trans></label>
                  <div className="mt-1">
                    <GrowingTextarea
                      id="journal-guide-reflection"
                      value={editing}
                      onValue={setEditing}
                      minRows={3}
                      maxLength={JOURNAL_REFLECTION_MAX}
                    />
                  </div>
                  <button type="button" className={`${BTN_PRIMARY} mt-2`} onClick={() => confirm(editing)} disabled={!editing.trim()}>
                    <Trans context="GuidePanel, button">Keep this version
                  </Trans></button>
                </>
              )}
            </div>
          )}
          {latest && ((latest.suggestedTasks?.length ?? 0) > 0 || (latest.doneTasks?.length ?? 0) > 0) && (
            <GuideTasks
              key={messages.length}
              suggested={latest.suggestedTasks ?? []}
              done={latest.doneTasks ?? []}
              guideName={guideLabelIn(latest.guide?.name ?? guideState?.options.find((o) => o.id === guideState.answering)?.name ?? "The guide")}
            />
          )}
          {kept && <p role="status" className="text-sm text-open"><Trans context="GuidePanel, p">Kept as your reflection. You can change it when you read the page back.</Trans></p>}

          {problem && (
            <p role="status" className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
              {problem}
            </p>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <ChatComposer
            id={inputId}
            within={panelRef}
            value={draft}
            onChange={setDraft}
            onSend={() => void ask(draft)}
            busy={busy}
            maxLength={2000}
            label={<Trans context="GuidePanel, label">Your message to the guide</Trans>}
            sendLabel="Ask"
            sendText={
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                {busy ? "Asking..." : "Ask"}
              </>
            }
            sendClassName={`${BTN_PRIMARY} shrink-0`}
            // A journal is written in paragraphs: Enter starts a new line everywhere, and Ask (or Ctrl+Enter) sends.
            enterSends={false}
            minRows={2}
          />
          {messages.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={busy}
                onClick={() => void ask("Reflect back what I have written so far.")}
              >
                <Trans context="GuidePanel, button">Reflect this back to me
              </Trans></button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Only the outside agent can answer here, and the member has not chosen it: one tap chooses it, saved like the picker saves. */
function JournalChooseSera({ note, name, onChosen }: { note: string; name: string; onChosen: (s: GuideState) => void }) {
  const { t } = useLingui();
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
      <p className="text-foreground">{note}</p>
      <button
        type="button"
        disabled={busy}
        className={`${BTN_SECONDARY} mt-2`}
        onClick={async () => {
          setBusy(true);
          const next = await saveGuide("saberra");
          setBusy(false);
          if (next) onChosen(next);
        }}
      >
        {t({ message: `Talk to ${name} in my journal`, context: "journal guide: choose the outside agent here" })}
      </button>
    </div>
  );
}
