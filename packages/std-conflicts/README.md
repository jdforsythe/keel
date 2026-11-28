# @keel/std-conflicts

**Spec:** std.conflicts · **Status:** conformance-covered · **verified:** (none)

Finds races: rebased writes whose result depends on their order against the writes they did not see.

## Contract

- **Public API:**
  - `@keel/std-conflicts`: `races(snapshot, stores): RaceReport` (`{ races: Race[], unchecked: Unchecked[] }`); `findRaces(group, { user, serve, stores }): Promise<FindRacesResult>` (`{ replay, races, unchecked }`); `raceRecords(path, found, server): RaceRecord[]`; `RaceRecord` (closed `{ kind: 'conflicts.race', code, path, store, entry, against, reason }`); types `Race`, `Ref`, `Unchecked`, `RaceReport`, `StoresFactory`, `FindRacesOptions`, `FindRacesResult`. It registers nothing and reaches no CLI-time package, so a deployable may import it.
  - `@keel/std-conflicts/tools` (node, no exports): registers the `conflicts.race` formatter and the check rules E2701 and W2702. `keel check` and `keel build` load it for a project with `@keel/std-conflicts` in a module's `deps`; code that renders a `conflicts.race` record itself imports it.
- **Invariants:** `races` runs the factory without a ctx in a detached scope with its own store registry, picks the first store whose schema accepts `snapshot.state` and which declares every logged transaction, and for each entry holding `base` applies it and its concurrent entries in both orders from the state at `base`: one failing order is `invalid`, two holding orders with different states are `order` (an array of objects with a string `id` compares as a set). A `base` older than the kept log is `unchecked` `folded`; an id gap between the kept log's start and the entry is `unchecked` `undo`. A transaction function that throws an `Error` other than a TypeError or RangeError (which fail the order) makes the entry `unchecked` `threw`; a defect, or a thrown value that is no `Error`, passes out of `races`. `snapshot` and every live store stay unchanged. `findRaces` checks every replayed server store a factory declares by id, in id order.
- **Output:** importing `@keel/std-conflicts/tools` registers the formatter for kind `conflicts.race`; without it `respond` answers E1054. compact `E2701 <path>:1:1 race <name> #<id> over <name> #<id>, <name> #<id> +n on <store>` (at most two of `against`) and `W2702 <path>:1:1 unchecked <name> #<id> on <store> (<reason>)`; pretty adds each concurrent entry and a hint; json is the record encoded by `RaceRecord`.
- **Dependencies:** `@keel/reactive`, `@keel/schema`, `@keel/std-sessions` (`./group`), `@keel/store`; the tools entry also `@keel/cli` and `@keel/check`.
- **Rungs:** conformance (example + probabilistic), property (commuting transactions never race, a race reads the same from either side, `races` is pure).

## Extension points

Uses the **output formatter registry** (k.cli `formatter`) and the **check rule registry** (k.check `defineRule`), both from the tools entry.

## Migration

Code that renders `conflicts.race` records with `respond`, or reads E2701 or W2702 from the rule registry, adds `import '@keel/std-conflicts/tools'`. A project that lists the package in a module's `deps` needs no change for `keel check` and `keel build`.

## Unsafe

count: 0
