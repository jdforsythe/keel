// Mutation-killing unit tests for the small pure helpers under src/internal.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "@keel/tooling/repo-root";
import type { JSXElement } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/internal/analyze.ts";
import { bindsTo } from "../src/internal/bindsTo.ts";
import { canNest } from "../src/internal/canNest.ts";
import { className } from "../src/internal/className.ts";
import { cleanJsxText } from "../src/internal/cleanJsxText.ts";
import { componentAt } from "../src/internal/componentAt.ts";
import { decodeEntities } from "../src/internal/decodeEntities.ts";
import { patternNames } from "../src/internal/patternNames.ts";
import { roleOf } from "../src/internal/roleOf.ts";
import { staticValueOf } from "../src/internal/staticValueOf.ts";
import { tagNameOf } from "../src/internal/tagNameOf.ts";
import { uiBaseElements } from "../src/internal/uiBaseElements.ts";

const uiNames: typeof import("../../ui/src/internal/className.ts") = await import(
  pathToFileURL(path.join(repoRoot(import.meta.dirname), "packages", "ui", "src", "internal", "className.ts")).href
);
const uiClassName = uiNames.className;

function firstEl(source: string): JSXElement {
  const a = analyze({ path: "T.tsx", source });
  const j = a.jsx[0];
  if (j === undefined || j.type !== "JSXElement") throw new Error("no element");
  return j;
}

describe("className", () => {
  it("builds exact readable names", () => {
    expect(className("p", "2")).toBe("k-p-2");
    expect(className("p", "3", "md")).toBe("k-md-p-3");
    expect(className("bg", "accent", undefined, "hover")).toBe("k-hover-bg-accent");
    expect(className("fg", "fg", "md", "focusVisible")).toBe("k-md-focus-fg-fg");
    expect(className("fg", "x", undefined, "active")).toBe("k-active-fg-x");
    expect(className("fg", "x", undefined, "disabled")).toBe("k-disabled-fg-x");
  });
  it("hashes non-plain tokens with underscores and a base-36 fnv1a suffix", () => {
    const n = className("w", "1/2");
    expect(n).toBe(uiClassName("w", "1/2"));
    expect(n).toMatch(/^k-w-1_2_[0-9a-z]+$/);
    expect(className("gap", "x.y", "lg", "active")).toBe(uiClassName("gap", "x.y", "lg", "active"));
    expect(className("gap", "x.y", "lg", "active")).toMatch(/^k-lg-active-gap-x_y_[0-9a-z]+$/);
    expect(className("w", "a b!c")).toMatch(/^k-w-a_b_c_[0-9a-z]+$/);
  });
  it("hashes when the breakpoint collides with a state segment", () => {
    const n = className("p", "2", "hover");
    expect(n).toBe(uiClassName("p", "2", "hover"));
    expect(n).toMatch(/^k-hover-p-2_[0-9a-z]+$/);
    expect(className("p", "2", "focus")).toMatch(/^k-focus-p-2_[0-9a-z]+$/);
    expect(className("p", "2", "active")).toMatch(/^k-active-p-2_[0-9a-z]+$/);
    expect(className("p", "2", "disabled")).toMatch(/^k-disabled-p-2_[0-9a-z]+$/);
  });
  it("hash key distinguishes breakpoint and state", () => {
    const a = className("w", "1/2", "hover");
    const b = className("w", "1/2", undefined, "hover");
    expect(a).not.toBe(b);
    expect(a).toBe(uiClassName("w", "1/2", "hover"));
    expect(b).toBe(uiClassName("w", "1/2", undefined, "hover"));
    expect(className("w", "1/2", "md")).toBe(uiClassName("w", "1/2", "md"));
    expect(className("w", "1/2", "md", "hover")).toBe(uiClassName("w", "1/2", "md", "hover"));
    expect(className("w", "1/2", undefined, "disabled")).toBe(uiClassName("w", "1/2", undefined, "disabled"));
  });
  it("hashes a long, multi-character key identically to ui", () => {
    const tok = "a/b/c/d/e/f/g/h";
    expect(className("fontSize", tok, "xl", "focusVisible")).toBe(uiClassName("fontSize", tok, "xl", "focusVisible"));
    expect(className("", "", "", undefined)).toBe(uiClassName("", "", "", undefined));
  });
});

describe("decodeEntities", () => {
  it("decodes every named entity", () => {
    expect(decodeEntities("&amp;&lt;&gt;&quot;&apos;&nbsp;")).toBe("&<>\"' ");
  });
  it("keeps unknown named entities", () => {
    expect(decodeEntities("&bogus; &AMP;")).toBe("&bogus; &AMP;");
  });
  it("decodes hex and decimal references", () => {
    expect(decodeEntities("&#x41;&#X;")).toBe("A&#X;");
    expect(decodeEntities("&#x1F600;")).toBe("\u{1F600}");
    expect(decodeEntities("&#65;&#66;")).toBe("AB");
    expect(decodeEntities("&#x41ab;")).toBe(String.fromCodePoint(0x41ab));
    expect(decodeEntities("&#123;")).toBe("{");
    expect(decodeEntities("&#0;")).toBe("\u0000");
  });
  it("accepts mixed-case hex digits and multi-digit decimals", () => {
    expect(decodeEntities("&#xaB;")).toBe("«");
    expect(decodeEntities("&#x10ffff;")).toBe("\u{10ffff}");
    expect(decodeEntities("&#1234;")).toBe("Ӓ");
  });
  it("keeps out-of-range references verbatim", () => {
    expect(decodeEntities("&#x110000;")).toBe("&#x110000;");
    expect(decodeEntities("&#1114112;")).toBe("&#1114112;");
    expect(decodeEntities("&#1114111;")).toBe("\u{10ffff}");
  });
  it("leaves unterminated or malformed references", () => {
    expect(decodeEntities("&amp")).toBe("&amp");
    expect(decodeEntities("&#;")).toBe("&#;");
    expect(decodeEntities("&#xg;")).toBe("&#xg;");
    expect(decodeEntities("&#1a;")).toBe("&#1a;");
    expect(decodeEntities("&a1;")).toBe("&a1;");
    expect(decodeEntities("&;")).toBe("&;");
    expect(decodeEntities("&#x4g1;")).toBe("&#x4g1;");
    expect(decodeEntities("x&amp;y&amp;z")).toBe("x&y&z");
  });
});

describe("cleanJsxText", () => {
  it("returns single-line text as is, converting tabs to spaces", () => {
    expect(cleanJsxText("  hello  world  ")).toBe("  hello  world  ");
    expect(cleanJsxText("a\tb")).toBe("a b");
    expect(cleanJsxText("")).toBe("");
  });
  it("trims leading spaces only after the first line and trailing only before the last", () => {
    expect(cleanJsxText("  a  \n  b  ")).toBe("  a b  ");
    expect(cleanJsxText("a\n\n   b\n")).toBe("a b");
    expect(cleanJsxText("\n   a   \n")).toBe("a");
    expect(cleanJsxText("a \n b")).toBe("a b");
  });
  it("drops whitespace-only lines and handles all line break kinds", () => {
    expect(cleanJsxText("\n  \n\t\n")).toBe("");
    expect(cleanJsxText("a\r\nb")).toBe("a b");
    expect(cleanJsxText("a\rb")).toBe("a b");
    expect(cleanJsxText("a\n\t b\n  \n")).toBe("a b");
    expect(cleanJsxText("a\n b \n c")).toBe("a b c");
  });
  it("keeps interior spaces and a trailing space of the final non-empty line when it is last", () => {
    expect(cleanJsxText("a b\n  c d  ")).toBe("a b c d  ");
    expect(cleanJsxText("  a\n")).toBe("  a");
    expect(cleanJsxText("a  ")).toBe("a  ");
  });
  it("lines are joined with exactly one space", () => {
    expect(cleanJsxText("x\ny\nz")).toBe("x y z");
    expect(cleanJsxText("x\n\ny\n \nz\n")).toBe("x y z");
  });
});

describe("tagNameOf", () => {
  it("names identifiers, namespaces and members", () => {
    expect(tagNameOf(firstEl("const x = <div/>").openingElement.name)).toBe("div");
    expect(tagNameOf(firstEl("const x = <svg:rect/>").openingElement.name)).toBe("svg:rect");
    expect(tagNameOf(firstEl("const x = <ui.Button/>").openingElement.name)).toBe("ui.Button");
    expect(tagNameOf(firstEl("const x = <a.b.C/>").openingElement.name)).toBe("a.b.C");
    expect(tagNameOf(firstEl("const x = <this.Foo/>").openingElement.name)).toBe("this.Foo");
  });
});

describe("canNest", () => {
  it("rejects block starts inside p, accepts inline", () => {
    for (const c of ["div", "p", "ul", "ol", "h1", "table", "section", "form", "pre", "hr"]) {
      expect(canNest("p", c)).toBe(false);
    }
    expect(canNest("p", "span")).toBe(true);
    expect(canNest("p", "a")).toBe(true);
    expect(canNest("div", "p")).toBe(true);
    expect(canNest("div", "div")).toBe(true);
  });
  it("keeps table parts under their parents", () => {
    expect(canNest("table", "tbody")).toBe(true);
    expect(canNest("table", "thead")).toBe(true);
    expect(canNest("table", "tfoot")).toBe(true);
    expect(canNest("table", "caption")).toBe(true);
    expect(canNest("table", "colgroup")).toBe(true);
    expect(canNest("table", "tr")).toBe(false);
    expect(canNest("div", "tr")).toBe(false);
    expect(canNest("tbody", "tr")).toBe(true);
    expect(canNest("thead", "tr")).toBe(true);
    expect(canNest("tfoot", "tr")).toBe(true);
    expect(canNest("tr", "td")).toBe(true);
    expect(canNest("tr", "th")).toBe(true);
    expect(canNest("div", "td")).toBe(false);
    expect(canNest("div", "th")).toBe(false);
    expect(canNest("colgroup", "col")).toBe(true);
    expect(canNest("div", "col")).toBe(false);
    expect(canNest("div", "tbody")).toBe(false);
    expect(canNest("div", "caption")).toBe(false);
    expect(canNest("tr", "tr")).toBe(false);
  });
  it("only table parts go directly in table", () => {
    expect(canNest("table", "div")).toBe(false);
    expect(canNest("table", "span")).toBe(false);
    expect(canNest("table", "form")).toBe(false);
    expect(canNest("table", "col")).toBe(false);
    expect(canNest("table", "td")).toBe(false);
  });
  it("forbids self nesting of the listed elements", () => {
    for (const t of ["a", "button", "dd", "dt", "form", "li", "option", "optgroup"]) {
      expect(canNest(t, t)).toBe(false);
    }
    expect(canNest("span", "span")).toBe(true);
    expect(canNest("ul", "ul")).toBe(true);
    expect(canNest("li", "ul")).toBe(true);
    expect(canNest("ul", "li")).toBe(true);
    expect(canNest("a", "button")).toBe(true);
    expect(canNest("div", "form")).toBe(true);
  });
  it("forbids heading in heading, allows others", () => {
    for (const p of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(canNest(p, "h1")).toBe(false);
      expect(canNest(p, "h6")).toBe(false);
      expect(canNest(p, "span")).toBe(true);
    }
    expect(canNest("div", "h1")).toBe(true);
    expect(canNest("h1", "div")).toBe(true);
    expect(canNest("span", "h2")).toBe(true);
  });
  it("forbids dd and dt inside each other", () => {
    expect(canNest("dd", "dt")).toBe(false);
    expect(canNest("dt", "dd")).toBe(false);
    expect(canNest("dd", "dd")).toBe(false);
    expect(canNest("dt", "dt")).toBe(false);
    expect(canNest("dl", "dt")).toBe(true);
    expect(canNest("dl", "dd")).toBe(true);
    expect(canNest("dd", "span")).toBe(true);
    expect(canNest("dt", "span")).toBe(true);
    expect(canNest("div", "dd")).toBe(true);
    expect(canNest("div", "dt")).toBe(true);
  });
  it("select holds only option, optgroup and hr", () => {
    expect(canNest("select", "option")).toBe(true);
    expect(canNest("select", "optgroup")).toBe(true);
    expect(canNest("select", "hr")).toBe(true);
    expect(canNest("select", "div")).toBe(false);
    expect(canNest("select", "span")).toBe(false);
    expect(canNest("optgroup", "option")).toBe(true);
    expect(canNest("div", "option")).toBe(true);
  });
});

describe("bindsTo", () => {
  const a = analyze({
    path: "T.ts",
    source: "const x = 1; function f() { const x = 2; { const x = 3; x; } return x; }",
  });
  const inner = a.source.indexOf("x;");
  const mid = a.source.indexOf("return x") + 7;
  const outerDecl = a.decls.get("x") ?? [];
  it("picks the innermost declaring scope containing the position", () => {
    expect(outerDecl.length).toBe(3);
    const program = outerDecl.find((s) => s.start === 0);
    const fnScope = outerDecl.find((s) => s.start === a.source.indexOf("{ const x = 2"));
    const block = outerDecl.find((s) => s.start === a.source.indexOf("{ const x = 3"));
    expect(program).toBeDefined();
    expect(fnScope).toBeDefined();
    expect(block).toBeDefined();
    if (program === undefined || fnScope === undefined || block === undefined) return;
    expect(bindsTo(a, "x", inner, block)).toBe(true);
    expect(bindsTo(a, "x", inner, fnScope)).toBe(false);
    expect(bindsTo(a, "x", inner, program)).toBe(false);
    expect(bindsTo(a, "x", mid, fnScope)).toBe(true);
    expect(bindsTo(a, "x", mid, block)).toBe(false);
    expect(bindsTo(a, "x", 1, program)).toBe(true);
    expect(bindsTo(a, "x", 1, fnScope)).toBe(false);
  });
  it("requires both start and end of the scope to match", () => {
    const fnScope = outerDecl.find((s) => s.start === a.source.indexOf("{ const x = 2"));
    if (fnScope === undefined) throw new Error("no scope");
    expect(bindsTo(a, "x", mid, { start: fnScope.start, end: fnScope.end + 1 })).toBe(false);
    expect(bindsTo(a, "x", mid, { start: fnScope.start + 1, end: fnScope.end })).toBe(false);
    expect(bindsTo(a, "x", mid, { start: fnScope.start, end: fnScope.end })).toBe(true);
  });
  it("is false for unknown names", () => {
    expect(bindsTo(a, "nope", 3, { start: 0, end: a.source.length })).toBe(false);
  });
  it("scope boundaries: start inclusive, end exclusive", () => {
    const b = analyze({ path: "T.ts", source: "function f(x) { return x }" });
    const s = (b.decls.get("x") ?? [])[0];
    if (s === undefined) throw new Error("no scope");
    expect(bindsTo(b, "x", s.start, s)).toBe(true);
    expect(bindsTo(b, "x", s.end - 1, s)).toBe(true);
    expect(bindsTo(b, "x", s.end, s)).toBe(false);
    expect(bindsTo(b, "x", s.start - 1, s)).toBe(false);
  });
  it("same-start scopes prefer the one ending earlier", () => {
    const b = analyze({ path: "T.ts", source: "const f = function g() {}" });
    b.decls.set("n", [
      { start: 0, end: 20 },
      { start: 0, end: 10 },
      { start: 0, end: 15 },
    ]);
    expect(bindsTo(b, "n", 5, { start: 0, end: 10 })).toBe(true);
    expect(bindsTo(b, "n", 5, { start: 0, end: 20 })).toBe(false);
    expect(bindsTo(b, "n", 12, { start: 0, end: 15 })).toBe(true);
    b.decls.set("m", [
      { start: 0, end: 10 },
      { start: 0, end: 20 },
    ]);
    expect(bindsTo(b, "m", 5, { start: 0, end: 10 })).toBe(true);
    b.decls.set("k", [
      { start: 0, end: 20 },
      { start: 5, end: 20 },
      { start: 2, end: 20 },
    ]);
    expect(bindsTo(b, "k", 7, { start: 5, end: 20 })).toBe(true);
    expect(bindsTo(b, "k", 3, { start: 2, end: 20 })).toBe(true);
    b.decls.set("same", [
      { start: 3, end: 10 },
      { start: 3, end: 10 },
    ]);
    expect(bindsTo(b, "same", 4, { start: 3, end: 10 })).toBe(true);
  });
});

describe("patternNames", () => {
  const names = (src: string): string[] => {
    const a = analyze({ path: "T.ts", source: src });
    const out: string[] = [];
    for (const f of a.functions) for (const p of f.node.params) out.push(...patternNames(p));
    return out;
  };
  it("collects names from every pattern kind", () => {
    expect(names("function f(a) {}")).toEqual(["a"]);
    expect(names("function f({ a, b: [c, , d], ...e }) {}")).toEqual(["a", "c", "d", "e"]);
    expect(names("function f([a, [b]], ...r) {}")).toEqual(["a", "b", "r"]);
    expect(names("function f(a = 1, { b } = {}) {}")).toEqual(["a", "b"]);
    expect(names("class C { constructor(private x: number, public readonly y = 2) {} }")).toEqual(["x", "y"]);
    expect(names("function f({ a: { b = 2 } }) {}")).toEqual(["b"]);
    expect(names("function f(this: Foo, a) {}")).toEqual(["this", "a"]);
  });
});

describe("componentAt", () => {
  const a = analyze({
    path: "T.tsx",
    source: "function Outer() { const Inner = () => <b/>; const small = () => <i/>; return <a/>; }\nconst top = <u/>;",
  });
  it("finds the innermost capitalized function", () => {
    expect(componentAt(a, a.source.indexOf("<b/>"))?.name).toBe("Inner");
    expect(componentAt(a, a.source.indexOf("<i/>"))?.name).toBe("Outer");
    expect(componentAt(a, a.source.indexOf("<a/>"))?.name).toBe("Outer");
    expect(componentAt(a, a.source.indexOf("<u/>"))).toBeUndefined();
  });
  it("treats start inclusive and end exclusive", () => {
    const outer = a.functions.find((f) => f.name === "Outer");
    if (outer === undefined) throw new Error("none");
    expect(componentAt(a, outer.start)?.name).toBe("Outer");
    expect(componentAt(a, outer.end - 1)?.name).toBe("Outer");
    expect(componentAt(a, outer.end)).toBeUndefined();
    expect(componentAt(a, outer.start - 1)).toBeUndefined();
  });
  it("ignores lowercase and anonymous functions; keeps a smaller later one", () => {
    const b = analyze({
      path: "T.tsx",
      source: "export default function () { return <a/>; }\nfunction lower() { return <b/>; }",
    });
    expect(componentAt(b, b.source.indexOf("<a/>"))).toBeUndefined();
    expect(componentAt(b, b.source.indexOf("<b/>"))).toBeUndefined();
    const c = analyze({ path: "T.tsx", source: "function _A() { return <a/>; }" });
    expect(componentAt(c, c.source.indexOf("<a/>"))).toBeUndefined();
    const d = analyze({
      path: "T.tsx",
      source: "function Z() { return <a/>; } function A() { function B() { return <b/>; } return <c/>; }",
    });
    expect(componentAt(d, d.source.indexOf("<b/>"))?.name).toBe("B");
    expect(componentAt(d, d.source.indexOf("<c/>"))?.name).toBe("A");
  });
  it("prefers the smaller of two overlapping candidates regardless of order", () => {
    const e = analyze({ path: "T.tsx", source: "const Big = () => { const Small = () => <x/>; return Small; };" });
    expect(componentAt(e, e.source.indexOf("<x/>"))?.name).toBe("Small");
    // A and Z names around the capital-letter boundary
    const f = analyze({
      path: "T.tsx",
      source: "function A() { return <a/>; } function Z() { return <z/>; } function a1() { return <q/>; }",
    });
    expect(componentAt(f, f.source.indexOf("<a/>"))?.name).toBe("A");
    expect(componentAt(f, f.source.indexOf("<z/>"))?.name).toBe("Z");
    expect(componentAt(f, f.source.indexOf("<q/>"))).toBeUndefined();
    const g = analyze({ path: "T.tsx", source: "function xA() { return <a/>; }" });
    expect(componentAt(g, g.source.indexOf("<a/>"))).toBeUndefined();
  });
});

describe("staticValueOf", () => {
  const attrV = (src: string) => {
    const el = firstEl(src);
    const at = el.openingElement.attributes[0];
    if (at === undefined || at.type !== "JSXAttribute") throw new Error("no attr");
    return staticValueOf(at.value);
  };
  it("covers every value kind", () => {
    expect(staticValueOf(null)).toEqual({ text: "", encoded: false, bare: true });
    expect(attrV('const x = <i a="s&amp;t"/>')).toEqual({ text: "s&amp;t", encoded: true, bare: false });
    expect(attrV("const x = <i a={'s'}/>")).toEqual({ text: "s", encoded: false, bare: false });
    expect(attrV("const x = <i a={5}/>")).toEqual({ text: "5", encoded: false, bare: false });
    expect(attrV("const x = <i a={`t`}/>")).toEqual({ text: "t", encoded: false, bare: false });
    expect(attrV("const x = <i a={`t${1}`}/>")).toBeUndefined();
    expect(attrV("const x = <i a={true}/>")).toBeUndefined();
    expect(attrV("const x = <i a={null}/>")).toBeUndefined();
    expect(attrV("const x = <i a={y}/>")).toBeUndefined();
    expect(attrV("const x = <i a={/r/}/>")).toBeUndefined();
    expect(attrV("const x = <i a=<b/> />")).toBeUndefined();
    expect(attrV("const x = <i a={``}/>")).toEqual({ text: "", encoded: false, bare: false });
    expect(attrV("const x = <i a={0}/>")).toEqual({ text: "0", encoded: false, bare: false });
  });
});

describe("uiBaseElements", () => {
  it("maps local names of value imports of base elements", () => {
    const a = analyze({
      path: "T.tsx",
      source: [
        'import { Box, Text as T, Heading, Button, Link, Image, Input, TextArea, Select, Checkbox, Other, styles } from "@keel/ui"',
        'import { "Box" as StrBox } from "@keel/ui"',
        'import { type Text as TT } from "@keel/ui"',
        'import type { Image as II } from "@keel/ui"',
        'import { Box as NotUi } from "@keel/uix"',
        'import Def, * as NS from "@keel/ui"',
      ].join("\n"),
    });
    expect([...uiBaseElements(a)]).toEqual([
      ["Box", "Box"],
      ["T", "Text"],
      ["Heading", "Heading"],
      ["Button", "Button"],
      ["Link", "Link"],
      ["Image", "Image"],
      ["Input", "Input"],
      ["TextArea", "TextArea"],
      ["Select", "Select"],
      ["Checkbox", "Checkbox"],
      ["StrBox", "Box"],
    ]);
  });
  it("includes bases imported after a default specifier", () => {
    const a = analyze({ path: "T.tsx", source: 'import Def, { Box } from "@keel/ui"' });
    expect([...uiBaseElements(a)]).toEqual([["Box", "Box"]]);
    const b = analyze({ path: "T.tsx", source: 'import { type Box, Link } from "@keel/ui"' });
    expect([...uiBaseElements(b)]).toEqual([["Link", "Link"]]);
  });
});

describe("roleOf", () => {
  const role = (src: string, tag: string): string | null => roleOf(firstEl(src), tag);
  it("explicit role wins unless empty or bare", () => {
    expect(role('const x = <div role="button"/>', "div")).toBe("button");
    expect(role("const x = <div role={'tab'}/>", "div")).toBe("tab");
    expect(role('const x = <div role=""/>', "div")).toBe("generic");
    expect(role("const x = <div role/>", "div")).toBe("generic");
    expect(role("const x = <div role={r}/>", "div")).toBeNull();
    expect(role('const x = <div role=" tab  list"/>', "div")).toBe("tab");
  });
  it("anchors depend on href", () => {
    expect(role("const x = <a/>", "a")).toBe("generic");
    expect(role('const x = <a href="/"/>', "a")).toBe("link");
    expect(role("const x = <area/>", "area")).toBe("generic");
    expect(role("const x = <area href={h}/>", "area")).toBe("link");
  });
  it("img is presentation only for a literal empty alt (RFC 0030)", () => {
    expect(role('const x = <img alt=""/>', "img")).toBe("presentation");
    expect(role("const x = <img alt={''}/>", "img")).toBe("presentation");
    expect(role('const x = <img alt="Logo"/>', "img")).toBe("img");
    expect(role("const x = <img alt={a}/>", "img")).toBe("img");
    expect(role("const x = <img/>", "img")).toBe("img");
  });
  it("section is a region only when labelled (RFC 0030)", () => {
    expect(role("const x = <section/>", "section")).toBe("generic");
    expect(role('const x = <section aria-label="News"/>', "section")).toBe("region");
    expect(role("const x = <section aria-labelledby={h}/>", "section")).toBe("region");
  });
  it("select is a listbox when multiple or sized above 1, unknown when either is dynamic", () => {
    expect(role("const x = <select/>", "select")).toBe("combobox");
    expect(role('const x = <select size="1"/>', "select")).toBe("combobox");
    expect(role('const x = <select size="4"/>', "select")).toBe("listbox");
    expect(role("const x = <select multiple/>", "select")).toBe("listbox");
    expect(role("const x = <select multiple={m}/>", "select")).toBeNull();
    expect(role("const x = <select size={n}/>", "select")).toBeNull();
    expect(role("const x = <select multiple size={n}/>", "select")).toBe("listbox");
  });
  it("a spread attribute makes absent attributes unknown", () => {
    expect(role("const x = <div {...p}/>", "div")).toBeNull();
    expect(role('const x = <div {...p} role="tab"/>', "div")).toBe("tab");
  });
  it("inputs depend on type", () => {
    expect(role("const x = <input/>", "input")).toBe("textbox");
    expect(role("const x = <input type/>", "input")).toBe("textbox");
    expect(role("const x = <input type={t}/>", "input")).toBeNull();
    expect(role('const x = <input type="weird"/>', "input")).toBe("textbox");
    expect(role('const x = <input type="hidden"/>', "input")).toBe("none");
    for (const [t, r] of [
      ["button", "button"],
      ["checkbox", "checkbox"],
      ["image", "button"],
      ["number", "spinbutton"],
      ["radio", "radio"],
      ["range", "slider"],
      ["reset", "button"],
      ["search", "searchbox"],
      ["submit", "button"],
    ] as const) {
      expect(role(`const x = <input type="${t}"/>`, "input")).toBe(r);
    }
    expect(role('const x = <input type="CHECKBOX"/>', "input")).toBe("checkbox");
    expect(role('const x = <input type="Hidden"/>', "input")).toBe("none");
  });
  it("maps every implicit tag role", () => {
    const table: [string, string][] = [
      ["article", "article"],
      ["aside", "complementary"],
      ["button", "button"],
      ["details", "group"],
      ["dialog", "dialog"],
      ["div", "generic"],
      ["fieldset", "group"],
      ["footer", "contentinfo"],
      ["form", "form"],
      ["h1", "heading"],
      ["h2", "heading"],
      ["h3", "heading"],
      ["h4", "heading"],
      ["h5", "heading"],
      ["h6", "heading"],
      ["header", "banner"],
      ["hr", "separator"],
      ["img", "img"],
      ["li", "listitem"],
      ["main", "main"],
      ["menu", "list"],
      ["meter", "meter"],
      ["nav", "navigation"],
      ["ol", "list"],
      ["option", "option"],
      ["output", "status"],
      ["p", "paragraph"],
      ["progress", "progressbar"],
      ["search", "search"],
      ["section", "generic"],
      ["select", "combobox"],
      ["span", "generic"],
      ["table", "table"],
      ["tbody", "rowgroup"],
      ["td", "cell"],
      ["textarea", "textbox"],
      ["tfoot", "rowgroup"],
      ["th", "columnheader"],
      ["thead", "rowgroup"],
      ["tr", "row"],
      ["ul", "list"],
      ["blockquote", "blockquote"],
      ["caption", "caption"],
      ["code", "code"],
      ["datalist", "listbox"],
      ["dd", "definition"],
      ["del", "deletion"],
      ["dfn", "term"],
      ["dt", "term"],
      ["em", "emphasis"],
      ["figure", "figure"],
      ["ins", "insertion"],
      ["optgroup", "group"],
      ["strong", "strong"],
      ["sub", "subscript"],
      ["sup", "superscript"],
      ["time", "time"],
    ];
    for (const [tag, r] of table) expect(role(`const x = <${tag}/>`, tag)).toBe(r);
    expect(role("const x = <blink/>", "blink")).toBeNull();
    expect(role("const x = <label/>", "label")).toBeNull();
  });
});
