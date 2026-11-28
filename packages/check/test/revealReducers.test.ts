// E1303 (b) through reducer shapes beyond the inline function: named, const-bound and imported reducers, `reveal`
// aliases and destructuring, element access, and a namespace-imported `transaction`; and the shapes it leaves alone.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });
const out = (files: SourceFile[]): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1303")
    .map((d) => `${d.path} ${d.line}:${d.col} ${d.message}`);
const R = "import { reveal } from '@keel/schema'\n";
const K = "import * as K from '@keel/schema'\n";
const TX = "import { transaction } from '@keel/store'\n";
const P = "s.object({ k: s.secret(s.string()) })";
const S = "import { s } from '@keel/schema'\n";
const file = (body: string): SourceFile => f("modules/app/c.ts", `${S}${body}`);
const uses = (name = "x"): string => `transaction ${name} uses reveal; state never holds a secret`;

describe("E1303 (b) reducer shapes it reports", () => {
  it("a function declaration passed by name, at the reveal", () => {
    const src = `${R}${TX}function reduce(st, p) { return { t: reveal(p.k) } }\nexport const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([file(src)])).toEqual([`modules/app/c.ts 4:38 ${uses()}`]);
  });

  it("a const arrow passed by name", () => {
    const src = `${R}${TX}const reduce = (st, p) => ({ t: reveal(p.k) })\nexport const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([file(src)])).toHaveLength(1);
  });

  it("a reducer imported from a relative file, named or default, at the argument", () => {
    const red = f("modules/app/red.ts", `${R}export function reduce(st, p) { return { t: reveal(p.k) } }\n`);
    const named = `import { reduce } from './red.ts'\n${TX}export const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([red, file(named)])).toEqual([`modules/app/c.ts 4:77 ${uses()}`]);
    const def = f("modules/app/red2.ts", `${R}export default (st, p) => ({ t: reveal(p.k) })\n`);
    const viaDefault = `import reduce from './red2'\n${TX}export const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([def, file(viaDefault)])).toHaveLength(1);
    const constRed = f("modules/app/red3.ts", `${K}export const reduce = (st, p) => ({ t: K['reveal'](p.k) })\n`);
    const viaConst = `import { reduce as r } from './red3.ts'\n${TX}export const x = transaction(c, 'x', ${P}, r)\n`;
    expect(out([constRed, file(viaConst)])).toHaveLength(1);
  });

  it("a const alias of reveal and a chain of them", () => {
    const one = `${R}${TX}const r = reveal\nexport const x = transaction(c, 'x', ${P}, (st, p) => ({ t: r(p.k) }))\n`;
    expect(out([file(one)])).toEqual([`modules/app/c.ts 5:94 ${uses()}`]);
    const chain = `${R}${TX}const a = reveal\nconst b = a\nexport const x = transaction(c, 'x', ${P}, (st, p) => ({ t: b(p.k) }))\n`;
    expect(out([file(chain)])).toHaveLength(1);
  });

  it("destructuring reveal from a namespace import, renamed or not", () => {
    const renamed = `${K}${TX}const { reveal: r } = K\nexport const x = transaction(c, 'x', ${P}, (st, p) => ({ t: r(p.k) }))\n`;
    expect(out([file(renamed)])).toHaveLength(1);
    const plain = `${K}${TX}const { reveal } = K\nexport const x = transaction(c, 'x', ${P}, (st, p) => ({ t: reveal(p.k) }))\n`;
    expect(out([file(plain)])).toHaveLength(1);
  });

  it("element access on a namespace import", () => {
    const src = `${K}${TX}export const x = transaction(c, 'x', ${P}, (st, p) => ({ t: K['reveal'](p.k) }))\n`;
    expect(out([file(src)])).toHaveLength(1);
  });

  it("transaction through a namespace import of @keel/store", () => {
    const src = `${R}import * as St from '@keel/store'\nexport const x = St.transaction(c, 'x', ${P}, (st, p) => ({ t: reveal(p.k) }))\n`;
    expect(out([file(src)])).toHaveLength(1);
  });
});

describe("E1303 (b) shapes it leaves alone", () => {
  it("reveal in an action handler beside a tx call (golden-2 postToken)", () => {
    const src = `import { err, ok, reveal } from '@keel/schema'\nimport { tx, transaction } from '@keel/store'\nexport const post = (token, stores) => {\n  const added = tx(stores.addToken, { id: 1 })\n  return added.ok ? ok({ token: reveal(token) }) : err(added.error)\n}\n`;
    expect(out([file(src)])).toEqual([]);
  });

  it("an inline reducer beside a named helper that reveals (golden-1 hydrate)", () => {
    const src = `${R}${TX}function show(p) { return reveal(p.k) }\nexport const hydrate = transaction(view, 'todos.hydrate', BoardView, (_state, data) => data)\n`;
    expect(out([file(src)])).toEqual([]);
  });

  it("a named reducer without reveal while another function reveals", () => {
    const src = `${R}${TX}const r = reveal\nfunction reduce(st, p) { return { ...st, n: p.n } }\nexport const show = (p) => r(p.k)\nexport const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([file(src)])).toEqual([]);
  });

  it("an imported reducer whose file reveals only in another export", () => {
    const red = f(
      "modules/app/red.ts",
      `${R}export function reduce(st, p) { return { ...st, n: p.n } }\nexport const show = (p) => reveal(p.k)\n`,
    );
    const src = `import { reduce } from './red.ts'\n${TX}export const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([red, file(src)])).toEqual([]);
  });

  it("a named reducer that shadows reveal, other members and keys, a package reducer", () => {
    const shadow = `${R}${TX}function reduce(st, reveal) { return { t: reveal.k } }\nexport const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([file(shadow)])).toEqual([]);
    const other = `${K}import * as O from 'other'\n${TX}export const x = transaction(c, 'x', ${P}, (st, p) => ({ a: K['parse'](p), b: O['reveal'](p.k), c: K[p.key] }))\n`;
    expect(out([file(other)])).toEqual([]);
    const pkg = `import { reduce } from 'other'\n${TX}export const x = transaction(c, 'x', ${P}, reduce)\n`;
    expect(out([file(pkg)])).toEqual([]);
    const notKeel = `import * as St from 'other'\n${R}export const x = St.transaction(c, 'x', ${P}, (st, p) => ({ t: reveal(p.k) }))\n`;
    expect(out([file(notKeel)])).toEqual([]);
  });
});
