// Not a test file. On-disk project roots for the RFC 0231 check suites. Public API only.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import type { Files } from "./support.ts";

const HERE = import.meta.dirname;
const COMPILER = realpathSync(join(HERE, "..", "..", "compiler"));
const TESTING = realpathSync(join(HERE, "..", "..", "testing"));
const NODE_TYPES = realpathSync(join(HERE, "..", "node_modules", "@types", "node"));
const resolveFrom = (dir: string, spec: string): string =>
  dirname(createRequire(join(dir, "package.json")).resolve(`${spec}/package.json`));
const VITE = resolveFrom(COMPILER, "vite");
const VITEST = resolveFrom(HERE, "vitest");

/** A fresh empty folder under the real temp directory. */
export const freshDir = (prefix: string): string => mkdtempSync(join(realpathSync(tmpdir()), `${prefix}-`));
export const removeDir = (dir: string): void => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
};
/** The `root` option for a folder (a trailing separator, as the E1013 suite passes it). */
export const rootOption = (dir: string): string => join(dir, sep);

export const writeFileAt = (root: string, path: string, source: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), source);
};
export const writeTree = (root: string, files: Files): void => {
  for (const f of files) writeFileAt(root, f.path, f.source);
};
export const linkAt = (root: string, path: string, target: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  symlinkSync(target, join(root, path));
};

/** A project root whose `node_modules` resolves `@keel/compiler`, `@keel/testing`, `vite`, `vitest` and `@types/node`. */
export function ambientRoot(): string {
  const dir = freshDir("keel-sec");
  linkAt(dir, "node_modules/@keel/compiler", COMPILER);
  linkAt(dir, "node_modules/@keel/testing", TESTING);
  linkAt(dir, "node_modules/vite", VITE);
  linkAt(dir, "node_modules/vitest", VITEST);
  linkAt(dir, "node_modules/@types/node", NODE_TYPES);
  return dir;
}
