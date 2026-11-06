import { chmodSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { Write } from "../types/Write.ts";

/**
 * Binary only: apply an edit set under `cwd`, all or nothing on paths: any write that resolves outside `cwd`
 * (absolute, `..`, or `cwd` itself) rejects the whole set before anything is written. Existing files keep their
 * mode (generated read-only files are made writable for the write, then restored); `readonly` writes end at
 * 0444. `null` content removes the file.
 */
export function applyWrites(cwd: string, writes: readonly Write[]): void {
  const root = resolve(cwd);
  const targets = writes.map((w) => ({ w, abs: resolve(root, w.path) }));
  const outside = targets.find(({ abs }) => {
    const rel = relative(root, abs);
    return rel === "" || rel.split(/[\\/]/)[0] === ".." || isAbsolute(rel);
  });
  if (outside !== undefined) throw new Error(`refusing to write outside ${root}: ${outside.w.path}`);
  for (const { w, abs } of targets) {
    const mode = existsSync(abs) ? statSync(abs).mode & 0o777 : undefined;
    if (w.content === null) {
      if (mode !== undefined) rmSync(abs, { force: true });
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    if (mode !== undefined) chmodSync(abs, mode | 0o200);
    writeFileSync(abs, w.content);
    chmodSync(abs, w.readonly ? 0o444 : (mode ?? 0o644));
  }
}
