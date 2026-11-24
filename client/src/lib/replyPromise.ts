/**
 * WHEN A PROPOSER HEARS BACK, SAID ONLY ONCE THEY HAVE SENT (the lead, 24 Nov 2026): "Let's say for all proposals
 * they'll hear within 1 moon cycle and only at submission". The window is the village's own, in moons,
 * `org.reply_window_moons` (shared/contributorRoutes.ts), served on /api/game/config as `replyWindowMoons`.
 *
 * Its own small module, so a thank-you page that loads the four ways lazily (fireflyPath/Thresholds.tsx) can say
 * the promise without pulling them onto its first view.
 */
import { useLingui } from "@lingui/react/macro";
import { useGameConfig } from "@/lib/gameApi";
import { replyMoonsOf } from "@shared/contributorRoutes";

/** The moon cycles a proposer is told they will hear back within, once they have sent. */
export function useReplyMoons(): number {
  return replyMoonsOf(useGameConfig()?.replyWindowMoons);
}

/** "You'll hear from us within one moon cycle.", said on a thank-you state only. */
export function useReplyPromise(): string {
  const { t } = useLingui();
  const moons = useReplyMoons();
  return moons === 1
    ? t({ message: "You'll hear from us within one moon cycle.", context: "after sending a proposal: when you hear back" })
    : t({ message: `You'll hear from us within ${moons} moon cycles.`, context: "after sending a proposal: when you hear back, more than one moon" });
}
