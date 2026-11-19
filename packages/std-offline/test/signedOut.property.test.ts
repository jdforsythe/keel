// Signed out (std.outbox-owner): a request with no user answers `offline.signin`, which pauses the flush with every
// entry `queued`; the owner `""` holds named owners' entries; the returning owner's drain posts each entry once, in
// order, with the key it was queued under. Seed 1337.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type OutboxResult, Write, drain, outbox, send, writeFor } from "../src/index.ts";
import { field } from "../src/internal/field.ts";
import { outcomeOf } from "../src/internal/outcomeOf.ts";

const Api = endpoints({
  add: { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};
let n = 0;
function declare() {
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox(`out${++n}.outbox`, Api, { module: "app" });
  });
  if (held.o === undefined) throw new Error("no outbox");
  return { o: held.o, sc };
}
const draining = (ctx: ReturnType<typeof createCtx>, o: ReturnType<typeof declare>["o"], owner: string) =>
  scope(() => {
    void drain(ctx, o, { owner });
  });

test("writeFor answers offline.signin exactly for a named write owner and no user", () => {
  const key = createCtx({ mode: "sim", seed: 1337 }).random.id("Write");
  fc.assert(
    fc.property(fc.string({ maxLength: 6 }), fc.string({ maxLength: 6 }), fc.nat(50), (owner, user, base) => {
      const r = writeFor({ key, base, owner }, user);
      const code = owner === user ? undefined : user === "" ? "offline.signin" : "offline.owner";
      expect(r.ok ? undefined : r.error.code).toBe(code);
    }),
    { seed: 1337, numRuns: 200 },
  );
});

test("outcomeOf reads an offline.signin error body as the pause it is handed, whatever the status", () => {
  const refused: OutboxResult<unknown> = { state: "conflict", head: 1 };
  const paused: OutboxResult<unknown> = { state: "queued" };
  fc.assert(
    fc.property(fc.constantFrom(400, 401, 403, 409, 500), fc.boolean(), (status, retried) => {
      const body = { code: "offline.signin", message: "signin", data: {} };
      const error = { code: "api.status" as const, message: "s", data: { status, body } };
      expect(outcomeOf({ ok: false, error }, retried, refused, paused)).toBe(paused);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test("a signed-out server pauses after one post; no one holds; the owner's return posts each entry once in order", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 5 }), fc.nat(3), async (count, reconnects) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const user = { id: "" };
      const posts: string[] = [];
      const saved: string[] = [];
      ctx.net.route("http://app.keel.invalid/add", async (req) => {
        const body: unknown = await req.json();
        const write = Write.parse(field(body, "write"));
        if (!write.ok) return Response.json({ ok: false }, { status: 422 });
        posts.push(write.value.key);
        const w = writeFor(write.value, user.id);
        if (!w.ok) return Response.json({ ok: false, error: w.error }, { status: 400 });
        saved.push(String(field(body, "t")));
        return Response.json({ ok: true, value: {} });
      });
      const { o, sc } = declare();
      ctx.net.setOnline(false);
      for (let i = 0; i < count; i++)
        expect(await send(ctx, o, "add", { body: { t: `e${i}` } }, { base: 0, owner: "a" })).toEqual({
          state: "queued",
        });
      const keys = o.get("entries").map((e) => e.key);
      ctx.net.setOnline(true);
      const first = draining(ctx, o, "a");
      await settle();
      // A reconnect while paused posts nothing more.
      for (let i = 0; i < reconnects; i++) {
        ctx.net.setOnline(false);
        ctx.net.setOnline(true);
        await settle();
      }
      expect(posts).toEqual(keys.slice(0, 1));
      expect(o.get("entries").map((e) => e.state)).toEqual(keys.map(() => "queued"));
      first.dispose();

      const none = draining(ctx, o, "");
      await settle();
      expect(posts).toHaveLength(1);
      expect(o.get("entries").map((e) => e.state)).toEqual(keys.map(() => "queued"));
      none.dispose();

      user.id = "a";
      const back = draining(ctx, o, "a");
      await settle();
      expect(posts.slice(1)).toEqual(keys);
      expect(saved).toEqual(keys.map((_, i) => `e${i}`));
      expect(o.get("entries")).toEqual([]);
      back.dispose();
      sc.dispose();
    }),
    { seed: 1337, numRuns: 25 },
  );
});

test("an entry in flight when the owner becomes no one stays queued, and its send resolves queued", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const gate: (() => void)[] = [];
  ctx.net.route("http://app.keel.invalid/add", async () => {
    await new Promise<void>((go) => gate.push(go));
    throw new TypeError("network down");
  });
  const { o, sc } = declare();
  const first = send(ctx, o, "add", { body: { t: "a1" } }, { base: 0, owner: "a" });
  await settle();
  const none = draining(ctx, o, "");
  await settle();
  gate.shift()?.();
  expect(await first).toEqual({ state: "queued" });
  await settle();
  expect(o.get("entries").map((e) => [e.owner, e.state])).toEqual([["a", "queued"]]);
  none.dispose();
  sc.dispose();
});
