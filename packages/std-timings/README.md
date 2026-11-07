# @keel/std-timings

**Spec:** std.timings · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `time(ctx, name, fn)`, `timingsOf(ctx): Timings`, `Timings` (record of `{ count, totalMs, maxMs, lastMs }`).
- **Invariants:** durations come from `ctx.clock` only; a rejected `fn` is counted and rethrown unchanged; timings are per ctx (WeakMap), sorted by name. Importing the package registers inspect section `timings.recent`.
- **Dependencies:** `@keel/compiler` (`inspect/inspector`), `@keel/ctx`, `@keel/schema`.
- **Rungs:** conformance (example + probabilistic, served by a dev `createApp`), property for the statistics.

## Extension points

Uses **inspector hooks** (k.cli, RFC 0042).

## Unsafe

count: 0
