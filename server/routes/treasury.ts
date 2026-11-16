/**
 * THE TREASURY'S TWO READS, for a member who keeps the books without being an
 * admin (Rye, 2026-11-15: "Founders and Treasurers can mint tokens from after
 * launch ... mint tokens from pay requests and give bonuses").
 *
 *   GET /api/treasury/doors          which treasury surfaces this member may open
 *   GET /api/treasury/mint-options   what the hand-mint form needs, for a `token.mint` holder
 *
 * The writes are unchanged and keep their own gates: the hand mint
 * (`POST /api/admin/tokens/:slug/mint`) and the second signature ask
 * `token.mint` themselves, and the grants queue and its decline open to a
 * holder through `ROUTE_POWERS` (server/lib/operatorRoutes.ts). The payout
 * list asks `cash.pay` (server/routes/cashOwed.ts) and the End of Moon queue
 * its review keys (server/routes/moonReview.ts). Nothing here widens any of
 * them.
 *
 * WHY A READ OF ITS OWN rather than opening `GET /api/admin/tokens` and
 * `GET /api/admin/players` to the holder: those answer the registry's whole
 * issuance and the roster with every member's email, stage and admin groups.
 * A treasurer picking who to pay needs a name and a token, so this answers
 * exactly that, and the two admin reads stay the admin's.
 *
 * `doors` asks the same gate every write asks (`mayAct`), so the menu entry and
 * the page show a treasurer what the server will let them do, and nothing it
 * would refuse. An admin is answered by the same gate: before launch the gate
 * says yes to them, and once the village holds a power it says what it says.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import type { Capability } from "../../shared/capabilities";
import { sortMembersByName } from "../../shared/memberOrder";

/** Gratitude is never minted by hand (Rye, 2026-10-23); the mint route refuses it, so the picker never offers it. */
const HAND_MINT_NEVER = "gratitude";

/** The keys the End of Moon queue answers to that pay people (server/routes/moonReview.ts). */
const PAY_KEYS: readonly Capability[] = ["cash.pay", "moon.approve_alone"] as Capability[];

export type TreasuryDeps = Pick<AppDeps, "authedUser" | "mayAct" | "guardCapability" | "members"> & {
  /** The token registry, `allTokens()` in server/lib/ledger.ts. */
  tokens(): ReadonlyArray<{ slug: string; name: string; decimals?: number; governance?: string; isExample?: boolean; kind?: string }>;
  /** `ledger.admin_mint_cycle_cap`, the per-moon ceiling the hand mint counts against. */
  mintCap(): number;
};

/** What `GET /api/treasury/doors` answers. */
export interface TreasuryDoors {
  /** `token.mint`: the hand-mint form and the grants waiting for a second signer. */
  mint: boolean;
  /** `cash.pay`: the payout list (`/cash-payouts`). */
  cashPay: boolean;
  /** `cash.pay` or `moon.approve_alone`: the End of Moon review queue. */
  pay: boolean;
}

export function register(app: Express, deps: TreasuryDeps): void {
  const { authedUser, mayAct, guardCapability, members } = deps;

  app.get("/api/treasury/doors", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const [mint, ...pay] = await Promise.all([mayAct(req, "token.mint" as Capability), ...PAY_KEYS.map((k) => mayAct(req, k))]);
    const doors: TreasuryDoors = { mint: mint.ok, cashPay: pay[0].ok, pay: pay.some((v) => v.ok) };
    res.json(doors);
  });

  app.get("/api/treasury/mint-options", async (req, res) => {
    if (!(await guardCapability(req, res, "token.mint" as Capability))) return;
    const tokens = deps
      .tokens()
      .filter((t) => t.governance === "platform" && !t.isExample && t.slug !== HAND_MINT_NEVER)
      .map((t) => ({ slug: t.slug, name: t.name, decimals: Number(t.decimals ?? 0) || 0, kind: t.kind ?? undefined }));
    // A name and a handle, nothing else: no email, no stage, no admin groups.
    // Standing-example identities are content, not people, and are left off the
    // same way the roster leaves them off.
    const people = sortMembersByName((await members.all()).filter((u: any) => !u.isExample)).map((u: any) => ({
      id: String(u.id),
      name: String(u.name ?? ""),
      handle: u.handle ?? null,
    }));
    res.json({ tokens, members: people, mintCapPerCycle: Number(deps.mintCap()) || 0 });
  });
}
