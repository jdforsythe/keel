import { type HandlerUse, projectHandlerUses } from "@keel/compiler/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import { parseFile } from "./parseFile.ts";

const memo = new WeakMap<readonly SourceFile[], ReadonlyMap<string, readonly HandlerUse[]>>();

/**
 * The uses of `@keel/router`'s handlers in `path` (k.bundle Handlers), read by the compiler's binding pass over every
 * file of its project, once per project: E1551 and E1009 read the definition the build's E1007 `handler` reads.
 */
export function handlerUsesIn(path: string, project: readonly SourceFile[]): readonly HandlerUse[] {
  let table = memo.get(project);
  if (table === undefined) {
    const files = project.flatMap((f) => {
      const p = parseFile(f);
      return p.ok ? [{ path: f.path, program: p.program }] : [];
    });
    table = projectHandlerUses(files);
    memo.set(project, table);
  }
  return table.get(path) ?? [];
}
