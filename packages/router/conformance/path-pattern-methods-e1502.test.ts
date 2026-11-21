// @vitest-environment happy-dom
// Spec: k.api, Requests "Paths: the router keys its table by path pattern, and a pattern holds one page or one contract's API entries at distinct methods (else E1502, k.routes)."
// Spec: k.api, Conformance "In one contract, two POST entries at `/x`, or a page and an API entry at `/x`, make `contract` throw E1502 naming both ids; a GET and a POST entry at `/x` do not."
// Spec: k.routes, Where rules fire "Across modules any shared path pattern is E1502, methods aside: a path's 405 `allow` lists one module's entries."
// Seed 1337 (fc.assert below).
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bindingOf, page, thrown } from "./contract-support.ts";

const lower = fc.stringMatching(/^[a-z]{2,6}$/);
const Out = s.object({});
const api = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string) =>
  method === "GET" ? { method, path, output: Out } : { method, path, body: Out, output: Out };
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const writes = ["POST", "PUT", "PATCH", "DELETE"] as const;

describe("k.api: one pattern, one page or one contract's API entries at distinct methods", () => {
  it("in one contract, two entries of the same method at `/x` make `contract` throw E1502 naming both ids", () => {
    fc.assert(
      fc.property(fc.constantFrom(...methods), (method) => {
        const e = thrown(() => contract("a", { "a.one": api(method, "/x"), "a.two": api(method, "/x") }));
        expect(e?.code).toBe("E1502");
        expect(e?.message).toContain("a.one");
        expect(e?.message).toContain("a.two");
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  it("in one contract, a page and an API entry at `/x` make `contract` throw E1502 naming both ids", () => {
    fc.assert(
      fc.property(fc.constantFrom(...methods), (method) => {
        const e = thrown(() => contract("a", { "a.home": { path: "/x" }, "a.api": api(method, "/x") }));
        expect(e?.code).toBe("E1502");
        expect(e?.message).toContain("a.home");
        expect(e?.message).toContain("a.api");
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  it("in one contract, a GET and a POST entry at `/x` throw nothing, and any set of distinct methods at one path throws nothing", () => {
    expect(thrown(() => contract("a", { "a.read": api("GET", "/x"), "a.write": api("POST", "/x") }))).toBeNull();
    fc.assert(
      fc.property(fc.subarray(["GET", "POST", "PUT", "PATCH", "DELETE"] as const, { minLength: 1 }), (methods) => {
        const entries = Object.fromEntries(methods.map((m) => [`a.${m.toLowerCase()}`, api(m, "/x")]));
        expect(thrown(() => Reflect.apply(contract, undefined, ["a", entries]))).toBeNull();
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("`routeTable(a, b)` where `a` and `b` each hold an API entry at `/x`, at distinct methods, throws E1502 naming both ids", () => {
    fc.assert(
      fc.property(lower, lower, fc.constantFrom(...writes), (x, y, method) => {
        fc.pre(x !== y);
        const a = contract(x, { [`${x}.read`]: api("GET", "/x") });
        const b = contract(y, { [`${y}.write`]: api(method, "/x") });
        const e = thrown(() => routeTable(manifest(a, bindingOf(a)), manifest(b, bindingOf(b))));
        expect(e?.code).toBe("E1502");
        expect(e?.message).toContain(`${x}.read`);
        expect(e?.message).toContain(`${y}.write`);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("`routeTable(a, b)` with an API entry of each at the same path and method throws E1502 naming both ids", () => {
    const a = contract("a", { "a.add": api("POST", "/x") });
    const b = contract("b", { "b.add": api("POST", "/x") });
    const e = thrown(() =>
      routeTable(
        Reflect.apply(manifest, undefined, [a, bindingOf(a)]),
        Reflect.apply(manifest, undefined, [b, bindingOf(b)]),
      ),
    );
    expect(e?.code).toBe("E1502");
    expect(e?.message).toContain("a.add");
    expect(e?.message).toContain("b.add");
  });

  it("`routeTable(a, b)` with a page of `a` and an API entry of `b` at one path throws E1502 naming both ids", () => {
    const a = contract("a", { "a.items": { path: "/items" } });
    const b = contract("b", { "b.add": api("POST", "/items") });
    const e = thrown(() =>
      routeTable(
        manifest(a, { "a.items": { component: page } }),
        Reflect.apply(manifest, undefined, [b, bindingOf(b)]),
      ),
    );
    expect(e?.code).toBe("E1502");
    expect(e?.message).toContain("a.items");
    expect(e?.message).toContain("b.add");
  });
});
