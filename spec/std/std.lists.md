# std.lists: List primitives
status: proposed

**Exports.** `@keel/std-headless` exports the list behaviour its widgets build on, so an app component built on `Part` (k.aria, k.roles) holds the same keyboard model: `listChart`, `stableRows` and the type `ListState`.

**listChart.** `listChart(id, part, options: () => readonly O[], ctx?)` returns a `ListState<O>` for an `O extends Option` (std.options), created in the calling component's scope:
- Computeds, read with `.get()`: `list` (the options, keys checked: E2801), `index` (the active option's index in `list`, -1 for none), `open`, `activeId` (the part id `<id>.<part>.<key>` of the active option, `""` when none), and `rows` (`stableRows` of the list).
- Functions, reactive where they read: `current(key)`, `activeOption()`, `indexOf(key)`, `partId(key)`, `back()`.
- Events of the `optionsChart` instance keyed by `id` (std.headless): `opened(at)`, `close(back)`, `choose()`, `move(by: 'next' | 'prev' | 'first' | 'last', wrap)` and `jump(to)`. `at` and `to` are indexes into `list`: `opened(at)` opens a closed list with option `at` active, and none active when `at` is -1 or not below the list's length; on an open list it does nothing.
- `typeahead(k: KeyInput): boolean`: std.options typeahead (a printable `key` without `mod`; the buffer empties 500 ms after the last key by `ctx.clock`, and without `ctx` at each key), returning true for each key it takes.

**Why computeds.** State is a `Computed`, as `rows` is and as `stableRows` returns, so a `Part` prop takes it as is (k.aria) and a test reads it with `.get()`; the queries and the events are plain functions.

**stableRows.** `stableRows(list: () => readonly T[], keyOf: (t: T) => string)` returns a `Computed` (read with `.get()`) of `{ key }` objects, one per key, the same object while the key stays in the list, so a keyed `For` over it keeps each row.

**Conformance.**
- `move('next', false)` at the last option leaves it active; with `wrap` true the first becomes active.
- Under a sim ctx, `typeahead` of `b` then `a` within 500 ms makes the first option after the active one whose text starts `ba` active; a key 600 ms later starts a new buffer; `typeahead` of `ArrowDown` returns false.
- `activeId.get()` is `w.option.k2` when option `k2` of widget `w` is active, and `""` before `opened`.
- `opened(2)` on a closed list of five makes `index.get()` 2 and `open.get()` true; `opened(5)` makes `index.get()` -1; `opened(0)` on an open list leaves `index.get()` as it was.
- `stableRows` returns the same object for a key kept across a list change and a new one for an added key.
- A key that is not 1 to 64 of `[A-Za-z0-9_-]` in `options` throws E2801 at the `listChart` call.
