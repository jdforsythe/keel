// k.scaffold Guarantee over a library (k.library-pack): renaming a component keeps `module.ts` `public.exports` naming it.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Files, RUNS, SEED, apply, snap, upper } from "./helpers.ts";

/** The library's own folder, as `keel codemod` reads it there. */
const library = (): Files =>
  new Map(
    [...apply("library", { name: "@acme/charts", version: "0.0.0" }, new Map())].map(([p, t]) => [
      p.replace(/^charts\//, ""),
      t,
    ]),
  );

describe("rename in a library", () => {
  it("Example to Chart renames the export in module.ts, the file, its import in src/index.ts", () => {
    const after = apply("rename", { kind: "component", from: "Example", to: "Chart" }, library());
    expect(after.get("module.ts")).toContain("public: { exports: ['Chart'] }");
    expect(after.get("module.ts")).not.toContain("Example");
    expect(after.has("src/Chart.tsx")).toBe(true);
    expect(after.has("src/Example.tsx")).toBe(false);
    expect(after.get("src/index.ts") ?? "").not.toContain("Example");
  });

  it("any PascalCase name and back restores the tree, and module.ts names the new one between", () => {
    fc.assert(
      fc.property(upper, (to) => {
        const before = library();
        const there = apply("rename", { kind: "component", from: "Example", to }, before);
        expect(there.get("module.ts")).toContain(`exports: ['${to}']`);
        const back = apply("rename", { kind: "component", from: to, to: "Example" }, there);
        expect(snap(back)).toBe(snap(before));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
