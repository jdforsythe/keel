// @vitest-environment happy-dom
// k.mount Navigation (rfc:0156): `renderRoute`'s `mount` is its router's own. Under it no page matches, a `:param`
// route included, so `navigate` there records one GET; another harness in the process, with no mount or another,
// routes by its table. A path holding a `\` matches no page. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type Href, identityMount, manifest } from "@keel/router";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";

/** Test-only: a literal root-relative path as an `Href`, for a path no manifest makes. */
const isHref = (u: string): u is Href => u.startsWith("/");
const to = (u: string): Href => {
  if (!isHref(u)) throw new Error(`not an Href: ${u}`);
  return u;
};
const main = () => document.createElement("main");
const routes = manifest({
  "mo.home": { path: "/", component: main },
  "mo.one": { path: "/:one", params: s.object({ one: s.string() }), component: main },
  "mo.two": { path: "/:svc/:act", params: s.object({ svc: s.string(), act: s.string() }), component: main },
});
const get = (url: string) => ({ method: "GET", url, body: null });
const open: { dispose(): void }[] = [];
const start = async (mount?: string) => {
  const h = await renderRoute("mo.home", {
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    ...(mount === undefined ? {} : { mount }),
  });
  open.push(h);
  return h;
};
afterEach(() => {
  for (const h of open.splice(0)) h.dispose();
});

describe("renderRoute with mount", () => {
  it("records one GET for the mount and a path under it, and renders a :param page beside it", async () => {
    const gate = identityMount("/gate");
    const h = await start(gate.path);
    await h.navigate(gate.href("/sign-out"));
    await h.navigate(gate.href());
    expect(h.documents()).toEqual([get("/gate/sign-out"), get("/gate")]);
    expect(h.route().id).toBe("mo.home");
    await h.navigate(to("/gatehouse/x"));
    expect(h.route().id).toBe("mo.two");
    expect(h.documents()).toHaveLength(2);
  });

  it("is per harness: with none or another mount, /gate/sign-out is the :param page", async () => {
    identityMount("/gate");
    const none = await start();
    await none.navigate(to("/gate/sign-out"));
    expect(none.route().id).toBe("mo.two");
    expect(none.documents()).toEqual([]);
    none.dispose();
    const other = await start("/other");
    await other.navigate(to("/gate/sign-out"));
    expect(other.route().id).toBe("mo.two");
    await other.navigate(to("/other/x"));
    expect(other.documents()).toEqual([get("/other/x")]);
  });

  it("a path holding a backslash records one GET and adds no history entry, with a mount or none", async () => {
    for (const mount of ["/gate", undefined]) {
      const h = await start(mount);
      const before = h.location().entries;
      await h.navigate(to("/a/\\x"));
      expect(h.documents()).toEqual([get("/a/\\x")]);
      expect(h.route().id).toBe("mo.home");
      expect(h.location().entries).toBe(before);
      h.dispose();
    }
  });
});
