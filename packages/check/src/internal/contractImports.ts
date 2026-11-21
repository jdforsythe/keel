import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Checked } from "./Checked.ts";
import { diagAt } from "./diagAt.ts";
import { isAppPath } from "./isAppPath.ts";

const SCHEMA = /\.schema(?:\.ts)?$/;

/** Whether a contract file may import `spec`: a package specifier or a `*.schema.ts` file. */
const allowed = (spec: string): boolean => !(spec.startsWith(".") || spec.startsWith("/")) || SCHEMA.test(spec);

/**
 * E1514 (k.contract Rules): in an app `*.contract.ts` file, each import (or re-export) of anything but a package or
 * a `*.schema.ts` file, reported at the import, no fix: a contract stays client-safe.
 */
export function contractImports(files: readonly Checked[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const { file, parsed } of files) {
    if (!file.path.endsWith(".contract.ts") || !isAppPath(file.path)) continue;
    for (const st of parsed.program.body) {
      const source =
        st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration"
          ? st.source
          : st.type === "ExportNamedDeclaration"
            ? st.source
            : null;
      if (source === null || allowed(source.value)) continue;
      out.push(
        diagAt(
          file,
          st.start,
          "E1514",
          `a contract imports '${source.value}'; only *.schema.ts files and packages`,
          "k.contract",
        ),
      );
    }
  }
  return out;
}
