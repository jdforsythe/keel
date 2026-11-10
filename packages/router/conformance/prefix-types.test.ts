// Spec: k.prefix, clause "`routes.href('x.show', { id: '7' })` and `routes.href('x.show', { p: 'fr-FR', id: '7' })` do not compile." (rfc:0079)
// Type-level; no random inputs. Evaluated by the type checker, so the calls sit in functions that never run.
import { describe, expect, expectTypeOf, test } from "vitest";
import { prefixed } from "./prefix-fixtures.ts";

type Params = Parameters<typeof prefixed.href<"x.show">>[1];

describe("k.prefix types", () => {
  test("routes.href('x.show', { id: '7' }) and routes.href('x.show', { p: 'fr-FR', id: '7' }) do not compile", () => {
    expectTypeOf<{ id: string }>().not.toMatchTypeOf<Params>();
    expectTypeOf<{ p: "fr-FR"; id: string }>().not.toMatchTypeOf<Params>();
    expectTypeOf<{ p: "de-DE"; id: string }>().toMatchTypeOf<Params>();
    // The calls themselves, as compile-time assertions: each constant only type-checks while the call is refused.
    const noLocale: { id: string } extends Params ? false : true = true;
    const unknownLocale: { p: "fr-FR"; id: string } extends Params ? false : true = true;
    expect([noLocale, unknownLocale]).toEqual([true, true]);
    expect(String(prefixed.href("x.show", { p: "de-DE", id: "7" }))).toBe("/de-DE/items/7");
  });
});
