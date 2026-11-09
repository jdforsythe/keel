---
"@keel/std-sessions": minor
"@keel/cli": patch
---

rfc:0070 `keel session capture|ingest|replay|minimize|to-test` through `stdCommand('session', op)` (backlog 0094): `minimize` (binary-search prefix then ddmin, 1-minimal, deterministic; subpath `./minimize`), the emitted `@keel/testing` file (`toTest`), the `keel test` job (`./commandJob`), E2002-E2004; the redact path grammar (`*` any one segment, `\.` a literal dot; E2001 resolves `s.record`, 0214); E2005 follows re-exports through the project (0215); the recorder's scrub memory keeps the newest 256 values. `redactSession` and `minimize` leave the root entry (browser budget back to 6 kB). The cli MCP tool list test allows the filled `session` slot.
