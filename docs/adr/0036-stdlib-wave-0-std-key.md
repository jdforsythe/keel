# ADR-0036: Stdlib wave 0 proves each extension point; module config is the `std` key, validated by a registered schema (RFC 0047)

**Status:** accepted

**Context.** G3 requires each of the six extension points to be used by at least one stdlib module, and freeze review §3 found none. std.sessions also needs per-module config.

**Decision.**
- **Six packages.** One minimal stdlib package per extension point, each with a `spec/std` section and a conformance suite:
  - `@keel/std-money`: schema type registry.
  - `@keel/std-brands`: check rule registry, with a `fix` (E2101).
  - `@keel/std-geo`: capability registry.
  - `@keel/std-health`: module manifest.
  - `@keel/std-timings`: inspector hooks.
  - `@keel/std-report`: formatter registry.
- **Stdlib after the kernel.** Stdlib packages come after the kernel in `tooling/deps.json`.
- **The `std` key.** A manifest's optional `std: { '@keel/std-x': JSON }` is checked statically by E1158. Each key must be a stdlib package in `deps`. The value must be literal JSON and must parse with the schema the package registers under its package name through `s.register`.

**Alternatives.**
- **A pluggable schema kind.** This would be a new extension point.
- **Validation in `module()`.** It would depend on import order.
- **Per-package config rules.** These duplicate validation.

**Consequences.**
- **Freeze review §3.** It reads 6 of 6.
- **Schema registry scope.** The schema type registry names composite types and does not add primitive kinds.
- **Config schemas.** A package's config schema is reachable by name from `s.registry()`.
- **Loading for `keel check`.** E1158 and stdlib rules see a package only once it is imported. The CLI loading packages from `deps` is a follow-up, and so is runtime delivery of `std` config, which std-sessions (0092) needs.
