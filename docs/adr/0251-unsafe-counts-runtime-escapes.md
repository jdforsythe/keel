# ADR-0251: k.unsafe: `unsafe` counts runtime escapes; a negative type test is a test (RFC 0229)

**Status:** accepted (orchestrator, 2026-11-25, for the operator to confirm).

**Context.** The ledger's `unsafe` count was 35. 14 of those calls wrapped type-only fixtures in `packages/*/unsafe/`, which never run and sat there only so E1757 would skip their `@ts-expect-error` lines. Six more were avoidable casts or a call that escaped no enforced check. The spec never defined the count, and E1754 accepted a one-letter reason.

**Decision.**
- A negative type test is a `*.test-d.ts` or `*.test-d.tsx` file under `test/` or `conformance/`: type-checked, never run, imported by no file. A described `@ts-expect-error` there is no E1757; everything else E1757 reads still is, and no other test file may hold `@ts-expect-error`. E1761 reports one elsewhere, an import of one, or an `unsafe(` call in one.
- The ledger writes `negativeTypes`, the count of expectations, after `hostElements`, never compared. A negative type test gives no item evidence; `proven` stays a passing `expectTypeOf`/`assertType` test.
- k.unsafe defines `unsafe`: calls in `packages/*/{src,unsafe}`, `apps/*` and the root `modules/**`. In a package `unsafe/` holds type-system escapes; S0014 (structure-lint) reports a package call whose range holds no E1757 finding.
- E1760: a justification string of fewer than 8 words. Whether the reason argues safety is judged in review (R1001, the `keel-escapes` skill).
- The same rules apply to apps.

**Alternatives.** Subtracting fixtures by name; a `test/types/` folder; `@ts-expect-error` in every test file; `proven` for negative type tests; gating `negativeTypes`; a kernel "lifts nothing" code; an 8-word E1754 that would move lifted ranges.

**Consequences.** After the build `unsafe` is 14 (15 if std-workflows cannot reuse std-statecharts' `asEvents`) and `negativeTypes` is 88. 11 packages keep an `unsafe/` folder. `render` takes its props generically, so a missing callback prop is a compile error. k.check's `unsafe('r', ...)` fixtures also report E1760.
