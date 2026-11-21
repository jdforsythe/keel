import type { SourceFile } from "@keel/check";
import type { Program } from "oxc-parser";

/** A node and the file it was found in, with that file's AST. */
export type At = { readonly node: unknown; readonly file: SourceFile; readonly ast: Program };
