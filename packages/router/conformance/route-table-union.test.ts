// @vitest-environment happy-dom
// k.routes, Union "`routeTable` returns a frozen `{ kind: 'keel.routeTable', contracts }`, the contracts in argument order; a route table given to it adds its contracts. A manifest is the route table of its one module, `{ kind: 'keel.routeTable', contract, contracts: [contract] }`. A table's bindings are no public member"
// Spec: k.routes, clause "`manifest(c, b)` has `kind` `keel.routeTable`, `contract` `c`, `contracts` `[c]` and no `routes`; `routeTable(m)` has no `contract`."
// Spec: k.routes, clause "`routeTable(a, b)` where `b` has a page on the path pattern of a page of `a`, or of an API entry of `a` at another method, throws E1502 naming both ids; `routeTable(a, a)` throws E1502 naming `a`."
// Spec: k.routes, clause "`routeTable(c)` of a contract does not compile."
// Spec: k.routes, clause "With `a` holding a prefixed route (k.prefix) and `b` a page at `/de-DE/about`, `routeTable(a, b)` throws E1509, and `keel check` with `a` and `b` in one deployable reports one E1509 at `b`'s `path`; in two deployables, none."
// Seed 1337 (fc.assert below). The server half (createApp answering both modules) is packages/server/conformance/route-table-serve.test.ts.
// Compile-time half of each "does not compile" claim: ./negative-types.test-d.ts; the calls here are untyped.
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { matchHref } from "@keel/router/match";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bindingOf, codeOf, page, thrown } from "./contract-support.ts";
import { Locale } from "./prefix-fixtures.ts";

const lower = fc.stringMatching(/^[a-z]{2,6}$/);
const mod = (id: string, path: string) => {
  const c = contract(id, { [`${id}.home`]: { path } });
  return manifest(c, bindingOf(c));
};

describe("k.routes: routeTable", () => {
  it("a route table is a frozen `{ kind: 'keel.routeTable', contracts }` with the contracts in argument order, and a manifest is a table of its one module", () => {
    fc.assert(
      fc.property(fc.uniqueArray(lower, { minLength: 1, maxLength: 4 }), (ids) => {
        const ms = ids.map((id) => mod(id, `/${id}`));
        const t = routeTable(...ms);
        expect(t.kind).toBe("keel.routeTable");
        expect(Object.isFrozen(t)).toBe(true);
        expect(t.contracts.map((c) => c.module)).toEqual(ids);
        const first = ms[0];
        expect(first?.contracts.map((c) => c.module)).toEqual([ids[0]]);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("`routeTable(m)` is frozen with exactly `kind` and `contracts`, no `contract`, `routes`, `href`, `actions` or bindings member; `manifest(c, b)` adds only `contract`", () => {
    fc.assert(
      fc.property(fc.uniqueArray(lower, { minLength: 1, maxLength: 4 }), (ids) => {
        const ms = ids.map((id) => mod(id, `/${id}`));
        const t = routeTable(...ms);
        expect(Object.isFrozen(t)).toBe(true);
        expect(Object.getOwnPropertyNames(t).sort()).toEqual(["contracts", "kind"]);
        expect("contract" in t).toBe(false);
        const first = ms[0];
        expect(first).toBeDefined();
        if (first === undefined) return;
        expect(Object.getOwnPropertyNames(first).sort()).toEqual(["contract", "contracts", "kind"]);
        expect(first.kind).toBe("keel.routeTable");
        expect(first.contracts).toEqual([first.contract]);
        expect(Object.isFrozen(first)).toBe(true);
        for (const k of ["routes", "href", "actions", "bindings", "binding"]) {
          expect(k in t, k).toBe(false);
          expect(k in first, k).toBe(false);
        }
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("`routeTable(routeTable(a), b)` and `routeTable(b, a)` match every href alike; a nested table flattens", () => {
    fc.assert(
      fc.property(lower, lower, (x, y) => {
        fc.pre(x !== y);
        const a = mod(x, `/${x}`);
        const b = mod(y, `/${y}`);
        const flat = routeTable(a, b);
        const nested = routeTable(routeTable(a), b);
        const swapped = routeTable(b, a);
        expect(nested.contracts.map((c) => c.module)).toEqual([x, y]);
        for (const href of [`/${x}`, `/${y}`, "/nowhere"]) {
          expect(matchHref(nested, href)).toEqual(matchHref(flat, href));
          expect(matchHref(swapped, href)).toEqual(matchHref(flat, href));
        }
        expect(matchHref(flat, `/${x}`)?.id).toBe(`${x}.home`);
        expect(matchHref(flat, `/${y}`)?.id).toBe(`${y}.home`);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("`routeTable(a, b)` with a page of `b` on the path pattern of a page of `a` throws E1502 naming both ids", () => {
    fc.assert(
      fc.property(lower, lower, (x, y) => {
        fc.pre(x !== y);
        const e = thrown(() => routeTable(mod(x, "/shared"), mod(y, "/shared")));
        expect(e?.code).toBe("E1502");
        expect(e?.message).toContain(`${x}.home`);
        expect(e?.message).toContain(`${y}.home`);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("`routeTable(a, b)` with a page of `b` on the path of an API entry of `a` at another method throws E1502 naming both ids", () => {
    const a = contract("a", { "a.add": { method: "POST", path: "/items", body: s.object({}), output: s.object({}) } });
    const b = contract("b", { "b.items": { path: "/items" } });
    const e = thrown(() =>
      routeTable(
        Reflect.apply(manifest, undefined, [a, bindingOf(a)]),
        manifest(b, { "b.items": { component: page } }),
      ),
    );
    expect(e?.code).toBe("E1502");
    expect(e?.message).toContain("a.add");
    expect(e?.message).toContain("b.items");
  });

  it("`routeTable(a, a)` throws E1502 naming `a`", () => {
    fc.assert(
      fc.property(lower, (x) => {
        const a = mod(x, `/${x}`);
        const e = thrown(() => routeTable(a, a));
        expect(e?.code).toBe("E1502");
        expect(e?.message).toContain(x);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("`routeTable(c)` of a contract does not compile", () => {
    const c = contract("a", { "a.home": { path: "/" } });
    expect(codeOf(() => Reflect.apply(routeTable, undefined, [c]))).not.toBeNull();
  });

  it("`routeTable(a, b)` with `a` holding a prefixed route and `b` a page at `/de-DE/about` throws E1509", () => {
    const a = contract("a", { "a.show": { path: "/:p/items", params: s.object({ p: Locale }) } });
    const b = contract("b", { "b.about": { path: "/de-DE/about" } });
    const t = () =>
      routeTable(
        Reflect.apply(manifest, undefined, [a, bindingOf(a)]),
        Reflect.apply(manifest, undefined, [b, bindingOf(b)]),
      );
    expect(codeOf(t)).toBe("E1509");
  });
});
