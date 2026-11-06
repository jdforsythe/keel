import type { Program } from "oxc-parser";

/** One parsed file: the oxc AST and whether parsing reported errors. */
export type Parsed = { readonly program: Program; readonly ok: boolean };
