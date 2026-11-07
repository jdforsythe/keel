// @vitest-environment happy-dom
// The compiler lowers static style props to `class: "k-..."` and drops them (k.compiler); elements must apply it.
// Regression: rfc:0043 dropped the read and compiled apps rendered with no atomic classes. Seed 1337.
import { signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Box } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyStyle } from "../src/internal/applyStyle.ts";
import { classesOf } from "../src/internal/classesOf.ts";

describe("compiler-lowered class", () => {
  it("applies the lowered classes after the remaining (dynamic) style props, once each", () => {
    expect(classesOf({ class: "k-p-2 k-md-px-3", fg: "text" })).toEqual(["k-fg-text", "k-p-2", "k-md-px-3"]);
    expect(classesOf({ class: " k-p-2  k-p-2 ", p: "2" })).toEqual(["k-p-2"]);
    expect(classesOf({ class: 1 })).toEqual([]);
    expect(classesOf({ class: "x k-p-1 extra" })).toEqual(["k-p-1"]);
  });

  it("keeps lowered classes when a dynamic prop switches", async () => {
    const host = document.createElement("div");
    const box: { tone?: Signal<string> } = {};
    const dispose = mount(() => {
      box.tone = signal("accent");
      // the compiler's lowered call: untyped props, as `Reflect.apply` passes them
      const lowered: Readonly<Record<string, unknown>> = { class: "k-border-hairline", fg: box.tone };
      return Reflect.apply(Box, undefined, [lowered]);
    }, host);
    const el = host.firstElementChild;
    expect(el?.getAttribute("class")).toBe("k-fg-accent k-border-hairline");
    box.tone?.set("text");
    await Promise.resolve();
    await Promise.resolve();
    expect(el?.getAttribute("class")).toBe("k-fg-text k-border-hairline");
    dispose();
  });

  it("sets exactly the lowered class list for any set of lowered classes", () => {
    const cls = fc.uniqueArray(fc.stringMatching(/^k-[a-z]{1,6}-[a-z0-9]{1,4}$/), { maxLength: 6 });
    fc.assert(
      fc.property(cls, (cs) => {
        const el = document.createElement("div");
        applyStyle(el, { class: cs.join(" ") });
        expect(el.getAttribute("class")).toBe(cs.length === 0 ? null : cs.join(" "));
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});
