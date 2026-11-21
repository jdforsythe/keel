// Spec: std.outbox Conformance: "With owners `a` and `b`, after `send` with `a` offline and then `send` with `b`, `a`'s entry `error` is `{ code: 'offline.owner', message: <id>, data: {} }`."
// Spec: std.outbox Conformance, bullet 14: "Online, with the flush's `sending` `set` for owner `a`'s entry held, `drain` with owner `b` and then the write released, the entry is not posted and `a`'s `send` resolves `failed` with `offline.owner`."
// Seed 1337
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { createServer, edit, makeClient, settle, simCtx, startDrain } from "./fixtures.ts";

const ownerOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "owner") : undefined);
const errorOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "error") : undefined);

test("With owners `a` and `b`, after `send` with `a` offline and then `send` with `b`, `a`'s entry `error` is `{ code: 'offline.owner', message: <id>, data: {} }`.", async () => {
  await fc.assert(
    fc.asyncProperty(
      // `b` is a named owner: `""` holds `a`'s entry queued (std.outbox-owner, Signed out).
      fc
        .tuple(fc.string({ maxLength: 8 }), fc.string({ minLength: 1, maxLength: 8 }))
        .filter(([a, b]) => a !== b),
      fc.boolean(),
      async ([a, b], bOnline) => {
        const ctx = simCtx();
        const server = createServer();
        server.attach(ctx);
        const c = makeClient();
        ctx.net.setOnline(false);
        await send(ctx, c.o, "editTodo", edit("t1", "from a"), { base: 0, owner: a });
        ctx.net.setOnline(bOnline);
        await send(ctx, c.o, "editTodo", edit("t2", "from b"), { base: 0, owner: b });
        await settle();
        const mine = c.o.get("entries").filter((e) => ownerOf(e) === a);
        expect(mine).toHaveLength(1);
        expect(errorOf(mine[0])).toEqual({ code: "offline.owner", message: c.id, data: {} });
        c.dispose();
      },
    ),
    { seed: 1337, numRuns: 12, examples: [[["a", "b"], true]] },
  );
});

test("Online, with the flush's `sending` `set` for owner `a`'s entry held, `drain` with owner `b` and then the write released, the entry is not posted and `a`'s `send` resolves `failed` with `offline.owner`.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  const real = ctx.storage.set.bind(ctx.storage);
  let calls = 0;
  let land: (() => Promise<void>) | undefined;
  const set = (key: string, value: string): Promise<void> => {
    calls += 1;
    if (calls !== 2) return real(key, value);
    return new Promise<void>((done) => {
      land = async () => {
        await real(key, value);
        done();
      };
    });
  };
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
  const sent = send(ctx, c.o, "editTodo", edit("t1", "from a"), { base: 0, owner: "a" });
  await settle();
  expect(land).toBeDefined();
  const stop = startDrain(ctx, c.o, "b");
  await settle();
  await land?.();
  const r = await sent;
  await settle();
  expect(server.posts).toHaveLength(0);
  expect(r.state).toBe("failed");
  const err: unknown = Reflect.get(r, "error");
  expect(typeof err === "object" && err !== null ? Reflect.get(err, "code") : undefined).toBe("offline.owner");
  stop();
  c.dispose();
}, 10_000);
