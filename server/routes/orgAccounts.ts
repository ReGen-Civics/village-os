/**
 * THE DOORS TO A VENTURE'S CREDIT ACCOUNT (0419, credits lane 1).
 *
 *   GET    /api/admin/org-accounts                               every account, and the roles that could hold one
 *   POST   /api/admin/org-accounts                               open an account for a venture role
 *   GET    /api/admin/org-accounts/:orgRoleId                    one account, its history and its gatherings
 *   PUT    /api/admin/org-accounts/:orgRoleId                    rename what the village reads
 *   POST   /api/admin/org-accounts/:orgRoleId/services           say the venture runs a gathering
 *   DELETE /api/admin/org-accounts/:orgRoleId/services/:kind/:id take it off again
 *   GET    /api/org-accounts                                     the ventures a member may pay, names only
 *   GET    /api/org-accounts/mine                                the ventures this member runs, with balance and history
 *   POST   /api/wallet/send  { toOrg }                           a member pays a venture (server/index.ts hands it here)
 *
 * WHO. The admin doors ask the one gate for `operator.config`, which an admin
 * passes until the village gives the power to a role. The two member reads
 * answer a member about themselves: the venture accounts they run, by being
 * seated in the venture's role in the org chart, which is the same kind of
 * answer as a member reading their own wallet. They grant nothing and gate
 * nothing beyond what the reader already is.
 *
 * WHAT IS OFF. `ledger.org_accounts_open` ships off. While it is off the
 * member reads answer empty and a payment is refused, and the admin doors work,
 * so a village can open its first venture account before switching the door on.
 *
 * NO VILLAGE IS NAMED. Which venture gets the first account is data a village
 * enters here, never a constant.
 */
import type { Express, Request, Response } from "express";
import type { AppDeps } from "../lib/appDeps";
import type { Capability } from "../../shared/capabilities";
import { isOrgServiceKind, type OrgAccountView } from "../../shared/orgAccounts";
import {
  linkOrgService,
  listOrgAccountViews,
  openOrgAccount,
  orgAccountView,
  orgAccountsOpen,
  orgHistory,
  orgPayees,
  orgServiceRoutingOn,
  orgServices,
  orgsOperatedBy,
  renameOrgAccount,
  sendToOrg,
  unlinkOrgService,
} from "../lib/orgAccounts";
import { liveSeatedRoleIds, liveSeatedUserIds, pricedGatheringRows } from "../repos/orgAccounts";
import { recordEvent } from "../lib/events";
import { tokenDef } from "../lib/ledger";
import { fromLedgerUnits } from "../lib/economy";

/**
 * `operator.config`, "Keep the village's settings that have no power of their
 * own". Opening a venture's account and saying which gatherings it runs move
 * no value: the money doors (redemption, lane 2) carry their own powers. So
 * this reuses the settings power instead of adding a key, which would change
 * the set of powers a village takes at launch, a count the lead rules on.
 */
const ORG_ACCOUNT: Capability = "operator.config";

export type OrgAccountDeps = Pick<AppDeps, "getPool" | "authedUser" | "guardCapability" | "adminActor" | "members" | "notify"> & {
  /** Live, real org roles, for the "open an account for" picker. */
  orgRoles(): Promise<Array<{ id: string; name: string; active?: boolean; isExample?: boolean; futureVenture?: boolean }>>;
};

/** What `POST /api/wallet/send` calls when the body names a venture. */
export type OrgSendHandler = (req: Request, res: Response, user: { id: string; name?: string | null }) => Promise<unknown>;

export function register(app: Express, deps: OrgAccountDeps): OrgSendHandler {
  const { getPool, authedUser, guardCapability, adminActor, members } = deps;
  const nameOf = async (id: string): Promise<string | null> => (await members.byId(id))?.name ?? null;

  // ── Admin ────────────────────────────────────────────────────────────────

  app.get("/api/admin/org-accounts", async (req, res) => {
    if (!(await guardCapability(req, res, ORG_ACCOUNT))) return;
    const accounts = await listOrgAccountViews(getPool());
    const held = new Set(accounts.map((a) => a.orgRoleId));
    const roles = (await deps.orgRoles())
      .filter((r) => r.active !== false && r.isExample !== true && !held.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, futureVenture: r.futureVenture === true }));
    res.json({ accounts, roles, open: orgAccountsOpen(), routing: orgServiceRoutingOn() });
  });

  app.post("/api/admin/org-accounts", async (req, res) => {
    if (!(await guardCapability(req, res, ORG_ACCOUNT))) return;
    const actor = adminActor(req)?.id ?? (await authedUser(req))?.id ?? null;
    const r = await openOrgAccount(getPool(), {
      orgRoleId: String(req.body?.orgRoleId ?? ""),
      label: req.body?.label == null ? null : String(req.body.label),
      openedBy: actor,
    });
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    if (!r.existed) {
      void recordEvent(getPool(), {
        kind: "audit",
        text: `org-account:opened ${r.account.orgRoleId}`,
        actorUserId: actor,
        entityType: "org_role",
        entityRef: r.account.orgRoleId,
        audience: "admin",
      });
    }
    res.json({ success: true, existed: r.existed, account: await orgAccountView(getPool(), r.account.orgRoleId) });
  });

  app.get("/api/admin/org-accounts/:orgRoleId", async (req, res) => {
    if (!(await guardCapability(req, res, ORG_ACCOUNT))) return;
    const view = await orgAccountView(getPool(), req.params.orgRoleId);
    if (!view) return res.status(404).json({ error: "That venture has no account." });
    res.json({
      account: view,
      history: await orgHistory(getPool(), view.orgRoleId, nameOf),
      services: await orgServices(getPool(), view.orgRoleId),
      operators: await operatorNames(view.orgRoleId),
      // The gatherings that ask a seat fee, for the "this venture runs" picker.
      gatherings: await pricedGatheringRows(getPool()),
    });
  });

  app.put("/api/admin/org-accounts/:orgRoleId", async (req, res) => {
    if (!(await guardCapability(req, res, ORG_ACCOUNT))) return;
    const label = String(req.body?.label ?? "").trim();
    if (!label) return res.status(400).json({ error: "Give the account a name." });
    const ok = await renameOrgAccount(getPool(), req.params.orgRoleId, label);
    if (!ok) return res.status(404).json({ error: "That venture has no account." });
    res.json({ success: true, account: await orgAccountView(getPool(), req.params.orgRoleId) });
  });

  app.post("/api/admin/org-accounts/:orgRoleId/services", async (req, res) => {
    if (!(await guardCapability(req, res, ORG_ACCOUNT))) return;
    const kind = req.body?.kind ?? "event";
    if (!isOrgServiceKind(kind)) return res.status(400).json({ error: "A venture can run a gathering. That is the one kind of service there is." });
    const actor = adminActor(req)?.id ?? (await authedUser(req))?.id ?? null;
    const r = await linkOrgService(getPool(), { orgRoleId: req.params.orgRoleId, kind, id: String(req.body?.id ?? ""), setBy: actor });
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    res.json({ success: true, services: await orgServices(getPool(), req.params.orgRoleId) });
  });

  app.delete("/api/admin/org-accounts/:orgRoleId/services/:kind/:id", async (req, res) => {
    if (!(await guardCapability(req, res, ORG_ACCOUNT))) return;
    if (!isOrgServiceKind(req.params.kind)) return res.status(400).json({ error: "Unknown kind of service." });
    const ok = await unlinkOrgService(getPool(), { orgRoleId: req.params.orgRoleId, kind: req.params.kind, id: req.params.id });
    if (!ok) return res.status(404).json({ error: "That venture does not run that gathering." });
    res.json({ success: true, services: await orgServices(getPool(), req.params.orgRoleId) });
  });

  // ── Members ──────────────────────────────────────────────────────────────

  app.get("/api/org-accounts", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first" });
    if (!orgAccountsOpen()) return res.json({ open: false, payees: [] });
    // A member never pays a venture they run (server/lib/orgAccounts.ts), so those are left off the list.
    const mine = new Set(await liveSeatedRoleIds(getPool(), String(user.id)));
    res.json({ open: true, payees: (await orgPayees(getPool())).filter((p) => !mine.has(p.orgRoleId)) });
  });

  app.get("/api/org-accounts/mine", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first" });
    if (!orgAccountsOpen()) return res.json({ open: false, accounts: [] });
    const rows = await orgsOperatedBy(getPool(), String(user.id));
    const accounts: Array<{ account: OrgAccountView; history: Awaited<ReturnType<typeof orgHistory>> }> = [];
    for (const row of rows) {
      const view = await orgAccountView(getPool(), row.orgRoleId);
      if (view) accounts.push({ account: view, history: await orgHistory(getPool(), row.orgRoleId, nameOf, 50) });
    }
    res.json({ open: true, accounts });
  });

  async function operatorNames(orgRoleId: string): Promise<string[]> {
    const names = await Promise.all((await liveSeatedUserIds(getPool(), orgRoleId)).map(nameOf));
    return names.filter((n): n is string => !!n);
  }

  // ── The send, handed over by POST /api/wallet/send ───────────────────────

  return async (req, res, user) => {
    const { toOrg, tokenType, amount, note } = req.body ?? {};
    const r = await sendToOrg(getPool(), {
      fromUserId: String(user.id),
      orgRoleId: String(toOrg ?? ""),
      tokenType: String(tokenType ?? ""),
      amountMinor: Number(amount),
      note: note == null ? null : String(note),
      nonce: String(req.body?.clientNonce ?? ""),
    });
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    if (!r.duplicate) {
      const slug = String(tokenType);
      const words = `${fromLedgerUnits(slug, r.sent)} ${tokenDef(slug)?.name ?? slug}`;
      const nonce = String(req.body?.clientNonce ?? "").trim().slice(0, 64);
      // The people who run the venture hear about it once per payment, keyed on the payment.
      if (nonce) {
        for (const id of await liveSeatedUserIds(getPool(), String(toOrg))) {
          if (id === String(user.id)) continue;
          await deps.notify({
            userId: id,
            type: "wallet",
            title: `${user.name ?? "A member"} paid ${r.to} ${words}`,
            body: note ? String(note).slice(0, 180) : undefined,
            link: "/profile",
            dedupeKey: `org-send:${user.id}:${nonce}:${id}`,
            actorUserId: String(user.id),
          });
        }
      }
      void recordEvent(getPool(), {
        kind: "org_send",
        text: `paid ${words} to a venture`,
        actorUserId: String(user.id),
        entityType: "org_role",
        entityRef: String(toOrg),
        audience: "admin",
      });
    }
    res.json({ success: true, duplicate: r.duplicate, sent: r.sent, tokenName: r.tokenName, to: r.to, balance: r.balance, balanceDecimals: r.balanceDecimals });
  };
}
