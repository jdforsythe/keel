---
"@keel/std-sessions": minor
---

`replay` leaves the root entry and is exported from `@keel/std-sessions/replay` only; the root imports no `@keel/testing`. `@keel/testing` is an optional peer dependency of `@keel/std-sessions`.

Migration: `import { replay } from "@keel/std-sessions"` becomes `import { replay } from "@keel/std-sessions/replay"`. A project that calls `replay`, `minimize`, `commandJob` or `./group` lists `@keel/testing` itself (scaffolded projects do, under `devDependencies`).
