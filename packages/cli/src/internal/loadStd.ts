import { importDeps } from "@keel/compiler/std/importDeps";
import type { Io } from "../types/Io.ts";
import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { withFiles } from "./withFiles.ts";

/** Import the project's std `deps` (and their `./tools`) so a stdlib package can fill the `session` slot; E1159 as diags. */
export async function loadStd(io: Io): Promise<Diag[]> {
  const loaded = await importDeps(io.cwd, projectFiles(withFiles(io, "query")));
  return loaded.map((d) =>
    makeDiag(d.code, d.message, {
      path: d.path,
      line: d.line,
      col: d.col,
      see: d.see,
      fix: d.fix,
    }),
  );
}
