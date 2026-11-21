// std.channels Client: `status()` passes through `connecting` and `open` as those happen, a drop and the wait to reopen
// included. Seed 1337.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { subscribe } from "../src/subscribe.ts";

const ORIGIN = "http://app.test";
const room = channel("t.room", { path: "/api/room/events", params: s.object({}) });
const turn = () => new Promise<void>((r) => setImmediate(r));
const settle = async () => {
  for (let i = 0; i < 25; i++) await turn();
};
const line = (v: unknown) => new TextEncoder().encode(`data: ${JSON.stringify({ ok: true, value: v })}\n\n`);

test("status is connecting, not open, from a drop until the reopened stream's reset", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const open: ReadableStreamDefaultController<Uint8Array>[] = [];
  ctx.net.route(`${ORIGIN}/*`, () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        open.push(c);
        c.enqueue(line({ kind: "reset" }));
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  const kinds: string[] = [];
  const box: { status?: () => string } = {};
  const sc = scope(() => {
    box.status = subscribe(ctx, ORIGIN, room, {}, (e) => kinds.push(e.kind)).status;
  });
  const status = () => box.status?.();
  await settle();
  expect([kinds, status()]).toEqual([["reset"], "open"]);
  open.shift()?.error(new TypeError("connection lost"));
  await settle();
  expect(ctx.clock.next()).toBe(1000);
  expect(status()).toBe("connecting");
  await ctx.clock.advance(999);
  await settle();
  expect(status()).toBe("connecting");
  await ctx.clock.advance(1);
  await settle();
  expect([kinds, status()]).toEqual([["reset", "reset"], "open"]);
  open.shift()?.close();
  await settle();
  expect(status()).toBe("connecting");
  sc.dispose();
});
