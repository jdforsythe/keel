// Mutation-killing tests for small internal helpers, buildDeps, nameSourceOf, unifiedPatch and friends.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { type JSXElement, parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { ModuleSchema } from "../src/ModuleSchema.ts";
import { analyze } from "../src/internal/analyze.ts";
import { applyEdits } from "../src/internal/applyEdits.ts";
import { attrNameOf } from "../src/internal/attrNameOf.ts";
import { canonicalJson } from "../src/internal/canonicalJson.ts";
import { componentFns } from "../src/internal/componentFns.ts";
import { coverage } from "../src/internal/coverage.ts";
import { diag } from "../src/internal/diag.ts";
import { exprOf } from "../src/internal/exprOf.ts";
import { fnv1a } from "../src/internal/fnv1a.ts";
import { lineCol } from "../src/internal/lineCol.ts";
import { lowerBound } from "../src/internal/lowerBound.ts";
import { nameSourceOf } from "../src/internal/nameSourceOf.ts";
import { propsNameOf } from "../src/internal/propsNameOf.ts";
import { unifiedPatch } from "../src/internal/unifiedPatch.ts";
import { module as moduleOf } from "../src/module.ts";

const elOf = (src: string): JSXElement => {
  const s = parseSync("x.tsx", src, { sourceType: "module", lang: "tsx" }).program.body[0];
  if (s?.type === "ExpressionStatement" && s.expression.type === "JSXElement") return s.expression;
  throw new Error("not an element");
};

describe("nameSourceOf (mutation)", () => {
  it("prefers aria-label and aria-labelledby", () => {
    expect(nameSourceOf(elOf("<div aria-label='x' />"), "div", null, false)).toBe("aria");
    expect(nameSourceOf(elOf("<div aria-labelledby='x' />"), "div", null, false)).toBe("aria");
    expect(nameSourceOf(elOf("<input aria-label='x' alt='y' />"), "input", null, true)).toBe("aria");
    expect(nameSourceOf(elOf("<div />"), "div", null, false)).toBe("none");
  });
  it("takes a non-empty alt only on img, area and input type=image (RFC 0030)", () => {
    for (const tag of ["img", "area"]) expect(nameSourceOf(elOf(`<${tag} alt='x' />`), tag, null, false)).toBe("alt");
    expect(nameSourceOf(elOf("<input type='IMAGE' alt='x' />"), "input", null, false)).toBe("alt");
    expect(nameSourceOf(elOf("<input alt='x' />"), "input", null, false)).toBe("none");
    expect(nameSourceOf(elOf("<input type='image' alt='x' />"), "input", null, true)).toBe("label");
    expect(nameSourceOf(elOf("<img alt={a} />"), "img", "img", false)).toBe("alt");
    expect(nameSourceOf(elOf("<area alt='' />"), "area", null, false)).toBe("none");
    expect(nameSourceOf(elOf("<div alt='x' />"), "div", null, false)).toBe("none");
    expect(nameSourceOf(elOf("<img />"), "img", null, false)).toBe("none");
    expect(nameSourceOf(elOf("<span alt='x' />"), "span", "button", false)).toBe("none");
  });
  it("labels labelable tags only when labelled", () => {
    for (const tag of ["input", "select", "textarea", "meter", "progress", "output"]) {
      expect(nameSourceOf(elOf(`<${tag} />`), tag, null, true)).toBe("label");
      expect(nameSourceOf(elOf(`<${tag} />`), tag, null, false)).toBe("none");
    }
    expect(nameSourceOf(elOf("<div />"), "div", null, true)).toBe("none");
    expect(nameSourceOf(elOf("<button />"), "button", null, true)).toBe("none");
  });
  it("names content roles from text and no other role", () => {
    const roles = [
      "button",
      "cell",
      "checkbox",
      "columnheader",
      "heading",
      "gridcell",
      "link",
      "menuitem",
      "menuitemcheckbox",
      "menuitemradio",
      "option",
      "radio",
      "row",
      "rowheader",
      "sectionhead",
      "switch",
      "tab",
      "tooltip",
      "treeitem",
    ];
    for (const role of roles) {
      expect(nameSourceOf(elOf("<b>x</b>"), "b", role, false), role).toBe("text");
      expect(nameSourceOf(elOf("<b>\n  </b>"), "b", role, false), role).toBe("none");
    }
    expect(nameSourceOf(elOf("<b>x</b>"), "b", "textbox", false)).toBe("none");
    expect(nameSourceOf(elOf("<b>x</b>"), "b", "listitem", false)).toBe("none");
    expect(nameSourceOf(elOf("<output>x</output>"), "output", "button", false)).toBe("none");
  });
  it("presentation and none roles are named by nothing (RFC 0030)", () => {
    expect(nameSourceOf(elOf("<img alt='' />"), "img", "presentation", false)).toBe("none");
    expect(nameSourceOf(elOf("<b aria-label='x'>y</b>"), "b", "none", false)).toBe("none");
    expect(nameSourceOf(elOf("<b>x</b>"), "b", null, false)).toBe("none");
  });
  it("recognizes text in expressions, elements and fragments but not in empty, element or function slots", () => {
    const t = (inner: string): string => nameSourceOf(elOf(`<b>${inner}</b>`), "b", "button", false);
    expect(t("{x}")).toBe("text");
    expect(t("{'s'}")).toBe("text");
    expect(t("<i>x</i>")).toBe("text");
    expect(t("<><i>{x}</i></>")).toBe("text");
    expect(t("  \n  <i/>")).toBe("none");
    expect(t("<><i/></>")).toBe("none");
    expect(t("{}")).toBe("none");
    expect(t("{<i/>}")).toBe("none");
    expect(t("{() => 1}")).toBe("none");
    expect(t("{function () {}}")).toBe("none");
    expect(t("<i/>{}x")).toBe("text");
    expect(t("{...x}")).toBe("none");
    expect(t("<i/>{...x}")).toBe("none");
  });
});

describe("coverage (mutation)", () => {
  it("answers containment over unsorted, overlapping and nested spans", () => {
    const c = coverage([
      { start: 40, end: 50 },
      { start: 0, end: 100 },
      { start: 10, end: 20 },
      { start: 200, end: 210 },
    ]);
    expect(c({ start: 30, end: 40 })).toBe(true);
    expect(c({ start: 0, end: 100 })).toBe(true);
    expect(c({ start: 60, end: 100 })).toBe(true);
    expect(c({ start: 60, end: 101 })).toBe(false);
    expect(c({ start: 150, end: 160 })).toBe(false);
    expect(c({ start: 200, end: 210 })).toBe(true);
    expect(c({ start: 205, end: 211 })).toBe(false);
  });
  it("is false before every span and for no spans, true at an equal start", () => {
    const c = coverage([{ start: 5, end: 10 }]);
    expect(c({ start: 4, end: 6 })).toBe(false);
    expect(c({ start: 5, end: 8 })).toBe(true);
    expect(c({ start: 5, end: 10 })).toBe(true);
    expect(c({ start: 5, end: 11 })).toBe(false);
    expect(coverage([])({ start: 0, end: 0 })).toBe(false);
    const many = coverage(Array.from({ length: 9 }, (_, i) => ({ start: i * 10, end: i * 10 + 5 })));
    for (let i = 0; i < 9; i++) {
      expect(many({ start: i * 10 + 1, end: i * 10 + 5 })).toBe(true);
      expect(many({ start: i * 10 + 6, end: i * 10 + 7 })).toBe(false);
    }
  });
});

describe("applyEdits and unifiedPatch (mutation)", () => {
  it("applies edits inside the window in order and skips overlaps", () => {
    expect(
      applyEdits("0123456789", 2, 8, [
        { start: 5, end: 6, text: "b" },
        { start: 3, end: 4, text: "a" },
        { start: 0, end: 1, text: "no" },
        { start: 7, end: 9, text: "no" },
        { start: 2, end: 3, text: "s" },
        { start: 7, end: 8, text: "e" },
      ]),
    ).toBe("sa4b6e");
    expect(
      applyEdits("0123456789", 0, 10, [
        { start: 2, end: 5, text: "X" },
        { start: 4, end: 6, text: "skipped" },
        { start: 5, end: 6, text: "Y" },
      ]),
    ).toBe("01XY6789");
    expect(
      applyEdits("0123456789", 0, 10, [
        { start: 2, end: 2, text: "I" },
        { start: 2, end: 3, text: "J" },
      ]),
    ).toBe("01IJ3456789");
  });

  const mk = (n: number, eol = true): string =>
    Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n") + (eol ? "\n" : "");
  const at = (src: string, lineNo: number): number =>
    src
      .split("\n")
      .slice(0, lineNo - 1)
      .join("\n").length + (lineNo > 1 ? 1 : 0);
  const rep = (src: string, lineNo: number, text: string) => {
    const s = at(src, lineNo);
    return { start: s, end: s + `line ${lineNo}`.length, text };
  };
  const P = (src: string, edits: { start: number; end: number; text: string }[]): string =>
    unifiedPatch("f.ts", src, edits);
  const H = "--- a/f.ts\n+++ b/f.ts\n";

  it("emits one hunk with three lines of context", () => {
    const s = mk(10);
    expect(P(s, [rep(s, 5, "LINE 5")])).toBe(
      `${H}@@ -2,7 +2,7 @@\n line 2\n line 3\n line 4\n-line 5\n+LINE 5\n line 6\n line 7\n line 8`,
    );
  });
  it("sorts edits, tracks the line delta and splits distant hunks", () => {
    const s = mk(30);
    expect(P(s, [rep(s, 20, "x"), rep(s, 3, "a\nb")])).toBe(
      `${H}@@ -1,6 +1,7 @@\n line 1\n line 2\n-line 3\n+a\n+b\n line 4\n line 5\n line 6\n@@ -17,7 +18,7 @@\n line 17\n line 18\n line 19\n-line 20\n+x\n line 21\n line 22\n line 23`,
    );
    expect(P(s, [rep(s, 4, "a\nb\nc"), rep(s, 12, "x"), rep(s, 25, "y\nz")])).toBe(
      `${H}@@ -1,7 +1,9 @@\n line 1\n line 2\n line 3\n-line 4\n+a\n+b\n+c\n line 5\n line 6\n line 7\n@@ -9,7 +11,7 @@\n line 9\n line 10\n line 11\n-line 12\n+x\n line 13\n line 14\n line 15\n@@ -22,7 +24,8 @@\n line 22\n line 23\n line 24\n-line 25\n+y\n+z\n line 26\n line 27\n line 28`,
    );
  });
  it("merges hunks whose context touches but not ones with a gap", () => {
    const s = mk(30);
    expect(P(s, [rep(s, 5, "x"), rep(s, 12, "y")])).toBe(
      `${H}@@ -2,14 +2,14 @@\n line 2\n line 3\n line 4\n-line 5\n+x\n line 6\n line 7\n line 8\n line 9\n line 10\n line 11\n-line 12\n+y\n line 13\n line 14\n line 15`,
    );
    expect(P(s, [rep(s, 5, "x"), rep(s, 13, "y")])).toBe(
      `${H}@@ -2,7 +2,7 @@\n line 2\n line 3\n line 4\n-line 5\n+x\n line 6\n line 7\n line 8\n@@ -10,7 +10,7 @@\n line 10\n line 11\n line 12\n-line 13\n+y\n line 14\n line 15\n line 16`,
    );
  });
  it("groups edits on one line or on adjacent lines", () => {
    const s = mk(30);
    const l5 = at(s, 5);
    expect(
      P(s, [
        { start: l5, end: l5 + 4, text: "L" },
        { start: l5 + 5, end: l5 + 6, text: "N" },
      ]),
    ).toBe(`${H}@@ -2,7 +2,7 @@\n line 2\n line 3\n line 4\n-line 5\n+L N\n line 6\n line 7\n line 8`);
    expect(P(s, [rep(s, 5, "x"), rep(s, 6, "y")])).toBe(
      `${H}@@ -2,8 +2,8 @@\n line 2\n line 3\n line 4\n-line 5\n+x\n-line 6\n+y\n line 7\n line 8\n line 9`,
    );
  });
  it("covers multi-line edits, insertions and starts at a line start", () => {
    const s = mk(30);
    expect(P(s, [{ start: at(s, 5), end: at(s, 6) + 6, text: "Z" }])).toBe(
      `${H}@@ -2,8 +2,7 @@\n line 2\n line 3\n line 4\n-line 5\n-line 6\n+Z\n line 7\n line 8\n line 9`,
    );
    expect(P(s, [{ start: at(s, 5) + 2, end: at(s, 7) + 2, text: "Z\nY\nX" }])).toBe(
      `${H}@@ -2,9 +2,9 @@\n line 2\n line 3\n line 4\n-line 5\n-line 6\n-line 7\n+liZ\n+Y\n+Xne 7\n line 8\n line 9\n line 10`,
    );
    expect(P(s, [{ start: at(s, 5), end: at(s, 5), text: "new\n" }])).toBe(
      `${H}@@ -2,7 +2,8 @@\n line 2\n line 3\n line 4\n-line 5\n+new\n+line 5\n line 6\n line 7\n line 8`,
    );
    expect(P(s, [{ start: at(s, 16), end: at(s, 16) + 1, text: "L" }])).toBe(
      `${H}@@ -13,7 +13,7 @@\n line 13\n line 14\n line 15\n-line 16\n+Line 16\n line 17\n line 18\n line 19`,
    );
    expect(P(s, [{ start: at(s, 8), end: at(s, 9) + 6, text: "" }])).toBe(
      `${H}@@ -5,8 +5,7 @@\n line 5\n line 6\n line 7\n-line 8\n-line 9\n+\n line 10\n line 11\n line 12`,
    );
  });
  it("clamps context at the file edges and marks a missing final newline", () => {
    const s = mk(30);
    expect(P(s, [rep(s, 1, "x")])).toBe(`${H}@@ -1,4 +1,4 @@\n-line 1\n+x\n line 2\n line 3\n line 4`);
    expect(P(s, [rep(s, 30, "x")])).toBe(`${H}@@ -27,4 +27,4 @@\n line 27\n line 28\n line 29\n-line 30\n+x`);
    const n = mk(12, false);
    expect(P(n, [rep(n, 12, "x")])).toBe(
      `${H}@@ -9,4 +9,4 @@\n line 9\n line 10\n line 11\n-line 12\n\\ No newline at end of file\n+x\n\\ No newline at end of file`,
    );
    expect(P(n, [rep(n, 10, "x")])).toBe(
      `${H}@@ -7,6 +7,6 @@\n line 7\n line 8\n line 9\n-line 10\n+x\n line 11\n line 12\n\\ No newline at end of file`,
    );
    const one = mk(1, false);
    expect(P(one, [rep(one, 1, "x")])).toBe(
      `${H}@@ -1,1 +1,1 @@\n-line 1\n\\ No newline at end of file\n+x\n\\ No newline at end of file`,
    );
  });
});

describe("buildDeps (mutation)", () => {
  it("emits the exact reactive graph", () => {
    const src = `import { signal, computed, effect, resource } from '@keel/reactive'
const count = signal(0);
const other = signal(1);
const dbl = computed(() => count.get() * 2);
const sum = computed(() => dbl.get() + other.get() + dbl.get());
const self = computed(() => self2.get());
const self2 = computed(() => self.get() + count.get());
effect(() => { console.log(sum.get()); });
effect(() => { console.log(count.get()); });
export default function C(props) {
  return <div title={count.get()} class={count.get()} onclick={() => count.set(1)}>
    <p>{dbl.get()}</p><p>{dbl.get()}</p><b>{props.name}{props.name}{props.other}</b>
    <i class={other.get()} data-x={props.name}>{unknown.get()}</i>
  </div>
}
`;
    const f = "src/c.tsx";
    const edge = (from: string, to: string) => ({ from, to });
    const bind = (id: string, name: string) => ({ id, kind: "binding", name, file: f });
    const node = (id: string, kind: string, name: string) => ({ id, kind, name, file: f });
    const deps = compile([{ path: f, source: src }]).artifacts["deps.json"];
    expect(deps.edges).toEqual([
      edge(`${f}#count`, "src.c.0:attr:class"),
      edge(`${f}#count`, "src.c.0:attr:title"),
      edge(`${f}#count`, `${f}#dbl`),
      edge(`${f}#count`, `${f}#effect@9:1`),
      edge(`${f}#count`, `${f}#self2`),
      edge(`${f}#dbl`, "src.c.1:text:#text"),
      edge(`${f}#dbl`, "src.c.2:text:#text"),
      edge(`${f}#dbl`, `${f}#sum`),
      edge(`${f}#other`, "src.c.4:attr:class"),
      edge(`${f}#other`, `${f}#sum`),
      edge(`${f}#props.name`, "src.c.3:text:#text"),
      edge(`${f}#props.name`, "src.c.3:text:#text:1"),
      edge(`${f}#props.name`, "src.c.4:attr:data-x"),
      edge(`${f}#props.other`, "src.c.3:text:#text:2"),
      edge(`${f}#self`, `${f}#self2`),
      edge(`${f}#self2`, `${f}#self`),
      edge(`${f}#sum`, `${f}#effect@8:1`),
    ]);
    expect(deps.nodes).toEqual([
      bind("src.c.0:attr:class", "attr class"),
      bind("src.c.0:attr:title", "attr title"),
      bind("src.c.0:on:click", "on click"),
      bind("src.c.1:text:#text", "text #text"),
      bind("src.c.2:text:#text", "text #text"),
      bind("src.c.3:text:#text", "text #text"),
      bind("src.c.3:text:#text:1", "text #text"),
      bind("src.c.3:text:#text:2", "text #text"),
      bind("src.c.4:attr:class", "attr class"),
      bind("src.c.4:attr:data-x", "attr data-x"),
      bind("src.c.4:text:#text", "text #text"),
      node(`${f}#count`, "signal", "count"),
      node(`${f}#dbl`, "computed", "dbl"),
      node(`${f}#effect@8:1`, "effect", "effect@8:1"),
      node(`${f}#effect@9:1`, "effect", "effect@9:1"),
      node(`${f}#other`, "signal", "other"),
      node(`${f}#props.name`, "prop", "name"),
      node(`${f}#props.other`, "prop", "other"),
      node(`${f}#self`, "computed", "self"),
      node(`${f}#self2`, "computed", "self2"),
      node(`${f}#sum`, "computed", "sum"),
    ]);
  });

  it("scopes reactive names per file and keeps a reactive read outside its own init out of edges", () => {
    const r = compile([
      {
        path: "a.tsx",
        source: `import { signal, effect } from '@keel/reactive'\nconst x = signal(0);\nconst y = signal(x.get());\neffect(() => x.get());\nsignal(x);\nexport default function A() { return <p>{x.get()}</p> }`,
      },
      {
        path: "b.tsx",
        source: `import { signal } from '@keel/reactive'\nconst x = signal(0);\nexport default function B() { return <p>{x.get()}</p> }`,
      },
    ]);
    expect(r.artifacts["deps.json"].edges).toEqual([
      { from: "a.tsx#x", to: "a.0:text:#text" },
      { from: "a.tsx#x", to: "a.tsx#effect@4:1" },
      { from: "a.tsx#x", to: "a.tsx#y" },
      { from: "b.tsx#x", to: "b.0:text:#text" },
    ]);
  });
});

describe("small helpers (mutation)", () => {
  it("lineCol counts lines and columns, clamping the offset", () => {
    expect(lineCol("ab\ncd\nef", 0)).toEqual({ line: 1, col: 1 });
    expect(lineCol("ab\ncd\nef", 2)).toEqual({ line: 1, col: 3 });
    expect(lineCol("ab\ncd\nef", 3)).toEqual({ line: 2, col: 1 });
    expect(lineCol("ab\ncd\nef", 4)).toEqual({ line: 2, col: 2 });
    expect(lineCol("ab\ncd\nef", 7)).toEqual({ line: 3, col: 2 });
    expect(lineCol("ab\ncd\nef", 8)).toEqual({ line: 3, col: 3 });
    expect(lineCol("ab\ncd\nef", 99)).toEqual({ line: 3, col: 3 });
    expect(lineCol("ab\n", 99)).toEqual({ line: 2, col: 1 });
    expect(lineCol("a\n\n\nb", 4)).toEqual({ line: 4, col: 1 });
  });

  it("diag carries a fix only when given", () => {
    const a = analyze({ path: "p.tsx", source: "ab\ncd" });
    expect(diag(a, "E1", 3, "m", "see")).toEqual({
      code: "E1",
      path: "p.tsx",
      line: 2,
      col: 1,
      message: "m",
      see: "see",
    });
    expect(Object.keys(diag(a, "E1", 3, "m", "see"))).toEqual(["code", "path", "line", "col", "message", "see"]);
    expect(diag(a, "E1", 3, "m", "see", "patch")).toEqual({
      code: "E1",
      path: "p.tsx",
      line: 2,
      col: 1,
      message: "m",
      see: "see",
      fix: "patch",
    });
    expect(diag(a, "E1", 0, "m", "see", "").fix).toBe("");
  });

  it("canonicalJson sorts keys at every depth and keeps arrays and primitives", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}',
    );
    expect(canonicalJson("s")).toBe('"s"');
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson([2, 1])).toBe("[2,1]");
    expect(canonicalJson(JSON.parse('{"__proto__":1,"a":2}'))).toBe('{"__proto__":1,"a":2}');
    expect(canonicalJson({ b: { y: 1, x: 2 }, a: 1 })).toBe('{"a":1,"b":{"x":2,"y":1}}');
  });

  it("lowerBound finds the first start >= pos", () => {
    const items = [{ start: 2 }, { start: 4 }, { start: 4 }, { start: 8 }];
    expect(lowerBound(items, 0)).toBe(0);
    expect(lowerBound(items, 2)).toBe(0);
    expect(lowerBound(items, 3)).toBe(1);
    expect(lowerBound(items, 4)).toBe(1);
    expect(lowerBound(items, 5)).toBe(3);
    expect(lowerBound(items, 8)).toBe(3);
    expect(lowerBound(items, 9)).toBe(4);
    expect(lowerBound([], 1)).toBe(0);
    expect(lowerBound([{ start: 1 }], 1)).toBe(0);
    expect(lowerBound([{ start: 1 }], 2)).toBe(1);
  });

  it("fnv1a hashes UTF-16 units to 8 padded hex digits", () => {
    expect(fnv1a("")).toBe("811c9dc5");
    expect(fnv1a("a")).toBe("e40c292c");
    expect(fnv1a("hello")).toBe("4f9f2cab");
    expect(fnv1a("68")).toBe("0de8d5a3");
  });

  it("attrNameOf and exprOf read JSX attributes", () => {
    const el = elOf(`<a xlink:href="x" aria-label={y} b="s" c={} d e={1 + 2} />`);
    const names = el.openingElement.attributes.flatMap((at) =>
      at.type === "JSXAttribute" ? [attrNameOf(at.name)] : [],
    );
    expect(names).toEqual(["xlink:href", "aria-label", "b", "c", "d", "e"]);
    const get = (n: string) => {
      const at = el.openingElement.attributes.find((x) => x.type === "JSXAttribute" && attrNameOf(x.name) === n);
      return at?.type === "JSXAttribute" ? at : undefined;
    };
    expect(exprOf(get("aria-label"))?.type).toBe("Identifier");
    expect(exprOf(get("e"))?.type).toBe("BinaryExpression");
    expect(exprOf(get("b"))).toBeUndefined();
    expect(exprOf(get("c"))).toBeUndefined();
    expect(exprOf(get("d"))).toBeUndefined();
    expect(exprOf(undefined)).toBeUndefined();
  });

  it("propsNameOf names an identifier first parameter only", () => {
    const fns = analyze({
      path: "p.tsx",
      source: "function A(props) {}\nfunction B({ a }) {}\nfunction C() {}\nfunction D(...rest) {}",
    }).functions;
    expect(fns.map((f) => propsNameOf(f))).toEqual(["props", undefined, undefined, undefined]);
    expect(propsNameOf(undefined)).toBeUndefined();
  });

  it("componentFns picks capitalized or default-exported functions that render JSX", () => {
    const names = (src: string): (string | null)[] =>
      componentFns(analyze({ path: "p.tsx", source: src })).map((f) => f.name);
    expect(
      names(
        "function A() { return 1 }\nfunction B() { return <p/> }\nfunction lower() { return <p/> }\nfunction aB() { return <p/> }\nconst C = () => <p/>;\nconst d = () => <p/>;",
      ),
    ).toEqual(["B", "C"]);
    expect(names("export default function page() { return <p/> }")).toEqual(["page"]);
    expect(names("export default () => <p/>")).toEqual([null]);
    expect(names("export const x = 1;\nexport function lower() { return <p/> }")).toEqual([]);
  });
});

describe("evaluate and module (mutation)", () => {
  it("evaluates a default export, and gives undefined for none or a non-object export", () => {
    expect(evaluate("export default 5")).toBe(5);
    expect(evaluate("export const a = 1")).toBeUndefined();
    expect(evaluate("module.exports = null")).toBeUndefined();
    expect(evaluate("module.exports = 's'")).toBeUndefined();
  });
  it("only resolves kernel modules and the given modules", () => {
    expect(() => evaluate("import x from 'nope'; export default x")).toThrow(
      'evaluate: cannot require "nope" (kernel modules and the given modules only)',
    );
    expect(typeof evaluate("import { signal } from '@keel/reactive'; export default signal")).toBe("function");
    expect(evaluate("import { v } from 'probe'; export default v", { probe: { v: 7 } })).toBe(7);
    expect(
      evaluate("import { signal } from '@keel/reactive'; export default signal", { "@keel/reactive": { signal: 1 } }),
    ).toBe(1);
    expect(() => evaluate("import x from 'toString'; export default x")).toThrow(/cannot require "toString"/);
  });
  it("reports the clipped id of a non-lowerCamel module", () => {
    const def = { id: "A".repeat(40), deps: [], capabilities: [], public: { exports: [] } };
    const msg = `id "${"A".repeat(30)}" is not lowerCamel`;
    expect(ModuleSchema.parse(def)).toEqual({
      ok: false,
      error: { code: "schema.invalid", message: msg, data: { issues: [{ path: ["id"], rule: "type" }] } },
    });
    expect(() => moduleOf(def)).toThrow(`module manifest: ${msg}`);
    expect(() => ModuleSchema.encode(def)).toThrow(`module manifest: ${msg}`);
  });
});
