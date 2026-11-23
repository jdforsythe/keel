// k.contract paths and k.prefix: the E1503 a malformed path gets, the E1509 a prefix collision gets within one
// contract and over a route table, and the E1502 of a route table's parts, each by its message.
import { ok, s } from "@keel/schema";
import { describe, expect, it, vi } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { compileRoutes } from "../src/internal/compileRoutes.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { routeTable } from "../src/routeTable.ts";

/** A component for a table that renders no page. */
const view = (): Node => {
  throw new Error("no page renders here");
};
const messageOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
};
const declare = (entries: Readonly<Record<string, unknown>>, module = "t"): string | null =>
  messageOf(() => Reflect.apply(contract, undefined, [module, entries]));

const Locale = s.object({ locale: s.enum(["en", "de", "fr"], { pathDefault: "en" }) });
const Region = s.object({ region: s.enum(["eu", "us"], { pathDefault: "eu" }) });
const Id = s.object({ id: s.string() });
const LocaleId = s.object({ locale: s.enum(["en", "de", "fr"], { pathDefault: "en" }), id: s.string() });
const home = { path: "/:locale", params: Locale };
const fix = "; prepend /:locale to its path";

describe("E1503", () => {
  it("names a path that does not start with a slash or ends with one", () => {
    for (const path of ["x", "/x/", "//", "x/"])
      expect(declare({ "t.x": { path } })).toBe(`E1503 t.x: path "${path}" must start with "/" and not end with one`);
    expect(declare({ "t.x": { path: "/" } })).toBeNull();
  });

  it("names an empty segment, a wildcard and a bad param name", () => {
    for (const [path, text] of [
      ["/a//b", ""],
      ["/a/*", "*"],
      ["/a/b*c", "b*c"],
    ] as const)
      expect(declare({ "t.x": { path } })).toBe(
        `E1503 t.x: bad segment "${text}" in "${path}" (no empty segments or wildcards)`,
      );
    for (const text of [":", ":1a", ":a-b", ":a b", ":é", ":a!", ":-a"])
      expect(declare({ "t.x": { path: `/x/${text}` } })).toBe(`E1503 t.x: bad param name "${text}" in "/x/${text}"`);
  });

  it("checks param names the same for a contract loaded afresh", async () => {
    vi.resetModules();
    const fresh = await import("../src/contract/contract.ts");
    const fresh1 = (path: string, params: unknown): string | null =>
      messageOf(() => Reflect.apply(fresh.contract, undefined, ["t", { "t.x": { path, params } }]));
    expect(fresh1("/x/:id", Id)).toBeNull();
    expect(fresh1("/x/:_a1", s.object({ _a1: s.string() }))).toBeNull();
    expect(fresh1("/x/:A", s.object({ A: s.string() }))).toBeNull();
    for (const text of [":1a", ":a-b", ":-a", ":a!"])
      expect(fresh1(`/x/${text}`, undefined)).toBe(`E1503 t.x: bad param name "${text}" in "/x/${text}"`);
  });
});

describe("E1509 within a contract", () => {
  it("takes a prefixed set that does not collide", () => {
    expect(
      declare({
        "t.home": home,
        "t.show": { path: "/:locale/items/:id", params: LocaleId },
        "t.api": { method: "GET", path: "/api/items", output: s.object({}) },
        "t.frame": { layout: true },
      }),
    ).toBeNull();
  });

  it("a pathDefault param that is not the first segment", () => {
    expect(declare({ "t.x": { path: "/x/:locale", params: Locale } })).toBe(
      'E1509 t.x: pathDefault param ":locale" must be the first segment of its path',
    );
    expect(declare({ "t.x": { path: "/x/:id", params: Id } })).toBeNull();
  });

  it("a second prefix param beside the first", () => {
    expect(declare({ "t.home": home, "t.other": { path: "/:region/r", params: Region } })).toBe(
      'E1509 t.other: a second prefix param ":region" beside t.home\'s',
    );
  });

  it("a prefixed route whose second segment is a param", () => {
    expect(declare({ "t.show": { path: "/:locale/:id", params: LocaleId } })).toBe(
      'E1509 t.show: second segment ":id" could read as :locale once its default is left out',
    );
  });

  it("an unprefixed route whose first segment is a value of the prefix, a param, or a prefixed path's rest", () => {
    expect(declare({ "t.home": home, "t.de": { path: "/de/about" } })).toBe(
      `E1509 t.de: first segment "de" is a value of :locale${fix}`,
    );
    expect(declare({ "t.home": home, "t.en": { path: "/en" } })).toBe(
      `E1509 t.en: first segment "en" is a value of :locale${fix}`,
    );
    expect(declare({ "t.home": home, "t.any": { path: "/:id/x", params: Id } })).toBe(
      `E1509 t.any: first segment ":id" can be read as :locale${fix}`,
    );
    expect(
      declare({
        "t.items": { path: "/:locale/items/:id", params: LocaleId },
        "t.bare": { path: "/items/:id", params: Id },
      }),
    ).toBe(`E1509 t.bare: path is t.items's path without its prefix${fix}`);
    expect(declare({ "t.home": home, "t.root": { path: "/" } })).toBe(
      `E1509 t.root: path is t.home's path without its prefix${fix}`,
    );
    expect(
      declare({ "t.items": { path: "/:locale/items", params: Locale }, "t.about": { path: "/about" } }),
    ).toBeNull();
    expect(declare({ "t.items": { path: "/:locale/items", params: Locale }, "t.root": { path: "/" } })).toBeNull();
  });
});

describe("a route table's parts", () => {
  const a = contract("a", { "a.home": { path: "/:locale", params: Locale } });
  const aRoutes = manifest(a, { "a.home": { component: view } });
  const part = (module: string, path: string, params?: typeof Id) => {
    const c = contract(module, { [`${module}.p`]: params === undefined ? { path } : { path, params } });
    return Reflect.apply(manifest, undefined, [c, { [`${module}.p`]: { component: view } }]);
  };

  it("E1509 for a collision across modules, with the contract's message", () => {
    expect(messageOf(() => routeTable(aRoutes, part("b", "/de/x")))).toBe(
      `E1509 b.p: first segment "de" is a value of :locale${fix}`,
    );
    expect(messageOf(() => routeTable(aRoutes, part("b", "/about")))).toBeNull();
  });

  it("E1502 for a module twice, and for a path pattern two modules share", () => {
    expect(messageOf(() => routeTable(aRoutes, aRoutes))).toBe("E1502 a: module a is in the route table twice");
    expect(messageOf(() => routeTable(part("b", "/x/:id", Id), part("c", "/x/:id", Id)))).toBe(
      'E1502 c.p: path pattern "/x/:" is also b.p\'s',
    );
    const again = Reflect.apply(manifest, undefined, [
      contract("a", { "a.other": { path: "/other" } }),
      { "a.other": { component: view } },
    ]);
    expect(messageOf(() => routeTable(aRoutes, again))).toBe("E1502 a: module a is in the route table twice");
  });

  it("E1502 for an API path pattern two modules share, at distinct methods too", () => {
    const Out = s.object({});
    const x = contract("x", { "x.read": { method: "GET", path: "/api/s", output: Out } });
    const y = contract("y", { "y.read": { method: "GET", path: "/api/s", output: Out } });
    const xs = manifest(x, { "x.read": { loader: loader(x, "x.read", {}, async () => ok({})) } });
    const ys = manifest(y, { "y.read": { loader: loader(y, "y.read", {}, async () => ok({})) } });
    expect(messageOf(() => routeTable(xs, ys))).toBe('E1502 y.read: path pattern "/api/s" is also x.read\'s');
  });

  it("a TypeError names the argument that is no manifest or route table, counted from one", () => {
    const b = part("b", "/b");
    for (const [parts, n] of [
      [[{}, aRoutes], 1],
      [[aRoutes, { kind: "keel.routeTable", contracts: [] }], 2],
      [[aRoutes, b, null], 3],
    ] as const) {
      const thrown = (() => {
        try {
          Reflect.apply(routeTable, undefined, [...parts]);
        } catch (e) {
          return e;
        }
        return null;
      })();
      expect(thrown).toBeInstanceOf(TypeError);
      expect(thrown instanceof Error ? thrown.message : "").toBe(
        `routeTable: argument ${n} is no manifest or route table`,
      );
    }
  });

  it("joins the bindings and routes of every part, nested tables flattened", () => {
    const b = part("b", "/b");
    const c = part("c", "/c");
    const joined = routeTable(routeTable(aRoutes, b), c);
    const compiled = compileRoutes(joined);
    expect([...compiled.bindings.keys()]).toEqual(["a.home", "b.p", "c.p"]);
    expect([...compiled.table.keys()]).toEqual(["a.home", "b.p", "c.p"]);
    expect(compiled.located.map((r) => r.id)).toEqual(["a.home", "b.p", "c.p"]);
    expect(joined.contracts.map((k) => k.module)).toEqual(["a", "b", "c"]);
    expect(messageOf(() => routeTable(joined, b))).toBe("E1502 b: module b is in the route table twice");
  });
});

describe("compileRoutes", () => {
  it("a TypeError for a value that is no route table", () => {
    for (const v of [null, {}, { kind: "keel.routeTable", contracts: [] }]) {
      const thrown = (() => {
        try {
          Reflect.apply(compileRoutes, undefined, [v]);
        } catch (e) {
          return e;
        }
        return null;
      })();
      expect(thrown).toBeInstanceOf(TypeError);
      expect(thrown instanceof Error ? thrown.message : "").toBe(
        "not a route table: pass a manifest(...) or routeTable(...) value",
      );
    }
  });

  it("E1506 for a module's table whose layout is another module's, unless open is allowed", () => {
    const p = contract("p", { "p.inner": { layout: true }, "p.page": { path: "/p" }, "p.free": { path: "/free" } });
    const routes = manifest(p, {
      "p.inner": { component: view, layout: "q.frame" },
      "p.page": { component: view, layout: "p.inner" },
      "p.free": { component: view },
    });
    expect(messageOf(() => compileRoutes(routes))).toBe(
      'E1506 p.inner: layout "q.frame" names no entry of the route table',
    );
    expect(messageOf(() => compileRoutes(routes, "refuse"))).toBe(
      'E1506 p.inner: layout "q.frame" names no entry of the route table',
    );
    const open = compileRoutes(routes, "allow");
    expect(open.open).toBe('p.inner: layout "q.frame" names no entry of the route table');
    expect(open.located.map((r) => r.id)).toEqual(["p.free"]);
    const whole = compileRoutes(
      manifest(contract("w", { "w.page": { path: "/w" } }), { "w.page": { component: view } }),
    );
    expect(whole.open).toBeUndefined();
    expect(Object.keys(whole)).not.toContain("open");
  });

  it("the open message names the page's own binding when its layout is the foreign one", () => {
    const p = contract("p", { "p.page": { path: "/p" } });
    const routes = manifest(p, { "p.page": { component: view, layout: "q.frame" } });
    expect(compileRoutes(routes, "allow").open).toBe('p.page: layout "q.frame" names no entry of the route table');
    const two = contract("p", { "p.mid": { layout: true }, "p.top": { layout: true }, "p.page": { path: "/p" } });
    const chain = manifest(two, {
      "p.page": { component: view, layout: "p.mid" },
      "p.mid": { component: view, layout: "p.top" },
      "p.top": { component: view, layout: "q.frame" },
    });
    expect(compileRoutes(chain, "allow").open).toBe('p.top: layout "q.frame" names no entry of the route table');
  });
});
