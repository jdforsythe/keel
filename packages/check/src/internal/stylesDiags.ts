import { stylesProblems } from "@keel/compiler/hosting/stylesProblems";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { lineCol } from "./lineCol.ts";

/**
 * E1587 (k.topology Rules): each `styles` entry of `<dir>topology.ts` (`source`) that is not a string literal, or
 * whose specifier does not resolve from `root` (the project folder) to a package export that is a `.css` file
 * (`stylesProblems`), at the entry. No fix: which stylesheet the app means is the author's.
 */
export function stylesDiags(dir: string, source: string, root: string): Diagnostic[] {
  return stylesProblems(source, root).map((p) => ({
    kind: "diag",
    code: "E1587",
    path: `${dir}topology.ts`,
    ...lineCol(source, p.offset),
    message: p.message,
    see: "k.topology",
  }));
}
