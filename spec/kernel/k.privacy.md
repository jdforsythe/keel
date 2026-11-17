# k.privacy: Secrets and personal data
status: conformance-covered

**Purpose.** Two schema marks decide what may leave the process. Personal data serializes where the app sends it (its stores, its own user's page) and is redacted in every sink: sessions, logs, error text and the evidence bundle.

**Secrets.** `s.secret(inner)` parses a raw `inner` value, or an existing secret, to a `Secret<T>` whose value is read only by `reveal(secret): T` (E1105). A secret never serializes: `encode`, `JSON.stringify`, `String()`, template literals and `util.inspect` give the marker `"[secret]"`; it has no own enumerable keys, so spread and `structuredClone` copy nothing. `parse` of the marker fails with rule `secret-missing`, so a store snapshot, `#k-state`, log or session capture never carries or restores the value. `decodeStrings` reads the inner type. `gen` wraps a generated inner value; `doc()` is `secret<T>`. What `reveal` returns is plain data: a store, a storage driver or a log keeps it as written, and nothing at run time tells it from another value. A `loader` or `action` `output` holds no `s.secret` (E1113); a secret leaves as `reveal(secret)` in an `s.string()` field (k.api). `credentials(ctx)` of `@keel/std-credentials` keeps a credential as a hash (std.credentials) or a token digest (std.tokens).

**Personal data.** `schema.pii(class)` marks any schema node as personal data, in a `*.schema.ts` file. `PiiClass` is closed: `name` · `contact` (email, phone, handle) · `location` (address, coordinates) · `identifier` (government, account and customer numbers, birth dates) · `financial` · `special` (health, biometric, belief, ethnicity, orientation) · `network` (IP address, device id) · `content` (text a person wrote). The mark keeps the type and every derivation (`parse`, `encode`, `decodeStrings`, `gen`); the node gains `pii: class`, which covers every value under it; `doc()` appends ` pii(<class>)` and JSON Schema adds `x-keel-pii`. From `@keel/schema`, both pure: `piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order, `path` dotted with `*` for an array item or record value, the class its nearest mark's; `piiValues(schema, value)` gives, for a valid encoded value, each non-empty string and each number (as `String()`) under a marked path. `piiValues` also gives a marked record's keys and a marked open object's undeclared keys and values.

**Sinks.**
- Sessions (std.sessions): marked values in payloads, state and error `data` become generated values at capture; error messages drop each.
- Inputs: a control bound (k.forms `field`) to a marked path carries `data-k-pii="<class>"`, and the ctx observer reports its `input` values and one-character `keydown` keys as `x` repeated, as for a password field (k.ctx).
- Server log (k.server): before a `diag` record is written, each of `piiValues` of the request's decoded action input, its loaders' outputs and its factories' store states is replaced by `[pii]` in the message and in each of its `frames`. So is the revealed value of each `Secret` made while the request runs (`bearer` too), by `[secret]`: each string or number in it, not a boolean. One made at startup or in a runner is not. An action's `output` counts as a loader's.
- URLs: a marked node in a route's `params` or `search` schema is E1111, since a path or query reaches browser history and proxy logs Keel cannot redact.
- Evidence bundle (k.evidence): holds no app value.
In dev, `/__keel/inspect` serves store values unredacted to the developer; it is not a sink.

**Rules.** E1105 `reveal` imported in an app file other than `*.server.ts`, test files included · E1111 a `.pii()` node in a route `params` or `search` schema (fix: none). It also reports a route table, entry, `params` or `search` it cannot read statically (a factory call, a computed key); a route table or schema a package exports is the package's, and so is the schema an export on the checker's closed audited list returns, each one refusing a marked column when called (`tableSearch` from `@keel/std-tables`). · E1112 a revealed value reaching a log, storage, a file, store state or a throw (k.reveal) · E1113 an `s.secret` node in a `loader` or `action` `output`, thrown at declaration (fix: none).

**Conformance.**
- For every generated secret: it parses; `encode`, `String` and `util.inspect` give the marker, `JSON.stringify` the marker's JSON, `structuredClone` an empty object; parsing a raw value yields a secret revealing it; the marker fails with rule `secret-missing`.
- For every generated schema with marked nodes, `parse`, `encode`, `decodeStrings` and `gen` give what the unmarked schema gives.
- `piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object.
- For every generated value of a fixture schema, `piiValues` returns exactly the non-empty strings and the numbers under marked paths.
- `s.string().pii('contact')` has `doc()` `string pii(contact)` and JSON Schema `x-keel-pii: "contact"`.
- An action throwing an `Error` whose message holds a marked input value logs a `diag` record holding `[pii]` and not the value, in dev and production.
- Under a sim ctx, an `input` fired on an `Input` bound to a marked field reaches `observe` as `x` repeated, and the element has `data-k-pii`.
- A marked field in a route's `params` or `search` schema is E1111; in an action `input` it is not.
- An action throwing an `Error` whose stack names a file path holding a marked input value logs that frame with `[pii]` in place of the value.
- An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await`; a boolean secret logs as is; of two overlapping requests each marks only its own.
- An `action` or `loader` whose `output` has an `s.secret` field throws E1113; with `s.string()`, none.
