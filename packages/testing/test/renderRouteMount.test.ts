// @vitest-environment happy-dom
// k.mount Navigation: a `renderRoute` router's mount is the `mount` option the test passes (k.guards Client,
// k.mount-scope). Under it no page matches, a `:param` route included, so `navigate` there records one GET; without
// `mount` the harness has none. A path holding a `\` matches no page. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type Href, identityMount, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";

/** Test-only: a literal root-relative path as an `Href`, for a path no manifest makes. */
const isHref = (u: string): u is Href => u.startsWith("/");
const to = (u: string): Href => {
  if (!isHref(u)) throw new Error(`not an Href: ${u}`);
  return u;
};
const gate = identityMount("/gate");
const main = () => document.createElement("main");
const c = contract("mo", {
  "mo.home": { path: "/" },
  "mo.one": { path: "/:one", params: s.object({ one: s.string() }) },
  "mo.two": { path: "/:svc/:act", params: s.object({ svc: s.string(), act: s.string() }) },
});
const routes = manifest(c, {
  "mo.home": { component: main },
  "mo.one": { component: main },
  "mo.two": { component: main },
});
const get = (url: string) => ({ method: "GET", url, body: null });
const open: { dispose(): void }[] = [];
const start = async (mount: typeof gate | null = gate) => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const h = await renderRoute("mo.home", mount === null ? { routes, ctx } : { routes, ctx, mount });
  open.push(h);
  return h;
};
afterEach(() => {
  for (const h of open.splice(0)) h.dispose();
});

describe("renderRoute under the identity mount the test names", () => {
  it("records one GET for the mount and a path under it, and renders a :param page beside it", async () => {
    const h = await start();
    await h.navigate(gate.href("/sign-out"));
    await h.navigate(gate.href());
    expect(h.documents()).toEqual([get("/gate/sign-out"), get("/gate")]);
    expect(h.route().id).toBe("mo.home");
    await h.navigate(to("/gatehouse/x"));
    expect(h.route().id).toBe("mo.two");
    expect(h.documents()).toHaveLength(2);
  });

  it("a second identityMount call does not throw, and the router's mount is the one the test names", async () => {
    identityMount("/other");
    const h = await start();
    await h.navigate(to("/other/x"));
    expect(h.route().id).toBe("mo.two");
    await h.navigate(to("/gate/x"));
    expect(h.documents()).toEqual([get("/gate/x")]);
  });

  it("without mount no path is the mount's: a path under the gate renders its page", async () => {
    const h = await start(null);
    await h.navigate(to("/gate/x"));
    expect(h.route().id).toBe("mo.two");
    expect(h.documents()).toEqual([]);
  });

  it("a path holding a backslash records one GET and adds no history entry", async () => {
    const h = await start();
    const before = h.location().entries;
    await h.navigate(to("/a/\\x"));
    expect(h.documents()).toEqual([get("/a/\\x")]);
    expect(h.route().id).toBe("mo.home");
    expect(h.location().entries).toBe(before);
  });
});
