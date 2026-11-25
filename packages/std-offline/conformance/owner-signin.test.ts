// Spec: std.outbox-owner, clause "`writeFor({ key, base, owner: 'a' }, \"\")` is `err` with `{ code: 'offline.signin', message: 'signin', data: {} }`; entries of owner `a` refused with it stay `queued`, a `drain` with `\"\"` posts none and fails none, and a later `drain` with `a` posts each once with its key."
// Seed 1337
// Assumptions: the sim route (fixtures.ts) answers a `writeFor` err 400 `{ ok: false, error }`; `server.takesCallerAs("")` is the request with no user.
// "posts each once with its key": after the refused first post, the later `drain` with `a` posts every entry once more at most, each with the key it was queued under, and the server commits each once, in order.
// Reading of "flushing stops": after the one refused post nothing else is posted until `drain` is given the owner again.
import { send, writeFor } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { TODOS, copyStorage, createServer, edit, makeClient, settle, simCtx, startDrain, stored } from "./fixtures.ts";

const signin = { code: "offline.signin", message: "signin", data: {} };
const owners = fc.string({ minLength: 1, maxLength: 8 });
const writesArb = fc.array(fc.tuple(fc.constantFrom(...TODOS), fc.string({ minLength: 1, maxLength: 8 })), {
  minLength: 1,
  maxLength: 4,
});
// Each write's base is the head after the previous commit (write i has base i), so successive writes do not conflict.
// Counterexample kept as an example: two writes [["t1"," "],["t1"," "]].
const counterexample: [string, string][] = [
  ["t1", " "],
  ["t1", " "],
];
const stateOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "state") : undefined);
const errorOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "error") : undefined);

test("`writeFor({ key, base, owner: 'a' }, \"\")` is `err` with `{ code: 'offline.signin', message: 'signin', data: {} }` for any named write owner, and `writeFor` of an empty write owner for an empty user is `ok`", () => {
  const ctx = simCtx();
  fc.assert(
    fc.property(owners, fc.nat({ max: 1000 }), (owner, base) => {
      const key = ctx.random.id("Write");
      expect(writeFor({ key, base, owner }, "")).toEqual({ ok: false, error: signin });
      expect(writeFor({ key, base, owner: "" }, "")).toEqual({ ok: true, value: { key, base } });
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test('entries of owner `a` refused with `offline.signin` stay `queued` and flushing stops, a `drain` with `""` posts none and fails none, and a later `drain` with `a` posts each once with its key', async () => {
  await fc.assert(
    fc.asyncProperty(writesArb, async (writes) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      ctx.net.setOnline(false);
      for (const [i, [todoId, title]] of writes.entries())
        expect(await send(ctx, c.o, "editTodo", edit(todoId, title), { base: i, owner: "a" })).toEqual({
          state: "queued",
        });
      const queuedKeys = (await stored(ctx, c.storageKey)).map((e) => e.key);
      expect(queuedKeys).toHaveLength(writes.length);

      ctx.net.setOnline(true);
      server.takesCallerAs("");
      const stopSignedOut = startDrain(ctx, c.o, "a");
      await settle();
      expect(server.posts).toHaveLength(1);
      expect(server.entries()).toEqual([]);
      expect((await stored(ctx, c.storageKey)).map((e) => e.state)).toEqual(writes.map(() => "queued"));
      stopSignedOut();

      const before = server.posts.length;
      const stopNone = startDrain(ctx, c.o, "");
      await settle();
      expect(server.posts).toHaveLength(before);
      expect((await stored(ctx, c.storageKey)).map((e) => ({ key: e.key, state: e.state }))).toEqual(
        queuedKeys.map((key) => ({ key, state: "queued" })),
      );
      stopNone();

      server.takesCallerAs("a");
      const mark = server.posts.length;
      const stopBack = startDrain(ctx, c.o, "a");
      await settle();
      const later = server.posts.slice(mark);
      expect(later.map((p) => p.key)).toEqual(queuedKeys);
      expect(later.map((p) => p.owner)).toEqual(writes.map(() => "a"));
      expect(server.entries().map((e) => e.title)).toEqual(writes.map(([, title]) => title));
      stopBack();
      c.dispose();
    }),
    { seed: 1337, numRuns: 8, examples: [[counterexample]] },
  );
});

test('a drain with `""` holds the entries of every other owner `queued` online, posting none, and the bodies stay in storage and survive a new ctx', async () => {
  await fc.assert(
    fc.asyncProperty(writesArb, owners, async (writes, owner) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      ctx.net.setOnline(false);
      for (const [i, [todoId, title]] of writes.entries())
        await send(ctx, c.o, "editTodo", edit(todoId, title), { base: i, owner });
      ctx.net.setOnline(true);
      const stop = startDrain(ctx, c.o, "");
      await settle();
      expect(server.posts).toHaveLength(0);
      expect((await stored(ctx, c.storageKey)).map((e) => [e.state, e.title])).toEqual(
        writes.map(([, title]) => ["queued", title]),
      );
      stop();
      c.dispose();

      const next = simCtx(7);
      const again = createServer();
      again.attach(next);
      again.takesCallerAs(owner);
      await copyStorage(ctx, next, c.storageKey);
      const c2 = makeClient({ id: c.id });
      const stopOwner = startDrain(next, c2.o, owner);
      await settle();
      expect(again.entries().map((e) => e.title)).toEqual(writes.map(([, title]) => title));
      stopOwner();
      c2.dispose();
    }),
    { seed: 1337, numRuns: 8, examples: [[counterexample, "a"]] },
  );
});

test("only another named owner fails the entries: a drain with `b` marks the entries of `a` `failed` with `offline.owner` and posts none", async () => {
  await fc.assert(
    fc.asyncProperty(writesArb, async (writes) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      ctx.net.setOnline(false);
      for (const [todoId, title] of writes)
        await send(ctx, c.o, "editTodo", edit(todoId, title), { base: 0, owner: "a" });
      ctx.net.setOnline(true);
      const stop = startDrain(ctx, c.o, "b");
      await settle();
      expect(server.posts).toHaveLength(0);
      const kept = c.o.get("entries");
      expect(kept.map((e) => stateOf(e))).toEqual(writes.map(() => "failed"));
      expect(kept.map((e) => errorOf(e))).toEqual(
        writes.map(() => ({ code: "offline.owner", message: c.id, data: {} })),
      );
      stop();
      c.dispose();
    }),
    { seed: 1337, numRuns: 8 },
  );
});
