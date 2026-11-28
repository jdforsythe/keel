import path from "node:path";
import type { TemplateLiteral } from "oxc-parser";

const SLOT = "\u0000";

/**
 * The files an `import()` of template literal `t` in file `from` names (k.boundary Following), as Vite's
 * dynamic-import-vars expands it: when the text before the first substitution starts `./` or `../`, a pattern over
 * root-relative paths, each substitution read as any run of characters within one path segment; else undefined.
 */
export function templatePattern(from: string, t: TemplateLiteral): RegExp | undefined {
  const head = t.quasis[0]?.value.cooked ?? "";
  if (t.expressions.length === 0 || !(head.startsWith("./") || head.startsWith("../"))) return undefined;
  const text = t.quasis.map((q) => q.value.cooked ?? "").join(SLOT);
  const joined = path.posix.join(path.posix.dirname(from), text);
  const escaped = joined
    .split(SLOT)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${escaped}$`);
}
