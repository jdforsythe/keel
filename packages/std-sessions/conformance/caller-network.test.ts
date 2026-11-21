// @vitest-environment happy-dom
// Spec: k.user, Caller lifetime "A std.sessions recording keeps no `tx` `meta`, so no `meta.caller`, whatever the lifetime."
// Spec: k.user, Conformance "With or without `caller`, a std.sessions recording of a `tx` with `meta: { caller }` holds neither `meta` nor the hash."
// Seed 1337 (fc.assert below). Under a sim ctx with a document, `record`, a `tx` with `meta: { caller: <64-hex hash> }`, `stop()`.
// The caller lifetime (`caller: { days }`, topology.ts) is a server setting no recording can read, so the same assertions stand for every lifetime: the run is repeated with and without a `std` binding for sessions.
// The CLI half is packages/cli/conformance/evidence-caller.test.ts.
import { bindStd } from "@keel/compiler/std/bindStd";
import { renderRoute } from "@keel/testing";
import { record } from "@keel/std-sessions";
import { tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, fixture, json, simCtx } from "./fixtures.ts";

const hashArb = fc.stringMatching(/^[0-9a-f]{64}$/);
const modes = ["without a std binding", "with a std binding"] as const;

describe("k.user Caller lifetime: a recording keeps no `meta.caller`", () => {
  for (const mode of modes) {
    test(`a recorded \`tx\` with \`meta: { caller }\` holds neither "meta" nor the hash, ${mode}`, async () => {
      await fc.assert(
        fc.asyncProperty(hashArb, async (hash) => {
          const ctx = simCtx();
          if (mode === "with a std binding") bindStd(ctx, { "@keel/std-sessions": { cart: { redact: [] } } });
          const rec = record(ctx);
          const { cart, add, routes } = fixture();
          const h = await renderRoute("cart.show", { routes, ctx, state: [[cart, { items: [], card: "" }]] });
          await tx(add, { sku: "a" }, { meta: { caller: hash } });
          const session = rec.stop();
          h.dispose();
          const text = json(session);
          expect(session.events.some((e) => e.kind === "tx")).toBe(true);
          expect(text).not.toContain(hash);
          expect(text).not.toContain('"meta"');
          expect(text).not.toContain("caller");
          for (const e of session.events) expect("meta" in e).toBe(false);
        }),
        { seed: SEED, numRuns: 10 },
      );
    });
  }

  test("the same holds with the store restored from a `snapshot({ meta: true })` holding that meta", async () => {
    await fc.assert(
      fc.asyncProperty(hashArb, async (hash) => {
        const ctx = simCtx();
        const { cart, add, routes } = fixture();
        const empty = { items: [], card: "" };
        const first = await renderRoute("cart.show", { routes, ctx, state: [[cart, empty]] });
        await tx(add, { sku: "a" }, { meta: { caller: hash } });
        const snap = cart.snapshot({ meta: true });
        first.dispose();
        expect(JSON.stringify(snap)).toContain(hash);
        const rec = record(ctx);
        const h = await renderRoute("cart.show", { routes, ctx, state: [[cart, empty]] });
        cart.restore(snap);
        await tx(add, { sku: "b" });
        const text = json(rec.stop());
        h.dispose();
        expect(text).not.toContain(hash);
        expect(text).not.toContain('"meta"');
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("no `meta` on a `tx` event: the session schema's events carry no `meta` field for any payload", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 12 }), hashArb, async (sku, hash) => {
        const ctx = simCtx();
        const rec = record(ctx);
        const { cart, add, routes } = fixture();
        const h = await renderRoute("cart.show", { routes, ctx, state: [[cart, { items: [], card: "" }]] });
        await tx(add, { sku }, { meta: { caller: hash, other: sku } });
        const events = rec.events();
        rec.stop();
        h.dispose();
        const txs = events.filter((e) => e.kind === "tx");
        expect(txs.length).toBeGreaterThan(0);
        for (const e of txs) expect(Object.keys(e).sort()).toEqual(["at", "kind", "name", "payload", "store"]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
