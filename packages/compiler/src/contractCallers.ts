import path from "node:path";
import { parseSync } from "oxc-parser";
import { importEdges } from "./internal/importEdges.ts";
import type { SourceFile } from "./types/SourceFile.ts";

const OWNER = /^modules\/([^/]+)\//;
const CONTRACT = /^modules\/([^/]+)\/([^/]+)\.contract\.ts$/;

/**
 * The `callers` of each app module's contract (k.compat Surface), read statically: for each module `<id>` whose
 * `modules/<id>/<id>.contract.ts` another module's file value-imports (a relative specifier, `.ts` optional), the ids
 * of the importing modules, sorted; keyed by module id, sorted. A file that does not parse imports nothing. `files`
 * are root-relative project files.
 */
export function contractCallers(files: readonly SourceFile[]): Record<string, string[]> {
  const found = new Map<string, Set<string>>();
  for (const f of files) {
    const from = OWNER.exec(f.path)?.[1];
    if (from === undefined || !/\.[cm]?[jt]sx?$/.test(f.path)) continue;
    const r = parseSync(f.path, f.source, { sourceType: "module", lang: f.path.endsWith("x") ? "tsx" : "ts" });
    if (r.errors.length > 0) continue;
    for (const e of importEdges(r.program)) {
      if (!e.source.startsWith(".")) continue;
      const at = path.posix.join(path.posix.dirname(f.path), e.source.split("?")[0] ?? e.source);
      const m = CONTRACT.exec(at.endsWith(".ts") ? at : `${at}.ts`);
      if (m === null || m[1] !== m[2] || m[1] === from) continue;
      const id = m[1] ?? "";
      found.set(id, (found.get(id) ?? new Set<string>()).add(from));
    }
  }
  return Object.fromEntries([...found.keys()].sort().map((id) => [id, [...(found.get(id) ?? [])].sort()]));
}
