// A drain whose scope ends while a post is in flight: the post's network failure arms no retry, so nothing is posted
// on that ctx until the next `send`, `resolve` or `drain`. Seed 1337.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { expect, test } from "vitest";
import { Write, drain, outbox, send } from "../src/index.ts";
import { field } from "../src/internal/field.ts";

const Api = endpoints({
  add: { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};

test("a post held across the end of drain's scope that then fails arms no retry; a later send posts again", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const posts: string[] = [];
  const held: { fail?: () => void } = {};
  let hold = true;
  ctx.net.route("http://app.keel.invalid/add", async (req) => {
    posts.push(String(field(await req.json(), "t")));
    if (!hold) return Response.json({ ok: true, value: {} });
    return new Promise<Response>((_, no) => {
      held.fail = () => no(new TypeError("network"));
    });
  });
  const o = outbox("drainend.outbox", Api, { module: "app" });
  const sc = scope(() => void drain(ctx, o, { owner: "a" }));
  await settle();
  const sent = send(ctx, o, "add", { body: { t: "x" } }, { base: 0, owner: "a" });
  await settle();
  expect(posts).toEqual(["x"]);
  sc.dispose();
  hold = false;
  held.fail?.();
  expect(await sent).toEqual({ state: "queued" });
  await ctx.clock.advance(70_000);
  await settle();
  expect(posts).toEqual(["x"]);
  expect(await send(ctx, o, "add", { body: { t: "y" } }, { base: 0, owner: "a" })).toEqual({
    state: "sent",
    value: {},
  });
  await settle();
  expect(posts).toEqual(["x", "x", "y"]);
});
