// Seed 1337
// Spec: k.compiler, Rules "E1002 raw HTML (`innerHTML` family, `DOMParser`, `document.write`, `on*` strings, also spread; data in `script`/`style`; rfc:0053, 0058)"
import { check } from "@keel/check";
import { expect, test } from "vitest";

const codes = (source: string): string[] =>
  check([{ path: "src/a.ts", source }], { types: false }).diagnostics.map((d) => d.code);

const SINKS: [string, string][] = [
  ["Reflect.set(el, 'innerHTML', x)", "export const a = (el: object, x: string) => Reflect.set(el, 'innerHTML', x)\n"],
  ["el['innerHTML'] = x", "export const a = (el: { innerHTML: string }, x: string) => { el['innerHTML'] = x }\n"],
  ["new DOMParser()", "export const a = () => new DOMParser()\n"],
  ["document.write(x)", "export const a = (x: string) => document.write(x)\n"],
  ["document.writeln(x)", "export const a = (x: string) => document.writeln(x)\n"],
  [
    "range.createContextualFragment(x)",
    "export const a = (range: { createContextualFragment(s: string): unknown }, x: string) => range.createContextualFragment(x)\n",
  ],
  [
    "el.setAttribute('srcdoc', x)",
    "export const a = (el: { setAttribute(n: string, v: string): void }, x: string) => el.setAttribute('srcdoc', x)\n",
  ],
  [
    "Object.defineProperty(el, 'outerHTML', {...})",
    "export const a = (el: object, x: string) => Object.defineProperty(el, 'outerHTML', { value: x })\n",
  ],
];

for (const [name, source] of SINKS) {
  test(`E1002: ${name} is reported`, () => {
    expect(codes(source)).toContain("E1002");
  });
}

const CLEAN: [string, string][] = [
  ["el.textContent = x", "export const a = (el: { textContent: string }, x: string) => { el.textContent = x }\n"],
  [
    "el.setAttribute('title', x)",
    "export const a = (el: { setAttribute(n: string, v: string): void }, x: string) => el.setAttribute('title', x)\n",
  ],
  ["Reflect.set(el, 'title', x)", "export const a = (el: object, x: string) => Reflect.set(el, 'title', x)\n"],
];

for (const [name, source] of CLEAN) {
  test(`E1002: ${name} is not reported`, () => {
    expect(codes(source)).not.toContain("E1002");
  });
}
