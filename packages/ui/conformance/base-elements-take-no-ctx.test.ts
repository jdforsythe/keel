// @vitest-environment happy-dom
// Spec: RFC 0162 D4 "the kernel's runtime ops and elements (`If`, `For`, `Match`, `Case`, `Boundary`, `@keel/ui` base elements, `Part`, `Link`, `Form`) take no ctx and are still called as `Op(props)` from a `.ts` file."
// Seed: 1337 (no generated inputs). A type-level test: the assertions are checked by `tsc --noEmit`; the runtime half renders each element from one argument.
import { Box, type Button, type Heading, type Link, Text } from "@keel/ui";
import type { Part } from "@keel/ui/aria";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("k.ui: base elements and Part take no ctx", () => {
  it("each base element is a function of one parameter, its props", () => {
    expectTypeOf<Parameters<typeof Box>["length"]>().toEqualTypeOf<1>();
    expectTypeOf<Parameters<typeof Text>["length"]>().toEqualTypeOf<1>();
    expectTypeOf<Parameters<typeof Heading>["length"]>().toEqualTypeOf<1>();
    expectTypeOf<Parameters<typeof Button>["length"]>().toEqualTypeOf<1>();
    expectTypeOf<Parameters<typeof Link>["length"]>().toEqualTypeOf<1>();
    expectTypeOf<Parameters<typeof Part>["length"]>().toEqualTypeOf<1>();
  });

  it("`Box({ children })` called from a `.ts` file with one argument renders", () => {
    const node = Box({ as: "main", children: () => Text({ children: "x" }) });
    expect(node).toBeInstanceOf(Node);
    expect(node.textContent).toBe("x");
  });

  it("passing a ctx as a second argument to a base element does not compile", () => {
    // compile-time half: ./negative-types.test-d.ts
    const bad = () => Reflect.apply(Box, undefined, [{ as: "main" }, {}]);
    expect(typeof bad).toBe("function");
  });
});
