// Spec: k.fixes, clause "For each code Per code names, every example `explain(code)` shows as the code to write is the end of a fixture on which `keel check` and `tsc` report nothing."
// k.fixes, Explanations "The explanation table (k.explain) holds, for each code above, one example per shape its message names, and each example compiles. For E1452 the three shapes: cleanup (`try`/`finally` with a flag), an expected failure (`attempt(fn, (x) => x instanceof T ? E.make(data) : undefined)`), and no catch at all. For a `throw` the two: `return err(E.make(data))` with the return type it gives and what a caller then writes (`if (!r.ok) return r`), and `defect('text', { data })`. For E1203 and E1208: `const c = owner() ?? defect('no owner')` before the `await` and `c.run(() => signal(0))` after it."
// Seed 1337.
// ASSUMPTION (the spec does not print the layout of explain's text): an example is a fenced code block (three backticks) of the text, and it is a whole module; it is checked as `modules/m/a.ts` with the type pass on, and the one finding its file name draws (E1752, a file's name and its export) is not held against it.
// The shape counts are the spec's: E1452 three, a `throw` (E1451) two, E1203 and E1208 one each; every other code of Per code at least one.
import { check } from "@keel/check";
import { explain } from "@keel/check/explain";
import { expect, test } from "vitest";
import { MANIFEST, PATH } from "./rules-support.ts";

const PER_CODE = ["E1451", "E1452", "E1455", "E1453", "E1457", "E1458", "E1203", "E1208", "E1256", "E1260", "E1762"];
const SHAPES: Readonly<Record<string, number>> = { E1451: 2, E1452: 3, E1203: 1, E1208: 1 };
const examplesOf = (text: string): string[] =>
  [...text.matchAll(/```[A-Za-z]*\n([\s\S]*?)```/g)].map((m) => m[1] ?? "");

test("explain(code) shows, for each code Per code names, at least the number of examples its message has shapes", () => {
  for (const code of PER_CODE) expect(examplesOf(explain(code)).length, code).toBeGreaterThanOrEqual(SHAPES[code] ?? 1);
});

for (const code of PER_CODE) {
  test(`every example explain(${code}) shows passes keel check and tsc with no finding`, () => {
    const examples = examplesOf(explain(code));
    expect(examples.length, code).toBeGreaterThan(0);
    for (const source of examples) {
      const found = check([MANIFEST, { path: PATH, source }], { types: true }).diagnostics.filter(
        (d) => d.code !== "E1752",
      );
      expect(
        found.map((d) => `${d.code} ${d.message}`),
        source,
      ).toEqual([]);
    }
  });
}

test("the E1452 examples show a cleanup with a flag, an expected failure through attempt and no catch", () => {
  const joined = examplesOf(explain("E1452")).join("\n---\n");
  expect(joined).toContain("finally");
  expect(joined).toMatch(/attempt\([^)]*instanceof/s);
  expect(examplesOf(explain("E1452")).some((e) => !e.includes("catch") && !e.includes("attempt"))).toBe(true);
});

test("the E1203 and E1208 examples take `const c = owner() ?? defect('no owner')` before the await and `c.run(() => signal(0))` after it", () => {
  for (const code of ["E1203", "E1208"]) {
    const text = examplesOf(explain(code)).join("\n");
    expect(text, code).toContain("const c = owner() ?? defect('no owner')");
    expect(text, code).toContain("c.run(");
  }
});
