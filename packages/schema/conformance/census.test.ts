// Spec: k.realm, clause "After `Reflect.get(globalThis, Symbol.for('keel.census')).delete('@keel/schema')`, a second copy of `@keel/schema` loads without E1765, and a schema it made is not `isSchema` under the first."
// Seed 1337 (no generated input: one copy of the package folder, loaded after the census entry is deleted).
// The census is the map at `globalThis[Symbol.for('keel.census')]`, name to URL; a conformance file may name it.
import { cpSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isSchema, s } from "@keel/schema";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";

const FIRST = fileURLToPath(new URL("../", import.meta.url));
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const censusOf = (): Map<string, string> => {
  const c: unknown = Reflect.get(globalThis, Symbol.for("keel.census"));
  if (!(c instanceof Map)) throw new Error("no census");
  return c;
};

describe("k.realm One copy: the census forges nothing", () => {
  it(
    "after the census entry for `@keel/schema` is deleted, a second copy loads without E1765, and a schema it made is not `isSchema` under the first",
    async () => {
      const census = censusOf();
      const entry = census.get("@keel/schema");
      expect(entry).toBeTypeOf("string");
      census.delete("@keel/schema");
      try {
        const dir = tempDir("keel-census-");
        dirs.push(dir);
        const copy = join(realpathSync(dir), "schema");
        cpSync(FIRST, copy, {
          recursive: true,
          filter: (p) =>
            !/(^|\/)(node_modules|dist|reports|conformance|test|docs|\.stryker-tmp)(\/|$)/.test(p.slice(FIRST.length)),
        });
        symlinkSync(join(FIRST, "node_modules"), join(copy, "node_modules"));
        // The copy's own tsconfig extends a path the temp folder lacks; a minimal one lets the test runner transform it.
        writeFileSync(join(copy, "tsconfig.json"), "{}\n");
        const second: unknown = await import(/* @vite-ignore */ pathToFileURL(join(copy, "src", "index.ts")).href);
        const make = typeof second === "object" && second !== null ? Reflect.get(second, "s") : undefined;
        const theirs: unknown = make?.string();
        expect(theirs).toBeDefined();
        expect(isSchema(theirs)).toBe(false);
        expect(isSchema(s.string())).toBe(true);
      } finally {
        if (entry !== undefined) census.set("@keel/schema", entry);
      }
    },
    testTime(120_000),
  );

  it("the census holds names and URLs only", () => {
    for (const [name, url] of censusOf()) {
      expect(name).toBeTypeOf("string");
      expect(url).toBeTypeOf("string");
    }
  });
});
