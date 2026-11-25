import type { AstNode } from "./AstNode.ts";
import type { RefLink } from "./RefLink.ts";

/** A reference to a top-level binding: the identifier and its ancestors from the program down, nearest last. */
export type TopRef = { readonly ident: AstNode; readonly links: readonly RefLink[] };
