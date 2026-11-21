import type { Expression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";

/**
 * Where `followValue` lands: an expression in a file, a binding from a package, a name the file never declares
 * (`"global"`), or `null` when it cannot follow.
 */
export type Followed = { readonly expr: Expression; readonly file: SourceFile } | "package" | "global" | null;
