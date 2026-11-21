// Seed 1337. A direct `run` without `stores` (k.server API) beyond its conformance: a live loader's `live` makes the
// factory's stores too, a passed `stores` wins over the factory, and each call's stores are its own and released.
import { createCtx } from "@keel/ctx";
import { action, loader } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";

const Out = s.object({ n: s.int() });
const c = contract("q", {
  "q.get": { method: "GET", path: "/api/q", output: Out },
  "q.feed": { method: "GET", path: "/api/q/feed", output: Out, events: true },
  "q.add": { method: "POST", path: "/api/q", body: Out, output: Out },
});
const factory = () => ({ box: store(Out, { n: 0 }, { id: "q.box" }) });
const args = { params: {}, search: {}, url: "http://localhost/api/q", caller: "c" };

test("each run makes its own stores from the factory; a given stores value is passed as is", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (n) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const l = loader(c, "q.get", { stores: factory }, async ({ stores }) => ok({ n: stores.box.get("n") + n }));
      expect(await l.run(args, ctx)).toEqual(ok({ n }));
      expect(await l.run(args, ctx)).toEqual(ok({ n }));
      const given = { box: { get: () => 1 } };
      const seen: unknown[] = [];
      const a = action(c, "q.add", { stores: factory }, async (body, at) => {
        seen.push(at.stores);
        return ok(body);
      });
      await a.run({ n }, { ...args, stores: given }, ctx);
      expect(seen).toEqual([given]);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test("a live loader's `live` without stores gets the factory's stores and releases them at its end", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const l = loader(c, "q.feed", { stores: factory }, async function* ({ stores }) {
    yield ok({ n: stores.box.get("n") });
    yield ok({ n: stores.box.get("n") + 1 });
  });
  for (let round = 0; round < 2; round++) {
    const got: unknown[] = [];
    for await (const r of l.live({ ...args, signal: new AbortController().signal }, ctx)) got.push(r);
    expect(got).toEqual([ok({ n: 0 }), ok({ n: 1 })]);
  }
});
