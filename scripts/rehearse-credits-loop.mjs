#!/usr/bin/env node
/**
 * REHEARSE THE CREDITS LOOP on a scratch or staging village, by hand.
 *
 * The lead asked (23 Nov 2026) to be able to run the whole issuance-to-
 * redemption process end to end. `server/creditsLoop.e2e.test.ts` proves it
 * against a throwaway server in CI; this script walks the same steps over HTTP
 * against a village you name, so an admin can watch it happen on a real
 * deployment that is not the live one.
 *
 * WHAT IT DOES, IN ORDER, and every step prints what it saw:
 *
 *   1. Reads the village's identity (`/api/platform/info`) and stops unless you
 *      passed `--confirm <that village's name>`. It MOVES REAL CREDITS on the
 *      village it reaches, so it never runs on a guess.
 *   2. As the admin: lists venture accounts and opens one for `--role` if the
 *      role has none (`--label` names it). The venture is data you pass here.
 *   3. Reads the two venture dials. If members cannot pay venture accounts it
 *      stops, unless `--open-door` is passed, which turns
 *      `ledger.org_accounts_open` on.
 *   4. With `--mint N`: hand mints N whole tokens to the payer, with a reason,
 *      under the village's own per-moon cap. The answer names the cap.
 *   5. As the payer: sends `--amount` whole tokens to the venture through the
 *      ordinary send, with a fresh nonce.
 *   6. As the person seated in the venture's role (optional): reads
 *      `/api/org-accounts/mine` and prints the balance and the last payments.
 *   7. Stops at redemption, which is credits lane 2 and not built yet.
 *
 * SIGN-IN TOKENS COME FROM THE ENVIRONMENT, never the command line, so they
 * stay out of shell history: VILLAGE_ADMIN_TOKEN, VILLAGE_PAYER_TOKEN and,
 * optionally, VILLAGE_RUNNER_TOKEN. Each is the bearer token a sign-in answers
 * with (`POST /api/auth/login`).
 *
 * Usage:
 *   VILLAGE_ADMIN_TOKEN=... VILLAGE_PAYER_TOKEN=... VILLAGE_RUNNER_TOKEN=... \
 *   node scripts/rehearse-credits-loop.mjs --base https://staging.example.org \
 *     --confirm "<village name>" --role <orgRoleId> --token credits \
 *     --amount 5 [--mint 20] [--label "<name members read>"] [--open-door]
 */
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name) => args.includes(name);

const base = String(flag("--base") ?? "").replace(/\/+$/, "");
const confirm = flag("--confirm");
const roleId = flag("--role");
const slug = flag("--token") ?? "credits";
const amount = Number(flag("--amount") ?? 0);
const mint = flag("--mint") === undefined ? 0 : Number(flag("--mint"));
const label = flag("--label");
const adminToken = process.env.VILLAGE_ADMIN_TOKEN ?? "";
const payerToken = process.env.VILLAGE_PAYER_TOKEN ?? "";
const runnerToken = process.env.VILLAGE_RUNNER_TOKEN ?? "";

function stop(message, code = 1) {
  console.log(message);
  process.exit(code);
}

if (!base || !roleId || !(amount > 0)) {
  stop("Usage: see the header of scripts/rehearse-credits-loop.mjs (needs --base, --confirm, --role and --amount).", 2);
}
if (!adminToken || !payerToken) stop("Set VILLAGE_ADMIN_TOKEN and VILLAGE_PAYER_TOKEN in the environment first.", 2);

async function call(method, route, body, token) {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* a non-JSON answer is printed as text */
  }
  return { status: res.status, json, text };
}

function must(step, r, ok = (s) => s === 200) {
  if (!ok(r.status)) stop(`${step} answered ${r.status}: ${r.json?.error ?? r.text.slice(0, 300)}`);
}

// 1. Which village is this?
const info = await call("GET", "/api/platform/info");
must("Reading the village's identity", info);
const name = String(info.json?.name ?? "");
console.log(`1. Village: ${name || "(no name given)"} at ${base}`);
if (!confirm || confirm !== name) {
  stop(`   This moves real credits. Run again with --confirm "${name}" once you are sure this is a scratch or staging village.`);
}

// 2. The venture's account.
const list = await call("GET", "/api/admin/org-accounts", undefined, adminToken);
must("Listing venture accounts", list);
let account = (list.json.accounts ?? []).find((a) => a.orgRoleId === roleId);
if (!account) {
  const opened = await call("POST", "/api/admin/org-accounts", { orgRoleId: roleId, ...(label ? { label } : {}) }, adminToken);
  must("Opening the venture's account", opened);
  account = opened.json.account;
  console.log(`2. Opened an account for ${roleId}: ${account.label} (${account.accountId})`);
} else {
  console.log(`2. ${account.label} already holds an account (${account.accountId})`);
}

// 3. The dials.
console.log(`3. Members can pay venture accounts: ${list.json.open ? "yes" : "no"}. Venture gatherings keep their seat fees: ${list.json.routing ? "yes" : "no"}.`);
if (!list.json.open) {
  if (!has("--open-door")) stop("   Members cannot pay venture accounts yet. Pass --open-door to turn ledger.org_accounts_open on, or turn it on in Admin.");
  const opened = await call("PUT", "/api/admin/variables/ledger.org_accounts_open", { value: "true" }, adminToken);
  must("Turning ledger.org_accounts_open on", opened);
  console.log("   Turned ledger.org_accounts_open on.");
}

// 4. Issuance, under the village's own cap.
const me = await call("GET", "/api/profile", undefined, payerToken);
must("Reading the payer's account", me);
const payerId = String(me.json?.id ?? "");
if (mint > 0) {
  const minted = await call("POST", `/api/admin/tokens/${encodeURIComponent(slug)}/mint`, { toUserId: payerId, amount: mint, reason: "Credits loop rehearsal" }, adminToken);
  must(`Minting ${mint} ${slug} to the payer`, minted);
  console.log(`4. Minted ${mint} ${slug} to the payer. This moon's cap is ${minted.json?.cap}, ${minted.json?.remaining} left.`);
} else {
  console.log("4. No mint asked for (--mint N to issue to the payer first).");
}

// 5. The payment, through the ordinary send.
const wallet = await call("GET", "/api/wallet", undefined, payerToken);
must("Reading the payer's wallet", wallet);
const decimals = Number(wallet.json?.tokenDecimals?.[slug] ?? 0);
const minor = Math.round(amount * 10 ** decimals);
const paid = await call("POST", "/api/wallet/send", { toOrg: roleId, tokenType: slug, amount: minor, note: "Credits loop rehearsal", clientNonce: randomUUID() }, payerToken);
must(`Paying ${amount} ${slug} to the venture`, paid);
console.log(`5. The payer sent ${amount} ${paid.json.tokenName} to ${paid.json.to}.`);

// 6. What the person who runs the venture sees.
if (runnerToken) {
  const mine = await call("GET", "/api/org-accounts/mine", undefined, runnerToken);
  must("Reading the runner's ventures", mine);
  const row = (mine.json.accounts ?? []).find((a) => a.account.orgRoleId === roleId);
  if (!row) {
    console.log("6. That member is not seated in the venture's role, so they see no account.");
  } else {
    const held = Number(row.account.balances?.[slug] ?? 0) / 10 ** Number(row.account.decimals?.[slug] ?? 0);
    console.log(`6. ${row.account.label} holds ${held} ${row.account.tokenNames?.[slug] ?? slug}. Last payments:`);
    for (const h of row.history.slice(0, 5)) {
      console.log(`   ${h.at}  ${h.amount / 10 ** h.decimals} ${h.tokenName}  ${h.withName ?? h.source}${h.description ? `: ${h.description}` : ""}`);
    }
  }
} else {
  console.log("6. No VILLAGE_RUNNER_TOKEN, so the venture's own view was not read.");
}

console.log("7. Stop: the venture redeeming is credits lane 2 and is not built yet.");
