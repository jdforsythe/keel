// @vitest-environment happy-dom
// Spec: k.router, clause "`matchHref(routes, routes.href(id, p, q))` is `{ id, params: p, search: q }`; an unmatched href, or one whose params fail, is `null`."
// Seed 1337
import { manifest } from "@keel/router";
import { matchHref } from "@keel/router/match";
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  LineParams,
  ListSearch,
  LoginSearch,
  OrderId,
  OrderParams,
  RUNS,
  SEED,
  ShowSearch,
  probeLinks,
  routes,
  usableId,
} from "./fixtures.ts";

const page = (): Node => document.createElement("div");
// A second manifest with looser schemas, used only to mint Hrefs the real manifest must reject.
const loose = manifest({
  "loose.line": {
    path: "/orders/:id/lines/:line",
    params: s.object({ id: OrderId, line: s.string() }),
    component: page,
  },
});
const opts = { seed: SEED, numRuns: RUNS };
const ids = gen(OrderParams).filter((p) => usableId(p.id));

describe("k.router matchHref", () => {
  it("matchHref(routes, routes.href(id, p, q)) is { id, params: p, search: q }", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ id: "app.home" as const, href: routes.href("app.home"), params: {}, search: {} }),
          fc.constant({ id: "orders.new" as const, href: routes.href("orders.new"), params: {}, search: {} }),
          fc.constant({ id: "guarded.page" as const, href: routes.href("guarded.page"), params: {}, search: {} }),
          gen(LoginSearch).map((q) => ({
            id: "app.login" as const,
            href: routes.href("app.login", {}, q),
            params: {},
            search: q,
          })),
          gen(ListSearch).map((q) => ({
            id: "orders.list" as const,
            href: routes.href("orders.list", {}, q),
            params: {},
            search: q,
          })),
          fc.tuple(ids, gen(ShowSearch)).map(([p, q]) => ({
            id: "orders.show" as const,
            href: routes.href("orders.show", p, q),
            params: p,
            search: q,
          })),
          gen(LineParams)
            .filter((p) => usableId(p.id))
            .map((p) => ({ id: "orders.line" as const, href: routes.href("orders.line", p), params: p, search: {} })),
          ids.map((p) => ({ id: "secret.show" as const, href: routes.href("secret.show", p), params: p, search: {} })),
        ),
        (c) => {
          expect(matchHref(routes, c.href)).toEqual({ id: c.id, params: c.params, search: c.search });
        },
      ),
      opts,
    );
  });

  it("an href no route matches is null", () => {
    expect(matchHref(routes, probeLinks.href("link.ghost"))).toBeNull();
    fc.assert(
      fc.property(ids, (p) => {
        expect(matchHref(routes, probeLinks.href("link.show", p))).toBeNull();
      }),
      opts,
    );
  });

  it("an href whose params fail the schema is null", () => {
    fc.assert(
      fc.property(
        ids,
        fc.string({ minLength: 1, maxLength: 6 }).filter((t) => !/^\d+$/.test(t)),
        (p, line) => {
          expect(matchHref(routes, loose.href("loose.line", { id: p.id, line }))).toBeNull();
        },
      ),
      opts,
    );
  });

  it("a layout route (no path) is never returned", () => {
    const layoutIds = ["app.shell", "orders.shell", "guarded.shell"];
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(routes.href("app.home")),
          fc.constant(routes.href("orders.new")),
          ids.map((p) => routes.href("orders.show", p)),
        ),
        (h) => {
          const m = matchHref(routes, h);
          expect(m === null || !layoutIds.includes(m.id)).toBe(true);
        },
      ),
      opts,
    );
  });
});
