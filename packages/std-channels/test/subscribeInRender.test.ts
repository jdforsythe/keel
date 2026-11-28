// @vitest-environment happy-dom
// `subscribe` called while a route renders (inside the router's effect) is legal: no write happens during the render,
// and the stream opens after it. Seed 1337
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import type { ChannelStatus } from "../src/ChannelStatus.ts";
import { channel } from "../src/channel.ts";
import { subscribe } from "../src/subscribe.ts";

const ORIGIN = "http://app.test";
const room = channel("t.room", { path: "/api/room/events", params: s.object({}) });
const line = (v: unknown) => new TextEncoder().encode(`data: ${JSON.stringify({ ok: true, value: v })}\n\n`);

test("a page that subscribes while it renders writes nothing while rendering, and its stream opens after the render", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const opened: string[] = [];
  ctx.net.route(`${ORIGIN}/*`, (req) => {
    opened.push(req.url);
    const body = new ReadableStream<Uint8Array>({ start: (c) => c.enqueue(line({ kind: "reset" })) });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  const seen: string[] = [];
  const held: { status?: () => ChannelStatus } = {};
  const routes = manifest(contract("t", { "t.page": { path: "/" } }), {
    "t.page": {
      component(_props, at): Node {
        const sub = subscribe(at, ORIGIN, room, {}, (e) => seen.push(e.kind));
        held.status = sub.status;
        return document.createElement("p");
      },
    },
  });
  const h = await renderRoute("t.page", { routes, ctx });
  for (let i = 0; i < 50 && seen.length === 0; i++) await new Promise<void>((r) => setImmediate(r));
  expect(opened).toEqual([`${ORIGIN}/api/room/events`]);
  expect(seen).toEqual(["reset"]);
  expect(held.status?.()).toBe("open");
  h.dispose();
});
