# RFC 0029: closed objects and member unions

Status: implemented

## Problem
`TokenSchema` (k.ui, E1807) needs two shapes k.schema cannot declare: an object that rejects keys it does not declare (the closed token groups) and a value that is either a string or an object (a color is `'#0a5'` or `{ light, dark }`). ui works around both with a hand-written `parse/decode/encode` over an open `s.object` with string colors, so `node`, `gen` and `doc` describe a different shape than `parse` accepts (ui PLAN D8, backlog 0039). Principle 4: everything derives from one declaration.

## Proposal
1. **Closed objects.** `s.object(shape, { closed: true })`. The node gains `closed: true` (absent when open, so existing nodes are unchanged). `parse`/`decode` report each own undeclared key with the new rule `unknown-key` at that key's path (instead of ignoring it); `encode` therefore throws on such a value. `doc()` and type text write `{| a: T |}`. JSON Schema derivations add `additionalProperties: false`. `decodeStrings` builds declared keys only (form and URL input carries transport keys), so closedness never fails string input. `gen` already emits declared keys only.
2. **Member unions.** `s.union([a, b, ...])` (two or more schemas, no discriminant) is an `anyOf` node. A value is accepted when a member accepts it, trying members in order; when none does, the issues are the last member's (no new rule; list the most structured member last for the most useful paths). `encode` and secret sealing use the first accepting member; `decodeStrings` builds each member's candidate in order and keeps the first that parses (else the last candidate, so parse reports it); `gen` picks a member by seed (`fc.oneof`); `doc()` is `a | b`; JSON Schema is `anyOf`. `union(key, variants)` stays the form for tagged objects.
3. **ui.** `TokenSchema = s.object({ color: s.record(s.union([s.string(), Pair])).optional(), space: scale, ... }, { closed: true })` with `Pair = s.object({ light, dark }, { closed: true })`. An unknown group now fails with `unknown-key` (was `enum`); a color pair with an extra key fails too (was ignored). The hand-written parse and its helpers are deleted.

## Alternatives
- A single `no-match` rule for member unions: loses the nested path (`color.fg.dark`) that forms and E1807 messages need; a new rule also costs every exhaustive `Rule` switch.
- A separate builder (`s.anyOf`, `s.either`): two names for "one of these schemas"; `union` already reads correctly and the argument shape (key string vs array) cannot be confused.
- `s.strict(obj)` modifier: a second spelling for object options; an options bag matches `s.string({ min })`.
- Rejecting undeclared keys in `decodeStrings`: breaks forms whose submit carries action or CSRF fields.

## Spec diff
k.schema: Primitives list `object` (`{ closed: true }`) and `union(members)`; new paragraph **Closed objects and member unions**; `Rule` gains `unknown-key`; Conformance gains two sentences.

## Conformance diff
Add `packages/schema/conformance/closed-and-member-unions.test.ts`. ui E1807 conformance unchanged (it asserts `ok: false` only).

## Migration
Additive in k.schema. Exhaustive switches gain cases: node kind `anyOf` (router `jsonSchemaOf`, cli `toJsonSchema`), rule `unknown-key` (router and forms `messageFor`); router `jsonSchemaOf` adds `additionalProperties: false` for closed objects. ui: `TokenSchema` issues for unknown groups change rule from `enum` to `unknown-key`.

## Token impact
About 260 tokens in k.schema (992 to 1,255 of 1,500).
