# RFC 0016: ctx.random.id(brand)

Status: implemented

## Problem
Actions mint ids with `random.uuid()` (a `string`), then re-parse the payload to get the branded id type (golden-1 friction 7).

## Proposal
`Random.id<B extends string>(brand: B): Id<B>` returns a fresh v4 uuid typed as `Id<B>`, the type of `s.id(brand)`. `@keel/schema` exports `type Id<B extends string> = string & { readonly __brand: B }`; `s.id` uses it. `@keel/ctx` imports the type only. One way per purpose: `id` for schema ids, `uuid` for raw strings.

## Alternatives
- Overload `uuid(brand)`: two return types for one name.
- Keep re-parsing: boilerplate.

## Spec diff
k.ctx: API line for `random.id(brand)`; Conformance gains "`random.id(brand)` under sim is deterministic by seed and parses with `s.id(brand)`".

## Conformance diff
Add `packages/ctx/conformance/random-id.test.ts`.

## Migration
Additive. Custom `Random` implementations must add `id`.

## Token impact
About 40 tokens in k.ctx.
