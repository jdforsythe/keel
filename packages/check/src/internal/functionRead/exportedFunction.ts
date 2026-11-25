import type { SourceFile } from "../../types/SourceFile.ts";
import { parseFile } from "../parseFile.ts";
import type { FileOf } from "./FileOf.ts";
import type { Located } from "./Located.ts";
import { READ_DEPTH } from "./READ_DEPTH.ts";
import { localFunction } from "./localFunction.ts";

/** The function `file` exports as `name`: declared there, a local exported under it, the default, a re-export or `export *`. */
export function exportedFunction(name: string, file: SourceFile, fileOf: FileOf, hops = 0): Located | undefined {
  if (hops > READ_DEPTH) return undefined;
  for (const st of parseFile(file).program.body) {
    if (st.type === "ExportDefaultDeclaration" && name === "default") {
      const d = st.declaration;
      if (d.type === "FunctionDeclaration" || d.type === "FunctionExpression" || d.type === "ArrowFunctionExpression")
        return d.body === null ? undefined : { fn: d, file };
      if (d.type === "Identifier") return localFunction(d.name, file, fileOf, hops + 1);
    } else if (st.type === "ExportNamedDeclaration" && st.declaration !== null && st.declaration !== undefined) {
      const d = st.declaration;
      const declares =
        (d.type === "FunctionDeclaration" && d.id?.name === name) ||
        (d.type === "VariableDeclaration" &&
          d.declarations.some((v) => v.id.type === "Identifier" && v.id.name === name));
      if (declares) return localFunction(name, file, fileOf, hops + 1);
    } else if (st.type === "ExportNamedDeclaration")
      for (const sp of st.specifiers) {
        const exported = sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value;
        const local = sp.local.type === "Identifier" ? sp.local.name : sp.local.value;
        if (exported !== name) continue;
        if (st.source === null) return localFunction(local, file, fileOf, hops + 1);
        const target = fileOf(file, st.source.value);
        return target === undefined ? undefined : exportedFunction(local, target, fileOf, hops + 1);
      }
    else if (st.type === "ExportAllDeclaration" && st.exported === null) {
      const target = fileOf(file, st.source.value);
      const hit = target === undefined ? undefined : exportedFunction(name, target, fileOf, hops + 1);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}
