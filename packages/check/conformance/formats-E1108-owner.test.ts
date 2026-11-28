// k.formats, Literals "`keel check` parses `text` with the format the schema type registry holds under `N` (k.schema; `keel check` first imports each `@keel/std-*` package in `deps`, k.module Std config), in every code file it reads, test files among them. It consults the registry only when the package declaring the `format` value (the one holding the file its type's declaration is in) is a `@keel/std-*` package the project's app manifests list in `deps` at the time of the call; for any other, a kernel package, the app or one that cannot be told among them, `N` is not one registered format, whatever the process has registered, so an editor or `keel mcp` session answers as a fresh `keel check` does. It runs that registered format's `parse` on text from the source, and no app code."
// k.formats, E1108's message "`formatLiteral text is not a string literal`, `formatLiteral format is no format type over a string`, `formatLiteral format <names> is not one registered format` (`<names>` joined by ` & `; `temporal.Instant`: 66 units), `formatLiteral format's package cannot be told; write the format as its import` (when the declaring package cannot be told), or `formatLiteral text does not parse as <name> (<rule>)`. For an unregistered format whose argument is imported from a `@keel/std-*` package the file's module does not list in `deps`, the fix adds that package to `deps` in `modules/<id>/module.ts`; that only a stdlib format has a literal form is `keel explain`'s."
// k.formats, Rules "E1108 a `formatLiteral` call whose `text` is not a string literal (`'…'`, `\"…\"`, or a template with no substitution), whose `format`'s type names no one format registered under its name (a `line`, `para` or message format among them), or whose `text` fails that format's `parse` (message names the format and the first issue's rule), at the argument at fault; fix: below, else none."
// Spec: k.formats, clause "In one process where `s.format('p.code', s.string(), …)` has run before the call, `check()` over a module file holding `const Code = s.format('p.code', s.string(), { check: () => true, gen })` and `formatLiteral(Code, 'a')` reports one E1108 at `Code` whose message contains `p.code` and `is not one registered format`, as a fresh process does; `formatLiteral(pick ? Instant : Instant, '1970-01-01T00:00:00.000Z')` in a module listing `@keel/std-temporal` reports one E1108 at the first argument with message `formatLiteral format's package cannot be told; write the format as its import`."
// Seed 1337 (the properties below). `keel check` imports each `@keel/std-*` package in the module's `deps` itself, so the fixtures are source text; the one registration made in this process (`p.code`) is made through `@keel/schema`.
// Reading: "at `Code`" and "at the first argument" are the diagnostic's line and col of that expression in the file.
// Reading: a format declared by the app, even one named like a stdlib format, has an owner that is not a `@keel/std-*` package, so `N` is not one registered format.
import { check } from "@keel/check";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MODULE = (deps: readonly string[]): Files[number] => ({
  path: "modules/app/module.ts",
  source: `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] } })\n`,
});
const HEAD = "import { formatLiteral } from '@keel/schema'\nimport { Instant } from '@keel/std-temporal'\n";
const OK = "1970-01-01T00:00:00.000Z";
const e1108 = (files: Files) => check(files, {}).diagnostics.filter((d) => d.code === "E1108");
const NOT_TOLD = "formatLiteral format's package cannot be told; write the format as its import";
const colOf = (source: string, line: number, needle: string): number =>
  (source.split("\n")[line - 1] ?? "").indexOf(needle) + 1;

describe("k.formats Literals: the registry is consulted only for a format a `@keel/std-*` package in `deps` declares", () => {
  test("in one process where `s.format('p.code', s.string(), …)` has run before the call, `check()` over a module file holding `const Code = s.format('p.code', s.string(), { check: () => true, gen })` and `formatLiteral(Code, 'a')` reports one E1108 at `Code` whose message contains `p.code` and `is not one registered format`, as a fresh process does", () => {
    const source =
      "import { formatLiteral, s } from '@keel/schema'\ndeclare const gen: never\nconst Code = s.format('p.code', s.string(), { check: () => true, gen })\nexport const x = formatLiteral(Code, 'a')\n";
    const files: Files = [MODULE([]), { path: "modules/app/code.ts", source }];
    const fresh = e1108(files);
    s.format("p.code", s.string(), { check: () => true, gen: { from: s.string(), map: (v: string) => v } });
    const after = e1108(files);
    expect(after).toHaveLength(1);
    expect(after[0]?.message).toContain("p.code");
    expect(after[0]?.message).toContain("is not one registered format");
    expect(after[0]?.line).toBe(4);
    expect(after[0]?.col).toBe(colOf(source, 4, "Code,"));
    expect(after.map((d) => [d.line, d.col, d.message])).toEqual(fresh.map((d) => [d.line, d.col, d.message]));
  });

  test("`formatLiteral(pick ? Instant : Instant, '1970-01-01T00:00:00.000Z')` in a module listing `@keel/std-temporal` reports one E1108 at the first argument with message `formatLiteral format's package cannot be told; write the format as its import`", () => {
    expect(NOT_TOLD.length).toBe(77);
    const source = `${HEAD}declare const pick: boolean\nexport const x = formatLiteral(pick ? Instant : Instant, '${OK}')\n`;
    const ds = e1108([MODULE(["@keel/std-temporal"]), { path: "modules/app/at.ts", source }]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(NOT_TOLD);
    expect(ds[0]?.line).toBe(4);
    expect(ds[0]?.col).toBe(colOf(source, 4, "pick ?"));
  });

  test("a format the app declares under a stdlib name (`temporal.Instant`) is not the registered one, however the process stands: one E1108 `is not one registered format`", () => {
    const source =
      "import { formatLiteral, s } from '@keel/schema'\ndeclare const gen: never\nconst Mine = s.format('temporal.Instant', s.string(), { check: () => true, gen })\nexport const x = formatLiteral(Mine, 'anything')\n";
    for (const deps of [[], ["@keel/std-temporal"]]) {
      const ds = e1108([MODULE(deps), { path: "modules/app/mine.ts", source }]);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toContain("temporal.Instant");
      expect(ds[0]?.message).toContain("is not one registered format");
    }
  });

  test("property: the answer for `formatLiteral(Instant, …)` depends only on `deps`, whatever earlier calls of `check` in the process listed or imported", () => {
    const depsOf = fc.constantFrom<readonly string[]>(
      [],
      ["@keel/std-temporal"],
      ["@keel/std-text"],
      ["@keel/std-temporal", "@keel/std-text"],
    );
    const source = `${HEAD}export const x = formatLiteral(Instant, '${OK}')\n`;
    const answer = (deps: readonly string[]): number =>
      e1108([MODULE(deps), { path: "modules/app/at.ts", source }]).length;
    fc.assert(
      fc.property(fc.array(depsOf, { minLength: 1, maxLength: 5 }), (sequence) => {
        for (const deps of sequence) expect(answer(deps)).toBe(deps.includes("@keel/std-temporal") ? 0 : 1);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("a `@keel/std-*` format whose package the module does not list in `deps` is `is not one registered format`, with a fix adding the package, also after another call listed it", () => {
    const source = `${HEAD}export const x = formatLiteral(Instant, '${OK}')\n`;
    const listed = e1108([MODULE(["@keel/std-temporal"]), { path: "modules/app/at.ts", source }]);
    expect(listed).toEqual([]);
    const ds = e1108([MODULE([]), { path: "modules/app/at.ts", source }]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toContain("temporal.Instant");
    expect(ds[0]?.message).toContain("is not one registered format");
    expect(ds[0]?.fix).toContain("@keel/std-temporal");
  });

  test("the same holds in a test file: the owner decides, and a test file of a module listing the package parses the literal", () => {
    const bad = `${HEAD}export const x = formatLiteral(Instant, '2026-02-30T00:00:00.000Z')\n`;
    const files: Files = [MODULE(["@keel/std-temporal"]), { path: "modules/app/at.test.ts", source: bad }];
    const ds = e1108(files);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toContain("temporal.Instant");
    expect(ds[0]?.message).toContain("format");
  });

  test("the message for an owner that cannot be told is one line of 77 units, whichever other packages `deps` lists", () => {
    const source = `${HEAD}declare const pick: boolean\nexport const x = formatLiteral(pick ? Instant : Instant, '${OK}')\n`;
    fc.assert(
      fc.property(fc.subarray(["@keel/std-text", "@keel/std-money"]), (more) => {
        const ds = e1108([MODULE(["@keel/std-temporal", ...more]), { path: "modules/app/at.ts", source }]);
        expect(ds.map((d) => d.message)).toEqual([NOT_TOLD]);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });
});
