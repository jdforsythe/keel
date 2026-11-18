// Spec: std.outbox-owner Conformance, bullet 1: "`writeFor({ key, base, owner: 'a' }, 'a')` is `ok({ key, base })`; with owner `'b'` or `""` it is `err` with `{ code: 'offline.owner', message: 'owner', data: {} }`; `writeFor({ key, base, owner: "" }, "")` is `ok`."
// Spec: std.outbox-owner Conformance, bullet 2: "With entries queued offline under owner `a` and a route whose action passes `writeFor` owner `b`, `drain` with `a` online posts each with `body.write.owner` `a`, the server store commits nothing, and each entry is `failed` with `{ code: 'offline.owner', message: <id>, data: {} }`."
// Spec: std.outbox-owner Conformance, bullet 3: "After that refusal, `drain` with `a` on a new ctx over that storage posts nothing, and a `send` with `a` to a route whose owner is `a` is posted and resolves `sent`."
// Seed 1337
// Assumption: the sim route answers an `offline.owner` err 400 `{ ok: false, error }` (fixtures.ts), as k.server does.
import { send, writeFor } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  TODOS,
  copyStorage,
  createServer,
  edit,
  entriesOf,
  makeClient,
  settle,
  simCtx,
  startDrain,
} from "./fixtures.ts";

const errorOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "error") : undefined);
const refusal = (id: string) => ({ code: "offline.owner", message: id, data: {} });
const stateOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "state") : undefined);
const keptStates = async (ctx: ReturnType<typeof simCtx>, key: string) => {
  const raw: unknown = await ctx.storage.get(key);
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  const entries: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "entries") : undefined;
  return (Array.isArray(entries) ? entries : []).map((e: unknown) => ({ state: stateOf(e), error: errorOf(e) }));
};
const owners = fc.string({ maxLength: 8 });

test("`writeFor({ key, base, owner: 'a' }, 'a')` is `ok({ key, base })`; with owner `'b'` or `\"\"` it is `err` with `{ code: 'offline.owner', message: 'owner', data: {} }`; `writeFor({ key, base, owner: \"\" }, \"\")` is `ok`.", () => {
  const ctx = simCtx();
  const key = ctx.random.id("Write");
  expect(writeFor({ key, base: 3, owner: "a" }, "a")).toEqual({ ok: true, value: { key, base: 3 } });
  const refused = { ok: false, error: { code: "offline.owner", message: "owner", data: {} } };
  expect(writeFor({ key, base: 3, owner: "a" }, "b")).toEqual(refused);
  expect(writeFor({ key, base: 3, owner: "a" }, "")).toEqual(refused);
  expect(writeFor({ key, base: 3, owner: "" }, "")).toEqual({ ok: true, value: { key, base: 3 } });
  expect(writeFor({ key, base: 3, owner: "" }, "a")).toEqual(refused);
});

test("For generated owner pairs, `writeFor` is `ok` with `{ key, base }` exactly when the owners are equal, else `err` `offline.owner`.", () => {
  const ctx = simCtx();
  fc.assert(
    fc.property(owners, owners, fc.nat({ max: 1000 }), (writeOwner, serverOwner, base) => {
      const key = ctx.random.id("Write");
      const r = writeFor({ key, base, owner: writeOwner }, serverOwner);
      if (writeOwner === serverOwner) expect(r).toEqual({ ok: true, value: { key, base } });
      else expect(r).toEqual({ ok: false, error: { code: "offline.owner", message: "owner", data: {} } });
    }),
    { seed: 1337, numRuns: 100 },
  );
});

const threeWrites = fc.array(fc.tuple(fc.constantFrom(...TODOS), fc.string({ minLength: 1, maxLength: 8 })), {
  minLength: 1,
  maxLength: 4,
});

test("With entries queued offline under owner `a` and a route whose action passes `writeFor` owner `b`, `drain` with `a` online posts each with `body.write.owner` `a`, the server store commits nothing, and each entry is `failed` with `{ code: 'offline.owner', message: <id>, data: {} }`.", async () => {
  await fc.assert(
    fc.asyncProperty(threeWrites, async (writes) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      server.takesCallerAs("b");
      const c = makeClient();
      ctx.net.setOnline(false);
      for (const [todoId, title] of writes)
        expect(await send(ctx, c.o, "editTodo", edit(todoId, title), { base: 0, owner: "a" })).toEqual({
          state: "queued",
        });
      ctx.net.setOnline(true);
      const stop = startDrain(ctx, c.o, "a");
      await settle();
      expect(server.posts.map((p) => p.owner)).toEqual(writes.map(() => "a"));
      expect(server.posts.map((p) => p.title)).toEqual(writes.map(([, title]) => title));
      expect(server.entries()).toEqual([]);
      expect(server.head()).toBe(0);
      const failed = { state: "failed", error: refusal(c.id) };
      expect(c.o.get("entries").map((e) => ({ state: stateOf(e), error: errorOf(e) }))).toEqual(
        writes.map(() => failed),
      );
      expect(await keptStates(ctx, c.storageKey)).toEqual(writes.map(() => failed));
      stop();
      c.dispose();
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test("After that refusal, `drain` with `a` on a new ctx over that storage posts nothing, and a `send` with `a` to a route whose owner is `a` is posted and resolves `sent`.", async () => {
  await fc.assert(
    fc.asyncProperty(threeWrites, fc.string({ minLength: 1, maxLength: 8 }), async (writes, title) => {
      const ctx = simCtx();
      const refusing = createServer();
      refusing.attach(ctx);
      refusing.takesCallerAs("b");
      const first = makeClient();
      ctx.net.setOnline(false);
      for (const [todoId, t] of writes) await send(ctx, first.o, "editTodo", edit(todoId, t), { base: 0, owner: "a" });
      ctx.net.setOnline(true);
      const stopFirst = startDrain(ctx, first.o, "a");
      await settle();
      stopFirst();
      first.dispose();

      const next = simCtx(7);
      const server = createServer();
      server.attach(next);
      server.takesCallerAs("a");
      await copyStorage(ctx, next, first.storageKey);
      const c = makeClient({ id: first.id });
      const stop = startDrain(next, c.o, "a");
      await settle();
      expect(server.posts).toHaveLength(0);
      expect(c.o.get("entries").map((e) => stateOf(e))).toEqual(writes.map(() => "failed"));

      const r = await send(next, c.o, "editTodo", edit("t1", title), { base: 0, owner: "a" });
      await settle();
      expect(r.state).toBe("sent");
      expect(server.posts.map((p) => p.title)).toEqual([title]);
      expect(server.posts.map((p) => p.owner)).toEqual(["a"]);
      expect(server.entries()).toEqual([{ todoId: "t1", title }]);
      stop();
      c.dispose();
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test("For generated owners and entries, an entry whose owner differs from the server's owner for the caller is never saved, its `send` resolves `failed` with `offline.owner`, a later flush or `drain` does not post it again, and the entries of the matching owner around it commit in order.", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(owners, owners).filter(([a, b]) => a !== b),
      fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }),
      fc.array(fc.constantFrom(...TODOS), { minLength: 6, maxLength: 6 }),
      async ([mine, other], refusedAt, todoIds) => {
        const ctx = simCtx();
        const server = createServer();
        server.attach(ctx);
        const c = makeClient();
        const committed: string[] = [];
        const refusedKeys: string[] = [];
        let head = 0;
        for (const [i, refused] of refusedAt.entries()) {
          server.takesCallerAs(refused ? other : mine);
          const todoId = todoIds[i] ?? "t1";
          const before = server.posts.length;
          const r = await send(ctx, c.o, "editTodo", edit(todoId, `w${i}`), { base: head, owner: mine });
          await settle();
          expect(server.posts.length).toBe(before + 1);
          expect(server.posts.at(-1)?.owner).toBe(mine);
          if (refused) {
            expect(r.state).toBe("failed");
            expect(errorOf(r)).toEqual(refusal(c.id));
            const key = server.posts.at(-1)?.key;
            if (key !== undefined) refusedKeys.push(key);
          } else {
            expect(r.state).toBe("sent");
            committed.push(`w${i}`);
            head = server.head();
          }
          expect(server.entries().map((e) => e.title)).toEqual(committed);
        }
        const failedNow = entriesOf(c.o).filter((e) => e.state === "failed");
        expect(failedNow).toHaveLength(refusedKeys.length);

        server.takesCallerAs(mine);
        const after = await send(ctx, c.o, "editTodo", edit("t1", "last"), { base: head, owner: mine });
        await settle();
        expect(after.state).toBe("sent");
        const postedKeys = server.posts.map((p) => p.key);
        for (const k of refusedKeys) expect(postedKeys.filter((x) => x === k)).toHaveLength(1);
        expect(server.entries().map((e) => e.title)).toEqual([...committed, "last"]);

        const next = simCtx();
        const again = createServer();
        again.attach(next);
        again.takesCallerAs(mine);
        await copyStorage(ctx, next, c.storageKey);
        c.dispose();
        const c2 = makeClient({ id: c.id });
        const stop = startDrain(next, c2.o, mine);
        await settle();
        expect(again.posts).toHaveLength(0);
        stop();
        c2.dispose();
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});
