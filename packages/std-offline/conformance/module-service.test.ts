// Spec: std.offline, clause "On an unbound sim ctx, `send` posts to `http://<module>.keel.invalid` plus the path; the stored entry has `owner`, no `origin`."
// Seed 1337
// Assumption: storage holds the outbox state `{ entries }` as a JSON string or a JSON value; both are read.
// Assumption: the fixture server answers `{ ok: true, value }` at `http://todos.keel.invalid/todos/<id>`, as a module service reads it.
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { MODULE, OWNER, TODOS, createServer, edit, makeClient, simCtx } from "./fixtures.ts";

async function rawEntries(ctx: ReturnType<typeof simCtx>, key: string): Promise<unknown[]> {
  const raw: unknown = await ctx.storage.get(key);
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  const entries: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "entries") : undefined;
  return Array.isArray(entries) ? entries : [];
}

test("On an unbound sim ctx, `send` posts to `http://<module>.keel.invalid` plus the path and resolves `sent` with the route's value.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...TODOS), fc.string({ minLength: 1, maxLength: 8 }), async (todoId, title) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      const r = await send(ctx, c.o, "editTodo", edit(todoId, title), { base: server.head(), owner: OWNER });
      expect(server.posts.map((p) => p.url)).toEqual([`http://${MODULE}.keel.invalid/todos/${todoId}`]);
      expect(r).toEqual({ state: "sent", value: { head: server.head(), title } });
      c.dispose();
    }),
    { seed: 1337, numRuns: 12 },
  );
});

test("On an unbound sim ctx, the stored entry has `owner`, no `origin`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...TODOS), fc.string({ minLength: 1, maxLength: 8 }), async (todoId, title) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      ctx.net.setOnline(false);
      await send(ctx, c.o, "editTodo", edit(todoId, title), { base: 0, owner: OWNER });
      const entries = await rawEntries(ctx, c.storageKey);
      expect(entries).toHaveLength(1);
      const entry = entries[0];
      expect(typeof entry === "object" && entry !== null).toBe(true);
      if (typeof entry !== "object" || entry === null) return;
      expect(Reflect.get(entry, "owner")).toBe(OWNER);
      expect(Reflect.has(entry, "origin")).toBe(false);
      c.dispose();
    }),
    { seed: 1337, numRuns: 12 },
  );
});
