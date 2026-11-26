import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { check } from "../src/index.ts";
import { CACHE_FORMAT } from "../src/internal/CACHE_FORMAT.ts";
import type { TypeEntry } from "../src/internal/TypeEntry.ts";
import { typeCache } from "../src/internal/typeCache.ts";

let root = "";
let dir = "";
beforeEach(() => {
  root = tempDir("keel-type-cache-");
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "package.json"), "{}");
  dir = join(root, "node_modules", ".cache", "keel");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const entry: TypeEntry = {
  key: "k",
  probes: [
    ["r", "/x/a.d.ts", "ab"],
    ["f", "/x/b.ts", "0"],
  ],
  items: [
    { kind: "diag", code: "E1751", path: "a.ts", line: 1, col: 2, message: "m", see: "k.check" },
    {
      kind: "format",
      path: "a.ts",
      formatAt: 3,
      textAt: 9,
      names: ["iso"],
      text: "x",
      owner: "@keel/std-x",
      pkg: null,
    },
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
    good.replace(`"format":${CACHE_FORMAT}`, `"format":${CACHE_FORMAT - 1}`),
    good.replace('"key":"k"', '"key":3'),
    good.replace('["f","/x/b.ts","0"]', '["q","/x/b.ts","0"]'),
    good.replace('"line":1', '"line":"1"'),
    good.replace('"text":"x"', '"text":3'),
  ]) {
    writeFileSync(file, bad);
    expect(typeCache(dir, "k").load()).toBeUndefined();
  }
});

it("a folder keeps 4 entries, the one just written among them, and no other writer's temporary file", () => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "t.json.999999.tmp"), "{");
  for (let i = 0; i < 6; i++) typeCache(dir, `k${i}`).save(entry);
  expect(readdirSync(dir)).toHaveLength(4);
  expect(readdirSync(dir).some((n) => n.endsWith(".tmp"))).toBe(false);
  expect(typeCache(dir, "k5").load()).toBeDefined();
});

it("an entry above 16 MiB is not written", () => {
  const big = "m".repeat(1024 * 1024);
  const items = Array.from({ length: 17 }, (_, i) => ({
    ...entry.items[0],
    kind: "diag" as const,
    code: "E1751",
    path: "a.ts",
    line: i,
    col: 1,
    message: big,
  }));
  typeCache(dir, "big").save({ ...entry, items });
  expect(typeCache(dir, "big").load()).toBeUndefined();
  typeCache(dir, "small").save(entry);
  expect(typeCache(dir, "small").load()).toEqual(entry);
});

/** `check()` from a module instance of its own (no memo): what the next process gives. */
async function fresh(files: { path: string; source: string }[], cached = true) {
  vi.resetModules();
  const m = await import("../src/index.ts");
  return m.check(files, cached ? { root, typeCache: dir } : { root }).diagnostics;
}

it("an entry holding another key (a copied or renamed file) is a miss for check, which rewrites it", async () => {
  const files = [{ path: "a.ts", source: "export const a: string = 1;\n" }];
  const other = [{ path: "a.ts", source: "export const a: number = 1;\n" }];
  check(files, { root, typeCache: dir });
  check(other, { root, typeCache: dir });
  const [x, y] = readdirSync(dir).map((n) => join(dir, n));
  const tx = readFileSync(x ?? "", "utf8");
  const ty = readFileSync(y ?? "", "utf8");
  writeFileSync(x ?? "", ty);
  writeFileSync(y ?? "", tx);
  expect(await fresh(files)).toEqual(await fresh(files, false));
  expect(await fresh(other)).toEqual(await fresh(other, false));
  expect((await fresh(files)).map((d) => d.code)).toEqual(["E1751"]);
  expect(readFileSync(x ?? "", "utf8")).toBe(tx);
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
