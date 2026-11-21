// The matcher and search parser as exported for @keel/server from @keel/router/internal (RFC 0045).
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileRoutes, matchUrl, parseSearch } from "../src/internal/index.ts";

const SEED = 1337;
const p = (): Node => document.createElement("p");

describe("matchUrl over an exported table", () => {
  const o = contract("o", {
    "o.shell": { layout: true },
    "o.root": { path: "/" },
    "o.new": { path: "/orders/new" },
    "o.show": { path: "/orders/:id", params: s.object({ id: s.int({ min: 1 }) }) },
    "o.list": { path: "/orders", search: s.object({ tab: s.enum(["a", "b"]).optional() }) },
  });
  const table = compileRoutes(
    manifest(o, {
      "o.shell": { component: p },
      "o.root": { component: p },
      "o.new": { component: p, layout: "o.shell" },
      "o.show": { component: p },
      "o.list": { component: p },
    }),
  ).located;

  it("a static segment beats :param in either order; chains list layouts first", () => {
    const m = matchUrl(table, "/orders/new");
    expect(m).toMatchObject({ kind: "route", route: { id: "o.new" } });
    expect(m.route?.chain.map((l) => l.id)).toEqual(["o.shell", "o.new"]);
    const r = contract("r", {
      "r.show": { path: "/orders/:id", params: s.object({ id: s.string() }) },
      "r.new": { path: "/orders/new" },
    });
    const rev = compileRoutes(manifest(r, { "r.show": { component: p }, "r.new": { component: p } })).located;
    expect(matchUrl(rev, "/orders/new").route?.id).toBe("r.new");
    expect(matchUrl(rev, "/orders/x").route?.id).toBe("r.show");
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

  it("manifest rejects an unknown layout with E1506", () => {
    const a = contract("a", { "a.x": { path: "/x" } });
    expect(() =>
      // The type error is in unsafe/negativeTypes.ts; called untyped here.
      Reflect.apply(manifest, undefined, [a, { "a.x": { component: p, layout: "a.missing" } }]),
    ).toThrow(/^E1506/);
  });

  it("manifest rejects a layout cycle with E1506", () => {
    const a = contract("a", { "a.l1": { layout: true }, "a.l2": { layout: true }, "a.x": { path: "/x" } });
    expect(() =>
      manifest(a, {
        "a.l1": { component: p, layout: "a.l2" },
        "a.l2": { component: p, layout: "a.l1" },
        "a.x": { component: p, layout: "a.l1" },
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
