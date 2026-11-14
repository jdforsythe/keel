import { type Schema, s } from "@keel/schema";
import { type Store, type Transaction, invariant, store, transaction } from "@keel/store";
import type { Instance } from "../Instance.ts";
import type { Instances } from "../Instances.ts";
import type { LooseStores } from "./LooseStores.ts";

type Next<D> = (from: { state: string; data: D }, event: string, payload: unknown) => { state: string; data: D };

/**
 * The workflow store `id` and its transactions (std.workflows Store), compiled again on every call. `start` adds an
 * instance at `initial` unless its id exists; an event moves an instance that is neither unknown nor final by `next`,
 * raising `entered` and zeroing `attempt` when the state's name changes; `attempt` counts a run of the current entry;
 * `forget` removes a final instance. More than `limit` instances not final fail `store.invariant`.
 */
export function compileStores<S extends string, D>(
  id: string,
  names: readonly [S, ...S[]],
  data: Schema<D>,
  initial: S,
  events: ReadonlyMap<string, Schema<unknown>>,
  next: Next<D>,
  finals: ReadonlySet<string>,
  limit: number,
): () => LooseStores<S, D> {
  const Id = s.string({ min: 1 });
  const row: Schema<Instance<S, D>> = s.object(
    { state: s.enum(names), data, entered: s.int({ min: 0 }), attempt: s.int({ min: 0 }) },
    { closed: true },
  );
  const schema: Schema<Instances<S, D>> = s.object({ instances: s.record(row) }, { closed: true });
  const one = (cur: Instances<S, D>, key: string, r: Instance<S, D> | undefined): Instances<S, D> => {
    const instances = { ...cur.instances };
    if (r === undefined) delete instances[key];
    else instances[key] = r;
    return { instances };
  };
  return () => {
    const st: Store<Instances<S, D>> = store(schema, { instances: {} }, { id });
    invariant(st, (v) => Object.values(v.instances).filter((r) => !finals.has(r.state)).length <= limit);
    const table: Record<string, Transaction<Instances<S, D>, { id: string; payload: unknown }>> = {};
    for (const [event, payload] of events)
      table[event] = transaction(st, `${id}.${event}`, s.object({ id: Id, payload }), (cur, p) => {
        const r = cur.instances[p.id];
        if (r === undefined || finals.has(r.state)) return cur;
        const to = next(r, event, p.payload);
        const state = names.find((n) => n === to.state) ?? r.state;
        const moved = state !== r.state;
        return one(cur, p.id, {
          state,
          data: to.data,
          entered: r.entered + (moved ? 1 : 0),
          attempt: moved ? 0 : r.attempt,
        });
      });
    return {
      store: st,
      start: transaction(st, `${id}.start`, s.object({ id: Id, data }), (cur, p) =>
        cur.instances[p.id] === undefined
          ? one(cur, p.id, { state: initial, data: p.data, entered: 0, attempt: 0 })
          : cur,
      ),
      events: table,
      attempt: transaction(st, `${id}.attempt`, s.object({ id: Id, entered: s.int({ min: 0 }) }), (cur, p) => {
        const r = cur.instances[p.id];
        return r === undefined || r.entered !== p.entered ? cur : one(cur, p.id, { ...r, attempt: r.attempt + 1 });
      }),
      forget: transaction(st, `${id}.forget`, s.object({ id: Id }), (cur, p) => {
        const r = cur.instances[p.id];
        return r === undefined || !finals.has(r.state) ? cur : one(cur, p.id, undefined);
      }),
    };
  };
}
