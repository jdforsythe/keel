// Spec: k.reveal, Sinks "Its `.call`, `.apply` or `.bind`, or `Reflect.apply` of it, passes it each argument after the `this` value."
// Spec: k.reveal, Flow "a local any value given to it carries: initializer, assignment (a destructuring one alike), `for...of` head, member write (`o.k = v`), or argument of its `push`, `unshift`, `splice`, `fill`, `set`, `add`, `append` or of `Object.assign`. A read after a statement assigning `name`, alone or in a pattern, in an enclosing block sees only that value and later ones;"
// Spec: k.reveal, Flow "a method called on one other than `includes`, `startsWith`, `endsWith`, `indexOf` and `has`; `concat`, `replace`, `replaceAll`, `padStart`, `padEnd`, `fill`, `set` or `add` given one;"
// Spec: k.reveal, Flow "`String`, `new String`, `String.raw`, `JSON.stringify`, `structuredClone`, `Array.from`, `Array.of`, `Object.assign`, `Object.values`, `Object.entries`, `Object.fromEntries`, `new Map`, `new Set`, `btoa`, `encodeURI`, `encodeURIComponent` or `Buffer.from` of one."
// Spec: k.reveal, Flow "A callback's parameter and a field of `this` hold nothing."
// Spec: k.reveal, Conformance "`[a] = [reveal(p.k)]` or `({ a } = { a: reveal(p.k) })` then `console.log(a)`, and `q.splice(0, 0, reveal(p.k))` or `q.fill(reveal(p.k))` then `console.log(q)`, are each one E1112; `[a] = [hash(a)]` after `let a = reveal(p.k)`, and `q.length` after the `fill`, are none."
// Spec: k.reveal, Conformance "`new Map([['k', reveal(p.k)]])`, `new Set([reveal(p.k)])`, `Object.fromEntries([['k', reveal(p.k)]])`, `Array.of(reveal(p.k))` and `new Map().set('k', reveal(p.k))` in `tx` are each one E1112; `.size` and `.has('k')` of each are none."
// Spec: k.reveal, Conformance "`console.log.call(console, reveal(p.k))`, `console.log.apply(console, [reveal(p.k)])`, `console.log.bind(console, reveal(p.k))` and `Reflect.apply(console.log, console, [reveal(p.k)])` are each one E1112; `console.log.call(reveal(p.k))` and `hash.call(null, reveal(p.k))` are none."
// Spec: k.reveal, Conformance "`console.log(a.length)` after `const { a } = { a: reveal(p.k) }`, `[reveal(p.k)].forEach((x) => console.log(x))`, and `this.x = reveal(p.k)` then `console.log(this.x)` are none."
// Seed: 1337.
// Loose: the spec gives no exact message or column, so findings are asserted by code and the line of the argument.
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import type { Files } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`,
);
const HEAD = [
  "import { reveal } from '@keel/schema'",
  "import { tx, store } from '@keel/store'",
  "const hash = (x) => x.length",
  "const t = {}",
].join("\n");
const FIRST_BODY_LINE = HEAD.split("\n").length + 2;

/** Findings of E1112 for a server file whose action body is `lines`; also asserts no E1105. */
const findings = (lines: string[]) => {
  const src = `${HEAD}\nexport async function act(ctx, p) {\n${lines.map((l) => `  ${l}`).join("\n")}\n}\n`;
  const ds = check([MANIFEST, f("modules/app/x.server.ts", src)], { types: false }).diagnostics;
  expect(ds.filter((d) => d.code === "E1105")).toHaveLength(0);
  return ds.filter((d) => d.code === "E1112");
};
type Row = [lines: string[], bodyLine: number];
const expectOne = (lines: string[], at: number) => {
  const ds = findings(lines);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.code).toBe("E1112");
  expect(ds[0]?.line).toBe(FIRST_BODY_LINE + at);
};
const expectNone = (lines: string[]) => {
  expect(findings(lines)).toHaveLength(0);
};

describe("k.reveal conformance: destructuring assignment, splice and fill", () => {
  const positives: Row[] = [
    [["let a;", "[a] = [reveal(p.k)];", "console.log(a)"], 2],
    [["let a;", "({ a } = { a: reveal(p.k) });", "console.log(a)"], 2],
    [["const q = [];", "q.splice(0, 0, reveal(p.k));", "console.log(q)"], 2],
    [["const q = [0];", "q.fill(reveal(p.k));", "console.log(q)"], 2],
  ];
  const negatives: string[][] = [
    ["let a = reveal(p.k);", "[a] = [hash(a)];", "console.log(a)"],
    ["const q = [0];", "q.fill(reveal(p.k));", "console.log(q.length)"],
  ];
  test("`[a] = [reveal(p.k)]` or `({ a } = { a: reveal(p.k) })` then `console.log(a)`, and `q.splice(0, 0, reveal(p.k))` or `q.fill(reveal(p.k))` then `console.log(q)`, are each one E1112; `[a] = [hash(a)]` after `let a = reveal(p.k)`, and `q.length` after the `fill`, are none", () => {
    for (const [lines, at] of positives) expectOne(lines, at);
    for (const lines of negatives) expectNone(lines);
  });
});

describe("k.reveal conformance: collections, fromEntries and Array.of in tx", () => {
  const forms = [
    "new Map([['k', reveal(p.k)]])",
    "new Set([reveal(p.k)])",
    "Object.fromEntries([['k', reveal(p.k)]])",
    "Array.of(reveal(p.k))",
    "new Map().set('k', reveal(p.k))",
  ];
  test("`new Map([['k', reveal(p.k)]])`, `new Set([reveal(p.k)])`, `Object.fromEntries([['k', reveal(p.k)]])`, `Array.of(reveal(p.k))` and `new Map().set('k', reveal(p.k))` in `tx` are each one E1112; `.size` and `.has('k')` of each are none", () => {
    for (const x of forms) expectOne([`tx(t, { v: ${x} })`], 0);
    for (const x of forms) {
      expectNone([`tx(t, { v: ${x}.size })`]);
      expectNone([`tx(t, { v: ${x}.has('k') })`]);
    }
  });
});

describe("k.reveal conformance: call, apply, bind and Reflect.apply of a sink", () => {
  const positives = [
    "console.log.call(console, reveal(p.k))",
    "console.log.apply(console, [reveal(p.k)])",
    "console.log.bind(console, reveal(p.k))",
    "Reflect.apply(console.log, console, [reveal(p.k)])",
  ];
  const negatives = ["console.log.call(reveal(p.k))", "hash.call(null, reveal(p.k))"];
  test("`console.log.call(console, reveal(p.k))`, `console.log.apply(console, [reveal(p.k)])`, `console.log.bind(console, reveal(p.k))` and `Reflect.apply(console.log, console, [reveal(p.k)])` are each one E1112; `console.log.call(reveal(p.k))` and `hash.call(null, reveal(p.k))` are none", () => {
    for (const x of positives) expectOne([x], 0);
    for (const x of negatives) expectNone([x]);
  });
});

describe("k.reveal conformance: a destructured length, a callback parameter and this", () => {
  const nones: string[][] = [
    ["const { a } = { a: reveal(p.k) };", "console.log(a.length)"],
    ["[reveal(p.k)].forEach((x) => console.log(x))"],
    ["this.x = reveal(p.k);", "console.log(this.x)"],
  ];
  test("`console.log(a.length)` after `const { a } = { a: reveal(p.k) }`, `[reveal(p.k)].forEach((x) => console.log(x))`, and `this.x = reveal(p.k)` then `console.log(this.x)` are none", () => {
    for (const lines of nones) expectNone(lines);
  });
});
