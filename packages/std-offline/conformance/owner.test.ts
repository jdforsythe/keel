// Spec: std.offline, clause "Stored entries of owner `a`: `drain` with `a` posts them; with `b`, none, each `failed` with `offline.owner`, as is one with an `origin` or no `owner`; so does `send` with `b` after `a`'s."
// Seed 1337
// Assumption: storage holds the outbox state `{ entries }` as a JSON string or a JSON value; both are read. A hand-written
// stored outbox is written as a JSON string.
// Assumption: a stored entry is `{ key, endpoint, owner?, origin?, input, base, at, state }` with `input.body.write` `{ key, base }`.
import { resolve, send } from "@keel/std-offline";
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

type Sim = ReturnType<typeof simCtx>;

const codeOf = (e: unknown): unknown => {
  const err: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "error") : undefined;
  return typeof err === "object" && err !== null ? Reflect.get(err, "code") : undefined;
};
const live = (o: { get(k: "entries"): readonly unknown[] }) =>
  o.get("entries").map((e) => ({
    state: typeof e === "object" && e !== null ? Reflect.get(e, "state") : undefined,
    code: codeOf(e),
  }));
const kept = async (ctx: Sim, key: string) => {
  const raw: unknown = await ctx.storage.get(key);
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  const entries: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "entries") : undefined;
  return (Array.isArray(entries) ? entries : []).map((e: unknown) => ({
    state: typeof e === "object" && e !== null ? Reflect.get(e, "state") : undefined,
    code: codeOf(e),
    hasOrigin: typeof e === "object" && e !== null ? Reflect.has(e, "origin") : false,
  }));
};

/** Three writes queued offline by owner `a`, with bases 0, 1, 2 so each commits in order; returns the ctx holding the storage and the keys in order. */
async function queuedByA(writes: readonly (readonly [string, string])[]) {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  ctx.net.setOnline(false);
  let base = 0;
  for (const [todoId, title] of writes)
    await send(ctx, c.o, "editTodo", edit(todoId, title), { base: base++, owner: "a" });
  const keys = entriesOf(c.o).map((e) => e.key);
  c.dispose();
  return { ctx, id: c.id, storageKey: c.storageKey, keys };
}

const threeWrites = fc.array(fc.tuple(fc.constantFrom(...TODOS), fc.string({ minLength: 1, maxLength: 8 })), {
  minLength: 3,
  maxLength: 3,
});

test("Stored entries of owner `a`: `drain` with `a` posts them, in order, each with its original key.", async () => {
  await fc.assert(
    fc.asyncProperty(threeWrites, async (writes) => {
      const first = await queuedByA(writes);
      const next = simCtx();
      const server = createServer();
      server.attach(next);
      await copyStorage(first.ctx, next, first.storageKey);
      const c = makeClient({ id: first.id });
      const stop = startDrain(next, c.o, "a");
      await settle();
      expect(server.posts.map((p) => p.key)).toEqual(first.keys);
      expect(server.posts.map((p) => p.title)).toEqual(writes.map(([, title]) => title));
      expect(entriesOf(c.o)).toEqual([]);
      stop();
      c.dispose();
    }),
    { seed: 1337, numRuns: 6 },
  );
});

test("Stored entries of owner `a`: `drain` with `b` posts none, each `failed` with `offline.owner`, in the store and in storage.", async () => {
  await fc.assert(
    fc.asyncProperty(threeWrites, async (writes) => {
      const first = await queuedByA(writes);
      const next = simCtx();
      const server = createServer();
      server.attach(next);
      await copyStorage(first.ctx, next, first.storageKey);
      const c = makeClient({ id: first.id });
      const stop = startDrain(next, c.o, "b");
      await settle();
      expect(server.posts).toHaveLength(0);
      const failed = { state: "failed", code: "offline.owner" };
      expect(live(c.o)).toEqual([failed, failed, failed]);
      expect((await kept(next, first.storageKey)).map(({ state, code }) => ({ state, code }))).toEqual([
        failed,
        failed,
        failed,
      ]);
      stop();
      c.dispose();
    }),
    { seed: 1337, numRuns: 6 },
  );
});

/** Stores a hand-written outbox of two `queued` entries: one with an `origin` and no `owner`, one with neither. */
async function handWritten(ctx: Sim, id: string, key: string) {
  const mk = (suffix: string, extra: Record<string, unknown>) => ({
    key: ctx.random.id("Write"),
    endpoint: "editTodo",
    ...extra,
    input: {
      params: { todoId: "t1" },
      body: { title: `old${suffix}`, write: { key: ctx.random.id("Write"), base: 0 } },
    },
    base: 0,
    at: 0,
    state: "queued",
  });
  const entries = [mk("1", { origin: "https://evil.example" }), mk("2", {})];
  await ctx.storage.set(key, JSON.stringify({ entries }));
  return id;
}

test("Stored entries of owner `a`: an entry with an `origin` or no `owner` is `failed` with `offline.owner` under `drain` with `a` or `\"\"`, posts to neither `https://evil.example` nor the module, and `'theirs'` removes it.", async () => {
  for (const owner of ["", "a"]) {
    const ctx = simCtx();
    const server = createServer();
    server.attach(ctx);
    const evil: string[] = [];
    ctx.net.route("https://evil.example/todos/t1", async (req: Request) => {
      evil.push(req.url);
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    const c = makeClient();
    await handWritten(ctx, c.id, c.storageKey);
    const stop = startDrain(ctx, c.o, owner);
    await settle();
    expect(evil).toEqual([]);
    expect(server.posts).toHaveLength(0);
    const failed = { state: "failed", code: "offline.owner" };
    expect(live(c.o)).toEqual([failed, failed]);
    const stored = await kept(ctx, c.storageKey);
    expect(stored.map(({ state, code }) => ({ state, code }))).toEqual([failed, failed]);
    expect(stored.some((e) => e.hasOrigin)).toBe(false);
    for (const e of entriesOf(c.o)) expect(await resolve(ctx, c.o, e.key, "theirs")).toBe(true);
    expect(entriesOf(c.o)).toEqual([]);
    expect(evil).toEqual([]);
    expect(server.posts).toHaveLength(0);
    stop();
    c.dispose();
  }
});

test("Stored entries of owner `a`: `send` with `b` after `a`'s leaves `a`'s entry `failed` with `offline.owner` and posts `b`'s.", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.string({ minLength: 1, maxLength: 8 }),
      async (aTitle, bTitle) => {
        const ctx = simCtx();
        const server = createServer();
        server.attach(ctx);
        const c = makeClient();
        ctx.net.setOnline(false);
        expect(await send(ctx, c.o, "editTodo", edit("t1", aTitle), { base: 0, owner: "a" })).toEqual({
          state: "queued",
        });
        ctx.net.setOnline(true);
        const r = await send(ctx, c.o, "editTodo", edit("t2", bTitle), { base: server.head(), owner: "b" });
        await settle();
        expect(r.state).toBe("sent");
        expect(server.posts.map((p) => p.title)).toEqual([bTitle]);
        expect(live(c.o)).toEqual([{ state: "failed", code: "offline.owner" }]);
        expect((await kept(ctx, c.storageKey)).map(({ state, code }) => ({ state, code }))).toEqual([
          { state: "failed", code: "offline.owner" },
        ]);
        c.dispose();
      },
    ),
    { seed: 1337, numRuns: 8 },
  );
});
