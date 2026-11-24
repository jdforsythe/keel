// Spec: k.check-cache, clause "In one process whose caller has imported `@keel/std-db/tools`, with `root` a folder whose `node_modules/@keel/std-db` links to the package, `check(files, { root, types: false })` over `modules/orders/module.ts` holding `import { module } from '@keel/compiler'` and `export default module({ id: 'orders', deps: [], capabilities: [], public: { exports: [] } })` and `modules/orders/x.ts` holding `import * as db from '@keel/std-db'` and `export const y = db` reports one E2151 at `modules/orders/x.ts` line 1; after `importDeps(root, files)` and `check(files, { root, types: false })` with that manifest's `deps` set to `['@keel/std-db']`, a `check()` with `deps` set back to `[]` again reports one E2151 at `modules/orders/x.ts` line 1."
// Seed 1337 (the file name of x.ts is generated). The static import below is the caller registering the package's rules before any importDeps call.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import { importDeps } from "@keel/compiler/std/importDeps";
import "@keel/std-db/tools";
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";

const SEED = 1337;
const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A scratch root whose `node_modules/@keel/std-db` links to the package. */
function scratch(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-caller-rule-")));
  dirs.push(root);
  mkdirSync(join(root, "node_modules/@keel"), { recursive: true });
  symlinkSync(pkg, join(root, "node_modules/@keel/std-db"));
  return root;
}
const files = (deps: string[], name: string) => [
  {
    path: "modules/orders/module.ts",
    source: `import { module } from '@keel/compiler'\nexport default module({ id: 'orders', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] } })\n`,
  },
  { path: `modules/orders/${name}.ts`, source: "import * as db from '@keel/std-db'\nexport const y = db\n" },
];
const e2151 = (root: string, deps: string[], name: string) =>
  check(files(deps, name), { root, types: false }).diagnostics.filter((d) => d.code === "E2151");
const word = fc.stringMatching(/^[a-z]{1,8}$/);

test("a rule the caller registered runs with `deps: []`, and still runs after an `importDeps` call that listed its package", async () => {
  const root = scratch();
  const first = e2151(root, [], "x");
  expect(first).toHaveLength(1);
  expect(first[0]?.path).toBe("modules/orders/x.ts");
  expect(first[0]?.line).toBe(1);
  await importDeps(root, files(["@keel/std-db"], "x"));
  e2151(root, ["@keel/std-db"], "x");
  const again = e2151(root, [], "x");
  expect(again).toHaveLength(1);
  expect(again[0]?.path).toBe("modules/orders/x.ts");
  expect(again[0]?.line).toBe(1);
});

test("for any file name, the caller's E2151 runs with `deps: []` before and after `importDeps` listed the package", async () => {
  const root = scratch();
  await fc.assert(
    fc.asyncProperty(word, async (name) => {
      await importDeps(root, files(["@keel/std-db"], name));
      expect(e2151(root, [], name).map((d) => [d.path, d.line])).toEqual([[`modules/orders/${name}.ts`, 1]]);
    }),
    { seed: SEED, numRuns: 10 },
  );
});
