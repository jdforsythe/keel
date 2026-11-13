// @vitest-environment happy-dom
// Spec: k.component, Conformance "The runtime, the router and the harness call a component with `undefined` as its second argument."
// Seed: 1337.
// Only the runtime (`mount`) is observable from this package; the router's and the harness's calls need @keel/router and @keel/testing, which this package does not depend on.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures.ts";

describe("k.component: the second argument is always undefined", () => {
  it.skip("The runtime calls a component with `undefined` as its second argument", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const ctx = createCtx({ mode: "sim", seed });
        const calls: unknown[][] = [];
        const container = document.createElement("div");
        document.body.appendChild(container);
        const dispose = mount(
          (...args: unknown[]) => {
            calls.push(args);
            return document.createElement("p");
          },
          container,
          { ctx },
        );
        expect(calls).toHaveLength(1);
        expect(calls[0]?.[1]).toBeUndefined();
        expect(calls[0]?.[2]).toBe(ctx);
        dispose();
        container.remove();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
