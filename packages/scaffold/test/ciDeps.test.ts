// The CI workflow's path filter (k.topology Deploy files): a deployable's job runs when its modules change, and a
// module it deps on, directly or through another module, is built into it, so a change there runs the job too.
// Seed 1337
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deployDrift } from "../src/index.ts";

const pathsOf = (ci: string, job: string): string => ci.split("\n").find((l) => l.includes(`echo "${job}=true"`)) ?? "";
const manifest = (id: string, deps: readonly string[]) =>
  `import { module } from "@keel/compiler"\nexport default module({ id: "${id}", deps: [${deps.map((d) => `"${d}"`).join(", ")}] })\n`;
const top = [
  'import { topology } from "@keel/server";',
  "export default topology({",
  '  api: { modules: ["a"], adapter: "node" },',
  '  web: { modules: ["w"], adapter: "client" },',
  "});",
  "",
].join("\n");

describe("CI path filter", () => {
  it("a deployable's job runs on the modules its modules dep on, transitively, and on no other", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (depth) => {
        const chain = Array.from({ length: depth }, (_, i) => `m${i}`);
        const files = new Map([
          ["topology.ts", top],
          [".github/workflows/ci.yml", ""],
          ["modules/a/module.ts", manifest("a", [chain[0] ?? "", "@keel/std-jobs"])],
          ["modules/w/module.ts", manifest("w", [])],
          ...chain.map((m, i): [string, string] => [`modules/${m}/module.ts`, manifest(m, chain.slice(i + 1, i + 2))]),
        ]);
        const ci = deployDrift(files, true).find((d) => d.path === ".github/workflows/ci.yml")?.want ?? "";
        for (const m of chain) expect(pathsOf(ci, "api")).toContain(`modules/${m}/`);
        for (const m of chain) expect(pathsOf(ci, "web")).not.toContain(`modules/${m}/`);
      }),
      { seed: 1337, numRuns: 8 },
    );
  });
});
