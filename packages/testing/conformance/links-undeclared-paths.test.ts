// @vitest-environment happy-dom
// Spec: k.links, clause "With `links: ['/verify']` and no opening, links to `/api/auth/verify/x`, `/api/auth/Verify` and `/api/auth/callback?code=c` each send nothing."
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). Fixture: act-pages.ts (mount declared with `links: ['/verify']`).
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "./act-pages.ts";
import { base } from "./link-helpers.ts";
import { SCHEME, SEED, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

describe("k.links: a path under the mount that is not declared needs an opening", () => {
  for (const path of ["/api/auth/verify/x", "/api/auth/Verify", "/api/auth/callback?code=c"]) {
    it(`with links ['/verify'] and no opening, a link to ${path} sends nothing`, async () => {
      const { handle, sent } = await openShellOver(routes, "ac.home", base);
      await handle.returnLink(`${SCHEME}:${path}`);
      await ticks();
      expect(sent).toEqual([]);
      expect(handle.documents()).toEqual([]);
      handle.dispose();
    });
  }

  it("for any subpath other than /verify, with no opening, a link under the mount sends nothing", async () => {
    const seg = fc.stringMatching(/^[A-Za-z0-9]{1,8}$/).filter((v) => v !== "verify");
    await fc.assert(
      fc.asyncProperty(seg, fc.boolean(), async (v, deeper) => {
        closeAll();
        const { handle, sent } = await openShellOver(routes, "ac.home", base);
        await handle.returnLink(`${SCHEME}:/api/auth/${v}${deeper ? "/verify" : ""}?t=1`);
        await ticks();
        expect(sent).toEqual([]);
        handle.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
