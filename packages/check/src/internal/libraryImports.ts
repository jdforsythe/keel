import path from "node:path";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Checked } from "./Checked.ts";
import { moduleDiag } from "./modules/moduleDiag.ts";
import { short } from "./modules/short.ts";
import { specifierLiterals } from "./specifierLiterals.ts";

/**
 * E1163, the import half (k.library Rules): in each library file, a relative `import`, re-export or literal `import()`
 * whose target lies outside the file's package folder (`folder`, `<p>node_modules/<name>/`), at the specifier's opening
 * quote; no fix. A bare specifier is read as in an app file and is not judged here.
 */
export function libraryImports(
  checked: readonly Checked[],
  folder: (path: string) => string | undefined,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const { file, parsed } of checked) {
    const own = folder(file.path);
    if (own === undefined) continue;
    for (const lit of specifierLiterals(parsed.program)) {
      if (!lit.spec.startsWith("./") && !lit.spec.startsWith("../")) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), lit.spec.split("?")[0] ?? ""));
      if (target.startsWith(own)) continue;
      const msg = `library file imports ${short(lit.spec)}, outside its package`;
      out.push(moduleDiag("E1163", file, lit.start, msg, undefined, "k.library"));
    }
  }
  return out;
}
