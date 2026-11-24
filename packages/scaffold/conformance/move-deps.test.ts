// Spec: k.scaffold, Codemods "`move` relocates a file to another module, updating imports and manifests: a module gains each `deps` entry the move makes it need (k.module E1152) and loses each entry the move leaves unused (E1165)."
// Spec: k.scaffold, Conformance "`move F --to c`, `F` the only file of `a` importing from `b`, removes `b` from `a`'s `deps` and adds it to `c`'s; a module `d` whose one import from `a` was `F` gains `c` and loses `a`; `keel check`, clean before, is clean after, with no E1165."
// Seed 1337. The last half of the sentence (`keel check` clean) needs @keel/check, which this package's conformance does not depend on:
// it is asserted through the manifests (the entries E1152 asks for, and no others) and by module-E1165-unused-dep.test.ts in @keel/check.
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, type Files, apply, fresh, pascalName, read } from "./fixtures.ts";

const q = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
const manifest = (id: string, deps: string[], exports: string[]): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${q(deps)}, capabilities: [], public: { exports: ${q(exports)} } })\n`;

/** Modules alpha (F imports beta's Pub; F is alpha's only such file), beta, gamma (the target), delta (imports F from alpha). */
function project(F: string, extraAlphaImport: boolean): Files {
  let files = fresh();
  for (const id of ["alpha", "beta", "gamma", "delta"]) files = apply("module", { id }, files).files;
  files.set("modules/beta/module.ts", manifest("beta", [], ["Pub"]));
  files.set("modules/beta/Pub.ts", "export const Pub = 1\n");
  files.set("modules/alpha/module.ts", manifest("alpha", ["beta"], [F, "Keep"]));
  files.set(`modules/alpha/${F}.ts`, `import { Pub } from '../beta/Pub.ts'\nexport const ${F} = Pub\n`);
  files.set(
    "modules/alpha/Keep.ts",
    extraAlphaImport ? "import { Pub } from '../beta/Pub.ts'\nexport const Keep = Pub\n" : "export const Keep = 1\n",
  );
  files.set("modules/gamma/module.ts", manifest("gamma", [], []));
  files.set("modules/delta/module.ts", manifest("delta", ["alpha"], []));
  files.set("modules/delta/Use.ts", `import { ${F} } from '../alpha/${F}.ts'\nexport const Use = ${F}\n`);
  return files;
}
const depsOf = (files: Files, id: string): string => {
  const m = /deps:\s*\[([^\]]*)\]/.exec(read(files, `modules/${id}/module.ts`));
  return m?.[1] ?? "";
};

it("move F --to c, F the only file of a importing from b, removes b from a's deps and adds it to c's", () => {
  fc.assert(
    fc.property(pascalName, (F) => {
      const out = apply("move", { name: F, to: "gamma" }, project(F, false)).files;
      expect(depsOf(out, "alpha")).not.toContain("beta");
      expect(depsOf(out, "gamma")).toContain("beta");
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("a module d whose one import from a was F gains c and loses a", () => {
  fc.assert(
    fc.property(pascalName, (F) => {
      const out = apply("move", { name: F, to: "gamma" }, project(F, false)).files;
      expect(depsOf(out, "delta")).toContain("gamma");
      expect(depsOf(out, "delta")).not.toContain("alpha");
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("a module keeps a deps entry another of its files still uses after the move", () => {
  fc.assert(
    fc.property(pascalName, (F) => {
      const out = apply("move", { name: F, to: "gamma" }, project(F, true)).files;
      expect(depsOf(out, "alpha")).toContain("beta");
      expect(depsOf(out, "gamma")).toContain("beta");
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
