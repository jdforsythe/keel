// k.scaffold, Codemods "`place` moves a module to a deployable in `topology.ts` (a new deployable needs `--adapter`; an emptied one is removed) and regenerates the deploy files; nothing else changes."
// Seed 1337 (fast-check). Real `keel` binary over a temp project; each run spawns it, so numRuns is small.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { lowerName } from "./fixtures.ts";
import { SEED, base, cleanup, deployables, differing, keel, materialize, outside, readTree } from "./place-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const setup = (adapter?: string): string => {
  const dir = materialize(base(adapter));
  dirs.push(dir);
  return dir;
};
const topologyOf = (dir: string): string => readTree(dir).get("topology.ts") ?? "";

describe("codemod place", () => {
  test(
    "`place` moves a module to a deployable in `topology.ts` (a new deployable needs `--adapter`; an emptied one is removed) and regenerates the deploy files; nothing else changes.",
    () => {
      fc.assert(
        fc.property(fc.constantFrom("orders", "catalog"), lowerName, (mod, to) => {
          const dir = setup();
          const before = readTree(dir);
          const r = keel(dir, ["codemod", "place", mod, "--to", to, "--adapter", "node"]);
          expect(r.status, JSON.stringify(r.records)).toBe(0);
          const after = readTree(dir);
          expect(deployables(topologyOf(dir))).toContain(to);
          expect(new RegExp(`${to}:\\s*\\{[^}]*modules:\\s*\\[[^\\]]*['"]${mod}['"]`).test(topologyOf(dir))).toBe(true);
          expect(after.has(`deploy/${to}/Dockerfile`)).toBe(true);
          expect(differing(before, after).filter(outside)).toEqual([]);
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    fixedTime(120000),
  );

  test(
    "place: a new deployable needs `--adapter` (k.cli E1052) and nothing is written",
    () => {
      const dir = setup();
      const before = readTree(dir);
      const r = keel(dir, ["codemod", "place", "orders", "--to", "jobs"]);
      expect(r.status).not.toBe(0);
      expect(JSON.stringify(r.records)).toContain("E1052");
      expect(readTree(dir)).toEqual(before);
    },
    fixedTime(120000),
  );

  test(
    "place: moving the last module of a deployable removes the deployable and its deploy files",
    () => {
      const dir = setup();
      const first = deployables(topologyOf(dir))[0] ?? "";
      expect(keel(dir, ["codemod", "place", "orders", "--to", "jobs", "--adapter", "node"]).status).toBe(0);
      expect(keel(dir, ["codemod", "place", "orders", "--to", first]).status).toBe(0);
      expect(deployables(topologyOf(dir))).not.toContain("jobs");
      expect(readTree(dir).has("deploy/jobs/Dockerfile")).toBe(false);
    },
    fixedTime(120000),
  );

  test(
    "place: an unknown module, or a project without `topology.ts`, reports k.cli E1052 and writes nothing",
    () => {
      const dir = setup();
      const before = readTree(dir);
      const unknown = keel(dir, ["codemod", "place", "nope", "--to", "jobs", "--adapter", "node"]);
      expect(JSON.stringify(unknown.records)).toContain("E1052");
      expect(readTree(dir)).toEqual(before);
      const bare = materialize(new Map([["package.json", "{}\n"]]));
      dirs.push(bare);
      expect(
        JSON.stringify(keel(bare, ["codemod", "place", "orders", "--to", "jobs", "--adapter", "node"]).records),
      ).toContain("E1052");
    },
    fixedTime(120000),
  );
});
