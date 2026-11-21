// Mutation-killing tests for analyze (the single-pass collector) and shapeAt.
import type { Expression } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/internal/analyze.ts";
import { shapeAt } from "../src/internal/shapeAt.ts";

const an = (source: string, path = "T.tsx") => analyze({ path, source });
const span = (src: string, text: string, nth = 0) => {
  let i = -1;
  for (let k = 0; k <= nth; k++) i = src.indexOf(text, i + 1);
  if (i < 0) throw new Error(`no ${text}`);
  return { start: i, end: i + text.length };
};

describe("analyze: paths", () => {
  it("derives stem and idPrefix", () => {
    expect(an("", "a/b/C.tsx").stem).toBe("C");
    expect(an("", "a/b/C.tsx").idPrefix).toBe("a.b.C");
    expect(an("", "./a/C.ts").idPrefix).toBe("a.C");
    expect(an("", "a\\b\\C.jsx").idPrefix).toBe("a.b.C");
    expect(an("", "C.mjs").stem).toBe("C");
    expect(an("", "C.cjs").idPrefix).toBe("C");
    expect(an("", "C.js").idPrefix).toBe("C");
    expect(an("", "C.cts").idPrefix).toBe("C");
    expect(an("", "x/C.mts").stem).toBe("C");
    expect(an("", "C.d.ts").stem).toBe("C.d");
    expect(an("", "noext").stem).toBe("noext");
    expect(an("", "a.b/c.tsx").idPrefix).toBe("a.b.c");
    expect(an("", "a/b").idPrefix).toBe("a.b");
    expect(an("", "").stem).toBe("");
    expect(an("", "a/").stem).toBe("");
    expect(an("", "x.tsxy").stem).toBe("x.tsxy");
    expect(an("", "x.json").idPrefix).toBe("x.json");
  });
  it("selects the language from the extension", () => {
    expect(an("const a: number = 1;", "a.ts").parseErrors).toEqual([]);
    expect(an("const a = <div/>;", "a.tsx").parseErrors).toEqual([]);
    expect(an("const a = <div/>;", "a.jsx").parseErrors).toEqual([]);
    expect(an("const a = 1;", "a.js").parseErrors).toEqual([]);
    expect(an("const a = 1;", "a.mjs").parseErrors).toEqual([]);
    expect(an("const a = 1;", "a.cjs").parseErrors).toEqual([]);
    expect(an("const a = <div/>;", "a.weird").parseErrors).toEqual([]);
    expect(an("const a = <div/>;", "a.weird").jsx.length).toBe(1);
    // .ts is not JSX; .js is not TypeScript; unknown ext is tsx
    expect(an("const a = <div/>;", "a.ts").jsx.length).toBe(0);
    expect(an("const a: number = 1;", "a.js").parseErrors.length).toBeGreaterThan(0);
    expect(an("const a: number = 1;", "a.jsx").parseErrors.length).toBeGreaterThan(0);
    expect(an("const a: number = 1;", "a.mjs").parseErrors.length).toBeGreaterThan(0);
    expect(an("const a: number = 1;", "a.cjs").parseErrors.length).toBeGreaterThan(0);
    expect(an("const a = <T,>(x: T) => x;", "a.ts").parseErrors).toEqual([]);
    expect(an("const a: number = 1;", "a.weird").parseErrors).toEqual([]);
    expect(an("const a: number = 1;", "b.tsx.js").parseErrors.length).toBeGreaterThan(0);
    expect(an("const a: number = 1;", "xjs").parseErrors).toEqual([]);
    expect(an("const a: number = 1;", "x.jsfoo").parseErrors).toEqual([]);
    expect(an("const a: number = 1;", "x.tsfoo").parseErrors).toEqual([]);
    expect(an("const a: number = 1;", "ts.js").parseErrors.length).toBeGreaterThan(0);
    expect(an("const a = <div/>;", "x.ts.tsx").jsx.length).toBe(1);
    expect(an("const a = <div/>;", "x.tsx.ts").jsx.length).toBe(0);
    expect(an("const a = <div/>;", "x.jsx.ts").jsx.length).toBe(0);
    expect(an("const a = <div/>;", "x.js.jsx").jsx.length).toBe(1);
    expect(an("const a = <div/>;", "x.tsx.js").jsx.length).toBe(0);
    expect(an("const a = <div/>;", "x.ts.js").jsx.length).toBe(0);
    expect(an("const a = <div/>;", "x.js.ts").jsx.length).toBe(0);
  });
  it("reports parse errors with their first label offset", () => {
    const a = an("const = ;");
    expect(a.parseErrors.length).toBeGreaterThan(0);
    const e = a.parseErrors[0];
    expect(typeof e?.message).toBe("string");
    expect(e?.message).not.toBe("");
    expect(e?.start).toBe(6);
    expect(an("let x = ;").parseErrors[0]?.start).toBe(8);
  });
});

describe("analyze: collections", () => {
  const src = [
    'import { If, For as Loop, "Match" as M, Other } from "@keel/runtime-dom";',
    'import { Case } from "elsewhere";',
    'import def, * as ns from "@keel/runtime-dom";',
    "const sig = signal(0);",
    "const c = computed(() => 1);",
    "const r = resource(() => 1), plain = other(1);",
    "const { dest } = signal(1);",
    "let nul;",
    "function Comp(props) { effect(() => 1); return <div>{props.a && b}</div>; }",
  ].join("\n");
  const a = an(src);
  it("collects runtime-dom intrinsics only", () => {
    expect([...a.intrinsics]).toEqual([
      ["If", "If"],
      ["Loop", "For"],
      ["M", "Match"],
    ]);
  });
  it("collects imports and binds their positions", () => {
    expect(a.imports.length).toBe(3);
    expect(a.decls.get("If")).toEqual([{ start: 0, end: src.length }]);
    expect(a.decls.get("Loop")?.length).toBe(1);
    expect(a.decls.get("def")?.length).toBe(1);
    expect(a.decls.get("ns")?.length).toBe(1);
    expect(a.decls.get("Case")?.length).toBe(1);
    expect(a.bindings).toContainEqual(span(src, 'import { Case } from "elsewhere";'));
  });
  it("collects reactive declarations with exact spans", () => {
    expect(a.reactive).toEqual([
      { name: "sig", kind: "signal", ...span(src, "sig = signal(0)"), init: span(src, "signal(0)") },
      { name: "c", kind: "computed", ...span(src, "c = computed(() => 1)"), init: span(src, "computed(() => 1)") },
      { name: "r", kind: "resource", ...span(src, "r = resource(() => 1)"), init: span(src, "resource(() => 1)") },
    ]);
  });
  it("collects consts first-wins, effects and logicals", () => {
    expect([...a.consts.keys()]).toEqual(["sig", "c", "r", "plain"]);
    const b = an("const x = 1; { const x = 2; } function f() { const x = 3; }");
    expect(b.consts.get("x")?.type).toBe("Literal");
    const first = b.consts.get("x");
    expect(first && "value" in first ? first.value : undefined).toBe(1);
    expect(a.effects).toEqual([span(src, "effect(() => 1)")]);
    expect(a.logicals.length).toBe(1);
    expect(an("effect(1); other.effect(2); foo(effect)").effects).toEqual([span("effect(1)", "effect(1)")]);
  });
  it("only identifier callees of reactive kinds count; destructuring and non-calls do not", () => {
    const b = an(
      "const a = signal; const b = obj.signal(1); const { c } = signal(1); const d = signal; const e = (0, signal)(1); let f;",
    );
    expect(b.reactive).toEqual([]);
    expect([...b.consts.keys()]).toEqual(["a", "b", "d", "e"]);
  });
  it("records member names and spans", () => {
    expect(a.members).toEqual(
      [{ name: "a", ...span(src, "a", src.lastIndexOf("props.a") - 0) }]
        .slice(0, 0)
        .concat([{ name: "a", start: src.indexOf("props.a") + 6, end: src.indexOf("props.a") + 7 }]),
    );
    const b = an("x.y.z; x[w]; x?.q");
    expect(b.members.map((m) => m.name)).toEqual(["z", "y", "q"]);
  });
});

describe("analyze: functions and names", () => {
  it("names declarations, variables and function expressions", () => {
    const src =
      "function Decl() {}\nconst Arrow = () => 1;\nconst Expr = function Inner() {};\nconst Anon = function () {};\nexport default function () {}\n(function Iife() {})();\nconst o = { m() {}, k: () => 1 };\nclass K { f() {} }";
    const a = an(src);
    expect(a.functions.map((f) => f.name)).toEqual(["Decl", "Arrow", "Expr", "Anon", null, "Iife", null, null, null]);
    const decl = a.functions[0];
    expect(decl && { start: decl.start, end: decl.end }).toEqual(span(src, "function Decl() {}"));
    expect(a.functions[5] && { start: a.functions[5].start, end: a.functions[5].end }).toEqual(
      span(src, "function Iife() {}"),
    );
    expect(a.decls.get("Decl")).toEqual([{ start: 0, end: src.length }]);
    expect(a.decls.get("Inner")).toEqual([span(src, "function Inner() {}")]);
    expect(a.decls.get("Iife")).toEqual([span(src, "function Iife() {}")]);
    expect(a.decls.get("Expr")).toEqual([{ start: 0, end: src.length }]);
  });
  it("a nested function declaration is scoped to its enclosing block", () => {
    const src = "function Outer() { function Inner() {} return Inner; }";
    const a = an(src);
    expect(a.decls.get("Outer")).toEqual([{ start: 0, end: src.length }]);
    expect(a.decls.get("Inner")).toEqual([span(src, "{ function Inner() {} return Inner; }")]);
  });
  it("assigns names retroactively and keeps the variable name over the expression id", () => {
    const a = an("const A = function B() {}; const C = (function D() {});");
    expect(a.functions.map((f) => f.name)).toEqual(["A", "D"]);
    const b = an("const E = () => 1; foo(function F() {});");
    expect(b.functions.map((f) => f.name)).toEqual(["E", "F"]);
    const c = an("let G = 1; const x = { H: function () {} };");
    expect(c.functions.map((f) => f.name)).toEqual([null]);
  });
});

describe("analyze: scopes and declarations", () => {
  it("scopes params to the function", () => {
    const src = "function f(a, { b }, [c], ...d) { return a; }\nconst g = (e = 1) => e;";
    const a = an(src);
    const f = span(src, "function f(a, { b }, [c], ...d) { return a; }");
    for (const n of ["a", "b", "c", "d"]) expect(a.decls.get(n)).toEqual([f]);
    expect(a.decls.get("e")).toEqual([span(src, "(e = 1) => e")]);
  });
  it("scopes let/const to blocks and var to the function", () => {
    const src = "function f() { { var v = 1; let l = 2; const k = 3; } for (let i = 0;;) { var w; } }";
    const a = an(src);
    expect(a.decls.get("v")).toEqual(
      [span(src, src)]
        .slice(0, 0)
        .concat([span(src, "function f() { { var v = 1; let l = 2; const k = 3; } for (let i = 0;;) { var w; } }")]),
    );
    expect(a.decls.get("l")).toEqual([span(src, "{ var v = 1; let l = 2; const k = 3; }")]);
    expect(a.decls.get("k")).toEqual([span(src, "{ var v = 1; let l = 2; const k = 3; }")]);
    expect(a.decls.get("i")).toEqual([span(src, "for (let i = 0;;) { var w; }")]);
    expect(a.decls.get("w")).toEqual([span(src, src)]);
  });
  it("opens scopes for for-in, for-of, switch, static blocks and catch", () => {
    const src =
      "for (const k in o) {}\nfor (const v of o) {}\nswitch (x) { case 1: { } }\nclass C { static { let s = 1; } }\ntry {} catch (e) { let z; }\ntry {} catch { }";
    const a = an(src);
    expect(a.decls.get("k")).toEqual([span(src, "for (const k in o) {}")]);
    expect(a.decls.get("v")).toEqual([span(src, "for (const v of o) {}")]);
    expect(a.decls.get("s")).toEqual([span(src, "static { let s = 1; }")]);
    expect(a.decls.get("e")).toEqual([span(src, "catch (e) { let z; }")]);
    expect(a.decls.get("z")).toEqual([span(src, "{ let z; }")]);
    const b = an("switch (x) { case 1: let q = 1; }");
    expect(b.decls.get("q")).toEqual([span("switch (x) { case 1: let q = 1; }", "switch (x) { case 1: let q = 1; }")]);
    const c = an("try {} catch ({ m, n }) {}");
    expect(c.decls.get("m")?.length).toBe(1);
    expect(c.decls.get("n")?.length).toBe(1);
  });
  it("records class declarations; anonymous default classes are skipped", () => {
    const src = "class A {}\nexport default class {}\nfunction f() { class B {} }";
    const a = an(src);
    expect(a.decls.get("A")).toEqual([{ start: 0, end: src.length }]);
    expect(a.decls.get("B")).toEqual([span(src, "{ class B {} }")]);
    expect(a.bindings).toContainEqual(span(src, "A"));
  });
  it("accumulates multiple declaring scopes for one name", () => {
    const src = "const x = 1; function f(x) { { const x = 2; } }";
    const a = an(src);
    expect(a.decls.get("x")?.length).toBe(3);
  });
});

describe("analyze: identifier reads", () => {
  it("excludes bindings, member properties, keys, labels and type positions", () => {
    const src = [
      "interface I { zed: number }",
      "type T = { yak: string };",
      "const v = { key: val, short, [comp]: 1, 'q': 2 };",
      "const w = obj.prop + obj.other[idx];",
      "lbl: for (;;) { break lbl; continue lbl; }",
      "class K { meth() {} field = fv; [cm]() {} }",
      "const t = x as Foo;",
      "const u = <Bar>y;",
      "const s = z satisfies Baz;",
      "function g<G>(p: P1, q = dflt): R1 { return new Map<string, Mp>(); }",
      "const decl = decl2;",
    ].join("\n");
    const a = an(src, "T.ts");
    const names = a.idents.map((i) => i.name);
    expect(names).toEqual([
      "val",
      "short",
      "comp",
      "obj",
      "obj",
      "idx",
      "fv",
      "cm",
      "x",
      "y",
      "z",
      "dflt",
      "Map",
      "decl2",
    ]);
    expect(a.idents.map((i) => i.shorthand)).toEqual([false, true, ...Array(12).fill(false)]);
    const sorted = [...a.idents].sort((p, q) => p.start - q.start);
    expect(a.idents).toEqual(sorted);
    const shortRef = a.idents.find((i) => i.name === "short");
    expect(shortRef && { start: shortRef.start, end: shortRef.end }).toEqual(span(src, "short"));
    expect(a.identsByName.get("obj")?.length).toBe(2);
    expect(a.identsByName.get("val")?.map((r) => r.name)).toEqual(["val"]);
    expect(a.identsByName.has("zed")).toBe(false);
  });
  it("dedupes identifiers that share a start and excludes declared names; pattern defaults are reads", () => {
    const a = an("import { a as b } from 'm'; const [c, d = e] = f; function g(h = i, { j = k, [l]: m } = n) {}");
    expect(a.idents.map((i) => i.name)).toEqual(["e", "f", "i", "k", "l", "n"]);
    expect(a.idents.map((i) => i.shorthand)).toEqual([false, false, false, false, false, false]);
  });
  it("shorthand object properties are reads flagged shorthand; destructuring shorthand is a binding", () => {
    const a = an("const o = { p }; const { q } = o; ({ r } = o);");
    expect(a.idents.map((i) => [i.name, i.shorthand])).toEqual([
      ["p", true],
      ["o", false],
      ["r", true],
      ["o", false],
    ]);
  });
  it("sorts jsx elements by start then by larger span first", () => {
    const a = an("const x = <a><b/><c/></a>; const y = <><d/></>;");
    expect(a.jsx.map((j) => j.type)).toEqual(["JSXElement", "JSXElement", "JSXElement", "JSXFragment", "JSXElement"]);
    expect(a.jsx.map((j, i) => (i > 0 ? j.start >= (a.jsx[i - 1]?.start ?? 0) : true))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
  it("label and member excluded ranges also cover type annotations on variables and generics", () => {
    const a = an("const x: Foo<Bar> = baz<Qux>(arg); type A = B; interface J extends K {}", "T.ts");
    expect(a.idents.map((i) => i.name)).toEqual(["baz", "arg"]);
  });
});

describe("shapeAt", () => {
  const propsAt = (src: string, expr: string, name: string | undefined = "props") => {
    const a = an(src);
    const dummy = an(`${expr};`);
    const stmt = dummy.program.body[0];
    if (stmt === undefined || stmt.type !== "ExpressionStatement") throw new Error("no expr");
    const e: Expression = stmt.expression;
    return shapeAt(a, e, name);
  };
  const P = (schema: string) => `const Props = ${schema};`;
  it("is unknown without a props name, path or Props", () => {
    expect(propsAt(P("k.object({ a: k.string() })"), "props.a", undefined)).toEqual({ kind: "unknown" });
    expect(propsAt("const x = 1;", "props.a")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.object({ a: k.string() })"), "other.a")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.object({ a: k.string() })"), "props[a]")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.object({ a: k.string() })"), "props.a()")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.object({ a: k.string() })"), "props.#a")).toEqual({ kind: "unknown" });
  });
  it("resolves the root and nested object fields", () => {
    const schema = P('k.object({ a: k.object({ b: k.literal("x") }), "s-t": k.array(k.string()) })');
    const root = propsAt(schema, "props");
    expect(root.kind).toBe("object");
    if (root.kind === "object") expect([...root.fields.keys()]).toEqual(["a", "s-t"]);
    expect(propsAt(schema, "props.a.b")).toEqual({ kind: "literal", value: "x" });
    expect(propsAt(schema, "props.a.b.c")).toEqual({ kind: "unknown" });
    expect(propsAt(schema, "props.zz")).toEqual({ kind: "unknown" });
    expect(propsAt(schema, "props.a.zz")).toEqual({ kind: "unknown" });
    expect(propsAt(schema, "props.a").kind).toBe("object");
    expect(propsAt(schema, "(props.a as X).b")).toEqual({ kind: "literal", value: "x" });
    expect(propsAt(schema, "props!.a.b")).toEqual({ kind: "literal", value: "x" });
    expect(propsAt(schema, "(props satisfies X).a.b")).toEqual({ kind: "literal", value: "x" });
    expect(propsAt(schema, "props?.a?.b")).toEqual({ kind: "literal", value: "x" });
    expect(propsAt(schema, "((props)).a.b")).toEqual({ kind: "literal", value: "x" });
    expect(propsAt(schema, "props.a.b", "p")).toEqual({ kind: "unknown" });
    const arr = propsAt(schema, "props['s-t']");
    expect(arr).toEqual({ kind: "unknown" });
    const node = propsAt(P("k.object({ s: k.array(k.object({ a: k.string() })) })"), "props.s");
    expect(node.kind).toBe("array");
    if (node.kind === "array") expect(node.item.kind).toBe("object");
  });
  it("sees through wrappers and identifier references", () => {
    const wrapped = P(
      'k.object({ a: k.literal("v").optional(), b: k.literal("w").nullable().describe("d").brand("B").default("w") })',
    );
    expect(propsAt(wrapped, "props.a")).toEqual({ kind: "literal", value: "v" });
    expect(propsAt(wrapped, "props.b")).toEqual({ kind: "literal", value: "w" });
    const ref = "const Inner = k.object({ z: k.literal(1) });\nconst Props = k.object({ i: Inner, j: Missing });";
    const i = propsAt(ref, "props.i");
    expect(i.kind).toBe("object");
    expect(propsAt(ref, "props.i.z")).toEqual({ kind: "literal", value: "1" });
    expect(propsAt(ref, "props.j")).toEqual({ kind: "unknown" });
    expect(propsAt(P("Inner"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("(k.object({ q: k.string() }))"), "props").kind).toBe("object");
    expect(propsAt(P("k.object({ q: k.string() }) as X"), "props").kind).toBe("object");
    expect(propsAt(P("k.object({ q: k.string() })!"), "props").kind).toBe("object");
    expect(propsAt(P("k.object({ q: k.string() }) satisfies X"), "props").kind).toBe("object");
  });
  it("handles non-object, non-member and non-identifier schema shapes", () => {
    expect(propsAt(P("1"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("foo()"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k[o]({})"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.object()"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.object(...a)"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.object(x)"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.array()"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.literal()"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.literal(null)"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.literal(x)"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.literal(true)"), "props")).toEqual({ kind: "literal", value: "true" });
    expect(propsAt(P("k.literal(0)"), "props")).toEqual({ kind: "literal", value: "0" });
    expect(propsAt(P("k.nope(1)"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.string()"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.optional(x)"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.optional.nope(1)"), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P("k.object({ [c]: k.string(), ...s, m() {}, 5: k.string() })"), "props").kind).toBe("object");
  });
  it("object fields skip computed keys and non-properties and number keys", () => {
    const r = propsAt(P("k.object({ [c]: k.string(), ...s, 5: k.string(), ok: k.string() })"), "props");
    expect(r.kind).toBe("object");
    if (r.kind === "object") expect([...r.fields.keys()]).toEqual(["ok"]);
  });
  it("resolves tagged unions", () => {
    const u = P('k.union("t", [k.object({ t: k.literal("a") }), k.object({ t: k.literal("b"), x: k.string() })])');
    expect(propsAt(u, "props")).toEqual({ kind: "union", key: "t", tags: ["a", "b"] });
    expect(propsAt(P('k.union(1, [k.object({ t: k.literal("a") })])'), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P('k.union("t")'), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P('k.union("t", x)'), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P('k.union("t", [...x])'), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P('k.union("t", [, k.object({ t: k.literal("a") })])'), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P('k.union("t", [k.object({ u: k.literal("a") })])'), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P('k.union("t", [k.object({ t: k.string() })])'), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P('k.union("t", [k.string()])'), "props")).toEqual({ kind: "unknown" });
    expect(propsAt(P('k.union("t", [])'), "props")).toEqual({ kind: "union", key: "t", tags: [] });
  });
  it("bounds identifier recursion depth", () => {
    expect(propsAt("const A = B; const B = A; const Props = A;", "props")).toEqual({ kind: "unknown" });
    let chain = "const Props = c0;";
    for (let i = 0; i < 14; i++) chain += `const c${i} = c${i + 1};`;
    chain += 'const c14 = k.literal("deep");';
    expect(propsAt(chain, "props")).toEqual({ kind: "unknown" });
    let ok = "const Props = c0;";
    for (let i = 0; i < 5; i++) ok += `const c${i} = c${i + 1};`;
    ok += 'const c5 = k.literal("near");';
    expect(propsAt(ok, "props")).toEqual({ kind: "literal", value: "near" });
    // exactly at the boundary: Props -> depth 0, each hop adds 1; 12 hops allowed
    const hops = (n: number) => {
      let s = "const Props = c0;";
      for (let i = 0; i < n; i++) s += `const c${i} = c${i + 1};`;
      return `${s}const c${n} = k.literal("z");`;
    };
    expect(propsAt(hops(11), "props")).toEqual({ kind: "literal", value: "z" });
    expect(propsAt(hops(12), "props")).toEqual({ kind: "unknown" });
  });
});
