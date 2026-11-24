// k.compat Sources: for generated sources the normal form is invariant under each formatter-only edit kind and changes under each meaning-changing kind.
import fc from "fast-check";
import { expect, test } from "vitest";
import { sourceHash } from "../src/internal/sourceHash.ts";

const FC = { seed: 1337, numRuns: 60 };

type Item = { name: string; str: string; num: number; flags: string; key: string; tail: boolean };
const item = fc.record({
  name: fc.constantFrom("a", "b", "c", "d", "e", "f"),
  str: fc.stringMatching(/^[a-z ]{0,6}$/),
  num: fc.integer({ min: 0, max: 5000 }),
  flags: fc.constantFrom("gi", "ig", "gim", "mgi"),
  key: fc.constantFrom("k", "kk", "key"),
  tail: fc.boolean(),
});
const items = fc
  .uniqueArray(item, { selector: (i) => i.name, minLength: 2, maxLength: 5 })
  .map((xs) => xs.map((x, i) => ({ ...x, name: `${x.name}${String(i)}` })));

type Style = {
  quote: string;
  semi: boolean;
  num: (n: number) => string;
  eol: string;
  indent: string;
  comment: boolean;
  paren: boolean;
  bom: boolean;
  flags: (f: string) => string;
  quoteKey: boolean;
};
const compact: Style = {
  quote: "'",
  semi: false,
  num: String,
  eol: "\n",
  indent: "  ",
  comment: false,
  paren: false,
  bom: false,
  flags: (f) => f,
  quoteKey: false,
};
const styled = fc.record({
  quote: fc.constantFrom("'", '"'),
  semi: fc.boolean(),
  num: fc.constantFrom(
    (n: number) => String(n),
    (n: number) => `${String(n)}.0`,
    (n: number) => `0x${n.toString(16)}`,
    (n: number) => (n === 0 ? "0" : `${String(n)}e0`),
  ),
  eol: fc.constantFrom("\n", "\r\n"),
  indent: fc.constantFrom("", "  ", "\t"),
  comment: fc.boolean(),
  paren: fc.boolean(),
  bom: fc.boolean(),
  flags: fc.constantFrom(
    (f: string) => f,
    (f: string) => [...f].sort().join(""),
  ),
  quoteKey: fc.boolean(),
});

const render = (xs: readonly Item[], s: Style, reorderImports: boolean): string => {
  const q = (v: string): string => `${s.quote}${v}${s.quote}`;
  const sc = s.semi ? ";" : "";
  const imports = ["import { x as xa } from 'xs'", "import { y } from 'xs'", "import './p.ts'", "import './q.ts'"];
  const head = reorderImports ? [imports[1], imports[0], imports[2], imports[3]] : imports;
  const lines = xs.map((x) => {
    const key = s.quoteKey ? q(x.key) : x.key;
    const value = s.paren ? `(${s.num(x.num)})` : s.num(x.num);
    return `${s.comment ? "/* c */ " : ""}export const ${x.name} = {${s.eol}${s.indent}${key}: ${value},${s.eol}${s.indent}s: ${q(x.str)}${x.tail ? "," : ""}${s.eol}}${sc} // end`;
  });
  const re = `export const re = /ab/${s.flags(xs[0]?.flags ?? "gi")}${sc}`;
  const out = [...head.map((h) => `${h}${sc}`), ...lines, re].join(s.eol) + s.eol;
  return (s.bom ? "﻿" : "") + out;
};

test("the form is invariant under each formatter-only edit kind, alone and composed", () => {
  fc.assert(
    fc.property(items, styled, fc.boolean(), (xs, s, reorder) => {
      expect(sourceHash("m.ts", render(xs, s, reorder))).toBe(sourceHash("m.ts", render(xs, compact, false)));
    }),
    FC,
  );
});

test("the form changes under each meaning-changing edit kind", () => {
  fc.assert(
    fc.property(items, fc.integer({ min: 0, max: 4 }), (xs, kind) => {
      const base = sourceHash("m.ts", render(xs, compact, false));
      const first = xs[0];
      const second = xs[1];
      if (first === undefined || second === undefined) return;
      const edited: Item[][] = [
        [{ ...first, num: first.num + 1 }, ...xs.slice(1)],
        [{ ...first, str: `${first.str}z` }, ...xs.slice(1)],
        [second, first, ...xs.slice(2)],
        [{ ...first, key: `${first.key}x` }, ...xs.slice(1)],
        xs.slice(1),
      ];
      const next = edited[kind] ?? xs;
      expect(sourceHash("m.ts", render(next, compact, false))).not.toBe(base);
    }),
    FC,
  );
});

test("an import binding added, renamed or reordered against a side-effect import is seen only when it changes the set or the effect order", () => {
  const h = (src: string): string | undefined => sourceHash("m.ts", src);
  expect(h("import { a } from 'x'\nimport './p.ts'\n")).toBe(h("import './p.ts'\nimport { a } from 'x'\n"));
  expect(h("import './p.ts'\nimport './q.ts'\n")).not.toBe(h("import './q.ts'\nimport './p.ts'\n"));
  expect(h("import { a } from 'x'\n")).not.toBe(h("import { a as b } from 'x'\n"));
  expect(h("import type { A } from 'x'\n")).toBe(h("import { type A } from 'x'\n"));
  expect(h("import { a } from 'x'\n")).not.toBe(h("import { a } from 'y'\n"));
});
