// @vitest-environment happy-dom
// Spec: k.return, clause "A `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a` records that URL as one GET in `documents()` and keeps the page; answered 302 to `/api/auth/x`, a second `net` GET; a sixth redirect in a row under the mount sends nothing."
// Seed 1337 (fc.assert below). Reuses the k.mount home page (mount-pages.ts): `mt.home.github` is a `Link` to `mount.href('/login/github', { next: 'a b' })`, so the first request is `/api/auth/login/github?next=a%20b`.
// Reading of "a sixth redirect in a row": the answer to the link's own GET is the first redirect; five followed redirects make six `net` GETs, and the sixth redirect is not followed (builder: see report).
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, closeAll, openShell, plain, redirect, ticks } from "./return-support.ts";

afterEach(closeAll);

const START = "/api/auth/login/github?next=a%20b";
const get = (url: string) => ({ method: "GET", url, body: null });

describe("k.return: a Link to the mount in a shell is a mount request GET", () => {
  it("a 302 to another origin records that URL as one GET in documents(), keeps the page, and sends no second net request", async () => {
    const { handle, sent } = await openShell("mt.home", (_s, i) =>
      i === 0 ? redirect(302, "https://provider.example/a") : plain(),
    );
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    expect(sent.map((r) => [r.method, r.url])).toEqual([["GET", START]]);
    expect(sent[0]?.headers["x-keel"]).toBe("1");
    expect(sent[0]?.redirect).toBe("manual");
    expect(handle.documents()).toEqual([get("https://provider.example/a")]);
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });

  it("a 302 to /api/auth/x is a second net GET of /api/auth/x", async () => {
    const { handle, sent } = await openShell("mt.home", (_s, i) => (i === 0 ? redirect(302, "/api/auth/x") : plain()));
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    expect(sent.map((r) => [r.method, r.url])).toEqual([
      ["GET", START],
      ["GET", "/api/auth/x"],
    ]);
    expect(sent[1]?.headers["x-keel"]).toBe("1");
    expect(sent[1]?.redirect).toBe("manual");
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });

  it("for n consecutive redirects under the mount, net sees n + 1 GETs up to five followed redirects and a sixth redirect sends nothing", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 9 }), async (n) => {
        closeAll();
        const { handle, sent } = await openShell("mt.home", (_s, i) =>
          i < n ? redirect(302, `/api/auth/hop${i}`) : plain(),
        );
        await handle.fire("mt.home.github", { type: "click" });
        await ticks();
        expect(sent).toHaveLength(n <= 5 ? n + 1 : 6);
        expect(handle.route().id).toBe("mt.home");
        handle.dispose();
      }),
      { seed: SEED, numRuns: 9 },
    );
  });

  it("a redirect that never ends stops at six net GETs and sends nothing after", async () => {
    const { handle, sent } = await openShell("mt.home", (_s, i) => redirect(302, `/api/auth/hop${i}`));
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    expect(sent).toHaveLength(6);
    await ticks();
    expect(sent).toHaveLength(6);
    handle.dispose();
  });

  it("a Link answered by a 303 to a page the router matches navigates client-side and records no document", async () => {
    const { handle } = await openShell("mt.home", (_s, i) => (i === 0 ? redirect(303, "/about") : plain()));
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    expect(handle.route().id).toBe("mt.about");
    expect(handle.documents()).toEqual([]);
    handle.dispose();
  });
});
