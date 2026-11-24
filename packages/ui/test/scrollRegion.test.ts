// @vitest-environment happy-dom
// `Box scroll="x"` keeps its `k-scroll` role class first, whatever style props or lowered classes it also has, and
// `textAlign` is one logical keyword class per value. Seed 1337.
import { mount } from "@keel/runtime-dom";
import { Box } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classesOf } from "../src/internal/classesOf.ts";
import { testCtx } from "./testCtx.ts";

const SEED = 1337;

const classOf = (make: () => Node): string[] => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(make, host, { ctx: testCtx });
  const list = [...(host.querySelector("#x")?.classList ?? [])];
  off();
  host.remove();
  return list;
};

describe("Box scroll", () => {
  it("puts k-scroll before the style classes", () => {
    expect(classOf(() => Box({ id: "x", scroll: "x", label: "L", p: "2" }))).toEqual(["k-scroll", "k-p-2"]);
    expect(classOf(() => Box({ id: "x", scroll: "x", labelledBy: "t", px: "3", textAlign: "end" }))).toEqual([
      "k-scroll",
      "k-px-3",
      "k-textAlign-end",
    ]);
    expect(classOf(() => Box({ id: "x", scroll: "x", label: "L" }))).toEqual(["k-scroll"]);
  });

  it("never gains k-scroll without scroll (property)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<"2" | "3" | "4">("2", "3", "4"),
        fc.constantFrom<"start" | "center" | "end">("start", "center", "end"),
        (p, textAlign) => {
          expect(classOf(() => Box({ id: "x", p, textAlign }))).not.toContain("k-scroll");
        },
      ),
      { seed: SEED, numRuns: 10 },
    );
  });
});

describe("textAlign", () => {
  it("is one class per keyword, in the style prop order (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom("start", "center", "end"), (v) => {
        expect(classesOf({ textAlign: v })).toEqual([`k-textAlign-${v}`]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
