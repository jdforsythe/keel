// Spec: k.deploy, Conformance "With module `a` listing `@keel/std-postgres` in `deps`, served by `node` deployable `x` beside `y`, `deploy/compose.yaml` passes `KEEL_POSTGRES_URL` to `x` as a required value from the environment and to `y` not at all, and holds no URL."
// Spec: k.server-deps, Environment "A `node` deployable needs the `env` names of each module its `modules` list and of each library those modules' manifests list, transitively. `deploy/compose.yaml` (its layout: k.deploy Deploy files) passes each name a deployable needs from the environment, required (`NAME: ${NAME:?}`), once in the deployable's service, after the k.deploy keys and sorted, and no generated file holds a value."
// Seed: 1337. Assumes (as dockerfile-storage.test.ts): `deployDrift(tree, true)` yields the generated files as `want`; the tree holds `topology.ts`, `package.json` and `modules/<id>/module.ts` manifests.
// The clause stays in k.deploy. The generator knows no package by name: the name comes from the `env` of the library's manifest, so the tree holds the std-postgres manifest as source text at `node_modules/@keel/std-postgres/module.ts` (no import: kernel packages never import std packages) and its `package.json` marking it a library.
// Assumes "required, from the environment" is Compose's `${KEEL_POSTGRES_URL:?...}` form, as the RFC writes it (`${KEEL_POSTGRES_URL:?}`); a service's block is the lines from its `  <name>:` key to the next two-space key.
import { deployDrift } from "@keel/scaffold";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const manifest = (id: string, deps: string[]): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: [] } })\n`;

const libraryFiles: [string, string][] = [
  [
    "node_modules/@keel/std-postgres/package.json",
    `${JSON.stringify({ name: "@keel/std-postgres", version: "1.0.0", type: "module", keel: "library" })}\n`,
  ],
  [
    "node_modules/@keel/std-postgres/module.ts",
    "import { module } from '@keel/compiler'\nexport default module({ id: 'postgres', deps: [], capabilities: [], public: { exports: [] }, env: ['KEEL_POSTGRES_URL'] })\n",
  ],
];

function compose(x: string, y: string): string {
  const tree = new Map<string, string>([
    ["package.json", `${JSON.stringify({ name: "fx", private: true })}\n`],
    [
      "topology.ts",
      `import { topology } from '@keel/server'\nexport default topology({\n  ${x}: { modules: ['a'], adapter: 'node' },\n  ${y}: { modules: ['b'], adapter: 'node' },\n})\n`,
    ],
    ["modules/a/module.ts", manifest("a", ["@keel/std-postgres"])],
    ["modules/b/module.ts", manifest("b", [])],
    ...libraryFiles,
  ]);
  for (const d of deployDrift(tree, true)) if (d.path === "deploy/compose.yaml" && d.want !== null) return d.want;
  throw new Error("deploy/compose.yaml not generated");
}

function block(text: string, name: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => l === `  ${name}:`);
  if (at < 0) throw new Error(`no service ${name}`);
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    if (/^ {2}\S/.test(lines[i] ?? "") || /^\S/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(at, end).join("\n");
}

const names = fc
  .uniqueArray(
    fc.stringMatching(/^[a-z]{3,8}$/).map((n) => `zq${n}`),
    { minLength: 2, maxLength: 2 },
  )
  .map(([x, y]) => ({ x: x ?? "zqx", y: y ?? "zqy" }));

test("With module `a` listing `@keel/std-postgres` in `deps`, served by `node` deployable `x` beside `y`, `deploy/compose.yaml` passes `KEEL_POSTGRES_URL` to `x` as a required value from the environment and to `y` not at all, and holds no URL.", () => {
  fc.assert(
    fc.property(names, ({ x, y }) => {
      const text = compose(x, y);
      expect(block(text, x)).toMatch(/KEEL_POSTGRES_URL:\s*["']?\$\{KEEL_POSTGRES_URL:\?[^}]*\}/);
      expect(block(text, y)).not.toContain("KEEL_POSTGRES_URL");
      expect(text).not.toMatch(/postgres(ql)?:\/\//);
      expect(text).not.toMatch(/pglite:/);
    }),
    { seed: SEED, numRuns: 15 },
  );
});
