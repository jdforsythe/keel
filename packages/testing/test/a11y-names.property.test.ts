// @vitest-environment happy-dom
// Spec: k.testing a11y (accessible names per WAI-ARIA). Property seed: 1337.
import { createCtx } from "@keel/ctx";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Labels } from "./support/components.ts";

const SEED = 1337;
const label = fc.string({ minLength: 1, maxLength: 24 }).filter((x) => x.trim() === x && x !== "");

describe("a11y names resolve from each source for any generated label", () => {
  it("aria-label, <label for>, wrapping <label>, alt, text content, and aria-labelledby all yield the label", () => {
    fc.assert(
      fc.property(label, (l) => {
        const t = render(Labels, { props: { label: l }, ctx: createCtx({ mode: "sim", seed: SEED }) });
        try {
          for (const id of ["by.aria", "by.label", "by.wrap", "by.alt", "by.text", "by.labelledby"])
            expect(t.a11y(id).name).toBe(l);
          expect(t.find("by.aria").text).toBe("content");
          expect(t.a11y("by.label").role).toBe("textbox");
          expect(t.a11y("by.alt").role).toBe("img");
        } finally {
          t.dispose();
        }
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("name is the trimmed source: surrounding whitespace never reaches the name", () => {
    fc.assert(
      fc.property(label, fc.constantFrom(" ", "\n", "\t "), (l, pad) => {
        const t = render(Labels, { props: { label: `${pad}${l}${pad}` }, ctx: createCtx({ mode: "sim", seed: SEED }) });
        try {
          expect(t.a11y("by.text").name).toBe(l);
          expect(t.a11y("by.aria").name).toBe(l);
        } finally {
          t.dispose();
        }
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
