import type { Span } from "./Span.ts";

/** A read of an identifier in value position. `shorthand` marks `{ x }` object-literal properties. */
export type IdentRef = Span & { name: string; shorthand: boolean };
