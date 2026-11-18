/**
 * WHAT WAS MINTED TO EACH MEMBER, BY SOURCE, NET OF ITS OWN REVERSALS.
 *
 * The per-source caps on voting weight (shared/voiceSourceCaps.ts) split a
 * member's balance into the part from cash and the part from everything else.
 * This is the read behind that split, for any platform token.
 *
 * TWO FAUCETS. A token's engine mints come from its own faucet (`faucetFor`,
 * server/lib/economy.ts: `sys:voice-mint` for Voice), and a steward's hand-mint
 * of ANY token comes from `sys:mint` (the hand-mint route and
 * `approveMintRequest`). Both are read; one faucet alone would miss a whole
 * kind of mint.
 *
 * Reversals: a clawback mirror back to either faucet is netted against the
 * source of the posting its key names (`reversal:<village>:<original key>`,
 * `originalKeyOf`). A mirror whose original cannot be found is dropped from the
 * split; the balance already carries its effect, and the split only decides
 * which side of it counts under which cap. Decay and exit sweeps take from the
 * balance as a whole and are not read here.
 *
 * Reads only, through server/repos/voiceLedger.ts. Minor units throughout.
 */
import type { Pool } from "mysql2/promise";
import { originalKeyOf } from "./ledger";
import { faucetFor } from "./economy";
import { clawbacksToFaucet, mintedBySource, sourcesOfKeys } from "../repos/voiceLedger";

/** The hand-mint faucet every platform token's steward grants come from. */
export const HAND_MINT_FAUCET = "sys:mint";

export function faucetsOf(token: string): string[] {
  const own = faucetFor(token);
  return Array.from(new Set([own, HAND_MINT_FAUCET].filter((f): f is string => !!f)));
}

export async function netMintedBySource(
  pool: Pool,
  token: string,
  accounts: readonly string[],
): Promise<Map<string, Record<string, number>>> {
  const net = new Map<string, Record<string, number>>();
  if (accounts.length === 0) return net;
  const add = (account: string, source: string, amount: number) => {
    const row = net.get(account) ?? {};
    row[source] = (row[source] ?? 0) + amount;
    net.set(account, row);
  };
  for (const faucet of faucetsOf(token)) {
    for (const m of await mintedBySource(pool, token, faucet, accounts)) add(m.account, m.source, m.total);
    const mirrors = await clawbacksToFaucet(pool, token, faucet, accounts);
    const originals = Array.from(new Set(mirrors.map((r) => originalKeyOf(r.key)).filter((k): k is string => k !== null)));
    const sourceOfKey = await sourcesOfKeys(pool, token, originals);
    for (const r of mirrors) {
      const original = originalKeyOf(r.key);
      const source = original === null ? undefined : sourceOfKey.get(original);
      if (source !== undefined) add(r.account, source, -r.amount);
    }
  }
  return net;
}
