// @vitest-environment happy-dom
// Spec: k.links, clause "With no opening, `returnLink('dev.keel.golden2:/about')` navigates to `/about` and sends nothing through `net`; after an opening, that link leaves it pending: the callback link then sends one GET."
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). Fixture: act-pages.ts (`/about` is route `ac.about`).
// ASSUMED: the link's own GET is answered 303 to `/` (opens nothing); a link not admitted sends no `net` request.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, base, count, opening } from "./link-helpers.ts";
import { SCHEME, SEED, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

describe("k.links: a link to a page takes no opening", () => {
  it("with no opening, returnLink('dev.keel.golden2:/about') navigates to /about and sends nothing through net", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await handle.returnLink(`${SCHEME}:/about`);
    await ticks();
    expect(handle.route().id).toBe("ac.about");
    expect(sent).toEqual([]);
    handle.dispose();
  });

  it("after an opening, that link leaves it pending: the callback link then sends one GET", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await opening(handle);
    await handle.returnLink(`${SCHEME}:/about`);
    await ticks();
    expect(handle.route().id).toBe("ac.about");
    expect(count(sent, CB_PATH)).toBe(0);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(1);
    handle.dispose();
  });

  it("for any number of page links after an opening, the callback link then sends one GET", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
        closeAll();
        const { handle, sent } = await openShellOver(routes, "ac.home", base);
        await opening(handle);
        for (let i = 0; i < n; i++) {
          await handle.returnLink(`${SCHEME}:/about`);
          await ticks();
        }
        await handle.returnLink(CALLBACK);
        await ticks();
        expect(count(sent, CB_PATH)).toBe(1);
        handle.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
