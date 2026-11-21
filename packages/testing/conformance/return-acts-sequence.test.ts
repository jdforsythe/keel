// @vitest-environment happy-dom
// Spec: k.opening, clause "With no opening first, over any sequence of `fire` `keydown` `a`, `navigate('/auto')` and deliveries of the link, each answered 303 to `/`, a `navigate` records an opening unless a delivery was taken since the last act, and a delivery sends one GET exactly when an opening is pending, taking it."
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). Fixture: act-pages.ts.
// ASSUMED: each step first navigates to `/` (not a mount navigation, not an act) so the field exists; a delivery "taken" is one that sent its GET.
// Model: pending and linkStarted both start false; keydown a: linkStarted = false; navigate('/auto'): pending = !linkStarted (a record replaces); delivery: if pending, one GET, pending = false, linkStarted = true.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { AUTO_HREF, HOME_HREF, routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, base, count } from "./link-helpers.ts";
import { SEED, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

type Op = "key" | "auto" | "link";

describe("k.opening: the sequence model of acts, navigations and deliveries", () => {
  it("over any sequence of keydown a, navigate('/auto') and deliveries, a navigate records an opening unless a delivery was taken since the last act, and a delivery sends one GET exactly when an opening is pending", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom<Op>("key", "auto", "link"), { minLength: 1, maxLength: 14 }),
        async (ops) => {
          closeAll();
          const { handle, sent } = await openShellOver(routes, "ac.home", base);
          let pending = false;
          let linkStarted = false;
          let gets = 0;
          for (const op of ops) {
            await handle.navigate(HOME_HREF);
            await ticks();
            if (op === "key") {
              await handle.fire("ac.home.field", { type: "keydown", key: "a" });
              linkStarted = false;
            } else if (op === "auto") {
              await handle.navigate(AUTO_HREF);
              if (!linkStarted) pending = true;
            } else {
              await handle.returnLink(CALLBACK);
              if (pending) {
                gets += 1;
                pending = false;
                linkStarted = true;
              }
            }
            await ticks();
            expect(count(sent, CB_PATH)).toBe(gets);
          }
          handle.dispose();
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });
});
