# std.workflows: reserved event names and guarded self entries

Proposal for two of the three defects of backlog line 0618; the third (E2352 and W2353 silent when the chart file is not checked) is fixed in `@keel/std-workflows` without a spec change.

## 1. A chart event named `start`, `attempt` or `forget`

Today `stores(ctx)` throws the store's own error, `store <id>: transaction name "<id>.start" empty or taken`, with no code. No existing E235x covers it: E2352 is about steps and waits naming states and events, W2353 about compensation, E2351 and E2354 about files and modules. A new code, E2355, the next unused in the block.

Spec edits in `spec/std/std.workflows.md` (section after all four: 5,977 chars, 1,495 tokens of 1,500):
- Extension points: "`@keel/std-workflows/tools` registers E2351-E2355."
- Store: the sentence ends at "Transactions are named `<id>.start`, `<id>.<event>`, `<id>.attempt` and `<id>.forget`." (the clause ", so a chart event named `start`, `attempt` or `forget` makes `stores(ctx)` throw (a taken name, k.store)" is removed; Rules carries it).
- Rules, after E2352: "· E2355 a chart event named `start`, `attempt` or `forget`, a name its transactions take (no fix; `workflow` throws it)".
- Conformance: "E2351 to E2355 each fire on a fixture and not on its clean twin; `workflow` throws E2352 and E2355."

Conformance cases wanted: `workflow` over a chart with an event `start`, `attempt` or `forget` throws a message starting `E2355`, and over its clean twin (the event renamed) does not; `keel check` reports E2355 on the workflow file for that fixture and nothing on the twin.

Code in outline: `workflow` throws `E2355 workflow <id>: chart event <name> takes the name of a workflow transaction; rename it` before `compileStores`, for any key of `chart.events` in `start`, `attempt`, `forget`; a rule `reservedEvent` in `src/tools` reads the chart through `readyFlows` and reports each such event at the `chart` property of the workflow call; `src/tools/index.ts` exports it and README lists E2355.

Recommendation: add E2355, thrown by `workflow` and reported by `keel check`. It fails at declaration, where the step and wait errors already fail, instead of at the first request.

## 3. Two guarded targets on one event, one back to its own state and one with no `to`

`on: { pick: [{ to: 'picking', guard: 'self' }, { guard: 'stay' }] }`: when `self` holds the chart takes the self target, which std.workflows Store already counts as an entry ("a taken target with a `to`, its own state too, raises `entered` by one"), but the instance keeps its entry. The workflow sees only `next` and `enabled`; with neither target applying a `do`, both give the same answer for either target, and `chart` exposes no guards. The std.workflows text is right; the missing part is in std.statecharts.

Spec edits in `spec/std/std.statecharts.md` (section after both: 5,713 chars, 1,429 tokens of 1,500):
- Compiles to: "... `enabled(state, event, payload)`, true when that event's transaction would change the state's name or apply a `do`, `next({ state, data }, event, payload)`, the `{ state, data }` that event's transaction gives, and `taken({ state, data }, event, payload)`, the target it takes or `undefined`."
- Conformance: "For generated `{ state, data }` and payloads, `next` equals the state `tx` of that event gives from it, and `taken` is the first target of `on[event]` whose guard holds."

Conformance cases wanted: std.statecharts, the property above (`taken` as `{ to?, guard?, do? }`, a string target as `{ to }`); std.workflows, a chart with `[{ to: own, guard: a }, { guard: b }]` raises `entered` exactly when `a` holds, for generated guard values (the reproducing case is `test/edges.test.ts`, marked `test.fails`).

Code in outline: `@keel/std-statecharts` `chart` returns `taken` from its existing `pick`, and `Chart.type.ts` declares it; in `@keel/std-workflows`, `entryOf` becomes `enters: taken(from, event, payload)?.to !== undefined`, and the target walk with `enabled` goes.

Recommendation: add `taken` to std.statecharts and read it in std.workflows. It removes the guess from `entryOf` and needs no new code.
