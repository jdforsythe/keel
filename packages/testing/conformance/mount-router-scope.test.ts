// @vitest-environment happy-dom
// k.mount-scope (rfc:0156), Test "A router matches no page at or under its own `mount` (a `createRouter` option; a build with `identity.ts` passes its `path`, `renderRoute` its `mount` option's `path` (k.testing), `createApp` `handle.path`), nor at a path holding a raw `\`, which a URL parser reads as `/`; `%5C` in a path is an ordinary character."
// k.mount-scope (rfc:0156), Test "At or under is read on the path's segments decoded as the matcher decodes them, joined by `/`, case-sensitive, on the client (`createRouter`, `renderRoute`) and the server alike"
// k.mount-scope (rfc:0156), Limits "with the mount `/gate`, `/GATE` renders a page"
// Spec: k.mount-scope, clause "With `path` `/gate`, a router matches no page at `/gate`, `/gate/x` or `/%67ate`, nor at `/\x`; `/GATE` is matched by the table as any path; the server answers `/%67ate` 404 without calling `handle`."
// k.mount-scope (rfc:0156)
// The server half of that clause is asserted in server/conformance/mount-handle-path-params.test.ts.
// This file makes the identity mounts `/gate` and `/other` and passes one as `mount` to each router: `open()` passes `/gate`, `openOther()` `/other`. The case of a router given no `mount` is mount-router-scope-none.test.ts.
// Seed 1337 (fc.assert below). A raw `/a/\x` has no manifest `href`; `raw` below types it as an `Href` through a type predicate.
import { createCtx } from "@keel/ctx";
import { identityMount, manifest } from "@keel/router";
import type { Href, IdentityMount } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

const gate = identityMount("/gate");
const other = identityMount("/other");

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
async function open(mount: IdentityMount = gate) {
  const h = await renderRoute("sc.root", { routes, ctx: createCtx({ mode: "sim", seed: SEED }), mount });
  opened.push(h);
  return h;
}
const isHref = (s: string): s is Href => true;
const raw = (s: string): Href => {
  if (!isHref(s)) throw new Error("unreachable");
  return s;
};
const get = (url: string) => ({ method: "GET", url, body: null });

describe("k.mount-scope: a router's own mount (the `mount` option of renderRoute)", () => {
  it("with the mount '/gate' passed, navigate to /gate/sign-out and to /gate each record one GET and keep the page", async () => {
    const h = await open();
    await h.navigate(sc.href("sc.act", { svc: "gate", act: "sign-out" }));
    expect(h.documents()).toEqual([get("/gate/sign-out")]);
    expect(h.route().id).toBe("sc.root");
    await h.navigate(sc.href("sc.one", { one: "gate" }));
    expect(h.documents()).toEqual([get("/gate/sign-out"), get("/gate")]);
    expect(h.route().id).toBe("sc.root");
  });

  it("with the mount '/gate' passed, navigate to /gatehouse/x renders the /:svc/:act page and records nothing", async () => {
    const h = await open();
    await h.navigate(sc.href("sc.act", { svc: "gatehouse", act: "x" }));
    expect(h.route().id).toBe("sc.act");
    expect(h.documents()).toEqual([]);
  });

  it("the router's mount is the one passed: with '/gate' and '/other' both made, passing '/gate' makes /other/x render the /:svc/:act page and record nothing, /gate/x one GET; passing '/other' makes it the reverse", async () => {
    const h = await open(gate);
    await h.navigate(sc.href("sc.act", { svc: "other", act: "x" }));
    expect(h.route().id).toBe("sc.act");
    expect(h.documents()).toEqual([]);
    await h.navigate(sc.href("sc.act", { svc: "gate", act: "x" }));
    expect(h.documents()).toEqual([get("/gate/x")]);
    const o = await open(other);
    await o.navigate(sc.href("sc.act", { svc: "gate", act: "x" }));
    expect(o.route().id).toBe("sc.act");
    expect(o.documents()).toEqual([]);
    await o.navigate(sc.href("sc.act", { svc: "other", act: "x" }));
    expect(o.documents()).toEqual([get("/other/x")]);
  });

  it("with the mount '/gate' passed, navigate to /a/\\x records one GET, keeps the page and adds no history entry", async () => {
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

  it("with the mount '/gate' passed, navigate to /%67ate matches no page: one GET, the page kept, no /:one render", async () => {
    const h = await open();
    await h.navigate(raw("/%67ate"));
    expect(h.documents()).toEqual([get("/%67ate")]);
    expect(h.route().id).toBe("sc.root");
  });

  it("with the mount '/gate' passed, navigate to /GATE renders the /:one page and records nothing (the test is case-sensitive)", async () => {
    const h = await open();
    await h.navigate(raw("/GATE"));
    expect(h.route().id).toBe("sc.one");
    expect(h.documents()).toEqual([]);
  });

  it("for generated spellings of /gate with one letter percent-encoded, a navigation matches no page and records one GET", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(0, 1, 2, 3), async (at) => {
        const letter = "gate"[at] ?? "g";
        const spelled = `${"gate".slice(0, at)}%${letter.charCodeAt(0).toString(16)}${"gate".slice(at + 1)}`;
        const h = await open();
        await h.navigate(raw(`/${spelled}/x`));
        expect(h.documents()).toEqual([get(`/${spelled}/x`)]);
        expect(h.route().id).toBe("sc.root");
        h.dispose();
        opened.pop();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("with the mount '/gate' passed, navigate to /a/%5Cx renders the /:svc/:act page and records nothing: %5C is an ordinary character", async () => {
    const h = await open();
    await h.navigate(raw("/a/%5Cx"));
    expect(h.route().id).toBe("sc.act");
    expect(h.documents()).toEqual([]);
  });
});
