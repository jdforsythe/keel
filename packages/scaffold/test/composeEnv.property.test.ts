// Seed 1337. k.server-deps Environment: `deploy/compose.yaml` passes each `env` name a `node` deployable needs, from its
// modules' manifests and the libraries they list (transitively), required, after the k.deploy keys and sorted.
import { deployDrift, deployFiles } from "@keel/scaffold";
import fc from "fast-check";
import { expect, test } from "vitest";

const NAME = fc.stringMatching(/^[A-Z][A-Z0-9_]{0,6}$/).filter((n) => !n.startsWith("KEEL_") && n !== "PORT");
const manifest = (id: string, deps: readonly string[], env: readonly string[]): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: [] }, env: ${JSON.stringify(env)} })\n`;

/** The `NAME: value` lines of service `name`. */
function block(text: string, name: string): string[] {
  const lines = text.split("\n");
  const at = lines.indexOf(`  ${name}:`);
  const end = lines.findIndex((l, i) => i > at && /^ {0,2}\S/.test(l));
  return lines.slice(at + 1, end < 0 ? lines.length : end).filter((l) => /^ {6}[A-Z]/.test(l));
}

test("each node deployable gets its env names, required, once, after the deploy keys and sorted; the rest none", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          env: fc.array(NAME, { maxLength: 3 }),
          storage: fc.constantFrom("file" as const, "sqlite" as const, "postgres" as const),
        }),
        {
          minLength: 1,
          maxLength: 4,
        },
      ),
      (specs) => {
        const topology = Object.fromEntries(
          specs.map((d, i) => [
            `d${i}`,
            { adapter: "node" as const, storage: d.storage, modules: [`m${i}`], env: d.env },
          ]),
        );
        const text = deployFiles(topology, { ci: false }).get("deploy/compose.yaml") ?? "";
        for (const [i, d] of specs.entries()) {
          const lines = block(text, `d${i}`);
          const own = lines.filter((l) => !/^ {6}(?:KEEL_|PORT)/.test(l));
          const want = [...new Set(d.env)].sort().map((n) => `      ${n}: \${${n}:?}`);
          expect(own).toEqual(want);
          expect(lines.slice(lines.length - own.length)).toEqual(own);
        }
      },
    ),
    { seed: 1337, numRuns: 50 },
  );
});

test("a deployable needs its modules' env and that of each library they list, transitively; not that of a module it does not serve", () => {
  const tree = new Map<string, string>([
    ["package.json", `${JSON.stringify({ name: "fx", private: true })}\n`],
    [
      "topology.ts",
      "import { topology } from '@keel/server'\nexport default topology({\n  x: { modules: ['a'], adapter: 'node' },\n  y: { modules: ['b'], adapter: 'node' },\n})\n",
    ],
    ["modules/a/module.ts", manifest("a", ["b", "@acme/store"], ["ZED"])],
    ["modules/b/module.ts", manifest("b", [], ["BEE"])],
    ["node_modules/@acme/store/module.ts", manifest("store", ["@acme/cache"], ["STORE"])],
    ["node_modules/@acme/cache/module.ts", manifest("cache", [], ["CACHE", "STORE"])],
  ]);
  const text = deployDrift(tree, true).find((d) => d.path === "deploy/compose.yaml")?.want ?? "";
  const own = (n: string): string[] => block(text, n).filter((l) => !/^ {6}(?:KEEL_|PORT)/.test(l));
  expect(own("x")).toEqual(["      CACHE: ${CACHE:?}", "      STORE: ${STORE:?}", "      ZED: ${ZED:?}"]);
  expect(own("y")).toEqual(["      BEE: ${BEE:?}"]);
});
