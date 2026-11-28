# ADR-0192: std.tokens: `idOf` reads a token's id before `check` (RFC 0173)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** `tokens(ctx).check(token, find)` takes a synchronous `find`. An app that keeps its tokens in its own database (k.data) reads the row asynchronously, by the token's id, and the id sits inside the presented `Secret<string>`. Without help the app reveals the token and parses its form itself.

**Decision.** `tokens(ctx).idOf(token)` returns `ok` with the id `check` reads, or the `credentials.mismatch` constant `check` gives a value it refuses before calling `find` (not in the token form; a sim token under real or shell). It reads no row, digest or clock, so `ok` means well formed, not valid; it is synchronous, never throws, and never returns or logs the secret. The section budget figures `spec.section` and `docs.section` are re-based from 1,500 to 1,700 tokens for the added text.

**Alternatives.**
- An async `find`: makes `check` asynchronous for every caller.
- `check` async only when `find` returns a promise: two return types for one name.
- A free `idOf` with no ctx: cannot apply the mode rule, so it disagrees with `check` on sim tokens.
- The app parses a revealed token: the secret enters app code and the token form is copied into apps.
- Trim std.tokens to 1,500 tokens: most of its text is quoted by conformance headers.

**Consequences.** An app fetches a token's row from any store, then calls `check` with a `find` over that row; `check` is unchanged. Every spec section may grow to 1,700 tokens. std.tokens reads `implemented` until `idOf`'s three clauses have tests.
