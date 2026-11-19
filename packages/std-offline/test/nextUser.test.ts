// A shared browser: the writes one user queued offline are never posted for the next user who signs in there, nor while
// no one is, and a stored entry that names an origin is never posted. Each test fails when its one protection goes:
// the owner change failing other owners' entries, the flush's owner filter, the load marking a stored origin. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
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

function routes(ctx: SimCtx) {
  const posts: unknown[] = [];
  ctx.net.route("http://app.keel.invalid/add", async (req: Request) => {
    posts.push(field(await req.json(), "t"));
    return Response.json({ ok: true, value: {} });
  });
  return { posts };
}

/** User a queues two writes offline on one page load, then the page is closed. */
async function queuedByA(ctx: SimCtx): Promise<void> {
  ctx.net.setOnline(false);
  const first = page(ctx, "a");
  await settle();
  for (const t of ["a1", "a2"]) await send(ctx, first.o, "add", { body: { t } }, { base: 0, owner: "a" });
  first.sc.dispose();
}

/** One page load: a fresh outbox store over the ctx's storage, drained for `owner`. */
function page(ctx: SimCtx, owner: string) {
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox("shared.outbox", Api, { module: "app" });
    void drain(ctx, held.o, { owner });
  });
  if (held.o === undefined) throw new Error("no outbox");
  return { o: held.o, sc };
}

test("user a's offline writes are not posted when user b signs in after a reload; b's are, and a's stay failed", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const { posts } = routes(ctx);
  await queuedByA(ctx);

  ctx.net.setOnline(true);
  const next = page(ctx, "b");
  await settle();
  expect(await send(ctx, next.o, "add", { body: { t: "b1" } }, { base: 0, owner: "b" })).toEqual({
    state: "sent",
    value: {},
  });
  await settle();
  expect(posts).toEqual(["b1"]);
  expect(next.o.get("entries").map((e) => [field(e.input, "body"), e.state, field(e.error, "code")])).toEqual([
    [{ t: "a1" }, "failed", "offline.owner"],
    [{ t: "a2" }, "failed", "offline.owner"],
  ]);
  next.sc.dispose();
});

test("while no one is signed in after a reload, user a's queued writes stay queued and are not posted", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const { posts } = routes(ctx);
  await queuedByA(ctx);
  ctx.net.setOnline(true);
  const next = page(ctx, "");
  await settle();
  expect(posts).toEqual([]);
  expect(next.o.get("entries").map((e) => [field(e.input, "body"), e.state])).toEqual([
    [{ t: "a1" }, "queued"],
    [{ t: "a2" }, "queued"],
  ]);
  // The flush never took one up: no entry went `sending` and back.
  expect(next.o.log().filter((e) => e.name.endsWith(".settle"))).toEqual([]);
  next.sc.dispose();
});

test("a stored entry with an origin is failed for every owner and never posted", async () => {
  for (const owner of ["a", ""]) {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const { posts } = routes(ctx);
    const planted = {
      key: ctx.random.id("Write"),
      endpoint: "add",
      owner: "a",
      origin: "https://evil.example",
      input: { body: { t: "planted" } },
      base: 0,
      at: 0,
      state: "queued",
    };
    await ctx.storage.set("keel.outbox.shared.outbox", JSON.stringify({ entries: [planted] }));
    const p = page(ctx, owner);
    await settle();
    expect(posts).toEqual([]);
    expect(p.o.get("entries").map((e) => [e.state, field(e.error, "code")])).toEqual([["failed", "offline.owner"]]);
    const raw = (await ctx.storage.get("keel.outbox.shared.outbox")) ?? "";
    expect(raw).not.toContain("evil.example");
    p.sc.dispose();
  }
});
