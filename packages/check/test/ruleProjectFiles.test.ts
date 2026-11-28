import { type SourceFile, check, defineRule } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const seen = new Map<string, readonly string[]>();
defineRule({
  code: "E2922",
  message: "project probe",
  see: "k.check",
  explain: "Records the project paths a rule receives per file.",
  check: ({ file, project }) => {
    seen.set(
      file.path,
      project.map((f) => f.path),
    );
    return [];
  },
});

const file = (path: string): SourceFile => ({ path, source: `export const ${path.replace(/\W.*$/, "")} = 1;\n` });

test("a rule's project holds every code file of opts.project, not only the checked files", () => {
  fc.assert(
    fc.property(fc.uniqueArray(fc.constantFrom("a", "b", "c", "d", "e"), { minLength: 2 }), (names) => {
      const all = [...names.map((n) => file(`${n}.ts`)), { path: "package.json", source: "{}\n" }];
      seen.clear();
      check(all, { types: false });
      const whole = [...(seen.get(`${names[0]}.ts`) ?? [])].sort();
      seen.clear();
      check(all.slice(0, 1), { types: false, project: all });
      expect([...(seen.get(`${names[0]}.ts`) ?? [])].sort()).toEqual(whole);
      expect(whole).toEqual(names.map((n) => `${n}.ts`).sort());
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("a checked file's text is the one in the project", () => {
  const stale = { path: "a.ts", source: "export const a = 0;\n" };
  const fresh = file("a.ts");
  let text = "";
  defineRule({
    code: "E2923",
    message: "text probe",
    see: "k.check",
    explain: "Records the text of a.ts the project holds.",
    check: ({ project }) => {
      text = project.find((f) => f.path === "a.ts")?.source ?? "";
      return [];
    },
  });
  check([fresh], { types: false, project: [stale, file("b.ts")] });
  expect(text).toBe(fresh.source);
});
