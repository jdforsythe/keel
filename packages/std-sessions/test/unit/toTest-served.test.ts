// `toTest` with `serve` and `user`: the `node` form builds the app after the clock advance and before `record`,
// passes `app` and no `state`, and holds a `user` option only when given.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session } from "../../src/Session.schema.ts";
import { toTest } from "../../src/toTest.ts";

const parsed = Session.parse({
  v: 1,
  id: "s1",
  seed: 1337,
  deterministic: true,
  at: 0,
  route: { id: "cart.show", params: {}, search: {} },
  state: { "cart.cart": { items: ["secret-item"] } },
  events: [{ at: 5, kind: "fire", id: "cart.add", event: { type: "click" } }],
  error: null,
  fingerprint: "7f3a9c01d2e4",
});
if (!parsed.ok) throw new Error("the fixture session parses");
const session = parsed.value;
const cart = { module: "cart", from: "../routes.ts", contract: "../cart.contract.ts" };
const sessions = { module: "sessions", from: "@keel/std-sessions/routes", contract: "@keel/std-sessions/contract" };
const stores = [{ id: "cart.cart", name: "cart", from: "../cart.ts" }];
const serve = { deployable: "api", topology: "../../../topology.ts" };
const lines = (source: string): string[] => source.split("\n");

describe("toTest: the node form", () => {
  const source = toTest(session, { navs: [], stores, routes: [cart, sessions], serve });
  test("the app is built after the clock advance and before record, from topology and the joined tables", () => {
    expect(lines(source)).toEqual(
      expect.arrayContaining([
        'import { createApp } from "@keel/server";',
        'import topology from "../../../topology.ts";',
        'import { routes as cartRoutes } from "../routes.ts";',
        'import { routes as sessionsRoutes } from "@keel/std-sessions/routes";',
        "const routes = routeTable(cartRoutes, sessionsRoutes);",
      ]),
    );
    const at = (needle: string): number => source.indexOf(needle);
    expect(at("ctx.clock.advance(0)")).toBeGreaterThan(-1);
    expect(at("createApp({")).toBeGreaterThan(at("ctx.clock.advance(0)"));
    expect(at("record(ctx)")).toBeGreaterThan(at("createApp({"));
    expect(source).toContain('createApp({ topology, deployable: "api", routes, ctx })');
  });
  test("it passes app, no state and no store, whatever the session recorded", () => {
    expect(source).toContain('renderRoute("cart.show", { routes, params, search, ctx, app })');
    expect(source).not.toMatch(/\bstate\b/);
    expect(source).not.toContain("secret-item");
    expect(source).not.toContain("../cart.ts");
  });
  test("identity.server.ts is imported and passed only when given", () => {
    const withIdentity = toTest(session, {
      navs: [],
      stores,
      routes: [cart],
      serve: { ...serve, identity: "../../../identity.server.ts" },
    });
    expect(withIdentity).toContain('import identity from "../../../identity.server.ts";');
    expect(withIdentity).toContain("routes, ctx, identity })");
    expect(source).not.toContain("identity");
  });
  test("a module whose contract cannot be imported leaves its navs out", () => {
    const nav = { index: 0, id: "sessions.page", params: {}, search: {} };
    const out = toTest(
      { ...session, events: [{ at: 1, kind: "nav", href: "/x" }] },
      { navs: [nav], stores: [], routes: [cart, { ...sessions, contract: "" }], serve },
    );
    expect(out).not.toContain("navigate");
  });
});

describe("toTest: the user option", () => {
  const id = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9_-]{5,20}$/);
  test("a user id is written once in the node form and once in the router form, and not without it", () => {
    fc.assert(
      fc.property(id, (u) => {
        const node = toTest(session, { navs: [], stores: [], routes: [cart], serve, user: u });
        const router = toTest(session, { navs: [], stores: [], routes: [cart], user: u });
        for (const out of [node, router]) expect(out.match(/\buser\s*:/g)).toHaveLength(1);
        expect(node).toContain(`ctx, app, user: ${JSON.stringify(u)} })`);
        expect(router).toContain(`ctx, user: ${JSON.stringify(u)} })`);
      }),
      { seed: 1337, numRuns: 30 },
    );
    expect(toTest(session, { navs: [], stores: [], routes: [cart], serve })).not.toMatch(/\buser\b/);
  });
});
