// Spec: k.ctx, clause "An `error` reported while nothing observes reaches a later observer right after the current `nav`, at most the first 16 since it; one reported before a later `nav` does not."
// fast-check seed: 1337
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

function nav(href: string): CtxEvent {
  return { kind: "nav", href, route: { id: href, path: href, params: {}, search: {}, schemas: {} } };
}

function err(n: number): CtxEvent {
  return { kind: "error", error: { code: `test.e${n}`, message: `error ${n}`, data: { n } } };
}

function codes(events: readonly CtxEvent[]): readonly string[] {
  return events.map((e) => (e.kind === "error" ? e.error.code : e.kind === "nav" ? `nav:${e.href}` : e.kind));
}

function later(ctx: ReturnType<typeof createCtx>): CtxEvent[] {
  const got: CtxEvent[] = [];
  observe(ctx, (e) => {
    got.push(e);
  });
  return got;
}

describe("k.ctx observers keep errors for a later observer", () => {
  test("a nav then two errors reported while nothing observes reach a later observer in order", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    report(ctx, nav("/a"));
    report(ctx, err(1));
    report(ctx, err(2));
    expect(codes(later(ctx))).toEqual(["nav:/a", "test.e1", "test.e2"]);
  });

  test("of 20 errors after a nav a later observer gets the nav and exactly the first 16", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    report(ctx, nav("/a"));
    for (let i = 1; i <= 20; i++) report(ctx, err(i));
    const expected = ["nav:/a", ...Array.from({ length: 16 }, (_, i) => `test.e${i + 1}`)];
    expect(codes(later(ctx))).toEqual(expected);
  });

  test("an error reported before a later nav does not reach a later observer", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    report(ctx, nav("/a"));
    report(ctx, err(1));
    report(ctx, nav("/b"));
    expect(codes(later(ctx))).toEqual(["nav:/b"]);
  });

  test("an observer attached at report time gets the error once, and a later observer also gets nav then that error", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    report(ctx, nav("/a"));
    const first: CtxEvent[] = [];
    observe(ctx, (e) => {
      first.push(e);
    });
    report(ctx, err(1));
    expect(codes(first)).toEqual(["nav:/a", "test.e1"]);
    expect(codes(later(ctx))).toEqual(["nav:/a", "test.e1"]);
    expect(codes(first)).toEqual(["nav:/a", "test.e1"]);
  });

  test("with no nav at all, errors reach a later observer (at most 16) and no nav is delivered", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    for (let i = 1; i <= 20; i++) report(ctx, err(i));
    const got = later(ctx);
    expect(got.some((e) => e.kind === "nav")).toBe(false);
    expect(codes(got)).toEqual(Array.from({ length: 16 }, (_, i) => `test.e${i + 1}`));
  });

  test("a throwing observer does not stop delivery of kept errors or live events to others", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    report(ctx, nav("/a"));
    report(ctx, err(1));
    observe(ctx, () => {
      throw new Error("observer failure");
    });
    const got = later(ctx);
    report(ctx, err(2));
    expect(codes(got)).toEqual(["nav:/a", "test.e1", "test.e2"]);
  });

  test("property: a later observer gets min(n, 16) errors after the nav", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), (n) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        report(ctx, nav("/a"));
        for (let i = 1; i <= n; i++) report(ctx, err(i));
        const got = codes(later(ctx));
        const k = Math.min(n, 16);
        expect(got).toEqual(["nav:/a", ...Array.from({ length: k }, (_, i) => `test.e${i + 1}`)]);
      }),
      { seed: SEED },
    );
  });
});
