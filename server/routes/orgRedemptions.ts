/**
 * THE DOORS TO A VENTURE'S REDEMPTION (0420, credits lane 2).
 *
 *   GET  /api/org-redemptions/mine                  the ventures I run: the terms, what is waiting, the record
 *   POST /api/org-redemptions                       ask to redeem some of what a venture I run holds
 *   POST /api/org-redemptions/:id/cancel            take it back, while it waits
 *   GET  /api/admin/org-redemptions                 the Treasury's queue, for a redemption key holder
 *   POST /api/admin/org-redemptions/:id/confirm     the cash went out: burn the held credits
 *   POST /api/admin/org-redemptions/:id/refuse      no: the credits go back to the venture
 *
 * WHO. The member doors answer a person about the ventures they run, by being
 * seated in the venture's role (server/lib/orgAccounts.ts `operatesOrg`), the
 * same kind of answer lane 1's `/api/org-accounts/mine` gives. The Treasury
 * doors ask the ONE gate for `redemption.confirm`, the member redemption's own
 * key, which the seeded Treasury role carries (server/lib/starterRoles.ts). On
 * top of the key, nobody who runs the venture and nobody who asked may decide
 * it (`orgDecideRefusal`), checked in server/lib/orgRedemptions.ts so no other
 * caller can skip it.
 *
 * WHAT IS OFF. `ledger.org_redemption_open` ships off. While it is off a new
 * ask is refused and the cancel, refuse and confirm doors keep working, so
 * anything already held can still come home or be settled.
 *
 * IN THEIR OWN MODULE, for the server/index.ts ratchet: one import and one
 * register call there.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import type { OrgRedemptionView } from "../../shared/orgRedemptions";
import { cycleWindow } from "../lib/economy";
import { latestRates } from "../lib/fxRates";
import { recordEvent } from "../lib/events";
import { orgsOperatedBy } from "../lib/orgAccounts";
import { liveSeatedUserIds, orgAccountRow } from "../repos/orgAccounts";
import { orgRedemptionsFor, decidedOrgRedemptions, waitingOrgRedemptions, type OrgRedemptionRow } from "../repos/orgRedemptions";
import {
  decideOrgRedemption,
  orgHoldReconciliation,
  orgRedemptionTerms,
  orgRedemptionView,
  redeemedMoney,
  requestOrgRedemption,
  ventureRedeemableToken,
  type DailyRates,
} from "../lib/orgRedemptions";
import { allTokens } from "../lib/ledger";

type Deps = Pick<AppDeps, "authedUser" | "getPool" | "guardCapability" | "members" | "notify" | "notifyAdmins" | "overLimit"> & {
  /** Who holds `redemption.confirm` through the village's own powers, admins left out. */
  redemptionKeyHolders: () => Promise<string[]>;
};

export function register(app: Express, deps: Deps): void {
  const { authedUser, getPool, guardCapability, members, notify, notifyAdmins, overLimit, redemptionKeyHolders } = deps;
  const nameOf = async (id: string): Promise<string | null> => (await members.byId(id).catch(() => null))?.name ?? null;
  const labelOf = async (orgRoleId: string): Promise<string | null> => (await orgAccountRow(getPool(), orgRoleId))?.label ?? null;
  const view = (row: OrgRedemptionRow) => orgRedemptionView(row, nameOf, labelOf);
  const fx = async (): Promise<DailyRates> => {
    const t = await latestRates(getPool()).catch(() => ({ asOf: null, rates: {} as Record<string, number> }));
    return { rates: t.rates ?? {}, asOf: t.asOf ?? null };
  };
  const holders = () => redemptionKeyHolders().catch(() => [] as string[]);

  /** Everyone who runs the venture, plus whoever asked, minus whoever acted. */
  const ventureSide = async (row: OrgRedemptionRow, actor: string): Promise<string[]> => {
    const ids = new Set(await liveSeatedUserIds(getPool(), row.orgRoleId));
    ids.add(row.requestedBy);
    ids.delete(actor);
    return Array.from(ids);
  };

  // ── The venture's side ───────────────────────────────────────────────────

  app.get("/api/org-redemptions/mine", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first" });
    const pool = getPool();
    const terms = await orgRedemptionTerms(pool, cycleWindow().startsAt, await fx());
    const ventures: Array<{ orgRoleId: string; label: string; history: OrgRedemptionView[]; redeemed: Awaited<ReturnType<typeof redeemedMoney>> }> = [];
    for (const a of await orgsOperatedBy(pool, String(user.id))) {
      ventures.push({
        orgRoleId: a.orgRoleId,
        label: a.label,
        history: await Promise.all((await orgRedemptionsFor(pool, a.orgRoleId, 20)).map(view)),
        redeemed: await redeemedMoney(pool, a.orgRoleId),
      });
    }
    res.json({
      terms,
      ventures,
      tokens: allTokens().filter((t) => ventureRedeemableToken(t.slug)).map((t) => ({ slug: t.slug, name: t.name, decimals: t.decimals })),
      // A HINT for whether to ask for the Treasury queue, never a permission: the queue route runs the gate.
      mayConfirm: user.role === "admin" || user.role === "founder" || (await holders()).includes(String(user.id)),
    });
  });

  app.post("/api/org-redemptions", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first" });
    if (await overLimit(`org-redemption:${user.id}`, 30, 24 * 60 * 60 * 1000)) {
      return res.status(429).json({ error: "You have asked to redeem many times today. Try again tomorrow." });
    }
    const body = req.body ?? {};
    const pool = getPool();
    const out = await requestOrgRedemption(pool, {
      userId: String(user.id),
      orgRoleId: String(body.orgRoleId ?? ""),
      tokenSlug: String(body.token ?? ""),
      amount: Number(body.amount),
      currency: String(body.currency ?? ""),
      payTo: String(body.payTo ?? ""),
      cycleStart: cycleWindow().startsAt,
      fx: await fx(),
    });
    if (!out.ok) return res.status(out.status).json({ error: `${out.error}.` });
    const v = await view(out.row);
    const operators = await liveSeatedUserIds(pool, out.row.orgRoleId);
    const title = `${v.ventureLabel} asks to redeem ${v.credits} ${v.tokenName} for ${v.grossText}`;
    const treasury = (await holders()).filter((id) => !operators.includes(id) && id !== String(user.id));
    if (treasury.length) {
      for (const id of treasury) {
        await notify({ userId: id, type: "venture_redemption", title, link: "/profile#venture-redemptions", dedupeKey: `org-redemption:${out.row.id}:asked:${id}`, actorUserId: String(user.id) });
      }
    } else {
      // Nobody holds the key yet, so the panel hears it. The venture's own people are left off.
      await notifyAdmins("venture_redemption", title, `org-redemption:${out.row.id}:asked`, "/profile#venture-redemptions", [...operators, String(user.id)], { actorUserId: String(user.id) });
    }
    void recordEvent(pool, {
      kind: "audit",
      text: `org-redemption:asked:${out.row.amountUnits}:${out.row.tokenSlug}:${out.row.currency}:${out.row.grossMinor}`,
      actorUserId: String(user.id),
      entityType: "org_role",
      entityRef: out.row.orgRoleId,
      audience: "admin",
    });
    res.status(201).json({ redemption: v });
  });

  app.post("/api/org-redemptions/:id/cancel", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first" });
    const out = await decideOrgRedemption(getPool(), { id: String(req.params.id), to: "cancelled", actorUserId: String(user.id) });
    if (!out.ok) return res.status(out.status).json({ error: `${out.error}.` });
    await tell(out.row, "cancelled", String(user.id));
    res.json({ redemption: await view(out.row) });
  });

  // ── The Treasury's side ──────────────────────────────────────────────────

  app.get("/api/admin/org-redemptions", async (req, res) => {
    if (!(await guardCapability(req, res, "redemption.confirm"))) return;
    const pool = getPool();
    res.json({
      waiting: await Promise.all((await waitingOrgRedemptions(pool)).map(view)),
      decided: await Promise.all((await decidedOrgRedemptions(pool, 20)).map(view)),
      terms: await orgRedemptionTerms(pool, cycleWindow().startsAt, await fx()),
      reconciliation: await orgHoldReconciliation(pool),
    });
  });

  const decide = (to: "confirmed" | "refused") => async (req: any, res: any) => {
    if (!(await guardCapability(req, res, "redemption.confirm"))) return;
    const actor = await authedUser(req);
    if (!actor) return res.status(401).json({ error: "auth_required", message: "Sign in first" });
    const out = await decideOrgRedemption(getPool(), {
      id: String(req.params.id),
      to,
      actorUserId: String(actor.id),
      paymentRef: req.body?.paymentRef == null ? null : String(req.body.paymentRef),
      note: req.body?.note == null ? null : String(req.body.note),
    });
    if (!out.ok) return res.status(out.status).json({ error: `${out.error}.` });
    await tell(out.row, to, String(actor.id));
    res.json({ redemption: await view(out.row) });
  };

  app.post("/api/admin/org-redemptions/:id/confirm", decide("confirmed"));
  app.post("/api/admin/org-redemptions/:id/refuse", decide("refused"));

  /**
   * The venture's people hear how it ended, once each, keyed on the row and
   * the ending. A confirmation says what was agreed and never that the money
   * arrived: the platform is the witness, not the guarantor.
   */
  async function tell(row: OrgRedemptionRow, to: "confirmed" | "refused" | "cancelled", actor: string): Promise<void> {
    const v = await view(row);
    const what = `${v.credits} ${v.tokenName}`;
    const title =
      to === "confirmed"
        ? `The Treasury paid ${v.ventureLabel} ${v.grossText} for ${what}, and those credits are gone`
        : to === "refused"
          ? `The Treasury did not redeem ${what} for ${v.ventureLabel}, and the credits are back in its account`
          : `The redemption of ${what} for ${v.ventureLabel} was cancelled, and the credits are back in its account`;
    const body =
      to === "confirmed"
        ? `Payment reference: ${row.paymentRef ?? ""}. This records that the Treasury says it paid. If the money has not arrived, tell the Treasury.`
        : row.decisionNote;
    for (const id of await ventureSide(row, actor)) {
      await notify({ userId: id, type: "venture_redemption", title, body, link: "/profile#ventures", dedupeKey: `org-redemption:${row.id}:${to}:${id}`, actorUserId: actor });
    }
    void recordEvent(getPool(), {
      kind: "audit",
      text: `org-redemption:${to}:${row.amountUnits}:${row.tokenSlug}:${row.currency}:${row.grossMinor}`,
      actorUserId: actor,
      entityType: "org_role",
      entityRef: row.orgRoleId,
      audience: "admin",
    });
  }
}
