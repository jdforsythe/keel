// Spec: std.outbox Conformance: "With owners `a` and `b`, after `send` with `a` offline and then `send` with `b`, `a`'s entry `error` is `{ code: 'offline.owner', message: <id>, data: {} }`."
// Seed 1337
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { createServer, edit, makeClient, settle, simCtx } from "./fixtures.ts";

const ownerOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "owner") : undefined);
const errorOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "error") : undefined);

test("With owners `a` and `b`, after `send` with `a` offline and then `send` with `b`, `a`'s entry `error` is `{ code: 'offline.owner', message: <id>, data: {} }`.", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 })).filter(([a, b]) => a !== b),
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
    { seed: 1337, numRuns: 12 },
  );
});
