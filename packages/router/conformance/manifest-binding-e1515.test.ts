// @vitest-environment happy-dom
// Spec: k.contract, clause "`manifest(c, binding)` missing an entry of `c`, or with a key `c` lacks, does not compile and throws E1515 naming the id."
// Spec: k.routes, Conformance "`manifest(c, b)` has `kind` `keel.routeTable`, `contract` `c`, `contracts` `[c]` and no `routes`; `routeTable(m)` has no `contract`."
// Spec: RFC 0157 Conformance diff: "with every entry bound it returns a table whose `routes.json` lists every id." Seed 1337.
// Compile-time half of each "does not compile" claim: ../unsafe/conformanceNegativeTypes.ts; the calls here are untyped.
import { manifest, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, bindingOf, page, thrown } from "./contract-support.ts";

const lowerId = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);

describe("k.contract binding", () => {
  const c = contract("a", {
    "a.one": { path: "/one" },
    "a.two": { path: "/two" },
  });

  it("`manifest(c, binding)` missing an entry of `c` does not compile and throws E1515 naming the id", () => {
    const bad = () => Reflect.apply(manifest, undefined, [c, { "a.one": { component: page } }]);
    const e = thrown(bad);
    expect(e?.code).toBe("E1515");
    expect(e?.message).toContain("a.two");
  });

  it("`manifest(c, binding)` with a key `c` lacks does not compile and throws E1515 naming the id", () => {
    const bad = () =>
      Reflect.apply(manifest, undefined, [
        c,
        { "a.one": { component: page }, "a.two": { component: page }, "a.extra": { component: page } },
      ]);
    const e = thrown(bad);
    expect(e?.code).toBe("E1515");
    expect(e?.message).toContain("a.extra");
  });

  it("for any contract, dropping one entry from the binding or adding one key is E1515 naming that id", () => {
    fc.assert(
      fc.property(fc.uniqueArray(lowerId, { minLength: 2, maxLength: 6 }), lowerId, (names, extra) => {
        fc.pre(!names.includes(extra));
        const entries = Object.fromEntries(names.map((n) => [`m.${n}`, { path: `/${n}` }]));
        const mc = Reflect.apply(contract, undefined, ["m", entries]);
        const full = Object.fromEntries(names.map((n) => [`m.${n}`, { component: page }]));
        expect(thrown(() => Reflect.apply(manifest, undefined, [mc, full]))).toBeNull();
        const [dropped, ...rest] = names;
        const missing = Object.fromEntries(rest.map((n) => [`m.${n}`, { component: page }]));
        const m = thrown(() => Reflect.apply(manifest, undefined, [mc, missing]));
        expect(m?.code).toBe("E1515");
        expect(m?.message).toContain(`m.${dropped}`);
        const x = thrown(() =>
          Reflect.apply(manifest, undefined, [mc, { ...full, [`m.${extra}`]: { component: page } }]),
        );
        expect(x?.code).toBe("E1515");
        expect(x?.message).toContain(`m.${extra}`);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("with every entry bound `manifest` returns a table whose `routes.json` lists every id", () => {
    const routes = manifest(c, { "a.one": { component: page }, "a.two": { component: page } });
    expect(Object.keys(routesArtifact(routes)).sort()).toEqual(["a.one", "a.two"]);
  });

  it("`manifest(c, b)` has `kind` `keel.routeTable`, `contract` `c`, `contracts` `[c]` and no `routes`, `href`, `actions` or bindings member", () => {
    const routes = manifest(c, { "a.one": { component: page }, "a.two": { component: page } });
    expect(routes.kind).toBe("keel.routeTable");
    expect(routes.contract).toBe(c);
    expect(routes.contracts).toEqual([c]);
    expect(Object.isFrozen(routes)).toBe(true);
    expect(Object.getOwnPropertyNames(routes).sort()).toEqual(["contract", "contracts", "kind"]);
    for (const k of ["routes", "href", "actions", "bindings", "binding"]) expect(k in routes, k).toBe(false);
  });

  it("a binding for a contract with a layout, a page and both API kinds is clean, and each missing required member is E1510", () => {
    const Out = s.object({ n: s.int() });
    const full = contract("f", {
      "f.shell": { layout: true },
      "f.home": { path: "/" },
      "f.read": { method: "GET", path: "/api/f", output: Out },
      "f.write": { method: "POST", path: "/api/f", body: Out, output: Out },
    });
    const ok = bindingOf(full);
    expect(thrown(() => Reflect.apply(manifest, undefined, [full, ok]))).toBeNull();
    for (const id of Object.keys(ok)) {
      const rest = Object.fromEntries(Object.entries(ok).filter(([k]) => k !== id));
      const e = thrown(() => Reflect.apply(manifest, undefined, [full, { ...rest, [id]: {} }]));
      expect(e?.code, id).toMatch(/^E151[05]$/);
    }
  });

  it("a page's `layout` names a layout id of its contract or of another module's; an unknown id of its own module, a page id or a cycle is E1506", () => {
    const l = contract("l", { "l.shell": { layout: true }, "l.home": { path: "/" } });
    expect(
      thrown(() => manifest(l, { "l.shell": { component: page }, "l.home": { component: page, layout: "l.shell" } })),
    ).toBeNull();
    const e = thrown(() =>
      Reflect.apply(manifest, undefined, [
        l,
        { "l.shell": { component: page }, "l.home": { component: page, layout: "l.ghost" } },
      ]),
    );
    expect(e?.code).toBe("E1506");
    const notLayout = () =>
      Reflect.apply(manifest, undefined, [
        l,
        { "l.shell": { component: page }, "l.home": { component: page, layout: "l.home" } },
      ]);
    expect(thrown(notLayout)?.code).toBe("E1506");
  });
});
