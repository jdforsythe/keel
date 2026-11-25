import type { AstNode } from "./AstNode.ts";

/** One step from a node down to a reference: the ancestor and the field of it the path goes through. */
export type RefLink = { readonly node: AstNode; readonly key: string };
