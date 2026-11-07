# RFC 0052: a production server without `assets` is E1555 at startup

Status: accepted (ADR-0041)

## Problem
- **Red team M3 (2026-11-07, backlog 0127).** A production `createApp` without `assets` scripted `/@keel/entry.ts` into island documents. That entry imports bare `@keel/*` specifiers that only Vite resolves, so in a deployed server every island failed in the browser with no server-side signal.
- **The spec allowed it.** k.server Build said "dev or no `assets` serves `/@keel/entry.ts` for Vite", and E1555 covered only `assets` without a manifest entry.
- **Tests rely on it.** In-process production apps (conformance for k.runtime islands and the resume entry) run without a build and expect the dev entry.

## Proposal
1. **E1555 at startup unless development or test.** `createApp` rejects with E1555 when `mode` is production (the default), `assets` is absent, and `process.env.NODE_ENV`, trimmed and lowercased, is neither `development` nor `test`. Unset counts as production, as Express and most Node tooling treat it; `node server.ts` with no `NODE_ENV` is a deploy. The message names the fix: run `keel build` and pass `createApp({ assets: 'dist/<deployable>' })`.
2. **Every deployable, islands or not.** Whether a page has islands is known only when it renders (every route has a `component`; the server marks islands on the rendered tree). `keel build` emits the client build for every `node` deployable, so passing `assets` is always possible.
3. **Unchanged.** Dev mode ignores `assets` and serves `/@keel/entry.ts`. A production `createApp` under `NODE_ENV` `development` or `test` (vitest sets `test`, so in-process conformance apps) still serves `/@keel/entry.ts` without a build. `NODE_ENV` is read safely: no `process` or a non-string value counts as unset.
4. **Amendment (backlog 0147).** The first accepted draft gated on `NODE_ENV` being exactly `production`. Node leaves it unset by default, so `node server.ts` without `assets` still served the dev entry, which is the original bug. The gate is now the exclusion above.

## Alternatives
- **Gate on `NODE_ENV=production` exactly.** The first draft. An unset `NODE_ENV`, Node's default, slips through (backlog 0147).
- **Reject on `mode` alone.** It breaks the in-process production conformance for islands and the resume entry, which run without a build.
- **Reject only when the deployable has islands.** Islands are not known before a render, so startup cannot tell.
- **Fail the first island document (500 + E1555 diag).** Precise, but the operator learns at the first page view, not at deploy, and a page that would render becomes a 500.
- **A new code.** E1555 already means "production client build missing or unusable".

## Spec diff
- **k.server Build.** The header becomes "(rfc:0048, 0052)"; "dev or no `assets` serves `/@keel/entry.ts` for Vite" becomes "dev, or no `assets` in development or test, serves `/@keel/entry.ts`."
- **k.server Rules.** E1555 becomes "production `assets` without a manifest entry, or no `assets` unless `NODE_ENV` is `development` or `test` (`createApp` rejects)."
- **k.server Conformance.** Adds "Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`."
- **Editorial, to stay at 1,500 tokens.** Cross-reference words that add no rule are cut: the example's `// modules/orders/show.server.ts` comment and its two `async` (its names shortened to `load`, `update`, `Params`, `Edit`), "(in-process in a `client` deployable)" (Topology states it), "(k.router E1507)" to "(E1507)", "(k.store)", "(k.runtime)" twice, "(RFC 0037)", "(rfc:0034)", "(split topology)", "k.services" before "JSON body", "for Vite", and "plus" to "and". No rule changes.

## Conformance diff
- **Added** `packages/server/conformance/e1555-production-assets.test.ts`: the clause (default and explicit production mode; `NODE_ENV` unset, `production`, `prod`, `Production`, `staging`), two clean counterparts (production under `development`, `test` in any case; dev mode under any `NODE_ENV`), and a fast-check property, seed 1337: for any set of node deployable modules and any `NODE_ENV` but `development` or `test`, no `assets` rejects with E1555.
- **Unit tests.** `server/test/productionAssets.test.ts` covers the startup rejection (unset, `prod`, `Production`, padded, empty), a build scripting the built entry into island documents only, dev mode, an in-process production app, and `nodeEnv`.

## Migration
- A server started without `assets` and without `NODE_ENV` `development` or `test` (unset included) now fails at startup with E1555. Run `keel build` and pass `assets: 'dist/<deployable>'`. golden-1 and golden-2 already do.
- Vitest runs are unaffected (`NODE_ENV=test`). A script that runs a production `createApp` in-process with `NODE_ENV` unset passes `mode: 'dev'`, `assets`, or `NODE_ENV=test`.

## Token impact
- k.server: 1,500 to 1,500 tokens (additions offset by editorial cuts).
- One startup check; no per-request cost.
