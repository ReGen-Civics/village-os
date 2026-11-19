/**
 * THE CONTRIBUTION TOKEN'S NAME, WITH ITS AT-RISK TIP (the lead, 19 Nov 2026). The non-cash share of pay is the
 * village's contribution token, never "equity". Wherever its name is shown to a member or an applicant, the name
 * carries a tip in plain words: it tracks what you contribute, what it becomes is still being defined, and it is
 * at risk.
 *
 * The name and the village are the village's own (Admin, Tokens for the token, the brand for the village), so
 * platform code names neither: a fresh village reads "Contribution tokens" and "the village". The tip is built
 * here and NEVER stored in `tokens.description`, because a written description is what releases the token's held
 * End of Moon shares (server `earnedEquityMeaningWritten`), and a tooltip must not be that decision.
 *
 * The tip's wording is the lead's draft, awaiting the lead's review.
 *
 * Same mechanics as the moon word (WordTip.tsx): tap, focus, Escape, a sheet on a phone. No new dependency.
 */
import { useMemo, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { useGameConfig } from "@/lib/gameApi";
import { CONTRIBUTION_TOKEN_SLUG, CREDITS_TOKEN_SLUG, labelKey, shareNames, tokensNoun, type ShareNames } from "@shared/contributionToken";
import { partOfLabel } from "@shared/rewardShare";
import { WordTip } from "./WordTip";

/** The two token shares' names as the village set them (Admin, Tokens), each at its platform default while unset or loading. */
export function useShareNames(): ShareNames {
  const cfg = useGameConfig();
  const names = cfg?.currency?.names as Record<string, string> | undefined;
  const equity = names?.[CONTRIBUTION_TOKEN_SLUG];
  const credits = names?.[CREDITS_TOKEN_SLUG];
  // One object while the names hold, so a caller can list it in a memo's dependencies.
  return useMemo(() => shareNames({ equity, credits }), [equity, credits]);
}

/** The tip's plain words for this village. */
export function useContributionTip(): string {
  const { i18n } = useLingui();
  const cfg = useGameConfig();
  const tokens = tokensNoun(useShareNames().equity);
  const village = String(cfg?.project?.name ?? "").trim() || i18n._(msg({ message: "the village", context: "contribution token tip: a village with no name yet" }));
  return i18n._(
    msg({
      message: `${tokens} track what you contribute. What they become is still being defined with legal advice, and they are at risk: they have value only if ${village} succeeds.`,
      context: "tooltip on the contribution token's name; the lead's draft, under review",
    }),
  );
}

/** The contribution token's name (or `children`, the name as a sentence has it), wearing the tip. */
export function ContributionWord({ children }: { children?: string }) {
  const name = useShareNames().equity;
  const tip = useContributionTip();
  return (
    <WordTip tip={tip} kind="tip-word">
      {children ?? name}
    </WordTip>
  );
}

/** Escape a name for a pattern. */
const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A sentence with the FIRST whole-word mention of the contribution token's name wearing the tip; later mentions
 * stay plain, so a paragraph carries one tip. Text without the name comes back as is.
 */
export function ContributionText({ text, plain = (x) => x }: { text: string | null | undefined; plain?: (part: string) => ReactNode }) {
  const name = useShareNames().equity;
  const s = text ?? "";
  const m = name ? new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped(name)})(?![\\p{L}\\p{N}])`, "iu").exec(s) : null;
  if (!m) return <>{plain(s)}</>;
  const at = m.index + m[1].length;
  return (
    <>
      {plain(s.slice(0, at))}
      <ContributionWord>{m[2]}</ContributionWord>
      {plain(s.slice(at + m[2].length))}
    </>
  );
}

/**
 * A pay share's label as a reader sees it (the lead, 19 Nov 2026; card labels "Cash", the token's name, the
 * credits token's name): a label that reads as the contribution share shows the contribution token's name, one that
 * reads as credits shows the credits token's name, and any other label is shown as written. Display only: the
 * stored label is what a split is sent and checked against, so callers keep the raw shape for anything they send.
 */
export function shareLabelFor(label: string, names: ShareNames): string {
  const part = partOfLabel(label, names);
  if (part === "equity") return names.equity;
  // A bare credits word follows the token's name; a label the village wrote out ("credits for the shared commons") stays.
  if (part === "credits" && /^(village )?credits?$/.test(labelKey(label))) return names.credits;
  return label;
}

/** `shareLabelFor` with this village's names. */
export function useShareLabel(): (label: string) => string {
  const names = useShareNames();
  return (label) => shareLabelFor(label, names);
}

/** A share's label as shown, the contribution share's wearing the tip. */
export function ShareLabel({ label }: { label: string }) {
  const names = useShareNames();
  return partOfLabel(label, names) === "equity" ? <ContributionWord /> : <>{shareLabelFor(label, names)}</>;
}
