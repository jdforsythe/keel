// The owner rule: a drain for owner x posts exactly x's well-formed stored entries, in order, and fails every other
// entry with `offline.owner`; nothing is ever posted to an origin read from storage. A server that refuses a write by
// owner (`writeFor`) fails that entry alone with `offline.owner`, and it is never posted again. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Write, drain, outbox, resolve, send, writeFor } from "../src/index.ts";
import { configOf } from "../src/internal/configOf.ts";
import { field } from "../src/internal/field.ts";
import { outcomeOf } from "../src/internal/outcomeOf.ts";

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

test("a drain for owner x posts exactly x's well-formed entries in order and fails the rest with offline.owner, or holds named owners' entries queued when x is no one", async () => {
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
        const named = (i: number): boolean => kinds[i]?.[0] === "a" || kinds[i]?.[0] === "b";
        expect(codes(o)).toEqual(
          entries.flatMap((e, i) =>
            mine.includes(e.key) ? [] : [who === "" && named(i) ? ["queued", undefined] : ["failed", "offline.owner"]],
          ),
        );
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

test("an owner change at any await of a send's flush: never posted for another owner, 2xx stands, storage agrees", async () => {
  await fc.assert(
    fc.asyncProperty(fc.nat(5), fc.constantFrom("ok", "reject", "throw"), fc.boolean(), async (at, how, conflict) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const { o, sc, id } = declare();
      const cfg = configOf(o);
      const posts: string[] = [];
      const wrong: string[] = [];
      const applied: string[] = [];
      const answers: (() => void)[] = [];
      ctx.net.route("http://app.keel.invalid/add", async (req) => {
        const key = String(field(field(await req.json(), "write"), "key"));
        posts.push(key);
        const e = o.get("entries").find((x) => x.key === key);
        if (e?.state !== "sending" || e.owner !== cfg.owners.get(ctx)) wrong.push(key);
        await new Promise<void>((go) => answers.push(go));
        if (conflict) {
          const error = { code: "keel.conflict", message: "c", data: { transaction: "x", head: 3 } };
          return Response.json({ ok: false, error }, { status: 409 });
        }
        applied.push(key);
        return Response.json({ ok: true, value: {} });
      });
      // Each `set` is held until released, one at a time; the third (the write recording the answer) rejects or
      // throws synchronously as `how` says.
      const real = ctx.storage.set.bind(ctx.storage);
      const held: (() => Promise<void>)[] = [];
      let calls = 0;
      const set = (key: string, value: string): Promise<void> => {
        calls += 1;
        if (calls === 3 && how === "throw") throw new RangeError("storage");
        const fail = calls === 3 && how === "reject";
        return new Promise<void>((done, bad) => {
          held.push(async () => {
            if (fail) return bad(new Error("quota"));
            await real(key, value);
            done();
          });
        });
      };
      Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
      const result = send(ctx, o, "add", { body: { t: "a1" } }, { base: 0, owner: "a" });
      const drains: { dispose(): void }[] = [];
      // Await points, in order: the admit write, the sending write, the request, the recording write, the write after.
      for (let step = 0; step < 6; step++) {
        await settle();
        if (step === at) drains.push(scope(() => void drain(ctx, o, { owner: "b" })));
        await settle();
        if (step === 2) answers.shift()?.();
        else await held.shift()?.();
      }
      for (let i = 0; i < 6; i++) {
        await settle();
        answers.shift()?.();
        await held.shift()?.();
      }
      const out = await result;
      await settle();
      expect(wrong).toEqual([]);
      expect(posts.length).toBeLessThanOrEqual(1);
      if (applied.length > 0) expect(out.state).toBe("sent");
      else if (posts.length === 0) expect(field(field(out, "error"), "code")).toBe("offline.owner");
      if (how === "ok") {
        const raw = await ctx.storage.get(`keel.outbox.${id}`);
        expect(JSON.stringify(field(JSON.parse(raw ?? "{}"), "entries"))).toBe(JSON.stringify(o.get("entries")));
      }
      for (const d of drains) d.dispose();
      sc.dispose();
    }),
    { seed: 1337, numRuns: 60 },
  );
});

test("a server that refuses a random subset by owner: each refused entry fails alone, the rest commit in order, none is posted again", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
      fc.boolean(),
      async (refuseAt, offline) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const posts: { t: string; owner: unknown }[] = [];
        const applied: string[] = [];
        ctx.net.route("http://app.keel.invalid/add", async (req) => {
          const body: unknown = await req.json();
          const t = String(field(body, "t"));
          const write = Write.parse(field(body, "write"));
          posts.push({ t, owner: field(field(body, "write"), "owner") });
          // The caller's owner when post `i` lands: `b` (another tab signed in) where `refuseAt` says so.
          const w = write.ok ? writeFor(write.value, refuseAt[Number(t.slice(1))] ? "b" : "a") : undefined;
          if (w === undefined) return Response.json({ ok: false }, { status: 422 });
          if (!w.ok) return Response.json({ ok: false, error: w.error }, { status: 400 });
          applied.push(t);
          return Response.json({ ok: true, value: {} });
        });
        const { o, sc, id } = declare();
        ctx.net.setOnline(!offline);
        const outs: unknown[] = [];
        for (const i of refuseAt.keys())
          outs.push(await send(ctx, o, "add", { body: { t: `e${i}` } }, { base: 0, owner: "a" }));
        ctx.net.setOnline(true);
        const d = scope(() => void drain(ctx, o, { owner: "a" }));
        await settle();
        const names = refuseAt.map((_, i) => `e${i}`);
        expect(posts).toEqual(names.map((t) => ({ t, owner: "a" })));
        expect(applied).toEqual(names.filter((_, i) => !refuseAt[i]));
        const refusal = { code: "offline.owner", message: id, data: {} };
        expect(o.get("entries").map((e) => [e.state, e.error])).toEqual(
          refuseAt.filter((r) => r).map(() => ["failed", refusal]),
        );
        if (!offline)
          expect(outs).toEqual(
            refuseAt.map((r) => (r ? { state: "failed", error: refusal } : { state: "sent", value: {} })),
          );
        // A later drain on a new ctx over that storage posts nothing.
        const next = createCtx({ mode: "sim", seed: 1337 });
        const again: string[] = [];
        next.net.route("http://app.keel.invalid/add", async (req) => {
          again.push(String(field(await req.json(), "t")));
          return Response.json({ ok: true, value: {} });
        });
        const other = declare();
        const raw = await ctx.storage.get(`keel.outbox.${id}`);
        await next.storage.set(`keel.outbox.${other.id}`, raw ?? "");
        const d2 = scope(() => void drain(next, other.o, { owner: "a" }));
        await settle();
        expect(again).toEqual([]);
        d2.dispose();
        other.sc.dispose();
        d.dispose();
        sc.dispose();
      },
    ),
    { seed: 1337, numRuns: 40 },
  );
});

test("an error body whose code is offline.owner is the refusal whatever its status", () => {
  const refused = { state: "failed" as const, error: { code: "offline.owner" as const, message: "o", data: {} } };
  for (const status of [400, 403, 409, 500]) {
    const error = { code: "api.status" as const, message: "s", data: { status, body: { code: "offline.owner" } } };
    expect(outcomeOf({ ok: false, error }, false, refused, { state: "queued" })).toBe(refused);
  }
});
