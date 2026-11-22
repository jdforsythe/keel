// Spec: k.scaffold, clause "`keel scaffold project <name>`, with or without `--workspace`, writes only under `<name>/`."
// fast-check seed 1337 (few runs: each run spawns the real `keel` binary). The helper's node_modules symlink tree is the only other top-level entry.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cleanup, keel, materialize, readTree } from "./keel-cli.ts";

const names = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);
const top = (dir: string): string[] =>
  readdirSync(dir)
    .filter((n) => n !== "node_modules")
    .sort();

for (const workspace of [false, true]) {
  const flags = workspace ? ["--workspace"] : [];
  const label = workspace ? "with --workspace" : "without --workspace";
  describe(`keel scaffold project <name> ${label}`, () => {
    it("creates every file under <name>/ and none beside it", () => {
      fc.assert(
        fc.property(names, (name) => {
          const dir = materialize(new Map());
          try {
            const r = keel(dir, ["scaffold", "project", name, ...flags]);
            expect(r.status, JSON.stringify(r.records)).toBe(0);
            const files = ["package.json", "topology.ts", "modules/app/module.ts", ...(workspace ? ["vitest.config.ts"] : [])];
            for (const f of files) expect(existsSync(join(dir, name, f)), f).toBe(true);
            // k.scaffold: no `index.html`, with or without `--workspace` (Keel writes every document).
            expect(existsSync(join(dir, name, "index.html")), "index.html").toBe(false);
            expect(top(dir)).toEqual([name]);
          } finally {
            cleanup(dir);
          }
        }),
        { seed: 1337, numRuns: 3 },
      );
    }, 120000);

    it("running it twice reports E1351 the second time and writes nothing new", () => {
      fc.assert(
        fc.property(names, (name) => {
          const dir = materialize(new Map());
          try {
            const first = keel(dir, ["scaffold", "project", name, ...flags]);
            expect(first.status, JSON.stringify(first.records)).toBe(0);
            const before = readTree(dir);
            const second = keel(dir, ["scaffold", "project", name, ...flags]);
            expect(second.status).not.toBe(0);
            expect(JSON.stringify(second.records)).toContain("E1351");
            expect(readTree(dir)).toEqual(before);
            expect(top(dir)).toEqual([name]);
          } finally {
            cleanup(dir);
          }
        }),
        { seed: 1337, numRuns: 3 },
      );
    }, 120000);
  });
}
