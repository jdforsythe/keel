// RFC 0061 resolver gaps: E1002 through a `let`/`var` key and a map held in an alias (backlog 0170); E1603 through
// `blob:` URLs, `new Worker` and a function's prototype (backlog 0171). Each repro gave `[]` before the RFC.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const codes = (code: string, src: string): string[] =>
  check([{ path: "modules/app/a.ts", source: src }], { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => `${d.line}:${d.col} ${d.message}`);

const EL = "declare const el: HTMLElement\ndeclare const x: string\n";

describe("E1002 follows never-assigned let/var keys and aliased maps (backlog 0170)", () => {
  const ONE: [string, string][] = [
    ["let key", "let k = 'innerHTML'\nel[k] = x"],
    ["var key", "var k = 'outerHTML'\nel[k] = x"],
    ["let key, member target in a nested computed key", "let k = 'innerHTML'\nconst o = { a: el }\no.a[k] = x"],
    ["Object.assign alias", "const o = { innerHTML: x }\nObject.assign(el, o)"],
    ["Object.assign alias chain", "const o = { outerHTML: x }\nconst p = o\nObject.assign(el, p)"],
    ["Object.defineProperties alias", "const d = { innerHTML: { value: x } }\nObject.defineProperties(el, d)"],
  ];
  for (const [name, src] of ONE)
    it(`one E1002: ${name}`, () => {
      expect(codes("E1002", `${EL}${src}\n`)).toHaveLength(1);
    });

  const NONE: [string, string][] = [
    ["reassigned let key", "let k = 'innerHTML'\nk = 'title'\nel[k] = x"],
    ["updated var key", "var k = 'innerHTML'\nk += 'x'\nel[k] = x"],
    ["destructuring-assigned key", "let k = 'innerHTML'\n;[k] = ['title']\nel[k] = x"],
    ["for-of assigned key", "let k = 'innerHTML'\nfor (k of ['title']) el[k] = x"],
    ["alias of a safe map", "const o = { title: x }\nObject.assign(el, o)"],
    ["reassigned map alias", "let o = { innerHTML: x }\no = { title: x }\nObject.assign(el, o)"],
  ];
  for (const [name, src] of NONE)
    it(`no E1002: ${name}`, () => {
      expect(codes("E1002", `${EL}${src}\n`)).toEqual([]);
    });
});

describe("E1603 covers blob: URLs, workers and a function's prototype (backlog 0171)", () => {
  const ONE: [string, string][] = [
    ["import(createObjectURL)", "export const a = (x: string) => import(URL.createObjectURL(new Blob([x])));"],
    [
      "import(aliased object URL)",
      "export const a = (x: string) => { const u = URL.createObjectURL(new Blob([x])); return import(u); };",
    ],
    ["import(blob: prefix)", "export const a = (id: string) => import('blob:' + id);"],
    ["new Worker(createObjectURL)", "export const a = (x: string) => new Worker(URL.createObjectURL(new Blob([x])));"],
    [
      "new SharedWorker(globalThis.URL.createObjectURL)",
      "export const a = (x: string) => new SharedWorker(globalThis.URL.createObjectURL(new Blob([x])));",
    ],
    ["new Worker(data:)", "export const a = (x: string) => new Worker('data:text/javascript,' + x);"],
    [
      "getPrototypeOf(async function).constructor",
      "export const a = (x: string) => Object.getPrototypeOf(async function () {}).constructor(x);",
    ],
    [
      "Reflect.getPrototypeOf(arrow).constructor",
      "export const a = (x: string) => Reflect.getPrototypeOf(() => {}).constructor(x);",
    ],
    [
      "getPrototypeOf(declared generator) through an alias",
      "function* g() {}\nconst f = g\nexport const a = (x: string) => new (Object.getPrototypeOf(f).constructor)(x);",
    ],
  ];
  for (const [name, src] of ONE)
    it(`one E1603: ${name}`, () => {
      expect(codes("E1603", src)).toHaveLength(1);
    });

  const NONE: [string, string][] = [
    ["new Worker(path)", "export const a = () => new Worker('/worker.js');"],
    ["new Worker(new URL)", "export const a = () => new Worker(new URL('./w.ts', import.meta.url));"],
    ["createObjectURL not imported", "export const a = (b: Blob) => URL.createObjectURL(b);"],
    ["getPrototypeOf(object).constructor", "export const a = (o: object) => Object.getPrototypeOf(o).constructor;"],
    ["import(./a.ts)", "export const a = () => import('./a.ts');"],
  ];
  for (const [name, src] of NONE)
    it(`no E1603: ${name}`, () => {
      expect(codes("E1603", src)).toEqual([]);
    });
});
