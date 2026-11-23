// k.api Paths: the entry that answers a method at a matched path pattern (`entryAt`) and the methods answered there
// (`allowAt`), as @keel/server reads them for a request, a 405's `allow` and a preflight.
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { allowAt, compileRoutes, entryAt, matchUrl } from "../src/internal/index.ts";
import type { Located } from "../src/internal/index.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { routeTable } from "../src/routeTable.ts";

const SEED = 1337;
const Out = s.object({});
const Id = s.object({ id: s.string() });
const In = s.object({});
/** A component for a table that renders no page. */
const view = (): Node => {
  throw new Error("no page renders here");
};

const a = contract("a", {
  "a.list": { method: "GET", path: "/api/items", output: Out },
  "a.add": { method: "POST", path: "/api/items", output: Out },
  "a.put": { method: "PUT", path: "/api/items/:id", params: Id, output: Out },
  "a.patch": { method: "PATCH", path: "/api/items/:id", params: Id, output: Out },
  "a.del": { method: "DELETE", path: "/api/items/:id", params: Id, output: Out },
  "a.only": { method: "POST", path: "/api/only", output: Out },
  "a.page": { path: "/page" },
  "a.form": { path: "/form/:id", params: Id },
});
const b = contract("b", {
  "b.read": { method: "GET", path: "/api/b", output: Out },
  "b.page": { path: "/b" },
});
const aRoutes = manifest(a, {
  "a.list": { loader: loader(a, "a.list", {}, async () => ok({})) },
  "a.add": { action: action(a, "a.add", {}, async () => ok({})) },
  "a.put": { action: action(a, "a.put", {}, async () => ok({})) },
  "a.patch": { action: action(a, "a.patch", {}, async () => ok({})) },
  "a.del": { action: action(a, "a.del", {}, async () => ok({})) },
  "a.only": { action: action(a, "a.only", {}, async () => ok({})) },
  "a.page": { component: view },
  "a.form": {
    component: view,
    PUT: action(a, "a.form", { input: In }, async () => ok(null)),
    DELETE: action(a, "a.form", { input: In }, async () => ok(null)),
  },
});
const bRoutes = manifest(b, {
  "b.read": { loader: loader(b, "b.read", {}, async () => ok({})) },
  "b.page": { component: view },
});
const { located } = compileRoutes(routeTable(aRoutes, bRoutes));

const at = (url: string): Located => {
  const m = matchUrl(located, url);
  if (m.route === null) throw new Error(`no route at ${url}`);
  return m.route;
};
const answers = (url: string, method: string): string | null => entryAt(located, at(url), method)?.id ?? null;

const ORDER = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
const PATHS: readonly (readonly [string, readonly string[], Readonly<Record<string, string>>])[] = [
  ["/api/items", ["GET", "HEAD", "POST"], { GET: "a.list", HEAD: "a.list", POST: "a.add" }],
  ["/api/items/7", ["PUT", "PATCH", "DELETE"], { PUT: "a.put", PATCH: "a.patch", DELETE: "a.del" }],
  ["/api/only", ["POST"], { POST: "a.only" }],
  ["/api/b", ["GET", "HEAD"], { GET: "b.read", HEAD: "b.read" }],
  ["/page", ["GET", "HEAD"], { GET: "a.page", HEAD: "a.page" }],
  ["/b", ["GET", "HEAD"], { GET: "b.page", HEAD: "b.page" }],
  ["/form/7", ["GET", "HEAD", "PUT", "DELETE"], { GET: "a.form", HEAD: "a.form", PUT: "a.form", DELETE: "a.form" }],
];

describe("allowAt", () => {
  it("lists the methods answered at a path, HEAD with GET, in the order GET HEAD POST PUT PATCH DELETE", () => {
    for (const [url, allow] of PATHS) expect(allowAt(located, at(url))).toEqual(allow);
  });

  it("is the same from whichever entry of the pattern matched", () => {
    const byId = (id: string): Located => {
      const r = located.find((x) => x.id === id);
      if (r === undefined) throw new Error(id);
      return r;
    };
    expect(allowAt(located, byId("a.add"))).toEqual(["GET", "HEAD", "POST"]);
    expect(allowAt(located, byId("a.del"))).toEqual(["PUT", "PATCH", "DELETE"]);
  });

  it("a page's methods are its own only: no API entry of the list joins them", () => {
    expect(allowAt(located, at("/page"))).toEqual(["GET", "HEAD"]);
    expect(allowAt([], at("/form/7"))).toEqual(["GET", "HEAD", "PUT", "DELETE"]);
  });

  it("an API entry's methods come from the list it is given", () => {
    expect(allowAt([], at("/api/items"))).toEqual([]);
    expect(allowAt([at("/api/items")], at("/api/items"))).toEqual(["GET", "HEAD"]);
  });
});

describe("entryAt", () => {
  it("answers each allowed method with its entry and every other method with null", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PATHS), fc.constantFrom(...ORDER, "OPTIONS", "TRACE", ""), ([url, , by], m) => {
        expect(answers(url, m)).toBe(by[m] ?? null);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("agrees with allowAt: a method is answered exactly when it is allowed", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PATHS), fc.constantFrom(...ORDER), ([url], m) => {
        expect(answers(url, m) !== null).toBe(allowAt(located, at(url)).includes(m));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("HEAD is answered by the GET entry, and not at a path with no GET", () => {
    expect(answers("/api/items", "HEAD")).toBe("a.list");
    expect(answers("/api/only", "HEAD")).toBeNull();
    expect(answers("/api/items/7", "GET")).toBeNull();
  });

  it("a page answers GET, HEAD and its bound verbs, itself", () => {
    const form = at("/form/7");
    expect(entryAt(located, form, "GET")).toBe(form);
    expect(entryAt(located, form, "PUT")).toBe(form);
    expect(entryAt(located, form, "POST")).toBeNull();
    expect(entryAt(located, form, "PATCH")).toBeNull();
    expect(entryAt([], at("/page"), "HEAD")).toBe(at("/page"));
  });

  it("an API entry is found among the entries of its own module at its own pattern", () => {
    const list = at("/api/items");
    const other = at("/api/b");
    expect(entryAt([other], list, "GET")).toBeNull();
    expect(entryAt([at("/api/only"), list], list, "POST")).toBeNull();
    expect(entryAt([at("/page"), list], list, "GET")).toBe(list);
  });

  it("two modules with one pattern shape keep their own entries", () => {
    const x = contract("x", { "x.r": { method: "GET", path: "/x/:id", params: Id, output: Out } });
    const y = contract("y", { "y.w": { method: "POST", path: "/y/:id", params: Id, output: Out } });
    const t = compileRoutes(
      routeTable(
        manifest(x, { "x.r": { loader: loader(x, "x.r", {}, async () => ok({})) } }),
        manifest(y, { "y.w": { action: action(y, "y.w", {}, async () => ok({})) } }),
      ),
    ).located;
    const xr = matchUrl(t, "/x/1").route;
    const yw = matchUrl(t, "/y/1").route;
    if (xr === null || yw === null) throw new Error("no match");
    expect(allowAt(t, xr)).toEqual(["GET", "HEAD"]);
    expect(allowAt(t, yw)).toEqual(["POST"]);
    expect(entryAt(t, xr, "POST")).toBeNull();
    expect(entryAt(t, yw, "POST")).toBe(yw);
  });
});

describe("a router loaded afresh", () => {
  it("binds every verb and method and lists them in order", async () => {
    vi.resetModules();
    const fresh = {
      ...(await import("../src/internal/index.ts")),
      ...(await import("../src/contract/contract.ts")),
      ...(await import("../src/manifest.ts")),
      ...(await import("../src/action.ts")),
      ...(await import("../src/loader.ts")),
    };
    const c = fresh.contract("f", {
      "f.get": { method: "GET", path: "/api/f", output: Out },
      "f.post": { method: "POST", path: "/api/f", output: Out },
      "f.put": { method: "PUT", path: "/api/f", output: Out },
      "f.patch": { method: "PATCH", path: "/api/f", output: Out },
      "f.del": { method: "DELETE", path: "/api/f", output: Out },
      "f.frame": { layout: true },
      "f.page": { path: "/f" },
    });
    const run = async () => ok({});
    const page = async () => ok(null);
    const routes = fresh.manifest(c, {
      "f.get": { loader: fresh.loader(c, "f.get", {}, run) },
      "f.post": { action: fresh.action(c, "f.post", {}, run) },
      "f.put": { action: fresh.action(c, "f.put", {}, run) },
      "f.patch": { action: fresh.action(c, "f.patch", {}, run) },
      "f.del": { action: fresh.action(c, "f.del", {}, run) },
      "f.frame": { component: view },
      "f.page": {
        component: view,
        layout: "f.frame",
        loader: fresh.loader(c, "f.page", { output: Out }, run),
        POST: fresh.action(c, "f.page", { input: In }, page),
        PUT: fresh.action(c, "f.page", { input: In }, page),
        PATCH: fresh.action(c, "f.page", { input: In }, page),
        DELETE: fresh.action(c, "f.page", { input: In }, page),
      },
    });
    const table = fresh.compileRoutes(routes).located;
    const apiAt = fresh.matchUrl(table, "/api/f").route;
    const pageAt = fresh.matchUrl(table, "/f").route;
    if (apiAt === null || pageAt === null) throw new Error("no match");
    expect(fresh.allowAt(table, apiAt)).toEqual(ORDER);
    expect(fresh.allowAt(table, pageAt)).toEqual(ORDER);
    expect(pageAt.chain.map((l) => l.id)).toEqual(["f.frame", "f.page"]);
    expect(pageAt.def.loader?.id).toBe("f.page");
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(fresh.entryAt(table, apiAt, m)?.def.method).toBe(m);
  });
});
