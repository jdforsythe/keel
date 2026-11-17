// Examples for std.offline edges no conformance sentence covers. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { expect, test } from "vitest";
import { Write, drain, outbox, resolve, send } from "../src/index.ts";

const ORIGIN = "https://app.example.com";
const Api = endpoints({
  add: { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
const sim = (): SimCtx => createCtx({ mode: "sim", seed: 1337 });
const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
let n = 0;
function declare(opts: { maxBytes?: number; id?: string } = {}) {
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox(
      opts.id ?? `unit${++n}.outbox`,
      Api,
      opts.maxBytes === undefined ? {} : { maxBytes: opts.maxBytes },
    );
  });
  if (held.o === undefined) throw new Error("no outbox");
  return { o: held.o, sc };
}

test("send refuses with offline.full when the encoded entries would pass maxBytes", async () => {
  const ctx = sim();
  ctx.net.setOnline(false);
  const { o, sc } = declare({ maxBytes: 400 });
  expect((await send(ctx, o, ORIGIN, "add", { body: { t: "a" } }, { base: 0 })).state).toBe("queued");
  const r = await send(ctx, o, ORIGIN, "add", { body: { t: "b".repeat(300) } }, { base: 0 });
  expect(r.state === "failed" ? r.error.code : r.state).toBe("offline.full");
  expect(o.get("entries")).toHaveLength(1);
  sc.dispose();
});

test("resolve changes nothing and resolves false for a key with no refused entry", async () => {
  const ctx = sim();
  ctx.net.setOnline(false);
  const { o, sc } = declare();
  await send(ctx, o, ORIGIN, "add", { body: { t: "a" } }, { base: 0 });
  const key = o.get("entries")[0]?.key ?? "";
  expect(await resolve(ctx, o, key, "mine")).toBe(false);
  expect(await resolve(ctx, o, key, "theirs")).toBe(false);
  expect(await resolve(ctx, o, "nope", "theirs")).toBe(false);
  expect(o.log().filter((e) => e.name.endsWith(".resolve"))).toHaveLength(0);
  sc.dispose();
});

test("drain loads a stored sending entry as queued", async () => {
  const ctx = sim();
  ctx.net.setOnline(false);
  const entry = { key: ctx.random.id("Write"), endpoint: "add", origin: ORIGIN, input: { body: { t: "a" } }, base: 0 };
  await ctx.storage.set(
    "keel.outbox.load.outbox",
    JSON.stringify({ entries: [{ ...entry, at: 0, state: "sending" }] }),
  );
  const { o, sc } = declare({ id: "load.outbox" });
  scope(() => {
    void drain(ctx, o);
  });
  await settle();
  expect(o.get("entries").map((e) => [e.key, e.state])).toEqual([[entry.key, "queued"]]);
  sc.dispose();
});

test("drain outside a scope throws E1203", async () => {
  const { o, sc } = declare();
  await expect(drain(sim(), o)).rejects.toThrow(/^E1203/);
  sc.dispose();
});

test("outbox throws E2651 with code and path for a secret in a body", () => {
  const Secret = endpoints({
    add: {
      method: "POST",
      path: "/a",
      body: s.object({ pin: s.secret(s.string()), write: Write }),
      output: s.object({}),
    },
  });
  scope(() => {
    expect(() => outbox("sec.outbox", Secret)).toThrow(
      /^E2651 outbox sec\.outbox endpoint add body holds s\.secret at pin/,
    );
  }).dispose();
});

test("send takes no bearer: a secret in the input is refused before the outbox stores anything", async () => {
  const ctx = sim();
  ctx.net.setOnline(false);
  const { o, sc } = declare();
  const t = s.secret(s.string()).parse("abc");
  if (!t.ok) throw new Error("fixture: a string parses as a secret");
  // The input type of `send` has no `bearer`, so the call goes through `Reflect.apply` with an untyped input.
  const input: unknown = { body: { t: "a" }, bearer: t.value };
  const sent: unknown = Reflect.apply(send, undefined, [ctx, o, ORIGIN, "add", input, { base: 0 }]);
  await expect(Promise.resolve(sent)).rejects.toThrow();
  expect(o.get("entries")).toHaveLength(0);
  sc.dispose();
});
