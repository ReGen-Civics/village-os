# Generated docs: main owns them

Nine files are written by generators out of the code. A pull request never commits them.
Main regenerates them after every merge.

| File | Generator | Kind |
|---|---|---|
| `docs/GOVERNANCE.md` | `scripts/generate-governance-doc.mjs` | whole file |
| `docs/knowledge/governance-lineage.md` | same script | whole file |
| `docs/TOKENS.md` | `scripts/generate-token-doc.mjs` | whole file |
| `docs/VARIABLES.md` | `scripts/generate-variables-doc.mjs` | whole file |
| `docs/MODULES.md` | `scripts/generate-modules-doc.mjs` | whole file |
| `docs/CAPABILITIES.md` | `scripts/generate-capabilities-doc.mjs` | whole file |
| `docs/ECONOMICS.md` | `scripts/generate-economics-doc.mjs` | only the `<!-- generated:NAME start/end -->` regions; the prose around them is a person's |
| `client/src/locales/en.po` | `pnpm i18n:extract` (lingui) | whole file |
| `client/src/locales/es.po` | `scripts/fold-po-fragments.mjs`, then `pnpm i18n:extract` | whole file |

The registry is `GENERATED_FILES` in `scripts/lib/generatedDocs.mjs`. Add a new generated file there
first; the guard and the tests read that list.

`client/src/locales/es.po` holds people's translations, and it is on the list anyway (the lead,
24 Nov 2026): every landing rewrote it, so every open translation pull request conflicted on it. A
pull request puts its Spanish in a fragment, `client/src/locales/es.d/<name>.po`, holding only the
entries it adds or changes. The workflow folds every fragment into `es.po` and deletes it before it
extracts, so the bot's one commit carries both. A fragment wins over `es.po` on the same `msgctxt` and
`msgid`; between two fragments that disagree the later filename wins on main, and the catalog check
fails any pull request holding both. Until the fold, every reader (the catalog build, the catalog check,
the coverage measure) reads `es.po` with the fragments folded in. The rules are in
`scripts/lib/poFragments.mjs`; `docs/I18N.md` says how to write one.

## Why

Every pull request that added a route or a capability had to commit these files regenerated. Every
landing on main then made every open pull request conflict on them, GitHub runs no CI on a conflicted
pull request, and on 9 November 2026 about twelve lanes re-merged main and re-pushed, six runners
each time, for hours. The documents were the most common reason a pull request went red.

## The flow

1. **A lane changes code.** It does not run a generator and does not commit a generated file.
2. **CI runs in PR mode.**
   - `check-generated-docs-untouched.mjs` fails the pull request if it edits a generated file
     (or a generated region of ECONOMICS.md). The message says "main regenerates these after every
     merge; drop your change" and prints the `git checkout <base> -- <file>` that restores it.
   - Each doc guard (`check-governance-doc.mjs` and its siblings, `server/db/governanceDoc.test.ts`,
     `server/db/tokenDoc.test.ts`, `check-i18n-catalogs.mjs`) still RUNS the generator and still fails
     when it throws or when a rule inside it breaks (an unclassified route, a house-voice breach, a
     missing marker, a new short message with no context). What they no longer ask is that the
     committed file equal the output.
   - The would-be diff of `GOVERNANCE.md`, `governance-lineage.md` and the `ECONOMICS.md` regions is
     written to the job summary of the `verify` job, so a reviewer sees every governance and economics
     change the pull request makes. It is the committed file against what this tree generates, so it
     can also show a neighbouring change main has not yet regenerated.
3. **The merge.** The integrator composes and lands without regenerating anything.
4. **Main regenerates.** `.github/workflows/generated-docs.yml` runs every generator on the push to
   main and, when anything changed, makes ONE bot commit (author `github-actions[bot]`). It checks the
   generators are idempotent, then runs every doc guard in strict mode and `scripts/check-post-fold.mjs`
   (the catalogs in strict mode and every test that reads a catalog) on that tree, and only then
   pushes. Until 26 Nov 2026 the checks ran after the push, and the bot's commit turned main red twice
   that day.
5. **A generator fails, or a check fails on the regenerated tree.** The job goes red, nothing reaches
   main (main stays green with stale docs), and ONE issue titled "Generated docs failed on main" is
   opened or updated naming what failed. A tree held back by a failed check is pushed to the branch
   `bot/generated-docs`, overwritten each time, so a lane can check it out and reproduce. Close the
   issue when a run is green.
6. **The bot's commit gets no ci run** (the lead, 26 Nov 2026), because step 4 already judged it. `ci.yml`'s push `paths-ignore` lists
   `BOT_COMMIT_PATHS` (`scripts/lib/generatedDocs.mjs`): the generated files and
   `client/src/locales/es.d/**`, whose fragments the fold deletes. GitHub starts no run only when every
   changed path is on that list, so a commit that changes one other file still runs in full, and a pull
   request's run is never path-filtered. The merge commit's own run is the one that judges the landing.

## Modes

`GENERATED_DOCS_MODE` is `strict` only inside `generated-docs.yml`. Everything else is PR mode, the
default, including a lane's machine, so a lane never has to think about it.

`ci.yml` never sets strict on the tree as committed. The merge commit of a pull request is one bot
commit older than its docs, so a strict check there would be red on every merge. "Main's docs equal the
code" is a claim that can only be made after the bot has written, which is where strict runs.

The one exception is a simulation of that write. `ci.yml`'s step "Main stays green after the docs bot
folds this tree" runs `scripts/check-post-fold.mjs --fold`: it folds and re-extracts the catalogs on the
runner's throwaway checkout, exactly as the bot will, and checks the catalogs in strict mode there. A
pull request that would turn main red after its merge goes red itself instead.

To check a tree strictly by hand (for example to see what the bot will do): `GENERATED_DOCS_MODE=strict node scripts/check-governance-doc.mjs`.
To see what changes locally, run the generator, read `git diff`, and then `git checkout -- docs client/src/locales`
before you commit. Do not commit it.

## A generator is broken

Fix the generator or the code it reads, in a pull request. Never fix a generator's output by hand.
If a pull request ADDS a generated region to `ECONOMICS.md`, it adds the markers (a new region is
allowed); main fills it.

## Deploys

The bot commit is a push to main, so the host deploys it. That is wanted: `governance-lineage.md` ships
in the image and the assistant reads it, so a deploy that skipped the docs would leave the assistant
describing the previous code. Do not add watch paths that skip it.

The bot commit starts no CI run. Pushed with the built-in `GITHUB_TOKEN` it would start no workflow
at all; pushed with the deploy key it starts workflows, and `ci.yml` skips it by path (above) while this
workflow skips its own commit by subject, which is also what stops a loop.

## Moving to a new repository

The workflow uses only the built-in `GITHUB_TOKEN`, no secret and no repository name. Two settings must
hold on the new repository:

- Settings, Actions, General, Workflow permissions: the workflow asks for `contents: write` and
  `issues: write` itself, which works under the default "read" setting; an organization policy that
  forbids elevating it must be relaxed for this workflow.
- Main must let the bot's commit in. Since 20 Nov 2026 main carries a ruleset that requires the seven
  CI jobs, and GitHub refuses the `github-actions` app as a bypass entry on a repository ruleset. So the
  workflow pushes with a write-enabled DEPLOY KEY held in the `DOCS_DEPLOY_KEY` secret, and the ruleset
  names deploy keys as its bypass. Without that secret the workflow falls back to the built-in token,
  which works only while main is unprotected. A push made with the deploy key starts workflow runs, so
  the job skips its own commit by message.

## For lane briefs and the integrator

One line for every lane brief: "Do not run or commit the generators' output (GOVERNANCE.md, ECONOMICS.md
regions, TOKENS.md, VARIABLES.md, MODULES.md, CAPABILITIES.md, en.po, es.po); main regenerates them after the merge."

Integrator compose checklist: do not regenerate or re-extract on the composed tree, and do not commit
generated files in a batch commit. Read the job summary for the GOVERNANCE.md and ECONOMICS.md diffs
before landing. A lane branch that still carries a regenerated copy (made before this flow) drops it with
`git checkout origin/main -- <file>`; the guard names the files.
