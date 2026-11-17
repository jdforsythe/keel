# Review 5: RFC 0122, 0123, 0112 (39e9ab5f..HEAD)

Method: read the RFCs, the spec diffs, the source and conformance diffs. Nothing was run (no vitest, no `pnpm check`, no `pnpm ledger --diff`: the brief's machine rules forbid root check). Every finding below is from reading, none confirmed by execution.

## MAJOR

### M1. std.offline: the spec sentence "a 'mine' resolve with a rejected write leaves the entry failed with offline.storage" has no conformance case
- spec/std/std.offline.md (Write paragraph: "A write to `ctx.storage` that rejects, in `send`, a flush or a `'mine'` `resolve`, ..."); packages/std-offline/conformance/storage-fail.test.ts (cites Conformance 11, which names only `send` and the flush's `set`); the only case for resolve is packages/std-offline/test/resolveResult.test.ts ("'mine' whose storage write rejects ..."), which anyone may edit without an RFC.
- Scenario: change `resolve.ts` so a rejected `persist` rejects `resolve` (or drops the `failed` settle); every conformance file stays green and the spec status stays conformance-covered.
- Confirmed: no (reading). Fix: extend bullet 11 with the resolve case (`storage: ['ok','ok','ok','ok','fail']` over a conflicted entry, `resolve 'mine'` gives `failed`/`offline.storage`, posts nothing) and add the case to storage-fail.test.ts under an rfc tag.

## MINOR

### m1. Forms error-slot conformance was weakened, and Form production text is pinned nowhere else in conformance
- packages/forms/conformance/other-err-renders-in-error-slot.test.ts:22. For `keel.unexpected` it now asserts only `toContain("unexpected")`. It never asserts the generated `message` is absent, and nothing checks dev. The spec Client sentence (k.router) names `Form`'s error, but the new k.router bullet and production-error.test.ts cover only the default alert and `errorElement`. Router property coverage of Form exists only in packages/router/test/productionError.property.test.ts (editable without an RFC).
- Scenario: a build that renders `unexpected: <message>` into the slot passes.
- Confirmed: no. Fix: `expect(slot?.textContent).toBe("unexpected")` plus `not.toContain(message)` for `keel.unexpected`; add an `action` case to router/conformance/production-error.test.ts (spec bullet: add "a `Form`'s `error`").

### m2. `req` path keeps a secret value's leading or trailing slashes
- packages/server/src/internal/secretSegments.ts (empties are skipped by `where`, so only the secret segment is marked; the cut applies only when a non-empty segment follows).
- Scenario: `/reset//abc` (value `/abc`) logs `/reset//[secret]`; `/reset/abc/` (value `abc/`) logs `/reset/[secret]/`. The RFC claims "a value holding a raw `/` leaves no part and no slash count behind". Leaks only the count of edge slashes. Not in the RFC's stated limits.
- Confirmed: no (reasoned from the code and the `//reset//<v>/` conformance case, which pins this shape). Fix: state it as a limit in RFC/README, or when the secret is the last non-empty segment fold trailing empties into the `[secret]`.

### m3. `@keel/testing` `renderRoute` behavior change has no changeset or README text
- packages/testing/src/renderRoute.ts:57 passes no `mode`, so a rendered route now shows `unexpected` where it showed the thrown message. ADR 0143 D5 and RFC 0122 Migration say so, but .changeset/ has no `@keel/testing` entry and packages/testing/README.md does not mention it.
- Fix: a `@keel/testing` patch changeset and one README sentence ("a rendered route is the production page; read the thrown message from the ctx `error` report").

### m4. `asResult` justification no longer matches its use
- packages/std-offline/unsafe/asResult.ts: the string and doc say "the endpoint `send` named"; `resolve.ts` now casts to the union `Outputs<D>`, since a key names no endpoint. Rule 6 wants an accurate justification; the doc comment is also stale.
- Fix: reword to "the output schema of the endpoint the entry names".

### m5. `'theirs'` with a rejecting storage write rejects `resolve`
- packages/std-offline/src/resolve.ts (`await persist` unguarded on the `'theirs'` branch). The spec names only `'mine'`; behavior for `'theirs'` is unspecified and untested. Fix: say so in the spec, or settle it as for `'mine'`.

## Clean
- Unit 1 (RFC 0122) code: `shown` is applied at every router sink (root boundary fallback, level -1, `errorAt` for bare errors and for `errorElement` boundaries, Form `onResult`/return). The report to the ctx comes before sanitising. `publicError` moved without a copy left in the server (`!== "dev"` is the same as `=== "production"` for the two-value `Mode`). The entry passes `mode` to both. The router E1508 and `probeForm` switches to `mode: "dev"` are justified: they read message text, and a production case was added. ADR 0143 and the changesets are in place. No rule 6/11 hits found.
- Unit 2 (RFC 0123) code and conformance: the cut, the earliest-cut-wins rule, the forward `errorName`, and the spec moves match the spec text. The conformance cases cover each clause cited, including the stated limits. k.privacy bullets 6 and 7 are the pii action throw and the sim input, as k.evidence needs. ADR 0144, changeset and THREAT-MODEL/COMPLIANCE text are consistent. Known items not re-reported.
- Unit 3 (RFC 0112): `resolve` mirrors `send` (persist guard, online check, `flush(key)`); the golden-1 change (`applied !== false`, chart expectation) follows the new result. The overloads and `Output`/`Outputs` helpers look sound by reading.

## Not done
No test, typecheck, budget (`pnpm budgets`: router 10.75kb, server 23.75kb), mutation or ledger run; so the `Output` helper's distributive change and the budgets are unverified. I did not read packages/server/conformance/last-resort.test.ts line by line, nor docs/guide/build-golden-1.md. The brief's "run `pnpm check` and `pnpm ledger --diff`" was skipped because the machine rules forbid root `pnpm check`.
