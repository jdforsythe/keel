// @vitest-environment happy-dom
// Spec: k.mount-scope (rfc:0156), Test "A router matches no page at or under its own `mount` (a `createRouter` option; a build with `identity.ts` passes its `path`, `renderRoute` the first identity mount the test made (k.guards Client), `createApp` `handle.path`), nor at a path holding a raw `\`, which a URL parser reads as `/`; `%5C` in a path is an ordinary character."
// Spec: k.mount-scope (rfc:0156), Test "At or under is read on the path's segments decoded as the matcher decodes them, joined by `/`, case-sensitive, on the client (`createRouter`, `renderRoute`) and the server alike"
// Spec: k.mount-scope (rfc:0156), Limits "with the mount `/gate`, `/GATE` renders a page"
// Spec: k.mount-scope (rfc:0156), Conformance "With `path` `/gate`, a router matches no page at `/gate`, `/gate/x` or `/%67ate`, nor at `/\x`; `/GATE` is matched by the table as any path; the server answers `/%67ate` 404 without calling `handle`."
// The server half of that clause is asserted in server/conformance/mount-handle-path-params.test.ts.
// This file makes no identity mount and imports no module that does (one file per module graph; the file with a mount is mount-router-scope.test.ts), so its routers have no `mount`: /gate/sign-out is an ordinary page.
// Seed 1337 (fc.assert below). A raw `/a/\x` has no manifest `href`; `raw` below types it as an `Href` through a type predicate.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { Href } from "@keel/router";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

const SEED = 1337;
const view = () => document.createElement("p");
const sc = contract("sc", {
  "sc.root": { path: "/" },
  "sc.one": { path: "/:one", params: s.object({ one: s.string() }) },
  "sc.act": { path: "/:svc/:act", params: s.object({ svc: s.string(), act: s.string() }) },
});
const routes = manifest(sc, {
  "sc.root": { component: view },
  "sc.one": { component: view },
  "sc.act": { component: view },
});
const opened: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of opened.splice(0)) h.dispose();
});
async function open() {
  const h = await renderRoute("sc.root", { routes, ctx: createCtx({ mode: "sim", seed: SEED }) });
  opened.push(h);
  return h;
}
const isHref = (s: string): s is Href => true;
const raw = (s: string): Href => {
  if (!isHref(s)) throw new Error("unreachable");
  return s;
};
const get = (url: string) => ({ method: "GET", url, body: null });

describe("k.mount-scope: a router with no identity mount made in the test file", () => {
  it("navigate to /gate/sign-out and to /gate render the /:svc/:act and /:one pages and record nothing", async () => {
    const h = await open();
    await h.navigate(sc.href("sc.act", { svc: "gate", act: "sign-out" }));
    expect(h.route().id).toBe("sc.act");
    expect(h.documents()).toEqual([]);
    await h.navigate(sc.href("sc.one", { one: "gate" }));
    expect(h.route().id).toBe("sc.one");
    expect(h.documents()).toEqual([]);
  });

  it("navigate to /a/\\x records one GET, keeps the page and adds no history entry: a raw backslash matches no page with or without a mount", async () => {
    const h = await open();
    const before = h.location().entries;
    await h.navigate(raw("/a/\\x"));
    expect(h.documents()).toEqual([get("/a/\\x")]);
    expect(h.route().id).toBe("sc.root");
    expect(h.location().entries).toBe(before);
  });

  it("for generated segments, a path holding a backslash is one GET that keeps the page and the history", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,5}$/), fc.stringMatching(/^[a-z]{0,5}$/), async (a, b) => {
        const h = await open();
        const before = h.location().entries;
        await h.navigate(raw(`/${a}/\\${b}`));
        expect(h.documents()).toEqual([get(`/${a}/\\${b}`)]);
        expect(h.route().id).toBe("sc.root");
        expect(h.location().entries).toBe(before);
        h.dispose();
        opened.pop();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("navigate to /a/%5Cx renders the /:svc/:act page and records nothing: %5C is an ordinary character", async () => {
    const h = await open();
    await h.navigate(raw("/a/%5Cx"));
    expect(h.route().id).toBe("sc.act");
    expect(h.documents()).toEqual([]);
  });
});
