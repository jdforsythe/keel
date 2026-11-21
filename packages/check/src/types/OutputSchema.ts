import type { Expression } from "oxc-parser";

/** An `output` schema a file declares (`outputSchemas`): the expression and its 1-based position. */
export type OutputSchema = { readonly expr: Expression; readonly line: number; readonly col: number };
