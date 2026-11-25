// Examples and a property for what `resolve` resolves. Seed 1337.
import type { SimCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { type OutboxResult, type Resolution, resolve, send } from "../src/index.ts";
import { OWNER, SEED, type SimSchedule, createServer, edit, entriesOf, makeClient, simCtx } from "./support.ts";

type Edited = { head: number; title: string };

async function conflicted(n: number, ctx: SimCtx = simCtx()) {
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  for (let i = 0; i < n; i++) {
    server.other("t1", `other${i}`);
    await send(ctx, c.o, "editTodo", edit("t1", `mine${i}`), { base: 0, owner: OWNER });
  }
  const keys = entriesOf(c.o)
    .filter((e) => e.state === "conflict")
    .map((e) => e.key);
  return { ctx, server, c, keys };
}

test("resolve types: 'mine' is false | OutboxResult of the api's outputs, 'theirs' is boolean, a Resolution gets the union", async () => {
  const { ctx, c, keys } = await conflicted(1);
  const key = keys[0] ?? "";
  const answer = (r: Resolution) => resolve(ctx, c.o, key, r);
  const mine = resolve(ctx, c.o, key, "mine");
  const theirs = resolve(ctx, c.o, key, "theirs");
  const either = answer("theirs");
  expectTypeOf(mine).resolves.toEqualTypeOf<false | OutboxResult<Edited>>();
  expectTypeOf(theirs).resolves.toEqualTypeOf<boolean>();
  expectTypeOf(either).resolves.toEqualTypeOf<boolean | OutboxResult<Edited>>();
  await Promise.all([mine, theirs, either]);
  const sent = send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  expectTypeOf(sent).resolves.toEqualTypeOf<OutboxResult<Edited>>();
  await sent;
  c.dispose();
});

test("'mine' on a conflict entry resolves sent and leaves no entry behind", async () => {
  const { ctx, c, keys } = await conflicted(1);
  const r = await resolve(ctx, c.o, keys[0] ?? "", "mine");
  expect(r === false ? r : r.state).toBe("sent");
  expect(entriesOf(c.o)).toHaveLength(0);
  c.dispose();
});

test("'mine' on an entry the server refuses again resolves conflict", async () => {
  const { ctx, server, c, keys } = await conflicted(1);
  server.other("t1", "again");
  const r = await resolve(ctx, c.o, keys[0] ?? "", "mine");
  expect(r === false ? r : r.state).toBe("conflict");
  c.dispose();
});

test("'mine' whose storage write rejects resolves failed with offline.storage, posts nothing, and leaves the entry failed", async () => {
  // The load's `get`, `send`'s `set`, the flush's `sending` and `conflict` writes, then `resolve`'s own `set`.
  const schedule: SimSchedule = { net: [], storage: ["ok", "ok", "ok", "ok", "fail"], offline: [], plans: {} };
  const { c, server, keys, ctx } = await conflicted(1, simCtx(SEED, schedule));
  const posts = server.posts.length;
  const r = await resolve(ctx, c.o, keys[0] ?? "", "mine");
  expect(r === false ? r : r.state === "failed" ? r.error.code : r.state).toBe("offline.storage");
  expect(server.posts).toHaveLength(posts);
  expect(entriesOf(c.o).map((e) => e.state)).toEqual(["failed"]);
  c.dispose();
});

test("Property: 'mine' resolves sent online and queued offline, 'theirs' resolves true, an unknown key false", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 3 }),
      fc.boolean(),
      fc.constantFrom<Resolution>("mine", "theirs"),
      fc.boolean(),
      async (n, online, resolution, known) => {
        const { ctx, c, keys } = await conflicted(n);
        ctx.net.setOnline(online);
        const r = await resolve(ctx, c.o, known ? (keys[keys.length - 1] ?? "") : "nope", resolution);
        if (!known) expect(r).toBe(false);
        else if (resolution === "theirs") expect(r).toBe(true);
        else expect(typeof r === "object" ? r.state : r).toBe(online ? "sent" : "queued");
        c.dispose();
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});
