// Spec: k.server, Conformance "A loader without `stores`, called as `run({ params, search, url, caller }, ctx)`, compiles and its `fn` gets `stores` `undefined`; one declaring `stores: f`, called so, gets the value `f(ctx)` returns; an action alike, and after one whose `fn` runs a transaction on its stores, `ctx.storage` is unchanged."
// Spec: k.server, API "A loader's `run(args, ctx)` and an action's `run(input, args, ctx)` call `fn` directly, outside a request (tests). `args.stores` is optional: absent, `fn` gets the value the declared factory returns for `ctx`, `undefined` without one; `run` saves nothing."
// Seed 1337. `run` is reached with Reflect so the file type-checks before `run` exists (the "compiles" half is a type claim, not testable here).
// Assumes: `run` is a property of the value `loader(...)` and `action(...)` return; `url` is a `URL`, `caller` a string, `params` and `search` plain objects; the answer is `fn`'s `Result` (a promise or value).
// Pending: `run` is not built.
import { createCtx } from "@keel/ctx";
import { action, loader } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";

const Out = s.object({ n: s.int() });
const Add = s.object({ n: s.int() });
const Box = s.object({ items: s.array(s.int()) });
const c = contract("r", {
  "r.get": { method: "GET", path: "/api/r", output: Out },
  "r.add": { method: "POST", path: "/api/r", body: Add, output: Out },
});
const KEY = "keel.store.r.s";
const factory = () => {
  const box = store(Box, { items: [] }, { id: "r.s" });
  const add = transaction(box, "r.add", Add, (state, { n }) => ({ items: [...state.items, n] }));
  return { s: box, add };
};
const args = { params: {}, search: {}, url: new URL("http://localhost/api/r"), caller: "c" };

const runOf = (handler: unknown): ((...a: unknown[]) => unknown) => {
  const fn: unknown =
    typeof handler === "object" || typeof handler === "function" ? Reflect.get(handler ?? {}, "run") : undefined;
  if (typeof fn !== "function") throw new Error("run is not a function");
  return (...a) => Reflect.apply(fn, handler, a);
};

test.skip("A loader without `stores`, called as `run({ params, search, url, caller }, ctx)`, gets `stores` `undefined`; one declaring `stores: f`, called so, gets the value `f(ctx)` returns.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (seed) => {
      const ctx = createCtx({ mode: "sim", seed });
      let seen: unknown = "unset";
      const bare = loader(c, "r.get", {}, async (a) => {
        seen = Reflect.get(a, "stores");
        return ok({ n: 1 });
      });
      await runOf(bare)(args, ctx);
      expect(seen).toBeUndefined();
      let got: unknown;
      const made: unknown[] = [];
      const withStores = loader(c, "r.get", { stores: factory }, async ({ stores }) => {
        got = stores;
        made.push(stores);
        return ok({ n: 1 });
      });
      await runOf(withStores)(args, ctx);
      expect(got).toBeDefined();
      expect(Reflect.get(Reflect.get(got ?? {}, "s") ?? {}, "get")).toBeTypeOf("function");
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test.skip("An action alike without `stores` or with `stores: f`, called as `run(input, { params, url, caller }, ctx)`, and after one whose `fn` runs a transaction on its stores, `ctx.storage` is unchanged.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (n) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      let seen: unknown = "unset";
      const bare = action(c, "r.add", {}, async (input, a) => {
        seen = Reflect.get(a, "stores");
        return ok({ n: input.n });
      });
      await runOf(bare)({ n }, args, ctx);
      expect(seen).toBeUndefined();
      const withStores = action(c, "r.add", { stores: factory }, async (input, { stores }) => {
        tx(stores.add, { n: input.n });
        return ok({ n: input.n });
      });
      expect(await runOf(withStores)({ n }, args, ctx)).toBeDefined();
      expect(await ctx.storage.get(KEY)).toBeNull();
    }),
    { seed: 1337, numRuns: 10 },
  );
});
