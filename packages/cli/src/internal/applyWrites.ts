import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { Write } from "../types/Write.ts";
import { WriteRefused } from "./WriteRefused.ts";

const outside = (root: string, abs: string): boolean => {
  const rel = relative(root, abs);
  return rel === "" || rel.split(/[\\/]/)[0] === ".." || isAbsolute(rel);
};
const lexists = (abs: string): boolean => {
  try {
    lstatSync(abs);
    return true;
  } catch {
    return false;
  }
};
/** Whether a write to `abs` would follow a symlink out of `real` (the root's real path), or through a linked target. */
const escapes = (real: string, abs: string): boolean => {
  if (lexists(abs) && lstatSync(abs).isSymbolicLink()) return true;
  let dir = abs;
  while (!lexists(dir)) dir = dirname(dir);
  try {
    const at = realpathSync(dir);
    return at !== real && outside(real, at);
  } catch {
    return true;
  }
};

/**
 * Binary only: apply an edit set under `cwd`, all or nothing on paths: any write that resolves outside `cwd`
 * (absolute, `..`, or `cwd` itself) rejects the whole set before anything is written. So does, with `WriteRefused`,
 * a write whose target is a symlink or whose nearest existing ancestor's real path is outside `cwd`'s (k.scaffold
 * E1357): a link never carries a write out of the project. Existing files keep their
 * mode (generated read-only files are made writable for the write, then restored); `readonly` writes end at
 * 0444. `null` content removes the file, then each parent directory it leaves empty, up to `cwd`.
 */
export function applyWrites(cwd: string, writes: readonly Write[]): void {
  const root = resolve(cwd);
  const targets = writes.map((w) => ({ w, abs: resolve(root, w.path) }));
  const out = targets.find(({ abs }) => outside(root, abs));
  if (out !== undefined) throw new Error(`refusing to write outside ${root}: ${out.w.path}`);
  const real = realpathSync(root);
  const linked = targets.filter(({ abs }) => escapes(real, abs)).map(({ w }) => w.path);
  if (linked.length > 0) throw new WriteRefused(linked);
  for (const { w, abs } of targets) {
    const mode = existsSync(abs) ? statSync(abs).mode & 0o777 : undefined;
    if (w.content === null) {
      if (mode !== undefined) rmSync(abs, { force: true });
      for (let dir = dirname(abs); dir !== root && existsSync(dir) && readdirSync(dir).length === 0; dir = dirname(dir))
        rmdirSync(dir);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    if (mode !== undefined) chmodSync(abs, mode | 0o200);
    writeFileSync(abs, w.content);
    chmodSync(abs, w.readonly ? 0o444 : (mode ?? 0o644));
  }
}
