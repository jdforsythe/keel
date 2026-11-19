// @vitest-environment happy-dom
// Spec: k.prefix, clause "A GET of `/en-US/items/7?q=1` answers 308 with `Location: /items/7?q=1`; a client navigation to it ends at `/items/7` with `p` `en-US` and adds one history entry." (rfc:0079) Seed 1337.
// The client half. The HTTP 308 half is packages/server/conformance/prefix-canonical-308.test.ts (@keel/server is not a dependency of @keel/router).
import { matchHref } from "@keel/router/match";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { RUNS, SEED, itemIds, links, open, prefixed } from "./prefix-fixtures.ts";

describe("k.prefix canonical URL (client)", () => {
  test("a client navigation to /en-US/items/7 ends at /items/7 with p en-US and adds one history entry", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(itemIds), async (id) => {
        const app = await open(prefixed, "/de-DE");
        await app.router.navigate(links.href("raw.en", { id }));
        expect(app.history.current()).toBe(`/items/${id}`);
        expect(app.router.route.get()).toMatchObject({ id: "x.show", params: { p: "en-US", id } });
        app.history.back();
        expect(app.history.current()).toBe("/de-DE");
        app.stop();
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test("matchHref of a /en-US/ href gives its target's match", () => {
    expect(matchHref(prefixed, links.href("raw.en", { id: "7" }))).toEqual({
      id: "x.show",
      params: { p: "en-US", id: "7" },
      search: {},
    });
  });
});
