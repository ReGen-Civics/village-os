/**
 * THE DOCK'S FIXED LINES, IN BOTH FORMS (the founder, 28 Nov 2026: "Go with
 * warm and plain with the brief and quiet toggle").
 *
 * Every line the dock itself says is here, each as a PAIR: warm and plain
 * first, brief and quiet second, the same facts in the fewest words. `say`
 * picks by the person's speaking dial. Each form is its own message with its
 * own translation. A reply the model writes is not here: its voice is told to
 * the model (server/lib/guideSpeaking.ts).
 *
 * WHOSE VOICE (the copy style key's four voices, as the voice sheet applies
 * them to the garden):
 *   - The GUIDE speaks only where she can answer back: her greeting, the line
 *     after it, what she reads, and the words on what she prepared ("A change
 *     I prepared"). Warm and plain, one to three sentences. She says what she
 *     did and what she left, and never claims an act a person has to press.
 *   - An alert is never hers. A load that failed, a send that failed, a day's
 *     answers used up: one plain sentence that names the fix.
 *   - Names (the conversations, the two answerers, "You said") have one form.
 *     So do the suggestions: they are the person's own words on their way to
 *     the box, and a shorter question would be a different question.
 *
 * WHAT SHE SAYS SHE READS is one line here (`reads`), true to the code as it
 * stands (the helper's two readers and its refusals, server/routes/
 * adminHelper.ts). When what she may read changes, it changes here, once.
 *
 * The off states (no key yet, switched off) are the helper panel's own steps
 * (../helperPieces.tsx) and are not rewritten here: they are setup steps for
 * the person doing the setup.
 */
import { useLingui } from "@lingui/react/macro";
import type { HelperProvider } from "@shared/adminHelper";
import { useNumberWord, type DayPart } from "../garden/speaking";

export interface DockWords {
  quiet: boolean;
  /** The one toggle a person is shown for the speaking dial. One form: it is the control's name. */
  briefToggle: string;
  opening: string;
  /** Under her name, where the dock is wide: what this conversation is for. */
  about: (mode: "helper" | "launch" | "organize") => string;
  whoAnswers: (provider: HelperProvider, name: string, lent: boolean) => string;
  /** Her greeting: the part of the day and the person's first name. */
  greeting: (dayPart: DayPart, firstName: string) => string;
  /** After the greeting, in Admin: what is ready for a yes, or what she can do. */
  helperLead: (ready: number) => string;
  /** What she reads and never reads. */
  reads: string;
  /** After the greeting, on the road to launch: what blocks. Null when the page has not said. */
  launchLead: (blocking: number | null) => string;
  organizeLead: string;
  thinking: (guide: string) => string;
  /** Alerts, never hers. */
  spent: string;
  notSent: string;
  gone: string;
  /** The list of what she prepared. */
  readyHeading: string;
  readyNote: string;
  readyNone: string;
  /** Under a reply, in the wide view: where what she prepared is. */
  pointer: string;
  card: {
    eyebrow: string;
    now: string;
    becomes: string;
    blank: string;
    review: string;
    notNow: string;
    open: string;
    waiting: string;
    setAside: string;
    saved: string;
    left: string;
  };
  draft: {
    eyebrow: string;
    note: string;
    send: string;
    sent: (code: string) => string;
    already: (code: string) => string;
    held: string;
    openReview: string;
  };
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function useDockWords(quiet: boolean): DockWords {
  const { t } = useLingui();
  const word = useNumberWord();
  /** Warm and plain, or brief and quiet: the pair is written together and the dial picks. */
  const say = (full: string, brief: string) => (quiet ? brief : full);

  return {
    quiet,
    briefToggle: t({ message: "Brief and quiet", context: "guide dock, the toggle for the speaking dial's quiet setting" }),
    opening: say(t({ message: "Opening the guide", context: "guide dock, loading" }), t({ message: "Opening", context: "guide dock, loading, brief" })),

    about: (mode) =>
      mode === "helper"
        ? say(
            t({ message: "Finds a page or a setting, and prepares changes for your yes.", context: "guide dock, what the helper conversation is for" }),
            t({ message: "Finds things. Prepares changes.", context: "guide dock, what the helper conversation is for, brief" }),
          )
        : mode === "launch"
          ? say(
              t({ message: "Shows what is left before the launch, one step at a time.", context: "guide dock, what the launch conversation is for" }),
              t({ message: "What is left before launch.", context: "guide dock, what the launch conversation is for, brief" }),
            )
          : say(
              t({ message: "Answers on organizing, from your village's own brief first.", context: "guide dock, what the organizing conversation is for" }),
              t({ message: "Organizing, from your brief.", context: "guide dock, what the organizing conversation is for, brief" }),
            ),

    whoAnswers: (provider, name, lent) =>
      provider === "sera"
        ? say(
            t({ message: `${name} is answering, through your village's org memory connection.`, context: "guide dock, who answers" }),
            t({ message: `${name}, through org memory.`, context: "guide dock, who answers, brief" }),
          )
        : lent
          ? say(
              t({ message: `${name} is answering, on Claude with a key the platform lends for now.`, context: "guide dock, who answers" }),
              t({ message: `${name}, on a lent key.`, context: "guide dock, who answers, brief" }),
            )
          : say(
              t({ message: `${name} is answering, on Claude with your village's own Anthropic key.`, context: "guide dock, who answers" }),
              t({ message: `${name}, on your own key.`, context: "guide dock, who answers, brief" }),
            ),

    greeting: (dayPart, firstName) =>
      firstName
        ? say(
            dayPart === "morning"
              ? t({ message: `Morning, ${firstName}.`, context: "guide dock, her greeting" })
              : dayPart === "afternoon"
                ? t({ message: `Afternoon, ${firstName}.`, context: "guide dock, her greeting" })
                : t({ message: `Evening, ${firstName}.`, context: "guide dock, her greeting" }),
            t({ message: `Hi ${firstName}.`, context: "guide dock, her greeting, brief" }),
          )
        : say(
            dayPart === "morning"
              ? t({ message: "Morning.", context: "guide dock, her greeting to someone whose name the page does not have" })
              : dayPart === "afternoon"
                ? t({ message: "Afternoon.", context: "guide dock, her greeting to someone whose name the page does not have" })
                : t({ message: "Evening.", context: "guide dock, her greeting to someone whose name the page does not have" }),
            t({ message: "Hi.", context: "guide dock, her greeting to someone whose name the page does not have, brief" }),
          ),

    // She leads with what waits. She prepared it; saving it is the person's press, and she says so.
    helperLead: (ready) => {
      if (ready <= 0) {
        return say(
          t({ message: "Nothing is waiting on you here. Ask me where something lives, or name a change and I will prepare it for your yes.", context: "guide dock, after her greeting, nothing is ready" }),
          t({ message: "Nothing waiting. Ask, or name a change.", context: "guide dock, after her greeting, nothing is ready, brief" }),
        );
      }
      if (ready === 1) {
        return say(
          t({ message: "One change is ready for your yes. It waits at the bottom of the page, and nothing is saved until you press Save.", context: "guide dock, after her greeting, one change is ready" }),
          t({ message: "1 to approve.", context: "guide dock, after her greeting, one change is ready, brief" }),
        );
      }
      // The count opens the sentence, so its word takes a capital.
      const count = capital(word(ready));
      return say(
        t({ message: `${count} changes are ready for your yes. They wait at the bottom of the page, and nothing is saved until you press Save.`, context: "guide dock, after her greeting, several changes are ready" }),
        t({ message: `${ready} to approve.`, context: "guide dock, after her greeting, several changes are ready, brief" }),
      );
    },

    reads: say(
      t({
        message: "I read settings, help text and the shape of the org chart. I never read applications, proposals, interviews, terms or pay, and I take no part in choosing people for roles. Money stays in your hands.",
        context: "guide dock, what she reads and never reads",
      }),
      t({
        message: "I read settings, help text and the org chart's shape. Never applications, proposals, interviews, terms or pay. No part in choosing people. Money is yours.",
        context: "guide dock, what she reads and never reads, brief",
      }),
    ),

    launchLead: (blocking) => {
      if (blocking === null) {
        return say(
          t({ message: "Ask me what blocks the launch, or about any step that is left.", context: "guide dock, after her greeting on the road to launch, the count is not known" }),
          t({ message: "Ask what blocks the launch.", context: "guide dock, after her greeting on the road to launch, the count is not known, brief" }),
        );
      }
      if (blocking <= 0) {
        return say(
          t({ message: "Nothing blocks the launch. Ask me about any step that is left.", context: "guide dock, after her greeting on the road to launch, nothing blocks" }),
          t({ message: "Nothing blocks the launch.", context: "guide dock, after her greeting on the road to launch, nothing blocks, brief" }),
        );
      }
      if (blocking === 1) {
        return say(
          t({ message: "One thing blocks the launch. Shall we take it now?", context: "guide dock, after her greeting on the road to launch, one thing blocks" }),
          t({ message: "1 blocks the launch. Start?", context: "guide dock, after her greeting on the road to launch, one thing blocks, brief" }),
        );
      }
      const count = capital(word(blocking));
      return say(
        t({ message: `${count} things block the launch. Shall we take the first one?`, context: "guide dock, after her greeting on the road to launch, several things block" }),
        t({ message: `${blocking} block the launch. Start?`, context: "guide dock, after her greeting on the road to launch, several things block, brief" }),
      );
    },

    organizeLead: say(
      t({
        message: "Ask me about organizing: how you decide, a disagreement, new members, the legal shell. I read your village's brief first, then its own calls, and both come before the books.",
        context: "guide dock, after her greeting in the organizing conversation",
      }),
      t({ message: "Ask about organizing. I read your brief, then your calls, then the books.", context: "guide dock, after her greeting in the organizing conversation, brief" }),
    ),

    thinking: (guide) => say(t({ message: `${guide} is thinking`, context: "guide dock, a reply is on its way" }), t({ message: "Thinking", context: "guide dock, a reply is on its way, brief" })),

    // Alerts: what happened, then the fix. Never in her voice.
    spent: say(
      t({ message: "The guide has answered all it can for today. It starts again tomorrow.", context: "guide dock, the day's answers are used up" }),
      t({ message: "No answers left today. Back tomorrow.", context: "guide dock, the day's answers are used up, brief" }),
    ),
    notSent: say(t({ message: "That did not send. Try again.", context: "guide dock, a question did not send" }), t({ message: "Not sent. Retry.", context: "guide dock, a question did not send, brief" })),
    gone: say(
      t({ message: "The guide cannot answer right now. Add a key under Integrations, or try again tomorrow.", context: "guide dock, the guide cannot answer" }),
      t({ message: "Guide unavailable. Add a key, or try tomorrow.", context: "guide dock, the guide cannot answer, brief" }),
    ),

    readyHeading: say(t({ message: "Ready for your yes", context: "guide dock, the list of what the guide prepared" }), t({ message: "To approve", context: "guide dock, the list of what the guide prepared, brief" })),
    readyNote: say(
      t({ message: "Each change waits here until you say yes. Nothing is saved before that.", context: "guide dock, under the list of what the guide prepared" }),
      t({ message: "Nothing is saved until you approve.", context: "guide dock, under the list of what the guide prepared, brief" }),
    ),
    readyNone: say(t({ message: "Nothing waits for your yes.", context: "guide dock, the list of what the guide prepared is empty" }), t({ message: "All clear.", context: "guide dock, the list of what the guide prepared is empty, brief" })),
    pointer: say(
      t({ message: "I prepared this. It waits under Ready for your yes.", context: "guide dock, under a reply: where what she prepared is" }),
      t({ message: "Under To approve.", context: "guide dock, under a reply: where what she prepared is, brief" }),
    ),

    card: {
      eyebrow: say(t({ message: "A change I prepared", context: "guide dock, a prepared change" }), t({ message: "Change", context: "guide dock, a prepared change, brief" })),
      now: t({ message: "Now", context: "guide dock, a prepared change: the value today" }),
      becomes: t({ message: "Becomes", context: "guide dock, a prepared change: the value it would have" }),
      blank: t({ message: "(blank)", context: "guide dock, a prepared change: an empty value" }),
      review: say(t({ message: "Review and save", context: "guide dock, a prepared change: puts it ready to save" }), t({ message: "Save", context: "guide dock, a prepared change: puts it ready to save, brief" })),
      notNow: say(t({ message: "Not now", context: "guide dock, a prepared change: declines it" }), t({ message: "Skip", context: "guide dock, a prepared change: declines it, brief" })),
      open: say(t({ message: "Take me there", context: "guide dock, a prepared change: opens the setting's own place" }), t({ message: "Open", context: "guide dock, a prepared change: opens the setting's own place, brief" })),
      waiting: say(
        t({ message: "Waiting for your Save at the bottom of the page. Nothing is saved until you press it.", context: "guide dock, a prepared change waits to be saved" }),
        t({ message: "Waiting for Save.", context: "guide dock, a prepared change waits to be saved, brief" }),
      ),
      setAside: say(t({ message: "Set it aside", context: "guide dock, a prepared change: takes it back from waiting to be saved" }), t({ message: "Remove", context: "guide dock, a prepared change: takes it back from waiting to be saved, brief" })),
      saved: t({ message: "Saved.", context: "guide dock, a prepared change was saved by a person" }),
      left: say(t({ message: "Left as it was.", context: "guide dock, a prepared change was declined" }), t({ message: "Left.", context: "guide dock, a prepared change was declined, brief" })),
    },

    draft: {
      eyebrow: say(t({ message: "A change I drafted for review", context: "guide dock, a change drafted for the review page" }), t({ message: "Draft", context: "guide dock, a change drafted for the review page, brief" })),
      note: say(
        t({ message: "It goes to the review page. Nothing changes until a person accepts it there.", context: "guide dock, what sending a draft to review does" }),
        t({ message: "Goes to review. No change until accepted.", context: "guide dock, what sending a draft to review does, brief" }),
      ),
      send: say(t({ message: "Send to review", context: "guide dock, files the drafted change into the review queue" }), t({ message: "Send", context: "guide dock, files the drafted change into the review queue, brief" })),
      sent: (code) =>
        code
          ? say(
              t({ message: `Sent to review as ${code}. Nothing changes until a person accepts it there.`, context: "guide dock, a drafted change was sent to review" }),
              t({ message: `Sent as ${code}.`, context: "guide dock, a drafted change was sent to review, brief" }),
            )
          : say(
              t({ message: "Sent to review. Nothing changes until a person accepts it there.", context: "guide dock, a drafted change was sent to review" }),
              t({ message: "Sent.", context: "guide dock, a drafted change was sent to review, brief" }),
            ),
      already: (code) =>
        code
          ? say(
              t({ message: `The same change already waits on the review page, as ${code}.`, context: "guide dock, the same drafted change already waits" }),
              t({ message: `Already waiting as ${code}.`, context: "guide dock, the same drafted change already waits, brief" }),
            )
          : say(
              t({ message: "The same change already waits on the review page.", context: "guide dock, the same drafted change already waits" }),
              t({ message: "Already waiting.", context: "guide dock, the same drafted change already waits, brief" }),
            ),
      held: say(
        t({ message: "Held before review. It waits under Held on the review page.", context: "guide dock, a drafted change was held before review" }),
        t({ message: "Held before review.", context: "guide dock, a drafted change was held before review, brief" }),
      ),
      openReview: say(t({ message: "Open the review page", context: "guide dock, opens the review page" }), t({ message: "Review page", context: "guide dock, opens the review page, brief" })),
    },
  };
}
