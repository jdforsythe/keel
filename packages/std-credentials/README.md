# @keel/std-credentials

**Spec:** std.credentials, std.tokens · **Status:** proposed · **verified:** (none)

Password hashes and tokens for `node` deployables: `credentials(ctx)` hashes and verifies a `Secret`, and mints and checks tokens.

## Contract

- **Public API:** none yet. The package has the entries `@keel/std-credentials`, `@keel/std-credentials/server` and `@keel/std-credentials/tools`, all empty.
- **Invariants:** none yet.
- **Dependencies:** `@keel/check`, `@keel/compiler`, `@keel/ctx`, `@keel/schema`; `scrypt` and `randomBytes` of `node:crypto`.
- **Rungs:** none yet.

## Extension points

Will use the **capability registry** (k.ctx: `credentials`), the **schema type registry** (`credentials.Hashed`, `credentials.Digested`), **std config** (k.module: `{ ln }`) and the **check rule registry** (k.check: E2201 and E2202 from `./tools`).

## Unsafe

count: 0
