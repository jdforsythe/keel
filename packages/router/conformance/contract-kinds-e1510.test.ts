// @vitest-environment happy-dom
// Spec: k.contract, clause "An entry with `method` and `search`, with `layout: true` and `path`, or a page with `output` does not compile, and `contract` throws E1510."
// Spec: k.contract Rules, E1510 "an entry of no kind or with a member its kind refuses ... a type error, thrown by `contract` or `manifest`". Seed 1337.
// Compile-time half of each "does not compile" claim: ./negative-types.test-d.ts; the calls here are untyped.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, bindingOf, page, thrown } from "./contract-support.ts";

const Out = s.object({ n: s.int() });
const Search = s.object({ q: s.string().optional() });
const make = (entry: unknown): unknown =>
  thrown(() => Reflect.apply(contract, undefined, ["a", { "a.x": entry }]))?.code ?? null;

describe("k.contract kinds", () => {
  it("An entry with `method` and `search` does not compile, and `contract` throws E1510", () => {
    const bad = () =>
      Reflect.apply(contract, undefined, ["a", { "a.x": { method: "GET", path: "/x", output: Out, search: Search } }]);
    expect(thrown(bad)?.code).toBe("E1510");
  });

  it("An entry with `layout: true` and `path` does not compile, and `contract` throws E1510", () => {
    const bad = () => Reflect.apply(contract, undefined, ["a", { "a.x": { layout: true, path: "/x" } }]);
    expect(thrown(bad)?.code).toBe("E1510");
  });

  it("A page entry with `output` does not compile, and `contract` throws E1510", () => {
    const bad = () => Reflect.apply(contract, undefined, ["a", { "a.x": { path: "/x", output: Out } }]);
    expect(thrown(bad)?.code).toBe("E1510");
  });

  it("A page refuses each of method, layout, query, body, output, errors, events and timeout; an API entry refuses search and layout; a layout refuses every other member", () => {
    const refusedByPage: Record<string, unknown>[] = [
      { method: "GET" },
      { layout: true },
      { query: Search },
      { body: Out },
      { output: Out },
      { errors: { 404: Out } },
      { events: true },
      { timeout: 10 },
    ];
    for (const extra of refusedByPage) expect(make({ path: "/x", ...extra })).toBe("E1510");
    for (const extra of [{ search: Search }, { layout: true }]) {
      expect(make({ method: "GET", path: "/x", output: Out, ...extra })).toBe("E1510");
    }
    fc.assert(
      fc.property(
        fc.constantFrom("path", "params", "search", "method", "output", "body", "query", "errors", "title"),
        (member) => {
          expect(make({ layout: true, [member]: member === "path" ? "/x" : Out })).toBe("E1510");
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("An entry of no kind is E1510 (no `path`, no `layout`, no `method`; an API entry without `output` or `path`)", () => {
    for (const entry of [
      {},
      { params: Search },
      { search: Search },
      { method: "GET", path: "/x" },
      { method: "GET", output: Out },
    ]) {
      expect(make(entry)).toBe("E1510");
    }
  });

  it("`method` is GET, POST, PUT, PATCH or DELETE; any other value is no API entry", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      expect(make({ method, path: "/x", output: Out })).toBe(null);
    }
    for (const method of ["get", "HEAD", "OPTIONS", "FETCH"]) {
      expect(make({ method, path: "/x", output: Out })).not.toBe(null);
    }
  });

  it("each kind in its minimal form, and with every optional member, is clean", () => {
    expect(make({ path: "/x" })).toBe(null);
    expect(make({ path: "/x/:id", params: s.object({ id: s.string() }), search: Search })).toBe(null);
    expect(make({ layout: true })).toBe(null);
    expect(
      make({
        method: "POST",
        path: "/x/:id",
        params: s.object({ id: s.string() }),
        query: Search,
        body: Out,
        output: Out,
        errors: { 422: Out },
        timeout: 100,
      }),
    ).toBe(null);
    expect(make({ method: "GET", path: "/x", output: Out, events: true })).toBe(null);
  });

  it("E1510 a `title`, a verb or an `action` on a layout; a `component` on an API entry; an `action` on a page", () => {
    const c = contract("a", {
      "a.shell": { layout: true },
      "a.home": { path: "/" },
      "a.list": { method: "GET", path: "/api/a", output: Out },
      "a.add": { method: "POST", path: "/api/a", body: Out, output: Out },
    });
    const bound = (id: string, member: Record<string, unknown>): unknown => {
      const base = bindingOf(c);
      return (
        thrown(() => Reflect.apply(manifest, undefined, [c, { ...base, [id]: { ...Object(base[id]), ...member } }]))
          ?.code ?? null
      );
    };
    expect(bound("a.list", { component: page })).toBe("E1510");
    expect(bound("a.add", { component: page })).toBe("E1510");
    expect(bound("a.home", { action: () => null })).toBe("E1510");
    for (const member of [{ title: "t" }, { POST: () => null }, { action: () => null }]) {
      expect(bound("a.shell", member)).toBe("E1510");
    }
    for (const member of [{ errorElement: page }, { title: "t" }, { layout: "a.shell" }, { POST: () => null }]) {
      expect(bound("a.list", member)).toBe("E1510");
      expect(bound("a.add", member)).toBe("E1510");
    }
  });
});
