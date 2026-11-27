import ts from "typescript";
import { isSchemaExport } from "./isSchemaExport.ts";
import { nodeAt } from "./nodeAt.ts";

/**
 * The argument of a call of `@keel/schema`'s `err` that holds offset `pos`, or `undefined` (E1458 with the type pass:
 * TypeScript refuses an `err` argument that is no `KeelError`, and that refusal is reported as E1458 at the argument).
 */
export function errArgumentAt(
  sf: ts.SourceFile,
  pos: number,
  checker: ts.TypeChecker,
  ownerOf: (fileName: string) => string | null,
): ts.Expression | undefined {
  for (let n: ts.Node = nodeAt(sf, pos); !ts.isSourceFile(n); n = n.parent) {
    const p = n.parent;
    if (ts.isCallExpression(p) && p.arguments[0] === n && isSchemaExport(p.expression, "err", checker, ownerOf))
      return p.arguments[0];
    if (ts.isBlock(n)) return undefined;
  }
  return undefined;
}
