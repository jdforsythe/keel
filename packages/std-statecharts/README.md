# @keel/std-statecharts

**Spec:** std.statecharts · **Status:** declared · **verified:** (none)

Flat state charts compiled to a store and one transaction per event, checked by `keel check` and explored by `explore`.

## Contract

- **Public API** (`.`, client-safe):
  - `chart(id, { data, start, events, guards?, actions?, initial, states })` returns `{ store, events, states, initial, enabled }`. `store` has id `id` and state `{ state, data }` (schema `s.object({ state: s.enum(<state names>), data }, { closed: true })`, initial `{ state: initial, data: start }`). `events[e]` is the transaction `<id>.<e>` with `e`'s payload schema; it takes the first target of the current state's `on[e]` whose guard holds, applies its `do` and moves to its `to` (absent: stay); with none the state is unchanged. `states` is the declared `states` object. `enabled(state, event, payload)` is true when that event's transaction would change the state's name or apply a `do`.
  - Types: state names, event names and payloads, and `guard` and `do` names are checked against the declaration; a guard or action reads the payload fields of every event at once.
  - `chart` throws E2751 (a name naming no state), E2753 (a non-final state with no target to another state) and E2754 (a final state with `on`, or an event, guard or action name naming no entry); the message starts with the code.
  - `coverage(chart, result)` takes an `explore` result (k.model) as data and returns `{ unreached, dead }`: the declared states no explored state holds, and the non-final states some terminal state holds, in declaration order.
  - Types `Chart`, `ChartSpec`, `ChartState`, `Coverage`, `StateSpec`, `Target`.
  - `./tools` (node): rules E2751 (fix: the nearest state name), E2752 (a state unreachable from `initial`, every guard taken as possibly true), E2753 (fix: `{ final: true }` for a state with no `on` entries), E2754, and E2755 (a declaration part that is not a literal; the chart's other rules are then skipped), each registered at import.
- **Dependencies:** `@keel/check` (tools only), `@keel/schema`, `@keel/store`.
- **Rungs:** conformance (examples and properties, seed 1337); a property that a generated declaration throws a structural code exactly when it names no state.

## Extension points

Uses the **check rule registry** (k.check: E2751 to E2755 from `./tools`).

## Unsafe

count: 2
- `unsafe/loosen.ts`: guards and actions are typed with every event's payload fields at once and called with one event's payload.
- `unsafe/asEvents.ts`: the per-event transaction table is typed by each event's payload schema.
