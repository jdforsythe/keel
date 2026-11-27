import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Diag } from "../Diag.ts";
import { makeDiag } from "../makeDiag.ts";
import type { View } from "./View.ts";
import type { Work } from "./Work.ts";

const read = (file: string): string | null => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

/** The reason a write failed, as W1018 states it. */
function reason(e: unknown): string {
  const code: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined;
  return code === "EROFS"
    ? "read-only file system"
    : code === "EACCES" || code === "EPERM"
      ? "no permission"
      : String(code ?? e);
}

/**
 * Write each view under `cwd` whose bytes differ from its derivation (k.derived Refresh): a temporary file
 * `<name>.<pid>.tmp` beside it, given the view's mode (read-only for a `.keel/` view, an existing deploy file's own),
 * renamed over it, so a reader sees one whole file; a `null` text removes a file no longer needed. No lock is taken.
 * Nothing is written when `held()` says an input changed during the run. Each view written counts in
 * `work.refreshed`; each that cannot be written is one W1018 with its path and the reason, and the run goes on.
 */
export function refreshViews(cwd: string, views: readonly View[], held: () => boolean, work: Work): Diag[] {
  const out: Diag[] = [];
  const differing = views.filter((v) => read(join(cwd, v.path)) !== v.text);
  if (differing.length === 0 || !held()) return out;
  for (const v of differing) {
    const file = join(cwd, v.path);
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      if (v.text === null) {
        if (existsSync(file)) rmSync(file);
      } else {
        const mode = v.readonly ? 0o444 : existsSync(file) ? statSync(file).mode & 0o777 : 0o644;
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(tmp, v.text);
        chmodSync(tmp, mode);
        renameSync(tmp, file);
      }
      work.refreshed += 1;
    } catch (e) {
      rmSync(tmp, { force: true });
      const m = `${v.path} not written (${reason(e)}); judged from the derivation`;
      out.push(makeDiag("W1018", m, { path: v.path, see: "k.derived" }));
    }
  }
  return out;
}
