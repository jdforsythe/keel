// k.router Matching, k.prefix Parse, k.router Links and k.guards: the edges of matching a URL (the root, an empty
// segment, rank over several segments, a default prefix value written out), of writing an href (search keys sorted)
// and of the `next` a guard redirect carries.
import { err, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { guard } from "../src/guard.ts";
import { compileRoutes, guardNext, matchUrl, withNext } from "../src/internal/index.ts";
import { manifest } from "../src/manifest.ts";

const SEED = 1337;
/** A component for a table that renders no page. */
const view = (): Node => {
  throw new Error("no page renders here");
};
const A = s.object({ a: s.string() });
const B = s.object({ b: s.string() });

describe("matchUrl", () => {
  const m = contract("m", {
    "m.root": { path: "/" },
    "m.ax": { path: "/:a/x", params: A },
    "m.yb": { path: "/y/:b", params: B },
    "m.mid": { path: "/k/:a/z", params: A },
  });
  const table = compileRoutes(
    manifest(m, {
      "m.root": { component: view },
      "m.ax": { component: view },
      "m.yb": { component: view },
      "m.mid": { component: view },
    }),
  ).located;

  it("matches the root for an empty path, a bare query or hash, and slashes alone", () => {
    for (const [url, canonical] of [
      ["", "/"],
      ["/", "/"],
      ["//", "/"],
      ["?q=1", "/?q=1"],
      ["#top", "/#top"],
      ["http://localhost", "/"],
      ["http://localhost/?q=1#top", "/?q=1#top"],
    ] as const) {
      const got = matchUrl(table, url);
      expect([got.kind, got.route?.id, got.url], url).toEqual(["route", "m.root", canonical]);
    }
  });

  it("the earlier static segment wins when two patterns both fit, whichever is declared first", () => {
    const got = matchUrl(table, "/y/x");
    expect([got.route?.id, got.kind === "route" ? got.params : null]).toEqual(["m.yb", { b: "x" }]);
    const r = contract("r", { "r.yb": { path: "/y/:b", params: B }, "r.ax": { path: "/:a/x", params: A } });
    const rev = compileRoutes(manifest(r, { "r.yb": { component: view }, "r.ax": { component: view } })).located;
    expect(matchUrl(rev, "/y/x").route?.id).toBe("r.yb");
    expect(matchUrl(rev, "/q/x").route?.id).toBe("r.ax");
  });

  it("an empty segment fills no param", () => {
    expect(matchUrl(table, "/k//z")).toEqual({ kind: "notFound", url: "/k//z", route: null });
    expect(matchUrl(table, "/y/")).toEqual({ kind: "notFound", url: "/y", route: null });
    expect(matchUrl(table, "/k/v/z").route?.id).toBe("m.mid");
  });

  it("drops trailing slashes from the canonical url, keeping query and hash", () => {
    expect(matchUrl(table, "/y/b///?q=1#h").url).toBe("/y/b?q=1#h");
    expect(matchUrl(table, "/nowhere/")).toEqual({ kind: "notFound", url: "/nowhere", route: null });
  });

  it("ranks the same for a router loaded afresh", async () => {
    vi.resetModules();
    const fresh = {
      ...(await import("../src/internal/index.ts")),
      ...(await import("../src/contract/contract.ts")),
      ...(await import("../src/manifest.ts")),
    };
    const f = fresh.contract("f", { "f.ax": { path: "/:a/x", params: A }, "f.yb": { path: "/y/:b", params: B } });
    const located = fresh.compileRoutes(
      fresh.manifest(f, { "f.ax": { component: view }, "f.yb": { component: view } }),
    ).located;
    expect(fresh.matchUrl(located, "/y/x").route?.id).toBe("f.yb");
    expect(fresh.matchUrl(located, "/q/x").route?.id).toBe("f.ax");
  });
});

describe("matchUrl with a prefix param", () => {
  const Locale = s.object({ locale: s.enum(["en", "de"], { pathDefault: "en" }) });
  const p = contract("p", {
    "p.home": { path: "/:locale", params: Locale },
    "p.items": { path: "/:locale/items", params: Locale },
  });
  const table = compileRoutes(manifest(p, { "p.home": { component: view }, "p.items": { component: view } })).located;

  it("the default value written out matches, and the canonical url leaves it out", () => {
    for (const [url, id, canonical] of [
      ["/en", "p.home", "/"],
      ["/en/", "p.home", "/"],
      ["/en?q=1#h", "p.home", "/?q=1#h"],
      ["/en/items", "p.items", "/items"],
      ["/en/items?q=1", "p.items", "/items?q=1"],
      ["/", "p.home", "/"],
      ["/items", "p.items", "/items"],
      ["/de", "p.home", "/de"],
      ["/de/items", "p.items", "/de/items"],
    ] as const) {
      const got = matchUrl(table, url);
      expect([got.route?.id, got.url], url).toEqual([id, canonical]);
    }
    const de = matchUrl(table, "/de/items");
    const en = matchUrl(table, "/items");
    expect(de.kind === "route" ? de.params : null).toEqual({ locale: "de" });
    expect(en.kind === "route" ? en.params : null).toEqual({ locale: "en" });
  });
});

describe("href", () => {
  it("writes search keys sorted, whatever order they are given in", async () => {
    vi.resetModules();
    const fresh = await import("../src/contract/contract.ts");
    const Search = s.object({
      b: s.string().optional(),
      a: s.string().optional(),
      c: s.string().optional(),
      aa: s.string().optional(),
    });
    const c = fresh.contract("q", { "q.page": { path: "/q", search: Search } });
    fc.assert(
      fc.property(fc.shuffledSubarray(["a", "aa", "b", "c"], { minLength: 1 }), (keys) => {
        const search = Object.fromEntries(keys.map((k) => [k, `v${k}`]));
        const sorted = [...keys].sort();
        expect(c.href("q.page", {}, search)).toBe(`/q?${sorted.map((k) => `${k}=v${k}`).join("&")}`);
      }),
      { seed: SEED, numRuns: 60 },
    );
    expect(c.href("q.page", {}, { c: "1", b: "2", a: "3" })).toBe("/q?a=3&b=2&c=1");
  });
});

describe("guardNext", () => {
  const Denied = s.error("keel.denied", s.object({}));
  const auth = guard({ redirect: "g.login" }, async () => err(Denied.make({})));
  const g = contract("g", { "g.login": { path: "/login" }, "g.list": { path: "/list" } });
  const table = compileRoutes(
    manifest(g, { "g.login": { component: view }, "g.list": { component: view, guard: auth } }),
  ).located;

  it("passes on a redirect route's own next when it is a path of this origin", () => {
    for (const next of ["/a", "/a b", "/a?b=1#c", "/list", "/"])
      expect(guardNext(table, withNext("/login", next))).toBe(next);
  });

  it("drops a next that is no rooted path, keeping the rest of the url", () => {
    for (const next of ["a", "a/b", "x", "list", "", "http://k/a", "//k/a", "/\\k", "/a\u001f", "/a\u007f", "\u0000/a"])
      expect(guardNext(table, withNext("/login", next)), JSON.stringify(next)).toBe("/login");
    expect(guardNext(table, "/login?next=a&x=1#frag")).toBe("/login?x=1#frag");
    expect(guardNext(table, "/login?x=1&next=a")).toBe("/login?x=1");
    expect(guardNext(table, "/login?next=a#frag")).toBe("/login#frag");
  });

  it("leaves a url that is no redirect route, or matches none, as it is", () => {
    expect(guardNext(table, "/list?next=%2Fa")).toBe("/list?next=%2Fa");
    expect(guardNext(table, "/nowhere?next=%2Fa")).toBe("/nowhere?next=%2Fa");
    expect(guardNext(table, "/login")).toBe("/login");
  });
});
