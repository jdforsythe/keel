# ADR-0163: tokens stay, password hashing leaves (RFC 0141)

**Status:** accepted (orchestrator under the operator's direction of 2026-11-18). Supersedes ADR-0126 in part: its password hashing.

**Context.** The operator's direction: Keel is not an authentication library and must not mint, store, rotate or verify sign-in credentials; identity is a seam (ADR-0161), and sign-in belongs to the library behind it. `@keel/std-credentials` holds password `hash`/`verify` (scrypt, `Hashed`, an `ln` cost, a derivation queue) beside opaque token `mint`/`check` (`Digested`). No app, eval or kernel package calls `hash` or `verify`; golden-2 uses the tokens for its API keys.

**Decision.**
- C1: the package is `@keel/std-tokens`: `Digested` (`tokens.Digested`) from `.`, `tokens(ctx)` with `mint` and `check` (type `Tokens`) from `./server`, E2201 and E2202 from `./tools`; the capability is `tokens`. Token, digest and sim forms, `ttl`, expiry and constant-time compare are unchanged.
- C2: password hashing leaves with no replacement in Keel: `hash`, `verify`, `Hashed`, `CredentialsConfig`, the `ln` std config, the queue and its `keel.busy`, `credentials.length`. std.credentials is deleted. Nothing else is cut.
- C3: the result codes keep their names (`credentials.mismatch`, `.expired`, `.malformed` with `format`, `parameters`, `sim`, `.ttl`), since std.tokens' bullets name them; the reasons are stated in std.tokens.
- C4: E2201 and E2202 keep their codes, name `@keel/std-tokens/server` and move to std.tokens, whose Conformance gains their two bullets; E220x is std.tokens' block.

**Alternatives.** `@keel/std-keys` (a key is already a store, write and idempotence key). `@keel/std-secrets` (reads as the home of the kernel's `Secret`). Keeping the old name without hashing (the name still says Keel handles credentials). Keeping hashing as a documented low-level primitive (an app composing it is building sign-in by hand). `tokens.*` result codes (rewords six existing bullets; open for the operator).

**Consequences.**
- An app hashes passwords in its sign-in library; Keel has no password code path, cost setting or derivation queue to maintain or defend.
- Tokens keep working with a rename of imports and `deps`; stored digests and issued tokens stay valid. Sim tokens for a seed change with the capability name.
- The ledger loses std.credentials' 15 items; std.tokens gains 2 and is `implemented` until its conformance lands.
- The package name and its result-code prefix differ until the operator decides Open question 1.
