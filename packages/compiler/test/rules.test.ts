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

  it("reports string paths as E1501 on DOM elements, Image src and Link to", () => {
    expect(codes(`<Image src="/a.png" alt="x" />`)).toEqual(["E1501"]);
    expect(codes(`<Link to="/orders">o</Link>`)).toEqual(["E1501"]);
    expect(codes(`<a href="orders">o</a>`)).toEqual(["E1501"]);
    expect(codes(`<Box src="/not-a-url-prop" />`)).toEqual([]);
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
