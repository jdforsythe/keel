import { clipMessage } from "@keel/schema/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { lineCol } from "./lineCol.ts";
import { moduleContracts } from "./moduleContracts.ts";
import { parseFile } from "./parseFile.ts";
import { propertyOf } from "./propertyOf.ts";

const CONTRACT = /\.contract\.ts$/;

/**
 * E1510 (k.contract Local routes, k.api Rules): a `local` member of an app module's contract entry whose value is not
 * the literal `true` (`false`, `!0`, a name bound to `true`, a conditional), at that member's value, one per entry.
 * Paths are prefixed with `dir`. No fix.
 */
export function localNotLiteral(dir: string, files: readonly SourceFile[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const contracts = moduleContracts(
    files.filter((f) => CONTRACT.test(f.path)).map((file) => ({ file, parsed: parseFile(file) })),
  );
  for (const { contract } of contracts)
    for (const e of contract.list) {
      const p = e.obj === null ? null : propertyOf(e.obj, "local");
      if (p === null || (p.value.type === "Literal" && p.value.value === true)) continue;
      const { line, col } = lineCol(contract.file.source, p.value.start);
      out.push({
        kind: "diag",
        code: "E1510",
        path: `${dir}${contract.file.path}`,
        line,
        col,
        message: clipMessage(`${e.id}: local takes the literal true`, 89),
        see: "k.contract",
      });
    }
  return out;
}
