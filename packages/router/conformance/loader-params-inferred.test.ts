// @vitest-environment happy-dom
// Spec: k.router Conformance: A loader declared with `params: P` gives `fn` `params` of type `Infer<typeof P>`; `manifest` throws E1507 when the route's `params` is another schema value.
// The type half is checked by `tsc --noEmit` (expectTypeOf inside fn bodies); the runtime half by `manifest`.
import { action, loader, manifest } from "@keel/router";
import { type Infer, ok, s } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";

const P = s.object({ id: s.id("Order") });
const POther = s.object({ id: s.id("Order") }); // same shape, different schema value
const Q = s.object({ tab: s.enum(["items", "history"]).optional() });
const QOther = s.object({ tab: s.enum(["items", "history"]).optional() });
const Out = s.object({ title: s.string() });
const Edit = s.object({ note: s.string() });
const page = (): Node => document.createElement("section");

const load = loader({ output: Out, params: P, search: Q }, async ({ params, search, url }) => {
  expectTypeOf(params).toEqualTypeOf<Infer<typeof P>>();
  expectTypeOf(search).toEqualTypeOf<Infer<typeof Q>>();
  expectTypeOf(url).toEqualTypeOf<string>();
  return ok({ title: "t" });
});
const save = action({ input: Edit, params: P }, async (input, { params }) => {
  expectTypeOf(input).toEqualTypeOf<Infer<typeof Edit>>();
  expectTypeOf(params).toEqualTypeOf<Infer<typeof P>>();
  return ok(null);
});

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  return null;
};

describe("k.router E1507", () => {
  it("A loader declared with `params: P` gives `fn` `params` of type `Infer<typeof P>`", () => {
    expectTypeOf(load).not.toBeAny();
    expectTypeOf(save).not.toBeAny();
    expect(load.kind).toBe("keel.loader");
  });

  it("`manifest` throws E1507 when the route's `params` is another schema value (loader)", () => {
    expect(
      codeOf(() => manifest({ "p.one": { path: "/p/:id", params: POther, loader: load, search: Q, component: page } })),
    ).toBe("E1507");
    expect(
      codeOf(() => manifest({ "p.two": { path: "/p/:id", params: P, loader: load, search: Q, component: page } })),
    ).toBeNull();
  });

  it("`manifest` throws E1507 when the route's `search` is another schema value (loader)", () => {
    expect(
      codeOf(() => manifest({ "q.one": { path: "/q/:id", params: P, search: QOther, loader: load, component: page } })),
    ).toBe("E1507");
  });

  it("`manifest` throws E1507 when the route's `params` is another schema value (action)", () => {
    expect(
      codeOf(() => manifest({ "a.one": { path: "/a/:id", params: POther, actions: { POST: save }, component: page } })),
    ).toBe("E1507");
    expect(
      codeOf(() => manifest({ "a.two": { path: "/a/:id", params: P, actions: { POST: save }, component: page } })),
    ).toBeNull();
  });
});
