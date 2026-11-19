/**
 * THE VILLAGE'S TOKEN NAMES, EACH WITH ITS TIP (the lead, 19 Nov 2026).
 *
 * The contribution token: the non-cash share of pay, the token an investor buys with cash, and its Hypha mirror,
 * all one token. Never "equity" to a member or an applicant. Its name is the village's own word (vocabulary,
 * Admin, Make it yours), in full in a sentence ("Amora Tokens") and short on a label or a tile ("Amora"); see
 * shared/contributionToken.ts. EVERY mention, short or long, carries the at-risk tip.
 *
 * The credits token keeps its registry name ("Village Credits"); its FIRST mention in a passage carries a tip
 * saying it is a usage token.
 *
 * Both tips are built here and NEVER stored in `tokens.description`: a written description is what releases the
 * contribution token's held End of Moon shares (server `earnedEquityMeaningWritten`), and a tooltip must not be
 * that decision. Wording approved by the lead, 19 Nov 2026.
 *
 * Same mechanics as the moon word (WordTip.tsx): tap, focus, Escape, a sheet on a phone. No new dependency.
 */
import { Fragment, useMemo, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { useGameConfig } from "@/lib/gameApi";
import { CONTRIBUTION_TOKEN_SLUG, CREDITS_TOKEN_SLUG, labelKey, shareNamesFrom, tokensNoun, type ShareNames } from "@shared/contributionToken";
import type { Vocabulary } from "@shared/vocabulary";
import { partOfLabel } from "@shared/rewardShare";
import { WordTip } from "./WordTip";

/** The token names a member reads, each at its platform default while unset or loading. */
export function useShareNames(): ShareNames {
  const cfg = useGameConfig();
  // The served vocabulary is already resolved (client/src/hooks/useNoun.ts reads it the same way).
  const own = String((cfg as { vocabulary?: Partial<Vocabulary> } | null)?.vocabulary?.contributionToken?.many ?? "");
  const registry = cfg?.currency?.names as Record<string, string> | undefined;
  const equityReg = registry?.[CONTRIBUTION_TOKEN_SLUG] ?? "";
  const creditsReg = registry?.[CREDITS_TOKEN_SLUG] ?? "";
  // One object while the names hold, so a caller can list it in a memo's dependencies.
  return useMemo(
    () =>
      shareNamesFrom(own ? ({ contributionToken: { one: own, many: own, a: "" } } as Partial<Vocabulary>) : null, {
        [CONTRIBUTION_TOKEN_SLUG]: equityReg,
        [CREDITS_TOKEN_SLUG]: creditsReg,
      }),
    [own, equityReg, creditsReg],
  );
}

/** The contribution token's tip for this village. */
export function useContributionTip(): string {
  const { i18n } = useLingui();
  const cfg = useGameConfig();
  const tokens = tokensNoun(useShareNames().equity);
  const village = String(cfg?.project?.name ?? "").trim() || i18n._(msg({ message: "the village", context: "contribution token tip: a village with no name yet" }));
  return i18n._(
    msg({
      message: `${tokens} track what you contribute. What they become is still being defined with legal advice, and they are at risk: they have value only if ${village} succeeds.`,
      context: "tooltip on the contribution token's name",
    }),
  );
}

/** The credits token's tip for this village. */
export function useCreditsTip(): string {
  const { i18n } = useLingui();
  const credits = useShareNames().credits;
  return i18n._(msg({ message: `${credits} are usage tokens: you spend them on things in the village.`, context: "tooltip on the credits token's name" }));
}

/** The contribution token's name (or `children`, the name as a sentence has it), wearing its tip. `short` for a label or a tile. */
export function ContributionWord({ children, short = false }: { children?: string; short?: boolean }) {
  const names = useShareNames();
  const tip = useContributionTip();
  return (
    <WordTip tip={tip} kind="tip-word">
      {children ?? (short ? names.equityShort : names.equity)}
    </WordTip>
  );
}

/** The credits token's name (or `children`), wearing its tip. */
export function CreditsWord({ children }: { children?: string }) {
  const names = useShareNames();
  const tip = useCreditsTip();
  return (
    <WordTip tip={tip} kind="tip-word">
      {children ?? names.credits}
    </WordTip>
  );
}

/** Escape a name for a pattern. */
const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A pattern for any of these whole-word names, longest first, or null for none. */
const wordPattern = (names: string[]): RegExp | null => {
  const alts = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean))).sort((a, b) => b.length - a.length);
  return alts.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${alts.map(escaped).join("|")})(?![\\p{L}\\p{N}])`, "giu") : null;
};

/**
 * A passage with the village's token names wearing their tips: EVERY mention of the contribution token, full or
 * short, and the FIRST mention of the credits token. Text without either comes back as is. `plain` renders the
 * text between (MoonText, say).
 */
export function TokenText({ text, plain = (x) => x }: { text: string | null | undefined; plain?: (part: string) => ReactNode }) {
  const names = useShareNames();
  const s = text ?? "";
  const hits: Array<{ index: number; word: string; kind: "contribution" | "credits" }> = [];
  const contribution = wordPattern([names.equity, names.equityShort]);
  const credits = wordPattern([names.credits]);
  if (contribution) for (const m of Array.from(s.matchAll(contribution))) hits.push({ index: m.index ?? 0, word: m[1], kind: "contribution" });
  if (credits) for (const m of Array.from(s.matchAll(credits))) hits.push({ index: m.index ?? 0, word: m[1], kind: "credits" });
  if (!hits.length) return <>{plain(s)}</>;
  hits.sort((a, b) => a.index - b.index);
  const out: ReactNode[] = [];
  let at = 0;
  let creditsTipped = false;
  for (const h of hits) {
    if (h.index < at || (h.kind === "credits" && creditsTipped)) continue;
    out.push(<Fragment key={`t${at}`}>{plain(s.slice(at, h.index))}</Fragment>);
    out.push(h.kind === "contribution" ? <ContributionWord key={`w${h.index}`}>{h.word}</ContributionWord> : <CreditsWord key={`w${h.index}`}>{h.word}</CreditsWord>);
    if (h.kind === "credits") creditsTipped = true;
    at = h.index + h.word.length;
  }
  out.push(<Fragment key={`t${at}`}>{plain(s.slice(at))}</Fragment>);
  return <>{out}</>;
}

/** The names a label is read by: the village's words, full and short, and the credits token's. */
const labelNames = (names: ShareNames) => ({ equity: [names.equity, names.equityShort], credits: names.credits });

/**
 * A pay share's label as a reader sees it: a label that reads as the contribution share shows the token's short
 * name, a bare credits label ("Credits", "Village credits") the credits token's name, and any other label is
 * shown as written. Display only: the stored label is what a split is sent and checked against, so callers keep
 * the raw shape for anything they send.
 */
export function shareLabelFor(label: string, names: ShareNames): string {
  const part = partOfLabel(label, labelNames(names));
  if (part === "equity") return names.equityShort;
  if (part === "credits" && (/^(village )?credits?$/.test(labelKey(label)) || labelKey(label) === labelKey(names.credits))) return names.credits;
  return label;
}

/** `shareLabelFor` with this village's names. */
export function useShareLabel(): (label: string) => string {
  const names = useShareNames();
  return (label) => shareLabelFor(label, names);
}

/** A share's label as shown, wearing its tip: the contribution share always, a credits share shown by its name. */
export function ShareLabel({ label }: { label: string }) {
  const names = useShareNames();
  if (partOfLabel(label, labelNames(names)) === "equity") return <ContributionWord short />;
  const shown = shareLabelFor(label, names);
  return shown === names.credits ? <CreditsWord /> : <>{shown}</>;
}
