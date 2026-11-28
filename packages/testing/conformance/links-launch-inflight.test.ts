// @vitest-environment happy-dom
// Spec: k.links, clause "With `launch: 'later'`, `renderRoute` of `/auto` whose mount GET is answered 302 to `https://provider.example/a` only once `launch(null)` is called records that URL in `documents()`; the callback link then sends nothing. With `launch([])` instead, one GET."
// Seed 1337 (the sim ctx's seed is 1337). Fixture: act-pages.ts.
// ASSUMED: the handle's `launch(links)` reports at the call (it is not awaited before the answer is released), and resolves once the links are delivered and the page has settled (k.return Testing).
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, it } from "vitest";
import { START, routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, count, providerDocs } from "./link-helpers.ts";
import { PROVIDER, SEED, closeAll, openShellOver, redirect, ticks } from "./return-support.ts";

afterEach(closeAll);

async function run(links: readonly string[] | null) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const { handle, sent } = await openShellOver(
    routes,
    "ac.auto",
    async (s) => {
      if (s.url !== START) return redirect(303, "/");
      await gate;
      return redirect(302, PROVIDER);
    },
    ctx,
    "later",
  );
  await ticks();
  expect(count(sent, START)).toBe(1);
  expect(providerDocs(handle)).toBe(0);
  const reported = handle.launch(links);
  await ticks();
  release();
  await reported;
  await ticks();
  return { handle, sent };
}

describe("k.links: a mount request in flight when a launch report arrives records no opening after a report of null", () => {
  it("with launch 'later', renderRoute of /auto answered 302 only once launch(null) is called records the provider URL in documents(); the callback link then sends nothing", async () => {
    const { handle, sent } = await run(null);
    expect(providerDocs(handle)).toBe(1);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(0);
    handle.dispose();
  });

  it("with launch([]) instead, the callback link sends one GET", async () => {
    const { handle, sent } = await run([]);
    expect(providerDocs(handle)).toBe(1);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(1);
    handle.dispose();
  });
});
