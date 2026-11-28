// std.channels, prose (not a Conformance bullet) "A head below the last `saved` of that store the stream delivered (the store's count restarted because its storage was replaced, k.sync Heads) is delivered as `{ kind: 'reset' }` in its place, and the stream counts from that head on."
// std.channels, prose (not a Conformance bullet) "After a stream's `reset`, each save of a store in its `stores`, by any process on the same data, is followed on that stream by a `saved` of that store with that head or a later one, or by the stream's end."
// Seed: 1337.
// Reading: "storage was replaced" is shown by `set` through the shared `a.storage` of an earlier snapshot of `chan.log`; a restore names a head already saved, and is a no-op while none is; the next `bump` on A or B then saves from that head.
// Reading: a head equal to the last delivered is not above it, so nothing is delivered ("one head may stand for several saves"); above it is `saved`; below it is `reset`.
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { field, settle, waitFor } from "./fixtures.ts";
import { type Pair, SEED, headsOf, serveReplicas } from "./replica-fixtures.ts";

const pairs: Pair[] = [];
afterEach(async () => {
  for (const p of pairs.splice(0)) await p.close();
});

const STORE = "chan.log";
const KEY = `keel.store.${STORE}`;

test("a save whose head is below the last `saved` the stream delivered for that store gives `{ kind: 'reset' }` in its place, and the stream counts from that head on", async () => {
  const p = await serveReplicas();
  pairs.push(p);
  const onB = await p.B.open("r", await p.B.enroll());
  await waitFor(() => onB.events.length >= 1);
  await p.A.act("bump");
  const first = await p.a.storage.get(KEY);
  expect(first).not.toBeNull();
  await p.A.act("bump");
  await p.A.act("bump");
  await waitFor(() => headsOf(onB.events, STORE).includes(3));
  await settle();
  const before = onB.events.length;
  // replace the storage with the snapshot at head 1: the next save is head 2, below the delivered 3
  await p.a.storage.set(KEY, first ?? "");
  await p.B.act("bump");
  expect(await p.headOf(STORE)).toBe(2);
  await waitFor(() => onB.events.length > before);
  await settle();
  expect(onB.events.slice(before)).toEqual([{ kind: "reset" }]);
  // counting from head 2: the next save, head 3, is delivered as saved
  await p.A.act("bump");
  await waitFor(() => onB.events.length > before + 1);
  await settle();
  expect(onB.events.slice(before + 1)).toEqual([{ kind: "saved", store: STORE, head: 3 }]);
  onB.close();
});

test("for any sequence of saves and restores on one store, an open stream receives after each save a `saved` with that head or a `reset`, and between resets the delivered heads strictly rise", async () => {
  const step = fc.oneof(
    fc.record({ kind: fc.constant("save" as const), side: fc.constantFrom("A" as const, "B" as const) }),
    fc.record({ kind: fc.constant("restore" as const), to: fc.integer({ min: 1, max: 6 }) }),
  );
  await fc.assert(
    fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 10 }), async (steps) => {
      const p = await serveReplicas();
      pairs.push(p);
      const streams = [await p.A.open("r", await p.A.enroll()), await p.B.open("r", await p.B.enroll())];
      await waitFor(() => streams.every((st) => st.events.length >= 1));
      const snapshots = new Map<number, string>();
      const last = [0, 0];
      for (const st of steps) {
        if (st.kind === "restore") {
          const raw = snapshots.get(st.to);
          if (raw !== undefined) await p.a.storage.set(KEY, raw);
          continue;
        }
        const marks = streams.map((s) => s.events.length);
        await (st.side === "A" ? p.A : p.B).act("bump");
        const head = await p.headOf(STORE);
        snapshots.set(head, (await p.a.storage.get(KEY)) ?? "");
        await settle(60);
        for (const [i, s] of streams.entries()) {
          const delta = s.events.slice(marks[i] ?? 0);
          const previous = last[i] ?? 0;
          if (head > previous) {
            expect(delta).toEqual([{ kind: "saved", store: STORE, head }]);
          } else if (head < previous) {
            expect(delta).toEqual([{ kind: "reset" }]);
          } else {
            expect(delta).toEqual([]);
          }
          last[i] = head;
          // never silent: that head was delivered as saved, or the stream was reset to it
          expect(
            headsOf(s.events, STORE).includes(head) ||
              delta.some((e) => field(e, "kind") === "reset") ||
              delta.length === 0,
          ).toBe(true);
        }
      }
      for (const s of streams) {
        // between resets, the delivered heads strictly rise
        let run: number[] = [];
        for (const e of s.events) {
          if (field(e, "kind") === "reset") run = [];
          const h = field(e, "kind") === "saved" && field(e, "store") === STORE ? field(e, "head") : undefined;
          if (typeof h === "number") {
            expect(run.every((x) => x < h)).toBe(true);
            run.push(h);
          }
        }
        s.close();
      }
    }),
    { seed: SEED, numRuns: 8 },
  );
});
