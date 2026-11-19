import type { Expression } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { SchemaSource } from "../SchemaSource.ts";

/** An expression with the file it is written in. */
export type At = { readonly expr: Expression; readonly file: SourceFile; readonly src: SchemaSource };
