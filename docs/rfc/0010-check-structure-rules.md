# RFC 0010: one implementation of the structure rules

Status: draft

## Problem
`tooling/structure-lint.mjs` re-implements, with regexes, rules that `@keel/check` already owns (E1752 one export per file, E1754 unsafe justification) and one it lacks (casts, `any`, non-null assertions, ts-suppression outside `unsafe/`, CLAUDE.md rule 6). Two implementations drift: the regexes miss `x!` and `as` in odd spots, and apps get none of it.

## Proposal
- New code E1757: `as T` (not `as const`), `<T>x`, `x!`, `any`, or `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` in a code file outside `unsafe/`. One finding per occurrence; tests and tooling are in scope.
- Fixes: `x!` -> `x`, `any` -> `unknown`, delete the suppression comment. Casts have no mechanical fix.
- E1752 keeps its exemptions and gains one: a re-export (`export * from`, `export {..} from`) outside `index.*` is reported, except under `types/`. Exemptions are `index.*`, `Props`/`uses` beside a component default, a schema plus its same-name type, and `*.server.ts` `loader`/`action`.
- `tooling/structure-lint.mjs` calls `check` for S0001/S0002 (E1752), S0004 (E1757), S0005 (E1754) and keeps S0003, S0006, S0007. S-codes stay as aliases in its messages.

## Alternatives
- Keep both: drift continues.
- Make S0004 a Biome rule: no Keel diagnostic model, no `explain`, no fix diff.

## Spec diff
k.check Rules: add E1757; E1752 wording notes re-exports.

## Conformance diff
Add `packages/check/conformance/E1757-unsafe-syntax.test.ts`. Existing tests unchanged.

## Migration
Existing violations in the repo are fixed or move into `unsafe/`.

## Token impact
About 40 tokens in k.check.
