import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { diag } from "../diag.ts";

const SERVER_FILE = /\.server\.[cm]?[jt]sx?$/;
const SERVER_SPEC = /\.server(?:\.[cm]?[jt]sx?)?$/;

/**
 * E1004: a `*.server.ts` module reached from a module that is not itself a server module (ADR-0006): a value
 * import, a re-export (`export … from`, a barrel a client file imports), or a literal `import()`.
 * `clientOnly`: the file's deployables declare no server (`adapter: 'client'`), so nothing is reported.
 */
export function ruleServerImport(a: Analysis, clientOnly = false): Diagnostic[] {
  if (clientOnly || SERVER_FILE.test(a.path)) return [];
  const reached: { source: string; start: number }[] = a.dynamicImports.slice();
  for (const i of a.imports) if (i.importKind !== "type") reached.push({ source: i.source.value, start: i.start });
  for (const st of a.program.body)
    if ((st.type === "ExportNamedDeclaration" || st.type === "ExportAllDeclaration") && st.source !== null)
      if (st.exportKind !== "type") reached.push({ source: st.source.value, start: st.start });
  return reached
    .filter((r) => SERVER_SPEC.test(r.source))
    .sort((x, y) => x.start - y.start)
    .map((r) => diag(a, "E1004", r.start, `client code imports server module ${r.source}`, "k.compiler"));
}
