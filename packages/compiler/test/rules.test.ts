// URL rules on base elements (D32) and explicit ids on base elements (D33); fixtures mirror check's conformance.
import { compile } from "@keel/compiler";
import { describe, expect, it } from "vitest";

const UI = `import { Box, Text, Heading, Button, Link, Image } from '@keel/ui'\n`;
const codes = (body: string): string[] =>
  compile([{ path: "C.tsx", source: `${UI}export default function C() { return ${body} }` }]).diagnostics.map(
    (d) => d.code,
  );

describe("E1501 and E1003 on URL attributes and base-element URL props", () => {
  it("allows absolute URLs and fragments", () => {
    for (const u of ["https://x.test/a.png", "http://x", "mailto:a@b.c", "tel:+1", "//cdn.test/x", "#top"]) {
      expect(codes(`<Image src="${u}" alt="x" />`), u).toEqual([]);
      expect(codes(`<a href="${u}">x</a>`), u).toEqual([]);
    }
  });

  it("reports root paths as E1501 in navigation attributes and Link to, never in asset attributes (RFC 0030)", () => {
    expect(codes(`<Link to="/orders">o</Link>`)).toEqual(["E1501"]);
    expect(codes(`<a href="/orders">o</a>`)).toEqual(["E1501"]);
    expect(codes(`<form action=" /orders"><button formaction="/x">b</button></form>`)).toEqual(["E1501", "E1501"]);
    expect(codes(`<a href="orders">o</a>`)).toEqual([]);
    expect(codes(`<Image src="/a.png" alt="x" />`)).toEqual([]);
    expect(codes(`<img src="logo.png" alt="x" />`)).toEqual([]);
    expect(codes(`<video poster="/p.jpg" ping="/ping" />`)).toEqual([]);
    expect(codes(`<svg><use xlink:href="/sprite.svg#i" /></svg>`)).toEqual([]);
    expect(codes(`<Box src="/not-a-url-prop" />`)).toEqual([]);
  });

  it("reports a relative navigation literal as E1501 only when it matches a route pattern", () => {
    const entry = (p: string | null) => ({
      actions: [],
      guard: null,
      layout: null,
      module: "m",
      params: null,
      path: p,
      search: null,
    });
    const routes = { "m.order": entry("/orders/:id"), "m.shell": entry(null), "m.home": entry("/") };
    const withRoutes = (body: string): string[] =>
      compile([{ path: "C.tsx", source: `export default function C() { return ${body} }` }], {
        routes,
      }).diagnostics.map((d) => d.code);
    expect(withRoutes(`<a href="orders/7">o</a>`)).toEqual(["E1501"]);
    expect(withRoutes(`<a href="./orders/7?x=1#t">o</a>`)).toEqual(["E1501"]);
    expect(withRoutes(`<a href="orders/7/edit">o</a>`)).toEqual([]);
    expect(withRoutes(`<a href="orders/">o</a>`)).toEqual([]);
    expect(withRoutes(`<a href="order/7">o</a>`)).toEqual([]);
    expect(withRoutes(`<a href="docs/guide.pdf">o</a>`)).toEqual([]);
    expect(withRoutes(`<img src="orders/7" alt="x" />`)).toEqual([]);
    expect(withRoutes(`<a href="">o</a>`)).toEqual([]);
    expect(withRoutes(`<a href="?q=1">o</a>`)).toEqual([]);
    expect(withRoutes(`<a href="./">o</a>`)).toEqual(["E1501"]);
  });

  it("reports a literal script or data URL as exactly one E1003", () => {
    expect(codes(`<Image src="javascript:alert(1)" alt="x" />`)).toEqual(["E1003"]);
    expect(codes(`<Link to="data:text/html,x">o</Link>`)).toEqual(["E1003"]);
    expect(codes(`<a href=" JavaScript:x">o</a>`)).toEqual(["E1003"]);
    expect(codes(`<Image alt="x" />`)).toEqual([]);
  });
});

describe("explicit ids on base elements", () => {
  it("reports duplicates as E1404, also against DOM elements", () => {
    expect(codes(`<Box as="section"><Box id="x">1</Box><Box id="x">2</Box></Box>`)).toEqual(["E1404"]);
    expect(codes(`<Box as="section"><Box id="x">1</Box><Box id="y">2</Box></Box>`)).toEqual([]);
    expect(codes(`<div><p id="x">1</p><Text id="x">2</Text></div>`)).toEqual(["E1404"]);
  });

  it("lists them in ids.json and a11y.json by the DOM tag they render, without shifting derived ids", () => {
    const r = compile([
      {
        path: "src/C.tsx",
        source: `${UI}export default function C() { return <div><Heading level={1} id="title">T</Heading><Button id="go" label="Go" /><p>x</p><Box as="nav" id="nav" /></div> }`,
      },
    ]);
    expect(r.diagnostics).toEqual([]);
    const ids = r.artifacts["ids.json"];
    expect(Object.keys(ids)).toEqual(["go", "nav", "src.C.0", "src.C.1", "title"]);
    expect(ids.title).toMatchObject({ tag: "h1", role: "heading", component: "C", line: 2 });
    expect(ids.go).toMatchObject({ tag: "button", role: "button" });
    expect(ids.nav).toMatchObject({ tag: "nav", role: "navigation" });
    expect(r.artifacts["a11y.json"].go).toEqual({ name: "text", role: "button", tag: "button" });
  });
});

describe("rfc:0056: E1002 on spread on* strings, E1003 on <base href>", () => {
  it("reports a literal on* string key in a spread object literal on an HTML element", () => {
    expect(codes(`<div {...{ onclick: 'alert(1)' }} />`)).toEqual(["E1002"]);
    expect(codes("<div {...{ ONMOUSEOVER: `x` }} />")).toEqual(["E1002"]);
    expect(codes(`<div {...{ 'onerror': 'x', ['onload']: 'y' }} />`)).toEqual(["E1002", "E1002"]);
  });

  it("leaves other spreads alone", () => {
    expect(codes(`<div {...{ title: 'x', 'data-on': 'y' }} />`)).toEqual([]);
    expect(codes("<div {...{ onclick: () => 1, onkey: 2 }} />")).toEqual([]);
    expect(codes(`<Box {...{ onclick: 'x' }} />`)).toEqual([]);
  });

  it("reports any <base href>, literal or bound, with a removal fix; <base target> alone is clean", () => {
    expect(codes(`<base href="//evil.example" />`)).toEqual(["E1003"]);
    expect(codes(`<base href="https://ok.example/" />`)).toEqual(["E1003"]);
    expect(codes("<base href={String(1)} />")).toEqual(["E1003"]);
    expect(codes(`<base target="_blank" />`)).toEqual([]);
    const d = compile([{ path: "C.tsx", source: `export default function C() { return <base href="//e" /> }` }]);
    expect(d.diagnostics[0]?.fix).toContain('-export default function C() { return <base href="//e" /> }');
  });

  it("never renders a static <base href>", () => {
    const r = compile([
      { path: "C.tsx", source: `export default function C() { return <base href="//e" target="_top" /> }` },
    ]);
    const js = r.outputs[0]?.code ?? "";
    expect(js).toContain("target");
    expect(js).not.toContain("//e");
  });
});
