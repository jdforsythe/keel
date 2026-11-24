import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Typed } from "../src/internal/Typed.ts";
import { typeCache } from "../src/internal/typeCache.ts";
import { check } from "../src/index.ts";

let root = "";
let dir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "keel-type-cache-"));
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "package.json"), "{}");
  dir = join(root, "node_modules", ".cache", "keel");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const result: Typed = {
  diagnostics: [{ kind: "diag", code: "E1751", path: "a.ts", line: 1, col: 2, message: "m", see: "k.check" }],
  dates: new Map([["a.ts", new Set([3, 7])]]),
};

it("an entry saved by one process is the result the next one loads, dates included", () => {
  const dep = join(root, "dep.d.ts");
  writeFileSync(dep, "export {}\n");
  utimesSync(dep, 1_000, 1_000);
  typeCache(dir, "k", "5.9", root).save(result, [[dep, 1_000_000]]);
  const loaded = typeCache(dir, "k", "5.9", root).load();
  expect(loaded?.diagnostics).toEqual(result.diagnostics);
  expect(loaded?.dates).toEqual(result.dates);
  utimesSync(dep, 2_000, 2_000);
  expect(typeCache(dir, "k", "5.9", root).load()).toBeUndefined();
});

it("another key, another TypeScript version or a new package under node_modules misses", () => {
  typeCache(dir, "k", "5.9", root).save(result, []);
  expect(typeCache(dir, "other", "5.9", root).load()).toBeUndefined();
  expect(typeCache(dir, "k", "6.0", root).load()).toBeUndefined();
  expect(typeCache(dir, "k", "5.9", root).load()).toBeDefined();
  mkdirSync(join(root, "node_modules", "dep"));
  utimesSync(join(root, "node_modules"), 5, 5);
  expect(typeCache(dir, "k", "5.9", root).load()).toBeUndefined();
});

it("a file that is not an entry is a miss, and the folder keeps at most 32 entries", () => {
  typeCache(dir, "k", "5.9", root).save(result, []);
  const [name] = readdirSync(dir);
  writeFileSync(join(dir, name ?? ""), '{"reads":[["x"]],"diagnostics":[],"dates":[]}');
  expect(typeCache(dir, "k", "5.9", root).load()).toBeUndefined();
  writeFileSync(join(dir, name ?? ""), "not json");
  expect(typeCache(dir, "k", "5.9", root).load()).toBeUndefined();
  for (let i = 0; i < 40; i++) typeCache(dir, `k${i}`, "5.9", root).save(result, []);
  expect(readdirSync(dir).length).toBeLessThanOrEqual(32);
});

it("check with a typeCache writes an entry and gives the same diagnostics as without", () => {
  const files = [{ path: "a.ts", source: "export const a: string = 1;\n" }];
  const cached = check(files, { root, typeCache: dir }).diagnostics;
  expect(readdirSync(dir)).toHaveLength(1);
  const plain = check(files, { root }).diagnostics;
  expect(cached).toEqual(plain);
  expect(plain.map((d) => d.code)).toContain("E1751");
});
