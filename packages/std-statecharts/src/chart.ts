import { owner } from "@keel/reactive";
import { type Schema, defect, s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { asEvents } from "../unsafe/asEvents.ts";
import { loosen } from "../unsafe/loosen.ts";
import type { Chart } from "./Chart.type.ts";
import type { ChartInstance } from "./ChartInstance.ts";
import type { ChartSpec } from "./ChartSpec.ts";
import type { ChartState } from "./ChartState.ts";
import type { LooseState } from "./internal/LooseState.ts";
import { analyze } from "./internal/analyze.ts";
import { compileKey } from "./internal/compileKey.ts";
import { shapeOf } from "./internal/shapeOf.ts";
import { targetsOf } from "./internal/targetsOf.ts";

/**
 * Declare a state chart (std.statecharts), compiled to the store `id` with state `{ state, data }` and one transaction
 * `<id>.<event>` per event. A transaction takes the first target of the current state's `on[event]` whose guard holds,
 * applies its `do` to `data` and moves to its `to`; with none the state is unchanged. Throws E2751 (a name naming no
 * state), E2753 (a non-final state with no way out) and E2754 (a final state with `on`, or an event, guard or action
 * name naming no entry). `next(state, event, payload)` is the `{ state, data }` that event's transaction gives, and
 * `taken(state, event, payload)` the target it takes (a bare state name read as `{ to }`) or `undefined`.
 */
export function chart<
  D,
  const Ev extends Readonly<Record<string, Schema<unknown>>>,
  S extends string,
  G extends string = never,
  A extends string = never,
>(id: string, spec: ChartSpec<D, Ev, S, G, A>): Chart<D, Ev, S, G, A> {
  const declared: Readonly<Record<string, LooseState>> = spec.states;
  const problem = analyze(shapeOf({ ...spec, states: declared }))[0];
  if (problem !== undefined) {
    const text = `chart ${id}: ${problem.message}`;
    if (problem.code === "E2751") defect(text, "E2751");
    if (problem.code === "E2753") defect(text, "E2753");
    defect(text, "E2754");
  }
  const names: S[] = [];
  for (const name in spec.states) names.push(name);
  const [first, ...rest] = names;
  if (first === undefined) defect(`chart ${id}: no states`, "E2751");
  const guards = loosen<D, boolean>(spec.guards);
  const actions = loosen<D, D>(spec.actions);
  const pick = (cur: ChartState<string, D>, event: string, payload: unknown) => {
    for (const t of targetsOf(declared[cur.state]?.on?.[event]))
      if (t.guard === undefined || guards[t.guard]?.(cur.data, payload) === true) return t;
    return undefined;
  };
  const gs: G[] = [];
  if (spec.guards) for (const g in spec.guards) gs.push(g);
  const as: A[] = [];
  if (spec.actions) for (const a in spec.actions) as.push(a);
  const taken = <T extends string>(cur: ChartState<T, D>, event: PropertyKey, payload: unknown) => {
    const t = pick(cur, String(event), payload);
    if (t === undefined) return undefined;
    const to = names.find((n) => n === t.to);
    const guard = gs.find((g) => g === t.guard);
    const act = as.find((a) => a === t.do);
    return {
      ...(to === undefined ? {} : { to }),
      ...(guard === undefined ? {} : { guard }),
      ...(act === undefined ? {} : { do: act }),
    };
  };
  const enabled = (state: ChartState<S, D>, event: PropertyKey, payload: unknown) => {
    const t = pick(state, String(event), payload);
    return t !== undefined && (t.do !== undefined || (t.to !== undefined && t.to !== state.state));
  };
  const next = <T extends string>(
    cur: ChartState<T, D>,
    event: PropertyKey,
    payload: unknown,
  ): ChartState<S | T, D> => {
    const t = pick(cur, String(event), payload);
    const act = t?.do === undefined ? undefined : actions[t.do];
    return {
      state: names.find((n) => n === t?.to) ?? cur.state,
      data: act === undefined ? cur.data : act(cur.data, payload),
    };
  };
  const compile = (sid: string): ChartInstance<D, Ev, S> => {
    const st = store(
      s.object({ state: s.enum([first, ...rest]), data: spec.data }, { closed: true }),
      { state: spec.initial, data: spec.start },
      { id: sid },
    );
    const table: Record<string, ReturnType<typeof transaction<ChartState<S, D>, unknown>>> = {};
    for (const event of Object.keys(spec.events))
      table[event] = transaction(st, `${sid}.${event}`, spec.events[event] ?? s.object({}), (cur, payload) =>
        next(cur, event, payload),
      );
    return { store: st, events: asEvents(table), enabled };
  };
  // At a module's top level `owner()` is the compiler's module root, so the store lives as long as the module.
  const at = owner() ?? defect("chart() outside a scope or a module top level", "E1203");
  const own = at.run(() => compile(id));
  return { ...own, data: spec.data, states: spec.states, initial: spec.initial, next, taken, [compileKey]: compile };
}
