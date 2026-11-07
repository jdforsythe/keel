// Spec: k.compiler, clause "`<script>{x}`, `<style>{x}` and `<script src={x}>` are E1002 and bind nothing."
// Spec: k.compiler, clause "`javascript:` in `object data`, a `srcset` candidate, or a `<set>` `to`/`<animate>` `values` item is E1003 as a literal and `about:blank` bound; any `<base>` `href` or `<meta>` `http-equiv` is E1003, never rendered."
// @vitest-environment happy-dom
// Seed 1337 (fc.assert seed below). RFC 0058 / backlog 0157 (script/style data), 0158 (meta http-equiv).
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Mountable, SEED, codes, isMountable, load, sigOf } from "./support.ts";

/** Compiles `jsx` as the body of a component over a string signal `u`, keeping the output despite diagnostics. */
function build(jsx: string): { B: Mountable; diagnostics: { code: string }[] } {
  const src = `
import { signal } from '@keel/reactive'
const u = signal('')
function B() {
  return ${jsx}
}
B.u = u
export default B
`;
  const r = compile([{ path: "B.tsx", source: src }]);
  const first = r.outputs[0];
  if (first === undefined) throw new Error("no output");
  const B = evaluate(first.code);
  if (!isMountable(B)) throw new Error("default export is not a component");
  return { B, diagnostics: r.diagnostics };
}

/** Mounts `B` with `u` set to `value` and returns the host's markup. */
function html(B: Mountable, value: string): string {
  sigOf(B, "u").set(value);
  const host = document.createElement("div");
  const dispose = mount(B, host);
  const out = host.innerHTML;
  dispose();
  return out;
}

const PAYLOAD = "alert(document.cookie)";

const DATA_CHILDREN: readonly string[] = [
  "<div><script>{u.get()}</script></div>",
  "<div><style>{u.get()}</style></div>",
  '<div><script type="module">{`${u.get()}`}</script></div>',
  "<div><style>{'a{}'}{u.get()}</style></div>",
];

for (const jsx of DATA_CHILDREN) {
  test(`${jsx} is E1002 and renders no data`, () => {
    const { B, diagnostics } = build(jsx);
    expect(diagnostics.map((d) => d.code)).toContain("E1002");
    expect(html(B, PAYLOAD)).not.toContain("alert");
  });
}

const BOUND_ATTRS: readonly [string, string][] = [
  ["<div><script src={u.get()}></script></div>", "src"],
  ["<div><style media={u.get()}></style></div>", "media"],
  ["<div><script {...{ src: u.get() }}></script></div>", "src"],
];

for (const [jsx, attr] of BOUND_ATTRS) {
  test(`${jsx} is E1002 and binds no ${attr}`, () => {
    const { B, diagnostics } = build(jsx);
    expect(diagnostics.map((d) => d.code)).toContain("E1002");
    expect(html(B, "https://evil.example/x.js")).not.toContain("evil");
  });
}

test("any string in a script or style child never renders (property)", () => {
  const script = build("<div><script>{u.get()}</script></div>").B;
  const style = build("<div><style>{u.get()}</style></div>").B;
  fc.assert(
    fc.property(fc.string({ minLength: 1 }), (v) => {
      for (const B of [script, style]) {
        sigOf(B, "u").set(v);
        const host = document.createElement("div");
        const dispose = mount(B, host);
        const el = host.querySelector("script, style");
        expect(el?.textContent).toBe("");
        dispose();
      }
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("a literal <style> or <script> child compiles clean and renders verbatim", () => {
  const css = "a > b { color: red } .x::after { content: '&amp;' }";
  const S = load("S", `export default function S() { return <div><style>{${JSON.stringify(css)}}</style></div> }`);
  const host = document.createElement("div");
  const dispose = mount(S, host);
  expect(host.querySelector("style")?.textContent).toBe(css);
  dispose();
  const json = '{"@type":"Thing","name":"a < b"}';
  const L = load(
    "L",
    `export default function L() { return <div><script type="application/ld+json">{${JSON.stringify(json)}}</script></div> }`,
  );
  const host2 = document.createElement("div");
  const dispose2 = mount(L, host2);
  expect(host2.querySelector("script")?.textContent).toBe(json);
  expect(host2.querySelector("script")?.getAttribute("type")).toBe("application/ld+json");
  dispose2();
});

test("a literal that would end the element early is E1002", () => {
  expect(
    codes(`export default function C() { return <style>{"a{}</style><b>"}</style> }`).map((d) => d.code),
  ).toContain("E1002");
  expect(codes(`export default function C() { return <script>{"x<!--"}</script> }`).map((d) => d.code)).toContain(
    "E1002",
  );
});

const META_LITERALS: readonly string[] = [
  `<meta http-equiv="refresh" content="0;url=javascript:alert(1)" />`,
  `<meta http-equiv="refresh" content="0;url=https://evil.example" />`,
  `<meta HTTP-EQUIV="set-cookie" content="a=b" />`,
];

for (const jsx of META_LITERALS) {
  test(`${jsx} is E1003 and renders no http-equiv`, () => {
    const { B, diagnostics } = build(`<div>${jsx}</div>`);
    expect(diagnostics.map((d) => d.code)).toContain("E1003");
    expect(html(B, "").toLowerCase()).not.toContain("http-equiv");
  });
}

test("a bound or spread http-equiv on a meta is E1003 (bound) and never rendered", () => {
  const bound = build(`<div><meta http-equiv={u.get()} content="0;url=https://evil.example" /></div>`);
  expect(bound.diagnostics.map((d) => d.code)).toContain("E1003");
  expect(html(bound.B, "refresh").toLowerCase()).not.toContain("http-equiv");
  const spread = build(`<div><meta {...{ "http-equiv": u.get(), content: "0;url=x" }} /></div>`);
  expect(html(spread.B, "refresh").toLowerCase()).not.toContain("http-equiv");
});

test("a meta name/content and a style with literal attributes stay clean", () => {
  expect(codes(`export default function C() { return <meta name="description" content="x" /> }`)).toEqual([]);
  expect(codes(`export default function C() { return <style media="print">{"a{}"}</style> }`)).toEqual([]);
});

test("backlog 0168: literal SVG <style> text is text node data, escaped only by a serializer", () => {
  const css = "g > rect { fill: red } a < b & c";
  const S = load(
    "S",
    `export default function S() { return <div><svg><style>{${JSON.stringify(css)}}</style></svg></div> }`,
  );
  const host = document.createElement("div");
  const dispose = mount(S, host);
  const style = host.querySelector("style");
  expect(style?.textContent).toBe(css);
  expect(style?.childNodes.length).toBe(1);
  dispose();
  const js = compile([
    {
      path: "S.tsx",
      source: `export default function S() { return <svg><style>{${JSON.stringify(css)}}</style></svg> }`,
    },
  ]).outputs[0]?.code;
  expect(js).not.toContain("&gt;");
  expect(js).not.toContain("&lt;");
});
