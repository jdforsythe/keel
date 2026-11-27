import { existsSync, mkdirSync, realpathSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { linkEscapes } from "@keel/scaffold/links";
import { realOf } from "./realOf.ts";

/**
 * Writes `files` (keyed from the folder) under `abs`, all or nothing (k.create-folder Folder): every target is judged first
 * as k.scaffold Links says (`{ linked }`, E1357, nothing written); then each folder is made and each file created only
 * where nothing is (`wx`), never replaced. A write that fails removes the files and folders this run made, in reverse,
 * and is returned as `{ failed }` with its path (E1365).
 */
export function writePlan(
  abs: string,
  files: ReadonlyMap<string, string>,
): { readonly ok: true } | { readonly linked: string } | { readonly failed: string; readonly reason: string } {
  const paths = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  // A folder this run makes holds no link, so only an existing one is judged; its ancestors are never read.
  const fresh = !existsSync(abs);
  if (!fresh) {
    const real = realOf(abs);
    const linked = paths.find((p) => linkEscapes(real, join(real, p)));
    if (linked !== undefined) return { linked };
  }
  const madeDirs: string[] = [];
  const madeFiles: string[] = [];
  const undo = (): void => {
    for (const f of madeFiles.reverse()) rmSync(f, { force: true });
    for (const d of madeDirs.reverse()) {
      try {
        rmdirSync(d);
      } catch {
        // not empty: something else wrote into it, so it is not this run's to remove
      }
    }
  };
  if (fresh) {
    try {
      const top = mkdirSync(abs, { recursive: true });
      for (let at = abs; top !== undefined; at = dirname(at)) {
        madeDirs.unshift(at);
        if (at === top || dirname(at) === at) break;
      }
    } catch (e) {
      return {
        failed: ".",
        reason: e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "an error",
      };
    }
  }
  /** The folders under `abs` on the way to `dir` that do not exist yet, made in order. */
  const mkdirs = (dir: string): void => {
    const missing: string[] = [];
    for (let at = dir; at !== abs && !existsSync(at); at = dirname(at)) missing.unshift(at);
    for (const d of missing) {
      mkdirSync(d);
      madeDirs.push(d);
    }
  };
  for (const p of paths) {
    const target = join(abs, p);
    try {
      mkdirs(dirname(target));
      writeFileSync(target, files.get(p) ?? "", { flag: "wx" });
      madeFiles.push(target);
    } catch (e) {
      undo();
      const code = e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "an error";
      return { failed: p, reason: code };
    }
  }
  return { ok: true };
}
