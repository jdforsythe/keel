// @vitest-environment happy-dom
// Examples (k.api): E1510 for each arm, E1508 for a redirect-less guard on a page or layout, the href refusal,
// matchHref and the client router matching no API route, `routes.json` marking API routes.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { guard } from "../src/guard.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { matchHref } from "../src/match/matchHref.ts";
import { routesArtifact } from "../src/routesArtifact.ts";
import type { ApiGuard } from "../src/types/ApiGuard.ts";
import type { Guard } from "../src/types/Guard.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";
import { memoryHistory } from "./memoryHistory.ts";
import { to } from "./to.ts";

const SEED = 1337;
const view = (): Node => document.createElement("div");
const read = loader({ output: s.object({}) }, async () => ok({}));
const write = action({ input: s.object({}), output: s.object({}) }, async () => ok({}));
const Denied = s.error("keel.denied", s.object({}));
const bare = guard({}, async () => err(Denied.make({})));
const toLogin = guard({ redirect: "t.login" }, async () => err(Denied.make({})));

const failure = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
};
const build = (routes: Readonly<Record<string, unknown>>): unknown =>
  failure(() => Reflect.apply(manifest, undefined, [routes]));

describe("E1510", () => {
  it("an API entry with any refused member, or without path, throws E1510 naming the id", () => {
    for (const refused of [{ component: view }, { errorElement: view }, { title: () => "t" }, { layout: "t.s" }])
      expect(build({ "t.a": { api: true, path: "/a", loader: read, ...refused } })).toBe(
        "E1510 t.a: needs component, or api: true with a path and no view",
      );
    expect(build({ "t.a": { api: true, loader: read } })).toMatch(/^E1510 t\.a: /);
  });

  it("an entry with neither component nor api: true throws E1510; a refused member set to undefined still counts", () => {
    fc.assert(
      fc.property(fc.constantFrom("/a", "/b/c"), fc.boolean(), (path, withLoader) => {
        const entry = withLoader ? { path, loader: read } : { path };
        expect(build({ "t.n": entry })).toBe("E1510 t.n: needs component, or api: true with a path and no view");
      }),
      { seed: SEED, numRuns: 10 },
    );
    expect(build({ "t.a": { api: true, path: "/a", loader: read, title: undefined } })).toMatch(/^E1510/);
  });

  it("an API route with neither loader nor action throws on href, matchHref and createRouter, not before", () => {
    const m = manifest({ "t.none": { api: true, path: "/none" }, "t.home": { path: "/", component: view } });
    expect(failure(() => m.href("t.home"))).toBe("E1510 t.none: an API route needs a loader or an action");
    expect(failure(() => matchHref(m, m.href("t.home")))).toMatch(/^E1510/);
    const ctx = createCtx({ mode: "sim", seed: SEED });
    expect(failure(() => createRouter(m, { ctx, history: memoryHistory("/") }))).toMatch(/^E1510/);
  });

  it("an action alone or a loader alone completes an API route", () => {
    const m = manifest({ "t.w": { api: true, path: "/w" }, "t.home": { path: "/", component: view } });
    m.actions({ "t.w": { POST: write } });
    expect(m.href("t.home")).toBe("/");
    const r = manifest({ "t.r": { api: true, path: "/r", loader: read }, "t.home": { path: "/", component: view } });
    expect(r.href("t.home")).toBe("/");
  });
});

describe("E1508 for a guard without redirect", () => {
  it("is refused on a page and a layout by type and by manifest(); accepted on an API route", () => {
    type Accepts<E> = [E] extends [RouteDef] ? true : false;
    expectTypeOf<
      Accepts<{ readonly path: "/p"; component(): Node; readonly guard: typeof bare }>
    >().toEqualTypeOf<false>();
    expectTypeOf<Accepts<{ component(): Node; readonly guard: typeof bare }>>().toEqualTypeOf<false>();
    expectTypeOf<
      Accepts<{ readonly path: "/p"; component(): Node; readonly guard: typeof toLogin }>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      Accepts<{ readonly api: true; readonly path: "/a"; readonly guard: typeof bare }>
    >().toEqualTypeOf<true>();
    expect(build({ "t.p": { path: "/p", component: view, guard: bare } })).toBe("E1508 t.p: guard without redirect");
    expect(build({ "t.l": { component: view, guard: bare } })).toMatch(/^E1508 t\.l: /);
    const ok1 = manifest({ "t.a": { api: true, path: "/a", loader: read, guard: bare } });
    const ok2 = manifest({
      "t.login": { path: "/login", component: view },
      "t.p": { path: "/p", component: view, guard: toLogin },
      "t.a": { api: true, path: "/a", loader: read, guard: toLogin },
    });
    expect(ok1.kind).toBe("keel.manifest");
    expect(ok2.href("t.p")).toBe("/p");
    expect(Object.hasOwn(bare, "redirect")).toBe(false);
    expect(toLogin.redirect).toBe("t.login");
  });
});

describe("calling an API route", () => {
  const routes = manifest({
    "t.api": { api: true, path: "/api/x", loader: read, guard: bare },
    "t.home": { path: "/", component: view },
    "t.any": { path: "/api/:id", params: s.object({ id: s.string() }), component: view },
  });

  it("href refuses an API id at runtime (E1501); matchHref skips the API path for a page beside it", () => {
    expect(failure(() => Reflect.apply(routes.href, undefined, ["t.api"]))).toBe(
      'E1501 href("t.api"): no declared page has this id',
    );
    expect(matchHref(routes, routes.href("t.home"))?.id).toBe("t.home");
    expect(matchHref(routes, routes.href("t.any", { id: "x" }))?.id).toBe("t.any");
  });

  it("routes.json marks only API routes with api: true; a redirect-less guard is null", () => {
    const art = routesArtifact(routes);
    expect(art["t.api"]).toMatchObject({ api: true, guard: null, layout: null, path: "/api/x" });
    expect(art["t.home"] !== undefined && Object.hasOwn(art["t.home"], "api")).toBe(false);
  });

  it("the client router matches no API route: a link to one is not intercepted, navigate loads a document", async () => {
    const only = manifest({
      "t.api": { api: true, path: "/api/x", loader: read },
      "t.home": { path: "/", component: view },
    });
    const history = memoryHistory("/");
    const left: string[] = [];
    const router = createRouterWith(only, {
      ctx: createCtx({ mode: "sim", seed: SEED }),
      history,
      leave: (url) => void left.push(url),
    });
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = mount(router.App, host);
    const a = document.createElement("a");
    a.setAttribute("href", "/api/x");
    host.append(a);
    let prevented: boolean | null = null;
    const last = (ev: Event): void => {
      prevented = ev.defaultPrevented;
      ev.preventDefault();
    };
    document.addEventListener("click", last, { once: true });
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    expect(prevented).toBe(false);
    expect(history.entries).toEqual(["/"]);
    await router.navigate(to("/api/x"));
    expect(left).toEqual(["/api/x"]);
    expect(router.route.get().id).toBe("t.home");
    expect(history.entries).toEqual(["/"]);
    unmount();
    router.dispose();
    host.remove();
  });
});

describe("api other than true, and a guard redirect naming an API route", () => {
  it("an entry whose api is anything but true throws E1510 from manifest()", () => {
    fc.assert(
      fc.property(fc.constantFrom<unknown>(1, "true", false, null, undefined, {}), fc.boolean(), (api, page) => {
        const entry = page ? { api, path: "/a", component: view } : { api, path: "/a", loader: read };
        expect(build({ "t.a": entry })).toBe("E1510 t.a: needs component, or api: true with a path and no view");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("a guard redirect to an API route throws E1508 on the first read of the table, not before", () => {
    const toApi = guard({ redirect: "t.api" }, async () => err(Denied.make({})));
    const m = manifest({
      "t.api": { api: true, path: "/api/x", loader: read },
      "t.p": { path: "/p", component: view, guard: toApi },
    });
    expect(m.kind).toBe("keel.manifest");
    expect(failure(() => m.href("t.p"))).toBe("E1508 t.p: guard redirect to an API route");
    const fresh = manifest({
      "t.api": { api: true, path: "/api/x", loader: read },
      "t.l": { component: view, guard: toApi },
    });
    const ctx = createCtx({ mode: "sim", seed: SEED });
    expect(failure(() => createRouter(fresh, { ctx, history: memoryHistory("/") }))).toMatch(/^E1508 t\.l: /);
  });

  it("the exported Guard fits pages, layouts and API routes; ApiGuard fits API routes only", () => {
    type Accepts<E> = [E] extends [RouteDef] ? true : false;
    const g: Guard = guard({ redirect: "t.login" }, async () => ok(null));
    const a: ApiGuard = guard({}, async () => ok(null));
    expectTypeOf(g).toEqualTypeOf<Guard>();
    expectTypeOf(a).toEqualTypeOf<ApiGuard>();
    expectTypeOf<Accepts<{ readonly path: "/p"; component(): Node; readonly guard: Guard }>>().toEqualTypeOf<true>();
    expectTypeOf<Accepts<{ component(): Node; readonly guard: Guard }>>().toEqualTypeOf<true>();
    expectTypeOf<Accepts<{ readonly api: true; readonly path: "/a"; readonly guard: Guard }>>().toEqualTypeOf<true>();
    expectTypeOf<
      Accepts<{ readonly api: true; readonly path: "/a"; readonly guard: ApiGuard }>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      Accepts<{ readonly path: "/p"; component(): Node; readonly guard: ApiGuard }>
    >().toEqualTypeOf<false>();
    expect(manifest({ "t.login": { path: "/login", component: view, guard: g } }).href("t.login")).toBe("/login");
  });
});
