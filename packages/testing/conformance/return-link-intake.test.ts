// @vitest-environment happy-dom
// Spec: k.links, clause "`returnLink('dev.keel.golden2:/api/auth/callback?code=c')` with no opening sends nothing; after a `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a`, it sends one `net` GET of `/api/auth/callback?code=c`, and the same link again sends nothing."
// Spec: k.links, clause "After such an opening, a link to a page navigates; a link of another scheme, or to a path neither a page nor under the mount, sends nothing; a link 600000 ms after the opening (sim clock) sends nothing, one at 599999 ms sends the GET." (the deadline half: return-opening.test.ts)
// Seed 1337 (fc.assert below). Assumption: the shell's `id` is `dev.keel.golden2` under `renderRoute(id, { shell: true })` (the spec's example), a page link is `dev.keel.golden2:/about` (route `mt.about` of mount-pages.ts).
// ASSUMED: the home page's `Link` `mt.home.github` is the opening's `Link` to `mount.href('/login/github')`; its first request is START.
// ASSUMED: a return link's own GET is answered 303 to a page (`sessionAnswer`), so it opens no external browser and records no second opening.
// ASSUMED: a link of another scheme is not a return link and leaves the pending opening for the next link (k.return "other links are ignored").
// Untestable blind: that the in-app Safari view closes and that a link reaches a cold-started app (Limits, device only).
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import {
  SCHEME,
  SEED,
  START,
  beginOpening,
  closeAll,
  openShell,
  redirect,
  returned,
  sessionAnswer,
  ticks,
} from "./return-support.ts";

afterEach(closeAll);

describe("k.links: returnLink delivers a return link to the shell", () => {
  it("returnLink with no opening sends nothing", async () => {
    const { handle, sent } = await openShell("mt.home", sessionAnswer);
    await handle.returnLink(`${SCHEME}:/api/auth/callback?code=c`);
    await ticks();
    expect(sent).toEqual([]);
    expect(handle.documents()).toEqual([]);
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });

  it("after a Link to the mount answered 302 to another origin, the link sends one net GET of the path and search, with x-keel 1 and redirect manual", async () => {
    const { handle, sent } = await openShell("mt.home", sessionAnswer);
    await beginOpening(handle);
    await handle.returnLink(`${SCHEME}:/api/auth/callback?code=c`);
    await ticks();
    const got = returned(sent);
    expect(got).toHaveLength(1);
    expect(got[0]?.method).toBe("GET");
    expect(got[0]?.url).toBe("/api/auth/callback?code=c");
    expect(got[0]?.headers["x-keel"]).toBe("1");
    expect(got[0]?.redirect).toBe("manual");
    handle.dispose();
  });

  it("the same link again sends nothing", async () => {
    const { handle, sent } = await openShell("mt.home", sessionAnswer);
    await beginOpening(handle);
    await handle.returnLink(`${SCHEME}:/api/auth/callback?code=c`);
    await ticks();
    await handle.returnLink(`${SCHEME}:/api/auth/callback?code=c`);
    await ticks();
    expect(returned(sent)).toHaveLength(1);
    handle.dispose();
  });

  it("for generated paths and codes under the mount, after an opening, one net GET of exactly that path and search", async () => {
    const seg = fc.stringMatching(/^[a-z]{1,6}$/);
    const code = fc.stringMatching(/^[A-Za-z0-9]{1,8}$/);
    await fc.assert(
      fc.asyncProperty(seg, code, async (s, c) => {
        closeAll();
        const { handle, sent } = await openShell("mt.home", sessionAnswer);
        await beginOpening(handle);
        await handle.returnLink(`${SCHEME}:/api/auth/${s}?code=${c}`);
        await ticks();
        expect(returned(sent).map((r) => r.url)).toEqual([`/api/auth/${s}?code=${c}`]);
        handle.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("after an opening, a link to a page the router matches navigates there and sends nothing", async () => {
    const { handle, sent } = await openShell("mt.home", sessionAnswer);
    await beginOpening(handle);
    await handle.returnLink(`${SCHEME}:/about`);
    await ticks();
    expect(handle.route().id).toBe("mt.about");
    expect(returned(sent)).toEqual([]);
    handle.dispose();
  });

  it("after an opening, a link of another scheme sends nothing and keeps the page", async () => {
    const { handle, sent } = await openShell("mt.home", sessionAnswer);
    await beginOpening(handle);
    await handle.returnLink("dev.keel.other:/api/auth/callback?code=c");
    await ticks();
    expect(returned(sent)).toEqual([]);
    expect(handle.documents().map((d) => d.url)).toEqual(["https://provider.example/a"]);
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });

  it("a link of another scheme leaves the opening for the next return link", async () => {
    const { handle, sent } = await openShell("mt.home", sessionAnswer);
    await beginOpening(handle);
    await handle.returnLink("dev.keel.other:/api/auth/callback?code=c");
    await handle.returnLink(`${SCHEME}:/api/auth/callback?code=c`);
    await ticks();
    expect(returned(sent).map((r) => r.url)).toEqual(["/api/auth/callback?code=c"]);
    handle.dispose();
  });

  it("after an opening, a path neither under the mount nor a page is ignored: nothing sent, page kept", async () => {
    const { handle, sent } = await openShell("mt.home", sessionAnswer);
    await beginOpening(handle);
    await handle.returnLink(`${SCHEME}:/elsewhere/x?code=c`);
    await ticks();
    expect(returned(sent)).toEqual([]);
    expect(handle.documents()).toHaveLength(1);
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });

  it("a link's mount GET answered by a 303 to a page navigates there", async () => {
    const { handle, sent } = await openShell("mt.home", (s) =>
      s.url === START ? redirect(302, "https://provider.example/a") : redirect(303, "/about"),
    );
    await beginOpening(handle);
    await handle.returnLink(`${SCHEME}:/api/auth/callback?code=c`);
    await ticks();
    expect(returned(sent)).toHaveLength(1);
    expect(handle.route().id).toBe("mt.about");
    handle.dispose();
  });
});
