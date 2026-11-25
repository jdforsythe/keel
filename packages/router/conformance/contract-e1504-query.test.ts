// @vitest-environment happy-dom
// Spec: k.contract Rules "E1502, E1503, E1504 (k.router) ... read the contract."
// Spec: RFC 0157 Conformance diff: "An API GET entry with `query: s.object({ q: s.string() })` (required) is no E1504; a page entry whose `search` requires a field is E1504." Seed 1337.
// ASSUMPTION: which of `contract` and `manifest` throws E1502-E1504 is not stated; each case builds both.
// Compile-time half of each "does not compile" claim: ./negative-types.test-d.ts; the calls here are untyped.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, bindingOf, codeOf, page } from "./contract-support.ts";

const Out = s.object({ n: s.int() });
const Id = s.object({ id: s.id("Order") });
const field = fc.constantFrom("q", "page", "sort", "tab");
/** The `code` thrown building a contract of `entries` and its valid binding, or null. The API handlers answer `{ n }`, which `Out` admits. */
const build = (entries: Record<string, unknown>): unknown =>
  codeOf(() => {
    const c = Reflect.apply(contract, undefined, ["a", entries]);
    return Reflect.apply(manifest, undefined, [c, bindingOf(c)]);
  });

describe("k.contract rules read the contract", () => {
  it("An API GET entry with a required `query` field is no E1504", () => {
    fc.assert(
      fc.property(field, (f) => {
        const query = s.object({ [f]: s.string() });
        expect(build({ "a.x": { method: "GET", path: "/x", query, output: Out } })).toBeNull();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("A page entry whose `search` requires a field is E1504; an optional one is clean", () => {
    fc.assert(
      fc.property(field, (f) => {
        const bad = build({ "a.x": { path: "/x", search: s.object({ [f]: s.string() }) } });
        expect(bad).toBe("E1504");
        const clean = build({ "a.x": { path: "/x", search: s.object({ [f]: s.string().optional() }) } });
        expect(clean).toBeNull();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("E1503 `:name` in a contract entry's path without a `params` field, or the reverse", () => {
    const one = (entry: unknown) => build({ "a.x": entry });
    expect(one({ path: "/o/:id" })).toBe("E1503");
    expect(one({ path: "/o", params: Id })).toBe("E1503");
    expect(one({ path: "/o/:id", params: Id })).toBeNull();
    expect(build({ "a.x": { method: "GET", path: "/api/:id", output: Out } })).toBe("E1503");
    expect(build({ "a.x": { method: "GET", path: "/api/:id", params: Id, output: Out } })).toBeNull();
  });

  it("E1502 two entries with the same path pattern; two API entries at different methods of one path are clean", () => {
    const pages = { "a.one": { path: "/x" }, "a.two": { path: "/x" } };
    expect(build(pages)).toBe("E1502");
    const api = {
      "a.box": { method: "GET", path: "/api/a", output: Out },
      "a.add": { method: "POST", path: "/api/a", body: Out, output: Out },
    };
    expect(build(api)).toBeNull();
    const same = {
      "a.box": { method: "GET", path: "/api/a", output: Out },
      "a.list": { method: "GET", path: "/api/a", output: Out },
    };
    expect(build(same)).toBe("E1502");
    const mixed = { "a.box": { method: "GET", path: "/x", output: Out }, "a.page": { path: "/x" } };
    expect(build(mixed)).toBe("E1502");
  });

  it("E1505 `<Form method>`: an action key that is no verb is a type error and E1505 on the binding", () => {
    const c = contract("a", { "a.x": { path: "/x" } });
    const bad = () => Reflect.apply(manifest, undefined, [c, { "a.x": { component: page, GET: () => null } }]);
    expect(codeOf(bad)).toMatch(/^E15(05|10)$/);
  });
});
