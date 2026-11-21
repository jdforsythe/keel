import { scope } from "@keel/reactive";
// Spec: std.offline, clause "Once the `drain` scope ends, its pending retry posts nothing."
// Seed 1337
// Assumption: the outbox is declared outside any scope (no reactive owner), so its retry is not tied to a scope but to `drain`'s.
// Assumption: a network failure is a rejected fetch; the retry is armed 1 s after the first failure; 70 s passes every retry delay (max 60 s).
import { drain, outbox, send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Api, OWNER, createServer, edit, settle, simCtx, tick } from "./fixtures.ts";

let n = 0;
const armed = async (title: string) => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const o = outbox(`drainscope${++n}.outbox`, Api, {});
  server.next({ kind: "reject" });
  const sc = scope(() => {
    void drain(ctx, o, { owner: OWNER });
  });
  await settle();
  await send(ctx, o, "editTodo", edit("t1", title), { base: 0, owner: OWNER });
  expect(server.posts).toHaveLength(1);
  return { ctx, server, sc };
};

test("Once the `drain` scope ends, its pending retry posts nothing.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (title) => {
      const { ctx, server, sc } = await armed(title);
      sc.dispose();
      await tick(ctx, 70_000);
      expect(server.posts).toHaveLength(1);
      expect(server.entries()).toEqual([]);
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test("Control: without ending the `drain` scope the pending retry posts.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (title) => {
      const { ctx, server, sc } = await armed(title);
      await tick(ctx, 70_000);
      expect(server.posts).toHaveLength(2);
      expect(server.entries()).toEqual([{ todoId: "t1", title }]);
      sc.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});
