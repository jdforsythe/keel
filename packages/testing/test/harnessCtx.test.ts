// @vitest-environment happy-dom
// Spec: k.testing Harness ("`ctx` is the one it runs on") and ctx ("Harness renders always use a sim ctx"): with no
// `ctx` given the handle's `ctx` is typed `SimCtx`, so a test drives time through it; a given ctx keeps its type.
// Seed: 1337.
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import { render } from "@keel/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Labels } from "./support/components.ts";

describe("the handle's ctx", () => {
  it("is a SimCtx when none is given, and its clock advances", () => {
    const t = render(Labels, { props: { label: "Save" } });
    expectTypeOf(t.ctx).toEqualTypeOf<SimCtx>();
    const before = t.ctx.clock.now();
    t.ctx.clock.advance(250);
    expect(t.ctx.clock.now()).toBe(before + 250);
    t.dispose();
  });

  it("keeps the type of a given ctx", () => {
    const sim = createCtx({ mode: "sim", seed: 1337 });
    const t = render(Labels, { props: { label: "Save" }, ctx: sim });
    expectTypeOf(t.ctx).toEqualTypeOf<SimCtx>();
    expect(t.ctx).toBe(sim);
    t.dispose();
    const plain: Ctx = createCtx({ mode: "sim", seed: 1337 });
    const u = render(Labels, { props: { label: "Save" }, ctx: plain });
    expectTypeOf(u.ctx).toEqualTypeOf<Ctx>();
    u.dispose();
  });
});
