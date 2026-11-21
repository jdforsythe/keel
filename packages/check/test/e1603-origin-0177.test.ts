// RFC 0065 (backlog 0177): E1603 follows a URL or constructor to its origin. Each bad form gave `[]` before: the rule
// read only the outermost form of the `import()`/`Worker` argument and the resolver stopped at one prototype step.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const e1603 = (body: string): string[] =>
  check([{ path: "modules/app/a.ts", source: `declare const s: string;\ndeclare const c: boolean;\n${body}\n` }], {
    types: false,
  })
    .diagnostics.filter((d) => d.code === "E1603")
    .map((d) => `${d.line}:${d.col} ${d.message}`);

const BLOB = "URL.createObjectURL(new Blob([s]))";
const arrow = (expr: string): string => `export const a = () => ${expr};`;

describe("E1603 unwraps the forms a blob: or data: URL passes through (backlog 0177)", () => {
  const ONE: [string, string][] = [
    ["template literal", arrow(`import(\`\${${BLOB}}\`)`)],
    ["+ ''", arrow(`import(${BLOB} + '')`)],
    ["'' +", arrow(`import('' + ${BLOB})`)],
    ["String(...)", arrow(`import(String(${BLOB}))`)],
    ["toString()", arrow(`import(${BLOB}.toString())`)],
    ["new URL(...)", arrow(`new Worker(new URL(${BLOB}))`)],
    ["new URL(...).href", arrow(`import(new URL(${BLOB}).href)`)],
    ["Reflect.construct(Worker, [...])", arrow(`Reflect.construct(Worker, [${BLOB}])`)],
    ["Reflect.construct(SharedWorker, [data:])", arrow(`Reflect.construct(SharedWorker, ['data:,' + s])`)],
    [
      "assigned after declaration",
      `export const a = () => {\n  let u: string;\n  u = ${BLOB};\n  return import(u);\n};`,
    ],
    [
      "one of several assignments",
      `export const a = () => {\n  let u = './a.ts';\n  if (c) u = ${BLOB};\n  return import(u);\n};`,
    ],
    ["conditional branch", arrow(`import(c ? ${BLOB} : './a.ts')`)],
    ["logical operand", arrow(`import(c && ${BLOB})`)],
    ["object literal property", `const o = { u: ${BLOB} };\n${arrow("import(o.u)")}`],
  ];
  for (const [name, src] of ONE)
    it(`one E1603: ${name}`, () => {
      expect(e1603(src)).toHaveLength(1);
    });
});

describe("E1603 follows a function's prototype chain to the Function constructor (backlog 0177)", () => {
  const ONE: [string, string][] = [
    [
      "prototype of an async arrow's prototype",
      arrow("Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s)"),
    ],
    [
      "prototype of a generator's prototype",
      arrow("Reflect.getPrototypeOf(Object.getPrototypeOf(function* () {})).constructor(s)"),
    ],
    [
      "async method of an object literal",
      `const o = { async m() {} };\n${arrow("Object.getPrototypeOf(o.m).constructor(s)")}`,
    ],
    ["method's constructor", `const o = { m() {} };\n${arrow("o.m.constructor(s)")}`],
    [
      "aliased constructor",
      `const F = Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor;\n${arrow("F(s)")}`,
    ],
    [
      "constructor through .call",
      arrow("Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor.call(null, s)"),
    ],
    [
      "constructor through Reflect.construct",
      arrow("Reflect.construct(Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor, [s])"),
    ],
    [
      "new of a prototype's constructor",
      arrow("new (Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor)(s)"),
    ],
  ];
  for (const [name, src] of ONE)
    it(`one E1603: ${name}`, () => {
      expect(e1603(src)).toHaveLength(1);
    });
});

describe("E1603 stays clean where the origin is not code (backlog 0177)", () => {
  const NONE: [string, string][] = [
    ["module worker URL", arrow("new Worker(new URL('./w.js', import.meta.url))")],
    ["relative template import", arrow("import(`./${s}.ts`)")],
    ["Reflect.construct of a script path", arrow("Reflect.construct(Worker, ['/w.js'])")],
    ["assigned a path", "export const a = () => {\n  let u: string;\n  u = './a.ts';\n  return import(u);\n};"],
    ["String of a parameter", arrow("import(String(s))")],
    ["blob URL as a download link", `export const a = (el: HTMLAnchorElement) => {\n  el.href = ${BLOB};\n};`],
    [
      "Object, not Function, two steps above a plain arrow",
      arrow("Object.getPrototypeOf(Object.getPrototypeOf(() => {})).constructor(s)"),
    ],
    [
      "Object, three steps above an async arrow",
      arrow("Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(async () => {}))).constructor(s)"),
    ],
    [
      "data property of an object literal",
      `const o = { m: 1 };\n${arrow("Object.getPrototypeOf(o.m).constructor(s)")}`,
    ],
  ];
  for (const [name, src] of NONE)
    it(`no E1603: ${name}`, () => {
      expect(e1603(src)).toEqual([]);
    });
});

describe("E1603 origin walk edges (rfc:0065)", () => {
  const ONE: [string, string][] = [
    [
      "async declaration two steps up",
      `async function f() {}\n${arrow("Object.getPrototypeOf(Object.getPrototypeOf(f)).constructor(s)")}`,
    ],
    ["prototype of Function", arrow("Object.getPrototypeOf(Function).constructor(s)")],
    ["template led by an empty constant", arrow(`import(\`\${''}\${${BLOB}}\`)`)],
    ["template of constant parts", arrow("import(`${'da'}ta:,${s}`)")],
    ["chained +", arrow(`import('' + '' + ${BLOB})`)],
    ["computed key of an object literal", `const o = { u: ${BLOB} };\n${arrow("import(o['u'])")}`],
    ["||= assignment", `export const a = () => {\n  let u = '';\n  u ||= ${BLOB};\n  return import(u);\n};`],
    ["new URL with a base", arrow(`new SharedWorker(new URL(${BLOB}, 'https://x.test'))`)],
  ];
  for (const [name, src] of ONE)
    it(`one E1603: ${name}`, () => {
      expect(e1603(src)).toHaveLength(1);
    });
  const NONE: [string, string][] = [
    [
      "plain declaration two steps up",
      `function f() {}\n${arrow("Object.getPrototypeOf(Object.getPrototypeOf(f)).constructor(s)")}`,
    ],
    [
      "plain function expression two steps up",
      arrow("Object.getPrototypeOf(Object.getPrototypeOf(function () {})).constructor(s)"),
    ],
    ["class two steps up", arrow("Object.getPrototypeOf(Object.getPrototypeOf(class {})).constructor(s)")],
    ["prototype of Function.prototype", arrow("Object.getPrototypeOf(Function.prototype).constructor(s)")],
    ["prototype of another call's result", arrow("Object.getPrototypeOf(Object.keys(async () => {})).constructor(s)")],
    ["constructor of a non-function", "const o = { m: 'x' };\nexport const a = () => o.m.constructor(s);"],
    ["template led by a path", arrow(`import(\`./\${${BLOB}}\`)`)],
    [
      "+= keeps the declared prefix",
      `export const a = () => {\n  let u = './a';\n  u += ${BLOB};\n  return import(u);\n};`,
    ],
    [
      "a member assigned, not the local",
      `export const a = (o: { u: string }, u: string) => {\n  o.u = ${BLOB};\n  return import(u);\n};`,
    ],
    [
      "a global of the same name as an assigned local",
      `export const f = () => {\n  let name: string;\n  name = ${BLOB};\n  return name;\n};\nexport const a = () => import(name);`,
    ],
    [
      "new of another constructor",
      `declare class Box { constructor(u: string) }\n${arrow(`import(new Box(${BLOB}))`)}`,
    ],
    ["toString of a parameter", arrow("import(s.toString())")],
    ["property missing from the literal", `const o = { u: ${BLOB} };\n${arrow("import(o.v)")}`],
    ["property of a non-literal", `declare const o: { u: string };\n${arrow("import(o.u)")}`],
    ["Reflect.construct of another constructor", arrow(`Reflect.construct(URL, [${BLOB}])`)],
    ["Reflect.apply of a URL", arrow(`Reflect.apply(String, null, [${BLOB}])`)],
  ];
  for (const [name, src] of NONE)
    it(`no E1603: ${name}`, () => {
      expect(e1603(src)).toEqual([]);
    });
});

describe("E1603 follows assignments by binding, not by name (backlog 0187)", () => {
  it("no E1603: a parameter named like another function's blob URL local", () => {
    const src =
      "export function save(b: Blob) {\n  const url = URL.createObjectURL(b);\n  return url;\n}\nexport function load(url: string) {\n  return import(url);\n}";
    expect(e1603(src)).toEqual([]);
  });
  it("no E1603: a Worker parameter named like a blob URL local in another function", () => {
    const src = `export const save = (b: Blob) => {\n  let src = '';\n  src = URL.createObjectURL(b);\n  return src;\n};\nexport const run = (src: string) => new Worker(src);`;
    expect(e1603(src)).toEqual([]);
  });
  it("one E1603: the same file's own blob URL local reaches import()", () => {
    const src =
      "export function save(b: Blob) {\n  const url = URL.createObjectURL(b);\n  return url;\n}\nexport function load(url: string) {\n  return import(url);\n}\nexport function run(b: Blob) {\n  let url: string;\n  url = URL.createObjectURL(b);\n  return import(url);\n}";
    expect(e1603(src)).toEqual(["13:10 import(blob:) runs code from a string; pass a function"]);
  });
});
