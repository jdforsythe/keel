import type { ObjectExpression } from "oxc-parser";

/** A `{ method, path, ... }` entry of an `endpoints({...})` literal from `@keel/services`. */
export type EndpointLiteral = { readonly name: string; readonly obj: ObjectExpression };
