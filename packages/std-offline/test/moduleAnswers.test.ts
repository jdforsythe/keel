// An outbox over the endpoints of an app's own module: the server answers as k.server does (`{ ok, value }` and
// `{ ok: false, error }`), and the outbox reads them as a `module` service reads a route's `Result`. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { expect, test } from "vitest";
import { Write, outbox, send } from "../src/index.ts";

const ORIGIN = "https://app.example.com";
// The natural map for an app's own action: `output` is the action's value, `errors` the err's `error`; no 409 declared.
const Api = endpoints({
  edit: {
    method: "POST",
    path: "/edit",
    body: s.object({ t: s.string(), write: Write }),
    output: s.object({ head: s.int() }),
    errors: { 422: s.object({ code: s.literal("keel.fields"), message: s.string(), data: s.json() }) },
  },
});
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const answers: Record<string, () => Response> = {
  ok: () => json(200, { ok: true, value: { head: 1 } }),
  conflict: () =>
    json(409, { ok: false, error: { code: "keel.conflict", message: "c", data: { transaction: "x.edit", head: 4 } } }),
  unreachable: () => json(502, { ok: false, error: { code: "keel.unreachable", message: "down", data: {} } }),
  fields: () => json(422, { ok: false, error: { code: "keel.fields", message: "f", data: { t: "required" } } }),
};

let n = 0;
async function sendOne(answer: string) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const posts: unknown[] = [];
  ctx.net.route(`${ORIGIN}/edit`, async (req) => {
    posts.push(await req.json());
    const make = answers[answer];
    return make === undefined ? json(500, {}) : make();
  });
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox(`answers${++n}.outbox`, Api);
  });
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  const r = await send(ctx, o, ORIGIN, "edit", { body: { t: "x" } }, { base: 0 });
  const states = o.get("entries").map((e) => e.state);
  sc.dispose();
  return { r, posts, states };
}

test("a 2xx `{ ok: true, value }` resolves sent with the value, posted once", async () => {
  const { r, posts, states } = await sendOne("ok");
  expect(r).toEqual({ state: "sent", value: { head: 1 } });
  expect(posts).toHaveLength(1);
  expect(states).toEqual([]);
});

test("a 409 keel.conflict naming its transaction is conflict at its head, though the endpoint declares no 409", async () => {
  const { r, states } = await sendOne("conflict");
  expect(r).toEqual({ state: "conflict", head: 4 });
  expect(states).toEqual(["conflict"]);
});

test("a 502 keel.unreachable leaves the entry queued", async () => {
  const { r, states } = await sendOne("unreachable");
  expect(r).toEqual({ state: "queued" });
  expect(states).toEqual(["queued"]);
});

test("a declared error status is failed with the err's error decoded by its schema", async () => {
  const { r } = await sendOne("fields");
  expect(r.state).toBe("failed");
  expect(r.state === "failed" ? r.error.data : undefined).toEqual({
    status: 422,
    body: { code: "keel.fields", message: "f", data: { t: "required" } },
  });
});

test("a map whose schemas describe the whole k.server answer gets that answer", async () => {
  const Whole = endpoints({
    edit: {
      method: "POST",
      path: "/edit",
      body: s.object({ t: s.string(), write: Write }),
      output: s.object({ ok: s.literal(true), value: s.object({ head: s.int() }) }),
      errors: { 422: s.object({ ok: s.literal(false), error: s.json() }) },
    },
  });
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  let answer = "ok";
  ctx.net.route(`${ORIGIN}/edit`, () => (answer === "ok" ? answers.ok?.() : answers.fields?.()) ?? json(500, {}));
  const held: { o?: ReturnType<typeof outbox<typeof Whole>> } = {};
  const sc = scope(() => {
    held.o = outbox("whole.outbox", Whole);
  });
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  expect(await send(ctx, o, ORIGIN, "edit", { body: { t: "x" } }, { base: 0 })).toEqual({
    state: "sent",
    value: { ok: true, value: { head: 1 } },
  });
  answer = "fields";
  const r = await send(ctx, o, ORIGIN, "edit", { body: { t: "x" } }, { base: 0 });
  expect(r.state === "failed" ? r.error.data : undefined).toEqual({
    status: 422,
    body: { ok: false, error: { code: "keel.fields", message: "f", data: { t: "required" } } },
  });
  sc.dispose();
});
