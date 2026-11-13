// @vitest-environment happy-dom
// Unit and property tests (seed 1337) for the pure internals of the request flow.
import type { RouteDef } from "@keel/router";
import { compileRoutes, compileTable, needsBare, routeActions } from "@keel/router/internal";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { codedError } from "../src/internal/codedError.ts";
import { devMessageOf } from "../src/internal/devMessageOf.ts";
import { diagLine } from "../src/internal/diagLine.ts";
import { documentHtml } from "../src/internal/documentHtml.ts";
import { encodeOr } from "../src/internal/encodeOr.ts";
import { escapeHtml } from "../src/internal/escapeHtml.ts";
import { fieldSummary } from "../src/internal/fieldSummary.ts";
import { nearestErrorElement } from "../src/internal/nearestErrorElement.ts";
import { notFound } from "../src/internal/notFound.ts";
import { publicError } from "../src/internal/publicError.ts";
import { reqLine } from "../src/internal/reqLine.ts";
import { seeOf } from "../src/internal/seeOf.ts";
import { selectDeployable } from "../src/internal/selectDeployable.ts";
import { stateJson } from "../src/internal/stateJson.ts";
import { statusOf } from "../src/internal/statusOf.ts";
import { stringRecord } from "../src/internal/stringRecord.ts";
import { toHtml } from "../src/internal/toHtml.ts";
import { valuesOf } from "../src/internal/valuesOf.ts";
import { topology } from "../src/topology.ts";

const SEED = 1337;
const p = (): Node => document.createElement("p");
const tableOf = (routes: Record<string, RouteDef>) => compileTable(compileRoutes(routes), routes);
const loaderStub = { kind: "keel.loader" as const, output: s.object({}), run: () => Promise.resolve(ok({})) };

describe("selectDeployable", () => {
  const shop = { path: "/shop", component: p };
  routeActions.set(shop, { POST: { kind: "keel.action", input: s.object({}), run: () => ok(null) } });
  const table = tableOf({
    "app.home": { path: "/", component: p },
    "orders.show": { path: "/orders/:id", params: s.object({ id: s.string() }), component: p },
    "shop.list": shop,
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
    const bare = tableOf({ "x.y": { path: "/y/:id", params: s.object({ id: s.string() }), component: p } });
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
    expect(valuesOf(fd, s.object({}).node)).toEqual({ a: "1", b: ["2", "3"], f: "pic.png", e: "" });
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
    const d = documentHtml("<p>x</p>", { a: 1 }, null, null, "", "en", "n0");
    expect(d).toContain("<body><main><p>x</p></main><script");
    expect(d).not.toContain("data-k-dev");
    expect(documentHtml('<main id="m">x</main>', {}, null, null, "", "en", "n0")).not.toContain("<main><main");
    expect(documentHtml("<mainx>", {}, null, null, "", "en", "n0")).toContain("<main><mainx>");
    expect(documentHtml("<MAIN>x</MAIN>", {}, null, null, "", "en", "n0")).not.toContain("<main><MAIN>");
    expect(documentHtml("x", {}, "E1554 <bad>", null, "", "en", "n0")).toContain(
      '<pre role="alert" data-k-dev="diag">E1554 &lt;bad&gt;</pre>',
    );
    expect(d).not.toContain('type="module"');
    expect(documentHtml("x", {}, null, "/@keel/entry.ts", "", "en", "n0")).toContain(
      '<script type="module" src="/@keel/entry.ts" nonce="n0"></script></body>',
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
          "keel.unreachable": 502,
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

  it("stringRecord, encodeOr", () => {
    expect(stringRecord({ a: "x", b: 1, c: null })).toEqual({ a: "x" });
    expect(stringRecord(["x"])).toEqual({});
    expect(stringRecord(null)).toEqual({});
    expect(stringRecord(3)).toEqual({});
    expect(encodeOr(undefined, 1)).toEqual({});
    expect(encodeOr(s.object({ a: s.int() }), { a: 2 })).toEqual({ a: 2 });
    expect(encodeOr(s.object({ a: s.int() }), { a: "x" })).toEqual({});
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
    expect(JSON.parse(diagLine("json", { code: "E1508", message: "loop" }))).toMatchObject({ see: "k.router" });
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

describe("seeOf", () => {
  it("maps a kernel code to the section owning its block (spec map Code ranges), else k.server", () => {
    const cases: readonly (readonly [string, string])[] = [
      ["E1000", "k.compiler"],
      ["E1057", "k.cli"],
      ["E1203", "k.reactive"],
      ["E1499", "k.errors"],
      ["E1500", "k.router"],
      ["E1508", "k.router"],
      ["E1549", "k.router"],
      ["E1550", "k.server"],
      ["E1555", "k.server"],
      ["E1601", "k.ctx"],
      ["E1799", "k.check"],
      ["E1800", "k.ui"],
      ["E1899", "k.ui"],
      ["E1903", "k.forms"],
      ["E2001", "k.server"],
      ["E0005", "k.server"],
      ["E15081", "k.server"],
      ["xE1508", "k.server"],
      ["keel.unexpected", "k.server"],
    ];
    for (const [code, see] of cases) expect(seeOf(code)).toBe(see);
  });
});
