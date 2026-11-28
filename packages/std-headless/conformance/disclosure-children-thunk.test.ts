// k.claim, Types "A component a Keel package exports takes content only as a thunk or render function. `Form` (k.router) takes `children?: () => Node | readonly Node[] | string`; `Disclosure` (std.headless) takes `children: () => Child`."
// Spec: k.claim, clause "`Form` or `Disclosure` given `children` as a node, an array of nodes or a string is a type error; a thunk is not."
// Seed: 1337 (no generated inputs). A type-level test: the assertions are checked by `tsc --noEmit`, the runtime half only confirms the export.
import { Disclosure } from "@keel/std-headless";
import { describe, expect, expectTypeOf, it } from "vitest";

type Props = Parameters<typeof Disclosure>[0];
type WithChildren<C> = Omit<Props, "children"> & { readonly children: C };

describe("k.claim: Disclosure takes children only as a thunk", () => {
  it("`Disclosure({ id, summary, children: node })` is a type error", () => {
    expectTypeOf<WithChildren<Node>>().not.toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<HTMLElement>>().not.toMatchTypeOf<Props>();
  });

  it("`Disclosure({ id, summary, children: 'x' })` is a type error", () => {
    expectTypeOf<WithChildren<string>>().not.toMatchTypeOf<Props>();
  });

  it("`Disclosure` children as an array of nodes is a type error", () => {
    expectTypeOf<WithChildren<Node[]>>().not.toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<readonly Node[]>>().not.toMatchTypeOf<Props>();
  });

  it("`Disclosure` children as a thunk returning a node or a string is not a type error", () => {
    expectTypeOf<WithChildren<() => Node>>().toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<() => string>>().toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<() => HTMLElement>>().toMatchTypeOf<Props>();
    expect(typeof Disclosure).toBe("function");
  });

  it("`Disclosure` still requires `children`", () => {
    expectTypeOf<Omit<Props, "children">>().not.toMatchTypeOf<Props>();
  });
});
