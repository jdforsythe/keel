import { chmodSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Write } from "./Write.ts";

/**
 * Binary only: apply an edit set under `cwd`. Existing files keep their mode (generated read-only files are
 * made writable for the write, then restored); `readonly` writes end at 0444. `null` content removes the file.
 */
export function applyWrites(cwd: string, writes: readonly Write[]): void {
  for (const w of writes) {
    const abs = join(cwd, w.path);
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
