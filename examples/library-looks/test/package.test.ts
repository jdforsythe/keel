import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const dir = join(import.meta.dirname, "..");
const json = (file: string): unknown => JSON.parse(readFileSync(join(dir, file), "utf8"));

/** The value at `key` of `value` when it is an object, else undefined. */
const at = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Object.entries(value).find(([k]) => k === key)?.[1] : undefined;

it("ships its look: a ./tokens entry whose first condition is keel, and the ledger lists its four components", () => {
  const entry = at(at(json("package.json"), "exports"), "./tokens");
  expect(typeof entry === "object" && entry !== null ? Object.entries(entry)[0] : undefined).toEqual([
    "keel",
    "./src/acmeTokens.ts",
  ]);
  const exports = at(json(".keel/ledger.json"), "exports");
  const names = Array.isArray(exports) ? exports.map((e: unknown) => at(e, "name")) : [];
  expect(names).toEqual(expect.arrayContaining(["Badge", "Card", "Switch", "Toggle"]));
});
