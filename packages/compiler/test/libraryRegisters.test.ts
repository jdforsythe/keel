// k.server-deps Registration through a library: an export counts when its defining file in the library, followed through
// the entry's re-exports, imports `@keel/ctx` and names `register`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { afterAll, expect, it } from "vitest";
import { libraryRegisters } from "../src/internal/libraryRegisters.ts";
import type { Library } from "../src/types/Library.ts";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-libreg-"));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

/** A library `@acme/store` whose entry reaches `store` (registering) and `plain` (not) by the re-export `hop` gives. */
function library(hop: "named" | "star" | "local" | "renamed"): Library {
  const dir = fs.mkdtempSync(path.join(root, "lib-"));
  const write = (rel: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  write(
    "package.json",
    JSON.stringify({
      name: "@acme/store",
      keel: "library",
      exports: { ".": { keel: "./src/index.ts", default: "./i.js" } },
    }),
  );
  write(
    "src/store.ts",
    "import { register } from '@keel/ctx'\nconst impl = () => ({})\nexport function inner() {\n  return register('store.main', { real: impl, shell: impl, sim: impl })\n}\n",
  );
  write("src/plain.ts", "export const plain = () => 1\n");
  const index = {
    named: "export { inner as store } from './store.ts'\nexport { plain } from './plain.ts'\n",
    star: "export * from './plain.ts'\nexport { inner as store } from './store.ts'\n",
    local: "import { inner } from './store.ts'\nimport { plain } from './plain.ts'\nexport { inner as store, plain }\n",
    renamed: "export { inner as store } from './store'\nexport { plain } from './plain'\n",
  }[hop];
  write("src/index.ts", index);
  return { name: "@acme/store", dir, kind: "library", id: "store", manifest: undefined, files: [] };
}

it("an export defined in a registering file counts through every re-export form; one defined elsewhere does not", () => {
  fc.assert(
    fc.property(fc.constantFrom("named" as const, "star" as const, "local" as const, "renamed" as const), (hop) => {
      const registers = libraryRegisters([library(hop)]);
      expect(registers("@acme/store", "store")).toBe(true);
      expect(registers("@acme/store", "plain")).toBe(false);
      expect(registers("@acme/store", "*")).toBe(true);
      expect(registers("@acme/other", "store")).toBe(false);
      expect(registers("@acme/store/missing", "store")).toBe(false);
    }),
    { seed: 1337, numRuns: 8 },
  );
});
