---
"@keel/std-conflicts": minor
"@keel/std-brands": minor
"@keel/std-sessions": patch
---

A stdlib package's runtime entries reach no CLI-time package (`@keel/cli`, `@keel/check`, `vite`, `vitest`, `typescript`, `oxc-*`); structure lint S0009 in `pnpm check` holds it. `@keel/std-conflicts` registers nothing from its main entry: `@keel/std-conflicts/tools` registers the `conflicts.race` formatter and the rules E2701 and W2702. `@keel/std-brands` has an empty main entry: `@keel/std-brands/tools` exports `idBrandCase` and registers E2101. `@keel/std-sessions/action` no longer reaches `@keel/cli`: the `session` formatter registers from `./tools`. Migration: `import { idBrandCase } from '@keel/std-brands'` becomes `from '@keel/std-brands/tools'`; code that renders `conflicts.race` records with `respond`, or reads E2701 or W2702 from the rule registry, adds `import '@keel/std-conflicts/tools'`. A project that lists either package in a module's `deps` needs no change for `keel check` and `keel build`.
