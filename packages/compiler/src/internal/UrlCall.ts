import type { Expression } from "oxc-parser";

/** One `new URL(<first>, import.meta.url)` call: its first argument, and the literal text it holds. */
export type UrlCall = {
  readonly first: Expression | undefined;
  /** The text of a string literal or of a template literal without an expression; undefined for any other form. */
  readonly name: string | undefined;
};
