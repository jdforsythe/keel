# ADR-0263: a control's value in `find`, token names at `keel check`, a package's files above their folder (RFC 0241)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** The household build found three holes. `find(id).text` of an input is always empty, so a test cannot read a control's value. A token name no `tokens.ts` declares is reported by no command when the project has no `tokens.ts`, and only by the build's evaluation, with no source position, when it has one. PGlite's `contrib/*.js` read their archives with `new URL('../x.tar.gz', import.meta.url)`, which k.server-deps makes E1014.

**Decision.**
- `find(id)` gains `value`: the live DOM `value` of an `input` (not `checkbox`, `radio`, `file`), `textarea` or `select`; absent elsewhere but on a host element. `text` is unchanged.
- `keel check` judges each token name an app file writes as a string literal on a base element or `Part` (token props, directly, responsive, under `states` or in a part style; responsive keys; `look`) against the project's tokens: a missing one is E1801 at the literal, no fix. With no `tokens.ts` each is E1801 with the suffix `: the project has no tokens.ts`; with a `tokens.ts` that is E1807 none is judged. The clause is k.a11y-static Token names; k.ui points to it.
- A bundled package file's literal `../` read that stays inside its package's folder is copied into `dist/<name>/` with its leading `../` segments removed, and that argument in the bundle is rewritten to match. A read outside the package's folder stays E1014, `reads <f>, outside its package`.

**Alternatives.**
- `text` holding a control's value, or `state.value`: one field with two meanings, or a value posing as an ARIA state.
- A new code or a warning for names with no `tokens.ts`: the fault is E1801's, and a warning never fails a run.
- The token clause in k.ui: over the section limit.
- Copying `../` files above `dist/<name>/`, or not bundling the package: a deployable's files would leave its folder.

**Consequences.** k.testing, k.ui and k.a11y-static read `implemented` until their new clauses are covered. Check conformance fixtures with token literals and no `tokens.ts` gain E1801s. A project with no `tokens.ts` that writes token names has check errors where it had none. The server bundle is rewritten in one place: a `../` package read.
