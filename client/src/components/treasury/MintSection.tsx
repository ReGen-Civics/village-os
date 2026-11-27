/**
 * THE TREASURY'S MINT: the hand mint and the grants waiting for a second signer, for a holder of `token.mint` who
 * need not be an admin (Rye, 2026-11-15: "Founders and Treasurers can mint tokens ... from pay requests and give
 * bonuses"). Moved whole from the old /treasury page into Governance's Treasury (27 Nov 2026).
 *
 * The picker reads `GET /api/treasury/mint-options`, a name and a token for each choice, so a treasurer never reads
 * the admin roster's emails. Every write keeps its own server gate; MintDesk decides nothing. Its own lazy chunk
 * (client/src/lib/privilegedChunks.ts), so no member who holds no mint power downloads it.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useModules } from "@/modules/ModuleProvider";
import { BreathingLoader } from "@/components/natural";
import { HINT } from "@/components/journey/look";
import { MINT_SHEET } from "./deskLooks";
import { visibleTokens } from "@/components/admin/tokenCatalog";
import type { MintMember, MintToken } from "@/components/admin/MintDesk";
import type { ModuleLifecycle } from "@shared/modules";

const MintDesk = lazy(() => import("@/components/admin/MintDesk"));

interface MintOptions {
  tokens: Array<MintToken & { kind?: string }>;
  members: MintMember[];
  mintCapPerCycle: number;
}

export default function MintSection({ password }: { password: string }) {
  const { t } = useLingui();
  const [options, setOptions] = useState<MintOptions | null>(null);
  const [failed, setFailed] = useState(false);
  const { modules, loaded } = useModules();
  useEffect(() => {
    let live = true;
    fetch("/api/treasury/mint-options", { headers: { Authorization: `Bearer ${password}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (live) {
          setOptions({
            tokens: Array.isArray(d?.tokens) ? d.tokens : [],
            members: Array.isArray(d?.members) ? d.members : [],
            mintCapPerCycle: Number(d?.mintCapPerCycle) || 0,
          });
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [password]);
  // A module's own token is offered while its module is on, the same rule the admin picker follows.
  const lifecycles = useMemo<Record<string, ModuleLifecycle> | null>(
    () => (loaded ? Object.fromEntries(modules.map((m) => [m.id, m.lifecycle as ModuleLifecycle])) : null),
    [modules, loaded],
  );
  if (failed) return <p className={HINT} role="alert">{t({ message: "The mint form could not load just now. Try again in a moment.", context: "treasury: mint" })}</p>;
  if (!options) return <BreathingLoader />;
  const tokens: MintToken[] = visibleTokens(options.tokens, lifecycles);
  return (
    <Suspense fallback={<BreathingLoader />}>
      <MintDesk password={password} tokens={tokens} members={options.members} mintCap={options.mintCapPerCycle} look={MINT_SHEET} />
    </Suspense>
  );
}
