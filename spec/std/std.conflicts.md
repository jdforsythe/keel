# std.conflicts: Races
status: conformance-covered

A rebased entry (k.sync: it holds `base`) was written by someone who had not seen the entries committed between `base` and it, its concurrent entries. It races them when order matters: applied before them, it gives a different result than after them. A `'rebase'` declaration says any order is acceptable; a race is evidence that the transaction should be `'reject'`, or that its payload carries a value read from a stale copy.

**Extension points.** Output formatter registry: `conflicts.race` renders a race as a diagnostic (E2701, W2702). Check rule registry: the explanations of E2701 and W2702. Importing `@keel/std-conflicts/tools` registers both.

**API.**
- `races(snapshot, stores)`: `snapshot` is a server store as stored (`keel.store.<id>`), `stores` the factory (k.server Server state) that declares its transactions; the store checked is the factory's first whose schema accepts `snapshot.state` and that declares every logged transaction. Returns `{ races: Race[], unchecked: Unchecked[] }`. For each rebased entry `e` with concurrent entries `C`, from the state at `base` (replayed from `initial`) it applies `C` then `e`, and `e` then `C`, each entry with its own transaction function and the store's invariants. An order fails when an entry is refused or its transaction function throws a `TypeError` or `RangeError`, as a reducer does that reads a state its author did not expect. `e` races when exactly one order fails, or both succeed with different states. States compare as JSON, except that an array whose items are all objects with a string `id` compares as a set keyed by `id`.
- `Race` is `{ store, entry: Ref, against: Ref[], kind: 'order' | 'invalid' }` (`invalid`: one order fails), `Ref` is `{ id, name, key? }`, `against` lists `C`. An entry whose base state cannot be rebuilt is `Unchecked` `{ store, id, reason }`: `folded` when `base` is older than the kept log, `undo` when an id gap (an undo) lies between the kept log's start and the entry, `threw` when a transaction function throws any other `Error` (a dependency's failure) while `e`'s base or orders are applied: `e` is not judged and the analysis goes on. A defect, and a thrown value that is no `Error`, pass out of `races`.
- `findRaces(group, { user, serve, stores })` replays a session group with `replayGroup` (std.multi) and runs `races` on the final snapshot of every store the replayed server holds that a factory in `stores` declares: `{ replay, races, unchecked }`.
- Compact: `E2701 <file>:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 on api.board` (at most two of `against`, then ` +n` before ` on <store>`); an unchecked entry is `W2702 <file>:1:1 unchecked api.editTodo #6 on api.board (folded)`. A record is `{ kind: 'conflicts.race', code, path, store, entry: Ref, against: Ref[], reason }`: `path` is the file the analysis read; `code` is E2701 with `reason` the race's kind, or W2702 with `reason` the unchecked reason and `against` empty. `raceRecords(path, { races, unchecked }, server)` builds them, naming an unchecked entry from its store's snapshot in `server`.

**Entries.** The main entry exports `races`, `findRaces`, `raceRecords` and the schema `RaceRecord`, registers nothing and reaches no CLI-time package (k.module **Std config**). `@keel/std-conflicts/tools` is the CLI-time half: it has no exports, calls `formatter('conflicts.race', ...)` (`@keel/cli`) and defines the rules E2701 and W2702 (`@keel/check`), and `keel check` and `keel build` load it for a project with `@keel/std-conflicts` in a module's `deps`. Code that renders the records outside `keel` imports it.

The analysis is pure and never runs on a request: it needs the state at `base`, which a request does not hold, and a refusal there would depend on timing. It runs where order is reproducible: a replay, a test, or a snapshot.

**Rules.** E2701 a rebased entry races its concurrent entries · W2702 a rebased entry whose base state cannot be rebuilt or whose transaction threw (`folded`, `undo`, `threw`). Both diag the file at 1:1.

**Conformance.**
- A rebased entry setting a todo's title after a concurrent entry setting it to another value is one `order` race whose `against` names that entry.
- Two concurrent rebased toggles of one todo, and concurrent rebased adds of items with distinct `id`s, are no race.
- A rebased entry whose other order fails an invariant is an `invalid` race.
- A rebased entry whose `base` is older than the kept log is `unchecked` `folded`; one after an undo since the kept log's start is `unchecked` `undo`.
- In a snapshot with two rebased entries, one of a transaction whose function throws `new Error('sdk down')` and one that is an `order` race, `races` returns that `order` race and `{ store, id, reason: 'threw' }` for the first; with the function calling `defect('bug')` in place of the throw, `races` throws a value `isDefect` accepts.
- Entries without `base` are never examined: a snapshot with none gives `{ races: [], unchecked: [] }`.
- `races` returns equal results for equal inputs and leaves `snapshot` and every live store unchanged.
- On a group whose replayed server holds a rebased lost update, `findRaces` reports it, and on the same group with that transaction `'reject'` it reports none; two runs are byte-equal.
- The `conflicts.race` formatter renders a race as E2701 and an unchecked entry as W2702 in compact and json.
- With only `@keel/std-conflicts` imported, `respond(raceRecords(...))` (`@keel/cli/testing`) yields E1054 and `rules()` lists neither E2701 nor W2702; after `import('@keel/std-conflicts/tools')` it prints the compact lines, `rules()` lists both and a second `formatter('conflicts.race', ...)` throws E1053.
- `@keel/std-conflicts` exports exactly the values `RaceRecord`, `findRaces`, `raceRecords` and `races`, and `@keel/std-conflicts/tools` exports nothing; the package's `exports` has the keys `.` and `./tools`.
