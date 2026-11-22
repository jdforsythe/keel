// Spec: k.ui, Conformance "`<Button look="primary" px="1">` has the look's classes for every prop but `px`, and `k-px-1`; `look="nope"` is E1801."
// Spec: k.ui, Style props paragraph: "`look="<name>"` on a base element or `Part`, or in a part style, applies that `look` set's classes; the element's own props replace the set's per prop and state; a missing look is E1801."
// Seed: 1337 (property over the space tokens).
// Not built yet: every case is `test.skip`; the builder changes `test.skip` to `test` in each.
// Assumed (the spec names no entry shape): a `look` usage is `{ props, look: '<name>', state? }` to `compileStyles`, whose class list holds the look's classes
// for every prop and state the usage does not set, and the usage's own; class names are `k-<prop>-<token>`.
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./fixtures.ts";
import { codeOf, compileWith } from "./base-support.ts";

const PRIMARY = { bg: "accent", fg: "bg", px: "2", states: { hover: { bg: "fg" } } };
const LOOK = { look: { primary: PRIMARY } };

describe("k.ui: look sets and the element's own props", () => {
  test('`<Button look="primary" px="1">` has the look\'s classes for every prop but `px`, and `k-px-1`', () => {
    const { classes } = compileWith(LOOK, [{ props: { px: "1" }, look: "primary" }]);
    const own = classes[0] ?? [];
    expect(own).toContain("k-px-1");
    expect(own).toContain("k-bg-accent");
    expect(own).toContain("k-fg-bg");
    expect(own).not.toContain("k-px-2");
  });

  test('`look="nope"` is E1801', () => {
    expect(codeOf(() => compileWith(LOOK, [{ props: {}, look: "nope" }]))).toBe("E1801");
    expect(codeOf(() => compileWith(LOOK, [{ props: {}, look: "primary" }]))).toBe(null);
  });

  test("the element's own `px` replaces the look's, for any two space tokens (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom("0", "1", "2", "3"), fc.constantFrom("0", "1", "2", "3"), (mine, theirs) => {
        const { classes } = compileWith({ look: { l: { px: theirs, bg: "accent" } } }, [
          { props: { px: mine }, look: "l" },
        ]);
        const own = classes[0] ?? [];
        expect(own).toContain(`k-px-${mine}`);
        expect(own).toContain("k-bg-accent");
        if (mine !== theirs) expect(own).not.toContain(`k-px-${theirs}`);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test.skip("the element's own props replace the look's per state: its `hover` `bg` wins over the look's, the look's other props stay", () => {
    const { classes } = compileWith(LOOK, [{ props: { bg: "bg" }, look: "primary", state: "hover" }]);
    const hover = classes[0] ?? [];
    expect(hover).toContain("k-bg-bg");
    expect(hover).not.toContain("k-bg-fg");
  });

  test.skip("a look used twice by two elements yields the same classes, each rule once", () => {
    const { classes, css } = compileWith(LOOK, [
      { props: {}, look: "primary" },
      { props: {}, look: "primary" },
    ]);
    expect(classes[0]).toEqual(classes[1]);
    for (const c of classes[0] ?? []) expect(css.split(`.${c}{`).length - 1).toBe(1);
  });
});
