// k.claim, Types "Base elements keep k.ui's Standard slots."
// k.claim, Types "A component a Keel package exports takes content only as a thunk or render function."
// Seed: 1337 (no generated inputs). A type-level test: the assertions are checked by `tsc --noEmit`, the runtime half only confirms the exports.
import { Box, type Button, type Heading, Text } from "@keel/ui";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("k.claim: base elements keep k.ui's Standard slots", () => {
  it("`Box` children accept a node, an array of nodes, a string or a thunk", () => {
    type Children = NonNullable<Parameters<typeof Box>[0]["children"]>;
    expectTypeOf<Node>().toMatchTypeOf<Children>();
    expectTypeOf<Node[]>().toMatchTypeOf<Children>();
    expectTypeOf<string>().toMatchTypeOf<Children>();
    expectTypeOf<() => Node>().toMatchTypeOf<Children>();
    expectTypeOf<() => string>().toMatchTypeOf<Children>();
    expect(typeof Box).toBe("function");
  });

  it("`Text`, `Heading` and `Button` children accept a string and a thunk", () => {
    expectTypeOf<string>().toMatchTypeOf<NonNullable<Parameters<typeof Text>[0]["children"]>>();
    expectTypeOf<() => string>().toMatchTypeOf<NonNullable<Parameters<typeof Text>[0]["children"]>>();
    expectTypeOf<string>().toMatchTypeOf<NonNullable<Parameters<typeof Heading>[0]["children"]>>();
    expectTypeOf<() => string>().toMatchTypeOf<NonNullable<Parameters<typeof Button>[0]["children"]>>();
    expect(typeof Text).toBe("function");
  });
});
