// Spec: k.ctx, clause "A replayed `nav` or `error` carries `at`, its report time; a live one has none."
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

function atOf(e: CtxEvent | undefined): unknown {
  return e !== undefined && "at" in e ? e.at : undefined;
}

function simCtx() {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  if (!("advance" in ctx.clock)) throw new Error("sim clock missing advance");
  return { ctx, clock: ctx.clock };
}

describe("k.ctx a replayed nav or error carries at, its report time; a live one has none", () => {
  test("a replayed nav carries at 0 and a replayed error carries at 1000 for a nav at t=0 and an error at t=1000", () => {
    const { ctx, clock } = simCtx();
    report(ctx, nav("/a"));
    clock.advance(1000);
    report(ctx, err(1));
    clock.advance(60000);
    const got: CtxEvent[] = [];
    observe(ctx, (e) => {
      got.push(e);
    });
    expect(got.map((e) => e.kind)).toEqual(["nav", "error"]);
    expect(atOf(got[0])).toBe(0);
    expect(atOf(got[1])).toBe(1000);
  });

  test("an observer attached before the report gets live events without at", () => {
    const { ctx, clock } = simCtx();
    const got: CtxEvent[] = [];
    observe(ctx, (e) => {
      got.push(e);
    });
    report(ctx, nav("/a"));
    clock.advance(1000);
    report(ctx, err(1));
    expect(got.map((e) => e.kind)).toEqual(["nav", "error"]);
    for (const e of got) {
      expect("at" in e).toBe(false);
      expect(atOf(e)).toBeUndefined();
    }
  });

  test("property: replayed at equals the clock reading at report time, whatever the later advance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (a, b, c) => {
          const { ctx, clock } = simCtx();
          clock.advance(a);
          const t0 = clock.now();
          report(ctx, nav("/a"));
          clock.advance(b);
          const t1 = clock.now();
          report(ctx, err(1));
          clock.advance(c);
          const got: CtxEvent[] = [];
          observe(ctx, (e) => {
            got.push(e);
          });
          expect(atOf(got[0])).toBe(t0);
          expect(atOf(got[1])).toBe(t1);
        },
      ),
      { seed: SEED },
    );
  });
});
