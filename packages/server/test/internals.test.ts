// @vitest-environment happy-dom
// Unit and property tests (seed 1337) for the pure internals of the request flow.
import { guard } from "@keel/router";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { codedError } from "../src/internal/codedError.ts";
import { compileTable } from "../src/internal/compileTable.ts";
import { devMessageOf } from "../src/internal/devMessageOf.ts";
import { diagLine } from "../src/internal/diagLine.ts";
import { documentHtml } from "../src/internal/documentHtml.ts";
import { encodeOr } from "../src/internal/encodeOr.ts";
import { escapeHtml } from "../src/internal/escapeHtml.ts";
import { fieldSummary } from "../src/internal/fieldSummary.ts";
import { fieldsError } from "../src/internal/fieldsError.ts";
import { fieldsOf } from "../src/internal/fieldsOf.ts";
import { isGuard } from "../src/internal/isGuard.ts";
import { matchPath } from "../src/internal/matchPath.ts";
import { messageFor } from "../src/internal/messageFor.ts";
import { nearestErrorElement } from "../src/internal/nearestErrorElement.ts";
import { needsBare } from "../src/internal/needsBare.ts";
import { nodeAt } from "../src/internal/nodeAt.ts";
import { notFound } from "../src/internal/notFound.ts";
import { parseSearch } from "../src/internal/parseSearch.ts";
import { publicError } from "../src/internal/publicError.ts";
import { reqLine } from "../src/internal/reqLine.ts";
import { selectDeployable } from "../src/internal/selectDeployable.ts";
import { stateJson } from "../src/internal/stateJson.ts";
import { statusOf } from "../src/internal/statusOf.ts";
import { stringRecord } from "../src/internal/stringRecord.ts";
import { toHtml } from "../src/internal/toHtml.ts";
import { toRecord } from "../src/internal/toRecord.ts";
import { unwrapNode } from "../src/internal/unwrapNode.ts";
import { valuesOf } from "../src/internal/valuesOf.ts";
import { topology } from "../src/topology.ts";

const SEED = 1337;
const p = (): Node => document.createElement("p");
const loaderStub = { kind: "keel.loader" as const, output: s.object({}), run: () => Promise.resolve(ok({})) };

describe("matchPath", () => {
  const table = compileTable({
    "o.shell": { component: p },
    "o.root": { path: "/", component: p },
    "o.new": { path: "/orders/new", component: p, layout: "o.shell" },
    "o.show": { path: "/orders/:id", params: s.object({ id: s.int({ min: 1 }) }), component: p },
    "o.list": { path: "/orders", search: s.object({ tab: s.enum(["a", "b"]).optional() }), component: p },
  });

  it("a static segment beats :param in either declaration order; chains list layouts first", () => {
    const m = matchPath(table, "/orders/new", "");
    expect(m).toMatchObject({ kind: "route", route: { id: "o.new" } });
    expect(m.route?.chain.map((l) => l.id)).toEqual(["o.shell", "o.new"]);
    const rev = compileTable({
      "o.show": { path: "/orders/:id", component: p, params: s.object({ id: s.string() }) },
      "o.new": { path: "/orders/new", component: p },
    });
    expect(matchPath(rev, "/orders/new", "").route?.id).toBe("o.new");
    expect(matchPath(rev, "/orders/x", "").route?.id).toBe("o.show");
  });

  it("parses params, decodes segments, and drops failing search keys", () => {
    expect(matchPath(table, "/orders/7", "")).toEqual(
      expect.objectContaining({ kind: "route", params: { id: 7 }, search: {} }),
    );
    expect(matchPath(table, "/orders", "tab=b&x=1")).toMatchObject({ kind: "route", search: { tab: "b" } });
    expect(matchPath(table, "/", "")).toMatchObject({ kind: "route", route: { id: "o.root" } });
    expect(matchPath(table, "", "")).toMatchObject({ kind: "route", route: { id: "o.root" } });
  });

  it("notFound: params fail (route kept), no pattern, bad escapes, empty param", () => {
    expect(matchPath(table, "/orders/0", "")).toMatchObject({ kind: "notFound", route: { id: "o.show" } });
    expect(matchPath(table, "/nope", "")).toEqual({ kind: "notFound", route: null });
    expect(matchPath(table, "/orders/%E0%A4%A", "")).toEqual({ kind: "notFound", route: null });
    expect(matchPath(table, "/orders/", "")).toEqual({ kind: "notFound", route: null });
    expect(matchPath(table, "/orders/new/x", "")).toEqual({ kind: "notFound", route: null });
  });

  it("compileTable rejects an unknown layout or a cycle with E1506", () => {
    expect(() => compileTable({ "a.x": { path: "/x", component: p, layout: "a.missing" } })).toThrow(/^E1506/);
    expect(() =>
      compileTable({
        "a.l1": { component: p, layout: "a.l2" },
        "a.l2": { component: p, layout: "a.l1" },
        "a.x": { path: "/x", component: p, layout: "a.l1" },
      }),
    ).toThrow(/^E1506 a\.x: unknown layout or cycle/);
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

describe("selectDeployable", () => {
  const table = compileTable({
    "app.home": { path: "/", component: p },
    "orders.show": { path: "/orders/:id", params: s.object({ id: s.string() }), component: p },
    "shop.list": {
      path: "/shop",
      component: p,
      actions: { POST: { kind: "keel.action", input: s.object({}), run: () => ok(null) } },
    },
    "blog.list": { path: "/blog", component: p, loader: loaderStub },
  });
  const mods = new Set(["app", "orders", "shop", "blog"]);
  const t = (def: Parameters<typeof topology>[0]) => topology(def);

  it("E1552 messages", () => {
    expect(() => selectDeployable(t({ w: { modules: ["ghost"], adapter: "node" } }), table, mods, undefined)).toThrow(
      "E1552 deployable w names unknown module ghost",
    );
    expect(() =>
      selectDeployable(
        t({ w: { modules: ["app"], adapter: "node" }, v: { modules: ["app"], adapter: "node" } }),
        table,
        mods,
        "w",
      ),
    ).toThrow("E1552 module app is in deployables w and v");
    const two = t({ w: { modules: ["app"], adapter: "node" }, v: { modules: ["blog"], adapter: "node" } });
    expect(() => selectDeployable(two, table, mods, undefined)).toThrow("E1552 pass deployable: one of w, v");
    expect(() => selectDeployable(two, table, mods, "x")).toThrow("E1552 pass deployable: one of w, v, not x");
    expect(() => selectDeployable(t({}), table, mods, undefined)).toThrow("E1552 pass deployable: one of (none)");
  });

  it("serves the chosen deployable's routes; E1553 names params or actions", () => {
    const two = t({ w: { modules: ["app", "blog"], adapter: "static" }, v: { modules: ["orders"], adapter: "node" } });
    expect(selectDeployable(two, table, mods, "w").map((r) => r.id)).toEqual(["app.home", "blog.list"]);
    expect(selectDeployable(two, table, mods, "v").map((r) => r.id)).toEqual(["orders.show"]);
    expect(() => selectDeployable(t({ w: { modules: ["orders"], adapter: "static" } }), table, mods, "w")).toThrow(
      "E1553 static deployable w: route orders.show has params",
    );
    expect(() => selectDeployable(t({ w: { modules: ["shop"], adapter: "static" } }), table, mods, "w")).toThrow(
      "E1553 static deployable w: route shop.list has actions",
    );
    const bare = compileTable({ "x.y": { path: "/y/:id", component: p } });
    expect(() => selectDeployable(t({ s: { modules: ["x"], adapter: "static" } }), bare, new Set(["x"]), "s")).toThrow(
      /^E1553 .* has params$/,
    );
  });

  it("topology throws E1552 for a bad shape or an empty module list", () => {
    expect(() => topology({ w: { modules: [], adapter: "node" } })).toThrow("E1552 deployable w has no modules");
    expect(() => topology(JSON.parse('{"w":{"modules":[""],"adapter":"node"}}'))).toThrow(
      "E1552 invalid topology at w.modules.0",
    );
  });
});

describe("messages and fields", () => {
  const S = s.object({
    name: s.string({ min: 2, max: 5 }),
    free: s.string(),
    n: s.number(),
    i: s.int(),
    b: s.boolean(),
    lit: s.literal("x"),
    e: s.enum(["a", "b"]),
    id: s.id("Order"),
    opt: s.string({ min: 1 }).optional(),
    nul: s.int().nullable(),
    list: s.array(s.object({ q: s.int() })),
    rec: s.record(s.boolean()),
    u: s.union("t", [s.object({ t: s.literal("a"), x: s.int() }), s.object({ t: s.literal("b"), y: s.string() })]),
  });
  const at = (...path: (string | number)[]) => nodeAt(S.node, path);

  it("nodeAt walks objects, arrays, records, unions and wrappers", () => {
    expect(at("name")?.kind).toBe("string");
    expect(at("list", 0, "q")?.kind).toBe("int");
    expect(at("list", "x")).toBeUndefined();
    expect(at("list", "01")).toBeUndefined();
    expect(at("rec", "k")?.kind).toBe("boolean");
    expect(at("rec", "")).toBeUndefined();
    expect(at("u", "y")?.kind).toBe("string");
    expect(at("u", "z")).toBeUndefined();
    expect(at("opt")?.kind).toBe("optional");
    expect(at("missing")).toBeUndefined();
    expect(at("name", "deeper")).toBeUndefined();
    expect(at("missing", "deeper")).toBeUndefined();
    const optNode = at("opt");
    expect(optNode === undefined ? undefined : unwrapNode(optNode).kind).toBe("string");
    const nulNode = at("nul");
    expect(nulNode === undefined ? undefined : unwrapNode(nulNode).kind).toBe("int");
  });

  it("messageFor gives the rule plus constraint", () => {
    expect(messageFor(at("name"), "required")).toBe("Required");
    expect(messageFor(at("name"), "nullable-absent")).toBe("Required");
    expect(messageFor(at("name"), "optional-null")).toBe("Must not be null");
    expect(messageFor(at("n"), "finite")).toBe("Must be a finite number");
    expect(messageFor(at("i"), "int")).toBe("Must be a whole number");
    expect(messageFor(at("name"), "min")).toBe("Must be at least 2 characters");
    expect(messageFor(at("opt"), "min")).toBe("Must be at least 1 character");
    expect(messageFor(at("i"), "min")).toBe("Required");
    expect(messageFor(at("name"), "max")).toBe("Must be at most 5 characters");
    expect(messageFor(at("free"), "max")).toBe("Too long");
    expect(messageFor(at("i"), "max")).toBe("Too long");
    expect(messageFor(at("lit"), "literal")).toBe('Must be "x"');
    expect(messageFor(at("i"), "literal")).toBe("Invalid value");
    expect(messageFor(at("e"), "enum")).toBe("Must be one of: a, b");
    expect(messageFor(at("i"), "enum")).toBe("Invalid choice");
    expect(messageFor(at("u"), "discriminant")).toBe("Invalid choice");
    expect(messageFor(at("n"), "type")).toBe("Must be a number");
    expect(messageFor(at("i"), "type")).toBe("Must be a number");
    expect(messageFor(at("nul"), "type")).toBe("Must be a number");
    expect(messageFor(at("b"), "type")).toBe("Must be true or false");
    expect(messageFor(at("free"), "type")).toBe("Must be text");
    expect(messageFor(at("id"), "type")).toBe("Must be text");
    expect(messageFor(at("e"), "type")).toBe("Must be one of: a, b");
    expect(messageFor(at("list"), "type")).toBe("Invalid value");
    expect(messageFor(undefined, "type")).toBe("Invalid value");
  });

  it("fieldsError keys by path, first issue per path wins", () => {
    const e = fieldsError(S.node, {
      code: "schema.invalid",
      message: "x",
      data: {
        issues: [
          { path: ["name"], rule: "min" },
          { path: ["name"], rule: "max" },
          { path: ["list", 0, "q"], rule: "type" },
          { path: [], rule: "type" },
        ],
      },
    });
    expect(e).toEqual({
      code: "keel.fields",
      message: "keel.fields",
      data: { name: "Must be at least 2 characters", "list.0.q": "Must be a number", "": "Invalid value" },
    });
  });

  it("fieldSummary escapes and names the root path `form`", () => {
    expect(
      fieldSummary({ route: "a.b", method: "POST", values: {}, errors: { "": "Bad <x>", note: "Required" } }),
    ).toBe(
      '<div role="alert" data-k-fields="a.b"><ul><li data-field="form">form: Bad &lt;x&gt;</li><li data-field="note">note: Required</li></ul></div>',
    );
  });

  it("valuesOf keeps single values, arrays for repeats, and file names", () => {
    const fd = new FormData();
    fd.append("a", "1");
    fd.append("b", "2");
    fd.append("b", "3");
    fd.append("f", new File(["x"], "pic.png"));
    fd.append("e", "");
    expect(valuesOf(fd)).toEqual({ a: "1", b: ["2", "3"], f: "pic.png", e: "" });
  });
});

describe("rendering helpers", () => {
  it("toHtml serializes strings, nodes, arrays and scalars", () => {
    const el = document.createElement("b");
    el.textContent = "x";
    const frag = document.createDocumentFragment();
    frag.append(document.createTextNode("a<"), document.createComment("c"), document.createElement("i"));
    expect(toHtml("<p>raw</p>")).toBe("<p>raw</p>");
    expect(toHtml(null)).toBe("");
    expect(toHtml(undefined)).toBe("");
    expect(toHtml(true)).toBe("");
    expect(toHtml(false)).toBe("");
    expect(toHtml(0)).toBe("0");
    expect(toHtml(12.5)).toBe("12.5");
    expect(toHtml(el)).toBe("<b>x</b>");
    expect(toHtml(document.createTextNode("1 < 2"))).toBe("1 &lt; 2");
    expect(toHtml(frag)).toBe("a&lt;<!--c--><i></i>");
    expect(toHtml(["<a>", el, 3, null])).toBe("<a><b>x</b>3");
    expect(toHtml({ toString: () => "<o>" })).toBe("&lt;o&gt;");
  });

  it("escapeHtml escapes the five characters; stateJson cannot close a script", () => {
    expect(escapeHtml(`&<>"'x`)).toBe("&amp;&lt;&gt;&quot;&#39;x");
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        const out = stateJson(v);
        expect(
          [...out].some((c) => "<>&".includes(c) || c.charCodeAt(0) === 0x2028 || c.charCodeAt(0) === 0x2029),
        ).toBe(false);
        expect(JSON.parse(out)).toEqual(JSON.parse(JSON.stringify(v)));
      }),
      { seed: SEED, numRuns: 200 },
    );
    expect(stateJson(`<>&${String.fromCharCode(0x2028, 0x2029)}`)).toBe('"\\u003c\\u003e\\u0026\\u2028\\u2029"');
    expect(stateJson(undefined)).toBe("null");
  });

  it("documentHtml wraps in <main> once and shows the dev panel only when given", () => {
    const d = documentHtml("<p>x</p>", { a: 1 }, null);
    expect(d).toContain("<body><main><p>x</p></main><script");
    expect(d).not.toContain("data-k-dev");
    expect(documentHtml('<main id="m">x</main>', {}, null)).not.toContain("<main><main");
    expect(documentHtml("<mainx>", {}, null)).toContain("<main><mainx>");
    expect(documentHtml("<MAIN>x</MAIN>", {}, null)).not.toContain("<main><MAIN>");
    expect(documentHtml("x", {}, "E1554 <bad>")).toContain(
      '<pre role="alert" data-k-dev="diag">E1554 &lt;bad&gt;</pre>',
    );
    expect(d.startsWith('<!doctype html><html lang="en">')).toBe(true);
    expect(d.endsWith('<script type="application/json" id="k-state">{"a":1}</script></body></html>')).toBe(true);
  });
});

describe("small pure helpers", () => {
  it("statusOf and publicError", () => {
    fc.assert(
      fc.property(fc.string(), (c) => {
        const known: Record<string, number> = {
          "keel.notFound": 404,
          "keel.denied": 403,
          "keel.fields": 422,
          "keel.unexpected": 500,
        };
        expect(statusOf(c)).toBe(Object.hasOwn(known, c) ? known[c] : 400);
      }),
      { seed: SEED, numRuns: 100 },
    );
    const u = { code: "keel.unexpected", message: "secret", data: { cause: "secret" } };
    expect(publicError(u, "production")).toEqual({ code: "keel.unexpected", message: "unexpected", data: {} });
    expect(publicError(u, "dev")).toBe(u);
    const other = { code: "a.b", message: "m", data: { x: 1 } };
    expect(publicError(other, "production")).toBe(other);
  });

  it("toRecord, stringRecord, fieldsOf, encodeOr", () => {
    expect(toRecord({ a: 1 })).toEqual({ a: 1 });
    expect(toRecord([1])).toEqual({});
    expect(toRecord(null)).toEqual({});
    expect(toRecord("s")).toEqual({});
    expect(stringRecord({ a: "x", b: 1, c: null })).toEqual({ a: "x" });
    expect(stringRecord(["x"])).toEqual({});
    expect(stringRecord(null)).toEqual({});
    expect(stringRecord(3)).toEqual({});
    expect(fieldsOf(s.object({ a: s.int() }).node).map(([k]) => k)).toEqual(["a"]);
    expect(fieldsOf(s.int().node)).toEqual([]);
    expect(encodeOr(undefined, 1)).toEqual({});
    expect(encodeOr(s.object({ a: s.int() }), { a: 2 })).toEqual({ a: 2 });
    expect(encodeOr(s.object({ a: s.int() }), { a: "x" })).toEqual({});
  });

  it("isGuard checks every field", () => {
    const g = guard("internalsG", { redirect: "a.b" }, () => Promise.resolve(ok(null)));
    expect(isGuard(g)).toBe(true);
    expect(isGuard(null)).toBe(false);
    expect(isGuard("internalsG")).toBe(false);
    for (const k of ["kind", "name", "redirect", "run"]) {
      expect(isGuard(Object.fromEntries(Object.entries(g).filter(([x]) => x !== k)))).toBe(false);
      expect(isGuard({ ...g, [k]: 1 })).toBe(false);
    }
    expect(isGuard({ ...g, kind: "keel.loader" })).toBe(false);
  });

  it("needsBare and nearestErrorElement", () => {
    const lvl = (id: string, extra: object) => ({ id, def: { component: p, ...extra } });
    const ee = () => p();
    const chain = [lvl("a", {}), lvl("b", { loader: loaderStub }), lvl("c", { errorElement: ee }), lvl("d", {})];
    expect(needsBare(chain, 0)).toBe(false);
    expect(needsBare(chain, 1)).toBe(false);
    expect(needsBare(chain, 2)).toBe(true);
    expect(needsBare(chain, -1)).toBe(false);
    expect(needsBare([lvl("a", { guard: "g" }), lvl("b", {})], 1)).toBe(true);
    expect(nearestErrorElement(chain, 3)).toBe(2);
    expect(nearestErrorElement(chain, 99)).toBe(2);
    expect(nearestErrorElement(chain, 2)).toBe(2);
    expect(nearestErrorElement(chain, 1)).toBe(-1);
    expect(nearestErrorElement([lvl("a", { errorElement: ee })], 0)).toBe(0);
  });

  it("log lines, notFound, codedError, devMessageOf", () => {
    const r = { method: "GET", path: "/x", route: "a.x", status: 200, ms: 3 };
    expect(reqLine("compact", r)).toBe("GET /x a.x 200 3ms");
    expect(reqLine("compact", { ...r, route: undefined })).toBe("GET /x 200 3ms");
    expect(JSON.parse(reqLine("json", r))).toEqual({ kind: "req", ...r });
    expect(JSON.parse(reqLine("json", { ...r, route: undefined }))).toEqual({
      kind: "req",
      method: "GET",
      path: "/x",
      status: 200,
      ms: 3,
    });
    const d = { code: "E1554", message: "m" };
    expect(diagLine("compact", d)).toBe("E1554 m");
    expect(JSON.parse(diagLine("json", d))).toEqual({ kind: "diag", code: "E1554", message: "m", see: "k.server" });
    expect(notFound("/u")).toEqual({ code: "keel.notFound", message: "keel.notFound", data: { url: "/u" } });
    const e = codedError("E1", "msg");
    expect(e.message).toBe("E1 msg");
    expect(e.code).toBe("E1");
    expect(devMessageOf([null, { code: "a.b", message: "x", data: {} }])).toBeNull();
    expect(
      devMessageOf([
        undefined,
        { code: "keel.unexpected", message: "u1", data: {} },
        { code: "keel.unexpected", message: "u2", data: {} },
      ]),
    ).toBe("u1");
  });
});
