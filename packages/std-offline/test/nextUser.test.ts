// A shared browser: the writes one user queued offline are never posted for the next user who signs in there, and a
// stored entry never chooses where it is posted. Seed 1337.
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
  const evil: unknown[] = [];
  const answer = (into: unknown[]) => async (req: Request) => {
    into.push(field(await req.json(), "t"));
    return Response.json({ ok: true, value: {} });
  };
  ctx.net.route("http://app.keel.invalid/add", answer(posts));
  ctx.net.route("https://evil.example/add", answer(evil));
  return { posts, evil };
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
  const { posts, evil } = routes(ctx);
  ctx.net.setOnline(false);
  const first = page(ctx, "a");
  await settle();
  for (const t of ["a1", "a2"]) await send(ctx, first.o, "add", { body: { t } }, { base: 0, owner: "a" });
  first.sc.dispose();

  ctx.net.setOnline(true);
  const next = page(ctx, "b");
  await settle();
  expect(await send(ctx, next.o, "add", { body: { t: "b1" } }, { base: 0, owner: "b" })).toEqual({
    state: "sent",
    value: {},
  });
  await settle();
  expect(posts).toEqual(["b1"]);
  expect(evil).toEqual([]);
  expect(next.o.get("entries").map((e) => [field(e.input, "body"), e.state, field(e.error, "code")])).toEqual([
    [{ t: "a1" }, "failed", "offline.owner"],
    [{ t: "a2" }, "failed", "offline.owner"],
  ]);
  next.sc.dispose();
});

test("a stored entry with an origin is failed for every owner and posted neither there nor to the module", async () => {
  for (const owner of ["a", ""]) {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const { posts, evil } = routes(ctx);
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
    expect(evil).toEqual([]);
    expect(posts).toEqual([]);
    expect(p.o.get("entries").map((e) => [e.state, field(e.error, "code")])).toEqual([["failed", "offline.owner"]]);
    const raw = (await ctx.storage.get("keel.outbox.shared.outbox")) ?? "";
    expect(raw).not.toContain("evil.example");
    p.sc.dispose();
  }
});
