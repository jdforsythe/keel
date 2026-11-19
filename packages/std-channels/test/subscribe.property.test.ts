import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { subscribe } from "../src/subscribe.ts";

const ORIGIN = "http://app.test";
const room = channel("t.room", { path: "/api/room/events", params: s.object({ room: s.string() }) });
const turn = () => new Promise<void>((r) => setImmediate(r));
const settle = async () => {
  for (let i = 0; i < 25; i++) await turn();
};
const line = (v: unknown) => new TextEncoder().encode(`data: ${JSON.stringify({ ok: true, value: v })}\n\n`);

/** A sim server whose stream `i` sends `reset` first when `opens(i)` holds, then ends. */
function harness(opens: (i: number) => boolean) {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const at: number[] = [];
  const urls: string[] = [];
  ctx.net.route(`${ORIGIN}/*`, (req) => {
    const i = at.length;
    at.push(ctx.clock.now());
    urls.push(req.url);
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        if (opens(i)) c.enqueue(line({ kind: "reset" }));
        c.close();
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  return { ctx, at, urls };
}

test("the reopen delay doubles from 1 s to a 30 s cap after drops, and starts over after a reset", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 9 }), async (resets) => {
      const h = harness((i) => resets[i] === true);
      const sc = scope(() => {
        subscribe(h.ctx, ORIGIN, room, { room: "a b" }, () => undefined);
      });
      await settle();
      let delay = 1000;
      for (let i = 0; i < resets.length; i++) {
        if (resets[i] === true) delay = 1000;
        await h.ctx.clock.advance(delay);
        await settle();
        expect(h.at).toHaveLength(i + 2);
        expect((h.at[i + 1] ?? 0) - (h.at[i] ?? 0)).toBe(delay);
        delay = Math.min(30_000, delay * 2);
      }
      expect(new URL(h.urls[0] ?? "").searchParams.get("room")).toBe("a b");
      sc.dispose();
    }),
    { seed: 1337, numRuns: 15 },
  );
});

test("close() stops the subscription like disposing its scope: no later request, no later event", async () => {
  const h = harness(() => true);
  const got: unknown[] = [];
  let handle: ReturnType<typeof subscribe> | undefined;
  scope(() => {
    handle = subscribe(h.ctx, ORIGIN, room, { room: "a" }, (e) => got.push(e));
  });
  await settle();
  expect(got).toEqual([{ kind: "reset" }]);
  handle?.close();
  await h.ctx.clock.advance(120_000);
  await settle();
  expect(h.at).toHaveLength(1);
  expect(got).toHaveLength(1);
});
