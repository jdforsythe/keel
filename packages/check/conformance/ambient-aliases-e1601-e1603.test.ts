// Seed 1337
// Spec: k.ctx, clause "`const D = Date; D.now()`, `` Date[`now`]() ``, and `const { random } = Math; random()` are each one E1601, at the call; after `const Date = ctx.clock`, `Date.now()` is not E1601."
// Spec: k.ctx, clause "For an alias chain of depth 1 to 4 to `Date.now` or `Math.random`, E1601 is reported exactly once, at the call."
// Spec: k.ctx, clause "`eval(s)`, `Function(s)`, `new Function(s)`, and `const e = eval; e(s)` are each one E1603; a locally declared `Function` is not."
// Spec: k.ctx, Rules "An alias is reported at its uses, not where it is declared, unless it is exported there."
// Backlog 0151 (exported aliases), 0153 (constructor constants and `instanceof` operands stay clean).
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

const diags = (source: string, path = "src/a.ts") => check([{ path, source }], { types: false }).diagnostics;
const of = (source: string, code: string) => diags(source).filter((d) => d.code === code);

test("`const D = Date; D.now()` is one E1601, at the call", () => {
  const src = "const D = Date\nexport const a = () => D.now()\n";
  const found = of(src, "E1601");
  expect(found).toHaveLength(1);
  expect(found[0]?.line).toBe(2);
  expect(found[0]?.col).toBe((src.split("\n")[1] ?? "").indexOf("D.now") + 1);
});

test("`` Date[`now`]() `` is one E1601, at the call", () => {
  const src = "export const a = () => Date[`now`]()\n";
  const found = of(src, "E1601");
  expect(found).toHaveLength(1);
  expect(found[0]?.line).toBe(1);
  expect(found[0]?.col).toBe(src.indexOf("Date[") + 1);
});

test("`const { random } = Math; random()` is one E1601, at the call", () => {
  const src = "const { random } = Math\nexport const a = () => random()\n";
  const found = of(src, "E1601");
  expect(found).toHaveLength(1);
  expect(found[0]?.line).toBe(2);
  expect(found[0]?.col).toBe((src.split("\n")[1] ?? "").indexOf("random()") + 1);
});

test("after `const Date = ctx.clock`, `Date.now()` is not E1601", () => {
  const src = "export const a = (ctx: { clock: { now(): number } }) => { const Date = ctx.clock; return Date.now() }\n";
  expect(of(src, "E1601")).toEqual([]);
});

interface Chain {
  target: "Date.now" | "Math.random";
  decls: string[];
  call: string;
}

/** Link forms: each declares `name` as the previous expression `prev`. */
const links: ((prev: string, name: string) => string)[] = [
  (prev, n) => `const ${n} = ${prev}`,
  (prev, n) => `const ${n} = (${prev})`,
];

const chainArb: fc.Arbitrary<Chain> = fc
  .record({
    target: fc.constantFrom<"Date.now" | "Math.random">("Date.now", "Math.random"),
    depth: fc.integer({ min: 1, max: 4 }),
    shape: fc.integer({ min: 0, max: 5 }),
    link: fc.array(fc.integer({ min: 0, max: links.length - 1 }), { minLength: 4, maxLength: 4 }),
    viaGlobal: fc.boolean(),
  })
  .map(({ target, depth, shape, link, viaGlobal }) => {
    const root = target === "Date.now" ? "Date" : "Math";
    const member = target === "Date.now" ? "now" : "random";
    const g = viaGlobal ? "globalThis." : "";
    const decls: string[] = [];
    // Link 1 reaches the target by one of six forms; the rest alias the previous name.
    let first: string;
    let isFn: boolean;
    switch (shape) {
      case 0:
        decls.push(`const a1 = ${g}${root}`);
        first = "a1";
        isFn = false;
        break;
      case 1:
        decls.push(`const a1 = ${g}${root}.${member}`);
        first = "a1";
        isFn = true;
        break;
      case 2:
        decls.push(`const { ${member}: a1 } = ${g}${root}`);
        first = "a1";
        isFn = true;
        break;
      case 3:
        decls.push(`const { ${member}: a1 } = ${root}`);
        first = "a1";
        isFn = true;
        break;
      case 4:
        decls.push(`const a1 = ${g}${root}['${member}']`);
        first = "a1";
        isFn = true;
        break;
      default:
        decls.push(`const a1 = ${g}${root}[\`${member}\`]`);
        first = "a1";
        isFn = true;
        break;
    }
    let last = first;
    for (let i = 2; i <= depth; i++) {
      const mk = links[link[i - 1] ?? 0] ?? links[0];
      const name = `a${i}`;
      decls.push(mk ? mk(last, name) : `const ${name} = ${last}`);
      last = name;
    }
    const call = isFn ? `${last}()` : `${last}.${member}()`;
    return { target, decls, call };
  });

const paramDefaultArb = fc.constantFrom<"Date.now" | "Math.random">("Date.now", "Math.random");

test("for an alias chain of depth 1 to 4 to Date.now or Math.random, E1601 is reported exactly once, at the call", () => {
  fc.assert(
    fc.property(chainArb, (c) => {
      const src = `${c.decls.join("\n")}\nexport const run = () => {\n  return ${c.call}\n}\n`;
      const found = of(src, "E1601");
      expect(found, src).toHaveLength(1);
      expect(found[0]?.line, src).toBe(c.decls.length + 2);
    }),
    // Seed 1337
    { seed: SEED, numRuns: 50 },
  );
});

test("a parameter default aliasing Date or Math is reported once, at the call", () => {
  fc.assert(
    fc.property(paramDefaultArb, (t) => {
      const root = t === "Date.now" ? "Date" : "Math";
      const member = t === "Date.now" ? "now" : "random";
      const src = `export const run = (a = ${root}) => {\n  return a.${member}()\n}\n`;
      const found = of(src, "E1601");
      expect(found, src).toHaveLength(1);
      expect(found[0]?.line, src).toBe(2);
    }),
    // Seed 1337
    { seed: SEED, numRuns: 10 },
  );
});

test("`eval(s)` is one E1603", () => {
  expect(of("export const a = (s: string) => eval(s)\n", "E1603")).toHaveLength(1);
});

test("`Function(s)` is one E1603", () => {
  expect(of("export const a = (s: string) => Function(s)\n", "E1603")).toHaveLength(1);
});

test("`new Function(s)` is one E1603", () => {
  expect(of("export const a = (s: string) => new Function(s)\n", "E1603")).toHaveLength(1);
});

test("`const e = eval; e(s)` is one E1603", () => {
  expect(of("const e = eval\nexport const a = (s: string) => e(s)\n", "E1603")).toHaveLength(1);
});

test("a locally declared `Function` is not E1603", () => {
  expect(of("const Function = (s: string) => s\nexport const a = () => Function('x')\n", "E1603")).toEqual([]);
});

test("an exported alias is reported where it is declared: named export, destructuring, specifier, default", () => {
  const cases: [string, number, number][] = [
    ["export const D = Date\n", 1, 14],
    ["export const M = Math\n", 1, 14],
    ["export const { now } = Date\n", 1, 16],
    ["const D = Date\nexport { D }\n", 2, 10],
    ["const D = Date\nexport default D\n", 2, 16],
  ];
  for (const [src, line, col] of cases) {
    const found = of(src, "E1601");
    expect(found, src).toHaveLength(1);
    expect([found[0]?.line, found[0]?.col], src).toEqual([line, col]);
  }
});

test("constructor constants and `instanceof` operands are not E1601", () => {
  expect(of("export const a = () => WebSocket.OPEN\n", "E1601")).toEqual([]);
  expect(of("export const a = (x: unknown) => x instanceof XMLHttpRequest\n", "E1601")).toEqual([]);
});
