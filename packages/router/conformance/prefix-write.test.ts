// @vitest-environment happy-dom
// Spec: k.prefix, clause "With `p` of `s.enum(['en-US', 'de-DE'], { pathDefault: 'en-US' })` and route `x.show` at `/:p/items/:id`, `routes.href('x.show', { p: 'en-US', id: '7' })` is `/items/7` and with `de-DE` `/de-DE/items/7`; for every generated params value, `navigate(routes.href('x.show', v))` makes `route().params` equal `v`." (rfc:0079) Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { LOCALES, RUNS, SEED, itemIds, open, prefixed } from "./prefix-fixtures.ts";

describe("k.prefix write", () => {
  test("routes.href('x.show', { p: 'en-US', id: '7' }) is /items/7 and with de-DE /de-DE/items/7", () => {
    expect(String(prefixed.href("x.show", { p: "en-US", id: "7" }))).toBe("/items/7");
    expect(String(prefixed.href("x.show", { p: "de-DE", id: "7" }))).toBe("/de-DE/items/7");
    expect(String(prefixed.href("x.home", { p: "en-US" }))).toBe("/");
    expect(String(prefixed.href("x.home", { p: "de-DE" }))).toBe("/de-DE");
  });

  test("for every generated params value, navigate(routes.href('x.show', v)) makes route().params equal v", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...LOCALES), fc.stringMatching(itemIds), async (p, id) => {
        const app = await open(prefixed, "/");
        await app.router.navigate(prefixed.href("x.show", { p, id }));
        const r = app.router.route.get();
        expect(r).toMatchObject({ id: "x.show", params: { p, id }, pending: false });
        app.stop();
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
