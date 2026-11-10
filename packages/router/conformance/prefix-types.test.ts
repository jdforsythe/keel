// Spec: k.prefix, clause "`routes.href('x.show', { id: '7' })` and `routes.href('x.show', { p: 'fr-FR', id: '7' })` do not compile." (rfc:0079)
// Type-level; no random inputs. Evaluated by the type checker, so the calls sit in functions that never run.
import { describe, expect, expectTypeOf, test } from "vitest";
import { prefixed } from "./prefix-fixtures.ts";

type Params = Parameters<typeof prefixed.href<"x.show">>[1];

describe("k.prefix types", () => {
  test.skip("routes.href('x.show', { id: '7' }) and routes.href('x.show', { p: 'fr-FR', id: '7' }) do not compile", () => {
    expectTypeOf<{ id: string }>().not.toMatchTypeOf<Params>();
    expectTypeOf<{ p: "fr-FR"; id: string }>().not.toMatchTypeOf<Params>();
    expectTypeOf<{ p: "de-DE"; id: string }>().toMatchTypeOf<Params>();
    const never = (): void => {
      // @ts-expect-error p is required: a link without a locale does not compile
      prefixed.href("x.show", { id: "7" });
      // @ts-expect-error fr-FR is not a value of p
      prefixed.href("x.show", { p: "fr-FR", id: "7" });
    };
    expect(typeof never).toBe("function");
  });
});
