// @vitest-environment happy-dom
// Spec: k.head, clause "After a client navigation from a titled `en-US` route to a titled `de-DE` route, `document.title` and `document.documentElement.lang` are the second route's." (rfc:0079) Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, headContract, open, pid, titleOf } from "./head-fixtures.ts";

describe("k.head client navigation", () => {
  test("After a client navigation from a titled `en-US` route to a titled `de-DE` route, `document.title` and `document.documentElement.lang` are the second route's.", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<"home" | "about">("home", "about"),
        fc.constantFrom<"home" | "about">("home", "about"),
        async (from, to) => {
          const app = await open(String(headContract.href(pid(from), { p: "en-US" })));
          expect(document.title).toBe(titleOf("en-US", from));
          expect(document.documentElement.lang).toBe("en-US");
          await app.router.navigate(headContract.href(pid(to), { p: "de-DE" }));
          expect(document.title).toBe(titleOf("de-DE", to));
          expect(document.documentElement.lang).toBe("de-DE");
          app.stop();
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});
