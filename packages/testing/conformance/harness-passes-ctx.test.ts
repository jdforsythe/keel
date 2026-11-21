// @vitest-environment happy-dom
// Spec: RFC 0162 Conformance diff: "`render(C, { props })` a sim ctx, the same one its handle exposes as `ctx`." and D2 "the harness (`render`, `renderRoute`, `resumeDocument`, which make a sim ctx when given none)".
// Spec: k.testing Harness "**ctx.** Harness renders always use a sim ctx (k.ctx)." Seed 1337.
// ASSUMPTION: the `render` handle exposes the ctx as `ctx` (the RFC says so); `renderRoute` is given `ctx` here, and one made when none is given is observed through the component's second argument.
// Not built: the handle's `ctx` (RFC 0162: "the same one its handle exposes as `ctx`"); `Harness` in k.testing lists no `ctx`, so those assertions stay and fail until it exists.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { render, renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures.ts";

const Empty = s.object({});
const view = (seen: Ctx[]) =>
  Object.assign(
    (_props: Record<string, never>, ctx: Ctx): Node => {
      seen.push(ctx);
      return document.createElement("p");
    },
    { Props: Empty },
  );

describe("k.testing: the harness passes a component a ctx", () => {
  it("`render(C, { props })` gives `C` a sim ctx, the same one its handle exposes as `ctx`", () => {
    const seen: Ctx[] = [];
    const t = render(view(seen), { props: {} });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(t.ctx);
    expect(typeof t.ctx.clock.now()).toBe("number");
    t.dispose();
  });

  it("`render(C, { props, ctx })` gives `C` the ctx it was given", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), (seed) => {
        const ctx = createCtx({ mode: "sim", seed });
        const seen: Ctx[] = [];
        const t = render(view(seen), { props: {}, ctx });
        expect(seen[0]).toBe(ctx);
        expect(t.ctx).toBe(ctx);
        t.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("`renderRoute` gives the page the ctx it was given, and a sim ctx when given none", async () => {
    const c = contract("rc", { "rc.home": { path: "/" } });
    const seen: Ctx[] = [];
    const routes = manifest(c, {
      "rc.home": {
        component: (_p, ctx) => {
          seen.push(ctx);
          return document.createElement("main");
        },
      },
    });
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const given = await renderRoute("rc.home", { routes, ctx });
    expect(seen[0]).toBe(ctx);
    given.dispose();
    const made = await renderRoute("rc.home", { routes });
    expect(seen[1]).toBeDefined();
    expect(typeof seen[1]?.clock.now()).toBe("number");
    made.dispose();
  });

  it("a component declared `(props)` renders unchanged under `render`", () => {
    const pure = Object.assign(
      (_props: Record<string, never>): Node => {
        const p = document.createElement("p");
        p.id = "pure";
        p.textContent = "pure";
        return p;
      },
      { Props: Empty },
    );
    const t = render(pure, { props: {} });
    expect(t.find("pure").text).toBe("pure");
    t.dispose();
  });

  it("the old `(props, slots?, ctx?)` test component does not compile where a `TestComponent` is expected", () => {
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const old = () =>
      Reflect.apply(render, undefined, [
        Object.assign((_p: Record<string, never>, _s?: undefined, _c?: Ctx): Node => document.createElement("p"), {
          Props: Empty,
        }),
        { props: {} },
      ]);
    expect(typeof old).toBe("function");
  });
});
