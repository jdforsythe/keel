// @vitest-environment node
// Backlog 0168 (rfc:0058): text in an SVG `<style>`/`<script>` is escaped once, by the serializer. The compiler
// sets it as text node data, so `parseHtml` never sees it and the serializer (foreign content: escaped like any
// text, backlog 0140) is its one escaping owner.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { describe, expect, it } from "vitest";
import { installServerDom } from "../src/internal/dom/installServerDom.ts";
import { renderUnit } from "../src/internal/renderUnit.ts";

const render = (jsx: string): string => {
  installServerDom();
  const r = compile([{ path: "a.tsx", source: `export default function A() { return ${jsx} }` }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "");
  if (typeof fn !== "function") throw new Error("no default export");
  const n = renderUnit(() => Reflect.apply(fn, undefined, [{}]));
  const html = typeof n === "object" && n !== null ? Reflect.get(n, "outerHTML") : undefined;
  return typeof html === "string" ? html : "";
};

describe("SVG raw text on the server (backlog 0168)", () => {
  it("backlog 0168 repro: `g > rect` in an SVG <style> renders once-escaped", () => {
    expect(render(`<div><svg><style>{"g > rect { fill: red }"}</style></svg></div>`)).toBe(
      '<div id="a.0"><svg id="a.1"><style id="a.2">g &gt; rect { fill: red }</style></svg></div>',
    );
  });

  it("`<`, `>` and `&` in SVG script text are escaped once, as data", () => {
    const html = render(`<svg><script>{"a < b && c > d"}</script></svg>`);
    expect(html).toBe('<svg id="a.0"><script id="a.1">a &lt; b &amp;&amp; c &gt; d</script></svg>');
  });

  it("an HTML <style> keeps its text raw", () => {
    expect(render(`<div><style>{"g > rect { fill: red }"}</style></div>`)).toBe(
      '<div id="a.0"><style id="a.1">g > rect { fill: red }</style></div>',
    );
  });
});
