/**
 * THE SPLIT IN THE PRICE STEP (the lead, 17 Nov 2026), loaded lazily by TermsEight so neither the control nor the
 * split's arithmetic rides /propose-a-role's first view (scripts/route-first-view.json).
 *
 * It reads the split the role card's Apply link carried (`splitQuery`, applyChoice.ts) once, works the village's
 * offer at their commitment and their split at the price in force (shared/proposalSplit.ts `formSplit`), and writes
 * what it shows back as `paySplitView`, which the application sends and Review & submit reads.
 */
import { useEffect } from "react";
import { useLingui } from "@lingui/react/macro";
import { moneyWords } from "@shared/roleRewardWords";
import { formSplit, splitChanged, withAmounts } from "@shared/proposalSplit";
import SplitControl from "@/components/roleCard/SplitControl";
import { splitFromQuery } from "@/components/roleCard/applyChoice";
import type { TermsRole, TermsStepValue } from "./TermsEight";

export default function TermsSplit({ idPrefix, role, value, onChange }: { idPrefix: string; role: TermsRole; value: TermsStepValue; onChange: (next: TermsStepValue) => void }) {
  const { t, i18n } = useLingui();
  const shape = role.payShape ?? [];
  const own = value.payAsk?.kind === "amount" ? value.payAsk.monthly : null;
  const split = formSplit(shape, role.ceiling?.amount ?? null, value.commitmentPct, own, value.paySplit ?? null);
  const changed = split ? splitChanged(split.offered, split.shown) : false;
  // Review & submit's line for the split (fireflyPath/reviewExtras.ts): each share, and whether they changed it.
  const said = (split?.shown.shares ?? [])
    .map((s) =>
      typeof s.amount === "number" && role.ceiling
        ? t({ message: `${s.pct}% ${s.label} (${moneyWords(s.amount, role.ceiling.currency, i18n.locale)})`, context: "founding application review: one share of the split, with its amount" })
        : t({ message: `${s.pct}% ${s.label}`, context: "founding application review: one share of the split" }),
    )
    .join(", ");
  const line = changed ? t({ message: `${said} · changed from the village's split`, context: "founding application review: a split they changed" }) : said;
  const view = split ? { shown: split.shown, changed, line } : null;
  const viewKey = JSON.stringify(view);

  useEffect(() => {
    // The link's split first, once: it fits this role's shape or it is dropped.
    if (value.splitQuery !== undefined) {
      const pcts = splitFromQuery(`?split=${encodeURIComponent(value.splitQuery)}`, shape);
      const { splitQuery: _read, ...rest } = value;
      onChange({ ...rest, ...(pcts ? { paySplit: withAmounts(pcts, null) } : {}) });
      return;
    }
    if (JSON.stringify(value.paySplitView ?? null) !== viewKey) onChange({ ...value, paySplitView: view });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, value.splitQuery]);

  if (!split) return null;
  const c = role.ceiling ?? null;
  return <SplitControl idPrefix={idPrefix} split={split.shown} offered={split.offered} onChange={(paySplit) => onChange({ ...value, paySplit })} currency={c?.currency ?? null} per={c?.per ?? null} pct={value.commitmentPct} />;
}
