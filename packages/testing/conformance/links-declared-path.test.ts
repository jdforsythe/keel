// @vitest-environment happy-dom
// Spec: k.links, clause "With `links: ['/verify']` and no opening, `returnLink('dev.keel.golden2:/api/auth/verify?t=1')` sends one `net` GET of `/api/auth/verify?t=1` with `x-keel: 1` and `redirect: 'manual'`, and again on a second delivery; after an opening, it sends one GET and the callback link then one more."
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). Fixture: act-pages.ts, whose mount is `identityMount('/api/auth', { links: ['/verify'] })`.
// ASSUMED: the link's own GET is answered 303 to `/` (opens nothing).
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, VERIFY, VERIFY_PATH, base, count, opening } from "./link-helpers.ts";
import { SCHEME, SEED, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

describe("k.links: a declared path is a mount request GET at any time", () => {
  it("with links ['/verify'] and no opening, the verify link sends one net GET of /api/auth/verify?t=1 with x-keel 1 and redirect manual", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await handle.returnLink(VERIFY);
    await ticks();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe("GET");
    expect(sent[0]?.url).toBe(VERIFY_PATH);
    expect(sent[0]?.headers["x-keel"]).toBe("1");
    expect(sent[0]?.headers.accept).toBe("application/json");
    expect(sent[0]?.redirect).toBe("manual");
    handle.dispose();
  });

  it("and again on a second delivery", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await handle.returnLink(VERIFY);
    await ticks();
    await handle.returnLink(VERIFY);
    await ticks();
    expect(count(sent, VERIFY_PATH)).toBe(2);
    handle.dispose();
  });

  it("after an opening, it sends one GET and the callback link then one more", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await opening(handle);
    await handle.returnLink(VERIFY);
    await ticks();
    expect(count(sent, VERIFY_PATH)).toBe(1);
    expect(count(sent, CB_PATH)).toBe(0);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(1);
    handle.dispose();
  });

  it("for any search, the declared path's link sends one GET of the path with exactly that search", async () => {
    const search = fc.stringMatching(/^[a-z0-9]{1,6}=[a-z0-9]{0,6}$/);
    await fc.assert(
      fc.asyncProperty(search, async (q) => {
        closeAll();
        const { handle, sent } = await openShellOver(routes, "ac.home", base);
        await handle.returnLink(`${SCHEME}:/api/auth/verify?${q}`);
        await ticks();
        expect(sent.map((r) => r.url)).toEqual([`/api/auth/verify?${q}`]);
        handle.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
