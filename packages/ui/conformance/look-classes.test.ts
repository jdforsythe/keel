// Spec: k.ui, Conformance "`<Button look="primary" px="1">` has the look's classes for every prop but `px`, and `k-px-1`; `look="nope"` is E1801."
// Spec: k.ui, Style props paragraph: "`look="<name>"` on a base element or `Part`, or in a part style, applies that `look` set's classes; the element's own props replace the set's per prop and state; a missing look is E1801."
// Seed: 1337 (property over the space tokens).
// Assumed (the spec names no entry shape): a `look` usage is `{ props, look: '<name>', state? }` to `compileStyles`, whose class list holds the look's classes
// for every prop and state the usage does not set, and the usage's own; class names are `k-<prop>-<token>`.
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, norm } from "./fixtures.ts";
import { codeOf, compileWith } from "./base-support.ts";

/** Every rule in `css` whose selector starts with the class `c`: its selector and declaration body, normalized. */
const rulesOf = (css: string, c: string): { selector: string; body: string }[] =>
  [...norm(css).matchAll(/(?<=^|[};])(\.[^{};]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selector: m[1] ?? "", body: m[2] ?? "" }))
    .filter((r) => r.selector === `.${c}` || r.selector.startsWith(`.${c}:`));

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

  // The spec fixes no class name or selector for a state style (only "one atomic class per (prop, token, breakpoint, state)"),
  // so the cases read the CSS rules of the classes in the list and assert what each declares, not how it is named.
  test("the element's own props replace the look's per state: its `hover` `bg` wins over the look's, the look's other props stay", () => {
    const { classes, css } = compileWith(LOOK, [{ props: { bg: "bg" }, look: "primary", state: "hover" }]);
    const own = classes[0] ?? [];
    const decls = own.flatMap((c) => rulesOf(css, c));
    const hoverBg = decls.filter((r) => r.selector.includes(":hover") && r.body.startsWith("background-color:"));
    expect(hoverBg.map((r) => r.body)).toEqual(["background-color:var(--k-color-bg)"]);
    expect(decls.map((r) => r.body)).not.toContain("background-color:var(--k-color-fg)");
    expect(own).toContain("k-bg-accent");
    expect(own).toContain("k-fg-bg");
    expect(own).toContain("k-px-2");
  });

  test("a look used twice by two elements yields the same classes, each rule once", () => {
    const { classes, css } = compileWith(LOOK, [
      { props: {}, look: "primary" },
      { props: {}, look: "primary" },
    ]);
    expect(classes[0]).toEqual(classes[1]);
    for (const c of classes[0] ?? []) expect(rulesOf(css, c)).toHaveLength(1);
  });
});
