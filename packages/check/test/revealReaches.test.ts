// E1303 (b) reaches `reveal` through helpers, re-exported reducers and a re-exported `reveal`.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });
const out = (files: SourceFile[]): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1303")
    .map((d) => `${d.path} ${d.line}:${d.col}`);
const R = "import { reveal } from '@keel/schema'\n";
const TX = "import { transaction } from '@keel/store'\n";
const S = "import { s } from '@keel/schema'\n";
const P = "s.object({ k: s.secret(s.string()) })";
const app = (body: string): SourceFile => f("modules/app/c.ts", `${S}${body}`);

describe("E1303 (b) reveal in a helper", () => {
  it("a reducer that calls a same-file helper that reveals, also through a chain and a const helper", () => {
    const one = `${R}${TX}function show(p) { return reveal(p.k) }\nexport const x = transaction(c, 'x', ${P}, (st, p) => ({ t: show(p) }))\n`;
    expect(out([app(one)])).toHaveLength(1);
    const chain = `${R}${TX}const inner = (p) => reveal(p.k)\nfunction show(p) { return inner(p) }\nexport const x = transaction(c, 'x', ${P}, function reduce(st, p) { return { t: show(p) } })\n`;
    expect(out([app(chain)])).toHaveLength(1);
  });

  it("an imported reducer that calls a helper of its file that reveals", () => {
    const red = f(
      "modules/app/red.ts",
      `${R}function show(p) { return reveal(p.k) }\nexport const reduce = (st, p) => ({ t: show(p) })\n`,
    );
    const src = `import { reduce } from './red.ts'\n${TX}export const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([red, app(src)])).toHaveLength(1);
  });

  it("a helper that is called by no reducer, a recursive helper and a helper without reveal stay clean", () => {
    const loose = `${R}${TX}function show(p) { return reveal(p.k) }\nfunction rec(p) { return rec(p) }\nexport const x = transaction(c, 'x', ${P}, (st, p) => ({ t: rec(p) }))\n`;
    expect(out([app(loose)])).toEqual([]);
  });
});

describe("E1303 (b) re-exports", () => {
  it("a reducer re-exported by name, renamed, by `export *` and through two files", () => {
    const impl = f("modules/app/impl.ts", `${R}export const reduce = (st, p) => ({ t: reveal(p.k) })\n`);
    const use = (spec: string) =>
      `import { ${spec} } from './red.ts'\n${TX}export const x = transaction(c, 'x', ${P}, ${spec.split(" as ").pop()})\n`;
    for (const red of [
      "export { reduce } from './impl.ts'\n",
      "export { reduce as go } from './impl.ts'\n",
      "export * from './impl.ts'\n",
      "import { reduce } from './impl.ts'\nexport { reduce as go }\n",
    ])
      expect(
        out([impl, f("modules/app/red.ts", red), app(use(red.includes(" as go") ? "go" : "reduce"))]),
      ).toHaveLength(1);
    const mid = f("modules/app/mid.ts", "export { reduce } from './impl.ts'\n");
    const top = f("modules/app/red.ts", "export * from './mid.ts'\n");
    expect(out([impl, mid, top, app(use("reduce"))])).toHaveLength(1);
  });

  it("a re-export of a reducer without reveal, a cycle and a missing target stay clean", () => {
    const impl = f("modules/app/impl.ts", "export const reduce = (st, p) => ({ ...st, n: p.n })\n");
    const src = `import { reduce } from './red.ts'\n${TX}export const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([impl, f("modules/app/red.ts", "export { reduce } from './impl.ts'\n"), app(src)])).toEqual([]);
    const a = f("modules/app/red.ts", "export * from './b.ts'\n");
    const b = f("modules/app/b.ts", "export * from './red.ts'\n");
    expect(out([a, b, app(src)])).toEqual([]);
    expect(out([f("modules/app/red.ts", "export { reduce } from './gone.ts'\n"), app(src)])).toEqual([]);
  });
});

describe("E1303 (b) a re-exported reveal", () => {
  it("`export { reveal as open }`, with or without a source, through `export *` and two files", () => {
    const use = `import { open } from './r.ts'\n${TX}export const x = transaction(c, 'x', ${P}, (st, p) => ({ t: open(p.k) }))\n`;
    for (const r of [
      `${R}export { reveal as open }\n`,
      "export { reveal as open } from '@keel/schema'\n",
      "export * from './m.ts'\n",
    ])
      expect(
        out([
          f("modules/app/r.ts", r),
          f("modules/app/m.ts", "export { reveal as open } from '@keel/schema'\n"),
          app(use),
        ]),
      ).toHaveLength(1);
  });

  it("another export, a local `open` and another package stay clean", () => {
    const use = `import { open } from './r.ts'\n${TX}export const x = transaction(c, 'x', ${P}, (st, p) => ({ t: open(p.k) }))\n`;
    expect(
      out([f("modules/app/r.ts", `${R}export { reveal as show }\nexport const open = (v) => v\n`), app(use)]),
    ).toEqual([]);
    expect(out([f("modules/app/r.ts", "export { reveal as open } from 'other'\n"), app(use)])).toEqual([]);
  });
});
