import type { SourceFile } from "@keel/check";
import { type Program, parseSync } from "oxc-parser";

const memo = new WeakMap<SourceFile, Program | null>();

/** A project file's AST (`.tsx`/`.jsx` as TSX), memoized per file object; `undefined` on a syntax error. */
export function parsed(file: SourceFile): Program | undefined {
  const hit = memo.get(file);
  if (hit !== undefined) return hit ?? undefined;
  const r = parseSync(file.path, file.source, { sourceType: "module", lang: file.path.endsWith("x") ? "tsx" : "ts" });
  const program = r.errors.length > 0 ? null : r.program;
  memo.set(file, program);
  return program ?? undefined;
}
