import path from "node:path";
import ts from "typescript";
import { lineCol } from "./lineCol.ts";
import { unprovenPredicates } from "./unprovenPredicates.ts";

/**
 * E1762's judgement over a package's own files (`tooling/structure-lint.mjs` S0019, k.identity Rules): one program
 * from the package's `tsconfig` at `tsconfigPath`, and each of `files` (absolute, or relative to the tsconfig's
 * folder) read by `unprovenPredicates`. Each finding is the file as given, its 1-based line and column and the message.
 */
export function packagePredicates(
  tsconfigPath: string,
  files: readonly string[],
): { file: string; line: number; col: number; message: string }[] {
  const dir = path.dirname(tsconfigPath);
  const read = ts.readConfigFile(tsconfigPath, (f) => ts.sys.readFile(f));
  const config = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, dir);
  const names = files.map((f) => path.resolve(dir, f));
  const program = ts.createProgram({ rootNames: names, options: { ...config.options, noEmit: true } });
  const checker = program.getTypeChecker();
  const out: { file: string; line: number; col: number; message: string }[] = [];
  files.forEach((file, i) => {
    const sf = program.getSourceFile(names[i] ?? file);
    if (sf === undefined) return;
    for (const f of unprovenPredicates(sf, checker)) out.push({ file, ...lineCol(sf.text, f.at), message: f.message });
  });
  return out;
}
