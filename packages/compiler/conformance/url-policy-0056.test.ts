// Spec: k.compiler, clause "`javascript:` in `object data`, a `srcset` candidate, or a `<set>` `to`/`<animate>` `values` item is E1003 as a literal and `about:blank` bound; any `<base>` `href` or `<meta>` `http-equiv` is E1003, never rendered."
// @vitest-environment happy-dom
// Seed 1337 (fc.assert seed below). RFC 0056 / backlog 0132, 0133 (compiler side of the spread repro).
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Mountable, codes, isMountable, load, sigOf } from "./support.ts";

const SEED = 1337;

function loadIgnoringDiagnostics(src: string): Mountable {
  const first = compile([{ path: "B.tsx", source: src }]).outputs[0];
  if (first === undefined) throw new Error("no output");
  const c = evaluate(first.code);
  if (!isMountable(c)) throw new Error("default export is not a component");
  return c;
}

const svgTags = new Set(["set", "animate", "animateTransform"]);
const cache = new Map<string, Mountable>();

function component(tag: string, attr: string, ignoreDiagnostics: boolean): Mountable {
  const key = `${tag}|${attr}|${ignoreDiagnostics}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const el = `<${tag} ${attr}={u.get()} />`;
  const body = svgTags.has(tag) ? `<svg>${el}</svg>` : el;
  const src = `
import { signal } from '@keel/reactive'
const u = signal('')
function B() {
  return ${body}
}
B.u = u
export default B
`;
  const c = ignoreDiagnostics ? loadIgnoringDiagnostics(src) : load("B", src);
  cache.set(key, c);
  return c;
}

/** Mounts `<tag attr={value} />` and returns the rendered attribute (null when absent). */
function render(tag: string, attr: string, value: string, ignoreDiagnostics = false): string | null {
  const B = component(tag, attr, ignoreDiagnostics);
  sigOf(B, "u").set(value);
  const host = document.createElement("div");
  const dispose = mount(B, host);
  const out = host.querySelector(tag)?.getAttribute(attr) ?? null;
  dispose();
  return out;
}

function hasE1003(src: string): boolean {
  return codes(src).some((d) => d.code === "E1003");
}

const wrap = (jsx: string): string => `export default function C() { return ${jsx} }`;

const literalRepros: readonly string[] = [
  `<object data="javascript:alert(1)" />`,
  `<img srcset="javascript:x 1x" />`,
  `<img srcset="a.png 1x, javascript:x 2x" />`,
  `<link imagesrcset="javascript:x 1x" />`,
  `<svg><a href="https://ok.example"><set attributeName="href" to="javascript:alert(1)" /></a></svg>`,
  `<animate attributeName="href" values="https://a.example;javascript:alert(1)" />`,
  `<animate attributeName="href" from="javascript:alert(1)" />`,
  `<animate attributeName="href" by="javascript:alert(1)" />`,
  `<embed src="javascript:x" />`,
];

for (const jsx of literalRepros) {
  test(`A literal ${jsx} is E1003`, () => {
    expect(hasE1003(wrap(jsx))).toBe(true);
  });
}

const boundHosts: readonly (readonly [string, string])[] = [
  ["object", "data"],
  ["img", "srcset"],
  ["link", "imagesrcset"],
  ["set", "to"],
  ["animate", "values"],
  ["animate", "from"],
  ["animate", "by"],
  ["embed", "src"],
];

test("`javascript:` in object data, srcset, imagesrcset, set to, animate values/from/by, or embed src renders as `about:blank` when bound", () => {
  for (const [tag, attr] of boundHosts) {
    expect(render(tag, attr, "javascript:alert(1)")).toBe("about:blank");
  }
});

test("A srcset candidate or animate values item with `javascript:` after a clean item renders the whole attribute as `about:blank` when bound", () => {
  expect(render("img", "srcset", "a.png 1x, javascript:x 2x")).toBe("about:blank");
  expect(render("animate", "values", "https://a.example;javascript:alert(1)")).toBe("about:blank");
});

test("Clean srcset, object data, and animation values emit no E1003 (clean counterparts)", () => {
  const clean = [
    `<img srcset="a.png 1x, b.png 2x" />`,
    `<object data="movie.svg" />`,
    `<animate attributeName="opacity" values="0;1;0" />`,
    `<animateTransform to="rotate(360 50 50)" />`,
    `<feColorMatrix values="1 0 0 0 0" />`,
  ];
  for (const jsx of clean) {
    expect(codes(wrap(jsx)).map((d) => d.code)).not.toContain("E1003");
  }
});

test("Clean values bound to srcset, data, and animation attributes render unchanged", () => {
  expect(render("img", "srcset", "a.png 1x, b.png 2x")).toBe("a.png 1x, b.png 2x");
  expect(render("object", "data", "movie.svg")).toBe("movie.svg");
  expect(render("animate", "values", "0;1;0")).toBe("0;1;0");
  expect(render("animate", "to", "rotate(360 50 50)")).toBe("rotate(360 50 50)");
});

test('A literal `<base href="//evil.example" />` is E1003', () => {
  expect(hasE1003(wrap(`<base href="//evil.example" />`))).toBe(true);
});

test("Any `<base>` `href` bound to a signal is E1003", () => {
  const src = (): string => `
import { signal } from '@keel/reactive'
const u = signal('')
export default function C() { return <base href={u.get()} /> }
`;
  expect(hasE1003(src())).toBe(true);
});

test("A bound `<base>` `href` is never rendered, for a protocol-relative or an https value", () => {
  for (const v of ["//evil.example", "https://ok.example"]) {
    const B = component("base", "href", true);
    sigOf(B, "u").set(v);
    const host = document.createElement("div");
    const dispose = mount(B, host);
    const base = host.querySelector("base");
    expect(base?.hasAttribute("href")).toBe(false);
    dispose();
  }
});

test('A literal `<base href="//evil.example" />` compiled ignoring diagnostics and mounted renders no `href`', () => {
  const B = loadIgnoringDiagnostics(`
function B() { return <base href="//evil.example" /> }
export default B
`);
  const host = document.createElement("div");
  const dispose = mount(B, host);
  const base = host.querySelector("base");
  expect(base?.hasAttribute("href")).toBe(false);
  dispose();
});

test("`formaction`, `ping`, `xlink:href`, and `action` with `javascript:` remain E1003", () => {
  expect(hasE1003(wrap(`<button formaction="javascript:x" />`))).toBe(true);
  expect(hasE1003(wrap(`<a ping="javascript:x" />`))).toBe(true);
  expect(hasE1003(wrap(`<a xlink:href="javascript:x" />`))).toBe(true);
  expect(hasE1003(wrap(`<form action="javascript:x" />`))).toBe(true);
});

test("A JSX spread `{...{ onclick: 'alert(1)' }}` on an HTML element is E1002", () => {
  const d = codes(wrap(`<div {...{ onclick: 'alert(1)' }} />`));
  expect(d.map((x) => x.code)).toContain("E1002");
});

test("A JSX spread `{...{ title: 'x' }}` on an HTML element is not E1002", () => {
  const d = codes(wrap(`<div {...{ title: 'x' }} />`));
  expect(d.map((x) => x.code)).not.toContain("E1002");
});

test("A JSX spread `{...{ onclick: 'alert(1)' }}` compiled ignoring diagnostics and mounted creates no `onclick` attribute", () => {
  const B = loadIgnoringDiagnostics(`
function B() { return <div id="t" {...{ onclick: 'alert(1)' }} /> }
export default B
`);
  const host = document.createElement("div");
  const dispose = mount(B, host);
  const el = host.querySelector("#t");
  expect(el).not.toBeNull();
  expect(el?.getAttributeNames().map((n) => n.toLowerCase())).not.toContain("onclick");
  dispose();
});

// ---- property: the value is unchanged or exactly about:blank ----

const policedAttrs = [
  "href",
  "src",
  "action",
  "formaction",
  "xlink:href",
  "poster",
  "ping",
  "data",
  "srcset",
  "imagesrcset",
  "to",
  "from",
  "by",
  "values",
];
const elements = ["a", "img", "object", "link", "iframe", "set", "animate", "div"];
const schemes = ["javascript", "data", "vbscript", "http", "https", "mailto", "tel"];

const caseVariant = (s: string, mask: readonly boolean[]): string =>
  [...s].map((ch, i) => (mask[i % mask.length] === true ? ch.toUpperCase() : ch)).join("");

const leading = fc.stringOf(fc.constantFrom(" ", "\t", "\n", "\r", "\u0001", "\u001f"), { maxLength: 3 });

const schemeValue = fc
  .tuple(
    leading,
    fc.constantFrom(...schemes),
    fc.array(fc.boolean(), { minLength: 1, maxLength: 12 }),
    fc.string({ maxLength: 20 }),
  )
  .map(([lead, scheme, mask, rest]) => `${lead}${caseVariant(scheme, mask)}:${rest}`);

const anyValue = fc.oneof(fc.string({ maxLength: 40 }), schemeValue);

test("For any string bound to any policed attribute on any element, the rendered attribute is the value unchanged or exactly `about:blank`", () => {
  fc.assert(
    fc.property(fc.constantFrom(...elements), fc.constantFrom(...policedAttrs), anyValue, (tag, attr, v) => {
      const out = render(tag, attr, v);
      expect(out === v || out === "about:blank").toBe(true);
    }),
    { seed: SEED, numRuns: 150 },
  );
});

test("For any value whose scheme, after leading whitespace/control characters, is `javascript`, the rendered attribute is `about:blank`", () => {
  const jsValue = fc
    .tuple(leading, fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }), fc.string({ maxLength: 20 }))
    .map(([lead, mask, rest]) => `${lead}${caseVariant("javascript", mask)}:${rest}`);
  fc.assert(
    fc.property(fc.constantFrom(...elements), fc.constantFrom(...policedAttrs), jsValue, (tag, attr, v) => {
      expect(render(tag, attr, v)).toBe("about:blank");
    }),
    { seed: SEED, numRuns: 150 },
  );
});
