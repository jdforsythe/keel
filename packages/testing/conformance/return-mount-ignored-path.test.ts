// @vitest-environment happy-dom
// Spec: k.return, clause "A `Link` to `mount.href('/login/github')` answered 302 to `/.//evil.example/x`, or to `/\evil.example/x`, records nothing in `documents()`, sends no second `net` GET and keeps the page; `returnLink('dev.keel.golden2:/.//evil.example/x')` sends nothing and keeps the page."
// Seed 1337 (the sim ctx's seed is 1337). Reuses the k.mount home page (mount-pages.ts): `mt.home.github` is a `Link` to `mount.href('/login/github', { next: 'a b' })`.
import { afterEach, describe, expect, it } from "vitest";
import { SCHEME, START, closeAll, openShell, plain, redirect, ticks } from "./return-support.ts";

afterEach(closeAll);

describe("k.return: a location or return link whose path begins // or /\\ after dot-segment removal is ignored", () => {
  for (const location of ["/.//evil.example/x", "/\\evil.example/x"]) {
    it(`a Link to the mount answered 302 to ${location} records nothing in documents(), sends no second net GET and keeps the page`, async () => {
      const { handle, sent } = await openShell("mt.home", (_s, i) => (i === 0 ? redirect(302, location) : plain()));
      await handle.fire("mt.home.github", { type: "click" });
      await ticks();
      expect(sent.map((r) => [r.method, r.url])).toEqual([["GET", START]]);
      expect(handle.documents()).toEqual([]);
      expect(handle.route().id).toBe("mt.home");
      handle.dispose();
    });
  }

  it("returnLink('dev.keel.golden2:/.//evil.example/x') sends nothing and keeps the page, with no opening and after one", async () => {
    const { handle, sent } = await openShell("mt.home", (_s, i) =>
      i === 0 ? redirect(302, "https://provider.example/a") : plain(),
    );
    await handle.returnLink(`${SCHEME}:/.//evil.example/x`);
    await ticks();
    expect(sent).toEqual([]);
    expect(handle.route().id).toBe("mt.home");
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    await handle.returnLink(`${SCHEME}:/.//evil.example/x`);
    await ticks();
    expect(sent.map((r) => r.url)).toEqual([START]);
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });
});
