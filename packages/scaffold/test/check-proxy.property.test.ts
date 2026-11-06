// Properties of the E1353 check proxy: generated trees are clean; a broken edit is caught and nothing is written.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { scaffold } from "../src/index.ts";
import { diagnose } from "../src/internal/diagnose.ts";
import { RUNS, SEED, tree } from "./helpers.ts";

describe("check proxy", () => {
  it("every generated tree has no unresolved import, cross-module violation, or deps cycle", () => {
    fc.assert(
      fc.property(tree, (t) => {
        expect(diagnose(t.files)).toEqual([]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a move that would create a deps cycle reports E1353 and leaves the tree as it was", () => {
    fc.assert(
      fc.property(tree, (t) => {
        fc.pre(t.modules.length >= 2);
        const [a = "", b = ""] = t.modules;
        const files = new Map(t.files);
        const comp = t.components[0] ?? "";
        const at = [...files.keys()].find((p) => p.endsWith(`/${comp}.tsx`)) ?? "";
        const home = at.split("/")[1] ?? "";
        const other = home === a ? b : a;
        files.set(
          `modules/${other}/module.ts`,
          `import { module } from '@keel/compiler'\nexport default module({ id: '${other}', deps: ['${home}'], capabilities: [], public: { exports: [], routes: [] } })\n`,
        );
        files.set(
          `modules/${home}/Uses.tsx`,
          `import C from './${comp}.tsx'\nexport default function Uses() {\n  return C\n}\n`,
        );
        const before = JSON.stringify([...files]);
        const r = scaffold("move", { name: comp, to: other }, files);
        expect(r.ok).toBe(false);
        expect(JSON.stringify(r)).toContain("E1353");
        expect(JSON.stringify(r)).toContain("E1153");
        expect(JSON.stringify([...files])).toBe(before);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
