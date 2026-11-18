// `send` when its own write to `ctx.storage` rejects: it resolves `failed` with `offline.storage`, posts nothing, and
// keeps the entry `failed` in memory, as a flush does. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Write, outbox, send } from "../src/index.ts";

const ORIGIN = "http://app.keel.invalid";
const OWNER = "u1";
const Api = endpoints({
  add: { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
let n = 0;
function declare() {
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox(`sendstore${++n}.outbox`, Api, { module: "app" });
  });
  if (held.o === undefined) throw new Error("no outbox");
  return { o: held.o, sc };
}
// The first step is the outbox load's `get`; the second is `send`'s own `set`.
const failing = (online: boolean): SimCtx => {
  const ctx = createCtx({
    mode: "sim",
    seed: 1337,
    schedule: { net: [], storage: ["ok", "fail"], offline: [], plans: {} },
  });
  ctx.net.setOnline(online);
  return ctx;
};

test("send resolves failed with offline.storage when its storage write rejects", async () => {
  for (const online of [true, false]) {
    const ctx = failing(online);
    const posts: string[] = [];
    ctx.net.route(`${ORIGIN}/add`, () => {
      posts.push("add");
      return Response.json({ ok: true, value: {} });
    });
    const { o, sc } = declare();
    const r = await send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: OWNER });
    expect(r.state === "failed" ? r.error.code : r.state).toBe("offline.storage");
    expect(posts).toEqual([]);
    expect(o.get("entries").map((e) => e.state)).toEqual(["failed"]);
    sc.dispose();
  }
});

test("a send after a failed storage write stores both entries", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 }), async (a, b) => {
      const ctx = failing(false);
      const { o, sc } = declare();
      const first = await send(ctx, o, "add", { body: { t: a } }, { base: 0, owner: OWNER });
      const second = await send(ctx, o, "add", { body: { t: b } }, { base: 0, owner: OWNER });
      expect([first.state, second.state]).toEqual(["failed", "queued"]);
      const raw = await ctx.storage.get(`keel.outbox.${o.id}`);
      const stored: unknown = JSON.parse(raw ?? "{}");
      expect(stored).toMatchObject({ entries: [{ state: "failed" }, { state: "queued" }] });
      sc.dispose();
    }),
    { seed: 1337, numRuns: 20 },
  );
});
