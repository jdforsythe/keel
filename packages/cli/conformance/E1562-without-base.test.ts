// Spec: k.compat, clause "`keel check` without `--base` reports no E1562; a changed byte of `.keel/surface.json` is E1005."
// Seed 1337. Real binary over a temp project; the tamper is a one-character change at a generated offset.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { SEED, buildAndCheck, cleanup, diags, keel, materialize, project, readText, write } from "./compat-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

test("`keel check` without `--base` reports no E1562", () => {
  const dir = materialize(
    project({
      input: "s.object({ name: s.string(), note: s.string() })",
      body: "s.object({ name: s.string() })",
      split: true,
    }),
  );
  dirs.push(dir);
  expect(diags(buildAndCheck(dir), "E1562")).toEqual([]);
});

test("a changed byte of `.keel/surface.json` is E1005", () => {
  const dir = materialize(project());
  dirs.push(dir);
  expect(keel(dir, ["build"]).status).toBe(0);
  const original = readText(dir, ".keel/surface.json");
  fc.assert(
    fc.property(fc.nat(), fc.integer({ min: 1, max: 90 }), (at, shift) => {
      const i = at % original.length;
      const code = 0x20 + ((original.charCodeAt(i) - 0x20 + shift) % 95);
      const tampered = original.slice(0, i) + String.fromCharCode(code) + original.slice(i + 1);
      fc.pre(tampered !== original);
      try {
        write(dir, { ".keel/surface.json": tampered });
        expect(diags(keel(dir, ["check"]), "E1005").map((d) => d.path)).toContain(".keel/surface.json");
      } finally {
        write(dir, { ".keel/surface.json": original });
      }
    }),
    { seed: SEED, numRuns: 4 },
  );
});
