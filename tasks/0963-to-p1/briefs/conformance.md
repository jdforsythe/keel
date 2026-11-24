# What a conformance writer is told

Work ONLY in your lane's worktree. Do not push, do not merge, do not touch any other worktree. You write from the spec text only: do not read implementation files under `packages/*/src/**`. Load the `keel-conformance` skill if available and follow it; read `tasks/0963-to-p1/briefs/README.md` in the lane for the lane rules. Run `pnpm install --offline` first if there is no node_modules. Print spec text with `pnpm spec <topic>`; the RFC's "Conformance diff" section names what is owed.

- Every clause is quoted WHOLE, word for word as the spec prints it, in the header of every file that asserts it (a paraphrased or halved clause stays at ledger rung `none`; a clause asserted across two files is quoted whole in both). Follow the header convention of the neighbouring conformance files in the folder.
- Follow the neighbouring files' conventions for fixtures, type-error cases and by-code fixture tables (`fixtures-by-code.ts`, `fix-diffs.test.ts` and the like when a new code appears).
- Property tests wherever a clause states a law or ranges over inputs. No `any`, casts, non-null assertions or `@ts-ignore`. No bare `Date`, `Math.random`, `fetch`.
- Kernel packages never import std packages, tests included (`tooling/deps.json` order; `node tooling/structure-lint.mjs` enforces it): a case that needs a std package lives in that std package's `conformance/` folder, or gives check its fixture as source text.
- Look for existing conformance cases the new spec text contradicts (pinned shapes, counts, lists of codes, exact messages) and correct them; say which and why. Do not weaken a case to make anything pass.
- The implementation does not exist yet, so new cases are expected to fail; write them as plain tests, not skipped.
- Where the spec text is ambiguous or silent, do not guess silently: choose the reading the RFC supports, assert it, and report the sentence so the spec can be made exact.
- Verify only: `tsc` for the packages touched (errors that exist only for want of the build are expected: list them), `node tooling/structure-lint.mjs`, `node tooling/format-check.mjs`, and each NEW test file run alone once to see it fail for the right reason (not a typo or import error). Do not run whole suites; the machine is shared. No `timeout` binary exists; use bash.
- Commit in the lane with messages prefixed `rfc:NNNN` (the conformance guard requires it), each ending with the session's attribution trailers.

Report under 250 words: commits; files written with the clause each covers and case counts; existing cases changed; spec sentences that are ambiguous or untestable (quote them, with the reading you asserted); how each new file fails today; lint lines.
