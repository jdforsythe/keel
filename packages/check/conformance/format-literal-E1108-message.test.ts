// k.formats, E1108's message "**E1108's message.** `formatLiteral text is not a string literal`, `formatLiteral format is no format type over a string`, `formatLiteral format <names> is not one registered format` (`<names>` joined by ` & `; `temporal.Instant`: 66 units), or `formatLiteral text does not parse as <name> (<rule>)`. For an unregistered format whose argument is imported from a `@keel/std-*` package the file's module does not list in `deps`, the fix adds that package to `deps` in `modules/<id>/module.ts`; that only a stdlib format has a literal form is `keel explain`'s."
// k.formats, Rules "... at the argument at fault; fix: below, else none."
// Seed 1337 (the property). `check(files, {})`, the type pass on, as format-literal-E1108.test.ts.
// ASSUMPTIONS: `<rule>` is not named by the spec, so the parse-failure form is asserted by its head, `)` tail and the 89-unit bound; "unregistered" is a module whose `deps` omit `@keel/std-temporal`.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MODULE = (deps: readonly string[]): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] } })\n`;
const HEAD = "import { formatLiteral } from '@keel/schema'\nimport { Instant } from '@keel/std-temporal'\n";
const project = (deps: readonly string[], body: string): Files => [
  { path: "modules/app/module.ts", source: MODULE(deps) },
  { path: "modules/app/At.ts", source: `${HEAD}${body}` },
];
const e1108 = (files: Files) => check(files, {}).diagnostics.filter((d) => d.code === "E1108");
const TEMPORAL = ["@keel/std-temporal"];

describe("k.formats: E1108's message", () => {
  test("a text that is not a string literal is `formatLiteral text is not a string literal`", () => {
    const m = e1108(
      project(TEMPORAL, "const t = '1970-01-01T00:00:00.000Z'\nexport const x = formatLiteral(Instant, t)\n"),
    );
    expect(m.map((d) => d.message)).toEqual(["formatLiteral text is not a string literal"]);
  });

  test("a format argument that is no format type is `formatLiteral format is no format type over a string`", () => {
    const m = e1108(project(TEMPORAL, "const n = 5\nexport const x = formatLiteral(n, 'x')\n"));
    expect(m.map((d) => d.message)).toEqual(["formatLiteral format is no format type over a string"]);
  });

  test("a failing literal is `formatLiteral text does not parse as temporal.Instant (<rule>)`, at most 89 units", () => {
    fc.assert(
      fc.property(fc.integer({ min: 30, max: 31 }), fc.constantFrom(2), (day, month) => {
        const text = `2026-0${month}-${day}T00:00:00.000Z`;
        const m = e1108(project(TEMPORAL, `export const x = formatLiteral(Instant, '${text}')\n`));
        expect(m).toHaveLength(1);
        const msg = m[0]?.message ?? "";
        expect(msg.startsWith("formatLiteral text does not parse as temporal.Instant (")).toBe(true);
        expect(msg.endsWith(")")).toBe(true);
        expect(msg.length).toBeLessThanOrEqual(89);
      }),
      { seed: SEED, numRuns: 4 },
    );
  });
});

describe("k.formats: E1108 carries no fix for a registered format", () => {
  test("a registered format (the package listed) with a failing literal carries no fix; the unregistered form and its fix are in packages/cli/conformance/format-literal-e1108-fix.test.ts, where `keel check` starts with no format registered", () => {
    const d = e1108(project(TEMPORAL, "export const x = formatLiteral(Instant, '2026-02-30T00:00:00.000Z')\n"));
    expect(d).toHaveLength(1);
    expect(d[0]?.fix).toBeUndefined();
  });
});
