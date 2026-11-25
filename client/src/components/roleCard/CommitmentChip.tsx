/**
 * THE PLAIN COMMITMENT ON A /roles ROW (the lead, 24 Nov 2026): "Full time", "Part time or fractional" or "Full or
 * part time", with ", contract" for a contractor role, read from the role's own data (rewardWords.ts
 * `commitmentLabel`). Nothing when the data says nothing; never hours, never pay.
 */
import { useLingui } from "@lingui/react/macro";
import { commitmentLabel } from "./rewardWords";

export default function CommitmentChip({ role }: { role: unknown }) {
  const { i18n } = useLingui();
  const words = commitmentLabel(i18n, role);
  if (!words) return null;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-foreground border border-border" data-commitment-label="">
      {words}
    </span>
  );
}
