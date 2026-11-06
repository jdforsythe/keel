import type { Span } from "./Span.ts";

/** A source replacement applied by the lowering (outside or inside JSX expressions). */
export type Edit = Span & { text: string };
