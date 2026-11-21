// Spec: std.offline, clause "With `online()` true and an empty outbox, `send` posts once with `body.write` `{ key, base }`, `key` a fresh `Write` id, and resolves `sent` with the endpoint's output."
// Seed 1337
import { s } from "@keel/schema";
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { OWNER, TODOS, createServer, edit, makeClient, simCtx } from "./fixtures.ts";

test("With `online()` true and an empty outbox, `send` posts once with `body.write` `{ key, base }`, `key` a fresh `Write` id, and resolves `sent` with the endpoint's output.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...TODOS), fc.string({ minLength: 1, maxLength: 8 }), async (todoId, title) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      expect(ctx.net.online()).toBe(true);
      const r = await send(ctx, c.o, "editTodo", edit(todoId, title), { base: server.head(), owner: OWNER });
      expect(server.posts).toHaveLength(1);
      const post = server.posts[0];
      expect(post?.todoId).toBe(todoId);
      expect(post?.title).toBe(title);
      expect(post?.base).toBe(0);
      expect(s.id("Write").parse(post?.key).ok).toBe(true);
      // The key is the ctx's next `Write` id, so a twin ctx on the same seed mints it.
      expect(post?.key).toBe(simCtx().random.id("Write"));
      expect(r).toEqual({ state: "sent", value: { head: 1, title } });
      const again = await send(ctx, c.o, "editTodo", edit(todoId, title), { base: server.head(), owner: OWNER });
      expect(again.state).toBe("sent");
      expect(server.posts[1]?.key).not.toBe(post?.key);
      c.dispose();
    }),
    { seed: 1337, numRuns: 20 },
  );
});
