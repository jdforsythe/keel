// @vitest-environment happy-dom
// Spec: k.mount-scope (rfc:0156), Test "A router matches no page at or under its own `mount` (a `createRouter` and `renderRoute` option; a build with `identity.ts` passes its `path`, `createApp` `handle.path`), nor at a path holding a raw `\`, which a URL parser reads as `/`; `%5C` in a path is an ordinary character."
// Spec: k.mount-scope (rfc:0156), Limits "with the mount `/gate`, `/%67ate` and `/GATE` render a page"
// Conformance: the mount is the router's own; a path under it is a document navigation, a path beside it is a page, `\` matches no page.
// Seed 1337 (fc.assert below). A raw `/a/\x` has no manifest `href`; `raw` below types it as an `Href` through a type predicate.
import { createCtx } from "@keel/ctx";
import { identityMount, manifest } from "@keel/router";
import type { Href } from "@keel/router";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

const SEED = 1337;
const view = () => document.createElement("p");
const routes = manifest({
  "sc.root": { path: "/", component: view },
  "sc.one": { path: "/:one", params: s.object({ one: s.string() }), component: view },
  "sc.act": { path: "/:svc/:act", params: s.object({ svc: s.string(), act: s.string() }), component: view },
});
const opened: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of opened.splice(0)) h.dispose();
});
async function open(mount?: string) {
  const h = await renderRoute("sc.root", {
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    ...(mount === undefined ? {} : { mount }),
  });
  opened.push(h);
  return h;
}
const isHref = (s: string): s is Href => true;
const raw = (s: string): Href => {
  if (!isHref(s)) throw new Error("unreachable");
  return s;
};
const get = (url: string) => ({ method: "GET", url, body: null });

describe("k.mount: a router's own mount", () => {
  it("with mount '/gate', navigate to /gate/sign-out and to /gate each record one GET and keep the page", async () => {
    const h = await open("/gate");
    await h.navigate(routes.href("sc.act", { svc: "gate", act: "sign-out" }));
    expect(h.documents()).toEqual([get("/gate/sign-out")]);
    expect(h.route().id).toBe("sc.root");
    await h.navigate(routes.href("sc.one", { one: "gate" }));
    expect(h.documents()).toEqual([get("/gate/sign-out"), get("/gate")]);
    expect(h.route().id).toBe("sc.root");
  });

  it("with mount '/gate', navigate to /gatehouse/x renders the /:svc/:act page and records nothing", async () => {
    const h = await open("/gate");
    await h.navigate(routes.href("sc.act", { svc: "gatehouse", act: "x" }));
    expect(h.route().id).toBe("sc.act");
    expect(h.documents()).toEqual([]);
  });

  it("the mount is the router's own: after identityMount('/gate'), a harness with no mount and one with '/other' render /:svc/:act at /gate/sign-out, and '/other/x' records one GET in the second", async () => {
    identityMount("/gate");
    const none = await open();
    await none.navigate(routes.href("sc.act", { svc: "gate", act: "sign-out" }));
    expect(none.route().id).toBe("sc.act");
    expect(none.documents()).toEqual([]);
    none.dispose();
    const other = await open("/other");
    await other.navigate(routes.href("sc.act", { svc: "gate", act: "sign-out" }));
    expect(other.route().id).toBe("sc.act");
    expect(other.documents()).toEqual([]);
    other.dispose();
    const back = await open("/other");
    await back.navigate(routes.href("sc.act", { svc: "other", act: "x" }));
    expect(back.documents()).toEqual([get("/other/x")]);
    expect(back.route().id).toBe("sc.root");
  });

  it("with mount '/gate' or none, navigate to /a/\\x records one GET, keeps the page and adds no history entry", async () => {
    for (const mount of ["/gate", undefined]) {
      const h = await open(mount);
      const before = h.location().entries;
      await h.navigate(raw("/a/\\x"));
      expect(h.documents()).toEqual([get("/a/\\x")]);
      expect(h.route().id).toBe("sc.root");
      expect(h.location().entries).toBe(before);
      h.dispose();
    }
  });

  it("for generated segments, a path holding a backslash is one GET that keeps the page and the history", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{1,5}$/),
        fc.stringMatching(/^[a-z]{0,5}$/),
        fc.constantFrom("/gate", undefined),
        async (a, b, mount) => {
          const h = await open(mount);
          const before = h.location().entries;
          await h.navigate(raw(`/${a}/\\${b}`));
          expect(h.documents()).toEqual([get(`/${a}/\\${b}`)]);
          expect(h.route().id).toBe("sc.root");
          expect(h.location().entries).toBe(before);
          h.dispose();
          opened.pop();
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
  it("with mount '/gate', navigate to /%67ate and to /GATE renders the /:one page and records nothing (the test is textual and case-sensitive)", async () => {
    const h = await open("/gate");
    for (const path of ["/%67ate", "/GATE"]) {
      await h.navigate(raw(path));
      expect(h.route().id, path).toBe("sc.one");
      expect(h.documents(), path).toEqual([]);
    }
  });

  it("with mount '/gate' or none, navigate to /a/%5Cx renders the /:svc/:act page and records nothing: %5C is an ordinary character", async () => {
    for (const mount of ["/gate", undefined]) {
      const h = await open(mount);
      await h.navigate(raw("/a/%5Cx"));
      expect(h.route().id).toBe("sc.act");
      expect(h.documents()).toEqual([]);
      h.dispose();
      opened.pop();
    }
  });
});
