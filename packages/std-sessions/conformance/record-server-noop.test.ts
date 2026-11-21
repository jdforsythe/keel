// @vitest-environment node
// Spec: std.sessions, clause "Without a global `document`, `record` records no event through transactions and errors and never calls `put`."
// Seed 1337
// Runs in the default node environment: there is no global `document`.
// The error half uses a real source: a server loader that returns `err`, served under the same ctx.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { record, session } from "@keel/std-sessions";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("std.sessions: no document", () => {
  // Store ids stay live across runs; each run takes a fresh one.
  let run = 0;
  afterEach(() => vi.unstubAllGlobals());

  test("Without a global `document`, `record` records no event through transactions and errors and never calls `put`", () => {
    expect(typeof document).toBe("undefined");
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
        const fetched = vi.fn(() => Promise.reject(new Error("network used")));
        vi.stubGlobal("fetch", fetched);
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const rec = record(ctx, { upload: new URL("https://example.test/sessions") });
        scope(() => {
          const st = store(s.object({ n: s.int() }), { n: 0 }, { id: `cart.${++run}` });
          const bump = transaction(st, "cart.bump", s.object({ by: s.int() }), (state, p) => ({ n: state.n + p.by }));
          for (let i = 0; i < count; i++) void tx(bump, { by: 1 });
        });
        expect(rec.events()).toEqual([]);
        expect(rec.errors()).toEqual([]);
        expect(session(ctx).taken()).toEqual([]);
        const stopped = rec.stop();
        expect(stopped.events).toEqual([]);
        expect(stopped.route.id).toBe("");
        expect(rec.events()).toEqual([]);
        expect(rec.errors()).toEqual([]);
        expect(session(ctx).taken()).toEqual([]);
        expect(fetched).not.toHaveBeenCalled();
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("Without a global `document`, `record` records no event through transactions and errors and never calls `put` (loader err served by createApp)", async () => {
    const fetched = vi.fn(() => Promise.reject(new Error("network used")));
    vi.stubGlobal("fetch", fetched);
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const rec = record(ctx, { upload: new URL("https://example.test/sessions") });
    const cartContract = contract("cart", {
      "cart.show": { path: "/cart" },
    });

    const failing = loader(cartContract, "cart.show", { output: s.object({}) }, () =>
      Promise.resolve(err(s.error("cart.locked", s.object({})).make({}))),
    );
    const routes = manifest(cartContract, {
      "cart.show": {
        loader: failing,
        component: () => {
          throw new Error("not rendered in json mode");
        },
      },
    });
    const app = await createApp({
      topology: topology({ web: { modules: ["cart"], adapter: "node" } }),
      routes,
      ctx,
      mode: "dev",
    });
    const res = await app.fetch(new Request("http://localhost/cart", { headers: { accept: "application/json" } }));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(rec.events()).toEqual([]);
    expect(rec.errors()).toEqual([]);
    expect(session(ctx).taken()).toEqual([]);
    expect(rec.stop().events).toEqual([]);
    expect(session(ctx).taken()).toEqual([]);
    expect(fetched).not.toHaveBeenCalled();
  });
});
