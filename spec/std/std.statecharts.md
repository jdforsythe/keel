# std.statecharts: State charts
status: conformance-covered

**Extension points.** Check rule registry: E2751-E2755 through `@keel/std-statecharts/tools`. A chart compiles to a k.store store and one transaction per event, so it needs no capability and no kernel change.

**Declare.** In a client-safe file whose name is the export:
```ts
export const editorChart = chart('todos.editor', {
  data: EditorData, start: { attempts: 0 },
  events: { edit: s.object({}), save: s.object({}), saved: s.object({}), refused: s.object({}), failed: s.object({}), mine: s.object({}), theirs: s.object({}), cancel: s.object({}) },
  guards: { canRetry: (d) => d.attempts < 3 },
  actions: { count: (d) => ({ attempts: Math.min(3, d.attempts + 1) }), reset: () => ({ attempts: 0 }) },
  initial: 'viewing',
  states: {
    viewing: { on: { edit: 'editing' } },
    editing: { on: { save: { to: 'saving', do: 'count' }, cancel: 'viewing' } },
    saving: { on: { saved: { to: 'viewing', do: 'reset' }, refused: 'conflict', failed: [{ to: 'saving', guard: 'canRetry', do: 'count' }, { to: 'gaveUp' }] } },
    conflict: { on: { mine: { to: 'saving', guard: 'canRetry', do: 'count' }, theirs: { to: 'viewing', do: 'reset' } } },
    gaveUp: { final: true },
  },
})
```
`chart(id, { data, start, events, guards?, actions?, initial, states })`: `id` is the store id, prefixed by the declaring module (E1155). `data` is the schema of the chart's own values and `start` their first value; `events` maps each event to its payload schema. A state is `{ on?, final? }`; `on` maps an event to a target: a state name, `{ to?, guard?, do? }` (`to` absent: stay), or a list of those, tried in order. `guards` are pure predicates `(data, payload) => boolean` and `actions` pure updates `(data, payload) => data`, named by `guard` and `do`.

**Compiles to.** The store `id`, state schema `s.object({ state: s.enum(<state names>), data }, { closed: true })`, initial `{ state: initial, data: start }`; and per event the transaction `<id>.<event>` with that event's payload schema. Its function takes the first target of the current state's `on[event]` whose `guard` holds for `(data, payload)`, applies `do` to `data` and moves to `to`; with no such target the state is unchanged. The chart exposes `store`, `events` (each event's `Transaction`), `states`, `initial`, and `enabled(state, event, payload)`, true when that event's transaction would change the state's name or apply a `do`. Writes go through `tx(editorChart.events.save, {})`, under `uses` (k.store) as any transaction.

**Checked.** `keel check` analyzes the declaration as written; `chart` repeats E2751, E2753 and E2754 as throws. Reachability treats every guard as possibly true, so a state E2752 names is unreachable on every run. Guarded reachability and stuck states are k.model's: `coverage(chart, explore(Object.values(chart.events)))` returns `{ unreached, dead }`, the declared states no explored state holds and the non-final states some `terminal` state holds.

**Rules.** E2751 `initial` or a `to` naming no state (fix: the nearest state name) · E2752 a state unreachable from `initial` through `on` targets · E2753 a non-final state with no target to another state (fix: add `final: true`) · E2754 a final state with `on`, an `on` event missing from `events`, or a `guard` or `do` naming no entry · E2755 a `chart` whose `initial`, `events`, `guards`, `actions`, `states`, `on` keys or targets are not literals: a variable, a spread or a computed key (the checker cannot prove it).

**Conformance.**
- The compiled store's schema parses `{ state: initial, data: start }` and refuses a state name outside `states`; each event's transaction is named `<id>.<event>` and its `schema` is that event's payload schema.
- `tx` of an event moves to the first target whose guard holds and applies its `do`; with no applicable target the state and `data` are unchanged.
- `enabled(state, event, payload)` is true exactly when `tx` of that event changes the state's name or applies a `do`.
- Under `explore`'s closed form, a chart with finite `data` and payloads returns `complete: true`, and `coverage` lists a state whose only entry is guarded by an unsatisfiable guard in `unreached`.
- A state whose every exit is guarded false from some reachable `data` appears in `dead`.
- `keel check` reports E2751 to E2755 on fixtures and nothing on their clean twins; E2751 carries a fix to the nearest name and E2753 one adding `final: true`.
- `chart` throws E2751, E2753 and E2754 for those fixtures.
- An event's transaction passes `properties` for a chart whose guards and actions are pure.
