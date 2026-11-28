# The build-size split: members' side and admin-only

`node scripts/check-dist-budget.mjs` measures the built client three ways: main JS, the first page's
scripts, and the whole of `dist/public` in 4 KB blocks. This file is about the fourth thing it prints.

**The same script splits the total into the members' side and admin-only** (the founder's ruling,
28 Nov 2026: admin-only pages get a counted allowance of their own, and the build decides which
pages those are from the routes, never from a kept list). A file is ADMIN-ONLY when only an admin
route can load it, and ADMIN-ONLY IS DECIDED BY WHAT A MEMBER CAN REALLY REACH: an admin route is
an address at or under `/admin`, read from `client/src/App.tsx`, unless the router or the page's
own code says a person who is not an admin opens it (`/admin/review`, `/admin/proposals` and
`/admin/role-progress` today; `ADMIN_PATH_RULINGS` in `scripts/lib/distSplit.mjs` quotes the line
that proves each, and a test holds each quote to its file). The road to launch's pages are member
routes until they are folded behind the admin's own door. Then comes a walk of the build's own
chunk graph (`dist/chunk-graph.json`, written by `vite.config.ts`) from what `index.html` loads. Anything a member's page can import, statically
or lazily, is a member file, so importing an admin module from a member page MOVES its chunk to
the members' side; the report lists the admin-only files and says whether any member chunk holds
the Admin Garden's code. `MAX_MEMBER_DIST_KB` and `MAX_ADMIN_DIST_KB` gate the two sides once both
are set beside the other three in `ci.yml`; unset, the single total gates alone as before. The
rule is `scripts/lib/distSplit.mjs`, held by `scripts/check-dist-budget.test.mjs`;
`node scripts/plant-admin-import.mjs` proves it on a real build (two client builds, minutes).
`node scripts/measure-dist-split.mjs` builds, measures and writes the split's tables as Markdown
(the two sides, the admin-only files, admin code found on the members' side, three checks of the
chunk graph, and the arithmetic for the two numbers): run it on the tree a number is set from.
The allowance steps DOWN when the old admin shell is retired: `scripts/admin-shell-step-down.json`
records that page and its weight, its header says what to do on the day, and
`scripts/admin-shell-step-down.test.mjs` fails until the allowance has fallen by that much.
