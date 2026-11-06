// @vitest-environment happy-dom
// Spec: k.router, clause "For every route and every generated params and search, navigate(href(id, p, q)) makes route() equal { id, params: p, search: q, pending: false }." Seed 1337.
import { type Href, href } from "@keel/router";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import {
  LineParams,
  ListSearch,
  OrderParams,
  RUNS,
  SEED,
  ShowSearch,
  now,
  resetObservations,
  settle,
  start,
  usableId,
} from "./fixtures.ts";

type Case = { link: () => Href; expected: { id: string; params: unknown; search: unknown; pending: false } };

const home = fc.constant<Case>({
  link: () => href("app.home"),
  expected: { id: "app.home", params: {}, search: {}, pending: false },
});
const list = gen(ListSearch).map(
  (q): Case => ({
    link: () => href("orders.list", {}, q),
    expected: { id: "orders.list", params: {}, search: q, pending: false },
  }),
);
const show = fc
  .tuple(
    gen(OrderParams).filter((p) => usableId(p.id)),
    gen(ShowSearch),
  )
  .map(
    ([p, q]): Case => ({
      link: () => href("orders.show", p, q),
      expected: { id: "orders.show", params: p, search: q, pending: false },
    }),
  );
const line = gen(LineParams)
  .filter((p) => usableId(p.id))
  .map(
    (p): Case => ({
      link: () => href("orders.line", p),
      expected: { id: "orders.line", params: p, search: {}, pending: false },
    }),
  );

describe("k.router navigate round-trip", () => {
  beforeEach(resetObservations);
  it("for every route and every generated params and search, navigate(href(id, p, q)) makes route() equal { id, params: p, search: q, pending: false }", async () => {
    const app = await start("/");
    await fc.assert(
      fc.asyncProperty(fc.oneof(home, list, show, line), async (c) => {
        await app.router.navigate(c.link());
        await settle();
        expect(now(app.router)).toEqual(c.expected);
      }),
      { seed: SEED, numRuns: RUNS },
    );
    app.stop();
  });
});
