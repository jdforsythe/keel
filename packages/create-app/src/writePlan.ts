import { existsSync, mkdirSync, realpathSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { linkEscapes } from "@keel/scaffold/links";
import { realOf } from "./realOf.ts";

/**
 * Writes `files` (keyed from the folder) under `abs`, all or nothing (k.create Folder): every target is judged first
 * as k.scaffold Links says (`{ linked }`, E1357, nothing written); then each folder is made and each file created only
 * where nothing is (`wx`), never replaced. A write that fails removes the files and folders this run made, in reverse,
 * and is returned as `{ failed }` with its path (E1365).
 */
export function writePlan(
  abs: string,
  files: ReadonlyMap<string, string>,
): { readonly ok: true } | { readonly linked: string } | { readonly failed: string; readonly reason: string } {
  const real = realOf(abs);
  const paths = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const linked = paths.find((p) => linkEscapes(real, join(real, p)));
  if (linked !== undefined) return { linked };
  const madeDirs: string[] = [];
  const madeFiles: string[] = [];
  const mkdirs = (dir: string): void => {
    const missing: string[] = [];
    for (let at = dir; !existsSync(at) && dirname(at) !== at; at = dirname(at)) missing.unshift(at);
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
      for (const f of madeFiles.reverse()) rmSync(f, { force: true });
      for (const d of madeDirs.reverse()) {
        try {
          rmdirSync(d);
        } catch {
          // not empty: something else wrote into it, so it is not this run's to remove
        }
      }
      const code = e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "an error";
      return { failed: p, reason: code };
    }
  }
  return { ok: true };
}
