# @keel/server

**Spec:** k.server · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `topology(def)` returns the frozen `Topology` (deployable name -> `{ modules, adapter: 'node' | 'static' | 'client' }`); also the `Topology` type and `TopologySchema` (`s.record` of `s.object`, from `@keel/schema`).
- **Invariants:** invalid shape, an empty `modules` list, or a module named in two deployables throws a plain `Error` whose message starts with `E1552`. The result and each `modules` array are frozen.
- **Dependencies:** `@keel/schema`.
- **Rungs:** properties (seed 1337): any valid definition round-trips; a duplicate module throws E1552.
- **Scope:** thin server slice: topology only; loaders/actions execution and adapters are backlog 0028.

## Extension points

TODO

## Unsafe

count: 0
