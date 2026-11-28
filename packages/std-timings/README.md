# @keel/std-timings

**Spec:** std.timings · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `time(ctx, name, fn)`, `timingsOf(ctx): Timings`, `Timings` (record of `{ count, totalMs, maxMs, lastMs }`).
- **Cap:** each ctx keeps at most 256 distinct names in two segments (a segmented LRU). A new name joins the unprotected segment; at the cap it evicts the least recently updated unprotected name and adds 1 to `dropped` (its stats are gone). A second call moves a name to the protected segment (at most 192; past that its least recent name moves back unprotected, not counted). So a kept name with a count of 2 or more is evicted only after 192 other names had a repeat call since its last call; names called once, such as request-derived ones, cannot do it alone.
- **Invariants:** durations come from `ctx.clock` only; a rejected `fn` is counted and rethrown unchanged; timings are per ctx (WeakMap), sorted by name. Importing the package registers inspect section `timings.recent`, schema `TimingsRecent`: `{ timings, dropped }`.
- **Dependencies:** `@keel/compiler` (`inspect/inspector`), `@keel/ctx`, `@keel/schema`.
- **Rungs:** conformance (example + probabilistic, served by a dev `createApp`), property for the statistics.

## Extension points

Uses **inspector hooks** (k.inspect).

## Unsafe

count: 0
