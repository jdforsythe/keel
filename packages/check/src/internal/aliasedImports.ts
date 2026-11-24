import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Checked } from "./Checked.ts";
import { applyEdits } from "./applyEdits.ts";
import { lineCol } from "./lineCol.ts";
import { specifierLiterals } from "./specifierLiterals.ts";
import { tsCompilerOptions } from "./tsCompilerOptions.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

/** Kernel and stdlib code and generated output, at the root: E1576's files are the others. */
const LIBRARY = /^(?:packages|node_modules|\.keel)\//;

/**
 * E1013 (k.bundle Aliases): a specifier other than relative or `#` (E1576's) that resolves, as the type check
 * resolves it (bundler resolution, `exports`, `node_modules` upward, symlinks followed, no `tsconfig.json`), to a file
 * under its own project's `modules/`. Reported at the opening quote; the fix writes the relative specifier, keeping
 * the quote and the `?query`. `dirs` are the project dirs, deepest first.
 */
export function aliasedImports(checked: readonly Checked[], root: string, dirs: readonly string[]): Diagnostic[] {
  const options = tsCompilerOptions();
  const cache = ts.createModuleResolutionCache(root, (s) => s, options);
  if (!fs.existsSync(root)) return [];
  const real = fs.realpathSync(root);
  const out: Diagnostic[] = [];
  for (const { file, parsed } of checked) {
    if (LIBRARY.test(file.path)) continue;
    const dir = dirs.find((d) => file.path.startsWith(d)) ?? "";
    for (const lit of specifierLiterals(parsed.program)) {
      if (lit.spec.startsWith(".") || lit.spec.startsWith("#") || lit.spec.startsWith("/")) continue;
      const q = lit.spec.indexOf("?");
      const bare = q < 0 ? lit.spec : lit.spec.slice(0, q);
      const query = q < 0 ? "" : lit.spec.slice(q);
      const hit = ts.resolveModuleName(bare, path.join(root, file.path), options, ts.sys, cache).resolvedModule;
      if (hit === undefined) continue;
      const landed = path.relative(real, hit.resolvedFileName).split(path.sep).join("/");
      if (!landed.startsWith(`${dir}modules/`)) continue;
      const from = path.posix.dirname(file.path);
      const rel = path.posix.relative(from, landed);
      const relative = `${rel.startsWith(".") ? "" : "./"}${rel}${query}`;
      const edit = { start: lit.start + 1, end: lit.end - 1, text: relative };
      out.push({
        kind: "diag",
        code: "E1013",
        path: file.path,
        ...lineCol(file.source, lit.start),
        message: `'${lit.spec}' reaches ${landed.slice(dir.length)} by an alias; import it as '${relative}'`,
        see: "k.bundle",
        fix: unifiedDiff(file.path, file.source, applyEdits(file.source, [edit])),
      });
    }
  }
  return out;
}
