// @vitest-environment happy-dom
// Spec: k.component, clause "Each caller passes a component a ctx second; `mount` without `ctx` does not compile."
// RFC 0162 Conformance diff: "`mount(C, el, { ctx })` calls `C` with `({}, ctx)`, the same object; `mount` without `ctx` does not compile." and "A component declared `(props)` renders unchanged from JSX, `mount` and `render`."
// Seed: 1337. Only the runtime (`mount`) is observable from this package; the router's, the server's and the harness's calls are in their own packages.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures.ts";

const host = (): HTMLElement => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
};

describe("k.component: every caller passes a ctx second", () => {
  it("`mount(C, el, { ctx })` calls `C` with `({}, ctx)`, the same object", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const ctx = createCtx({ mode: "sim", seed });
        const calls: unknown[][] = [];
        const container = host();
        const dispose = mount(
          (...args: unknown[]) => {
            calls.push(args);
            return document.createElement("p");
          },
          container,
          { ctx },
        );
        expect(calls).toHaveLength(1);
        expect(calls[0]).toHaveLength(2);
        expect(calls[0]?.[0]).toEqual({});
        expect(calls[0]?.[1]).toBe(ctx);
        dispose();
        container.remove();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`mount` without `ctx` does not compile", () => {
    const container = host();
    // compile-time half: ./negative-types.test-d.ts
    const bare = () => Reflect.apply(mount, undefined, [() => document.createElement("p"), container, {}]);
    const none = () => Reflect.apply(mount, undefined, [() => document.createElement("p"), container]);
    expect(typeof bare).toBe("function");
    expect(typeof none).toBe("function");
    container.remove();
  });

  it("a component declared `(props)` renders unchanged under `mount`", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const container = host();
    const dispose = mount(
      (_props: Record<string, never>) => {
        const p = document.createElement("p");
        p.textContent = "pure";
        return p;
      },
      container,
      { ctx },
    );
    expect(container.textContent).toBe("pure");
    dispose();
    container.remove();
  });

  it("a component declaring `ctx: Ctx` reads the one `mount` was given", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    let seen: Ctx | null = null;
    const container = host();
    const dispose = mount(
      (_props: Record<string, never>, c: Ctx) => {
        seen = c;
        return document.createElement("p");
      },
      container,
      { ctx },
    );
    expect(seen).toBe(ctx);
    dispose();
    container.remove();
  });

  it("the old three-parameter form `(props, slots?: undefined, ctx?: Ctx)` is not a component: it does not compile where a `Component` is expected", () => {
    const container = host();
    const ctx = createCtx({ mode: "sim", seed: SEED });
    // compile-time half: ./negative-types.test-d.ts
    const old = () =>
      Reflect.apply(mount, undefined, [
        (_p: Record<string, never>, _slots?: undefined, _ctx?: Ctx) => document.createElement("p"),
        container,
        { ctx },
      ]);
    expect(typeof old).toBe("function");
    container.remove();
  });
});
