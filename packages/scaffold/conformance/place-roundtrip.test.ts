// Spec: k.scaffold, clause "`place b --to y --adapter node` then `place b --to x` restores a byte-identical tree; neither writes outside `topology.ts`, `deploy/`, CI workflows."
// Seed 1337 (fast-check). Module `b` is `orders`/`catalog`, `x` is the project's first deployable, `y` a generated name.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { lowerName } from "./fixtures.ts";
import { SEED, base, cleanup, deployables, differing, keel, materialize, outside, readTree } from "./place-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

test("`place b --to y --adapter node` then `place b --to x` restores a byte-identical tree; neither writes outside `topology.ts`, `deploy/` and CI workflows.", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("orders", "catalog"),
      lowerName,
      fc.constantFrom(undefined, "client", "node"),
      (b, y, adapter) => {
        const dir = materialize(base(adapter));
        dirs.push(dir);
        const start = readTree(dir);
        const x = deployables(start.get("topology.ts") ?? "")[0] ?? "";
        expect(x).not.toBe("");
        const there = keel(dir, ["codemod", "place", b, "--to", y, "--adapter", "node"]);
        expect(there.status, JSON.stringify(there.records)).toBe(0);
        const mid = readTree(dir);
        expect(differing(start, mid).filter(outside)).toEqual([]);
        const back = keel(dir, ["codemod", "place", b, "--to", x]);
        expect(back.status, JSON.stringify(back.records)).toBe(0);
        const end = readTree(dir);
        expect(differing(mid, end).filter(outside)).toEqual([]);
        expect(end).toEqual(start);
      },
    ),
    { seed: SEED, numRuns: 4 },
  );
}, 240000);

test("place: `--dry-run` writes nothing", () => {
  const dir = materialize(base());
  dirs.push(dir);
  const start = readTree(dir);
  keel(dir, ["codemod", "place", "orders", "--to", "jobs", "--adapter", "node", "--dry-run"]);
  expect(readTree(dir)).toEqual(start);
  expect(differing(start, readTree(dir))).toEqual([]);
}, 120000);
