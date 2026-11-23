/**
 * A VENTURE'S CREDIT ACCOUNT (0419), the shapes both ends agree on.
 *
 * The lead's decision of 23 Nov 2026: members spend credits, and only
 * ventures redeem them. So a venture holds credits in an account of its own on
 * the ledger, `org:<orgRoleId>`, tied to the venture's role in the org chart.
 * The people seated in that role run the venture, and they are the ones who
 * see what it holds.
 *
 * Nothing here posts and nothing here reads a row. The ledger work lives in
 * server/lib/orgAccounts.ts, the SQL in server/repos/orgAccounts.ts, and the
 * doors in server/routes/orgAccounts.ts. This file holds the account's one
 * spelling, the dial keys, and the payloads the routes answer with, so the
 * pay page and the floating button (credits lanes 3 and 4) can type against
 * them without importing server code.
 */

/** Every venture account id starts with this. `ledger_accounts.kind` is `ORG_ACCOUNT_KIND`. */
export const ORG_ACCOUNT_PREFIX = "org:";

/** `ledger_accounts.kind` for a venture account. varchar(16) in 0009. */
export const ORG_ACCOUNT_KIND = "org";

/** `ledger_accounts.id` is varchar(80) and `org_roles.id` varchar(64), so the worst case is 68. */
export const MAX_ORG_ACCOUNT_ID = 80;

/** The ledger `source` a member's payment to a venture is written under. */
export const ORG_SEND_SOURCE = "org_send";

/**
 * The two dials, both off when a village is born.
 *
 *   OPEN     members may pay a venture's account, and the people who run a
 *            venture see its balance and history. Admins can open accounts
 *            and read them while it is off, so a village can set one up
 *            before it switches the door on.
 *   ROUTING  a seat fee for a gathering a venture runs is kept by that
 *            venture's account instead of the village treasury, once the
 *            gathering is held.
 */
export const ORG_ACCOUNTS_OPEN_KEY = "ledger.org_accounts_open";
export const ORG_SERVICE_ROUTING_KEY = "ledger.org_service_routing";

/** The kinds of priced service a venture can own. One today: a gathering with a seat fee. */
export const ORG_SERVICE_KINDS = ["event"] as const;
export type OrgServiceKind = (typeof ORG_SERVICE_KINDS)[number];

export function isOrgServiceKind(v: unknown): v is OrgServiceKind {
  return typeof v === "string" && (ORG_SERVICE_KINDS as readonly string[]).includes(v);
}

/** Why this org role cannot hold an account id, in words, or null. */
export function orgAccountIdProblem(orgRoleId: string): string | null {
  const id = String(orgRoleId ?? "");
  if (!id.trim()) return "A venture account belongs to a role. Choose the venture's role first.";
  if (ORG_ACCOUNT_PREFIX.length + id.length > MAX_ORG_ACCOUNT_ID) {
    return `The role id ${JSON.stringify(id.slice(0, 40))} is too long for a ledger account.`;
  }
  return null;
}

/** The one spelling of a venture's account. Throws before it would truncate. */
export function orgAccountId(orgRoleId: string): string {
  const problem = orgAccountIdProblem(orgRoleId);
  if (problem) throw new Error(problem);
  return `${ORG_ACCOUNT_PREFIX}${orgRoleId}`;
}

/** The org role an account belongs to, or null when it is no venture account. */
export function orgRoleIdFromAccount(accountId: string | null | undefined): string | null {
  const raw = String(accountId ?? "");
  if (!raw.startsWith(ORG_ACCOUNT_PREFIX)) return null;
  const id = raw.slice(ORG_ACCOUNT_PREFIX.length);
  return id.length > 0 ? id : null;
}

/** One venture account, as the routes answer it. Balances are MINOR units per token slug. */
export interface OrgAccountView {
  orgRoleId: string;
  accountId: string;
  /** The name the village reads. */
  label: string;
  /** The venture role's own name, when the role still exists. */
  roleName: string | null;
  openedAt: string;
  /** MINOR units, keyed by token slug. Recomputed by the ledger, read from its cache. */
  balances: Record<string, number>;
  /** Decimals per token slug in `balances`, so a reader divides once at the render site. */
  decimals: Record<string, number>;
  /** The village's word for each token in `balances`. */
  tokenNames: Record<string, string>;
}

/** What a member paying a venture needs: who it is, nothing about what it holds. */
export interface OrgPayee {
  orgRoleId: string;
  label: string;
}

/** One line of a venture account's history, signed from the venture's side, MINOR units. */
export interface OrgAccountEntry {
  id: string;
  tokenType: string;
  tokenName: string;
  decimals: number;
  /** Positive when the venture received, negative when it paid out. */
  amount: number;
  source: string;
  description: string | null;
  at: string;
  /** The member on the other side of a payment, when there is one and they still have an account. */
  withName: string | null;
}

/** A priced service a venture runs. */
export interface OrgServiceLink {
  kind: OrgServiceKind;
  id: string;
  orgRoleId: string;
  /** The service's own title, when it still exists. */
  title: string | null;
}
