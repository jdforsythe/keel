// The outbox's store and its load from `ctx.storage`: a module-level declaration (no scope) creates its store on first
// use; every use waits for the stored entries, which load within `limit` and `maxBytes`. Seed 1337.
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { expect, test } from "vitest";
import { Write, drain, outbox, send } from "../src/index.ts";
import { root } from "./support.ts";

const ORIGIN = "http://app.keel.invalid";
const OWNER = "u1";
const Api = contract("app", {
  "app.add": { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
const sim = (): SimCtx => createCtx({ mode: "sim", seed: 1337 });
const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const entry = (ctx: Ctx, t: string) => ({
  key: ctx.random.id("Write"),
  endpoint: "add",
  owner: OWNER,
  input: { body: { t } },
  base: 0,
  at: 0,
  state: "queued",
});
const titles = async (ctx: Ctx, id: string): Promise<unknown[]> => {
  const raw = await ctx.storage.get(`keel.outbox.${id}`);
  const parsed: unknown = raw === null ? null : JSON.parse(raw);
  const entries: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "entries") : [];
  return Array.isArray(entries) ? entries.map((e: { input: { body: { t: string } } }) => e.input.body.t) : [];
};

test("an outbox declared in a root of its own creates its store once", async () => {
  const o = root(() => outbox("modlevel.outbox", Api));
  const ctx = sim();
  ctx.net.setOnline(false);
  expect(o.get("entries")).toEqual([]);
  expect((await send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: OWNER })).state).toBe("queued");
  expect(o.get("entries").map((e) => e.state)).toEqual(["queued"]);
  expect(o.log().map((e) => e.name)).toEqual(["modlevel.outbox.add"]);
});

test("a send before drain's load keeps the stored entries: storage ends with both", async () => {
  const ctx = sim();
  ctx.net.setOnline(false);
  await ctx.storage.set("keel.outbox.early.outbox", JSON.stringify({ entries: [entry(ctx, "stored")] }));
  const sc = scope(
    () => {
      const o = outbox("early.outbox", Api);
      void send(ctx, o, "add", { body: { t: "new" } }, { base: 0, owner: OWNER });
      void drain(ctx, o, { owner: OWNER });
    },
    { detached: true },
  );
  await settle();
  expect(await titles(ctx, "early.outbox")).toEqual(["stored", "new"]);
  sc.dispose();
});

test("drain loads at most `limit` stored entries, the first in order", async () => {
  const ctx = sim();
  ctx.net.setOnline(false);
  const stored = ["a", "b", "c", "d"].map((t) => entry(ctx, t));
  await ctx.storage.set("keel.outbox.capped.outbox", JSON.stringify({ entries: stored }));
  const held: { got?: unknown[] } = {};
  const sc = scope(
    () => {
      const o = outbox("capped.outbox", Api, { limit: 2 });
      void drain(ctx, o, { owner: OWNER }).then(() => {
        held.got = o.get("entries").map((e) => e.key);
      });
    },
    { detached: true },
  );
  await settle();
  expect(held.got).toEqual(stored.slice(0, 2).map((e) => e.key));
  sc.dispose();
});

test("a stored entry naming an inherited property as its endpoint is failed and does not stop the outbox", async () => {
  const ctx = sim();
  const posts: string[] = [];
  ctx.net.route(`${ORIGIN}/add`, async (req) => {
    posts.push(String(Reflect.get(await req.json(), "t")));
    return Response.json({ ok: true, value: {} });
  });
  await ctx.storage.set(
    "keel.outbox.wedge.outbox",
    JSON.stringify({ entries: [{ ...entry(ctx, "bad"), endpoint: "constructor" }] }),
  );
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(
    () => {
      held.o = outbox("wedge.outbox", Api);
      void drain(ctx, held.o, { owner: OWNER });
    },
    { detached: true },
  );
  await settle();
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  const r = await send(ctx, o, "add", { body: { t: "next" } }, { base: 0, owner: OWNER });
  expect(r.state).toBe("sent");
  expect(posts).toEqual(["next"]);
  expect(o.get("entries").map((e) => e.state)).toEqual(["failed"]);
  sc.dispose();
});

test("a storage write that rejects mid-flush settles the pending send, and a later send flushes", async () => {
  const base = sim();
  let fail = 0;
  const ctx: Ctx = {
    ...base,
    storage: {
      get: (k) => base.storage.get(k),
      set: (k, v) => (++fail === 2 ? Promise.reject(new Error("quota")) : base.storage.set(k, v)),
      read: (keys) => base.storage.read(keys),
      commit: (writes) => base.storage.commit(writes),
    },
  };
  const posts: string[] = [];
  base.net.route(`${ORIGIN}/add`, async (req) => {
    posts.push(String(Reflect.get(await req.json(), "t")));
    return Response.json({ ok: true, value: {} });
  });
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(
    () => {
      held.o = outbox("quota.outbox", Api);
    },
    { detached: true },
  );
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  const settled: unknown[] = [];
  void send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: OWNER }).then((r) => settled.push(r.state));
  await settle();
  expect(settled).toEqual(["failed"]);
  expect(await send(ctx, o, "add", { body: { t: "b" } }, { base: 0, owner: OWNER })).toEqual({
    state: "sent",
    value: {},
  });
  expect(posts).toEqual(["b"]);
  sc.dispose();
});
