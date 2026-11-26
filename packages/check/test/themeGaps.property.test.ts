// k.themes Library themes: the names an app's contrast or print theme lacks of the shipped one (seed 1337).
import * as fc from "fast-check";
import { expect, it } from "vitest";
import type { Shipped } from "../src/internal/looks/Shipped.ts";
import { themeGaps } from "../src/internal/looks/themeGaps.ts";

const NAMES = ["acme.a", "acme.b", "acme.c", "acme.d"];
const shippedWith = (held: readonly string[]): Shipped => ({
  value: {},
  names: new Map(),
  themes: new Map([["contrast", new Map([["color", held]])]]),
  keys: new Map(),
  problem: null,
});

it("a contrast theme lacks exactly the shipped names it does not hold; other themes are asked for nothing (property)", () => {
  fc.assert(
    fc.property(
      fc.subarray(NAMES),
      fc.subarray(NAMES),
      fc.constantFrom("contrast", "choice", "print"),
      (held, have, when) => {
        const theme = { when, color: Object.fromEntries(have.map((n) => [n, "#000000"])) };
        const gaps = themeGaps(shippedWith(held), { t: theme });
        const lacking = held.filter((n) => !have.includes(n));
        if (when !== "contrast" || lacking.length === 0) expect(gaps).toEqual([]);
        else expect(gaps).toEqual([{ theme: "t", key: "contrast", missing: lacking.map((n) => ["color", n]) }]);
      },
    ),
    { seed: 1337, numRuns: 50 },
  );
});
