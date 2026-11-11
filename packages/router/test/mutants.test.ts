// Targeted examples and properties pinning internal helpers: message text, exact branches, boundary values.
// Property-based parts use fast-check seed 1337 (fixed for determinism).
import { createCtx } from "@keel/ctx";
import { err, ok, pathToString, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { guard } from "../src/guard.ts";
import type { Level } from "../src/internal/Level.ts";
import type { Located } from "../src/internal/Located.ts";
import type { SchemaNode } from "../src/internal/SchemaNode.ts";
import { chainOf } from "../src/internal/chainOf.ts";
import { codedError } from "../src/internal/codedError.ts";
import { compilePath } from "../src/internal/compilePath.ts";
import { compileRoutes } from "../src/internal/compileRoutes.ts";
import { compileTable } from "../src/internal/compileTable.ts";
import { fieldsError } from "../src/internal/fieldsError.ts";
import { fieldsOf } from "../src/internal/fieldsOf.ts";
import { flattenJson } from "../src/internal/flattenJson.ts";
import { hrefIn } from "../src/internal/hrefIn.ts";
import { isRouteStateOf } from "../src/internal/isRouteStateOf.ts";
import { jsonSchemaOf } from "../src/internal/jsonSchemaOf.ts";
import { matchUrl } from "../src/internal/matchUrl.ts";
import { messageFor } from "../src/internal/messageFor.ts";
import { needsBare } from "../src/internal/needsBare.ts";
import { nodeAt } from "../src/internal/nodeAt.ts";
import { notFound } from "../src/internal/notFound.ts";
import { parseSearch } from "../src/internal/parseSearch.ts";
import { patternKey } from "../src/internal/patternKey.ts";
import { runGuard } from "../src/internal/runGuard.ts";
import { runLoaders } from "../src/internal/runLoaders.ts";
import { splitUrl } from "../src/internal/splitUrl.ts";
import { unexpected } from "../src/internal/unexpected.ts";
import { unwrapNode } from "../src/internal/unwrapNode.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { routesArtifact } from "../src/routesArtifact.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const ctx = createCtx({ mode: "sim", seed: 1337 });
const view = (): Node => document.createComment("");
const fail = (fn: () => unknown): { code: string; message: string } => {
  try {
    fn();
  } catch (e) {
    if (e instanceof Error && "code" in e && typeof e.code === "string") return { code: e.code, message: e.message };
  }
  return { code: "none", message: "" };
};
const table = (routes: Record<string, RouteDef>): readonly Located[] => compileTable(compileRoutes(routes), routes);

const str = (min: number, max?: number): SchemaNode => ({ kind: "string", min, max });
const obj = (fields: Record<string, SchemaNode>): SchemaNode => ({ kind: "object", fields });

describe("messageFor", () => {
  it("fixed messages per rule", () => {
    const m = (rule: Parameters<typeof messageFor>[1], n?: SchemaNode): string => messageFor(n, rule);
    expect(m("required")).toBe("Required");
    expect(m("nullable-absent")).toBe("Required");
    expect(m("optional-null")).toBe("Must not be null");
    expect(m("finite")).toBe("Must be a finite number");
    expect(m("int")).toBe("Must be a whole number");
    expect(m("discriminant")).toBe("Invalid choice");
  });

  it("min: string constraint with pluralisation, else Required", () => {
    expect(messageFor(str(1), "min")).toBe("Must be at least 1 character");
    expect(messageFor(str(0), "min")).toBe("Must be at least 0 characters");
    expect(messageFor(str(3), "min")).toBe("Must be at least 3 characters");
    expect(messageFor({ kind: "optional", inner: str(2) }, "min")).toBe("Must be at least 2 characters");
    expect(messageFor({ kind: "int" }, "min")).toBe("Required");
    expect(messageFor(undefined, "min")).toBe("Required");
  });

  it("max: string with a max, else Too long", () => {
    expect(messageFor(str(0, 1), "max")).toBe("Must be at most 1 character");
    expect(messageFor(str(0, 5), "max")).toBe("Must be at most 5 characters");
    expect(messageFor(str(0), "max")).toBe("Too long");
    expect(messageFor({ kind: "int" }, "max")).toBe("Too long");
    expect(messageFor(undefined, "max")).toBe("Too long");
  });

  it("literal and enum name the allowed values", () => {
    expect(messageFor({ kind: "literal", value: "x" }, "literal")).toBe('Must be "x"');
    expect(messageFor({ kind: "literal", value: 3 }, "literal")).toBe("Must be 3");
    expect(messageFor({ kind: "int" }, "literal")).toBe("Invalid value");
    expect(messageFor(undefined, "literal")).toBe("Invalid value");
    expect(messageFor({ kind: "enum", values: ["a", "b"] }, "enum")).toBe("Must be one of: a, b");
    expect(messageFor({ kind: "int" }, "enum")).toBe("Invalid choice");
    expect(messageFor(undefined, "enum")).toBe("Invalid choice");
  });

  it("type: text by node kind", () => {
    expect(messageFor({ kind: "number" }, "type")).toBe("Must be a number");
    expect(messageFor({ kind: "int" }, "type")).toBe("Must be a number");
    expect(messageFor({ kind: "boolean" }, "type")).toBe("Must be true or false");
    expect(messageFor(str(0), "type")).toBe("Must be text");
    expect(messageFor({ kind: "id", brand: "X" }, "type")).toBe("Must be text");
    expect(messageFor({ kind: "enum", values: ["a", "b"] }, "type")).toBe("Must be one of: a, b");
    expect(messageFor({ kind: "array", item: { kind: "int" } }, "type")).toBe("Invalid value");
    expect(messageFor(undefined, "type")).toBe("Invalid value");
    expect(messageFor({ kind: "nullable", inner: { kind: "boolean" } }, "type")).toBe("Must be true or false");
  });
});

describe("nodeAt", () => {
  const root = obj({
    name: str(0),
    tags: { kind: "array", item: { kind: "int" } },
    map: { kind: "record", value: { kind: "boolean" } },
    opt: { kind: "optional", inner: obj({ deep: { kind: "number" } }) },
    u: {
      kind: "union",
      key: "t",
      variants: [obj({ t: { kind: "literal", value: "a" }, x: { kind: "int" } }), { kind: "int" }, obj({ y: str(1) })],
    },
  });
  it("empty path is the root; objects resolve own fields only", () => {
    expect(nodeAt(root, [])).toBe(root);
    expect(nodeAt(root, ["name"])).toEqual(str(0));
    expect(nodeAt(root, ["missing"])).toBeUndefined();
    expect(nodeAt(root, ["toString"])).toBeUndefined();
    expect(nodeAt(root, ["name", "x"])).toBeUndefined();
  });
  it("arrays accept canonical indexes only", () => {
    expect(nodeAt(root, ["tags", 0])).toEqual({ kind: "int" });
    expect(nodeAt(root, ["tags", "12"])).toEqual({ kind: "int" });
    expect(nodeAt(root, ["tags", "01"])).toBeUndefined();
    expect(nodeAt(root, ["tags", "-1"])).toBeUndefined();
    expect(nodeAt(root, ["tags", "a"])).toBeUndefined();
    expect(nodeAt(root, ["tags", "1x"])).toBeUndefined();
    expect(nodeAt(root, ["tags", "x1"])).toBeUndefined();
  });
  it("records take any non-empty key", () => {
    expect(nodeAt(root, ["map", "k"])).toEqual({ kind: "boolean" });
    expect(nodeAt(root, ["map", ""])).toBeUndefined();
  });
  it("optional wrappers unwrap, union finds the variant with the field", () => {
    expect(nodeAt(root, ["opt", "deep"])).toEqual({ kind: "number" });
    expect(nodeAt(root, ["u", "x"])).toEqual({ kind: "int" });
    expect(nodeAt(root, ["u", "y"])).toEqual(str(1));
    expect(nodeAt(root, ["u", "z"])).toBeUndefined();
    expect(nodeAt(root, ["u", "toString"])).toBeUndefined();
  });
  it("a miss stays a miss deeper in the path", () => {
    expect(nodeAt(root, ["missing", "a", "b"])).toBeUndefined();
    expect(nodeAt(root, ["tags", "a", "b"])).toBeUndefined();
  });
});

describe("jsonSchemaOf", () => {
  const sortedKeys = (v: unknown): string => JSON.stringify(v);
  it("scalars", () => {
    expect(jsonSchemaOf(str(2))).toEqual({ minLength: 2, type: "string" });
    expect(jsonSchemaOf(str(2, 4))).toEqual({ maxLength: 4, minLength: 2, type: "string" });
    expect(jsonSchemaOf(str(0, 0))).toEqual({ maxLength: 0, minLength: 0, type: "string" });
    expect(jsonSchemaOf({ kind: "number" })).toEqual({ type: "number" });
    expect(jsonSchemaOf({ kind: "int" })).toEqual({ type: "integer" });
    expect(jsonSchemaOf({ kind: "boolean" })).toEqual({ type: "boolean" });
    expect(jsonSchemaOf({ kind: "literal", value: "q" })).toEqual({ const: "q" });
    expect(jsonSchemaOf({ kind: "enum", values: ["b", "a"] })).toEqual({ enum: ["b", "a"], type: "string" });
    expect(jsonSchemaOf({ kind: "id", brand: "U" })).toEqual({ minLength: 1, type: "string", "x-keel-id": "U" });
  });
  it("keys are sorted in the serialised form", () => {
    expect(sortedKeys(jsonSchemaOf(str(2, 4)))).toBe('{"maxLength":4,"minLength":2,"type":"string"}');
    expect(sortedKeys(jsonSchemaOf({ kind: "id", brand: "U" }))).toBe(
      '{"minLength":1,"type":"string","x-keel-id":"U"}',
    );
  });
  it("composites", () => {
    const o = obj({ z: { kind: "int" }, a: { kind: "optional", inner: { kind: "boolean" } }, m: str(0) });
    expect(jsonSchemaOf(o)).toEqual({
      properties: { a: { type: "boolean" }, m: { minLength: 0, type: "string" }, z: { type: "integer" } },
      required: ["m", "z"],
      type: "object",
    });
    expect(sortedKeys(jsonSchemaOf(o))).toBe(
      '{"properties":{"a":{"type":"boolean"},"m":{"minLength":0,"type":"string"},"z":{"type":"integer"}},"required":["m","z"],"type":"object"}',
    );
    expect(jsonSchemaOf({ kind: "array", item: { kind: "int" } })).toEqual({
      items: { type: "integer" },
      type: "array",
    });
    expect(jsonSchemaOf({ kind: "record", value: { kind: "int" } })).toEqual({
      additionalProperties: { type: "integer" },
      type: "object",
    });
    expect(jsonSchemaOf({ kind: "union", key: "k", variants: [{ kind: "int" }, { kind: "boolean" }] })).toEqual({
      oneOf: [{ type: "integer" }, { type: "boolean" }],
    });
    expect(jsonSchemaOf({ kind: "nullable", inner: { kind: "int" } })).toEqual({
      anyOf: [{ type: "integer" }, { type: "null" }],
    });
    expect(jsonSchemaOf({ kind: "optional", inner: { kind: "int" } })).toEqual({ type: "integer" });
  });
});

describe("splitUrl", () => {
  it("splits path, query, hash", () => {
    expect(splitUrl("/a/b?x=1&y=2#frag")).toEqual({ path: "/a/b", query: "x=1&y=2", hash: "frag" });
    expect(splitUrl("/ab#x")).toEqual({ path: "/ab", query: "", hash: "x" });
    expect(splitUrl("/ab?x")).toEqual({ path: "/ab", query: "x", hash: "" });
    expect(splitUrl("/p#a?b")).toEqual({ path: "/p", query: "", hash: "a?b" });
    expect(splitUrl("/p?a#b#c")).toEqual({ path: "/p", query: "a", hash: "b#c" });
    expect(splitUrl("/")).toEqual({ path: "/", query: "", hash: "" });
  });
  it("an empty path becomes /", () => {
    expect(splitUrl("?q=1")).toEqual({ path: "/", query: "q=1", hash: "" });
    expect(splitUrl("#h")).toEqual({ path: "/", query: "", hash: "h" });
    expect(splitUrl("")).toEqual({ path: "/", query: "", hash: "" });
    expect(splitUrl("http://host")).toEqual({ path: "/", query: "", hash: "" });
  });
  it("strips only a leading scheme://authority", () => {
    expect(splitUrl("http://host:80/p?q#h")).toEqual({ path: "/p", query: "q", hash: "h" });
    expect(splitUrl("ab://h/p")).toEqual({ path: "/p", query: "", hash: "" });
    expect(splitUrl("a1+b.c-d://h/p")).toEqual({ path: "/p", query: "", hash: "" });
    expect(splitUrl("http://h?q=1")).toEqual({ path: "/", query: "q=1", hash: "" });
    expect(splitUrl("http://h#z")).toEqual({ path: "/", query: "", hash: "z" });
    expect(splitUrl("1a://h/p").path).toBe("1a://h/p");
    expect(splitUrl("-a://h/p").path).toBe("-a://h/p");
    expect(splitUrl("/x?u=http://evil/z")).toEqual({ path: "/x", query: "u=http://evil/z", hash: "" });
    expect(splitUrl("/x/http://evil/z").path).toBe("/x/http://evil/z");
  });
  it("property: recomposing the parts gives back a root-relative url", () => {
    const seg = fc.stringMatching(/^[a-z0-9/]{0,8}$/);
    const part = fc.stringMatching(/^[a-z0-9=&]{0,8}$/);
    fc.assert(
      fc.property(seg, part, part, (p, q, h) => {
        const url = `/${p}${q === "" ? "" : `?${q}`}${h === "" ? "" : `#${h}`}`;
        expect(splitUrl(url)).toEqual({ path: `/${p}`, query: q, hash: h });
      }),
    );
  });
});

describe("compilePath", () => {
  it("root and params", () => {
    expect(compilePath("r", "/")).toEqual([]);
    expect(compilePath("r", "/a/:b_1/c")).toEqual([
      { kind: "static", text: "a" },
      { kind: "param", name: "b_1" },
      { kind: "static", text: "c" },
    ]);
  });
  it("rejects malformed paths with E1503 and the exact message", () => {
    expect(fail(() => compilePath("r", "a"))).toEqual({
      code: "E1503",
      message: 'E1503 r: path "a" must start with "/" and not end with one',
    });
    expect(fail(() => compilePath("r", "/a/")).code).toBe("E1503");
    expect(fail(() => compilePath("r", "")).code).toBe("E1503");
    expect(fail(() => compilePath("r", "/:1x"))).toEqual({
      code: "E1503",
      message: 'E1503 r: bad param name ":1x" in "/:1x"',
    });
    expect(fail(() => compilePath("r", "/:"))).toEqual({
      code: "E1503",
      message: 'E1503 r: bad param name ":" in "/:"',
    });
    expect(fail(() => compilePath("r", "/a//b"))).toEqual({
      code: "E1503",
      message: 'E1503 r: bad segment "" in "/a//b" (no empty segments or wildcards)',
    });
    expect(fail(() => compilePath("r", "/a*")).message).toBe(
      'E1503 r: bad segment "a*" in "/a*" (no empty segments or wildcards)',
    );
    expect(fail(() => compilePath("r", "/a?b")).code).toBe("E1503");
    expect(fail(() => compilePath("r", "/a#b")).code).toBe("E1503");
    expect(fail(() => compilePath("r", "/*")).code).toBe("E1503");
  });
});

describe("codedError / unexpected / notFound / patternKey / unwrapNode / fieldsOf", () => {
  it("shapes", () => {
    const e = codedError("E1500", "msg");
    expect(e.message).toBe("E1500 msg");
    expect(e.code).toBe("E1500");
    expect(unexpected("boom")).toEqual({ code: "keel.unexpected", message: "boom", data: {} });
    expect(notFound("/x")).toEqual({ code: "keel.notFound", message: "keel.notFound", data: { url: "/x" } });
    expect(patternKey([])).toBe("/");
    expect(
      patternKey([
        { kind: "static", text: "a" },
        { kind: "param", name: "zz" },
      ]),
    ).toBe("/a/:");
    expect(unwrapNode({ kind: "optional", inner: { kind: "nullable", inner: { kind: "int" } } })).toEqual({
      kind: "int",
    });
    expect(unwrapNode({ kind: "nullable", inner: { kind: "int" } })).toEqual({ kind: "int" });
    expect(unwrapNode({ kind: "int" })).toEqual({ kind: "int" });
    expect(fieldsOf(obj({ a: { kind: "int" } }))).toEqual([["a", { kind: "int" }]]);
    expect(fieldsOf({ kind: "int" })).toEqual([]);
  });
});

describe("flattenJson", () => {
  it("flattens like decodeStrings reads", () => {
    const out: [string, string][] = [];
    flattenJson("", { a: 1, b: { c: "x", d: [true, false] }, e: null, f: [{ g: 1 }] }, out);
    expect(out).toEqual([
      ["a", "1"],
      ["b.c", "x"],
      ["b.d", "true"],
      ["b.d", "false"],
      ["e", ""],
      ["f.g", "1"],
    ]);
    const top: [string, string][] = [];
    flattenJson("k", "v", top);
    flattenJson("k", [], top);
    flattenJson("k", {}, top);
    expect(top).toEqual([["k", "v"]]);
    const bare: [string, string][] = [];
    flattenJson("", "s", bare);
    expect(bare).toEqual([["", "s"]]);
  });
});

describe("isRouteStateOf", () => {
  const routes = { a: 1 };
  it("needs an object with id and pending, id null or an own route key", () => {
    expect(isRouteStateOf(routes, { id: null, pending: false })).toBe(true);
    expect(isRouteStateOf(routes, { id: "a", pending: false })).toBe(true);
    expect(isRouteStateOf(routes, { id: "b", pending: false })).toBe(false);
    expect(isRouteStateOf(routes, { id: "toString", pending: false })).toBe(false);
    expect(isRouteStateOf(routes, { id: 3, pending: false })).toBe(false);
    expect(isRouteStateOf(routes, { id: "a" })).toBe(false);
    expect(isRouteStateOf(routes, { pending: false })).toBe(false);
    expect(isRouteStateOf(routes, null)).toBe(false);
    expect(isRouteStateOf(routes, "a")).toBe(false);
    expect(isRouteStateOf(routes, undefined)).toBe(false);
  });
});

describe("needsBare", () => {
  const lvl = (extra: Partial<Exclude<RouteDef, { readonly api: true }>>): Level => ({
    id: "x",
    def: { component: view, ...extra },
  });
  const ld = loader({ output: s.object({}) }, async () => ok({}));
  it("only levels above the error level count", () => {
    const chain = [lvl({}), lvl({ loader: ld }), lvl({})];
    expect(needsBare(chain, 0)).toBe(false);
    expect(needsBare(chain, 1)).toBe(false);
    expect(needsBare(chain, 2)).toBe(true);
    expect(needsBare(chain, 99)).toBe(true);
    expect(needsBare(chain, -1)).toBe(false);
    expect(needsBare([lvl({ loader: ld })], -1)).toBe(false);
    expect(needsBare([lvl({ loader: ld })], 0)).toBe(false);
    expect(needsBare([lvl({ guard: guard({ redirect: "x" }, async () => ok(null)) }), lvl({})], 1)).toBe(true);
    expect(needsBare([lvl({}), lvl({})], 5)).toBe(false);
  });
});

describe("chainOf / compileRoutes messages", () => {
  it("chain is layouts outermost first then the route", () => {
    const routes = {
      "c.a": { component: view } satisfies RouteDef,
      "c.b": { component: view, layout: "c.a" } satisfies RouteDef,
      "c.p": { path: "/c", component: view, layout: "c.b" } satisfies RouteDef,
    };
    expect(chainOf("c.p", routes["c.p"], routes).map((l) => l.id)).toEqual(["c.a", "c.b", "c.p"]);
    expect(chainOf("c.a", routes["c.a"], routes).map((l) => l.id)).toEqual(["c.a"]);
  });
  it("exact E1506 messages", () => {
    const base = { component: view };
    const cyc = { x: { ...base, layout: "y" }, y: { ...base, layout: "x" } };
    expect(fail(() => chainOf("x", cyc.x, cyc)).message).toBe('E1506 x: layout cycle through "x"');
    const self = { x: { ...base, layout: "x" } };
    expect(fail(() => chainOf("x", self.x, self)).message).toBe('E1506 x: layout cycle through "x"');
    const unk = { x: { ...base, layout: "nope" } };
    expect(fail(() => chainOf("x", unk.x, unk)).message).toBe('E1506 x: unknown layout "nope"');
    const proto = { x: { ...base, layout: "toString" } };
    expect(fail(() => chainOf("x", proto.x, proto)).message).toBe('E1506 x: unknown layout "toString"');
    const withPath = { l: { ...base, path: "/l" }, x: { ...base, layout: "l" } };
    expect(fail(() => chainOf("x", withPath.x, withPath)).message).toBe(
      'E1506 x: layout "l" has a path; a layout has none',
    );
  });
  it("exact messages for the other codes", () => {
    const P = s.object({ id: s.id("X") });
    const dup = {
      a: { path: "/v/:id", params: P, component: view },
      b: { path: "/v/:other", params: s.object({ other: s.string() }), component: view },
    };
    expect(fail(() => compileRoutes(dup)).message).toBe('E1502 b: path pattern "/v/:" is also a');
    expect(fail(() => compileRoutes({ a: { path: "/v/:id", component: view } })).message).toBe(
      'E1503 a: ":id" has no params field',
    );
    expect(fail(() => compileRoutes({ a: { path: "/v", params: P, component: view } })).message).toBe(
      'E1503 a: params field "id" not in path',
    );
    expect(
      fail(() => compileRoutes({ a: { path: "/v", search: s.object({ q: s.string() }), component: view } })).message,
    ).toBe('E1504 a: search field "q" must be optional');
    const inEntry = { a: { path: "/v", component: view, actions: { POST: {} } } };
    expect(fail(() => Reflect.apply(compileRoutes, undefined, [inEntry])).message).toBe(
      'E1505 a: move actions to routes.actions({ "a": {...} }) after the manifest',
    );
  });
  it("layouts have no segments and are not routable", () => {
    const t = compileRoutes({ l: { component: view }, p: { path: "/p", component: view, layout: "l" } });
    expect(t.get("l")?.segments).toBeNull();
    expect(t.get("p")?.segments).toEqual([{ kind: "static", text: "p" }]);
    expect(table({ l: { component: view } })).toEqual([]);
  });
});

describe("parseSearch", () => {
  const schema = s.object({
    n: s.int().optional(),
    t: s.string({ min: 1 }).optional(),
    tags: s.array(s.string()).optional(),
    o: s.object({ x: s.int() }).optional(),
  });
  it("no schema: empty", () => {
    expect(parseSearch(undefined, "n=1")).toEqual({});
  });
  it("keeps valid declared keys, drops undeclared and failing keys", () => {
    expect(parseSearch(schema, "n=1&t=a&zz=9")).toEqual({ n: 1, t: "a" });
    expect(parseSearch(schema, "n=abc&t=a")).toEqual({ t: "a" });
    expect(parseSearch(schema, "n=abc&t=")).toEqual({});
    expect(parseSearch(schema, "")).toEqual({});
  });
  it("repeated keys and nested keys", () => {
    expect(parseSearch(schema, "tags=a&tags=b")).toEqual({ tags: ["a", "b"] });
    expect(parseSearch(schema, "o.x=3")).toEqual({ o: { x: 3 } });
    expect(parseSearch(schema, "o.x=bad&n=2")).toEqual({ n: 2 });
    expect(parseSearch(schema, "n=2&o.y=1")).toEqual({ n: 2 });
  });
  it("drops several bad keys across rounds", () => {
    const wide = s.object({
      a: s.int().optional(),
      b: s.int().optional(),
      c: s.int().optional(),
      d: s.int().optional(),
    });
    expect(parseSearch(wide, "a=x&b=y&c=z&d=4")).toEqual({ d: 4 });
    expect(parseSearch(wide, "a=x&b=y&c=z&d=w")).toEqual({});
  });
});

describe("matchUrl", () => {
  const routes: Record<string, RouteDef> = {
    root: { path: "/", component: view },
    "u.list": { path: "/u", component: view, search: s.object({ q: s.string({ min: 1 }).optional() }) },
    "u.me": { path: "/u/me", component: view },
    "u.show": { path: "/u/:id", params: s.object({ id: s.int() }), component: view },
    "u.deep": { path: "/u/:id/x/:k", params: s.object({ id: s.int(), k: s.string() }), component: view },
  };
  const t = table(routes);
  const idOf = (u: string): string | null => {
    const m = matchUrl(t, u);
    return m.kind === "route" ? m.route.id : null;
  };
  it("static beats param; segment counts must agree", () => {
    expect(idOf("/")).toBe("root");
    expect(idOf("/u")).toBe("u.list");
    expect(idOf("/u/me")).toBe("u.me");
    expect(idOf("/u/7")).toBe("u.show");
    expect(idOf("/u/7/x/k")).toBe("u.deep");
    expect(idOf("/u/7/x")).toBeNull();
    expect(idOf("/nope")).toBeNull();
    expect(idOf("/u/7/y/k")).toBeNull();
  });
  it("static wins whichever order the table lists them in", () => {
    expect(idOf("/u/me")).toBe("u.me");
    const rev = [...t].reverse();
    const m = matchUrl(rev, "/u/me");
    expect(m.kind === "route" && m.route.id).toBe("u.me");
  });
  it("equal rank keeps the first listed route", () => {
    const a: Located = { id: "first", def: { component: view }, chain: [], segments: [{ kind: "param", name: "p" }] };
    const b: Located = { ...a, id: "second", segments: [{ kind: "param", name: "q" }] };
    const m = matchUrl([a, b], "/zz");
    expect(m.kind === "route" && m.route.id).toBe("first");
  });
  it("canonical url drops trailing slashes and keeps query and hash", () => {
    expect(matchUrl(t, "/u/").url).toBe("/u");
    expect(matchUrl(t, "/u//").url).toBe("/u");
    expect(matchUrl(t, "//").url).toBe("/");
    expect(matchUrl(t, "/").url).toBe("/");
    expect(matchUrl(t, "/u/?q=a#h").url).toBe("/u?q=a#h");
    expect(matchUrl(t, "/u#h").url).toBe("/u#h");
    expect(matchUrl(t, "/u?q=a").url).toBe("/u?q=a");
    expect(matchUrl(t, "http://h/u/7?q=1#z").url).toBe("/u/7?q=1#z");
    expect(matchUrl(t, "?q=1").url).toBe("/?q=1");
    expect(matchUrl(t, "").url).toBe("/");
  });
  it("params are decoded then parsed; failures and bad escapes are notFound", () => {
    const m = matchUrl(t, "/u/5/x/a%20b");
    expect(m.kind === "route" && m.params).toEqual({ id: 5, k: "a b" });
    const bad = matchUrl(t, "/u/abc");
    expect(bad.kind).toBe("notFound");
    expect(bad.route?.id).toBe("u.show");
    expect(bad.url).toBe("/u/abc");
    const esc = matchUrl(t, "/u/%E0%A4%A");
    expect(esc).toEqual({ kind: "notFound", url: "/u/%E0%A4%A", route: null });
    const none = matchUrl(t, "/nope?z=1");
    expect(none).toEqual({ kind: "notFound", url: "/nope?z=1", route: null });
  });
  it("an empty param segment does not fit", () => {
    expect(idOf("/u//x/k")).toBeNull();
    expect(idOf("/u/7/x/")).toBeNull();
  });
  it("search is parsed by the route's schema, no params gives {}", () => {
    const m = matchUrl(t, "/u?q=hi&z=1");
    expect(m.kind === "route" && m.search).toEqual({ q: "hi" });
    expect(m.kind === "route" && m.params).toEqual({});
    const r = matchUrl(t, "/?q=hi");
    expect(r.kind === "route" && r.search).toEqual({});
  });
});

describe("hrefIn", () => {
  const routes = manifest({
    "h.root": { path: "/", component: view },
    "h.layout": { component: view },
    "h.item": {
      path: "/h/:id/:flag",
      params: s.object({ id: s.int(), flag: s.boolean() }),
      search: s.object({
        b: s.string().optional(),
        a: s.array(s.int()).optional(),
        c: s.object({ z: s.int(), y: s.string() }).optional(),
        d: s.enum(["x y", "&"]).optional(),
      }),
      component: view,
    },
    "h.plain": { path: "/plain/seg", component: view },
    "h.name": { path: "/n/:v", params: s.object({ v: s.string() }), component: view },
  });
  const tbl = compileRoutes(routes.routes);
  const h = (id: string, p: Record<string, unknown> = {}, q: Record<string, unknown> = {}): string =>
    hrefIn(tbl, id, p, q);
  it("builds paths, sorts search keys, keeps repeated-key order, omits absent optionals", () => {
    expect(h("h.root")).toBe("/");
    expect(h("h.plain")).toBe("/plain/seg");
    expect(h("h.item", { id: 4, flag: true })).toBe("/h/4/true");
    expect(h("h.item", { id: 4, flag: false })).toBe("/h/4/false");
    expect(h("h.item", { id: 4, flag: true }, { b: "x", a: [3, 1, 2] })).toBe("/h/4/true?a=3&a=1&a=2&b=x");
    expect(h("h.item", { id: 4, flag: true }, { b: undefined, a: undefined })).toBe("/h/4/true");
    expect(h("h.item", { id: 4, flag: true }, { c: { z: 1, y: "q" }, b: "m" })).toBe("/h/4/true?b=m&c.y=q&c.z=1");
    expect(h("h.item", { id: 4, flag: true }, { d: "x y" })).toBe("/h/4/true?d=x%20y");
    expect(h("h.item", { id: 4, flag: true }, { d: "&" })).toBe("/h/4/true?d=%26");
    expect(h("h.name", { v: "a/b c" })).toBe("/n/a%2Fb%20c");
  });
  it("exact error codes and messages", () => {
    expect(fail(() => h("h.layout"))).toEqual({
      code: "E1501",
      message: 'E1501 href("h.layout"): no declared page has this id',
    });
    expect(fail(() => h("nope")).code).toBe("E1501");
    expect(fail(() => hrefIn(undefined, "nope", {}, {})).code).toBe("E1501");
    expect(fail(() => h("h.plain", {}, { z: 1 }))).toEqual({
      code: "E1504",
      message: 'E1504 href("h.plain"): the route declares no search',
    });
    expect(h("h.plain", {}, { z: undefined })).toBe("/plain/seg");
  });
  it("a param that does not encode to a scalar is E1503", () => {
    const r = compileRoutes({
      "w.a": {
        path: "/w/:v",
        params: s.object({ v: s.array(s.int()) }),
        component: view,
      },
    });
    expect(fail(() => hrefIn(r, "w.a", { v: [1] }, {}))).toEqual({
      code: "E1503",
      message: 'E1503 href("w.a"): param "v" does not encode to a path segment',
    });
  });
});

describe("routesArtifact details", () => {
  it("module is the first dotted segment, path null for layouts, actions in verb order, guard and layout names", () => {
    const act = {
      kind: "keel.action" as const,
      input: s.object({}),
      run: async () => ok(null),
    };
    const m = manifest({
      "z.b.deep": { path: "/zb", component: view },
      plain: { path: "/plain-art", component: view },
    });
    m.actions({ "z.b.deep": { PUT: act, POST: act, PATCH: act, DELETE: act } });
    const a = routesArtifact(m);
    expect(Object.keys(a)).toEqual(["plain", "z.b.deep"]);
    expect(a.plain?.module).toBe("plain");
    expect(a["z.b.deep"]?.module).toBe("z");
    expect(a["z.b.deep"]?.actions).toEqual(["DELETE", "PATCH", "POST", "PUT"]);
    expect(a["z.b.deep"]?.guard).toBeNull();
    expect(a["z.b.deep"]?.layout).toBeNull();
    expect(a["z.b.deep"]?.params).toBeNull();
    expect(a["z.b.deep"]?.search).toBeNull();
    expect(a.plain?.actions).toEqual([]);
  });
});

describe("runLoaders / runGuard", () => {
  const lvl = (def: Partial<Exclude<RouteDef, { readonly api: true }>>): Level => ({
    id: "l",
    def: { component: view, ...def },
  });
  const args = { params: {}, search: {}, url: "http://localhost/", caller: "" };
  it("no loader gives ok(undefined); a loader's value is parsed by its output schema", async () => {
    const out = await runLoaders(
      [lvl({}), lvl({ loader: loader({ output: s.object({ n: s.int() }) }, async () => ok({ n: 1 })) })],
      args,
      ctx,
    );
    expect(out).toEqual([ok(undefined), ok({ n: 1 })]);
  });
  it("a loader's err passes through; a throw is keel.unexpected; bad data is E1554", async () => {
    const E = s.error("rl.bad", s.object({}));
    const out = await runLoaders(
      [
        lvl({ loader: loader({ output: s.object({}) }, async () => err(E.make({}))) }),
        lvl({
          loader: loader({ output: s.object({}) }, async () => {
            throw new Error("kaboom");
          }),
        }),
        lvl({ loader: loader({ output: s.object({ n: s.int({ min: 10 }) }) }, async () => ok({ n: 1 })) }),
      ],
      args,
      ctx,
    );
    const [a, b, c] = out;
    expect(a?.ok === false && a.error.code).toBe("rl.bad");
    expect(b?.ok === false && b.error.code).toBe("keel.unexpected");
    expect(c).toEqual(err(unexpected("E1554 loader data fails its output schema")));
  });
  it("loaders start concurrently in chain order", async () => {
    const order: string[] = [];
    const mk = (n: string) =>
      lvl({
        loader: loader({ output: s.object({}) }, async () => {
          order.push(`start ${n}`);
          await Promise.resolve();
          order.push(`end ${n}`);
          return ok({});
        }),
      });
    await runLoaders([mk("a"), mk("b")], args, ctx);
    expect(order).toEqual(["start a", "start b", "end a", "end b"]);
  });
  it("runGuard passes ok and denied through and turns a throw into an err", async () => {
    const D = s.error("keel.denied", s.object({}));
    const yes = guard({ redirect: "x" }, async () => ok(null));
    const no = guard({ redirect: "x" }, async () => err(D.make({})));
    const boom = guard({ redirect: "x" }, async () => {
      throw new Error("bang");
    });
    expect(await runGuard(yes, "/u", ctx, "")).toEqual(ok(null));
    const denied = await runGuard(no, "/u", ctx, "");
    expect(denied.ok === false && denied.error.code).toBe("keel.denied");
    const thrown = await runGuard(boom, "/u", ctx, "");
    expect(thrown.ok === false && thrown.error.code).toBe("keel.unexpected");
  });
  it("runGuard hands the url and the caller to the guard", async () => {
    const seen: string[] = [];
    const g = guard({ redirect: "x" }, async (req) => {
      seen.push(req.url, req.caller);
      return ok(null);
    });
    await runGuard(g, "/the/url?x=1", ctx, "");
    await runGuard(g, "/u", ctx, "c4ll3r");
    expect(seen).toEqual(["/the/url?x=1", "", "/u", "c4ll3r"]);
  });
});

describe("fieldsError", () => {
  const input = s.object({ name: s.string({ min: 2 }), n: s.int(), tags: s.array(s.string({ max: 3 })) });
  it("maps each failing path to its message, first issue per path wins", () => {
    const r = input.decodeStrings(
      new URLSearchParams([
        ["name", "a"],
        ["n", "x"],
        ["tags", "abcdef"],
      ]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const e = fieldsError(input.node, r.error);
    expect(e.code).toBe("keel.fields");
    expect(e.message).toBe("keel.fields");
    expect(Object.keys(e.data).sort()).toEqual(r.error.data.issues.map((i) => pathToString(i.path)).sort());
    expect(e.data.name).toBe("Must be at least 2 characters");
    expect(e.data.n).toBe("Must be a number");
  });
  it("first issue wins on a repeated path", () => {
    const e = fieldsError(input.node, {
      code: "schema.invalid",
      message: "m",
      data: {
        issues: [
          { path: ["name"], rule: "min" },
          { path: ["name"], rule: "required" },
        ],
      },
    });
    expect(e.data).toEqual({ name: "Must be at least 2 characters" });
  });
});
