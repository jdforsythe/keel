import type { Expression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";

/**
 * Where `followRef` lands: an expression in a file, an export of a package (`name` `*` for the namespace, `default`
 * for the default export), a name the file never declares (`"global"`), or `null` when it cannot follow.
 */
export type FollowedRef =
  | { readonly expr: Expression; readonly file: SourceFile }
  | { readonly package: string; readonly name: string }
  | "global"
  | null;
