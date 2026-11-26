/**
 * THE END-OF-MOON REVIEW'S SETTINGS ON THE CASH PAYOUTS DESK (decision 22).
 *
 * Three tabs, one document each: Payers, Village settings and Moon rhythm.
 * Loaded as its own lazy chunk from CashPayoutsTab, so the desk's first page
 * carries none of it. Each editor asks its own door and renders nothing when
 * the moon review module is off (the door answers 404), and the server's
 * refusal when the account does not hold the cash power.
 *
 * Light-only, like the rest of this folder.
 */
import { useState } from "react";

import PayersEditor from "./PayersEditor";
import VillageSettingsEditor from "./VillageSettingsEditor";
import RhythmEditor from "./RhythmEditor";
import { useMoonWords, type MOON_RECAP_WORDS } from "@/components/myMoon/moonWords";

type Tab = keyof typeof MOON_RECAP_WORDS.admin.tabs;
const TABS: readonly Tab[] = ["payers", "settings", "rhythm"];

export default function MoonReviewSettingsPanel({ password }: { password: string }) {
  const MW = useMoonWords();
  const [tab, setTab] = useState<Tab>("payers");
  return (
    <section aria-label={MW.admin.heading} className="space-y-4 border-t border-border pt-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{MW.admin.heading}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{MW.admin.intro}</p>
      </div>
      <div role="tablist" aria-label={MW.admin.heading} className="flex w-fit rounded-lg border border-border bg-white p-0.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-teal-deep text-white" : "text-foreground"}`}
          >
            {MW.admin.tabs[t]}
          </button>
        ))}
      </div>
      {tab === "payers" && <PayersEditor password={password} />}
      {tab === "settings" && <VillageSettingsEditor password={password} />}
      {tab === "rhythm" && <RhythmEditor password={password} />}
    </section>
  );
}
