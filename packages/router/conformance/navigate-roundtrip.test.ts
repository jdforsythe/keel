// @vitest-environment happy-dom
// Spec: k.router, clause "For every route and every generated params and search, navigate(routes.href(id, p, q)) makes route() equal { id, params: p, search: q, pending: false }." Seed 1337.
import type { Href } from "@keel/router";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import {
  LineParams,
  ListSearch,
  LoginSearch,
  OrderParams,
  RUNS,
  SEED,
  ShowSearch,
  now,
  resetObservations,
  routes,
  settle,
  start,
  usableId,
} from "./fixtures.ts";

type Case = { link: () => Href; expected: { id: string; params: unknown; search: unknown; pending: false } };

// Every non-layout route in fixtures.ts (layouts have no path, so there is nothing to navigate to).
// Guards all pass (control.gate is true after reset) and slow.page's loader is not held, so no route is
// inapplicable: a denying guard would redirect (a different clause) and a never-resolving loader would keep
// pending true; neither is in play here. orders.bare's loader errs, which renders its errorElement but the
// match is still the route.
const plain = (id: "app.home" | "orders.new" | "orders.bare" | "guarded.page" | "slow.page"): fc.Arbitrary<Case> =>
  fc.constant<Case>({
    link: () => routes.href(id),
    expected: { id, params: {}, search: {}, pending: false },
  });
const login = gen(LoginSearch).map(
  (q): Case => ({
    link: () => routes.href("app.login", {}, q),
    expected: { id: "app.login", params: {}, search: q, pending: false },
  }),
);
const list = gen(ListSearch).map(
  (q): Case => ({
    link: () => routes.href("orders.list", {}, q),
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
      link: () => routes.href("orders.show", p, q),
      expected: { id: "orders.show", params: p, search: q, pending: false },
    }),
  );
const line = gen(LineParams)
  .filter((p) => usableId(p.id))
  .map(
    (p): Case => ({
      link: () => routes.href("orders.line", p),
      expected: { id: "orders.line", params: p, search: {}, pending: false },
    }),
  );
const secret = gen(OrderParams)
  .filter((p) => usableId(p.id))
  .map(
    (p): Case => ({
      link: () => routes.href("secret.show", p),
      expected: { id: "secret.show", params: p, search: {}, pending: false },
    }),
  );
describe("k.router navigate round-trip", () => {
  beforeEach(resetObservations);
  it("for every route and every generated params and search, navigate(routes.href(id, p, q)) makes route() equal { id, params: p, search: q, pending: false }", async () => {
    const app = await start("/");
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          plain("app.home"),
          plain("orders.new"),
          plain("orders.bare"),
          plain("guarded.page"),
          plain("slow.page"),
          login,
          list,
          show,
          line,
          secret,
        ),
        async (c) => {
          await app.router.navigate(c.link());
          await settle();
          expect(now(app.router)).toEqual(c.expected);
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
    app.stop();
  });
});
