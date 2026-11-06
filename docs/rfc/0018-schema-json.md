# RFC 0018: s.json()

Status: draft

## Problem
k.schema cannot declare an opaque JSON value (store state, payloads). The inspector reads an undeclared `state` key by narrowing, relying on `parse` passing unknown keys through.

## Proposal
`s.json(): Schema<JsonValue>`. `parse` accepts exactly JSON-representable values: null, boolean, string, finite number, arrays, plain objects (no functions, undefined, NaN, Infinity, cycles, class instances, or own `__proto__`/`constructor`/`prototype` keys); anything else fails with rule `type` at its path. `encode`/`decode` are identity. `gen` uses fast-check `jsonValue`; `doc()` is `json`; `decodeStrings` parses the string as JSON (empty string stays empty; invalid text is rejected). Undeclared object keys: `parse` keeps them, `encode` drops them.

## Alternatives
- `s.unknown()`: admits non-JSON values.
- Keep narrowing: undeclared, untyped.

## Spec diff
k.schema Primitives gains `json`; Conformance gains one sentence.

## Conformance diff
Add `packages/schema/conformance/json.test.ts`.

## Migration
Additive.

## Token impact
About 30 tokens in k.schema.
