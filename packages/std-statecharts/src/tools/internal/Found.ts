import type { Span } from "./Span.ts";

/** One rule hit of the statecharts rules on a file: code, where, one line of message and the fix's replacement text. */
export type Found = { readonly code: string; readonly at: Span; readonly message: string; readonly fix?: string };
