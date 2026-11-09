// Seed 1337
// Spec: k.check, clause "A rule receives, as read-only `project`, every code file of its file's project and that project's `topology.ts`, the same array for each file it checks." (rfc:0070)
import { check, defineRule } from "@keel/check";
import type { SourceFile } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

const seen = new Map<string, readonly SourceFile[]>();
defineRule({
  code: "E2911",
  message: "project probe",
  see: "k.check",
  explain: "Records the project files a rule receives.",
  check: ({ file, project }) => {
    seen.set(file.path, project);
    return [];
  },
});

const TOPOLOGY = `import { topology } from "@keel/server";
export default topology({ web: { modules: ["cart"], adapter: "client" } });
`;

const paths = (p: readonly SourceFile[] | undefined): string[] => (p ?? []).map((f) => f.path).sort();

test("a rule on one file receives every code file of its project, with topology.ts, and no other files", () => {
  seen.clear();
  const files = [
    { path: "modules/cart/module.ts", source: "export const a = 1;\n" },
    { path: "modules/cart/cart.ts", source: "export const b = 2;\n" },
    { path: "topology.ts", source: TOPOLOGY },
    { path: "README.md", source: "# x\n" },
  ];
  check(files, { types: false });
  expect(paths(seen.get("modules/cart/module.ts"))).toEqual([
    "modules/cart/cart.ts",
    "modules/cart/module.ts",
    "topology.ts",
  ]);
  const cart = files.find((f) => f.path === "modules/cart/cart.ts");
  expect(seen.get("modules/cart/module.ts")?.find((f) => f.path === "modules/cart/cart.ts")?.source).toBe(cart?.source);
});

test("files of one project share one project list; a nested app project gets its own", () => {
  seen.clear();
  check(
    [
      { path: "modules/x/x.ts", source: "export const x = 1;\n" },
      { path: "apps/a/topology.ts", source: TOPOLOGY },
      { path: "apps/a/modules/cart/cart.ts", source: "export const c = 1;\n" },
      { path: "apps/a/modules/cart/module.ts", source: "export const m = 1;\n" },
    ],
    { types: false },
  );
  expect(seen.get("apps/a/modules/cart/cart.ts")).toBe(seen.get("apps/a/modules/cart/module.ts"));
  expect(paths(seen.get("apps/a/modules/cart/cart.ts"))).toEqual([
    "apps/a/modules/cart/cart.ts",
    "apps/a/modules/cart/module.ts",
    "apps/a/topology.ts",
  ]);
  expect(paths(seen.get("modules/x/x.ts"))).toEqual(["modules/x/x.ts"]);
});

test("for any set of module files, each rule input's project holds exactly the project's code files", () => {
  fc.assert(
    fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 6 }), (names) => {
      seen.clear();
      const files = names.map((n) => ({ path: `modules/m/${n}.ts`, source: `export const ${n}_ = 1;\n` }));
      check([...files, { path: "notes.json", source: "{}" }], { types: false });
      const expected = files.map((f) => f.path).sort();
      for (const f of files) expect(paths(seen.get(f.path))).toEqual(expected);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
