// Seed 1337 (no property test and no generated inputs: the clause is about fixed project roots)
// Spec: k.check, clause "A file reading `process.env` and importing `node:path` checks clean in a project whose root resolves `@types/node` and reports E1751 in one whose root does not." (rfc:0076)
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "@keel/check";
import { afterAll, beforeAll, expect, test } from "vitest";
import { one } from "./support.ts";

const WITH_NODE = join(import.meta.dirname, "..");
const NODE_FILE = `import { join } from "node:path";\nexport const p: string = join(process.env.HOME ?? "", "x");\n`;
const PLAIN_FILE = "export const a: number = 1;\n";

let emptyRoot = "";
beforeAll(() => {
  emptyRoot = mkdtempSync(join(realpathSync(tmpdir()), "keel-no-node-"));
});
afterAll(() => {
  if (emptyRoot !== "") rmSync(emptyRoot, { recursive: true, force: true });
});

const e1751 = (source: string, root: string) =>
  check(one(source, "entry.ts"), { root }).diagnostics.filter((d) => d.code === "E1751");

test("A file reading process.env and importing node:path checks clean in a project whose root resolves @types/node", () => {
  expect(e1751(NODE_FILE, WITH_NODE)).toEqual([]);
});

test("A file reading process.env and importing node:path reports E1751 in a project whose root does not resolve @types/node", () => {
  const d = e1751(NODE_FILE, emptyRoot);
  expect(d.length).toBeGreaterThan(0);
  for (const x of d) expect(x.message).toMatch(/^TS\d{4}/);
  expect(d.some((x) => x.message.includes("process") || x.message.includes("node:path"))).toBe(true);
});

test("The only ambient types are Node's, loaded when @types/node resolves from the project root: without it a file with no Node names reports no E1751", () => {
  expect(e1751(PLAIN_FILE, emptyRoot)).toEqual([]);
});

test("A project root with no node_modules of its own resolves @types/node from an ancestor directory", () => {
  expect(e1751(NODE_FILE, import.meta.dirname)).toEqual([]);
});
