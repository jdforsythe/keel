# k.privacy: Secrets and personal data
status: conformance-covered

**Purpose.** Two schema marks decide what may leave the process. Personal data serializes where the app sends it (its stores, its own user's page) and is redacted in every sink: sessions, logs, error text and the evidence bundle.

**Secrets.** `s.secret(inner)` parses a raw `inner` value, or an existing secret, to a `Secret<T>` whose value is read only by `reveal(secret): T` (E1105). A secret never serializes: `encode`, `JSON.stringify`, `String()`, template literals and `util.inspect` give the marker `"[secret]"`; it has no own enumerable keys, so spread and `structuredClone` copy nothing. `parse` of the marker fails with rule `secret-missing`, so a store snapshot, `#k-state`, log or session capture never carries or restores the value. `reveal` returns plain data, frozen deep (k.reveal).

**Personal data.** `schema.pii(class)` marks any schema node as personal data, in a `*.schema.ts` file. `PiiClass` is closed: `name` · `contact` (email, phone, handle) · `location` (address, coordinates) · `identifier` (government, account and customer numbers, birth dates) · `financial` · `special` (health, biometric, belief, ethnicity, orientation) · `network` (IP address, device id) · `content` (text a person wrote). The mark keeps the type and every derivation (`parse`, `encode`, `decodeStrings`, `gen`); the node gains `pii: class`, which covers every value under it; `doc()` appends ` pii(<class>)` and JSON Schema adds `x-keel-pii`.

**Sinks.**
- Sessions (std.sessions): marked values in payloads, state and error `data` become generated values at capture; error messages drop each.
- Inputs: a control bound (k.forms `field`) to a marked path carries `data-k-pii="<class>"`, and the ctx observer reports its `input` values and one-character `keydown` keys as `x` repeated (k.ctx).
- Server log (k.server): in a `diag` record's message and `frames` and the `req` record's path, each of `piiValues` (k.schema) of the request's decoded action input, its loaders' and actions' outputs and its factories' store states becomes `[pii]`. Each string, number and key but a declared field name (not a boolean) in a `Secret` made or revealed while the request runs (`bearer` too) becomes `[secret]`. A runner's `run` is scoped alike. Past 2,000,000 characters of these values' written forms or 100,000 secret values, a message after its prefix (`loader <id> threw: `), each frame and the path are one mark, `[secret]` if it holds a secret.
- Written forms: a value is marked as written; JSON-escaped, also with `\u` for each non-ASCII unit, and twice; `encodeURIComponent` once and twice, `encodeURI` and form-encoded (`+` for a space), none for a value with a lone surrogate; and as base64 of its UTF-8, padded, from 8 bytes also unpadded and URL-safe, found inside longer base64 from a byte offset that is a multiple of 3, to its end or for a multiple of 3 bytes. Letter case folds one code unit at a time; a form under 3 units is marked only as a whole token (no letter, digit, mark or `_` beside it). Overlapping matches are one mark.
- `req` path: first, a segment at a route's secret or `.pii()` `params` field is marked (k.serverlog Path).
- URLs: a marked or `s.secret` node in a route's `params` or `search` schema is E1111, since a path or query reaches history and proxy logs Keel cannot redact.

**Rules.** E1105 `reveal` imported in an app file other than `*.server.ts`, test files included · E1111 a `.pii()` or `s.secret` node in a route `params` or `search` schema (fix: none), or a route table, entry, `params` or `search` it cannot read statically (a factory call, a computed key); a package's exported table or schema, and `tableSearch`'s (`@keel/std-tables`, refusing a marked column), are the package's. · E1113 an `s.secret` node in a `loader` or `action` `output`, thrown at declaration (fix: none).

**Conformance.**
- For every generated secret: it parses; `encode`, `String` and `util.inspect` give the marker, `JSON.stringify` the marker's JSON, `structuredClone` an empty object; parsing a raw value yields a secret revealing it; the marker fails with rule `secret-missing`.
- `s.string().pii('contact')` has `doc()` `string pii(contact)` and JSON Schema `x-keel-pii: "contact"`.
- A marked or `s.secret` field in a route's `params` or `search` schema is E1111; in an action `input` it is not.
- An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await` or made earlier and revealed in it, a record or `json` key in one, and a runner's; a boolean or declared field name logs as is; of two overlapping requests each marks only its own.
- A secret route param is `[secret]` in the `req` path, escaped any way, in `/%52ESET/<v>` and `//reset//<v>/`, with and without a prefix param, and forwarded to a peer; `/reset/ab/<v>` and `/confirm/a/<v>/done` (of `/confirm/:token/done`) log `/reset/[secret]` and `/confirm/[secret]`; `/en/reset/<v>` logs as sent; a failed forward logs no path. Past 100,000 secret values a loader's throw logs `loader <id> threw: [secret]`.
- An action throwing an `Error` whose message or a stack frame's file path holds a marked input value logs a `diag` record with `[pii]` in its place, in dev and production.
- Under a sim ctx, an `input` fired on an `Input` bound to a marked field reaches `observe` as `x` repeated, and the element has `data-k-pii`.
- An `action` or `loader` whose `output` has an `s.secret` field throws E1113; with `s.string()`, none.
- `/reset%2F<v>`, `/RESET%2f<v>`, `/reset%5C<v>` (of `/reset/:token`), `/about` (of `/:t`) and `/en/A` (of `/:p/:t`) log `/[secret]`; `/a%2Fb` with no secret param, as sent.
- Of `/u/:email` (`.pii()`), `/u/a@b.c`, `/u/a%40b.c`, `/U/a@b.c` and `/u/a@b.c/x` log `/u/[pii]`; `[secret]` if also secret.
