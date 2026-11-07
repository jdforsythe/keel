// Seed 1337
// Spec: k.ctx, clause "`Temporal.Now.instant()`, `performance.timeOrigin`, `navigator.sendBeacon(u, b)`, and `new Intl.DateTimeFormat('en').format()` are each one E1601; `.format(d)` is not."
// Spec: k.ctx, clause "`(() => {}).constructor(s)`, `(async () => {}).constructor(s)`, `Function.prototype.constructor(s)`, and `import('data:text/javascript,' + s)` are each one E1603; `import('./a.ts')` is not."
// RFC 0058 / backlog 0152: each repro as `export const a = () => <expr>;` in `modules/app/a.ts`.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

const of = (source: string, code: string) =>
  check([{ path: "modules/app/a.ts", source }], { types: false }).diagnostics.filter((d) => d.code === code);
const repro = (expr: string): string =>
  `declare const u: string\ndeclare const b: Blob\ndeclare const s: string\ndeclare const d: Date\nexport const a = () => ${expr};\n`;

const E1601_REPROS: readonly string[] = [
  "Temporal.Now.instant()",
  "Temporal.Now.plainDateISO()",
  "performance.timeOrigin",
  "navigator.sendBeacon(u, b)",
  "new Intl.DateTimeFormat('en').format()",
  "new Intl.DateTimeFormat('en').formatToParts()",
  "Intl.DateTimeFormat().format()",
];

for (const expr of E1601_REPROS) {
  test(`\`${expr}\` is one E1601`, () => {
    const found = of(repro(expr), "E1601");
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(5);
  });
}

test("`new Intl.DateTimeFormat('en').format(d)` with a date is not E1601", () => {
  expect(of(repro("new Intl.DateTimeFormat('en').format(d)"), "E1601")).toEqual([]);
  expect(of(repro("new Intl.NumberFormat('en').format()"), "E1601")).toEqual([]);
});

test("a `DateTimeFormat` held in a `const` is followed: `f.format()` is one E1601, `f.format(d)` none", () => {
  const head = "declare const d: Date\nconst f = new Intl.DateTimeFormat('en')\n";
  expect(of(`${head}export const a = () => f.format()\n`, "E1601")).toHaveLength(1);
  expect(of(`${head}export const a = () => f.format(d)\n`, "E1601")).toEqual([]);
});

test("aliased `Temporal.Now` and `navigator.sendBeacon` are one E1601 each, at the use", () => {
  expect(of("const N = Temporal.Now\nexport const a = () => N.instant()\n", "E1601")).toHaveLength(1);
  expect(of("const { sendBeacon } = navigator\nexport const a = (u: string) => sendBeacon(u)\n", "E1601")).toHaveLength(
    1,
  );
});

test("other `navigator` and `performance` members are not E1601", () => {
  expect(of(repro("navigator.language"), "E1601")).toEqual([]);
  expect(of(repro("performance.mark('x')"), "E1601")).toEqual([]);
});

const E1603_REPROS: readonly string[] = [
  "(() => {}).constructor(s)",
  "(async () => {}).constructor(s)",
  "(function* () {}).constructor(s)",
  "(async function () {}).constructor(s)",
  "new (function () {}).constructor(s)",
  "Function.prototype.constructor(s)",
  "import('data:text/javascript,' + s)",
  "import(`data:text/javascript,${s}`)",
  "import(' DATA:text/javascript,x')",
];

for (const expr of E1603_REPROS) {
  test(`\`${expr}\` is one E1603`, () => {
    expect(of(repro(expr), "E1603")).toHaveLength(1);
  });
}

test("a function's `constructor` through an alias, and a data URL through a `const` prefix, are one E1603 each", () => {
  expect(of("const F = (() => {}).constructor\nexport const a = (s: string) => F(s)\n", "E1603")).toHaveLength(1);
  expect(of("function g() {}\nexport const a = (s: string) => g.constructor(s)\n", "E1603")).toHaveLength(1);
  const prefix = "const p = 'data:text/javascript,'\nexport const a = (s: string) => import(p + s)\n";
  expect(of(prefix, "E1603")).toHaveLength(1);
});

test("`import('./a.ts')`, a computed import, and ordinary function use are not E1603", () => {
  expect(of(repro("import('./a.ts')"), "E1603")).toEqual([]);
  expect(of(repro("import(u)"), "E1603")).toEqual([]);
  expect(of(repro("import('https://example.com/data:x.js')"), "E1603")).toEqual([]);
  const plain = "function g() {}\nexport const a = (x: object) => [g.bind(x), g.call(x), x.constructor, g.name]\n";
  expect(of(plain, "E1603")).toEqual([]);
  expect(of("class A {}\nexport const a = () => new A()\n", "E1603")).toEqual([]);
});

/** `import()` sources that start with a data URL, built from constant parts through aliases, `+` and templates. */
const dataSource = fc
  .record({
    split: fc.integer({ min: 1, max: 4 }),
    form: fc.constantFrom<"plus" | "template" | "alias">("plus", "template", "alias"),
    upper: fc.boolean(),
  })
  .map(({ split, form, upper }) => {
    const scheme = upper ? "DATA:" : "data:";
    const head = scheme.slice(0, split);
    const tail = `${scheme.slice(split)}text/javascript,`;
    if (form === "plus") return { decls: "", expr: `'${head}' + '${tail}' + s` };
    if (form === "template") return { decls: `const t = '${tail}'\n`, expr: `\`${head}\${t}\${s}\`` };
    return { decls: `const h = '${head}'\nconst p = h + '${tail}'\n`, expr: "p + s" };
  });

test("an `import()` of a data URL built from constant parts is E1603 exactly once", () => {
  fc.assert(
    fc.property(dataSource, ({ decls, expr }) => {
      const src = `${decls}export const a = (s: string) => import(${expr})\n`;
      expect(of(src, "E1603"), src).toHaveLength(1);
    }),
    // Seed 1337
    { seed: SEED, numRuns: 60 },
  );
});

test("the no-date `format()` fix passes `ctx.clock.now()` as the date", () => {
  const [d] = of("export const a = () => new Intl.DateTimeFormat('en').format()\n", "E1601");
  expect(d?.fix).toContain("+export const a = () => new Intl.DateTimeFormat('en').format(ctx.clock.now())");
});
