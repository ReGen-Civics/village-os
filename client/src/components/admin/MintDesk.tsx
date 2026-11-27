/**
 * THE HAND MINT AND ITS GRANTS RECORD, in one piece two pages draw.
 *
 * MOVED OUT OF TokensTab.tsx (2026-11-15) so the Treasury page (/treasury) can
 * show a `token.mint` holder who is not an admin exactly this and nothing else
 * of the registry: Rye, 2026-11-15, "Founders and Treasurers can mint tokens
 * from after launch ... mint tokens from pay requests and give bonuses". Admin
 * then Tokens renders the same component, so there is one mint form, not two.
 *
 * The caller hands in the picker's tokens and people, because the two pages
 * read them from different doors: the admin tab from the registry and roster
 * it already shows, the Treasury from `GET /api/treasury/mint-options`, which
 * answers a name and a token and no email. The grants record is read here,
 * from the one queue (`GET /api/admin/mint-requests`), which opens to a
 * `token.mint` holder through `ROUTE_POWERS` (server/lib/operatorRoutes.ts).
 *
 * Every write keeps its own server gate: the mint and the second signature ask
 * `token.mint`, and so does the decline. This file decides nothing.
 *
 * What changed on the way out: the gray text classes became the semantic
 * tokens (`scripts/check-tailwind-gray.mjs` starts a new file at zero), and the
 * grants are read here. The mint, sign and decline flows moved untouched.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "@/components/admin/adminApi";
import { smallestUnit } from "@/lib/tokenAmount";
import { MINT_CAP_SCOPE } from "@shared/mintCapWords";
import { MINT_ADMIN, type MintDeskLook } from "@/components/treasury/deskLooks";

/** One token the picker may offer: platform-governed, real, and never Gratitude. */
export interface MintToken {
  slug: string;
  name: string;
  decimals?: number;
}

/** One person the picker may offer. A name and a handle are all it needs. */
export interface MintMember {
  id: string;
  name: string;
  handle?: string | null;
}

export default function MintDesk({ password, tokens, members, mintCap, onChanged, look = MINT_ADMIN }: {
  password: string;
  /** Admin's light look by default; Governance's Treasury passes the sheet's (components/treasury/deskLooks.ts). */
  look?: MintDeskLook;
  tokens: readonly MintToken[];
  members: readonly MintMember[];
  mintCap: number;
  /** Called after a mint, a signature or a decline, so the caller can re-read what it shows. */
  onChanged?: () => void;
}) {
  const { t } = useLingui();
  // `contribution`: what stood behind the grant, cash put in or anything else.
  // A village capping voting weight by source counts the two under separate caps.
  const [mint, setMint] = useState({ slug: "", toUserId: "", amount: "", reason: "", contribution: "other" as "cash" | "other" });
  /** 0106: grants waiting for a second steward, and the ones already decided. */
  const [grants, setGrants] = useState<any[]>([]);
  const [cosignOver, setCosignOver] = useState<number>(0);

  /*
   * THIS SCREEN SPEAKS WHOLE TOKENS. The ledger does not. The box and the
   * numbers beside it are converted together (see TokensTab.tsx for the story).
   */
  const decimalsOfSlug = (slug: string): number =>
    Number(tokens.find((t) => t.slug === slug)?.decimals ?? 0) || 0;

  const loadGrants = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/mint-requests`, { headers: authHeaders(password) });
      const g = await res.json();
      setGrants(Array.isArray(g?.requests) ? g.requests : []);
      setCosignOver(Number(g?.cosignOver) || 0);
    } catch { setGrants([]); }
  }, [password]);

  useEffect(() => { void loadGrants(); }, [loadGrants]);

  const changed = () => {
    void loadGrants();
    onChanged?.();
  };

  const doMint = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/tokens/${mint.slug}/mint`, {
        method: "POST",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          toUserId: mint.toUserId,
          // HUMAN TOKENS, fractions included, and the conversion is the
          // ROUTE's (`toLedgerUnits(slug, amt)` in
          // `POST /api/admin/tokens/:slug/mint`). Converting here as well
          // would multiply twice, so the screen sends what was typed.
          amount: Number(mint.amount),
          reason: mint.reason,
          contribution: mint.contribution,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(refusal(data, "failed"));
      /*
       * 0106: a grant over `ledger.admin_mint_cosign_over` answers 202 and
       * moves nothing. Saying "Minted" here would be the product telling a
       * steward something that did not happen.
       */
      const remaining = data.remaining;
      if (data.pending) toast.success(data.message || t`Recorded. Awaiting a second steward's sign-off`);
      else toast.success(t`Minted: ${remaining} left under this cycle's cap`);
      setMint({ slug: "", toUserId: "", amount: "", reason: "", contribution: "other" });
      changed();
    } catch (e: any) { toast.error(e?.message || t({ message: "Mint failed", context: "toast after a hand mint was refused" })); }
  };

  /** The SECOND steward agrees. The amount and token come from the record. */
  const signGrant = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/mint-requests/${id}/approve`, {
        method: "POST",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(refusal(data, "failed"));
      toast.success(t`Signed. The grant is credited`);
      changed();
    } catch (e: any) { toast.error(e?.message || t`Could not sign that grant`); }
  };

  const declineGrant = async (id: string) => {
    // Null is the cancel and it has to survive: `?? ""` would turn Escape
    // into a decline with an empty reason.
    const note = window.prompt(t`Why are you turning this down? The record keeps it.`);
    if (note === null) return;
    try {
      const res = await fetch(`${API_BASE}/admin/mint-requests/${id}/decline`, {
        method: "POST",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ reason: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(refusal(data, "failed"));
      toast.success(t`Turned down. The cap has its room back`);
      changed();
    } catch (e: any) { toast.error(e?.message || t`Could not turn that grant down`); }
  };

  const capWords = mintCap.toLocaleString();
  const cosignWords = cosignOver.toLocaleString();

  return (
    <div className="space-y-6">
      <div className={look.formBox}>
        <h3 className={look.heading}><Trans context="heading of the hand-mint form">Mint by hand</Trans></h3>
        {look.rules === "bullets" ? (
          // The sheet's three lines (fold QA round 1): the rules a treasurer acts on, without the settings' keys.
          <ul className={look.rulesText} data-mint-rules>
            <li>{t({ message: `At most ${capWords} a moon`, context: "hand-mint rules, the cap" })}</li>
            <li>
              {cosignOver > 0
                ? t({ message: `Over ${cosignWords} waits for a second signer`, context: "hand-mint rules, the second signer" })
                : t({ message: "No second signer is asked for at any amount", context: "hand-mint rules, the second signer" })}
            </li>
            <li>{t({ message: "You can't mint to yourself", context: "hand-mint rules, self" })}</li>
          </ul>
        ) : (
        <p className={look.rulesText}>
          <Trans>
            Issues from the dedicated mint faucet, with a reason, audited. This village
            can bring at most {capWords} of a token into existence per
            lunar cycle, counted net of what comes back (ledger.admin_mint_cycle_cap).
          </Trans>
          {" "}{MINT_CAP_SCOPE}{" "}
          <Trans>A busy month of stays or work-exchange quests can use it up before anyone mints anything here.</Trans>
          {" "}<Trans>Minting to your own account is refused.</Trans>{" "}
          {cosignOver > 0
            ? <Trans>A grant over {cosignWords} waits for a second steward to agree before anything moves (ledger.admin_mint_cosign_over).</Trans>
            : <Trans>A second steward is not asked for at any amount (ledger.admin_mint_cosign_over is 0).</Trans>}
        </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className={look.label}>
            <Trans context="hand-mint form, a field's label">Token</Trans>
          <select value={mint.slug} onChange={(e) => setMint({ ...mint, slug: e.target.value })}
            aria-label={t({ message: "Token to mint", context: "hand-mint form, token picker" })}
            className={look.select}>
            <option value=""><Trans context="hand-mint form, token picker placeholder">Token…</Trans></option>
            {tokens.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
          </select>
          </label>
          <label className={look.label}>
            <Trans context="hand-mint form, a field's label">Member</Trans>
          <select value={mint.toUserId} onChange={(e) => setMint({ ...mint, toUserId: e.target.value })}
            aria-label={t({ message: "Member to mint to", context: "hand-mint form, member picker" })}
            className={look.select}>
            <option value=""><Trans context="hand-mint form, member picker placeholder">Member…</Trans></option>
            {members.map((p) => <option key={p.id} value={p.id}>{p.name}{p.handle ? ` (@${p.handle})` : ""}</option>)}
          </select>
          </label>
          <label className={look.label}>
            <Trans context="hand-mint form, a field's label">Amount</Trans>
          <input value={mint.amount} onChange={(e) => setMint({ ...mint, amount: e.target.value })}
            placeholder={t({ message: "Amount", context: "hand-mint form, amount box" })} type="number" min={smallestUnit(decimalsOfSlug(mint.slug))} step={smallestUnit(decimalsOfSlug(mint.slug))} className={look.amount} />
          </label>
          <label className={`${look.label} min-w-48 flex-1`}>
            <Trans context="hand-mint form, a field's label">Reason</Trans>
          <input value={mint.reason} onChange={(e) => setMint({ ...mint, reason: e.target.value })}
            placeholder={t({ message: "Reason (required)", context: "hand-mint form, reason box" })} className={look.reason} />
          </label>
          <label className={look.label}>
            <Trans context="hand-mint form, a field's label">What stood behind it</Trans>
          <select value={mint.contribution} onChange={(e) => setMint({ ...mint, contribution: e.target.value === "cash" ? "cash" : "other" })}
            aria-label={t({ message: "What was contributed", context: "admin mint form, what stood behind a grant" })} className={look.select}>
            <option value="other">{t({ message: "Contributed: work or other", context: "admin mint form, what stood behind a grant" })}</option>
            <option value="cash">{t({ message: "Contributed: cash", context: "admin mint form, what stood behind a grant" })}</option>
          </select>
          </label>
          <button onClick={doMint} disabled={!mint.slug || !mint.toUserId || !mint.amount || !mint.reason.trim()}
            className={look.primary}>
            <Trans context="hand-mint form, submit button">Mint</Trans>
          </button>
        </div>
      </div>

      {/*
        0106: THE GRANTS RECORD. Every holder sees the same list, waiting
        first. The decided rows stay because who agreed to what, and when, is
        the record itself.
      */}
      {grants.length > 0 && (
        <div className={look.grantsBox}>
          <h3 className={look.heading}><Trans context="heading of the hand-mint grants record">Grants and their signatures</Trans></h3>
          <p className="text-xs text-muted-foreground mb-3">
            <Trans>
              A grant over the threshold moves nothing until a second steward agrees.
              Whoever asked for it cannot be the one who signs it.
            </Trans>
          </p>
          <div className="space-y-2">
            {grants.map((g) => (
              <div key={g.id} className={look.row}>
                <div className="flex-1 min-w-64">
                  <p className="text-sm text-foreground">
                    {/* `admin_mint_requests.amount` holds WHOLE tokens: the route stores
                        what was typed and converts only at the post. */}
                    <strong>{Number(g.amount).toLocaleString()} {g.tokenName}</strong>
                    {" to "}{g.toName ?? g.toUserId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.reason}
                    {g.contribution === "cash" ? t` · cash put in` : ""}
                    {" · asked for by "}{g.requestedByName ?? g.requestedBy}
                    {g.status === "pending"
                      ? " · waiting for a second steward"
                      : ` · ${g.status} by ${g.decidedByName ?? g.decidedBy}${g.decidedAt ? ` on ${new Date(g.decidedAt).toLocaleDateString()}` : ""}`}
                    {g.decisionNote ? ` · "${g.decisionNote}"` : ""}
                  </p>
                </div>
                {g.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => signGrant(g.id)}
                      className={look.rowAct}>
                      <Trans context="hand-mint grants record, approve a grant">Sign it</Trans>
                    </button>
                    <button onClick={() => declineGrant(g.id)}
                      className={look.secondary}>
                      <Trans context="hand-mint grants record, decline a grant">Turn it down</Trans>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
