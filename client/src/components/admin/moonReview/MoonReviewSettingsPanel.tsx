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
import { CASH_ADMIN, type CashDeskLook } from "@/components/treasury/deskLooks";

import PayersEditor from "./PayersEditor";
import VillageSettingsEditor from "./VillageSettingsEditor";
import RhythmEditor from "./RhythmEditor";
import { useMoonWords, type MOON_RECAP_WORDS } from "@/components/myMoon/moonWords";

type Tab = keyof typeof MOON_RECAP_WORDS.admin.tabs;
const TABS: readonly Tab[] = ["payers", "settings", "rhythm"];

export default function MoonReviewSettingsPanel({ password, look = CASH_ADMIN, bare = false }: {
  password: string;
  /** Admin's light look by default; Governance's Treasury passes the sheet's and provides the editors' kit. */
  look?: CashDeskLook;
  /** Inside a fold that already names it (Governance's Treasury): no heading and no rule above. */
  bare?: boolean;
}) {
  const MW = useMoonWords();
  const [tab, setTab] = useState<Tab>("payers");
  return (
    <section aria-label={MW.admin.heading} className={bare ? "space-y-4" : "space-y-4 border-t border-border pt-6"}>
      <div>
        {bare ? null : <h3 className="text-lg font-semibold text-foreground">{MW.admin.heading}</h3>}
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{MW.admin.intro}</p>
      </div>
      <div role="tablist" aria-label={MW.admin.heading} className={`w-fit ${look.tabs}`}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`${look.tab} ${tab === t ? look.tabOn : look.tabOff}`}
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
