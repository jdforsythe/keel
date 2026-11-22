// @vitest-environment happy-dom
// Spec: k.guards, clause "`manifest` throws E1508 naming the page, the `redirect` route and the field when a guarded page lacks a field of the `redirect` route's `params`, or carries `s.id('User')` to `s.id('Recipe')`, `s.enum(['a', 'b', 'c'])` to `s.enum(['a', 'b'])` or `s.string()` to `s.string({ max: 8 })`; it throws none for the same schema, `s.enum(['a'])` to `s.enum(['a', 'b'])`, `s.literal('a')` to `s.string()` or `s.int({ min: 1 })` to `s.int()`; `routeTable` throws E1508 for a page of one module under another module's guarded layout."
// Spec: k.guards, Carried params "every field of the `redirect` route's `params` must be a field of the page's `params` whose node fits the target's: the same node, or one of the same type with the same options (an `id` of the same brand), or one holding only values the target accepts (an `enum` or `literal` each of whose values the target's node parses; a `string`, `number` or `int` whose `min` and `max` lie within the target's of the same type, an absent bound unbounded)."
// Spec: k.guards, Rules "E1508 ... (route table) a carried param missing or not fitting"
// Seed 1337 (RFC 0177 clause k.guards #4). The pairs are a closed table, so no random input.
// Assumed (spec leaves open): the guard sits on the page or on a layout of the chain; message names page id, redirect route id and field.
import { guard, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { page, thrown } from "./contract-support.ts";

type Node = Parameters<typeof s.object>[0][string];
const Denied = s.error("keel.denied", s.object({}));
const deny = (redirect: "w.login") => guard({ redirect }, async () => err(Denied.make({})));

// A guarded page `w.page` redirecting to `w.login`; the page carries `pageNode` as `f`, the target takes `targetNode` as `f`.
const build = (pageNode: Node, targetNode: Node) => {
  const w = contract("w", {
    "w.login": { path: "/login/:f", params: s.object({ f: targetNode }) },
    "w.page": { path: "/page/:f", params: s.object({ f: pageNode }) },
  });
  return () => manifest(w, { "w.login": { component: page }, "w.page": { component: page, guard: deny("w.login") } });
};
// A guarded page that has no `f` at all.
const buildMissing = () => {
  const w = contract("w", {
    "w.login": { path: "/login/:f", params: s.object({ f: s.string() }) },
    "w.page": { path: "/page" },
  });
  return () => manifest(w, { "w.login": { component: page }, "w.page": { component: page, guard: deny("w.login") } });
};
// A guarded page whose only field has another name than the target's.
const buildRenamed = () => {
  const w = contract("w", {
    "w.login": { path: "/login/:f", params: s.object({ f: s.string() }) },
    "w.page": { path: "/page/:g", params: s.object({ g: s.string() }) },
  });
  return () => manifest(w, { "w.login": { component: page }, "w.page": { component: page, guard: deny("w.login") } });
};
// A guard on the layout of the own module: every page under it is checked.
const buildLayout = (pageNode: Node, targetNode: Node) => {
  const w = contract("w", {
    "w.login": { path: "/login/:f", params: s.object({ f: targetNode }) },
    "w.shell": { layout: true },
    "w.page": { path: "/page/:f", params: s.object({ f: pageNode }) },
  });
  return () =>
    manifest(w, {
      "w.login": { component: page },
      "w.shell": { component: page, guard: deny("w.login") },
      "w.page": { component: page, layout: "w.shell" },
    });
};

const e1508 = (make: () => unknown, ...names: string[]): void => {
  const e = thrown(make);
  expect(e?.code).toBe("E1508");
  for (const n of names) expect(e?.message).toContain(n);
};

// Pairs from the closed list in k.guards Carried params: [name, page's node, target's node].
type Pair = readonly [string, () => Node, () => Node];
const sameNode = s.string({ max: 8 });
const failing: readonly Pair[] = [
  ["id of one brand to id of another", () => s.id("User"), () => s.id("Recipe")],
  ["enum to an enum lacking a value", () => s.enum(["a", "b", "c"]), () => s.enum(["a", "b"])],
  ["literal to an enum that lacks it", () => s.literal("z"), () => s.enum(["a", "b"])],
  ["unbounded string to a bounded string", () => s.string(), () => s.string({ max: 8 })],
  ["string with a larger max to a smaller max", () => s.string({ max: 16 }), () => s.string({ max: 8 })],
  ["string with a smaller min to a larger min", () => s.string({ min: 1 }), () => s.string({ min: 2 })],
  ["unbounded int to an int with a min", () => s.int(), () => s.int({ min: 1 })],
  ["int with a larger max to a smaller max", () => s.int({ min: 0, max: 20 }), () => s.int({ min: 0, max: 10 })],
  ["unbounded number to a bounded number", () => s.number(), () => s.number({ min: 0 })],
  ["number with a larger max to a smaller max", () => s.number({ max: 9 }), () => s.number({ max: 5 })],
  ["string to int (another type)", () => s.string(), () => s.int()],
  ["unbounded number to an unbounded int", () => s.number(), () => s.int()],
  ["number within an int's bounds to an int", () => s.number({ min: 1, max: 5 }), () => s.int({ min: 0, max: 10 })],
  ["int with a larger max to a number with a smaller max", () => s.int({ max: 20 }), () => s.number({ max: 10 })],
  ["unbounded int to a bounded number", () => s.int(), () => s.number({ min: 0 })],
];
const passing: readonly Pair[] = [
  ["the same node", () => sameNode, () => sameNode],
  ["the same type and options, written twice (string)", () => s.string({ max: 8 }), () => s.string({ max: 8 })],
  ["the same brand, written twice (id)", () => s.id("User"), () => s.id("User")],
  ["enum to a larger enum", () => s.enum(["a"]), () => s.enum(["a", "b"])],
  ["enum to the same values", () => s.enum(["a", "b"]), () => s.enum(["a", "b"])],
  ["literal to an enum holding it", () => s.literal("a"), () => s.enum(["a", "b"])],
  ["literal to a string", () => s.literal("a"), () => s.string()],
  ["enum to a string", () => s.enum(["a", "b"]), () => s.string()],
  ["bounded string to an unbounded string", () => s.string({ max: 8 }), () => s.string()],
  ["string bounds within the target's", () => s.string({ min: 2, max: 4 }), () => s.string({ min: 1, max: 8 })],
  ["int with a min to an unbounded int", () => s.int({ min: 1 }), () => s.int()],
  ["int bounds within the target's", () => s.int({ min: 1, max: 5 }), () => s.int({ min: 0, max: 10 })],
  ["number bounds within the target's", () => s.number({ min: 1, max: 5 }), () => s.number({ min: 0, max: 10 })],
  ["int to an unbounded number", () => s.int(), () => s.number()],
  ["int bounds within a number target's", () => s.int({ min: 1, max: 5 }), () => s.number({ min: 0, max: 10 })],
  ["number with a min to an unbounded number", () => s.number({ min: 1 }), () => s.number()],
];

describe("k.guards: a guard redirect's carried params are checked when the route table is built", () => {
  it("`manifest` throws E1508 naming the page, the `redirect` route and the field when a guarded page lacks a field of the `redirect` route's `params`", () => {
    e1508(buildMissing(), "w.page", "w.login", "f");
    e1508(buildRenamed(), "w.page", "w.login", "f");
  });

  it("`manifest` throws E1508 naming the page, the `redirect` route and the field for `s.id('User')` carried to `s.id('Recipe')`", () => {
    e1508(build(s.id("User"), s.id("Recipe")), "w.page", "w.login", "f");
  });

  it("`manifest` throws E1508 naming the page, the `redirect` route and the field for `s.enum(['a', 'b', 'c'])` carried to `s.enum(['a', 'b'])`", () => {
    e1508(build(s.enum(["a", "b", "c"]), s.enum(["a", "b"])), "w.page", "w.login", "f");
  });

  it("`manifest` throws E1508 naming the page, the `redirect` route and the field for `s.string()` carried to `s.string({ max: 8 })`", () => {
    e1508(build(s.string(), s.string({ max: 8 })), "w.page", "w.login", "f");
  });

  it("every pair of the closed list that does not fit throws E1508 from `manifest`", () => {
    for (const [name, p, t] of failing) {
      const e = thrown(build(p(), t()));
      expect(e?.code, name).toBe("E1508");
      expect(e?.message, name).toContain("w.page");
      expect(e?.message, name).toContain("w.login");
      expect(e?.message, name).toContain("f");
    }
  });

  it("`manifest` throws none for the same schema, `s.enum(['a'])` to `s.enum(['a', 'b'])`, `s.literal('a')` to `s.string()` or `s.int({ min: 1 })` to `s.int()`", () => {
    const same = s.string();
    expect(thrown(build(same, same))).toBeNull();
    expect(thrown(build(s.enum(["a"]), s.enum(["a", "b"])))).toBeNull();
    expect(thrown(build(s.literal("a"), s.string()))).toBeNull();
    expect(thrown(build(s.int({ min: 1 }), s.int()))).toBeNull();
  });

  it("every pair of the closed list that fits throws nothing from `manifest`", () => {
    for (const [name, p, t] of passing) expect(thrown(build(p(), t())), name).toBeNull();
  });

  it("a guarded page whose `redirect` route has no params needs none", () => {
    const w = contract("w", {
      "w.login": { path: "/login" },
      "w.page": { path: "/page/:g", params: s.object({ g: s.string() }) },
    });
    expect(
      thrown(() =>
        manifest(w, { "w.login": { component: page }, "w.page": { component: page, guard: deny("w.login") } }),
      ),
    ).toBeNull();
  });

  it("an unguarded page is not checked", () => {
    const w = contract("w", {
      "w.login": { path: "/login/:f", params: s.object({ f: s.id("Recipe") }) },
      "w.page": { path: "/page/:f", params: s.object({ f: s.id("User") }) },
    });
    expect(thrown(() => manifest(w, { "w.login": { component: page }, "w.page": { component: page } }))).toBeNull();
  });

  it("a guard on a layout of the own module checks every page under it: `manifest` throws E1508 for a page that does not fit", () => {
    e1508(buildLayout(s.id("User"), s.id("Recipe")), "w.page", "w.login", "f");
  });

  it("a guard on a layout of the own module passes a page whose field fits", () => {
    expect(thrown(buildLayout(s.enum(["a"]), s.enum(["a", "b"])))).toBeNull();
  });
});

// Cross-module: the page of one module under another module's guarded layout.
const shell = contract("shell", {
  "shell.login": { path: "/login/:f", params: s.object({ f: s.enum(["a", "b"]) }) },
  "shell.frame": { layout: true },
});
const shellModule = manifest(shell, {
  "shell.login": { component: page },
  "shell.frame": { component: page, guard: guard({ redirect: "shell.login" }, async () => err(Denied.make({}))) },
});
const appWith = (pageParams: Node | undefined) => {
  const app = contract("app", {
    "app.page": pageParams === undefined ? { path: "/p" } : { path: "/p/:f", params: s.object({ f: pageParams }) },
  });
  return manifest(app, { "app.page": { component: page, layout: "shell.frame" } });
};

describe("k.guards: the route table joins a chain across modules and checks it", () => {
  it("`routeTable` throws E1508 for a page of one module under another module's guarded layout whose field does not fit", () => {
    e1508(() => routeTable(shellModule, appWith(s.enum(["a", "b", "c"]))), "app.page", "shell.login", "f");
  });

  it("`routeTable` throws E1508 for a page of one module under another module's guarded layout that lacks the field", () => {
    e1508(() => routeTable(shellModule, appWith(undefined)), "app.page", "shell.login", "f");
  });

  it("`routeTable` throws nothing for a page of one module under another module's guarded layout whose field fits", () => {
    expect(thrown(() => routeTable(shellModule, appWith(s.enum(["a"]))))).toBeNull();
    expect(thrown(() => routeTable(shellModule, appWith(s.literal("b"))))).toBeNull();
  });
});
