// @vitest-environment node
// Backlog 0165 / rfc:0061 on the server DOM: a JSX child expression holding elements (`{p.on ? <b/> : <i/>}`)
// is E1403 and binds nothing, so SSR never writes "[object Object]"; `If` with `fallback` renders either branch.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { describe, expect, it } from "vitest";
import { installServerDom } from "../src/internal/dom/installServerDom.ts";
import { renderUnit } from "../src/internal/renderUnit.ts";

const compiled = (source: string): { render: (props: Record<string, unknown>) => string; codes: string[] } => {
  const r = compile([{ path: "a.tsx", source }]);
  const fn = evaluate(r.outputs[0]?.code ?? "");
  if (typeof fn !== "function") throw new Error("no default export");
  const render = (props: Record<string, unknown>): string => {
    const n = renderUnit(() => Reflect.apply(fn, undefined, [props]), createCtx({ mode: "sim", seed: 1337 }));
    const html = typeof n === "object" && n !== null ? Reflect.get(n, "outerHTML") : undefined;
    return typeof html === "string" ? html : "";
  };
  return { render, codes: r.diagnostics.map((d) => d.code) };
};

const CHILDREN: readonly string[] = [
  "{p.on ? <b/> : <i/>}",
  "{p.on && <b/>}",
  "{[<b/>, <i/>]}",
  "{p.xs.map((x) => <li>{x}</li>)}",
  "{(() => <b/>)()}",
];

describe("elements in a JSX child expression on the server DOM (rfc:0061)", () => {
  for (const child of CHILDREN)
    it(`${child} is E1403 and renders no "[object"`, () => {
      installServerDom();
      const A = compiled(`export default function A(p) { return <div><span>a</span>${child}</div> }`);
      expect(A.codes).toEqual(["E1403"]);
      const html = A.render({ on: true, xs: ["1"] });
      expect(html).not.toContain("[object");
      expect(html).toBe('<div id="a.0"><span id="a.1">a</span></div>');
    });

  it("If with fallback renders the then branch or the fallback", () => {
    installServerDom();
    const A = compiled(`import { If } from "@keel/runtime-dom";
export default function A(p) { return <div><If when={p.on} fallback={() => <i>no</i>}><b>yes</b></If></div> }`);
    expect(A.codes).toEqual([]);
    expect(A.render({ on: true })).toMatch(/<b[^>]*>yes<\/b>/);
    expect(A.render({ on: false })).toMatch(/<i[^>]*>no<\/i>/);
  });
});

describe("a node reaching a text binding renders nothing on the server DOM (backlog 0175)", () => {
  for (const child of ["{[<b/>][0]}", "{p.icon}", "{p.list}"])
    it(`${child} renders no "[object"`, () => {
      installServerDom();
      const A = compiled(`export default function A(p) { return <div><span>a</span>${child}</div> }`);
      const icon = document.createElement("b");
      const html = A.render({ icon, list: ["x", icon] });
      expect(html).not.toContain("[object");
      expect(html).toBe('<div id="a.0"><span id="a.1">a</span></div>');
    });
});
