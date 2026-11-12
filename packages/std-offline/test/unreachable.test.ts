// A 502 `keel.unreachable` answer follows k.services: `api.network` through a `module` service (the entry stays
// `queued`), `api.status` through a `base` service (the entry is `failed`). Seed 1337.
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
const body = (ctx: SimCtx) => ({ title: "x", write: { key: ctx.random.id("Write"), base: 0 } });

function ctxWith(url: string): SimCtx {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.net.route(url, unreachable);
  return ctx;
}

test("through a module service a 502 keel.unreachable is api.network, so its entry stays queued", async () => {
  const ctx = ctxWith("http://api.keel.invalid/save");
  const r = await service({ module: "api", schema: Api }).save({ body: body(ctx) }, ctx);
  expect(r.ok ? undefined : r.error.code).toBe("api.network");
  expect(outcomeOf(r, false)).toEqual({ state: "queued" });
});

test("through a base service a 502 keel.unreachable is api.status, so its entry is failed", async () => {
  const ctx = ctxWith("https://app.example.com/save");
  const r = await service({ base: "https://app.example.com", schema: Api }).save({ body: body(ctx) }, ctx);
  expect(r.ok ? undefined : r.error.code).toBe("api.status");
  expect(outcomeOf(r, false)?.state).toBe("failed");
});

test("an outbox, which sends through a base service at its origin, leaves that entry failed", async () => {
  const ctx = ctxWith("https://app.example.com/save");
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox("unreach.outbox", Api);
  });
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  const r = await send(ctx, o, "https://app.example.com", "save", { body: { title: "x" } }, { base: 0 });
  expect(r.state).toBe("failed");
  expect(o.get("entries").map((e) => e.state)).toEqual(["failed"]);
  sc.dispose();
});
