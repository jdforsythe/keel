// @vitest-environment happy-dom
// Spec: k.contract, clause "`c.href` of a layout or API id does not compile; of a page with params it requires them."
// Spec: k.router, clause "`c.href` output is identical for equal inputs and omits absent optional search keys; a layout id or a missing or mistyped param does not compile."
// k.router (Links) "A contract's `href`, a router, and guard redirects resolve ids only in their own module." Seed 1337.
// Compile-time half of each "does not compile" claim: ./negative-types.test-d.ts; the calls here are untyped.
import { type Href, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { matchHref } from "@keel/router/match";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { SEED, bindingOf, page } from "./contract-support.ts";

const OrderId = s.id("Order");
const Params = s.object({ id: OrderId });
const Search = s.object({ tab: s.enum(["items", "history"]).optional(), page: s.int({ min: 0, max: 100 }).optional() });
const Out = s.object({ n: s.int() });
const c = contract("a", {
  "a.shell": { layout: true },
  "a.home": { path: "/" },
  "a.show": { path: "/o/:id", params: Params, search: Search },
  "a.list": { method: "GET", path: "/api/a", output: Out },
});
const idOf = (raw: string) => {
  const r = OrderId.parse(raw);
  if (!r.ok) throw new Error("fixture: id rejected");
  return r.value;
};

const tabs = ["items", "history"] as const;

describe("k.contract href", () => {
  it("`c.href` of a layout id does not compile", () => {
    const bad = () => Reflect.apply(c.href, c, ["a.shell"]);
    expect(typeof bad).toBe("function");
  });

  it("`c.href` of an API id does not compile", () => {
    const bad = () => Reflect.apply(c.href, c, ["a.list"]);
    expect(typeof bad).toBe("function");
  });

  it("`c.href` of a page with params requires them; without params it takes none", () => {
    const bad = () => Reflect.apply(c.href, c, ["a.show"]);
    expect(typeof bad).toBe("function");
    const mistyped = () => Reflect.apply(c.href, c, ["a.show", { id: 7 }]);
    expect(typeof mistyped).toBe("function");
    expect(c.href("a.show", { id: idOf("7") })).toBe("/o/7");
    expectTypeOf(c.href("a.home")).toEqualTypeOf<Href>();
  });

  it("`c.href` output is identical for equal inputs, sorts search keys and omits absent optional ones", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9]{1,8}$/),
        fc.option(fc.constantFrom(...tabs), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
        (raw, tab, pageNo) => {
          const search = { ...(tab === undefined ? {} : { tab }), ...(pageNo === undefined ? {} : { page: pageNo }) };
          const one = c.href("a.show", { id: idOf(raw) }, search);
          const two = c.href("a.show", { id: idOf(raw) }, { ...search });
          expect(one).toBe(two);
          const url = new URL(String(one), "http://x.test");
          expect(url.pathname).toBe(`/o/${raw}`);
          expect([...url.searchParams.keys()]).toEqual([...url.searchParams.keys()].sort());
          expect(url.searchParams.has("tab")).toBe(tab !== undefined);
          expect(url.searchParams.has("page")).toBe(pageNo !== undefined);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("`matchHref(routes, c.href(id, p, q))` is `{ id, params: p, search: q }`, and an API path matches none", () => {
    const routes = Reflect.apply(manifest, undefined, [c, bindingOf(c)]);
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9]{1,8}$/), fc.constantFrom(...tabs), (raw, tab) => {
        const m = matchHref(routes, c.href("a.show", { id: idOf(raw) }, { tab }));
        expect(m?.id).toBe("a.show");
        expect(m?.params).toEqual({ id: raw });
        expect(m?.search).toEqual({ tab });
      }),
      { seed: SEED, numRuns: 40 },
    );
    expect(matchHref(routes, c.href("a.home"))?.id).toBe("a.home");
    const alias = manifest(contract("z", { "z.api": { path: "/api/a" } }), { "z.api": { component: page } });
    expect(matchHref(routes, alias.contract.href("z.api"))).toBeNull();
  });

  it("an id of another contract does not compile at `c.href`", () => {
    const other = contract("b", { "b.home": { path: "/b" } });
    const foreign = () => Reflect.apply(c.href, c, ["b.home"]);
    expect(typeof foreign).toBe("function");
    expect(other.href("b.home")).toBe("/b");
  });
});
