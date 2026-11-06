// Spec: k.router, clause "Each of E1501-E1506 has a fixture that triggers it and a clean counterpart."
// E1501 is a type-level rule (a string for Href is a TS error reported under E1501, k.check), checked here by tsc.
// E1502-E1506 are source diagnostics of `keel check` (k.check); @keel/check has no public API yet.
import { type Href, type createRouter, href } from "@keel/router";
import "./fixtures.ts";
import { describe, expect, expectTypeOf, it } from "vitest";

type Navigate = Parameters<ReturnType<typeof createRouter>["navigate"]>[0];

describe("k.router rules", () => {
  it("E1501 string path where an Href is required", () => {
    const clean: Navigate = href("app.home");
    const asHref: Href = href("app.home");
    expect(clean).toBe(asHref);
    expectTypeOf<string>().not.toMatchTypeOf<Href>();
    expectTypeOf<"/orders/1">().not.toMatchTypeOf<Href>();
    expectTypeOf<string>().not.toMatchTypeOf<Navigate>();
  });
  it.todo("E1502 two routes with the same path pattern: untestable until the checker API exists");
  it.todo("E1503 :name in path without a params field, or the reverse: untestable until the checker API exists");
  it.todo("E1504 required field in a search schema: untestable until the checker API exists");
  it.todo(
    "E1505 actions key or Form method not POST/PUT/PATCH/DELETE, or not declared on the target route: untestable until the checker API exists",
  );
  it.todo("E1506 unknown guard or layout name, or a layout cycle: untestable until the checker API exists");
});
