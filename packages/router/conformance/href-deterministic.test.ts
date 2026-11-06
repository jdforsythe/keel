// @vitest-environment happy-dom
// Spec: k.router, clause "href output is identical for equal inputs and omits absent optional search keys." Seed 1337.
import { href } from "@keel/router";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LineParams, ListSearch, OrderParams, RUNS, SEED, ShowSearch, usableId } from "./fixtures.ts";

const url = (h: string): URL => new URL(h, "http://keel.test");
const opts = { seed: SEED, numRuns: RUNS };
const lineParams = LineParams.gen().filter((p) => usableId(p.id));

describe("k.router href", () => {
  it("href output is identical for equal inputs", () => {
    fc.assert(
      fc.property(lineParams, ListSearch.gen(), (p, q) => {
        const reordered = Object.fromEntries(Object.entries(q).reverse());
        const sameParams = { line: p.line, id: p.id };
        expect(String(href("orders.line", sameParams))).toBe(String(href("orders.line", p)));
        expect(String(href("orders.list", {}, reordered))).toBe(String(href("orders.list", {}, q)));
        expect(String(href("orders.list", {}, q))).toBe(String(href("orders.list", {}, q)));
      }),
      opts,
    );
  });
  it("href omits absent optional search keys and sorts the present ones", () => {
    fc.assert(
      fc.property(ListSearch.gen(), (q) => {
        const explicit = { page: q.page, q: q.q, sort: q.sort };
        const h = String(href("orders.list", {}, q));
        expect(String(href("orders.list", {}, explicit))).toBe(h);
        const keys = [...url(h).searchParams.keys()];
        expect(keys).toEqual([...keys].sort());
        for (const k of ["page", "q", "sort"] as const) {
          if (q[k] === undefined) expect(keys).not.toContain(k);
          else expect(keys).toContain(k);
        }
        expect(String(href("orders.list"))).toBe(url(String(href("orders.list"))).pathname);
      }),
      opts,
    );
  });
  it("href encodes params by schema then URL-encodes them", () => {
    fc.assert(
      fc.property(
        OrderParams.gen().filter((p) => usableId(p.id)),
        ShowSearch.gen(),
        (p, q) => {
          expect(url(String(href("orders.show", p, q))).pathname).toBe(`/orders/${encodeURIComponent(p.id)}`);
        },
      ),
      opts,
    );
  });
});
