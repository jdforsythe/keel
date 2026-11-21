import { scope } from "@keel/reactive";
// Spec: std.outbox-owner, clause "With two ctxs of one seed over one outbox declared outside a scope, sending offline and online under owners `a` and `b` in any order, neither ctx fails, removes, posts or stores the other's entries."
// Seed 1337 (both ctxs and fast-check)
// Assumption: two sim ctxs of seed 1337 draw the same write keys; each has its own storage and its own server route; one outbox object (declared with no reactive owner) serves both.
// Assumption: a sent entry leaves the store, so only entries present before a step are checked after it (a still-present entry keeps its state).
// Assumption: a key may recur across ctxs once the other's entry has left the store, so ownership of entries, posts and stored writes is told by the title each ctx gives its own writes (`c<ctx>-<step>`).
// Assumption: a send while online flushes; `settle` lets that flush finish.
import { drain, outbox, send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Api, TODOS, createServer, edit, entriesOf, settle, simCtx, stored } from "./fixtures.ts";

let n = 0;
const todo = (i: number): string => TODOS[i % TODOS.length] ?? "t1";

interface Step {
  on: 0 | 1;
  owner: "a" | "b";
  online: boolean;
}
const steps = fc.array(
  fc.record({
    on: fc.constantFrom<0 | 1>(0, 1),
    owner: fc.constantFrom<"a" | "b">("a", "b"),
    online: fc.boolean(),
  }),
  { minLength: 1, maxLength: 8 },
);

const snapshot = (o: { get(k: "entries"): readonly unknown[] }): Map<string, string> =>
  new Map(entriesOf(o).map((e) => [e.title ?? "", e.state]));

test("With two ctxs of one seed over one outbox declared outside a scope, sending offline and online under owners `a` and `b` in any order, neither ctx fails, removes, posts or stores the other's entries.", async () => {
  await fc.assert(
    fc.asyncProperty(steps, async (plan: Step[]) => {
      const id = `same${++n}.outbox`;
      const o = outbox(id, Api, {});
      const ctxs = [simCtx(1337), simCtx(1337)] as const;
      const servers = [createServer(), createServer()] as const;
      servers[0].attach(ctxs[0]);
      servers[1].attach(ctxs[1]);
      const titles: [Set<string>, Set<string>] = [new Set(), new Set()];
      for (const [i, step] of plan.entries()) {
        const before = snapshot(o);
        const other = step.on === 0 ? 1 : 0;
        const ctx = ctxs[step.on];
        ctx.net.setOnline(step.online);
        const title = `c${step.on}-${i}`;
        titles[step.on].add(title);
        await send(ctx, o, "editTodo", edit(todo(i), title), { base: servers[step.on].head(), owner: step.owner });
        await settle();
        const after = snapshot(o);
        for (const [k, state] of before) {
          if (!titles[other].has(k)) continue;
          expect(after.get(k)).toBe(state);
        }
      }
      for (const c of [0, 1] as const) {
        for (const p of servers[c].posts) {
          expect(titles[c].has(p.title)).toBe(true);
        }
        const inStorage = await stored(ctxs[c], `keel.outbox.${id}`);
        for (const e of inStorage) {
          expect(titles[c].has(e.title ?? "")).toBe(true);
        }
      }
    }),
    { seed: 1337, numRuns: 40 },
  );
});

test("Ctx A sends offline as `a` and ctx B sends twice as `b` over one outbox of one seed: A's entry stays `queued` and B's storage holds only B's two.", async () => {
  const id = `same${++n}.outbox`;
  const o = outbox(id, Api, {});
  const a = simCtx(1337);
  const b = simCtx(1337);
  const sa = createServer();
  const sb = createServer();
  sa.attach(a);
  sb.attach(b);
  a.net.setOnline(false);
  b.net.setOnline(false);
  await send(a, o, "editTodo", edit("t1", "from-a"), { base: 0, owner: "a" });
  await settle();
  const keysA = entriesOf(o).map((e) => e.key);
  expect(keysA).toHaveLength(1);
  await send(b, o, "editTodo", edit("t2", "b-one"), { base: 0, owner: "b" });
  await send(b, o, "editTodo", edit("t3", "b-two"), { base: 0, owner: "b" });
  await settle();
  const all = entriesOf(o);
  const keysB = all.filter((e) => !keysA.includes(e.key)).map((e) => e.key);
  expect(keysB).toHaveLength(2);
  for (const e of all.filter((x) => keysA.includes(x.key))) expect(e.state).toBe("queued");
  const inB = await stored(b, `keel.outbox.${id}`);
  expect(inB.map((e) => e.key).sort()).toEqual([...keysB].sort());
  expect(inB.map((e) => e.title).sort()).toEqual(["b-one", "b-two"]);
  const inA = await stored(a, `keel.outbox.${id}`);
  expect(inA.map((e) => e.key)).toEqual(keysA);
  expect(sa.posts).toHaveLength(0);
  expect(sb.posts).toHaveLength(0);
});

test("Ctx A queues offline as `a`, ctx B sends online as `b` and gets `sent`: A's entry is still in the store, and a `drain` with `a` on A online posts it.", async () => {
  const id = `same${++n}.outbox`;
  const o = outbox(id, Api, {});
  const a = simCtx(1337);
  const b = simCtx(1337);
  const sa = createServer();
  const sb = createServer();
  sa.attach(a);
  sb.attach(b);
  a.net.setOnline(false);
  await send(a, o, "editTodo", edit("t1", "from-a"), { base: 0, owner: "a" });
  await settle();
  const keysA = entriesOf(o).map((e) => e.key);
  expect(keysA).toHaveLength(1);

  const r = await send(b, o, "editTodo", edit("t2", "from-b"), { base: 0, owner: "b" });
  await settle();
  expect(r.state).toBe("sent");
  const now = entriesOf(o);
  expect(now.filter((e) => keysA.includes(e.key)).map((e) => e.state)).toEqual(["queued"]);
  expect(sa.posts).toHaveLength(0);
  expect(sb.posts.map((p) => p.title)).toEqual(["from-b"]);
  expect((await stored(a, `keel.outbox.${id}`)).map((e) => e.key)).toEqual(keysA);

  a.net.setOnline(true);
  const sc = scope(() => {
    void drain(a, o, { owner: "a" });
  });
  await settle();
  expect(sa.posts.map((p) => p.key)).toEqual(keysA);
  expect(sa.entries()).toHaveLength(1);
  sc.dispose();
});
