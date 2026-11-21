// @vitest-environment happy-dom
// Examples (k.api): E1510 for each arm, E1508 for a redirect-less guard on a page or layout, the href refusal,
// matchHref and the client router matching no API entry, `routes.json` marking API entries.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { createRouter } from "../src/createRouter.ts";
import { guard } from "../src/guard.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { matchHref } from "../src/match/matchHref.ts";
import { routesArtifact } from "../src/routesArtifact.ts";
import { memoryHistory } from "./memoryHistory.ts";
import { to } from "./to.ts";

const SEED = 1337;
const view = (): Node => document.createElement("div");
const Out = s.object({});
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
/** `contract` over entries its types refuse. */
const declare = (entries: Readonly<Record<string, unknown>>): unknown =>
  failure(() => Reflect.apply(contract, undefined, ["t", entries]));

const api = contract("t", {
  "t.read": { method: "GET", path: "/api/x", output: Out },
  "t.write": { method: "POST", path: "/api/x", output: Out },
  "t.login": { path: "/login" },
  "t.home": { path: "/" },
  "t.any": { path: "/api/:id", params: s.object({ id: s.string() }) },
});
const read = loader(api, "t.read", {}, async () => ok({}));
const write = action(api, "t.write", {}, async () => ok({}));
const full = (extra: { read?: object; home?: object } = {}) =>
  manifest(api, {
    "t.read": { loader: read, ...extra.read },
    "t.write": { action: write },
    "t.login": { component: view },
    "t.home": { component: view, ...extra.home },
    "t.any": { component: view },
  });

describe("E1510", () => {
  it("an API entry with any refused member, or without path or output, throws E1510 naming the id", () => {
    for (const refused of [{ component: view }, { errorElement: view }, { title: "t" }, { layout: "t.s" }])
      expect(declare({ "t.a": { method: "GET", path: "/a", output: Out, ...refused } })).toMatch(/^E1510 t\.a: /);
    expect(declare({ "t.a": { method: "GET", output: Out } })).toMatch(/^E1510 t\.a: /);
    expect(declare({ "t.a": { method: "GET", path: "/a" } })).toMatch(/^E1510 t\.a: /);
  });

  it("an entry of no kind, or a page with a refused member, throws E1510", () => {
    fc.assert(
      fc.property(fc.constantFrom("/a", "/b/c"), fc.boolean(), (path, withMember) => {
        const entry = withMember ? { path, loader: read } : { output: Out };
        expect(declare({ "t.n": entry })).toMatch(/^E1510 t\.n: /);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("an API entry bound with a view member, or the wrong handler member, throws E1510 from manifest", () => {
    const bad = (b: Record<string, unknown>) => failure(() => Reflect.apply(manifest, undefined, [api, b]));
    const rest = { "t.login": { component: view }, "t.home": { component: view }, "t.any": { component: view } };
    expect(bad({ ...rest, "t.read": { loader: read, component: view }, "t.write": { action: write } })).toMatch(
      /^E1510 t\.read: /,
    );
    expect(bad({ ...rest, "t.read": { action: write }, "t.write": { action: write } })).toMatch(/^E1510 t\.read: /);
    expect(bad({ ...rest, "t.read": { loader: read }, "t.write": { loader: read } })).toMatch(/^E1510 t\.write: /);
  });

  it("an API entry with neither loader nor action is E1515 from manifest, naming the id", () => {
    const bad = (b: Record<string, unknown>) => failure(() => Reflect.apply(manifest, undefined, [api, b]));
    const rest = { "t.login": { component: view }, "t.home": { component: view }, "t.any": { component: view } };
    expect(bad({ ...rest, "t.read": {}, "t.write": { action: write } })).toBe("E1515 t.read: binds no loader");
    expect(bad({ ...rest, "t.read": { loader: read }, "t.write": {} })).toBe("E1515 t.write: binds no action");
  });

  it("a loader alone completes an API GET entry and an action alone an API write entry", () => {
    expect(full().contract.href("t.home")).toBe("/");
  });
});

describe("E1508 for a guard without redirect", () => {
  it("is refused on a page and a layout by type and by manifest(); accepted on an API entry", () => {
    const c = contract("t", {
      "t.l": { layout: true },
      "t.p": { path: "/p" },
      "t.a": { method: "GET", path: "/a", output: Out },
    });
    const get = loader(c, "t.a", {}, async () => ok({}));
    expect(
      failure(() =>
        // The type errors are in unsafe/negativeTypes.ts; called untyped here.
        Reflect.apply(manifest, undefined, [
          c,
          { "t.l": { component: view }, "t.p": { component: view, guard: bare }, "t.a": { loader: get } },
        ]),
      ),
    ).toBe("E1508 t.p: guard without redirect");
    expect(
      failure(() =>
        Reflect.apply(manifest, undefined, [
          c,
          { "t.l": { component: view, guard: bare }, "t.p": { component: view }, "t.a": { loader: get } },
        ]),
      ),
    ).toMatch(/^E1508 t\.l: /);
    const ok1 = manifest(c, {
      "t.l": { component: view },
      "t.p": { component: view },
      "t.a": { loader: get, guard: bare },
    });
    const ok2 = manifest(c, {
      "t.l": { component: view },
      "t.p": { component: view, guard: toLogin },
      "t.a": { loader: get, guard: toLogin },
    });
    expect(ok1.kind).toBe("keel.routeTable");
    expect(ok2.contract.href("t.p")).toBe("/p");
    expect(Object.hasOwn(bare, "redirect")).toBe(false);
    expect(toLogin.redirect).toBe("t.login");
  });

  it("a guard redirect to an API entry throws E1508 from manifest", () => {
    const toApi = guard({ redirect: "t.read" }, async () => err(Denied.make({})));
    expect(failure(() => full({ home: { guard: toApi } }))).toBe("E1508 t.home: guard redirect to an API entry");
  });
});

describe("calling an API entry", () => {
  const routes = full({ read: { guard: bare } });

  it("href refuses an API id (type and E1501); matchHref skips the API path for a page beside it", () => {
    // The type error is in unsafe/negativeTypes.ts; called untyped here.
    expect(failure(() => Reflect.apply(api.href, api, ["t.read"]))).toBe(
      'E1501 href("t.read"): no page of this contract has this id',
    );
    expect(matchHref(routes, api.href("t.home"))?.id).toBe("t.home");
    expect(matchHref(routes, api.href("t.any", { id: "x" }))?.id).toBe("t.any");
    expect(matchHref(routes, "/api/x")?.id).toBe("t.any");
  });

  it("routes.json marks API entries with their method; a redirect-less guard is null", () => {
    const art = routesArtifact(routes);
    expect(art["t.read"]).toMatchObject({ api: true, method: "GET", guard: null, layout: null, path: "/api/x" });
    expect(art["t.write"]).toMatchObject({ api: true, method: "POST", actions: ["POST"] });
    expect(art["t.home"] !== undefined && Object.hasOwn(art["t.home"], "api")).toBe(false);
  });

  it("the client router matches no API entry: a link to one is not intercepted, navigate loads a document", async () => {
    const c = contract("t", { "t.api": { method: "GET", path: "/api/x", output: Out }, "t.home": { path: "/" } });
    const only = manifest(c, {
      "t.api": { loader: loader(c, "t.api", {}, async () => ok({})) },
      "t.home": { component: view },
    });
    const history = memoryHistory("/");
    const left: string[] = [];
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const router = createRouterWith(only, {
      ctx,
      history,
      leave: (url) => void left.push(url),
    });
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = mount(router.App, host, { ctx });
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

  it("createRouter takes a table with API entries", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const router = createRouter(routes, { ctx, history: memoryHistory("/") });
    expect(router.route.get().id).toBe("t.home");
    router.dispose();
  });
});
