// One outbox used from several ctxs: each ctx's owner change, flush, retry, `resolve` and storage writes reach only the
// entries that ctx added or loaded, so no ctx posts, fails or stores another's. Seeds 1337 and 7.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Write, drain, outbox, resolve, send } from "../src/index.ts";
import { field } from "../src/internal/field.ts";
import { root } from "./support.ts";

const Api = contract("app", {
  "app.add": { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};
let n = 0;

function ctxWith(posts: string[], seed: number): SimCtx {
  const ctx = createCtx({ mode: "sim", seed });
  ctx.net.route("http://app.keel.invalid/add", async (req) => {
    posts.push(String(field(await req.json(), "t")));
    return Response.json({ ok: true, value: {} });
  });
  return ctx;
}
const stored = async (ctx: SimCtx, id: string): Promise<unknown[]> => {
  const raw = await ctx.storage.get(`keel.outbox.${id}`);
  const list: unknown = raw === null ? [] : field(JSON.parse(raw), "entries");
  return Array.isArray(list) ? list.map((e) => field(field(e, "input"), "body")) : [];
};

test("for any owners on two ctxs over one outbox, each ctx posts, fails and stores only its own entries", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({ on: fc.constantFrom(0, 1), owner: fc.constantFrom("a", "b") }), {
        minLength: 1,
        maxLength: 6,
      }),
      fc.constantFrom("a", "b"),
      async (writes, later) => {
        const id = `ctxs${++n}.outbox`;
        const o = root(() => outbox(id, Api));
        const posts: string[][] = [[], []];
        // Two seeds: a ctx draws its write keys from its own seed.
        const ctxs = [ctxWith(posts[0] ?? [], 1337), ctxWith(posts[1] ?? [], 7)];
        for (const c of ctxs) c.net.setOnline(false);
        const mine: string[][] = [[], []];
        for (const [i, w] of writes.entries()) {
          const ctx = ctxs[w.on];
          if (ctx === undefined) continue;
          await send(ctx, o, "add", { body: { t: `w${i}` } }, { base: 0, owner: w.owner });
          mine[w.on]?.push(`w${i}`);
        }
        for (const [k, ctx] of ctxs.entries()) {
          for (const b of await stored(ctx, id)) expect(mine[k]).toContain(field(b, "t"));
        }
        const other = ctxs[1];
        if (other === undefined) return;
        const title = (e: { input: unknown }) => String(field(field(e.input, "body"), "t"));
        const firsts = () =>
          o
            .get("entries")
            .filter((e) => mine[0]?.includes(title(e)))
            .map((e) => [e.key, e.state]);
        const before = firsts();
        const sc = scope(() => void drain(other, o, { owner: later }), { detached: true });
        other.net.setOnline(true);
        await settle();
        expect(posts[0]).toEqual([]);
        expect(posts[1]?.every((t) => mine[1]?.includes(t))).toBe(true);
        expect(firsts()).toEqual(before);
        for (const [key] of before) expect(await resolve(other, o, String(key), "theirs")).toBe(false);
        expect(firsts()).toEqual(before);
        for (const b of await stored(other, id)) expect(mine[1]).toContain(field(b, "t"));
        sc.dispose();
      },
    ),
    { seed: 1337, numRuns: 40 },
  );
});

test("a drain whose scope ends drops the retry pending on its ctx; a later send arms it again", async () => {
  const posts: string[] = [];
  let down = true;
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.net.route("http://app.keel.invalid/add", async (req) => {
    if (down)
      return Response.json(
        { ok: false, error: { code: "keel.unreachable", message: "down", data: {} } },
        { status: 502 },
      );
    posts.push(String(field(await req.json(), "t")));
    return Response.json({ ok: true, value: {} });
  });
  const o = root(() => outbox(`retry${++n}.outbox`, Api));
  const sc = scope(() => void drain(ctx, o, { owner: "a" }), { detached: true });
  await settle();
  expect(await send(ctx, o, "add", { body: { t: "x" } }, { base: 0, owner: "a" })).toEqual({ state: "queued" });
  sc.dispose();
  down = false;
  await ctx.clock.advance(120_000);
  await settle();
  expect(posts).toEqual([]);
  expect(await send(ctx, o, "add", { body: { t: "y" } }, { base: 0, owner: "a" })).toEqual({
    state: "sent",
    value: {},
  });
  await settle();
  expect(posts).toEqual(["x", "y"]);
});

test("an `events: true` entry is not an outbox endpoint: outbox declares over a contract holding one", () => {
  const Live = contract("live", {
    "live.feed": { method: "GET", path: "/feed", output: s.object({}), events: true },
  });
  expect(() => root(() => outbox("live.outbox", Live))).not.toThrow();
});
