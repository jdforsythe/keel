# ADR-0018: Closed objects and member unions (RFC 0029)

**Status:** accepted
**Context.** ui `TokenSchema` needed closed groups and string-or-pair colors, which k.schema could not declare, so its `parse` diverged from its `node`, `gen` and `doc` (ui PLAN D8, backlog 0039). Principle 4 requires every derivation to come from one declaration.
**Decision.** `s.object(shape, { closed: true })` reports undeclared keys with rule `unknown-key`; doc writes `{| |}`; JSON Schema adds `additionalProperties: false`; `decodeStrings` reads declared keys only. `s.union([a, b, ...])` is an `anyOf` node: first accepting member wins for parse, encode and decodeStrings; failure reports the last member's issues; `gen` picks a member by seed. `TokenSchema` is now a plain closed `s.object`.
**Alternatives.** A `no-match` rule: loses nested paths and costs every `Rule` switch. A separate `s.anyOf` builder: two names for one idea. Rejecting undeclared string keys: breaks forms with transport fields.
**Consequences.** ui deletes its hand-written token validator. Member order is significant and documented. Exhaustive switches over node kinds gain `anyOf`; over rules gain `unknown-key`; router `jsonSchemaOf` must emit `additionalProperties: false` for closed objects.
