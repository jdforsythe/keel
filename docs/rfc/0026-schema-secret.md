# RFC 0026: s.secret() and reveal

Status: implemented

## Problem
THREAT-MODEL promises "`Secret<T>` cannot serialize or log", but no spec section or code defines it (red-team 0088). Passwords, API keys and tokens parsed by a schema are plain strings that reach JSON, logs, `#k-state` and session capture like any other value.

## Proposal
`s.secret(inner): Schema<Secret<T>>`, a schema kind wrapping `inner`, and `reveal(secret): T`, the only read path.
1. **Never serializes.** `Secret` keeps its value in an ECMAScript private field. `toJSON`, `toString`, `Symbol.toPrimitive` and `util.inspect` return the fixed marker `"[secret]"`; it has no own enumerable keys, so spread, `Object.keys` and `structuredClone` copy nothing. `encode` emits the marker at a secret node without reading the value.
2. **Excluded by construction.** Every store snapshot, `#k-state`, log line and session goes through `encode` or `JSON.stringify`, both of which give the marker. `parse`/`decode` of the marker fail with the new rule `secret-missing`, so no codec restores a value; a store whose state holds a secret fails its copy instead of silently holding the marker.
3. **One accessor.** `reveal(secret)` (a free function, not a method: one import a checker rule can find). Proposed E1105: `reveal` imported in an app file other than `*.server.ts`; `*.server.ts` cannot reach the client (E1004), so a revealed value stays on the server. The check rule is pending (backlog).
4. **Generators.** `gen` maps the inner arbitrary through the secret constructor; generated secrets parse.
5. **Derivations.** `parse` accepts a raw inner value (wrapping it) or an existing secret (validating its value); `optional()`, `nullable()`, `register` and the registry work unchanged; `doc()` is `secret<T>`; `decodeStrings` reads the inner type, so a password field becomes a secret on the server.

## Alternatives
- `secret.use(fn)`: a method is harder to find statically than one import, and a second spelling would follow (principle 1).
- Redaction by path lists only (std.sessions `redact`): per-sink, opt-in, forgettable; secrets must be safe in every sink by type.
- Decoding the marker to an empty secret: a restored snapshot would carry a value that looks real.
- Storing values in a module WeakMap: needs a cast to recover `T`; the private field is typed and nominal.

## Spec diff
k.schema: new **Secrets** paragraph; `Rule` gains `secret-missing`; Rules gain E1105 (check rule pending); Conformance round-trip excludes `secret` and gains one sentence.

## Conformance diff
Add `packages/schema/conformance/secret.test.ts`.

## Migration
Additive. Code that switches over `schema.node.kind` or `Rule` exhaustively gains one case each (router `jsonSchemaOf`, `messageFor`; forms `messageFor`; cli `toJsonSchema`).

## Token impact
About 270 tokens in k.schema (722 to 992 of 1,500).
