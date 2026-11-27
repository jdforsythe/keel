// Spec: k.realm, clause "With `@keel/schema` loaded from its package folder, importing a copy of that folder made under another path throws a value whose message starts `E1765 two copies of @keel/schema in one realm: `, then the first copy's file URL, ` and `, and the second's; `isSchema` and `isDefect` of the first copy answer as before; the same holds of `@keel/store` and `@keel/router`."
// Seed 1337 (no generated input: one copy of the package folder). The copy keeps the package's `node_modules` by a link, so its imports resolve.
// Assumption: the message names each copy by a file URL inside its folder, so the case asserts the first folder's URL and the second's, in that order.
import { cpSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tempDir } from "@keel/tooling/test-tmp";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { isStore, isTransaction } from "@keel/store";
import { makeCart } from "./fixtures.ts";

const FIRST = fileURLToPath(new URL("../", import.meta.url));
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** Copy this package's folder (sources, no `node_modules`, no build) under another path and import its entry by file URL. */
async function importCopy(): Promise<unknown> {
  const dir = tempDir("keel-copy-");
  made.push(dir);
  const copy = join(dir, "store");
  cpSync(FIRST, copy, {
    recursive: true,
    filter: (p) =>
      !/(^|\/)(node_modules|dist|reports|conformance|test|docs|\.stryker-tmp)(\/|$)/.test(p.slice(FIRST.length)),
  });
  symlinkSync(join(FIRST, "node_modules"), join(copy, "node_modules"));
  return import(/* @vite-ignore */ pathToFileURL(join(copy, "src", "index.ts")).href).then(
    () => undefined,
    (e: unknown) => ({ thrown: e, copy }),
  );
}

describe("k.realm One copy: @keel/store", () => {
  it(
    "importing a copy of the package folder made under another path throws a value whose message starts `E1765 two copies of @keel/store in one realm: `, then the first copy's file URL, ` and `, and the second's",
    async () => {
      const r = await importCopy();
      expect(r).not.toBeUndefined();
      const thrown = typeof r === "object" && r !== null ? Reflect.get(r, "thrown") : undefined;
      const copy = typeof r === "object" && r !== null ? String(Reflect.get(r, "copy")) : "";
      const message = thrown instanceof Error ? thrown.message : String(thrown);
      expect(message.startsWith("E1765 two copies of @keel/store in one realm: ")).toBe(true);
      const rest = message.slice("E1765 two copies of @keel/store in one realm: ".length);
      const [first, second] = rest.split(" and ");
      expect(first?.startsWith(pathToFileURL(FIRST).href.replace(/\/$/, ""))).toBe(true);
      expect(second?.startsWith(pathToFileURL(copy).href)).toBe(true);
      expect(first?.includes("?") || first?.includes("#")).toBe(false);
    },
    testTime(120_000),
  );

  it(
    "`isStore` and `isTransaction` of the first copy answer as before",
    async () => {
      await importCopy();
      expect(isStore(makeCart().cart)).toBe(true);
      expect(isStore({})).toBe(false);
      expect(isTransaction({})).toBe(false);
    },
    testTime(120_000),
  );
});
