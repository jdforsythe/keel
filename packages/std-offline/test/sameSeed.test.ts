// Two ctxs drawing the same write keys (one seed) over one module-level outbox: neither ctx fails, removes, stores or
// settles the other's entry, whatever the keys. Seed 1337 on both.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Write, drain, outbox, send } from "../src/index.ts";
import { field } from "../src/internal/field.ts";

const Api = endpoints({
  add: { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};
let n = 0;

function ctxWith(posts: string[]): SimCtx {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.net.route("http://app.keel.invalid/add", async (req) => {
    posts.push(String(field(await req.json(), "t")));
    return Response.json({ ok: true, value: {} });
  });
  return ctx;
}
const title = (e: { input: unknown }): string => String(field(field(e.input, "body"), "t"));
const stored = async (ctx: SimCtx, id: string): Promise<string[]> => {
  const raw = await ctx.storage.get(`keel.outbox.${id}`);
  const list: unknown = raw === null ? [] : field(JSON.parse(raw), "entries");
  return Array.isArray(list) ? list.map((e) => String(field(field(field(e, "input"), "body"), "t"))) : [];
};

test("a second same-seed ctx's owner change fails none of the first ctx's entries and stores none of them", async () => {
  const id = `seed${++n}.outbox`;
  const o = outbox(id, Api, { module: "app" });
  const pa: string[] = [];
  const pb: string[] = [];
  const a = ctxWith(pa);
  const b = ctxWith(pb);
  a.net.setOnline(false);
  b.net.setOnline(false);
  await send(a, o, "add", { body: { t: "a1" } }, { base: 0, owner: "a" });
  await send(b, o, "add", { body: { t: "b1" } }, { base: 0, owner: "b" });
  await send(b, o, "add", { body: { t: "b2" } }, { base: 0, owner: "b" });
  const a1 = o.get("entries").find((e) => title(e) === "a1");
  expect(a1?.state).toBe("queued");
  expect(await stored(b, id)).toEqual(["b1", "b2"]);
  expect(await stored(a, id)).toEqual(["a1"]);
});

test("a same-seed ctx's sent write removes none of the first ctx's entries, which its own drain then posts", async () => {
  const id = `seed${++n}.outbox`;
  const o = outbox(id, Api, { module: "app" });
  const pa: string[] = [];
  const pb: string[] = [];
  const a = ctxWith(pa);
  const b = ctxWith(pb);
  a.net.setOnline(false);
  await send(a, o, "add", { body: { t: "a1" } }, { base: 0, owner: "a" });
  expect(await send(b, o, "add", { body: { t: "b1" } }, { base: 0, owner: "a" })).toEqual({ state: "sent", value: {} });
  expect(o.get("entries").map(title)).toEqual(["a1"]);
  a.net.setOnline(true);
  const sc = scope(() => void drain(a, o, { owner: "a" }));
  await settle();
  expect(pa).toEqual(["a1"]);
  expect(pb).toEqual(["b1"]);
  sc.dispose();
});

test("for any interleaving of sends, owners and connectivity on two same-seed ctxs, each ctx posts, stores and fails only its own entries", async () => {
  const step = fc.record({ on: fc.constantFrom(0, 1), owner: fc.constantFrom("a", "b"), online: fc.boolean() });
  await fc.assert(
    fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 8 }), async (steps) => {
      const id = `seed${++n}.outbox`;
      const o = outbox(id, Api, { module: "app" });
      const posts: string[][] = [[], []];
      const ctxs = [ctxWith(posts[0] ?? []), ctxWith(posts[1] ?? [])];
      const mine: string[][] = [[], []];
      for (const [i, st] of steps.entries()) {
        const ctx = ctxs[st.on];
        if (ctx === undefined) continue;
        ctx.net.setOnline(st.online);
        const before = o
          .get("entries")
          .filter((e) => mine[1 - st.on]?.includes(title(e)))
          .map((e) => e.state);
        const left = o.get("entries").filter((e) => mine[1 - st.on]?.includes(title(e))).length;
        await send(ctx, o, "add", { body: { t: `w${i}` } }, { base: 0, owner: st.owner });
        mine[st.on]?.push(`w${i}`);
        await settle();
        const after = o.get("entries").filter((e) => mine[1 - st.on]?.includes(title(e)));
        // The other ctx's entries: none removed, none changed by this ctx's send and flush.
        expect(after.length).toBe(left);
        expect(after.map((e) => e.state)).toEqual(before);
      }
      for (const [k, ctx] of ctxs.entries()) {
        for (const t of posts[k] ?? []) expect(mine[k]).toContain(t);
        for (const t of await stored(ctx, id)) expect(mine[k]).toContain(t);
      }
    }),
    { seed: 1337, numRuns: 60 },
  );
});
