import type { Href } from "@keel/router";
import type { Id, Infer } from "@keel/schema";
// @vitest-environment happy-dom
// Spec: k.router, clause "`routes.href` output is identical for equal inputs and omits absent optional search keys; a layout id or a missing or mistyped param does not compile." Seed 1337.
// The type-level half pins the accepted id union and param/search types with expectTypeOf, checked by tsc
// (pnpm --filter @keel/router check); rejected ids and params are excluded by type equality.
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { LineParams, ListSearch, OrderParams, RUNS, SEED, ShowSearch, idOf, routes, usableId } from "./fixtures.ts";

const url = (h: string): URL => new URL(h, "http://keel.test");
const opts = { seed: SEED, numRuns: RUNS };
const lineParams = gen(LineParams).filter((p) => usableId(p.id));

describe("k.router href", () => {
  it("a layout id or a missing or mistyped param does not compile", () => {
    const id = idOf("7");
    // runtime: well-typed calls succeed and return a branded Href
    expect(typeof routes.href("orders.show", { id })).toBe("string");
    expectTypeOf(routes.href).returns.toEqualTypeOf<Href>();
    // accepted ids are exactly the routes with a path: layout ids and unknown ids are excluded by equality
    expectTypeOf(routes.href)
      .parameter(0)
      .toEqualTypeOf<
        | "app.home"
        | "app.login"
        | "orders.list"
        | "orders.new"
        | "orders.bare"
        | "orders.show"
        | "orders.line"
        | "secret.show"
        | "guarded.page"
        | "slow.page"
      >();
    // params are required and typed by the route's schema (an Order id, a number line); search by its search schema
    expectTypeOf(routes.href<"orders.show">).parameters.toEqualTypeOf<
      [id: "orders.show", params: Infer<typeof OrderParams>, search?: Infer<typeof ShowSearch>]
    >();
    expectTypeOf(routes.href<"orders.show">)
      .parameter(1)
      .toEqualTypeOf<{ id: Id<"Order"> }>();
    expectTypeOf(routes.href<"orders.show">)
      .parameter(2)
      .toEqualTypeOf<{ tab?: "items" | "history" } | undefined>();
    expectTypeOf(routes.href<"orders.line">)
      .parameter(1)
      .toEqualTypeOf<{ id: Id<"Order">; line: number }>();
    expectTypeOf(routes.href<"orders.line">)
      .parameter(2)
      .toEqualTypeOf<Readonly<Record<string, never>> | undefined>();
    // routes without params take no required argument
    const ok1: Href = routes.href("app.home");
    expect(typeof ok1).toBe("string");
  });
  it("href output is identical for equal inputs", () => {
    fc.assert(
      fc.property(lineParams, gen(ListSearch), (p, q) => {
        const reordered = Object.fromEntries(Object.entries(q).reverse());
        const sameParams = { line: p.line, id: p.id };
        expect(String(routes.href("orders.line", sameParams))).toBe(String(routes.href("orders.line", p)));
        expect(String(routes.href("orders.list", {}, reordered))).toBe(String(routes.href("orders.list", {}, q)));
        expect(String(routes.href("orders.list", {}, q))).toBe(String(routes.href("orders.list", {}, q)));
      }),
      opts,
    );
  });
  it("href omits absent optional search keys and sorts the present ones", () => {
    fc.assert(
      fc.property(gen(ListSearch), (q) => {
        const explicit = { page: q.page, q: q.q, sort: q.sort };
        const h = String(routes.href("orders.list", {}, q));
        expect(String(Reflect.apply(routes.href, undefined, ["orders.list", {}, explicit]))).toBe(h);
        const keys = [...url(h).searchParams.keys()];
        expect(keys).toEqual([...keys].sort());
        for (const k of ["page", "q", "sort"] as const) {
          if (q[k] === undefined) expect(keys).not.toContain(k);
          else expect(keys).toContain(k);
        }
        expect(String(routes.href("orders.list"))).toBe(url(String(routes.href("orders.list"))).pathname);
      }),
      opts,
    );
  });
  it("href omits absent optional search keys on orders.show", () => {
    fc.assert(
      fc.property(
        gen(OrderParams).filter((p) => usableId(p.id)),
        gen(ShowSearch),
        (p, q) => {
          const h = String(routes.href("orders.show", p, q));
          const keys = [...url(h).searchParams.keys()];
          expect(String(Reflect.apply(routes.href, undefined, ["orders.show", p, { tab: q.tab }]))).toBe(h);
          if (q.tab === undefined) {
            expect(keys).toEqual([]);
            expect(url(h).search).toBe("");
            expect(h).toBe(String(routes.href("orders.show", p)));
          } else expect(keys).toEqual(["tab"]);
        },
      ),
      opts,
    );
  });
  it("href encodes params by schema then URL-encodes them", () => {
    fc.assert(
      fc.property(
        gen(OrderParams).filter((p) => usableId(p.id)),
        gen(ShowSearch),
        (p, q) => {
          expect(url(String(routes.href("orders.show", p, q))).pathname).toBe(`/orders/${encodeURIComponent(p.id)}`);
        },
      ),
      opts,
    );
  });
});
