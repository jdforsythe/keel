// @vitest-environment happy-dom
// Spec: k.links, clause "With `launch: 'later'`, `renderRoute` of `/`, then `launch` of `['dev.keel.golden2:/api/auth/callback?code=c']`, of `null` or of `['dev.keel.golden2:/elsewhere']`, then the handle's `navigate('/auto')` records `https://provider.example/a` in `documents()`; the callback link then sends nothing."
// Seed 1337 (the sim ctx's seed is 1337). Fixture: act-pages.ts. `/` is `ac.home`.
// ASSUMED (k.links Testing): `launch: 'later'` is a `renderRoute` option; the handle's `launch(links)` takes an array of URLs or `null`, and may return a promise or nothing (awaited).
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, it } from "vitest";
import { AUTO_HREF } from "./act-pages.ts";
import { routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, base, count, providerDocs } from "./link-helpers.ts";
import { SEED, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

const reports: readonly [string, readonly string[] | null][] = [
  ["the callback link", [CALLBACK]],
  ["null (a failed read)", null],
  ["a link to /elsewhere", ["dev.keel.golden2:/elsewhere"]],
];

describe("k.links: a launch report that names links or fails makes the ctx link-started", () => {
  for (const [name, report] of reports) {
    it(`with launch 'later', renderRoute of /, then launch of ${name}, then navigate('/auto') records the provider URL in documents(); the callback link then sends nothing`, async () => {
      const ctx = createCtx({ mode: "sim", seed: SEED });
      const { handle, sent } = await openShellOver(routes, "ac.home", base, ctx, "later");
      await ticks();
      await handle.launch(report);
      await ticks();
      await handle.navigate(AUTO_HREF);
      await ticks();
      expect(providerDocs(handle)).toBe(1);
      await handle.returnLink(CALLBACK);
      await ticks();
      expect(count(sent, CB_PATH)).toBe(0);
      handle.dispose();
    });
  }
});
