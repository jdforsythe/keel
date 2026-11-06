// Spec: k.ui Rules E1801 (raw value where a token is required) and E1802 (missing a11y-required prop).
// Type-level: assertions are checked by `tsc`/vitest typecheck; the runtime expect only keeps the file a test.
import { Button, Checkbox, Heading, Image, Input, Link, Select, TextArea, Box } from "@keel/ui";
import { describe, expect, expectTypeOf, it } from "vitest";

type P<F extends (...a: never[]) => unknown> = Parameters<F>[0];
type Empty = Record<never, never>;
type Required_<T, K extends keyof T> = Empty extends Pick<T, K> ? false : true;

describe("k.ui: E1802 missing a11y-required prop", () => {
  it("E1802 Heading requires level", () => {
    expectTypeOf<Required_<P<typeof Heading>, "level">>().toEqualTypeOf<true>();
    expect(true).toBe(true);
  });
  it("E1802 Image requires alt or decorative", () => {
    expectTypeOf<Empty>().not.toMatchTypeOf<P<typeof Image>>();
    expectTypeOf<{ alt: string }>().toMatchTypeOf<P<typeof Image>>();
    expectTypeOf<{ decorative: true }>().toMatchTypeOf<P<typeof Image>>();
    expect(true).toBe(true);
  });
  it("E1802 Input requires label", () => {
    expectTypeOf<Required_<P<typeof Input>, "label">>().toEqualTypeOf<true>();
    expect(true).toBe(true);
  });
  it("E1802 TextArea requires label", () => {
    expectTypeOf<Required_<P<typeof TextArea>, "label">>().toEqualTypeOf<true>();
    expect(true).toBe(true);
  });
  it("E1802 Select requires label", () => {
    expectTypeOf<Required_<P<typeof Select>, "label">>().toEqualTypeOf<true>();
    expect(true).toBe(true);
  });
  it("E1802 Checkbox requires label", () => {
    expectTypeOf<Required_<P<typeof Checkbox>, "label">>().toEqualTypeOf<true>();
    expect(true).toBe(true);
  });
  it("E1802 Link requires to", () => {
    expectTypeOf<Required_<P<typeof Link>, "to">>().toEqualTypeOf<true>();
    expect(true).toBe(true);
  });
  it("E1802 Button requires text or label", () => {
    expectTypeOf<Empty>().not.toMatchTypeOf<P<typeof Button>>();
    expect(true).toBe(true);
  });
});

describe("k.ui: E1801 raw value where a token is required", () => {
  it("E1801 style props reject raw values at the type level", () => {
    type BoxP = P<typeof Box>;
    expectTypeOf<{ p: "16px" }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ bg: "#fff" }>().not.toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });
});
