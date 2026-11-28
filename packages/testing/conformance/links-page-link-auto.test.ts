// @vitest-environment happy-dom
// Spec: k.links, clause "With no opening, `returnLink('dev.keel.golden2:/auto')` navigates to `/auto` and records `https://provider.example/a` in `documents()`; the callback link then sends nothing. After an opening, that page link leaves it pending: the callback link then sends one GET."
// Seed 1337 (the sim ctx's seed is 1337). Fixture: act-pages.ts (`/auto`'s render calls `navigate(mount.href('/login/github'))`).
// ASSUMED: the link's own GET is answered 303 to `/` (opens nothing).
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, base, count, opening, providerDocs } from "./link-helpers.ts";
import { SCHEME, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

describe("k.links: a page link whose page starts a sign-in on render records no opening", () => {
  it("with no opening, returnLink('dev.keel.golden2:/auto') navigates to /auto and records the provider URL in documents()", async () => {
    const { handle } = await openShellOver(routes, "ac.home", base);
    await handle.returnLink(`${SCHEME}:/auto`);
    await ticks();
    expect(handle.route().id).toBe("ac.auto");
    expect(providerDocs(handle)).toBe(1);
    handle.dispose();
  });

  it("the callback link then sends nothing", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await handle.returnLink(`${SCHEME}:/auto`);
    await ticks();
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(0);
    handle.dispose();
  });

  it("after an opening, that page link leaves it pending: the callback link then sends one GET", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await opening(handle);
    await handle.returnLink(`${SCHEME}:/auto`);
    await ticks();
    expect(providerDocs(handle)).toBe(2);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(1);
    handle.dispose();
  });
});
