---
"@keel/compiler": minor
"@keel/server": minor
"@keel/cli": minor
"@keel/check": patch
---

`keel check` (binary, MCP, LSP) and `keel build` import each `@keel/std-*` package in an app module's `deps` before validating, so stdlib rules (E2101) and `std` config schemas register; one that cannot be imported is E1159 (rfc:0066, backlog 0118). The build writes `.keel/std.json` (`stdArtifact`, `{ [pkg]: { [moduleId]: config } }`, E1158 for a bad entry; in `artifactHashes`, so `keel check` compares it). `createApp({ std: '.keel/std.json' })` reads it at startup (E1160 missing, malformed or hand-edited; E1158 failing a registered schema) and binds it to `ctx`; stdlib packages read it with `stdConfig(ctx, pkg, Config)` from `@keel/compiler/std/stdConfig` (backlog 0119). Budgets: compiler 25 -> 26 kB, server 13.5 -> 14 kB.
