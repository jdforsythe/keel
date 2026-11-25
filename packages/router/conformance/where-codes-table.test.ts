// @vitest-environment happy-dom
// k.routes, Where rules fire "A code is a type error, a throw, a `keel check` diagnostic, or several."
// k.routes, Where rules fire "| E1155 | a contract key | `contract` | contract keys |"
// k.routes, Where rules fire "| E1513 | | `contract` (an API name only) | every case |"
// One test per row of the table, its type-error and thrown columns; the `keel check` column, with each type error under its row's code and never as E1751, is packages/check/conformance/where-codes-check.test.ts.
// Seed 1337 (no random input: one fixture per row). A type error is claimed in ./negative-types.test-d.ts and the call is also run here, untyped.
import { action, loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { bindingOf, codeOf, page, thrown } from "./contract-support.ts";
import { Locale } from "./prefix-fixtures.ts";

const Secret = s.object({ token: s.secret(s.string()) });

describe("k.routes: where each code fires", () => {
  it("E1155: a contract key not prefixed by the module id is a type error, thrown by `contract`", () => {
    expect(codeOf(() => Reflect.apply(contract, undefined, ["a", { "b.home": { path: "/" } }]))).toBe("E1155");
    expect(codeOf(() => Reflect.apply(contract, undefined, ["a", { home: { path: "/" } }]))).toBe("E1155");
  });

  it("E1502: thrown by `contract` for its entries and by `routeTable` across modules and for one module twice", () => {
    expect(codeOf(() => contract("a", { "a.x": { path: "/p" }, "a.y": { path: "/p" } }))).toBe("E1502");
    const one = (m: string) => {
      const c = contract(m, { [`${m}.home`]: { path: "/same" } });
      return manifest(c, bindingOf(c));
    };
    expect(codeOf(() => routeTable(one("a"), one("b")))).toBe("E1502");
    const a = one("a");
    expect(codeOf(() => routeTable(a, a))).toBe("E1502");
  });

  it("E1503: thrown by `contract` for a path param without a params field", () => {
    expect(codeOf(() => contract("a", { "a.show": { path: "/:id" } }))).toBe("E1503");
  });

  it("E1504: thrown by `contract` for a required field in a page `search`", () => {
    expect(codeOf(() => contract("a", { "a.list": { path: "/l", search: s.object({ q: s.string() }) } }))).toBe(
      "E1504",
    );
  });

  it("E1503: thrown by `contract` for a `:param` of an API path without a params field", () => {
    expect(codeOf(() => contract("a", { "a.get": { method: "GET", path: "/api/:id", output: s.object({}) } }))).toBe(
      "E1503",
    );
  });

  it("E1653: thrown by `contract` for a `body` on a GET API entry", () => {
    const entry = { method: "GET", path: "/api/g", body: s.object({}), output: s.object({}) };
    expect(codeOf(() => Reflect.apply(contract, undefined, ["a", { "a.get": entry }]))).toBe("E1653");
  });

  it("E1506: an unknown layout is a type error, and `manifest` throws for it and for a cycle", () => {
    const c = contract("a", { "a.l": { layout: true }, "a.p": { path: "/" } });
    const unknown = () =>
      Reflect.apply(manifest, undefined, [
        c,
        { "a.l": { component: page }, "a.p": { component: page, layout: "a.zzz" } },
      ]);
    expect(codeOf(unknown)).toBe("E1506");
    const cyc = contract("a", { "a.x": { layout: true }, "a.y": { layout: true } });
    expect(
      codeOf(() =>
        manifest(cyc, { "a.x": { component: page, layout: "a.y" }, "a.y": { component: page, layout: "a.x" } }),
      ),
    ).toBe("E1506");
  });

  it("E1509: thrown by `contract` and by `routeTable` over the union", () => {
    expect(
      codeOf(() =>
        contract("x", {
          "x.show": { path: "/:p/i", params: s.object({ p: Locale }) },
          "x.about": { path: "/de-DE/about" },
        }),
      ),
    ).toBe("E1509");
    const a = contract("a", { "a.show": { path: "/:p/i", params: s.object({ p: Locale }) } });
    const b = contract("b", { "b.about": { path: "/de-DE/about" } });
    expect(
      codeOf(() =>
        routeTable(
          Reflect.apply(manifest, undefined, [a, bindingOf(a)]),
          Reflect.apply(manifest, undefined, [b, bindingOf(b)]),
        ),
      ),
    ).toBe("E1509");
  });

  it("E1510: an entry of no kind is a type error thrown by `contract`; a binding member its entry refuses is a type error thrown by `manifest`", () => {
    expect(
      codeOf(() => Reflect.apply(contract, undefined, ["a", { "a.p": { path: "/", output: s.object({}) } }])),
    ).toBe("E1510");
    const c = contract("a", { "a.p": { path: "/" } });
    expect(
      codeOf(() => Reflect.apply(manifest, undefined, [c, { "a.p": { component: page, action: () => ok({}) } }])),
    ).toBe("E1510");
  });

  it("E1113: `contract` throws for an API `output` holding `s.secret`, `loader` for a page `output` holding it", () => {
    expect(codeOf(() => contract("a", { "a.get": { method: "GET", path: "/api/g", output: Secret } }))).toBe("E1113");
    const c = contract("a", { "a.p": { path: "/" } });
    expect(
      codeOf(() => Reflect.apply(loader, undefined, [c, "a.p", { output: Secret }, async () => ok({ token: "x" })])),
    ).toBe("E1113");
  });

  it("E1513: `contract` throws for an API id with a dotted name and for no other case, which `keel check` alone reports", () => {
    expect(codeOf(() => contract("a", { "a.x.y": { method: "GET", path: "/api/xy", output: s.object({}) } }))).toBe(
      "E1513",
    );
    // a module id other than the folder's, a second call and an export name are not a throw (only `keel check` sees a file)
    expect(thrown(() => contract("b", { "b.home": { path: "/" } }))).toBeNull();
    const first = thrown(() => contract("a", { "a.one": { path: "/" } }));
    const second = thrown(() => contract("a", { "a.two": { path: "/two" } }));
    expect(first).toBeNull();
    expect(second).toBeNull();
  });

  it("E1515: a binding missing an entry is a type error, thrown by `manifest`", () => {
    const c = contract("a", { "a.one": { path: "/1" }, "a.two": { path: "/2" } });
    expect(codeOf(() => Reflect.apply(manifest, undefined, [c, { "a.one": { component: page } }]))).toBe("E1515");
  });

  it("`action` throws none of E1503, E1504, E1506, E1509, E1510, E1513, E1515 and E1113 for a valid page action and API write", () => {
    const c = contract("a", {
      "a.p": { path: "/" },
      "a.add": { method: "POST", path: "/api/add", body: s.object({}), output: s.object({ n: s.int() }) },
    });
    const page1 = thrown(() => action(c, "a.p", { input: s.object({}) }, async () => ok(null)));
    const api = thrown(() => action(c, "a.add", {}, async () => ok({ n: 1 })));
    expect(page1).toBeNull();
    expect(api).toBeNull();
  });
});
