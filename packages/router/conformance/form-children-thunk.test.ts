// k.claim, Types "A component a Keel package exports takes content only as a thunk or render function. `Form` (k.router) takes `children?: () => Node | readonly Node[] | string`; `Disclosure` (std.headless) takes `children: () => Child`."
// Spec: k.claim, clause "`Form` or `Disclosure` given `children` as a node, an array of nodes or a string is a type error; a thunk is not."
// Seed: 1337 (no generated inputs). A type-level test: the assertions are checked by `tsc --noEmit`, the runtime half only confirms the export.
import { Form } from "@keel/router";
import type { FormProps } from "@keel/router";
import { describe, expect, expectTypeOf, it } from "vitest";

type Props = Parameters<typeof Form>[0];
type WithChildren<C> = Omit<Props, "children"> & { readonly children: C };

describe("k.claim: Form takes children only as a thunk", () => {
  it("`Form({ method, action, children: node })` is a type error", () => {
    expectTypeOf<WithChildren<Node>>().not.toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<HTMLElement>>().not.toMatchTypeOf<Props>();
  });

  it("`Form({ method, action, children: [node] })` is a type error", () => {
    expectTypeOf<WithChildren<Node[]>>().not.toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<readonly Node[]>>().not.toMatchTypeOf<Props>();
  });

  it("`Form({ method, action, children: 'go' })` is a type error", () => {
    expectTypeOf<WithChildren<string>>().not.toMatchTypeOf<Props>();
  });

  it("`Form` children as `() => node`, `() => [a, b]` or `() => 'go'` is not a type error", () => {
    expectTypeOf<WithChildren<() => Node>>().toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<() => Node[]>>().toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<() => readonly Node[]>>().toMatchTypeOf<Props>();
    expectTypeOf<WithChildren<() => string>>().toMatchTypeOf<Props>();
    expect(typeof Form).toBe("function");
  });

  it("`Form` children stay optional", () => {
    expectTypeOf<Omit<Props, "children">>().toMatchTypeOf<Props>();
  });

  it("`FormProps` holds the same children type as the `Form` parameter", () => {
    expectTypeOf<FormProps["children"]>().toEqualTypeOf<Props["children"]>();
    expectTypeOf<Node>().not.toMatchTypeOf<NonNullable<FormProps["children"]>>();
    expectTypeOf<string>().not.toMatchTypeOf<NonNullable<FormProps["children"]>>();
  });
});
