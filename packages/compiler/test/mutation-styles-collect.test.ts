// Mutation-killing tests for collectStyles and collectElements.
import { describe, expect, it } from "vitest";
import { analyze } from "../src/internal/analyze.ts";
import { collectElements } from "../src/internal/collectElements.ts";
import { collectStyles } from "../src/internal/collectStyles.ts";

const UI = 'import { Box, Text, styles } from "@keel/ui";\n';
const styled = (src: string, path = "T.tsx") => collectStyles(analyze({ path, source: src }));
const use = (src: string) => styled(src).usages;
const rewriteOf = (src: string) => {
  const r = styled(src).rewrites;
  const all = [...r.entries()];
  expect(all.length).toBe(1);
  const e = all[0];
  if (e === undefined) throw new Error("no rewrite");
  return { start: e[0], drop: [...e[1].drop].sort((x, y) => x - y), className: e[1].className };
};

describe("collectStyles: imports", () => {
  it("finds nothing without ui imports", () => {
    expect(styled('const x = <Box p="2"/>').usages).toEqual([]);
    expect(styled('import { Box } from "other"; const x = <Box p="2"/>').usages).toEqual([]);
    expect(styled('import { Box } from "@keel/uix"; const x = <Box p="2"/>').usages).toEqual([]);
    expect(styled('import type { Box } from "@keel/ui"; const x = <Box p="2"/>').usages).toEqual([]);
    expect(styled('import { type Box } from "@keel/ui"; const x = <Box p="2"/>').usages).toEqual([]);
    expect(styled('import { Other } from "@keel/ui"; const x = <Other p="2"/>').usages).toEqual([]);
    expect(styled('import { type styles } from "@keel/ui"; styles({ s: { p: "2" } })').usages).toEqual([]);
    expect(styled('import type { styles } from "@keel/ui"; styles({ s: { p: "2" } })').usages).toEqual([]);
    expect(styled('import { styles } from "other"; styles({ s: { p: "2" } })').usages).toEqual([]);
    expect(styled('import { stylesX } from "@keel/ui"; stylesX({ s: { p: "2" } })').usages).toEqual([]);
  });
  it("supports aliases and string-literal import names", () => {
    expect(styled('import { Box as B } from "@keel/ui"; const x = <B p="2"/>').usages).toEqual([{ props: { p: "2" } }]);
    expect(styled('import { styles as st } from "@keel/ui"; st({ s: { p: "2" } })').usages).toEqual([
      { props: { p: "2" } },
    ]);
    expect(styled('import { "styles" as st } from "@keel/ui"; st({ s: { p: "3" } })').usages).toEqual([
      { props: { p: "3" } },
    ]);
    expect(styled('import Def, { styles } from "@keel/ui"; styles({ s: { p: "4" } })').usages).toEqual([
      { props: { p: "4" } },
    ]);
    expect(styled('import * as ui from "@keel/ui"; ui.styles({ s: { p: "4" } })').usages).toEqual([]);
  });
  it("ignores non-base JSX names", () => {
    expect(use(`${UI}const x = <Other p="2"/>;`)).toEqual([]);
    expect(use(`${UI}const x = <Box.Inner p="2"/>;`)).toEqual([]);
    expect(use(`${UI}const x = <ui:Box p="2"/>;`)).toEqual([]);
    expect(use(`${UI}const x = <></>;`)).toEqual([]);
  });
});

describe("collectStyles: styles() calls", () => {
  it("collects plain, responsive and state props", () => {
    const u = use(
      `${UI}styles({ s: { p: "2", bg: { base: "a", md: "b" }, states: { hover: { fg: "c" }, focusVisible: { w: "1" }, active: { h: "2" }, disabled: { m: "3" } } } });`,
    );
    expect(u).toEqual([
      { props: { bg: "a" } },
      { props: { bg: "b" }, breakpoint: "md" },
      { props: { fg: "c" }, state: "hover" },
      { props: { h: "2" }, state: "active" },
      { props: { m: "3" }, state: "disabled" },
      { props: { p: "2" } },
      { props: { w: "1" }, state: "focusVisible" },
    ]);
  });
  it("sorts by the JSON key [prop, token, breakpoint, state]", () => {
    expect(use(`${UI}styles({ s: { p: "b", m: "a", gap: { base: "z", md: "y" } } });`)).toEqual([
      { props: { gap: "y" }, breakpoint: "md" },
      { props: { gap: "z" } },
      { props: { m: "a" } },
      { props: { p: "b" } },
    ]);
  });
  it("de-duplicates identical leaves, keeping distinct tokens, breakpoints and states", () => {
    const u = use(
      `${UI}styles({ s: { p: "2" } }); styles({ s: { p: "2" } }); styles({ s: { p: { base: "2", md: "2" } } }); styles({ s: { states: { hover: { p: "2" } } } }); styles({ s: { m: "2" } }); styles({ s: { p: "3" } });`,
    );
    expect(u).toEqual([
      { props: { m: "2" } },
      { props: { p: "2" } },
      { props: { p: "2" }, state: "hover" },
      { props: { p: "2" }, breakpoint: "md" },
      { props: { p: "3" } },
    ]);
  });
  it("skips calls that are not simple styles(object) calls", () => {
    expect(
      use(`${UI}styles(); styles(...a); styles(x); styles("p"); obj.styles({ s: { p: "2" } }); other({ p: "2" });`),
    ).toEqual([]);
    expect(use(`${UI}styles(...[{ p: "9" }]);`)).toEqual([]);
    expect(use(`${UI}styles({ s: { ...a, p: "2" } });`)).toEqual([{ props: { p: "2" } }]);
    expect(use(`${UI}styles({ s: { [k]: "2", "m": "1", 3: "x" } });`)).toEqual([{ props: { m: "1" } }]);
  });
  it("handles value shapes: numbers, templates, parens, ternaries, logicals", () => {
    expect(use(`${UI}styles({ s: { p: 4, m: \`5\`, gap: ("6") } });`)).toEqual([
      { props: { gap: "6" } },
      { props: { m: "5" } },
      { props: { p: "4" } },
    ]);
    expect(use(`${UI}styles({ s: { p: a ? "1" : "2", m: a && "3", gap: a || "4", w: a ?? "5" } });`)).toEqual([
      { props: { gap: "4" } },
      { props: { m: "3" } },
      { props: { p: "1" } },
      { props: { p: "2" } },
      { props: { w: "5" } },
    ]);
    expect(use(`${UI}styles({ s: { p: a ? (b ? "1" : "2") : "3" } });`)).toEqual([
      { props: { p: "1" } },
      { props: { p: "2" } },
      { props: { p: "3" } },
    ]);
    expect(use(`${UI}styles({ s: { p: \`a\${x}\`, m: x, gap: true, w: null, h: f() } });`)).toEqual([]);
    expect(use(`${UI}styles({ s: { p: a ? x : "1" } });`)).toEqual([{ props: { p: "1" } }]);
    expect(use(`${UI}styles({ s: { p: { md: x, lg: "1" } } });`)).toEqual([{ props: { p: "1" }, breakpoint: "lg" }]);
  });
  it("handles odd keys and unknown props", () => {
    expect(
      use(`${UI}styles({ s: { p: { "md": "1", 2: "2", [k]: "3", ...s, get g() { return "4"; }, m() {} } } });`),
    ).toEqual([
      { props: { p: "1" }, breakpoint: "md" },
      { props: { p: "2" }, breakpoint: "2" },
    ]);
    expect(use(`${UI}styles({ s: { unknown: "1", states: { hover: { p: "1" }, bogus: { p: "2" } } } });`)).toEqual([
      { props: { p: "1" }, state: "hover" },
    ]);
    expect(use(`${UI}styles({ s: { states: x } });`)).toEqual([]);
    expect(use(`${UI}styles({ s: { states: { [k]: { p: "1" }, hover: x, active: { p: "5" } } } });`)).toEqual([
      { props: { p: "5" }, state: "active" },
    ]);
    expect(use(`${UI}styles({ s: { states: { hover: { states: { active: { p: "1" } }, m: "2" } } } });`)).toEqual([
      { props: { m: "2" }, state: "hover" },
    ]);
    expect(use(`${UI}styles({ s: { "p": "1", get m() { return "2"; } } });`)).toEqual([{ props: { p: "1" } }]);
  });
  it("accepts every style prop name", () => {
    const names = [
      "p",
      "px",
      "py",
      "m",
      "mx",
      "my",
      "gap",
      "w",
      "h",
      "bg",
      "fg",
      "radius",
      "font",
      "fontSize",
      "weight",
      "shadow",
      "direction",
      "align",
      "justify",
      "wrap",
    ];
    const u = use(`${UI}styles({ s: { ${names.map((n) => `${n}: "v"`).join(", ")} } });`);
    expect(u.map((x) => Object.keys(x.props)[0]).sort()).toEqual([...names].sort());
  });
});

describe("collectStyles: base elements usages", () => {
  it("collects string, braces and expression values", () => {
    const u = use(`${UI}const x = <Box p="2" m={"3"} gap={{ base: "1", lg: "4" }} />;`);
    expect(u).toEqual([
      { props: { gap: "1" } },
      { props: { gap: "4" }, breakpoint: "lg" },
      { props: { m: "3" } },
      { props: { p: "2" } },
    ]);
  });
  it("collects states objects, and ignores string states and other attributes", () => {
    expect(use(`${UI}const x = <Box states={{ hover: { bg: "a" } }} id="i" foo="bar" />;`)).toEqual([
      { props: { bg: "a" }, state: "hover" },
    ]);
    expect(use(`${UI}const x = <Box states="hover" />;`)).toEqual([]);
    expect(use(`${UI}const x = <Box p />;`)).toEqual([]);
    expect(use(`${UI}const x = <Box p={} />;`)).toEqual([]);
    expect(use(`${UI}const x = <Box p=<b/> />;`)).toEqual([]);
    expect(use(`${UI}const x = <Box states={x} />;`)).toEqual([]);
    expect(use(`${UI}const x = <Box p={a ? "1" : "2"} />;`)).toEqual([{ props: { p: "1" } }, { props: { p: "2" } }]);
  });
  it("walks nested and fragment-wrapped elements", () => {
    expect(use(`${UI}const x = <><Box p="1"><Text m="2"/></Box></>;`)).toEqual([
      { props: { m: "2" } },
      { props: { p: "1" } },
    ]);
  });
});

describe("collectStyles: rewrites", () => {
  it("rewrites fully static attributes into one class", () => {
    const src = `${UI}const x = <Box p="2" bg="accent" id="i" />;`;
    const r = rewriteOf(src);
    expect(r.start).toBe(src.indexOf("<Box"));
    expect(r.drop).toEqual([src.indexOf('p="2"'), src.indexOf('bg="accent"')]);
    expect(r.className).toBe("k-p-2 k-bg-accent");
  });
  it("orders classes: plain by prop order, then states, base before breakpoints", () => {
    const r = rewriteOf(
      `${UI}const x = <Box wrap="a" gap={{ md: "2", base: "1", lg: "3" }} p="1" states={{ disabled: { m: "1" }, hover: { bg: "b", p: "1" }, active: { m: "2" } }} />;`,
    );
    expect(r.className).toBe(
      [
        "k-p-1",
        "k-gap-1",
        "k-lg-gap-3",
        "k-md-gap-2",
        "k-wrap-a",
        "k-hover-p-1",
        "k-hover-bg-b",
        "k-active-m-2",
        "k-disabled-m-1",
      ].join(" "),
    );
  });
  it("orders a plain prop before a state prop even when the prop index is higher", () => {
    expect(rewriteOf(`${UI}const x = <Box bg="b" states={{ hover: { p: "1" } }} />;`).className).toBe(
      "k-bg-b k-hover-p-1",
    );
    expect(rewriteOf(`${UI}const x = <Box states={{ hover: { p: "1" } }} bg="b" />;`).className).toBe(
      "k-bg-b k-hover-p-1",
    );
    expect(rewriteOf(`${UI}const x = <Box p="1" states={{ hover: { bg: "b" } }} />;`).className).toBe(
      "k-p-1 k-hover-bg-b",
    );
    expect(rewriteOf(`${UI}const x = <Box states={{ hover: { bg: "b" } }} p="1" />;`).className).toBe(
      "k-p-1 k-hover-bg-b",
    );
    expect(rewriteOf(`${UI}const x = <Box states={{ active: { p: "1" }, hover: { bg: "b" } }} />;`).className).toBe(
      "k-hover-bg-b k-active-p-1",
    );
    expect(rewriteOf(`${UI}const x = <Box states={{ hover: { p: "1", bg: "b" } }} />;`).className).toBe(
      "k-hover-p-1 k-hover-bg-b",
    );
    expect(rewriteOf(`${UI}const x = <Box states={{ hover: { bg: "b", p: "1" } }} />;`).className).toBe(
      "k-hover-p-1 k-hover-bg-b",
    );
    expect(rewriteOf(`${UI}const x = <Box bg={{ md: "1", base: "2" }} />;`).className).toBe("k-bg-2 k-md-bg-1");
    expect(rewriteOf(`${UI}const x = <Box bg={{ lg: "1", md: "2" }} />;`).className).toBe("k-lg-bg-1 k-md-bg-2");
    expect(rewriteOf(`${UI}const x = <Box bg={{ md: "2", lg: "1" }} />;`).className).toBe("k-lg-bg-1 k-md-bg-2");
    expect(rewriteOf(`${UI}const x = <Box p="1" p="1" />;`).className).toBe("k-p-1 k-p-1");
  });
  it("sorts breakpoint 'base' keys before named ones and equal ranks stay", () => {
    expect(rewriteOf(`${UI}const x = <Box p={{ base: "1", md: "1" }} />;`).className).toBe("k-p-1 k-md-p-1");
    expect(rewriteOf(`${UI}const x = <Box p={{ md: "1", base: "1" }} />;`).className).toBe("k-p-1 k-md-p-1");
  });
  it("merges a literal class/className after the computed classes and drops it", () => {
    const src = `${UI}const x = <Box className=" keep  more " p="1" />;`;
    const r = rewriteOf(src);
    expect(r.drop).toEqual([src.indexOf("className"), src.indexOf('p="1"')]);
    expect(r.className).toBe("k-p-1 keep more");
    const src2 = `${UI}const x = <Box class={"c"} p="1" />;`;
    const r2 = rewriteOf(src2);
    expect(r2.className).toBe("k-p-1 c");
    expect(r2.drop).toEqual([src2.indexOf("class"), src2.indexOf('p="1"')]);
    expect(rewriteOf(`${UI}const x = <Box class="" p="1" />;`).className).toBe("k-p-1");
    expect(rewriteOf(`${UI}const x = <Box class="a" p="1" class="b" />;`).className).toBe("k-p-1 b");
  });
  it("does not rewrite with a bare, dynamic class or any spread", () => {
    expect(styled(`${UI}const x = <Box class p="1" />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box className={c} p="1" />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box {...r} p="1" />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box p="1" {...r} />;`).rewrites.size).toBe(0);
    // the usages are still collected
    expect(use(`${UI}const x = <Box {...r} p="1" />;`)).toEqual([{ props: { p: "1" } }]);
    expect(use(`${UI}const x = <Box class p="1" />;`)).toEqual([{ props: { p: "1" } }]);
  });
  it("does not rewrite when nothing is static", () => {
    expect(styled(`${UI}const x = <Box id="a" />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box class="a" />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box p={a} />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box p={a ? "1" : "2"} />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box states="x" />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box p />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box p={} />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Other p="1" />;`).rewrites.size).toBe(0);
    expect(styled(`${UI}const x = <Box.A p="1" />;`).rewrites.size).toBe(0);
  });
  it("keeps dynamic attributes but rewrites the static ones", () => {
    const src = `${UI}const x = <Box p="1" m={a ? "1" : "2"} bg={{ base: "a", md: x }} gap={{ ...s }} />;`;
    const r = rewriteOf(src);
    expect(r.drop).toEqual([src.indexOf('p="1"')]);
    expect(r.className).toBe("k-p-1");
  });
  it("treats an object with a computed key or unsupported property as dynamic", () => {
    const src = `${UI}const x = <Box p="1" w={{ [k]: "1" }} h={{ md: "1", ...s }} />;`;
    const r = rewriteOf(src);
    expect(r.drop).toEqual([src.indexOf('p="1"')]);
    expect(r.className).toBe("k-p-1");
    const u = use(src);
    expect(u).toEqual([{ props: { h: "1" }, breakpoint: "md" }, { props: { p: "1" } }]);
  });
  it("treats unknown states keys and non-object states as dynamic", () => {
    const src = `${UI}const x = <Box p="1" states={{ hover: { p: "1" }, bogus: { p: "2" } }} />;`;
    const r = rewriteOf(src);
    expect(r.drop).toEqual([src.indexOf('p="1"')]);
    const src2 = `${UI}const x = <Box p="1" states={{ hover: x }} />;`;
    expect(rewriteOf(src2).drop).toEqual([src2.indexOf('p="1"')]);
    const src3 = `${UI}const x = <Box p="1" states={{ hover: { [k]: "1" } }} />;`;
    expect(rewriteOf(src3).drop).toEqual([src3.indexOf('p="1"')]);
    const src4 = `${UI}const x = <Box p="1" states={{ hover: { p: "1", unknown: x } }} />;`;
    expect(rewriteOf(src4).drop).toEqual([src4.indexOf('p="1"'), src4.indexOf("states")]);
    const src5 = `${UI}const x = <Box p="1" states={{ hover: { p: x } }} />;`;
    expect(rewriteOf(src5).drop).toEqual([src5.indexOf('p="1"')]);
    const src6 = `${UI}const x = <Box p="1" states={{ ...s }} />;`;
    expect(rewriteOf(src6).drop).toEqual([src6.indexOf('p="1"')]);
    const src7 = `${UI}const x = <Box p="1" states={{ hover: { states: { active: { p: "2" } } } }} />;`;
    expect(rewriteOf(src7).drop).toEqual([src7.indexOf('p="1"'), src7.indexOf("states")]);
    expect(rewriteOf(src7).className).toBe("k-p-1");
  });
  it("rewrites several elements independently and keeps nested ones", () => {
    const src = `${UI}const x = <Box p="1"><Text m="2"/></Box>;`;
    const r = styled(src).rewrites;
    expect([...r.keys()]).toEqual([src.indexOf("<Box"), src.indexOf("<Text")]);
    expect(r.get(src.indexOf("<Box"))?.className).toBe("k-p-1");
    expect(r.get(src.indexOf("<Text"))?.className).toBe("k-m-2");
  });
  it("hashes odd tokens in rewritten classes", () => {
    expect(rewriteOf(`${UI}const x = <Box w="1/2" />;`).className).toMatch(/^k-w-1_2_[0-9a-z]+$/);
  });
  it("accepts numeric values in braces", () => {
    expect(rewriteOf(`${UI}const x = <Box p={4} />;`).className).toBe("k-p-4");
  });
});

describe("collectElements", () => {
  const els = (src: string, path = "src/cart/Add.tsx") => collectElements(analyze({ path, source: src }));
  it("records ids, positions, components, roles and names for intrinsic elements", () => {
    const src = [
      "export function Add() {",
      "  return (",
      '    <div id="root">',
      "      <button>Go</button>",
      '      <input type="checkbox" aria-label="c" />',
      "    </div>",
      "  );",
      "}",
      "const loose = <span/>;",
    ].join("\n");
    const e = (o: object) => o;
    expect(els(src)).toEqual([
      e({
        id: "root",
        explicit: true,
        base: false,
        start: src.indexOf("<div"),
        file: "src/cart/Add.tsx",
        line: 3,
        col: 5,
        component: "Add",
        tag: "div",
        role: "generic",
        name: "none",
      }),
      e({
        id: "src.cart.Add.1",
        explicit: false,
        base: false,
        start: src.indexOf("<button"),
        file: "src/cart/Add.tsx",
        line: 4,
        col: 7,
        component: "Add",
        tag: "button",
        role: "button",
        name: "text",
      }),
      e({
        id: "src.cart.Add.2",
        explicit: false,
        base: false,
        start: src.indexOf("<input"),
        file: "src/cart/Add.tsx",
        line: 5,
        col: 7,
        component: "Add",
        tag: "input",
        role: "checkbox",
        name: "aria",
      }),
      e({
        id: "src.cart.Add.3",
        explicit: false,
        base: false,
        start: src.indexOf("<span"),
        file: "src/cart/Add.tsx",
        line: 9,
        col: 15,
        component: "Add",
        tag: "span",
        role: "generic",
        name: "none",
      }),
    ]);
  });
  it("derives ordinals from all intrinsic elements, skipping components and explicit ids not at all", () => {
    const src = 'function A() { return <div id="x"><Foo/><span/><ui.B/><svg:rect/><p/></div>; }';
    expect(els(src, "a.tsx").map((e) => [e.id, e.explicit, e.tag, e.component])).toEqual([
      ["x", true, "div", "A"],
      ["a.1", false, "span", "A"],
      ["a.2", false, "ui.B", "A"],
      ["a.3", false, "svg:rect", "A"],
      ["a.4", false, "p", "A"],
    ]);
  });
  it("decodes entities in static string ids and ignores empty, bare or dynamic ids", () => {
    const src =
      'const a = <div id="a&amp;b"/>; const b = <div id/>; const c = <div id=""/>; const d = <div id={x}/>; const e = <div id={"lit"}/>; const f = <div id={`t`}/>;';
    expect(els(src, "z.tsx").map((e) => [e.id, e.explicit])).toEqual([
      ["a&b", true],
      ["z.1", false],
      ["z.2", false],
      ["z.3", false],
      ["lit", true],
      ["t", true],
    ]);
  });
  it("marks label-associated controls via for/htmlFor and ancestry", () => {
    const src = [
      "const f = () => (",
      "  <form>",
      '    <label for="a">A</label><input id="a"/>',
      '    <label htmlFor="b">B</label><input id="b"/>',
      '    <label>wrap <input id="c"/></label>',
      '    <input id="d"/>',
      '    <label for="e&amp;f">E</label><select id="e&amp;f"/>',
      '    <label for="">E</label><input id="g"/>',
      "  </form>",
      ");",
    ].join("\n");
    const got = els(src, "f.tsx");
    const byId = (id: string) => got.find((e) => e.id === id)?.name;
    expect(byId("a")).toBe("label");
    expect(byId("b")).toBe("label");
    expect(byId("c")).toBe("label");
    expect(byId("d")).toBe("none");
    expect(byId("e&f")).toBe("label");
    expect(byId("g")).toBe("none");
    // a label is not labelled by itself, and an element outside the label's span is not labelled
    expect(got.find((e) => e.tag === "label")?.name).toBe("none");
  });
  it("a label ancestor must strictly precede and contain the element", () => {
    const src = '<div><input id="o"/><label>x<input id="i"/></label><input id="p"/></div>';
    const got = collectElements(analyze({ path: "g.tsx", source: `const x = ${src};` }));
    const nm = (id: string) => got.find((e) => e.id === id)?.name;
    expect(nm("o")).toBe("none");
    expect(nm("i")).toBe("label");
    expect(nm("p")).toBe("none");
  });
  it("records base elements with literal ids after the intrinsic ones", () => {
    const src = [
      'import { Box, Text, Heading, Button, Link, Image, Input, TextArea, Select, Checkbox } from "@keel/ui";',
      "export function Page() {",
      "  return (",
      "    <div>",
      '      <Box id="b1" as="section" />',
      '      <Box id="b2" />',
      '      <Text id="t1" as="p" />',
      '      <Text id="t2" />',
      '      <Text id="t3" role="note" />',
      '      <Heading id="h1" level={3} />',
      '      <Heading id="h2" />',
      '      <Button id="bt1" label="L">child</Button>',
      '      <Button id="bt2" label="L" />',
      '      <Button id="bt3">child</Button>',
      '      <Link id="l1" />',
      '      <Image id="i1" />',
      '      <Image id="i2" decorative />',
      '      <Input id="in" />',
      '      <TextArea id="ta" />',
      '      <Select id="se" />',
      '      <Checkbox id="cb" />',
      "      <Box />",
      "      <Box id={dyn} />",
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const got = collectElements(analyze({ path: "src/Page.tsx", source: src }));
    expect(got[0]?.tag).toBe("div");
    expect(got[0]?.base).toBe(false);
    const rest = got.slice(1).map((e) => [e.id, e.tag, e.role, e.name, e.base, e.explicit, e.component]);
    expect(rest).toEqual([
      ["b1", "section", "generic", "none", true, true, "Page"],
      ["b2", "div", "generic", "none", true, true, "Page"],
      ["t1", "p", "paragraph", "none", true, true, "Page"],
      ["t2", "span", "generic", "none", true, true, "Page"],
      ["t3", "span", "note", "none", true, true, "Page"],
      ["h1", "h3", "heading", "text", true, true, "Page"],
      ["h2", "h2", "heading", "text", true, true, "Page"],
      ["bt1", "button", "button", "aria", true, true, "Page"],
      ["bt2", "button", "button", "text", true, true, "Page"],
      ["bt3", "button", "button", "text", true, true, "Page"],
      ["l1", "a", "link", "text", true, true, "Page"],
      ["i1", "img", "img", "alt", true, true, "Page"],
      ["i2", "img", "presentation", "none", true, true, "Page"],
      ["in", "input", "textbox", "label", true, true, "Page"],
      ["ta", "textarea", "textbox", "label", true, true, "Page"],
      ["se", "select", "combobox", "label", true, true, "Page"],
      ["cb", "input", "checkbox", "label", true, true, "Page"],
    ]);
    const b1 = got[1];
    expect(b1?.line).toBe(5);
    expect(b1?.col).toBe(7);
    expect(b1?.file).toBe("src/Page.tsx");
    expect(b1?.start).toBe(src.indexOf("<Box"));
  });
  it("Text with link-like attributes derives role and name from its tag", () => {
    const src =
      'import { Text } from "@keel/ui"; const x = <Text id="a" as="a" href="/" aria-label="n" />; const y = <Text id="b" as="button">go</Text>;';
    const got = collectElements(analyze({ path: "k.tsx", source: src }));
    expect(got.filter((e) => e.base).map((e) => [e.id, e.tag, e.role, e.name])).toEqual([
      ["a", "a", "link", "aria"],
      ["b", "button", "button", "text"],
    ]);
  });
  it("names come from aria, alt, label or content", () => {
    const src = [
      'const a = <img id="a" alt="x"/>;',
      'const b = <button id="b" aria-labelledby="q"/>;',
      'const c = <button id="c">{x}</button>;',
      'const d = <button id="d">{<i/>}</button>;',
      'const e = <button id="e">{() => 1}</button>;',
      'const f = <button id="f"> </button>;',
      'const g = <button id="g"><b>t</b></button>;',
      'const h = <button id="h">{}</button>;',
      'const i = <button id="i"><></></button>;',
      'const j = <button id="j">{function () {}}</button>;',
      'const k = <div id="k">text</div>;',
      'const l = <input id="l" alt="x"/>;',
      'const m = <button id="m"><>t</></button>;',
      'const n = <area id="n" alt="x"/>;',
      'const o = <div id="o" alt="x"/>;',
      'const p = <button id="p">\n  \n</button>;',
      'const q = <button id="q"><b/><i/></button>;',
    ].join("\n");
    const got = collectElements(analyze({ path: "n.tsx", source: src }));
    const nm = (id: string) => got.find((e) => e.id === id)?.name;
    expect(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q"].map(nm)).toEqual([
      "alt",
      "aria",
      "text",
      "none",
      "none",
      "text",
      "text",
      "none",
      "none",
      "none",
      "none",
      "none",
      "text",
      "alt",
      "none",
      "none",
      "none",
    ]);
  });
});
