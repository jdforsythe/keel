// A 502 `keel.unreachable` answer is a network failure, as a `module` service reads it (k.services): the outbox's
// entry stays `queued`. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import { expect, test } from "vitest";
import { Write, outbox, send } from "../src/index.ts";
import { outcomeOf } from "../src/internal/outcomeOf.ts";

const Api = endpoints({
  save: {
    method: "POST",
    path: "/save",
    body: s.object({ title: s.string(), write: Write }),
    output: s.object({}),
    errors: { 409: s.json() },
  },
});
const unreachable = (): Response =>
  new Response(JSON.stringify({ ok: false, error: { code: "keel.unreachable", message: "down", data: {} } }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
const body = (ctx: SimCtx) => ({ title: "x", write: { key: ctx.random.id("Write"), base: 0, owner: "" } });

function ctxWith(url: string, up = (): boolean => false): SimCtx {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.net.route(url, () => (up() ? Response.json({ ok: true, value: {} }) : unreachable()));
  return ctx;
}

test("through a module service a 502 keel.unreachable is api.network, so its entry stays queued", async () => {
  const ctx = ctxWith("http://api.keel.invalid/save");
  const r = await service({ module: "api", schema: Api }).save({ body: body(ctx) }, ctx);
  expect(r.ok ? undefined : r.error.code).toBe("api.network");
  expect(outcomeOf(r, false, { state: "conflict", head: 0 })).toEqual({ state: "queued" });
});

test("an outbox leaves that entry queued, and posts it again once the server answers", async () => {
  let up = false;
  const ctx = ctxWith("http://api.keel.invalid/save", () => up);
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox("unreach.outbox", Api, { module: "api" });
  });
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  const r = await send(ctx, o, "save", { body: { title: "x" } }, { base: 0, owner: "u1" });
  expect(r.state).toBe("queued");
  expect(o.get("entries").map((e) => e.state)).toEqual(["queued"]);
  up = true;
  ctx.clock.advance(1000);
  for (let i = 0; i < 200; i++) await Promise.resolve();
  expect(o.get("entries")).toEqual([]);
  sc.dispose();
});
