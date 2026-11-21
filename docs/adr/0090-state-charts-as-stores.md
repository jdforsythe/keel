# ADR-0090: state charts compile to a store and one transaction per event (RFC 0082)

**Status:** accepted (2026-11-10), user decision D1 (flat charts), under the WORKFLOW RFC defaults 2, 3 and 6.

**Context.** Flows were hand-coded status fields. Nothing declared which statuses a flow has or which events move between them, and nothing checked that a status can be left.

**Decision.** std.statecharts, a new stdlib package `@keel/std-statecharts`. `chart(id, { data, start, events, guards, actions, initial, states })` declares flat states, one `initial` and some `final`, events with payload schemas, and targets with an optional named pure guard and action over `data`. It compiles to the store `id` (state `{ state, data }`) and to the transaction `<id>.<event>` per event; an event no target of the current state accepts leaves the state unchanged, and `enabled` tells a component so. `keel check` analyzes the literal declaration (E2751 unknown target, E2752 unreachable state, E2753 non-final state with no way out, E2754 bad event, guard or action name, E2755 non-literal declaration), and `chart` throws E2751, E2753 and E2754. `coverage(chart, explore(...))` names the states `explore` never reached and the non-final states it found stuck.

**Alternatives.**
- XState, rejected: a second state model and actor runtime whose transitions are not logged transactions and which sessions cannot replay.
- Nested and parallel states in S5, rejected by the user (D1): they add entry, exit, history and region semantics; a later RFC can add one level.
- Refusing an unhandled event with `err`, rejected: k.store has no refusal path a transaction can take for this.

**Consequences.**
- A chart is logged, owned through `uses`, recorded by sessions, and checked by `properties` and `explore` like any store.
- golden-1's `editorChart` is the exit proof's `proven` item (D2).
- Codes E2750 to E2799 belong to std.statecharts.
