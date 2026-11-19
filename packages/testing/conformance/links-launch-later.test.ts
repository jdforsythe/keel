// @vitest-environment happy-dom
// Spec: k.links, clause "With `launch: 'later'`, `renderRoute` of `/auto` records `https://provider.example/a` in `documents()`; after `launch([])` the callback link sends one GET; after `launch(null)` instead it sends nothing; after `launch(['dev.keel.golden2:/api/auth/callback?code=c'])` instead nothing is sent, at launch or on a later delivery."
// Seed 1337 (the sim ctx's seed is 1337). Fixture: act-pages.ts.
// ASSUMED (k.links Testing): `launch: 'later'` is a `renderRoute` option; the handle has `launch(links)`, `links` an array of URLs or `null`; it may return a promise or nothing (awaited).
// ASSUMED: the held opening's deadline is 600000 ms after the browser opened (k.links Launch: "as of when it opened"); the sim clock moves only through `advance`.
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, it } from "vitest";
import { HOME_HREF, routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, base, count, providerDocs } from "./link-helpers.ts";
import { SEED, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

const later = async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const shell = await openShellOver(routes, "ac.auto", base, ctx, "later");
  return { ...shell, ctx };
};

describe("k.links: until the shell reports its launch, an opening with no act is held", () => {
  it("with launch 'later', renderRoute of /auto records the provider URL in documents()", async () => {
    const { handle } = await later();
    await ticks();
    expect(providerDocs(handle)).toBe(1);
    handle.dispose();
  });

  it("after launch([]) the callback link sends one GET", async () => {
    const { handle, sent } = await later();
    await ticks();
    await handle.launch([]);
    await ticks();
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(1);
    handle.dispose();
  });

  it("before any launch report, the callback link sends nothing", async () => {
    const { handle, sent } = await later();
    await ticks();
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(0);
    handle.dispose();
  });

  it("after launch(null) instead, the callback link sends nothing", async () => {
    const { handle, sent } = await later();
    await ticks();
    await handle.launch(null);
    await ticks();
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(0);
    handle.dispose();
  });

  it("after launch(['dev.keel.golden2:/api/auth/callback?code=c']) instead, nothing is sent at launch or on a later delivery", async () => {
    const { handle, sent } = await later();
    await ticks();
    await handle.launch([CALLBACK]);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(0);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(0);
    handle.dispose();
  });

  it("a report of no link records the held opening as of when it opened: a callback link 599999 ms after it sends one GET, 600000 ms after it nothing", async () => {
    for (const [at, expected] of [
      [599999, 1],
      [600000, 0],
    ] as const) {
      const { handle, sent, ctx } = await later();
      await ticks();
      await ctx.clock.advance(at);
      await handle.launch([]);
      await ticks();
      await handle.returnLink(CALLBACK);
      await ticks();
      expect(count(sent, CB_PATH)).toBe(expected);
      handle.dispose();
      closeAll();
    }
  });

  it("a report of no link does not replace a later opening a person's act recorded", async () => {
    const { handle, sent, ctx } = await later();
    await ticks();
    await ctx.clock.advance(1000);
    await handle.navigate(HOME_HREF);
    await ticks();
    await handle.fire("ac.home.github", { type: "click" });
    await ticks();
    await handle.launch([]);
    await ticks();
    await ctx.clock.advance(599500);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(1);
    handle.dispose();
  });

  it("a shell that never reports records no opening before a person's act, and one after it", async () => {
    const { handle, sent } = await later();
    await ticks();
    await handle.navigate(HOME_HREF);
    await ticks();
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(0);
    await handle.fire("ac.home.github", { type: "click" });
    await ticks();
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(1);
    handle.dispose();
  });
});
