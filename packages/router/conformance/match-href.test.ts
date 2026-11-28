// @vitest-environment happy-dom
// Spec: k.router, clause "`matchHref(routes, c.href(id, p, q))` is `{ id, params: p, search: q }`; an unmatched href, or one whose params fail, is `null`."
// Seed 1337
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { matchHref } from "@keel/router/match";
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  appContract,
  LineParams,
  ListSearch,
  LoginSearch,
  OrderId,
  OrderParams,
  probeLinks,
  routes,
  RUNS,
  SEED,
  ShowSearch,
  usableId,
} from "./fixtures.ts";

const page = (): Node => document.createElement("div");
// A second manifest with looser schemas, used only to mint Hrefs the real manifest must reject.
const looseContract = contract("loose", {
  "loose.line": { path: "/orders/:id/lines/:line", params: s.object({ id: OrderId, line: s.string() }) },
});

const loose = manifest(looseContract, {
  "loose.line": { component: page },
});
const opts = { seed: SEED, numRuns: RUNS };
const ids = gen(OrderParams).filter((p) => usableId(p.id));

describe("k.router matchHref", () => {
  it("matchHref(routes, appContract.href(id, p, q)) is { id, params: p, search: q }", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ id: "app.home" as const, href: appContract.href("app.home"), params: {}, search: {} }),
          fc.constant({
            id: "app.ordersNew" as const,
            href: appContract.href("app.ordersNew"),
            params: {},
            search: {},
          }),
          fc.constant({
            id: "app.guardedPage" as const,
            href: appContract.href("app.guardedPage"),
            params: {},
            search: {},
          }),
          gen(LoginSearch).map((q) => ({
            id: "app.login" as const,
            href: appContract.href("app.login", {}, q),
            params: {},
            search: q,
          })),
          gen(ListSearch).map((q) => ({
            id: "app.ordersList" as const,
            href: appContract.href("app.ordersList", {}, q),
            params: {},
            search: q,
          })),
          fc.tuple(ids, gen(ShowSearch)).map(([p, q]) => ({
            id: "app.ordersShow" as const,
            href: appContract.href("app.ordersShow", p, q),
            params: p,
            search: q,
          })),
          gen(LineParams)
            .filter((p) => usableId(p.id))
            .map((p) => ({
              id: "app.ordersLine" as const,
              href: appContract.href("app.ordersLine", p),
              params: p,
              search: {},
            })),
          ids.map((p) => ({
            id: "app.secretShow" as const,
            href: appContract.href("app.secretShow", p),
            params: p,
            search: {},
          })),
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
          expect(matchHref(routes, looseContract.href("loose.line", { id: p.id, line }))).toBeNull();
        },
      ),
      opts,
    );
  });

  it("a layout route (no path) is never returned", () => {
    const layoutIds = ["app.shell", "app.ordersShell", "app.guardedShell"];
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(appContract.href("app.home")),
          fc.constant(appContract.href("app.ordersNew")),
          ids.map((p) => appContract.href("app.ordersShow", p)),
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
