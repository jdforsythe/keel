import { scope } from "@keel/reactive";
// Spec: std.outbox-owner, clause "With one outbox declared outside a scope, entries queued offline on ctx A with owner `a`, then `drain` with owner `b` on ctx B online: A's entries stay `queued`, none is posted, B's `keel.outbox.<id>` holds none of them, and `resolve` on B for one resolves `false`; a later `drain` with `a` on A online posts each once with its key."
// Seed 1337
// Assumption: two sim ctxs have separate storage; one outbox object (declared with no reactive owner) serves both.
// Assumption: `resolve` resolves a boolean (false for a key the ctx does not hold).
import { drain, outbox, resolve, send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Api, TODOS, createServer, edit, entriesOf, settle, simCtx, stored } from "./fixtures.ts";

let n = 0;
const titles = fc.array(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 3 });

test("With one outbox declared outside a scope, entries queued offline on ctx A with owner `a`, then `drain` with owner `b` on ctx B online: A's entries stay `queued`, none is posted, B's `keel.outbox.<id>` holds none of them, and `resolve` on B for one resolves `false`; a later `drain` with `a` on A online posts each once with its key.", async () => {
  await fc.assert(
    fc.asyncProperty(titles, async (ts) => {
      const id = `ctxs${++n}.outbox`;
      const o = outbox(id, Api, {});
      const a = simCtx();
      const b = simCtx();
      const server = createServer();
      server.attach(a);
      server.attach(b);
      a.net.setOnline(false);
      let base = 0;
      for (const [i, title] of ts.entries())
        await send(a, o, "editTodo", edit(TODOS[i % TODOS.length] ?? "t1", title), { base: base++, owner: "a" });
      const keys = entriesOf(o).map((e) => e.key);
      expect(keys).toHaveLength(ts.length);

      const scB = scope(() => {
        void drain(b, o, { owner: "b" });
      });
      await settle();
      expect(entriesOf(o).map((e) => e.state)).toEqual(ts.map(() => "queued"));
      expect(server.posts).toHaveLength(0);
      const inB = (await stored(b, `keel.outbox.${id}`)).map((e) => e.key);
      for (const k of keys) expect(inB).not.toContain(k);
      const first = keys[0];
      expect(first).toBeDefined();
      expect(await resolve(b, o, first ?? "", "mine")).toBe(false);
      scB.dispose();

      a.net.setOnline(true);
      const scA = scope(() => {
        void drain(a, o, { owner: "a" });
      });
      await settle();
      expect(server.posts.map((p) => p.key)).toEqual(keys);
      expect(server.entries()).toHaveLength(ts.length);
      scA.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});
