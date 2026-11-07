// The matcher and search parser as exported for @keel/server from @keel/router/internal (RFC 0045).
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileRoutes, compileTable, matchUrl, parseSearch } from "../src/internal/index.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";

const SEED = 1337;
const p = (): Node => document.createElement("p");
const tableOf = (routes: Record<string, RouteDef>) => compileTable(compileRoutes(routes), routes);

describe("matchUrl over an exported table", () => {
  const table = tableOf({
    "o.shell": { component: p },
    "o.root": { path: "/", component: p },
    "o.new": { path: "/orders/new", component: p, layout: "o.shell" },
    "o.show": { path: "/orders/:id", params: s.object({ id: s.int({ min: 1 }) }), component: p },
    "o.list": { path: "/orders", search: s.object({ tab: s.enum(["a", "b"]).optional() }), component: p },
  });

  it("a static segment beats :param in either order; chains list layouts first", () => {
    const m = matchUrl(table, "/orders/new");
    expect(m).toMatchObject({ kind: "route", route: { id: "o.new" } });
    expect(m.route?.chain.map((l) => l.id)).toEqual(["o.shell", "o.new"]);
    const rev = tableOf({
      "o.show": { path: "/orders/:id", component: p, params: s.object({ id: s.string() }) },
      "o.new": { path: "/orders/new", component: p },
    });
    expect(matchUrl(rev, "/orders/new").route?.id).toBe("o.new");
    expect(matchUrl(rev, "/orders/x").route?.id).toBe("o.show");
  });

  it("parses params and search; failing search keys are dropped", () => {
    expect(matchUrl(table, "/orders/7")).toMatchObject({ kind: "route", params: { id: 7 }, search: {} });
    expect(matchUrl(table, "/orders?tab=b&x=1")).toMatchObject({ kind: "route", search: { tab: "b" } });
    expect(matchUrl(table, "/")).toMatchObject({ kind: "route", route: { id: "o.root" } });
  });

  it("notFound: params fail (route kept), no pattern, bad escape, extra segment; a trailing slash is tolerated", () => {
    expect(matchUrl(table, "/orders/0")).toMatchObject({ kind: "notFound", route: { id: "o.show" } });
    expect(matchUrl(table, "/nope")).toMatchObject({ kind: "notFound", route: null });
    expect(matchUrl(table, "/orders/%E0%A4%A")).toMatchObject({ kind: "notFound", route: null });
    expect(matchUrl(table, "/orders/new/x")).toMatchObject({ kind: "notFound", route: null });
    expect(matchUrl(table, "/orders/")).toMatchObject({ kind: "route", url: "/orders", route: { id: "o.list" } });
  });

  it("compileRoutes rejects an unknown layout or a cycle with E1506", () => {
    expect(() => tableOf({ "a.x": { path: "/x", component: p, layout: "a.missing" } })).toThrow(/^E1506/);
    expect(() =>
      tableOf({
        "a.l1": { component: p, layout: "a.l2" },
        "a.l2": { component: p, layout: "a.l1" },
        "a.x": { path: "/x", component: p, layout: "a.l1" },
      }),
    ).toThrow(/^E1506/);
  });
});

describe("parseSearch", () => {
  const S = s.object({ tab: s.enum(["a", "b"]).optional(), n: s.int().optional() });
  it("keeps valid keys, drops failing and undeclared ones; no schema gives {}", () => {
    expect(parseSearch(S, "tab=a&n=3")).toEqual({ tab: "a", n: 3 });
    expect(parseSearch(S, "tab=z&n=3")).toEqual({ n: 3 });
    expect(parseSearch(S, "tab=a&n=x")).toEqual({ tab: "a" });
    expect(parseSearch(S, "tab=z&n=x&q=1")).toEqual({});
    expect(parseSearch(undefined, "tab=a")).toEqual({});
  });
  it("property: the result always parses with the schema", () => {
    fc.assert(
      fc.property(fc.webQueryParameters(), (q) => {
        expect(S.parse(parseSearch(S, q)).ok).toBe(true);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
