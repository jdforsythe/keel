// @vitest-environment happy-dom
// Spec: k.links, Conformance "In a project with no identity source, `renderRoute(id, { shell: { id: 'dev.keel.linksin' } })`: `returnLink('dev.keel.linksin:/about')`, and with `launch: 'later'` `launch(['dev.keel.linksin:/about'])`, each navigate to `/about`; `returnLink('dev.keel.linksin:/api/auth/callback?code=c')` sends nothing through `net` and leaves the page where it was."
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). Fixture: routes `li.home` (`/`) and `li.about` (`/about`); no `identityMount` is called in this file, so no identity source is registered.
// ASSUMED: a link not admitted sends no `net` request; `launch` is a `renderRoute` option beside `shell` and the handle then has `launch(links)`.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

const ID = "dev.keel.linksin";
const CB = `${ID}:/api/auth/callback?code=c`;
const SEED = 1337;

const li = contract("li", { "li.home": { path: "/" }, "li.about": { path: "/about" } });
const routes = manifest(li, {
  "li.home": { component: () => document.createElement("main") },
  "li.about": { component: () => document.createElement("main") },
});

const opened: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of opened.splice(0)) h.dispose();
});
const ticks = async (): Promise<void> => {
  for (let i = 0; i < 60; i++) await Promise.resolve();
};

async function open(launch?: "later") {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const sent: string[] = [];
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url, "http://localhost");
    sent.push(u.pathname + u.search);
    return new Response(null, { status: 303, headers: { location: "/" } });
  });
  const handle = await renderRoute("li.home", {
    routes,
    ctx,
    shell: { id: ID },
    ...(launch === undefined ? {} : { launch }),
  });
  opened.push(handle);
  return { handle, sent };
}

describe("k.links: a shell with no identity source takes page links only", () => {
  it("returnLink('dev.keel.linksin:/about') navigates to /about", async () => {
    const { handle, sent } = await open();
    await handle.returnLink(`${ID}:/about`);
    await ticks();
    expect(handle.route().id).toBe("li.about");
    expect(sent).toEqual([]);
  });

  it("with launch: 'later', launch(['dev.keel.linksin:/about']) navigates to /about", async () => {
    const { handle, sent } = await open("later");
    await handle.launch([`${ID}:/about`]);
    await ticks();
    expect(handle.route().id).toBe("li.about");
    expect(sent).toEqual([]);
  });

  it("returnLink('dev.keel.linksin:/api/auth/callback?code=c') sends nothing through net and leaves the page where it was", async () => {
    const { handle, sent } = await open();
    await handle.returnLink(CB);
    await ticks();
    expect(handle.route().id).toBe("li.home");
    expect(sent).toEqual([]);
  });

  it("for any mount-looking path and search, the link sends nothing and leaves the page", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{1,8}$/),
        fc.stringMatching(/^[a-z]{1,4}=[a-z0-9]{1,4}$/),
        async (seg, search) => {
          const { handle, sent } = await open();
          await handle.returnLink(`${ID}:/api/auth/${seg}?${search}`);
          await ticks();
          expect(handle.route().id).toBe("li.home");
          expect(sent).toEqual([]);
          handle.dispose();
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });
});
