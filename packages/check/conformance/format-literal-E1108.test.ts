// k.formats, Rules "E1108 a `formatLiteral` call whose `text` is not a string literal (`'…'`, `"…"`, or a template with no substitution), whose `format`'s type names no one format registered under its name (a `line`, `para` or message format among them), or whose `text` fails that format's `parse` (message names the format and the first issue's rule), at the argument at fault; fix: below, else none."
// Spec: k.formats, clause "In a module whose `deps` list `@keel/std-temporal`, `keel check` reports one E1108 at the text argument, its message containing `temporal.Instant` and `format`, for `formatLiteral(Instant, '2026-02-30T00:00:00.000Z')`, and none for `formatLiteral(Instant, '2026-02-28T00:00:00.000Z')`; the same holds in a test file of that module."
// Spec: k.formats, clause "`const t = '1970-01-01T00:00:00.000Z'` then `formatLiteral(Instant, t)` reports one E1108 at `t`, as does a template with a substitution; `` formatLiteral(Instant, `1970-01-01T00:00:00.000Z`) `` reports none."
// Spec: k.formats, clause "`formatLiteral(I, '1970-01-01T00:00:00.000Z')` with `import { Instant as I }`, and `formatLiteral(T.Instant, '1970-01-01T00:00:00.000Z')` with `import * as T from '@keel/std-temporal'`, report no E1108; `formatLiteral(line({ max: 80 }), 'Pasta')` reports one E1108 at its first argument, its message containing `line(1..80)`."
// Seed 1337. `keel check` imports each `@keel/std-*` package in the module's `deps` itself, so the fixtures are source text.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MODULE = (deps: string[]): Files[number] => ({
  path: "modules/app/module.ts",
  source: `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] } })\n`,
});
const TEMPORAL = ["@keel/std-temporal"];
const HEAD = "import { Instant, PlainDate } from '@keel/std-temporal'\n";
const OK_INSTANT = "1970-01-01T00:00:00.000Z";

/** A one-line app file `modules/app/<file>` whose last line is `export const x = <expr>` after `before` lines. */
const file = (path: string, before: string, expr: string, head = HEAD): Files => [
  MODULE(TEMPORAL),
  { path, source: `${head}${before}export const x = ${expr}\n` },
];
const e1108 = (files: Files) => check(files, {}).diagnostics.filter((d) => d.code === "E1108");

/** Line and column (1-based) of the first `needle` in the last line of `source`. */
const at = (source: string, needle: string): { line: number; col: number } => {
  const lines = source.trimEnd().split("\n");
  const last = lines.length;
  return { line: last, col: (lines[last - 1] ?? "").indexOf(needle) + 1 };
};
const lastSource = (files: Files): string => files[files.length - 1]?.source ?? "";

const pad = (n: number, w: number): string => String(n).padStart(w, "0");
const leap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dim = (y: number, m: number): number =>
  [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
const ymd = fc.record({
  y: fc.integer({ min: 1, max: 9999 }),
  m: fc.integer({ min: 1, max: 12 }),
  d: fc.integer({ min: 1, max: 31 }),
});

describe("k.formats Rules: E1108 on a literal that fails the format's `parse`", () => {
  test("`formatLiteral(Instant, '2026-02-30T00:00:00.000Z')` reports one E1108 at the text argument, its message containing `temporal.Instant` and `format`", () => {
    const files = file(
      "modules/app/At.ts",
      "",
      "formatLiteral(Instant, '2026-02-30T00:00:00.000Z')",
      `import { formatLiteral } from '@keel/schema'\n${HEAD}`,
    );
    const ds = e1108(files);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toContain("temporal.Instant");
    expect(ds[0]?.message).toContain("format");
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(lastSource(files), "'2026-02-30"));
    expect(ds[0]?.path).toBe("modules/app/At.ts");
  });

  test("`formatLiteral(Instant, '2026-02-28T00:00:00.000Z')` reports no E1108", () => {
    const files = file(
      "modules/app/At.ts",
      "",
      "formatLiteral(Instant, '2026-02-28T00:00:00.000Z')",
      `import { formatLiteral } from '@keel/schema'\n${HEAD}`,
    );
    expect(e1108(files)).toEqual([]);
  });

  test("the same holds in a test file of that module", () => {
    const head = `import { formatLiteral } from '@keel/schema'\n${HEAD}`;
    const bad = file("modules/app/At.test.ts", "", "formatLiteral(Instant, '2026-02-30T00:00:00.000Z')", head);
    const ds = e1108(bad);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("modules/app/At.test.ts");
    expect(ds[0]?.message).toContain("temporal.Instant");
    expect(ds[0]?.message).toContain("format");
    expect(
      e1108(file("modules/app/At.test.ts", "", "formatLiteral(Instant, '2026-02-28T00:00:00.000Z')", head)),
    ).toEqual([]);
  });

  test("property: a `PlainDate` literal is E1108 exactly when the date is not on the calendar, in an app file and in a test file", () => {
    fc.assert(
      fc.property(ymd, fc.constantFrom("modules/app/At.ts", "modules/app/At.test.ts"), ({ y, m, d }, path) => {
        const text = `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
        const files = file(
          path,
          "",
          `formatLiteral(PlainDate, '${text}')`,
          `import { formatLiteral } from '@keel/schema'\n${HEAD}`,
        );
        const ds = e1108(files);
        expect(ds).toHaveLength(d <= dim(y, m) ? 0 : 1);
        if (ds[0] !== undefined) {
          expect(ds[0].message).toContain("temporal.PlainDate");
          expect({ line: ds[0].line, col: ds[0].col }).toEqual(at(lastSource(files), `'${text}'`));
        }
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("property: an `Instant` literal is E1108 exactly when its date is not on the calendar", () => {
    fc.assert(
      fc.property(ymd, ({ y, m, d }) => {
        const text = `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}T00:00:00.000Z`;
        const files = file(
          "modules/app/At.ts",
          "",
          `formatLiteral(Instant, '${text}')`,
          `import { formatLiteral } from '@keel/schema'\n${HEAD}`,
        );
        expect(e1108(files)).toHaveLength(d <= dim(y, m) ? 0 : 1);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});

describe("k.formats Rules: E1108 on a `text` that is not a string literal", () => {
  const head = `import { formatLiteral } from '@keel/schema'\n${HEAD}`;

  test("`const t = '1970-01-01T00:00:00.000Z'` then `formatLiteral(Instant, t)` reports one E1108 at `t`", () => {
    const files = file("modules/app/At.ts", `const t = '${OK_INSTANT}'\n`, "formatLiteral(Instant, t)", head);
    const ds = e1108(files);
    expect(ds).toHaveLength(1);
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(lastSource(files), "t)"));
  });

  test("a template with a substitution reports one E1108 at the template", () => {
    const files = file(
      "modules/app/At.ts",
      "const y = '1970'\n",
      "formatLiteral(Instant, `${y}-01-01T00:00:00.000Z`)",
      head,
    );
    const ds = e1108(files);
    expect(ds).toHaveLength(1);
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(lastSource(files), "`${y}"));
  });

  test("`` formatLiteral(Instant, `1970-01-01T00:00:00.000Z`) `` reports none", () => {
    expect(e1108(file("modules/app/At.ts", "", `formatLiteral(Instant, \`${OK_INSTANT}\`)`, head))).toEqual([]);
  });

  test("property: a literal that parses is clean in single quotes, double quotes and a template with no substitution; any identifier in its place is one E1108", () => {
    const ident = fc.stringMatching(/^[a-z]{1,8}$/).filter((n) => n !== "x");
    fc.assert(
      fc.property(fc.constantFrom("'", '"', "`"), ident, (q, name) => {
        expect(e1108(file("modules/app/At.ts", "", `formatLiteral(Instant, ${q}${OK_INSTANT}${q})`, head))).toEqual([]);
        const files = file(
          "modules/app/At.ts",
          `const ${name} = '${OK_INSTANT}'\n`,
          `formatLiteral(Instant, ${name})`,
          head,
        );
        const ds = e1108(files);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.col).toBe(at(lastSource(files), `${name})`).col);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("k.formats Rules: E1108 follows the call through the import and the format's type", () => {
  const schema = "import { formatLiteral } from '@keel/schema'\n";

  test("`formatLiteral(I, '1970-01-01T00:00:00.000Z')` with `import { Instant as I }` reports no E1108", () => {
    const files = file(
      "modules/app/At.ts",
      "",
      `formatLiteral(I, '${OK_INSTANT}')`,
      `${schema}import { Instant as I } from '@keel/std-temporal'\n`,
    );
    expect(e1108(files)).toEqual([]);
  });

  test("`formatLiteral(T.Instant, '1970-01-01T00:00:00.000Z')` with `import * as T from '@keel/std-temporal'` reports no E1108", () => {
    const files = file(
      "modules/app/At.ts",
      "",
      `formatLiteral(T.Instant, '${OK_INSTANT}')`,
      `${schema}import * as T from '@keel/std-temporal'\n`,
    );
    expect(e1108(files)).toEqual([]);
  });

  test("a failing literal through a renamed import and through a namespace import is still one E1108", () => {
    const renamed = file(
      "modules/app/At.ts",
      "",
      "formatLiteral(I, '2026-02-30T00:00:00.000Z')",
      `${schema}import { Instant as I } from '@keel/std-temporal'\n`,
    );
    const ns = file(
      "modules/app/At.ts",
      "",
      "formatLiteral(T.Instant, '2026-02-30T00:00:00.000Z')",
      `${schema}import * as T from '@keel/std-temporal'\n`,
    );
    expect(e1108(renamed)).toHaveLength(1);
    expect(e1108(ns)).toHaveLength(1);
  });

  test("`formatLiteral(line({ max: 80 }), 'Pasta')` reports one E1108 at its first argument, its message containing `line(1..80)`", () => {
    const files: Files = [
      MODULE(["@keel/std-text"]),
      {
        path: "modules/app/At.ts",
        source: `import { formatLiteral } from '@keel/schema'\nimport { line } from '@keel/std-text'\nexport const x = formatLiteral(line({ max: 80 }), 'Pasta')\n`,
      },
    ];
    const ds = e1108(files);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toContain("line(1..80)");
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(lastSource(files), "line({"));
  });
});

describe("k.formats Rules: E1108 carries no fix", () => {
  test("no E1108 diagnostic carries a fix, for a non-literal text and a failing literal", () => {
    const head = `import { formatLiteral } from '@keel/schema'\n${HEAD}`;
    const all = [
      ...e1108(file("modules/app/At.ts", `const t = '${OK_INSTANT}'\n`, "formatLiteral(Instant, t)", head)),
      ...e1108(file("modules/app/At.ts", "", "formatLiteral(Instant, '2026-02-30T00:00:00.000Z')", head)),
    ];
    expect(all).toHaveLength(2);
    expect(all.filter((d) => d.fix !== undefined)).toEqual([]);
  });
});
