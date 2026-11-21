// @vitest-environment happy-dom
// Spec: k.links, clause "With `links: ['/verify']` and no opening, the verify link answered 302 to `https://provider.example/b` records that URL in `documents()`; the callback link then sends nothing."
// Seed 1337 (the sim ctx's seed is 1337). Fixture: act-pages.ts (mount declared with `links: ['/verify']`).
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, VERIFY, VERIFY_PATH, base, count } from "./link-helpers.ts";
import { closeAll, openShellOver, redirect, ticks } from "./return-support.ts";

afterEach(closeAll);

const OTHER = "https://provider.example/b";

describe("k.links: a chain a declared path starts records no opening", () => {
  it("with links ['/verify'] and no opening, the verify link answered 302 to https://provider.example/b records that URL in documents()", async () => {
    const { handle } = await openShellOver(routes, "ac.home", (s, i) =>
      s.url === VERIFY_PATH ? redirect(302, OTHER) : base(s, i),
    );
    await handle.returnLink(VERIFY);
    await ticks();
    expect(handle.documents().map((d) => d.url)).toEqual([OTHER]);
    handle.dispose();
  });

  it("the callback link then sends nothing", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", (s, i) =>
      s.url === VERIFY_PATH ? redirect(302, OTHER) : base(s, i),
    );
    await handle.returnLink(VERIFY);
    await ticks();
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(count(sent, CB_PATH)).toBe(0);
    handle.dispose();
  });
});
