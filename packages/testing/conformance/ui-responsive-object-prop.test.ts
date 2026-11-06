// Spec: k.ui Conformance, "`p={{ base: '2', md: '3' }}` yields the `2` rule unconditioned and the `3` rule inside `@media (min-width: 768px)`".
// The object prop goes through the real compiler (its `styles.json` usages), then `compileStyles`.
import { compile } from "@keel/compiler";
import { compileStyles } from "@keel/ui/css";
import { describe, expect, it } from "vitest";
import { tokens } from "./ui-fixtures.ts";

const norm = (css: string): string => css.replace(/\s+/g, "");

describe("k.ui: p={{ base: '2', md: '3' }} compiled from JSX", () => {
  it("compiles to a base usage and an md usage, and the css puts the 3 rule only inside the md media query", () => {
    const r = compile([
      {
        path: "C.tsx",
        source:
          "import { Box } from '@keel/ui'\nexport default function C() { return <Box p={{ base: '2', md: '3' }}>x</Box> }\n",
      },
    ]);
    expect(r.diagnostics).toEqual([]);
    const usages = r.artifacts["styles.json"].usages;
    expect(usages).toContainEqual({ props: { p: "2" } });
    expect(usages).toContainEqual({ props: { p: "3" }, breakpoint: "md" });
    const { classes, css } = compileStyles({ tokens, usages });
    const n = norm(css);
    const at = n.indexOf("@media(min-width:768px)");
    expect(at).toBeGreaterThanOrEqual(0);
    const outside = n.slice(0, at);
    const inside = n.slice(at);
    const base = classes[usages.findIndex((u) => u.breakpoint === undefined)] ?? [];
    const md = classes[usages.findIndex((u) => u.breakpoint === "md")] ?? [];
    expect(base).toHaveLength(1);
    expect(md).toHaveLength(1);
    for (const c of base) {
      expect(outside).toContain(`.${c}{`);
      expect(inside).not.toContain(`.${c}{`);
    }
    for (const c of md) {
      expect(inside).toContain(`.${c}{`);
      expect(outside).not.toContain(`.${c}{`);
    }
  });
});
