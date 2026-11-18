// The owner rule: a drain for owner x posts exactly x's well-formed stored entries, in order, and fails every other
// entry with `offline.owner`; nothing is ever posted to an origin read from storage. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Write, drain, outbox, resolve, send } from "../src/index.ts";
import { field } from "../src/internal/field.ts";

const Api = endpoints({
  add: { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};
type Kind = "a" | "b" | "origin" | "none" | "number";
const extra = (k: Kind): Record<string, unknown> =>
  k === "origin"
    ? { owner: "a", origin: "https://evil.example" }
    : k === "none"
      ? {}
      : k === "number"
        ? { owner: 7 }
        : { owner: k };

function setup(ctx: SimCtx) {
  const posts: string[] = [];
  const evil: string[] = [];
  const key = (b: unknown): string => String(field(field(b, "write"), "key"));
  ctx.net.route("http://app.keel.invalid/add", async (req) => {
    posts.push(key(await req.json()));
    return Response.json({ ok: true, value: {} });
  });
  ctx.net.route("https://evil.example/add", async (req) => {
    evil.push(key(await req.json()));
    return Response.json({ ok: true, value: {} });
  });
  return { posts, evil };
}

let n = 0;
function declare() {
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox(`own${++n}.outbox`, Api, { module: "app" });
  });
  if (held.o === undefined) throw new Error("no outbox");
  return { o: held.o, sc, id: `own${n}.outbox` };
}

const codes = (o: { get(k: "entries"): readonly { state: string; error?: unknown }[] }) =>
  o.get("entries").map((e) => [e.state, field(e.error, "code")]);

test("a drain for owner x posts exactly x's well-formed entries in order and fails the rest with offline.owner", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.tuple(fc.constantFrom<Kind>("a", "b", "origin", "none", "number"), fc.constantFrom("queued", "sending")),
        { maxLength: 8 },
      ),
      fc.constantFrom("a", "b", ""),
      async (kinds, who) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const { posts, evil } = setup(ctx);
        const { o, sc, id } = declare();
        const entries = kinds.map(([k, state], i) => ({
          key: ctx.random.id("Write"),
          endpoint: "add",
          ...extra(k),
          input: { body: { t: `e${i}` } },
          base: 0,
          at: 0,
          state,
        }));
        await ctx.storage.set(`keel.outbox.${id}`, JSON.stringify({ entries }));
        const stop = scope(() => {
          void drain(ctx, o, { owner: who });
        });
        await settle();
        const mine = entries.filter((_, i) => kinds[i]?.[0] === who).map((e) => e.key);
        expect(posts).toEqual(mine);
        expect(evil).toEqual([]);
        expect(codes(o)).toEqual(entries.filter((e) => !mine.includes(e.key)).map(() => ["failed", "offline.owner"]));
        const raw = await ctx.storage.get(`keel.outbox.${id}`);
        expect(raw === null ? "" : raw).not.toContain("evil.example");
        stop.dispose();
        sc.dispose();
      },
    ),
    { seed: 1337, numRuns: 60 },
  );
});

test("an entry whose owner changes while it is in flight is failed with offline.owner, not queued again", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const posts: string[] = [];
  const gate: (() => void)[] = [];
  ctx.net.route("http://app.keel.invalid/add", async (req) => {
    posts.push(String(field(await req.json(), "t")));
    await new Promise<void>((go) => gate.push(go));
    throw new TypeError("network down");
  });
  const { o, sc } = declare();
  const first = send(ctx, o, "add", { body: { t: "a1" } }, { base: 0, owner: "a" });
  await settle();
  ctx.net.setOnline(false);
  expect(await send(ctx, o, "add", { body: { t: "b1" } }, { base: 0, owner: "b" })).toEqual({ state: "queued" });
  gate.shift()?.();
  expect((await first).state).toBe("failed");
  await settle();
  expect(posts).toEqual(["a1"]);
  expect(codes(o)).toEqual([
    ["failed", "offline.owner"],
    ["queued", undefined],
  ]);
  sc.dispose();
});

test("on a ctx no owner was given, a 'mine' resolve posts nothing and resolves queued", async () => {
  const base = createCtx({ mode: "sim", seed: 1337 });
  const posts: string[] = [];
  base.net.route("http://app.keel.invalid/add", async (req) => {
    posts.push(String(field(await req.json(), "t")));
    return Response.json(
      { ok: false, error: { code: "keel.conflict", message: "c", data: { transaction: "x", head: 3 } } },
      { status: 409 },
    );
  });
  const { o, sc } = declare();
  await send(base, o, "add", { body: { t: "a1" } }, { base: 0, owner: "a" });
  const key = o.get("entries")[0]?.key ?? "";
  const other = createCtx({ mode: "sim", seed: 7 });
  other.net.route("http://app.keel.invalid/add", async (req) => {
    posts.push(String(field(await req.json(), "t")));
    return Response.json({ ok: true, value: {} });
  });
  expect(await resolve(other, o, key, "mine")).toEqual({ state: "queued" });
  expect(posts).toEqual(["a1"]);
  sc.dispose();
});
