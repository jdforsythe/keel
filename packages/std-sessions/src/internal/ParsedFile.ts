import type { Program } from "oxc-parser";
import type { SchemaScope } from "./SchemaScope.ts";

/** A project file parsed with its schema scope. */
export type ParsedFile = { readonly path: string; readonly program: Program; readonly scope: SchemaScope };
