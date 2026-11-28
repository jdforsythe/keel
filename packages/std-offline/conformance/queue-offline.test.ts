// Spec: std.offline, clause "After `setOnline(false)`, three `send`s resolve `queued`, post nothing, and leave the three entries in order in `ctx.storage` `keel.outbox.<id>`; `drain` on a new ctx over that storage holds them `queued`."
// Seed 1337
// Assumption: storage holds the outbox state `{ entries }` as a JSON string or a JSON value; both are read.
// Assumption: the new ctx is offline, so its `drain` has nothing to send and the entries stay `queued`.
import { scope } from "@keel/reactive";
import { drain, send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  OWNER,
  TODOS,
  copyStorage,
  createServer,
  edit,
  entriesOf,
  makeClient,
  settle,
  simCtx,
  stored,
} from "./fixtures.ts";

test("After `setOnline(false)`, three `send`s resolve `queued`, post nothing, and leave the three entries in order in `ctx.storage` `keel.outbox.<id>`; `drain` on a new ctx over that storage holds them `queued`.", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.tuple(fc.constantFrom(...TODOS), fc.string({ minLength: 1, maxLength: 8 })), {
        minLength: 3,
        maxLength: 3,
      }),
      async (writes) => {
        const ctx = simCtx();
        const server = createServer();
        server.attach(ctx);
        const c = makeClient();
        ctx.net.setOnline(false);
        for (const [todoId, title] of writes) {
          const r = await send(ctx, c.o, "editTodo", edit(todoId, title), { base: 0, owner: OWNER });
          expect(r).toEqual({ state: "queued" });
        }
        expect(server.posts).toHaveLength(0);
        const saved = await stored(ctx, c.storageKey);
        expect(saved.map((e) => e.title)).toEqual(writes.map(([, title]) => title));
        expect(saved.map((e) => e.state)).toEqual(["queued", "queued", "queued"]);
        expect(saved.map((e) => e.key)).toEqual(entriesOf(c.o).map((e) => e.key));

        // A new ctx over that storage, in a new client of the same outbox id.
        c.dispose();
        const next = simCtx();
        next.net.setOnline(false);
        await copyStorage(ctx, next, c.storageKey);
        const c2 = makeClient({ id: c.id });
        scope(
          () => {
            void drain(next, c2.o, { owner: OWNER });
          },
          { detached: true },
        );
        await settle();
        expect(entriesOf(c2.o).map((e) => e.key)).toEqual(saved.map((e) => e.key));
        expect(entriesOf(c2.o).map((e) => e.state)).toEqual(["queued", "queued", "queued"]);
        c2.dispose();
      },
    ),
    { seed: 1337, numRuns: 12 },
  );
});
