// @vitest-environment happy-dom
// Spec: k.return, clause "`returnLink('dev.keel.golden2:/api/auth/callback?code=c')` sends one `net` GET of `/api/auth/callback?code=c`; one to a page navigates; another scheme or path sends nothing."
// Seed 1337 (fc.assert below). Assumption: the shell's `id` is `dev.keel.golden2` under `renderRoute(id, { shell: true })` (the spec's example), a page link is `dev.keel.golden2:/about` (route `mt.about` of mount-pages.ts).
// Untestable blind: that the in-app Safari view closes and that a link reaches a cold-started app (Limits, device only).
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SCHEME, SEED, closeAll, openShell, plain, redirect, ticks } from "./return-support.ts";

afterEach(closeAll);

describe("k.return: returnLink delivers a return link to the shell", () => {
  it("a link under the mount sends one net GET of the path and search, with x-keel 1 and redirect manual", async () => {
    const { handle, sent } = await openShell("mt.home", () => plain());
    await handle.returnLink(`${SCHEME}:/api/auth/callback?code=c`);
    await ticks();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe("GET");
    expect(sent[0]?.url).toBe("/api/auth/callback?code=c");
    expect(sent[0]?.headers["x-keel"]).toBe("1");
    expect(sent[0]?.redirect).toBe("manual");
    handle.dispose();
  });

  it("for generated paths and codes under the mount, one net GET of exactly that path and search", async () => {
    const seg = fc.stringMatching(/^[a-z]{1,6}$/);
    const code = fc.stringMatching(/^[A-Za-z0-9]{1,8}$/);
    await fc.assert(
      fc.asyncProperty(seg, code, async (s, c) => {
        closeAll();
        const { handle, sent } = await openShell("mt.home", () => plain());
        await handle.returnLink(`${SCHEME}:/api/auth/${s}?code=${c}`);
        await ticks();
        expect(sent.map((r) => r.url)).toEqual([`/api/auth/${s}?code=${c}`]);
        handle.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("a link to a page the router matches navigates there and sends nothing", async () => {
    const { handle, sent } = await openShell("mt.home", () => plain());
    await handle.returnLink(`${SCHEME}:/about`);
    await ticks();
    expect(handle.route().id).toBe("mt.about");
    expect(sent).toEqual([]);
    handle.dispose();
  });

  it("another scheme sends nothing and keeps the page", async () => {
    const { handle, sent } = await openShell("mt.home", () => plain());
    await handle.returnLink("dev.keel.other:/api/auth/callback?code=c");
    await ticks();
    expect(sent).toEqual([]);
    expect(handle.documents()).toEqual([]);
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });

  it("a path neither under the mount nor a page is ignored: nothing sent, page kept", async () => {
    const { handle, sent } = await openShell("mt.home", () => plain());
    await handle.returnLink(`${SCHEME}:/elsewhere/x?code=c`);
    await ticks();
    expect(sent).toEqual([]);
    expect(handle.documents()).toEqual([]);
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });

  it("a link's mount GET answered by a 303 to a page navigates there", async () => {
    const { handle, sent } = await openShell("mt.home", () => redirect(303, "/about"));
    await handle.returnLink(`${SCHEME}:/api/auth/callback?code=c`);
    await ticks();
    expect(sent).toHaveLength(1);
    expect(handle.route().id).toBe("mt.about");
    handle.dispose();
  });
});
