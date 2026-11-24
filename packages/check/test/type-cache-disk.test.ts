import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { TypeEntry } from "../src/internal/TypeEntry.ts";
import { typeCache } from "../src/internal/typeCache.ts";

let root = "";
let dir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "keel-type-cache-"));
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "package.json"), "{}");
  dir = join(root, "node_modules", ".cache", "keel");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const entry: TypeEntry = {
  probes: [
    ["r", "/x/a.d.ts", "ab"],
    ["f", "/x/b.ts", "0"],
  ],
  items: [
    { kind: "diag", code: "E1751", path: "a.ts", line: 1, col: 2, message: "m", see: "k.check" },
    { kind: "format", path: "a.ts", formatAt: 3, textAt: 9, names: ["iso"], text: "x" },
  ],
  dates: new Map([["a.ts", new Set([3, 7])]]),
};

it("an entry saved by one process is the entry the next one loads: probes, findings in order, dates", () => {
  typeCache(dir, "k").save(entry);
  expect(typeCache(dir, "k").load()).toEqual(entry);
  expect(typeCache(dir, "other").load()).toBeUndefined();
});

it("an entry that cannot be read, does not parse or lacks the entry shape is a miss", () => {
  typeCache(dir, "k").save(entry);
  const [name] = readdirSync(dir);
  const file = join(dir, name ?? "");
  const good = readFileSync(file, "utf8");
  for (const bad of [
    good.slice(0, 40),
    "{}",
    good.replace('"format":1', '"format":2'),
    good.replace('["f","/x/b.ts","0"]', '["q","/x/b.ts","0"]'),
    good.replace('"line":1', '"line":"1"'),
    good.replace('"text":"x"', '"text":3'),
  ]) {
    writeFileSync(file, bad);
    expect(typeCache(dir, "k").load()).toBeUndefined();
  }
});

it("a folder keeps 32 entries, the one just written among them", () => {
  for (let i = 0; i < 40; i++) typeCache(dir, `k${i}`).save(entry);
  expect(readdirSync(dir)).toHaveLength(32);
  expect(typeCache(dir, "k39").load()).toBeDefined();
});

it("check with a typeCache writes one entry of paths, hashes and diagnostics, and reports what a check without it does", () => {
  mkdirSync(join(root, "node_modules", "dep"));
  writeFileSync(join(root, "node_modules", "dep", "package.json"), '{"name":"dep","types":"index.d.ts"}');
  writeFileSync(join(root, "node_modules", "dep", "index.d.ts"), "export declare const secretName: number;\n");
  const files = [{ path: "a.ts", source: 'import { secretName } from "dep";\nexport const a: string = secretName;\n' }];
  const cached = check(files, { root, typeCache: dir }).diagnostics;
  const [name] = readdirSync(dir);
  expect(readdirSync(dir)).toHaveLength(1);
  const stored = readFileSync(join(dir, name ?? ""), "utf8");
  expect(stored).not.toContain("export declare const");
  expect(stored).toContain(join(root, "node_modules", "dep", "package.json"));
  expect(cached).toEqual(check(files, { root }).diagnostics);
  expect(cached.map((d) => d.code)).toEqual(["E1751"]);
});
