/**
 * THE STORE: money. Tokens and the mint, the ledger, cash to pay out and the End of Moon settings, the cash
 * budget, closing a cycle, products, departures and the economy's rules.
 *
 * Each row's power is what its own handler asks (read on 27 Nov 2026). Every money act stays a person's press: the
 * class of each row is computed from the person-only lists, and none of these rows carries wording made up here
 * about what the money does. The consequence line is the catalog's, or it is empty.
 */
import { DELETE, PATCH, POST, PUT, bool, date, list, long, num, person, text, inPlace } from "./types";

/** The cash budget's section of the Treasury page. The same address as the search entry `page.budget` (shared/adminSearch.ts). */
const CASH_BUDGET = "/governance/treasury#cash-budget";

export const STORE_ACTS = inPlace("store", [
  // ── Tokens and the mint ──────────────────────────────────────────────────
  {
    id: "store.tokens.add", tab: "tokens", power: "admin", holder: "exchange.manage",
    title: "Add a token",
    help: "Create a token the village uses, with its name, its kind and whether members may pass it on.",
    synonyms: ["new token", "create token", "currency", "coin"],
    route: POST("/api/admin/tokens"),
    fields: [text("slug", "Short name"), text("name", "Name"), text("kind", "Kind"), bool("transferable", "Members may pass it on")],
  },
  {
    id: "store.tokens.edit", tab: "tokens", power: "admin", holder: "exchange.manage",
    title: "Change a token",
    help: "Change a token's name and words, or stop it being used.",
    synonyms: ["edit token", "rename token", "retire token"],
    route: PUT("/api/admin/tokens/:slug"),
    fields: [text("name", "Name"), long("description", "About it"), bool("active", "In use"), bool("transferable", "Members may pass it on")],
  },
  {
    id: "store.mint.mint", tab: "tokens", power: "token.mint",
    title: "Mint a token to a member",
    help: "Issue an amount of a token to one member, with the reason kept on the record.",
    synonyms: ["mint", "issue tokens", "mint desk", "hand mint", "give tokens"],
    route: POST("/api/admin/tokens/:slug/mint"),
    fields: [person("toUserId", "To"), num("amount", "Amount"), long("reason", "Reason")],
  },
  {
    id: "store.mint.approve", tab: "tokens", power: "token.mint",
    title: "Give the second signature on a mint",
    help: "Approve a mint that waits for a second signer.",
    synonyms: ["approve mint", "second signer", "co-sign mint", "mint request"],
    route: POST("/api/admin/mint-requests/:id/approve"),
  },
  {
    id: "store.mint.decline", tab: "tokens", power: "admin", holder: "token.mint",
    title: "Decline a mint that waits",
    help: "Refuse a mint that waits for a second signer, with the reason.",
    synonyms: ["decline mint", "refuse mint"],
    route: POST("/api/admin/mint-requests/:id/decline"),
    fields: [long("reason", "Reason")],
  },
  {
    id: "store.token-jobs.read", tab: "tokens", power: "admin",
    title: "Token jobs",
    help: "The scheduled work that moves tokens, and how each run went.",
    synonyms: ["token jobs", "scheduled jobs", "background work"],
  },
  {
    id: "store.org-accounts.open", tab: "tokens", power: "operator.config",
    title: "Open an account for a role",
    help: "Give a role an account of its own that holds tokens.",
    synonyms: ["org account", "role account", "circle account"],
    route: POST("/api/admin/org-accounts"),
    fields: [text("orgRoleId", "The role"), text("label", "Name")],
  },
  {
    id: "store.org-accounts.rename", tab: "tokens", power: "operator.config",
    title: "Rename a role's account",
    help: "Change the name on a role's account.",
    synonyms: ["rename org account"],
    route: PUT("/api/admin/org-accounts/:orgRoleId"),
    fields: [text("label", "Name")],
  },

  // ── The ledger and cash ──────────────────────────────────────────────────
  {
    id: "store.ledger.read", tab: "ledger", power: "admin",
    title: "Read the ledger",
    help: "Where value moved, and whether every token still sums to zero.",
    synonyms: ["ledger", "reconciliation", "balances", "transfers", "audit"],
  },
  {
    id: "store.cash.mark-paid", tab: "cash-payouts", power: "cash.pay",
    title: "Mark cash as paid",
    help: "Record that money the village owed a member has gone out, with a note.",
    synonyms: ["mark paid", "pay out", "cash owed", "payout", "bank transfer"],
    route: POST("/api/cash-owed/:id/paid"),
    fields: [long("note", "Note")],
  },
  {
    id: "store.cash.record-transfer", tab: "cash-payouts", power: "cash.pay",
    title: "Record a bank transfer",
    help: "Record one transfer that paid several of the amounts owed, with its date.",
    synonyms: ["bank transfer", "batch payment", "record transfer"],
    route: POST("/api/cash-owed/transfers"),
    fields: [date("transferDate", "Date of the transfer")],
    partial: true,
  },
  {
    id: "store.cash.export", tab: "cash-payouts", power: "cash.pay",
    title: "Download the cash owed",
    help: "A spreadsheet of what the village owes, for the bank.",
    synonyms: ["export cash", "csv", "payout list"],
    route: { method: "GET", path: "/api/cash-owed/export.csv" },
  },
  {
    id: "store.cash.invoices", parity: ["A52", "H5"], path: "/governance/treasury#desks", power: "cash.pay",
    title: "Invoices",
    help: "Each member's invoice for the moon, and where it stands.",
    synonyms: ["invoices", "invoice track", "end of moon invoice"],
  },
  {
    id: "store.moon.settings", parity: ["A52", "H5"], path: "/governance/treasury#desks", power: "cash.pay",
    title: "Change the End of Moon settings",
    help: "How the end-of-moon review runs: who is asked, and what an invoice needs.",
    synonyms: ["end of moon", "moon review", "moon settings", "recap settings"],
    route: PUT("/api/moon-review/settings"),
    partial: true,
  },
  {
    id: "store.moon.payers", parity: ["A52", "H5"], path: "/governance/treasury#desks", power: "cash.pay",
    title: "Set who pays",
    help: "The payers an invoice can be made out to.",
    synonyms: ["payers", "who pays", "paying entity"],
    route: PUT("/api/moon-review/payers"),
    partial: true,
  },
  {
    id: "store.moon.rhythm", parity: ["A52", "H5"], path: "/governance/treasury#desks", power: "cash.pay",
    title: "Move the moon's days",
    help: "The days of each moon's review, the hour its email goes, and the link to its guide.",
    synonyms: ["moon rhythm", "moon days", "review dates", "send hour"],
    route: PUT("/api/moon-review/rhythm"),
    partial: true,
  },

  // ── The cash budget ──────────────────────────────────────────────────────
  {
    id: "store.budget.import", path: CASH_BUDGET, parity: ["A54"], power: "role.pay",
    title: "Upload the cash budget",
    help: "Bring in the budget's lines from a sheet, with where it came from.",
    synonyms: ["budget", "upload budget", "import budget", "cash budget"],
    route: POST("/api/admin/budgets/import"),
    fields: [list("lines", "The budget's lines"), text("scope", "What it covers"), text("sourceLabel", "Where it came from"), text("sourceLink", "Link to the sheet")],
  },
  {
    id: "store.budget.add-line", path: CASH_BUDGET, parity: ["A54"], power: "role.pay",
    title: "Add a line to the cash budget",
    help: "Add one line of planned cash.",
    synonyms: ["budget line", "add line"],
    route: POST("/api/admin/budgets/lines"),
    fields: [list("line", "The line")],
  },
  {
    id: "store.budget.edit-line", path: CASH_BUDGET, parity: ["A54"], power: "role.pay",
    title: "Change a line of the cash budget",
    help: "Change one line of planned cash.",
    synonyms: ["edit budget line"],
    route: PATCH("/api/admin/budgets/lines/:id"),
    fields: [list("changes", "What changes")],
  },
  {
    id: "store.budget.withdraw-line", path: CASH_BUDGET, parity: ["A54"], power: "role.pay",
    title: "Withdraw a line of the cash budget",
    help: "Take a line out of the budget. It can be restored.",
    synonyms: ["withdraw line", "remove budget line"],
    route: POST("/api/admin/budgets/lines/:id/withdraw"),
  },
  {
    id: "store.budget.restore-line", path: CASH_BUDGET, parity: ["A54"], power: "role.pay",
    title: "Restore a withdrawn line of the cash budget",
    help: "Put a withdrawn line back.",
    synonyms: ["restore line"],
    route: POST("/api/admin/budgets/lines/:id/restore"),
  },

  // ── Cycle close ──────────────────────────────────────────────────────────
  {
    id: "store.cycles.close", tab: "cycles", power: "admin", holder: "operator.config",
    title: "Close the cycle",
    help: "Close the gratitude cycle that is waiting. Closing releases value, which is why a person does it.",
    synonyms: ["cycle close", "close the cycle", "settle", "moon close", "release value"],
    route: POST("/api/admin/cycles/close"),
  },
  {
    id: "store.cycles.settlement-proposal", tab: "cycles", power: "admin", holder: "operator.config",
    title: "Ask the village to settle the moon",
    help: "Freeze the moon's split and open the vote that settles it.",
    synonyms: ["settlement proposal", "settle the moon", "open settlement vote"],
    route: POST("/api/admin/cycles/settlement-proposal"),
  },
  {
    id: "store.cycles.land-due", tab: "cycles", power: "admin", holder: "operator.recover",
    title: "Land the decisions that are due",
    help: "Apply the carried decisions whose waiting time has passed.",
    synonyms: ["land decisions", "due decisions", "apply votes"],
    route: POST("/api/admin/governance/land-due"),
  },

  // ── Products ─────────────────────────────────────────────────────────────
  {
    id: "store.products.add", tab: "products", power: "admin", holder: "exchange.manage",
    title: "Add a product",
    help: "Something the village sells for money, with its price.",
    synonyms: ["product", "sell", "membership dues", "price"],
    route: POST("/api/admin/products"),
    partial: true,
  },
  {
    id: "store.products.edit", tab: "products", power: "admin", holder: "exchange.manage",
    title: "Change a product",
    help: "Change a product's words, its order, or stop selling it.",
    synonyms: ["edit product", "stop selling"],
    route: PUT("/api/admin/products/:id"),
    fields: [bool("active", "On sale"), long("description", "About it"), num("sortOrder", "Order")],
  },
  {
    id: "store.products.confirm-purchase", tab: "products", power: "admin", holder: "exchange.manage",
    title: "Confirm a purchase paid outside the site",
    help: "Record that a purchase waiting on a payment by hand was paid.",
    synonyms: ["confirm purchase", "paid by hand", "manual payment"],
    route: POST("/api/admin/products/purchases/:id/confirm"),
  },

  // ── Departures ───────────────────────────────────────────────────────────
  {
    id: "store.exits.open", tab: "exits-admin", power: "admin", holder: "operator.accounts",
    title: "Open a departure",
    help: "Start the leaving of a member, with the kind of departure and a note.",
    synonyms: ["departure", "member leaving", "exit", "offboard"],
    route: POST("/api/admin/exits"),
    fields: [person("userId", "Who"), text("kind", "Kind of departure"), long("note", "Note")],
  },
  {
    id: "store.exits.settle", tab: "exits-admin", power: "admin", holder: "operator.accounts",
    title: "Settle a departing member's balances",
    help: "Settle what a departing member holds, under the village's exit policy.",
    synonyms: ["settle balances", "exit settlement"],
    route: POST("/api/admin/exits/:id/settle-balances"),
  },
  {
    id: "store.exits.resolve", tab: "exits-admin", power: "admin", holder: "operator.accounts",
    title: "Close a departure",
    help: "Mark a departure as finished, with the reference of the agreement.",
    synonyms: ["resolve exit", "finish departure"],
    route: POST("/api/admin/exits/:id/resolve"),
    fields: [text("agreementRef", "Agreement reference")],
  },
  {
    id: "store.exits.cancel", tab: "exits-admin", power: "admin", holder: "operator.accounts",
    title: "Cancel a departure",
    help: "Call off a departure that was opened.",
    synonyms: ["cancel exit", "they are staying"],
    route: POST("/api/admin/exits/:id/cancel"),
  },
  {
    id: "store.exits.policy", tab: "exits-admin", power: "admin", holder: "operator.accounts",
    title: "Change the exit policy",
    help: "What happens to a member's share when they leave.",
    synonyms: ["exit policy", "leaving policy", "what happens when someone leaves"],
    route: PUT("/api/admin/exit-policy"),
    partial: true,
  },

  // ── Settings and the economy ─────────────────────────────────────────────
  {
    id: "store.settings.save", tab: "settings", power: "admin", holder: "operator.config",
    title: "Change the money settings",
    help: "Dues, fees and the land figures the pages show.",
    synonyms: ["dues", "fees", "land figures", "money settings", "membership price"],
    route: PUT("/api/admin/settings"),
    partial: true,
  },
  {
    id: "store.economy.rule", parity: ["B9"], path: "/admin/mint", power: "admin", holder: "exchange.manage",
    title: "Change an economy rule",
    help: "What one rule of the economy pays, its ceiling, and whether it is on.",
    synonyms: ["economy rules", "issuance rule", "reward amount", "ceiling"],
    route: PATCH("/api/admin/economy/rules/:id"),
    fields: [num("amount", "Amount"), num("ceiling", "Ceiling"), bool("enabled", "On")],
  },
  {
    id: "store.economy.read", parity: ["B11"], path: "/admin/mint", power: "admin",
    title: "Supply and settlement preview",
    help: "How much of each token exists, and what the next settlement would release.",
    synonyms: ["supply", "settlement preview", "economy", "issued so far"],
  },
  {
    id: "store.economics.read", parity: ["C5", "E7"], path: "/journey-to-launch", power: "admin",
    title: "Village economics",
    help: "The village's economics in one view: what comes in, what goes out and what is held.",
    synonyms: ["economics", "village economics", "money in and out"],
  },
]);
