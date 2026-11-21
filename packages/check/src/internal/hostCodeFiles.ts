import type { SourceFile } from "../types/SourceFile.ts";
import { hostCodeSpecifier } from "./hostCodeSpecifier.ts";
import { hostUses } from "./hostUses.ts";
import { isCodePath } from "./isCodePath.ts";
import { joinPath } from "./modules/joinPath.ts";
import { parseFile } from "./parseFile.ts";

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", "/index.ts", "/index.tsx"];
const memo = new WeakMap<readonly SourceFile[], ReadonlySet<string>>();

/**
 * The host element code files of a project (k.host-code): each project file a `Host`'s `code` prop imports in the
 * one form E1824 allows, resolved against the importing file's folder (a specifier without an extension tries the
 * TypeScript and JavaScript ones). Computed once per project array.
 */
export function hostCodeFiles(project: readonly SourceFile[]): ReadonlySet<string> {
  const hit = memo.get(project);
  if (hit !== undefined) return hit;
  const paths = new Set(project.map((f) => f.path));
  const out = new Set<string>();
  for (const f of project) {
    if (!isCodePath(f.path) || !f.source.includes("Host")) continue;
    const dir = f.path.slice(0, Math.max(0, f.path.lastIndexOf("/")));
    for (const use of hostUses(parseFile(f).program)) {
      const spec = hostCodeSpecifier(use.props.get("code")?.value ?? null);
      if (spec === null) continue;
      const target = joinPath(dir, spec);
      const found = EXTENSIONS.map((e) => `${target}${e}`).find((p) => paths.has(p));
      out.add(found ?? target);
    }
  }
  memo.set(project, out);
  return out;
}
