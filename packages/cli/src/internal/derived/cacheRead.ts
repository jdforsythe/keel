import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isRecord } from "../isRecord.ts";
import type { Evaluation } from "./Evaluation.ts";
import { cacheKey } from "./cacheKey.ts";
import { hashFile } from "./hashFile.ts";

/**
 * The evaluation the cache folder `dir` holds for the project at real path `root` whose code file paths are `paths`, or undefined (k.derived
 * Derivation cache): an entry is used only when its key is this one and every recorded input, read again, has the
 * same SHA-256; modification times are never read. An entry that cannot be read or lacks the shape is a miss.
 */
export function cacheRead(dir: string, root: string, paths: readonly string[]): Evaluation | undefined {
  if (!existsSync(dir)) return undefined;
  const key = cacheKey(root, paths);
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()) {
    let v: unknown;
    try {
      v = JSON.parse(readFileSync(join(dir, name), "utf8"));
    } catch {
      continue;
    }
    if (!isRecord(v) || v.key !== key || !Array.isArray(v.inputs) || !isRecord(v.evaluation)) continue;
    const files: string[] = [];
    let held = true;
    for (const i of v.inputs) {
      const file: unknown = isRecord(i) ? i.file : undefined;
      if (!isRecord(i) || typeof file !== "string" || i.sha256 !== hashFile(file)) {
        held = false;
        break;
      }
      files.push(file);
    }
    const e = v.evaluation;
    if (!held || !isRecord(e.routes) || !isRecord(e.surface) || !Array.isArray(e.problems)) continue;
    const problems = e.problems.filter((p) => typeof p === "string");
    return { routes: e.routes, surface: e.surface, problems, inputs: files };
  }
  return undefined;
}
