// @vitest-environment happy-dom
// Spec: k.prefix, clause "`/items/7` matches `x.show` with `p` `en-US` and `/de-DE/items/7` with `de-DE`; `/fr-FR/items/7` is 404; without `pathDefault`, `/items/7` is 404 and `/en-US/items/7` matches." (rfc:0079) Seed 1337.
// The router half: a URL reaches the router from outside (history.external). 404 is read as no match: matchHref is null. The HTTP 404 status is in packages/server/conformance/prefix-parse.test.ts.
import { matchHref } from "@keel/router/match";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { RUNS, SEED, itemIds, links, prefixed, unprefixed } from "./prefix-fixtures.ts";

describe("k.prefix parse", () => {
  test.skip("/items/7 matches x.show with p en-US and /de-DE/items/7 with de-DE", () => {
    fc.assert(
      fc.property(fc.stringMatching(itemIds), (id) => {
        expect(matchHref(prefixed, links.href("raw.plain", { id }))).toEqual({
          id: "x.show",
          params: { p: "en-US", id },
          search: {},
        });
        expect(matchHref(prefixed, links.href("raw.de", { id }))).toEqual({
          id: "x.show",
          params: { p: "de-DE", id },
          search: {},
        });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test.skip("/fr-FR/items/7 is 404 (no match)", () => {
    expect(matchHref(prefixed, links.href("raw.fr", { id: "7" }))).toBeNull();
  });

  test.skip("without pathDefault, /items/7 is 404 and /en-US/items/7 matches", () => {
    expect(matchHref(unprefixed, links.href("raw.plain", { id: "7" }))).toBeNull();
    expect(matchHref(unprefixed, links.href("raw.en", { id: "7" }))).toEqual({
      id: "x.show",
      params: { p: "en-US", id: "7" },
      search: {},
    });
  });
});
