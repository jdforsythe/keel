# RFC 0002: schema: decodeStrings for URL and FormData input

Status: draft

## Problem
k.forms (FormData) and k.router (params, search) receive strings, but `decode` is the JSON codec and cannot coerce `"5"` to 5 or a checkbox to a boolean. Each consumer would hand-write the same coercion. Separately, `parse` accepts own `__proto__`, `constructor` and `prototype` keys, `s.string({ min, max })` accepts `min > max`, and there is no shared path formatter.

## Proposal
- Object schemas gain `decodeStrings(input: FormData | URLSearchParams | Record<string, string | string[]>): Result<T, SchemaError>`. `number`/`int` from numeric strings (else `type`); `boolean` from `true|on|1` and `false|off|0`, absent boolean is false; absent key is absent (optional) or `required`; empty string for an optional field is absent; `array` from repeated keys or `key[]`; nested objects by dotted keys; `literal`/`enum` compared as strings; `id` as string; `union` by discriminant; `record` from remaining keys under its prefix.
- `decode` stays the JSON inverse of `encode`.
- `parse` rejects an object with an own `__proto__`, `constructor` or `prototype` key (rule `type` at that path).
- `s.string` throws at construction when `min > max`.
- Export `pathToString(path)` (`users.0.name`).

## Alternatives
- Coerce inside `decode`: breaks the JSON round-trip contract.
- Coercion in k.forms and k.router separately: duplicated, divergent rules.

## Spec diff
spec/kernel/k.schema.md: Derivations gain `decodeStrings` with its coercion rules; Conformance gains the URLSearchParams round-trip property.

## Conformance diff
Add `decode-strings.test.ts`: round-trip property (seed 1337), the coercion table, proto-key rejection, `min > max` throws. Existing tests unchanged.

## Migration
Additive, except that inputs carrying the three keys are now rejected and `min > max` now throws.

## Token impact
About 100 tokens in k.schema.
