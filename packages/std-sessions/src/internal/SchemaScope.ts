import type { SourceFile } from "@keel/check";
import type { Expression } from "oxc-parser";

/** What a file offers to schema resolution: top-level consts, imports by local name, and the project files. */
export type SchemaScope = {
  readonly path: string;
  readonly consts: ReadonlyMap<string, Expression>;
  readonly imports: ReadonlyMap<string, { readonly source: string; readonly name: string }>;
  readonly files: readonly SourceFile[];
};
