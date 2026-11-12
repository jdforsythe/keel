# @keel/std-conflicts

**Spec:** std.conflicts · **Status:** proposed · **verified:** (none)

Finds races: rebased writes whose result depends on their order against the writes they did not see.

## Contract

- **Public API:** `races(snapshot, stores): RaceReport` (`{ races: Race[], unchecked: Unchecked[] }`); `findRaces(group, { user, serve, stores }): Promise<FindRacesResult>` (`{ replay, races, unchecked }`); `raceRecords(path, found, server): RaceRecord[]`; `RaceRecord` (closed `{ kind: 'conflicts.race', code, path, store, entry, against, reason }`); types `Race`, `Ref`, `Unchecked`, `RaceReport`, `StoresFactory`, `FindRacesOptions`, `FindRacesResult`.
- **Invariants:** `races` runs the factory without a ctx in a detached scope with its own store registry, picks the first store whose schema accepts `snapshot.state` and which declares every logged transaction, and for each entry holding `base` applies it and its concurrent entries in both orders from the state at `base`: one failing order is `invalid`, two holding orders with different states are `order` (an array of objects with a string `id` compares as a set). A `base` older than the kept log is `unchecked` `folded`; an id gap between the kept log's start and the entry is `unchecked` `undo`. `snapshot` and every live store stay unchanged. `findRaces` checks every replayed server store a factory declares by id, in id order.
- **Output:** importing the package registers the formatter for kind `conflicts.race`. compact `E2701 <path>:1:1 race <name> #<id> over <name> #<id>, <name> #<id> +n on <store>` (at most two of `against`) and `W2702 <path>:1:1 unchecked <name> #<id> on <store> (<reason>)`; pretty adds each concurrent entry and a hint; json is the record encoded by `RaceRecord`.
- **Dependencies:** `@keel/cli`, `@keel/reactive`, `@keel/schema`, `@keel/std-sessions` (`./group`), `@keel/store`.
- **Rungs:** conformance (example + probabilistic), property (commuting transactions never race, a race reads the same from either side, `races` is pure).

## Extension points

Uses the **output formatter registry** (k.cli `formatter`).

## Unsafe

count: 0
