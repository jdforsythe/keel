// Spec: std.channels, clause "Under sim, with `createApp` A on ctx `a` and B on `b = replica(a)` (k.sim Replicas) serving one channel route with `stores`, a member stream open on B gets `reset`, then `{ kind: 'saved', store, head }` after an action on A saves that store, `head` being the head A's save produced."
// Spec: std.channels, clause "Under sim, with A and B as above, for a generated sequence of saves of one store by actions on A and on B, the `saved` heads on each member stream open on A or on B strictly rise, and once the run settles the last equals the store's head."
// Spec: std.channels, clause "Under sim, with A and B as above, a member stream open on B for which `member` turns false after a save on A gets `{ kind: 'closed', reason: 'denied' }` in place of that save's `saved`, then its end; the events before it are those of earlier saves."
// Spec: std.channels, clause "Under sim, with A and B as above, a member's publish on A delivers `{ kind: 'message', message }` to A's member streams of that channel and params and to none of B's."
// Spec: std.channels, clause "On a real ctx whose storage driver has a `watch` the test controls, two member streams of routes with `stores` call `watch` once; neither gets `reset` before it resolves; `on({ kind: 'lost' })` ends both with no `closed` event; a stream opened after that calls `watch` again; and the function `watch` resolved runs when the last stream ends."
// Spec: std.channels, clause "On a real ctx whose storage driver has no `watch`, a member stream of a route with `stores` gets `reset` at open."
// Seed: 1337.
// Reading: "one store" in the second clause is held for each of `chan.log` and `chan.notes`; a generated save is a `bump` or a `note` by an action on A or on B, and the `saved` events of each store on each stream are checked.
// Reading: the saved events carry exactly `kind`, `store` and `head`; saves carry generated secret-looking text and no event or raw stream holds it (Privacy, "Events carry no caller, cookie or store state").
// Reading: "ends" is the stream's response body ending; with `lost` no `closed` event precedes it, so the stream's events are exactly `[reset]`.
// Reading: the controlled storage's `watch` returns a promise the test resolves; a stopped watch is one whose resolved function ran.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { type Stream, field, roomChannel, settle, waitFor } from "./fixtures.ts";
import { type Pair, type Replica, SEED, STORES, headsOf, serveOn, serveReplicas } from "./replica-fixtures.ts";

const pairs: Pair[] = [];
const replicas: Replica[] = [];
afterEach(async () => {
  for (const p of pairs.splice(0)) await p.close();
  for (const r of replicas.splice(0)) await r.close();
});
const pairOf = async (): Promise<Pair> => {
  const p = await serveReplicas();
  pairs.push(p);
  return p;
};

const REPLICAS =
  "Under sim, with `createApp` A on ctx `a` and B on `b = replica(a)` (k.sim Replicas) serving one channel route with `stores`";

test(`${REPLICAS}, a member stream open on B gets \`reset\`, then \`{ kind: 'saved', store, head }\` after an action on A saves that store, \`head\` being the head A's save produced`, async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 4 }),
      fc.constantFrom("bump" as const, "note" as const),
      async (times, op) => {
        const { A, B, headOf } = await pairOf();
        const cookie = await B.enroll();
        const onB = await B.open("r", cookie);
        await waitFor(() => onB.events.length >= 1);
        expect(onB.events).toEqual([{ kind: "reset" }]);
        const store = op === "bump" ? "chan.log" : "chan.notes";
        for (let i = 1; i <= times; i++) {
          await A.act(op);
          const head = await headOf(store);
          expect(head).toBe(i);
          await waitFor(() => headsOf(onB.events, store).includes(head));
          expect(onB.events).toContainEqual({ kind: "saved", store, head });
        }
        expect(onB.events[0]).toEqual({ kind: "reset" });
        onB.close();
      },
    ),
    { seed: SEED, numRuns: 8 },
  );
});

test("under sim, with A and B as above, for a generated sequence of saves of one store by actions on A and on B, the `saved` heads on each member stream open on A or on B strictly rise, and once the run settles the last equals the store's head", async () => {
  const secret = fc.hexaString({ minLength: 8, maxLength: 16 }).map((h) => `sk_live_${h}`);
  const save = fc.record({
    side: fc.constantFrom("A" as const, "B" as const),
    op: fc.constantFrom("bump" as const, "note" as const),
    text: secret,
  });
  await fc.assert(
    fc.asyncProperty(fc.array(save, { minLength: 1, maxLength: 8 }), async (saves) => {
      const p = await pairOf();
      const onA = await p.A.open("r", await p.A.enroll());
      const onB = await p.B.open("r", await p.B.enroll());
      await waitFor(() => onA.events.length >= 1 && onB.events.length >= 1);
      for (const sv of saves) await (sv.side === "A" ? p.A : p.B).act(sv.op, sv.text);
      for (const store of STORES) {
        const head = await p.headOf(store);
        if (head > 0) await waitFor(() => [onA, onB].every((st) => headsOf(st.events, store).at(-1) === head));
      }
      await settle();
      for (const st of [onA, onB]) {
        for (const store of STORES) {
          const heads = headsOf(st.events, store);
          expect(heads.every((h, i) => i === 0 || h > (heads[i - 1] ?? 0))).toBe(true);
          const head = await p.headOf(store);
          if (head > 0) expect(heads.at(-1)).toBe(head);
          else expect(heads).toEqual([]);
        }
        for (const e of st.events.slice(1)) {
          expect(field(e, "kind")).toBe("saved");
          expect(Object.keys(Object(e)).sort()).toEqual(["head", "kind", "store"]);
        }
        for (const sv of saves) expect(st.raw().includes(sv.text)).toBe(false);
        st.close();
      }
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("under sim, with A and B as above, a member stream open on B for which `member` turns false after a save on A gets `{ kind: 'closed', reason: 'denied' }` in place of that save's `saved`, then its end; the events before it are those of earlier saves", async () => {
  const { A, B, headOf } = await pairOf();
  const onB = await B.open("r", await B.enroll());
  const other = await B.open("r", await B.enroll());
  await waitFor(() => onB.events.length >= 1 && other.events.length >= 1);
  await A.act("clear");
  await waitFor(() => onB.ended());
  // The enrolment of `other` on B is itself a save of `chan.members` that `onB` saw: the events before `closed` are those of earlier saves.
  const events = onB.events;
  const closedAt = events.findIndex((e) => field(e, "kind") === "closed");
  expect(events[0]).toEqual({ kind: "reset" });
  expect(events[closedAt]).toEqual({ kind: "closed", reason: "denied" });
  expect(closedAt).toBe(events.length - 1);
  for (const e of events.slice(1, closedAt)) expect(field(e, "kind")).toBe("saved");
  // the denying save (the clear) produced no `saved`: every head before `closed` is below the store's head
  const denying = await headOf("chan.members");
  expect(headsOf(events, "chan.members").includes(denying)).toBe(false);
  // `member` is false for every caller after the clear: the other member's stream is closed the same way.
  await waitFor(() => other.ended());
  expect(other.events.at(-1)).toEqual({ kind: "closed", reason: "denied" });
});

test("under sim, with A and B as above, a member's publish on A delivers `{ kind: 'message', message }` to A's member streams of that channel and params and to none of B's", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.hexaString({ minLength: 16, maxLength: 24 }).map((h) => `sk_live_${h}`),
      async (text) => {
        const { A, B } = await pairOf();
        const cookieA = await A.enroll();
        const a1 = await A.open("r", cookieA);
        const a2 = await A.open("r", await A.enroll());
        const b1 = await B.open("r", await B.enroll());
        await waitFor(() => [a1, a2, b1].every((st) => st.events.length >= 1));
        const before = b1.events.length;
        const res = await A.post(roomChannel.path, { message: { text } }, { cookie: cookieA, search: "?room=r" });
        expect(res.status).toBe(200);
        const want = { kind: "message", message: { text } };
        await waitFor(() => [a1, a2].every((st) => st.events.some((e) => JSON.stringify(e) === JSON.stringify(want))));
        await settle();
        expect(b1.events).toHaveLength(before);
        expect(b1.raw().includes(text)).toBe(false);
        for (const st of [a1, a2, b1]) st.close();
      },
    ),
    { seed: SEED, numRuns: 6 },
  );
});

// ---- a real ctx whose storage driver's `watch` the test controls ----

interface Gate {
  readonly promise: Promise<void>;
  resolve(): void;
}
function gate(): Gate {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

type Reporter = (e: { kind: "committed"; keys: readonly string[] } | { kind: "lost" }) => void;

/** A storage over a Map; `withWatch` adds a `watch` whose promise `gates[i]` resolves, recording each call and each stop. */
function memoryStorage(withWatch: boolean) {
  const data = new Map<string, string>();
  const gates: Gate[] = [];
  const ons: Reporter[] = [];
  const stopped: boolean[] = [];
  const base = {
    get: (key: string) => Promise.resolve(data.get(key) ?? null),
    set: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
    read: (keys: readonly string[]) => Promise.resolve(keys.map((k) => data.get(k) ?? null)),
    commit: (writes: ReadonlyArray<{ key: string; expect: string | null; value?: string }>) => {
      if (writes.some((w) => (data.get(w.key) ?? null) !== w.expect)) return Promise.resolve(false);
      for (const w of writes) if (w.value !== undefined) data.set(w.key, w.value);
      return Promise.resolve(true);
    },
  };
  const watch = (on: Reporter): Promise<() => void> => {
    const i = gates.length;
    const g = gate();
    gates.push(g);
    ons.push(on);
    stopped.push(false);
    return g.promise.then(() => () => {
      stopped[i] = true;
    });
  };
  return { storage: withWatch ? { ...base, watch } : base, gates, ons, stopped };
}

test("on a real ctx whose storage driver has a `watch` the test controls, two member streams of routes with `stores` call `watch` once; neither gets `reset` before it resolves", async () => {
  const m = memoryStorage(true);
  const ctx = createCtx({ mode: "real", drivers: { storage: m.storage } });
  const app = await serveOn(ctx);
  const cookie = await app.enroll();
  replicas.push(app);
  const opened: Stream[] = [];
  const first = app.open("r", cookie).then((st) => opened.push(st));
  const second = app.open("r", cookie).then((st) => opened.push(st));
  await settle();
  expect(m.gates).toHaveLength(1);
  expect(opened.flatMap((st) => st.events)).toEqual([]);
  m.gates[0]?.resolve();
  await Promise.all([first, second]);
  await waitFor(() => opened.length === 2 && opened.every((st) => st.events.length >= 1));
  expect(opened.map((st) => st.events)).toEqual([[{ kind: "reset" }], [{ kind: "reset" }]]);
  expect(m.gates).toHaveLength(1);
  for (const st of opened) st.close();
});

test("on a real ctx with a controlled `watch`, `on({ kind: 'lost' })` ends both streams with no `closed` event, and a stream opened after that calls `watch` again", async () => {
  const m = memoryStorage(true);
  const ctx = createCtx({ mode: "real", drivers: { storage: m.storage } });
  const app = await serveOn(ctx);
  const cookie = await app.enroll();
  replicas.push(app);
  const pending = [app.open("r", cookie), app.open("r", cookie)];
  await settle();
  m.gates[0]?.resolve();
  const [one, two] = await Promise.all(pending);
  if (one === undefined || two === undefined) throw new Error("streams did not open");
  await waitFor(() => one.events.length >= 1 && two.events.length >= 1);
  m.ons[0]?.({ kind: "lost" });
  await waitFor(() => one.ended() && two.ended());
  await settle();
  expect(one.events).toEqual([{ kind: "reset" }]);
  expect(two.events).toEqual([{ kind: "reset" }]);
  expect(m.gates).toHaveLength(1);
  const third = app.open("r", cookie);
  await settle();
  expect(m.gates).toHaveLength(2);
  m.gates[1]?.resolve();
  const st = await third;
  await waitFor(() => st.events.length >= 1);
  expect(st.events).toEqual([{ kind: "reset" }]);
  expect(m.stopped[1]).toBe(false);
  // the function `watch` resolved runs when the last stream ends
  st.close();
  await waitFor(() => m.stopped[1] === true);
});

test("on a real ctx with a controlled `watch`, the function `watch` resolved runs when the last stream ends and not before", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 4 }),
      fc.array(fc.nat(), { minLength: 4, maxLength: 4 }),
      async (n, order) => {
        const m = memoryStorage(true);
        const ctx = createCtx({ mode: "real", drivers: { storage: m.storage } });
        const app = await serveOn(ctx);
        const cookie = await app.enroll();
        try {
          const pending = Array.from({ length: n }, () => app.open("r", cookie));
          await settle();
          m.gates[0]?.resolve();
          const streams = await Promise.all(pending);
          await waitFor(() => streams.every((st) => st.events.length >= 1));
          expect(m.gates).toHaveLength(1);
          // close in a generated order; the last to close runs the stop
          const sequence = streams
            .map((st, i) => ({ st, key: order[i] ?? 0, i }))
            .sort((x, y) => x.key - y.key || x.i - y.i);
          for (const [k, { st }] of sequence.entries()) {
            st.close();
            await waitFor(() => st.ended());
            await settle();
            if (k < n - 1) expect(m.stopped[0]).toBe(false);
          }
          await waitFor(() => m.stopped[0] === true);
        } finally {
          await app.close();
        }
      },
    ),
    { seed: SEED, numRuns: 6 },
  );
});

test("on a real ctx whose storage driver has no `watch`, a member stream of a route with `stores` gets `reset` at open", async () => {
  const m = memoryStorage(false);
  const ctx = createCtx({ mode: "real", drivers: { storage: m.storage } });
  const app = await serveOn(ctx);
  const cookie = await app.enroll();
  replicas.push(app);
  const st = await app.open("r", cookie);
  await waitFor(() => st.events.length >= 1);
  expect(st.events).toEqual([{ kind: "reset" }]);
  st.close();
  expect(m.gates).toHaveLength(0);
});
