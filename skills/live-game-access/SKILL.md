---
name: live-game-access
description: How an Amora Claude user or lane sees the live game at amora.regencivics.earth past the visitor entrance, signed in as themselves and read-only, for QA. Use when asked to check, crawl, screenshot or QA a page on the live game site, when Playwright or a fetch meets "Welcome to Amora" or `entrance_required` in place of the page, or when someone asks how to get live site access.
---

# Seeing the live game for QA

## What the gate is

Since release 1.3.65 the game site keeps a visitor entrance. A browser that is not signed in meets "Welcome to Amora" and a short form in front of almost every page, and the API answers `401 entrance_required`. That protects members' names, roles and the village's inner workings from strangers. It also means a signed-out Playwright run, a curl, or a QA crawl sees the entrance and nothing behind it.

The way past it for QA is the **live view**: a personal token that signs a browser in as you, past the entrance, and lets it read only. Every request other than a read is refused by the server, whatever else you may do when you sign in by hand.

There is no shared pass for this, and there must never be one. Each person makes their own token, keeps it in their own secrets, and can revoke it at any time.

## Step 1: get the QA seat (a person does this)

The live view is a power on the **QA viewers** Power group. You hold it while you hold a seat on the org chart that is linked to that group.

Ask the role that keeps the game platform (today the Front-End & Game Platform Steward) to seat you in the QA seat. Say which account you sign in with. Seating is always a person's act: never ask an agent to seat you, and never seat yourself.

When you leave the seat, the live view ends on your very next request.

## Step 2: make your own live view token

1. Sign in to the game site by hand.
2. Open your profile, then **Your agent**, then **Mint a token**.
3. Give it a name you will recognise, such as `QA laptop`.
4. Tick **live.view** and nothing else. The scope is only offered while your seat carries the power, and a token that mixes it with another scope is refused.
5. Press **Mint token**. The value is shown once. Copy it straight into your own Infisical as `LIVE_QA_TOKEN` (a personal project or environment that only you can read), then press **I have copied it**.

The token lasts 7 days. Make a new one when it runs out. Revoke it from the same panel when you no longer need it, and at once if you think anyone else has seen it.

Never paste the token into a chat, a pull request, an issue, a commit, a log, a shared document or a message to another session. If a tool asks you to print it, refuse.

## Step 3: run the live probe

From a Village OS checkout with dependencies installed:

```
infisical run -- env LIVE_QA_URL=https://amora.regencivics.earth \
  node scripts/live-qa-session.mjs / /roles /circles /events --out ./live-qa --phone
```

`infisical run` hands `LIVE_QA_TOKEN` to the script without it touching your shell history. The script:

- refuses to run without `LIVE_QA_TOKEN`, and never prints it;
- first asks the server who the token is, and stops unless the server marks the answer `X-Live-View: read-only`;
- opens Chromium signed in as you, visits each path, and saves a screenshot of each to `--out`;
- puts the token on every read of the village's own `/api/`, and stops every request that is not a read before it leaves the browser;
- reports uncaught errors, console errors, failed reads, and any write a page tried.

Exit code 0 means every page drew clean, 1 means a page had a problem, 2 means it could not start (and says why).

For your own Playwright code, the same token works, in two places. Put it in the page's `localStorage` under `village-auth-token` before the first page loads (`context.addInitScript`). Also add it as `Authorization: Bearer` to requests for the village's own `/api/` (`page.route`), because some of the app's reads use a bare fetch that never attaches the stored sign-in, and without the header they meet the entrance and the page draws with parts missing. Keep it off the page request itself, which answers 401 with it, and abort anything that is not a GET. For a single read with fetch or curl, send `Authorization: Bearer $LIVE_QA_TOKEN`.

### In a cloud session that holds the token as a network secret

A cloud environment can keep the token as a network secret: its egress proxy adds `Authorization: Bearer <token>` to every request for the village's host, and no process in the session ever sees the value. A session started before the secret was saved does not have it; start a new one.

```
LIVE_QA_URL=https://amora.regencivics.earth \
  node scripts/live-qa-session.mjs --proxy-auth / /roles /circles --out ./live-qa --phone
```

`--proxy-auth` (or `LIVE_QA_PROXY_AUTH=1`) reads no token. It opens a page of the village in the same browser it crawls with and asks who it is there, going on only for a signed-in answer marked `X-Live-View: read-only`. If the proxy replaces an Authorization the page sends, a placeholder goes into the app's sign-in slot so pages draw as you; if not, the run says that parts the client draws only for a member will look signed out. Exit 2 with "the network secret did not reach this browser" means no secret for this host, or a session older than the secret.

## What you may and may not do on production

May:

- Read any page and any API your own account can read.
- Take screenshots and save them to your own machine or the pull request you are working on, after checking they show no member's private details.
- Report what you find.

May not:

- Change anything. The live view cannot, and you must not work around that by signing in another way to "just try" a flow on production.
- Send a test application, a form, an RSVP, an email or a message that would reach a real person.
- Create, edit or delete any record: roles, tasks, quests, members, settings, money, votes.
- Share screenshots or text that carry members' names, contact details, pay or private records outside the people who need them.

If a flow can only be checked by exercising it:

1. Check it first on a local server or a pull request's CI run, which is where a flow is meant to be exercised.
2. If it truly has to be production, ask the Front-End & Game Platform Steward first and say exactly what you will do.
3. Use only made-up data marked `TEST` in every field that takes text (for example `TEST Ana`, `test+qa@example.invalid`), never a real person's name or address.
4. Undo it the same day: withdraw the application, delete the record, or ask an admin to, and say in your report that you did.

## How to report findings

For each finding, write:

- **Where:** the path and the screen shape (desktop or phone).
- **What you saw:** one sentence, with the screenshot file name.
- **What you expected:** one sentence.
- **How sure:** seen once, seen every time, or inferred.
- **Severity:** blocks a member, confuses a member, or cosmetic.

Keep observation separate from guesses about the cause. Name the page or the pattern, never a person. Put findings where the work is tracked: a GitHub issue on the Village OS repository, or the pull request you are working on, or a task for the Front-End & Game Platform role. A write the probe reports as "stopped before it left" on a page load is itself a finding: a page should not write when someone only looks at it.

## When it does not work

| What you see | What it means | What to do |
|---|---|---|
| `LIVE_QA_TOKEN is not set` | The secret did not reach the script | Run it through `infisical run --`, and check the variable name |
| `live_view_not_held` | Your seat no longer carries the live view | Ask the Front-End & Game Platform Steward |
| `agent_token_invalid`, refused token | It expired, was revoked, or your password changed | Mint a new one (Step 2) |
| `did not mark this as a read-only live view` | The site runs a release from before the live view, or the token has another scope | Wait for the release, or mint a `live.view`-only token |
| `live_view_rate_limited` | 3000 reads in an hour on one token | Slow the crawl and wait |
| The entrance still shows | The token is not in `localStorage` before the first page loads | Use `addInitScript`, never `page.evaluate` after `goto` |
