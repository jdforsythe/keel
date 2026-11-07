import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

/** E1002 diagnostics as `line:col message`, through check()'s compiler pass. */
const e1002 = (src: string): string[] =>
  check([{ path: "src/a.ts", source: src }], { types: false })
    .diagnostics.filter((d) => d.code === "E1002")
    .map((d) => `${d.line}:${d.col} ${d.message}`);

const EL = "declare const el: HTMLElement\n";

describe("E1002 raw HTML sinks (rfc:0053)", () => {
  const ONE: [string, string][] = [
    ["Reflect.set", "Reflect.set(el, 'innerHTML', 'x')"],
    ["Reflect.get", "Reflect.get(el, 'outerHTML')"],
    ["Reflect.defineProperty", "Reflect.defineProperty(el, 'innerHTML', { value: 'x' })"],
    ["Object.defineProperty", "Object.defineProperty(el, `innerHTML`, { value: 'x' })"],
    ["Object.getOwnPropertyDescriptor", "Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')"],
    ["Object.assign", "Object.assign(el, { innerHTML: 'x' })"],
    ["Object.assign string key", "Object.assign(el, { 'outerHTML': 'x' })"],
    ["Object.defineProperties", "Object.defineProperties(el, { ['innerHTML']: { value: 'x' } })"],
    ["computed literal", "el['innerHTML'] = 'x'"],
    ["computed template", "el[`insertAdjacentHTML`]('beforeend', 'x')"],
    ["computed const", "const k = 'innerHTML'\nel[k] = 'x'"],
    ["destructured", "const { innerHTML } = el\nvoid innerHTML"],
    ["setHTMLUnsafe", "el.setHTMLUnsafe('x')"],
    ["createContextualFragment", "declare const r: Range\nr.createContextualFragment('x')"],
    ["DOMParser", "new DOMParser()"],
    ["window.DOMParser", "new window.DOMParser()"],
    ["document.write", "document.write('x')"],
    ["document.writeln", "globalThis.document.writeln('x')"],
    ["document['write']", "document['write']('x')"],
    ["srcdoc member", "declare const f: HTMLIFrameElement\nf.srcdoc = 'x'"],
    ["setAttribute srcdoc", "el.setAttribute('srcdoc', 'x')"],
    ["setAttributeNS srcdoc", "el.setAttributeNS(null, 'srcdoc', 'x')"],
  ];
  for (const [name, src] of ONE)
    it(`one E1002: ${name}`, () => {
      expect(e1002(`${EL}${src}\n`)).toHaveLength(1);
    });

  it("names the sink and locates the key", () => {
    expect(e1002(`${EL}Reflect.set(el, 'innerHTML', 'x')\n`)).toEqual([
      "2:17 raw HTML via innerHTML; render text or elements instead",
    ]);
    expect(e1002(`${EL}el.setAttribute('onclick', 'go()')\n`)).toEqual([
      "2:17 inline handler string in onclick; pass a function",
    ]);
    expect(e1002("document.write('x')\n")).toEqual([
      "1:10 raw HTML via document.write; render text or elements instead",
    ]);
  });

  const NONE: [string, string][] = [
    ["Reflect.set other key", "Reflect.set(el, 'title', 'x')"],
    ["dynamic key", "declare const k: string\nel[k] = 'x'\nReflect.set(el, k, 'x')"],
    ["let key", "let k = 'innerHTML'\nk = 'title'\nel[k] = 'x'"],
    ["setAttribute title", "el.setAttribute('title', 'x')"],
    ["textContent", "el.textContent = 'x'"],
    [
      "local Reflect",
      "const Reflect = { set: (o: object, k: string, v: string) => [o, k, v] }\nReflect.set(el, 'innerHTML', 'x')",
    ],
    [
      "local Object",
      "const Object = { assign: (a: object, b: object) => [a, b] }\nObject.assign(el, { innerHTML: 'x' })",
    ],
    ["local document", "const document = { write: (s: string) => s }\ndocument.write('x')"],
    ["local DOMParser", "class DOMParser {}\nnew DOMParser()"],
    ["stream write", "declare const w: { write(s: string): void }\nw.write('x')"],
    ["Object.assign other keys", "Object.assign(el, { title: 'x' })"],
  ];
  for (const [name, src] of NONE)
    it(`no E1002: ${name}`, () => {
      expect(e1002(`${EL}${src}\n`)).toEqual([]);
    });
});
