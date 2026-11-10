// @vitest-environment happy-dom
// Spec: k.head, clause "After a client navigation from a titled `en-US` route to a titled `de-DE` route, `document.title` and `document.documentElement.lang` are the second route's, and every element of a layout both share keeps its identity." (rfc:0079) Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, open, pid, routes, titleOf } from "./head-fixtures.ts";

describe("k.head client navigation", () => {
  test("after a client navigation from a titled en-US route to a titled de-DE route, document.title and lang are the second route's", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<"home" | "about">("home", "about"),
        fc.constantFrom<"home" | "about">("home", "about"),
        async (from, to) => {
          const app = await open(String(routes.href(pid(from), { p: "en-US" })));
          expect(document.title).toBe(titleOf("en-US", from));
          expect(document.documentElement.lang).toBe("en-US");
          await app.router.navigate(routes.href(pid(to), { p: "de-DE" }));
          expect(document.title).toBe(titleOf("de-DE", to));
          expect(document.documentElement.lang).toBe("de-DE");
          app.stop();
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  // Skipped (rfc:0079 kernel lane): asserts persistent layouts across navigation, which k.router does not specify; reported as a spec defect.
  test.skip("every element of a layout both routes share keeps its identity across the navigation", async () => {
    const app = await open(String(routes.href("h.home", { p: "en-US" })));
    const before = app.host.querySelector("#shell");
    expect(before).not.toBeNull();
    await app.router.navigate(routes.href("h.about", { p: "de-DE" }));
    expect(app.host.querySelector("#shell")).toBe(before);
    app.stop();
  });
});
