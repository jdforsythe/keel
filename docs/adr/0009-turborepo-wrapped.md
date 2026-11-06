# ADR-0009: Turborepo, wrapped

**Status:** accepted
**Context.** Monorepo from day one; agents must not learn a second tool's config.
**Decision.** Turborepo generates from the task graph; agents call `pnpm <task>`; `turbo.json` is read-only.
**Alternatives.** Nx (larger surface); plain pnpm (no caching).
**Consequences.** Remote cache in CI; config drift fails check.
