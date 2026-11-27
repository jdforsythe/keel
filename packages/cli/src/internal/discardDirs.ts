import { rmSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

/** Binary only: remove each folder of `dirs` under `cwd`, whole; one that resolves outside `cwd`, or to it, is left. */
export function discardDirs(cwd: string, dirs: readonly string[]): void {
  const root = resolve(cwd);
  for (const d of dirs) {
    const abs = resolve(root, d);
    const rel = relative(root, abs);
    if (rel === "" || rel.split(/[\\/]/)[0] === ".." || isAbsolute(rel)) continue;
    rmSync(abs, { recursive: true, force: true });
  }
}
