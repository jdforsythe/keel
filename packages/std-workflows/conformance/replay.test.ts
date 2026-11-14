import { ok } from "@keel/schema";
import { tx } from "@keel/store";
// Spec: std.workflows, Conformance "Restoring the store's snapshot and replaying its log from `initial` gives its state."
// Seed: 1337.
// Assumption: `store.snapshot()` is `{ state, log, initial, head }` with log entries `{ name, payload }`, and `store.restore(snapshot)` accepts it (k.store);
// a log entry's transaction is found as the one of the workflow's stores whose `schema` is `store.payloads.get(entry.name)` (k.store `payloads`).
// Assumption: a fresh sim ctx has empty storage, so its factory stores start from `initial`.
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Data, type Ev, dataArb, evArb, fire, makeFlow, mutate, rowsOf, sim, start } from "./fixtures.ts";

const never = async () => ok({ freed: 0 });
const program = fc.tuple(
  fc.array(dataArb, { minLength: 1, maxLength: 4 }),
  fc.array(fc.tuple(fc.nat({ max: 3 }), evArb), { maxLength: 14 }),
);

async function record(datas: Data[], events: [number, Ev][]) {
  const ctx = sim();
  const f = makeFlow({ run: never });
  const ids = datas.map(() => ctx.random.id("Flow"));
  for (const [i, id] of ids.entries()) await start(ctx, f, id, datas[i] ?? datas[0] ?? { n: 0, freed: 0, code: "" });
  const snap = await mutate(ctx, f, (S) => {
    for (const [pick, ev] of events) fire(S, ids[pick % ids.length] ?? ctx.random.id("Flow"), ev);
    return structuredClone(S.store.snapshot());
  });
  return { f, snap };
}

test("Restoring the store's snapshot and replaying its log from `initial` gives its state.", async () => {
  await fc.assert(
    fc.asyncProperty(program, async ([datas, events]) => {
      const { f, snap } = await record(datas, events);
      // restoring the snapshot gives its state
      const restored = await mutate(sim(), f, (S) => {
        S.store.restore(structuredClone(snap));
        return rowsOf(S);
      });
      expect(restored).toEqual(snap.state.instances);
      // replaying the log from `initial` gives its state
      const replayed = await mutate(sim(), f, (S) => {
        S.store.restore({ ...S.store.snapshot(), state: snap.initial, initial: snap.initial, log: [] });
        const all = [S.start, S.attempt, S.forget, ...Object.values(S.events)];
        for (const entry of snap.log) {
          const schema = S.store.payloads.get(entry.name);
          const t = all.find((c) => c.schema === schema);
          if (t === undefined) throw new Error(`no transaction for ${entry.name}`);
          tx(t, entry.payload);
        }
        return rowsOf(S);
      });
      expect(replayed).toEqual(snap.state.instances);
    }),
    { seed: 1337, numRuns: 25 },
  );
});
