// @vitest-environment happy-dom
// Spec: k.mount, Declaration "The mount is that default export only: the build passes its `path` to the router and its `path` and `links` to a shell (k.return), and no other `identityMount` call's `path` or `links` reaches either."
// Spec: k.mount, Conformance "A `renderRoute` harness with `shell` and `mount` `identityMount('/api/auth', { links: ['/verify'] })`, whose page module also calls `identityMount(p, { links: [l] })`: for every `p` and `l` the call accepts, `p` neither `/api/auth` nor under it and no page at `p` plus `l`, with no opening a return link to `p` plus `l` sends no `net` request, and `navigate` to `p` plus `l` records one GET in `documents()` and sends no `net` request."
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). Fixture: act-pages.ts, whose `mount` is `identityMount('/api/auth', { links: ['/verify'] })`; its pages are `/`, `/auto`, `/act` and `/about`.
// ASSUMPTIONS: the "page module" calls `identityMount(p, { links: [l] })` before the harness opens (the test makes the call, as mount-router-scope-none.test.ts makes its own); "a return link to `p` plus `l`" is `returnLink('dev.keel.golden2:<p><l>')`; `documents()` holds `{ method: 'GET', url: '<p><l>', body: null }`.
// The checker half (E1593 at such a call) is packages/check/conformance/mount-identitymount-e1593.test.ts.
import { identityMount } from "@keel/router";
import type { Href } from "@keel/router";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "./act-pages.ts";
import { base } from "./link-helpers.ts";
import { SCHEME, SEED, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

const PAGES = ["/", "/auto", "/act", "/about"];
const isHref = (s: string): s is Href => true;
const raw = (s: string): Href => {
  if (!isHref(s)) throw new Error("unreachable");
  return s;
};
const underMount = (p: string): boolean => p === "/api/auth" || p.startsWith("/api/auth/");

async function strayThenOpen(p: string, l: string) {
  identityMount(p, { links: [l] });
  return openShellOver(routes, "ac.home", base);
}

describe("k.mount: a stray identityMount call's links reach no shell", () => {
  it("with identityMount('/x', { links: ['/v'] }) called by the page module, a return link to /x/v with no opening sends no net request, and navigate to /x/v records one GET in documents() and sends no net request", async () => {
    const { handle, sent } = await strayThenOpen("/x", "/v");
    await handle.returnLink(`${SCHEME}:/x/v`);
    await ticks();
    expect(sent).toEqual([]);
    expect(handle.documents()).toEqual([]);
    await handle.navigate(raw("/x/v"));
    await ticks();
    expect(sent).toEqual([]);
    expect(handle.documents()).toEqual([{ method: "GET", url: "/x/v", body: null }]);
    handle.dispose();
  });

  it("the harness mount's own declared link still sends its GET with no opening, so the stray call took nothing from it", async () => {
    const { handle, sent } = await strayThenOpen("/x", "/v");
    await handle.returnLink(`${SCHEME}:/api/auth/verify?t=1`);
    await ticks();
    expect(sent.map((r) => r.url)).toEqual(["/api/auth/verify?t=1"]);
    handle.dispose();
  });

  it("for every p and l the call accepts, p neither /api/auth nor under it and no page at p plus l: with no opening a return link to p plus l sends no net request, and navigate to p plus l records one GET in documents() and sends no net request", async () => {
    const seg = fc.stringMatching(/^[a-z][a-z0-9-]{0,6}$/);
    const p = fc.array(seg, { minLength: 1, maxLength: 3 }).map((xs) => `/${xs.join("/")}`);
    const sub = fc.stringMatching(/^[A-Za-z0-9._~-]{1,6}$/).filter((x) => x !== "." && x !== "..");
    const l = fc.array(sub, { minLength: 1, maxLength: 2 }).map((xs) => `/${xs.join("/")}`);
    await fc.assert(
      fc.asyncProperty(
        p.filter((x) => !underMount(x)),
        l,
        async (path, link) => {
          fc.pre(!PAGES.includes(`${path}${link}`));
          closeAll();
          const { handle, sent } = await strayThenOpen(path, link);
          await handle.returnLink(`${SCHEME}:${path}${link}`);
          await ticks();
          expect(sent).toEqual([]);
          await handle.navigate(raw(`${path}${link}`));
          await ticks();
          expect(sent).toEqual([]);
          expect(handle.documents()).toEqual([{ method: "GET", url: `${path}${link}`, body: null }]);
          handle.dispose();
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });
});
