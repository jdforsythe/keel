// Spec: std.offline Conformance 12: "Online, `resolve(ctx, o, key, 'mine')` resolves `sent` with the endpoint's output once the re-send answers; offline, `queued`; for a key with no `conflict` entry, `false`. `'theirs'` resolves `true` when it removed an entry, else `false`."
// Seed 1337
import { resolve, send } from "@keel/std-offline";
import { expect, test } from "vitest";
import { ORIGIN, createServer, edit, entriesOf, makeClient, simCtx } from "./fixtures.ts";

async function conflicted() {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  server.other("t1", "other");
  const c = makeClient();
  await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "mine"), { base: 0 });
  const entry = entriesOf(c.o)[0];
  if (entry === undefined || entry.state !== "conflict") throw new Error("no conflict entry");
  return { ctx, server, c, key: entry.key };
}

test("Online, `resolve(ctx, o, key, 'mine')` resolves `sent` with the endpoint's output once the re-send answers.", async () => {
  const { ctx, server, c, key } = await conflicted();
  const r = await resolve(ctx, c.o, key, "mine");
  expect(r).toEqual({ state: "sent", value: { head: server.head(), title: "mine" } });
  c.dispose();
});

test("Offline, `resolve(ctx, o, key, 'mine')` resolves `queued`.", async () => {
  const { ctx, c, key } = await conflicted();
  ctx.net.setOnline(false);
  expect(await resolve(ctx, c.o, key, "mine")).toEqual({ state: "queued" });
  c.dispose();
});

test("For a key with no `conflict` entry, `resolve(..., 'mine')` resolves `false`.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  expect(await resolve(ctx, c.o, "nope", "mine")).toBe(false);
  ctx.net.setOnline(false);
  const r = await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "q"), { base: 0 });
  expect(r.state).toBe("queued");
  const entry = entriesOf(c.o)[0];
  expect(await resolve(ctx, c.o, entry?.key ?? "", "mine")).toBe(false);
  c.dispose();
});

test("`'theirs'` resolves `true` when it removed an entry, else `false`.", async () => {
  const { ctx, c, key } = await conflicted();
  expect(await resolve(ctx, c.o, key, "theirs")).toBe(true);
  expect(await resolve(ctx, c.o, "nope", "theirs")).toBe(false);
  c.dispose();
});
